/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Client-side asynchronous Canvas image compression utility for NileFound.
 * Bounds target dimensions (<= 1024px) before allocating canvas memory, yields
 * between heavy operations to keep mobile UI responsive, and outputs compact
 * JPEG Blobs ready for Firebase Cloud Storage upload.
 */

export interface CompressionResult {
  file: File;
  thumbFile: File;
  previewUrl: string;
  originalSizeKb: number;
  compressedSizeKb: number;
  thumbSizeBytes: number;
  reductionPercentage: number;
}

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const MAX_CANVAS_BOUND = 1024;
export const MAX_STORAGE_PHOTO_BYTES = 100 * 1024;
export const MAX_STORAGE_THUMB_BYTES = 24 * 1024;
export const MAX_FIRESTORE_DATA_URL_CHARS = 135000;
export const MAX_THUMB_DATA_URL_CHARS = 4096;

const VALID_IMAGE_DATA_URL_RE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]{16,}$/;
const VALID_HTTPS_IMAGE_URL_RE = /^https:\/\/[^\s]+$/i;
const VALID_BLOB_PREVIEW_URL_RE = /^blob:[^\s]+$/i;

export function isValidImageDataUrl(src?: string | null): src is string {
  return typeof src === 'string' && VALID_IMAGE_DATA_URL_RE.test(src.trim());
}

export function isValidStorageImageUrl(src?: string | null): src is string {
  return typeof src === 'string' && VALID_HTTPS_IMAGE_URL_RE.test(src.trim());
}

export function isValidDisplayImageUrl(src?: string | null): src is string {
  if (typeof src !== 'string') return false;
  const trimmed = src.trim();
  return (
    VALID_IMAGE_DATA_URL_RE.test(trimmed) ||
    VALID_HTTPS_IMAGE_URL_RE.test(trimmed) ||
    VALID_BLOB_PREVIEW_URL_RE.test(trimmed)
  );
}

export function isSupportedImageFile(file: { type: string; size: number }): boolean {
  return ALLOWED_IMAGE_TYPES.has(file.type.toLowerCase()) && file.size > 0 && file.size <= MAX_UPLOAD_BYTES;
}

/**
 * Computes scaled width and height BEFORE creating a <canvas> so mobile browsers
 * never allocate full 12MP–48MP backing stores in memory.
 */
export function calculateScaledDimensions(
  origWidth: number,
  origHeight: number,
  maxBound = MAX_CANVAS_BOUND
): { width: number; height: number } {
  const safeW = Math.max(1, Math.round(origWidth));
  const safeH = Math.max(1, Math.round(origHeight));
  const clampedBound = Math.max(1, Math.min(Math.round(maxBound), MAX_CANVAS_BOUND));

  if (safeW <= clampedBound && safeH <= clampedBound) {
    return { width: safeW, height: safeH };
  }
  const scale = clampedBound / Math.max(safeW, safeH);
  return {
    width: Math.max(1, Math.round(safeW * scale)),
    height: Math.max(1, Math.round(safeH * scale)),
  };
}

interface DecodedImageHandle {
  source: CanvasImageSource;
  width: number;
  height: number;
  release: () => void;
}

function yieldToMainThread(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

async function decodeImageOnce(file: File): Promise<DecodedImageHandle> {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file);
    return {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      release: () => bitmap.close(),
    };
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Could not decode image file.'));
      el.src = objectUrl;
    });
    return {
      source: img,
      width: img.naturalWidth || img.width,
      height: img.naturalHeight || img.height,
      release: () => URL.revokeObjectURL(objectUrl),
    };
  } catch (err) {
    URL.revokeObjectURL(objectUrl);
    throw err;
  }
}

async function renderCanvasToJpegBlob(
  source: CanvasImageSource,
  targetWidth: number,
  targetHeight: number,
  quality: number
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  try {
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not initialize image compressor on this browser.');
    }
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, targetWidth, targetHeight);
    ctx.drawImage(source, 0, 0, targetWidth, targetHeight);

    return await new Promise<Blob>((resolve, reject) => {
      if (typeof canvas.toBlob === 'function') {
        canvas.toBlob(
          (blob) => {
            if (blob && blob.size > 0) {
              resolve(blob);
              return;
            }
            reject(new Error('Could not encode image to JPEG.'));
          },
          'image/jpeg',
          quality
        );
        return;
      }
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      const base64 = dataUrl.split(',')[1] || '';
      if (!base64) {
        reject(new Error('Could not encode image to JPEG.'));
        return;
      }
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
      }
      resolve(new Blob([bytes], { type: 'image/jpeg' }));
    });
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}

export async function compressImageFile(
  file: File,
  maxWidth = MAX_CANVAS_BOUND,
  initialQuality = 0.72,
  onProgress?: (percent: number) => void
): Promise<CompressionResult> {
  if (!isSupportedImageFile(file)) {
    throw new Error('Choose a JPEG, PNG, or WebP photo under 5MB.');
  }

  onProgress?.(10);
  const originalSizeKb = Math.round(file.size / 1024);
  const decoded = await decodeImageOnce(file);

  try {
    if (decoded.width <= 0 || decoded.height <= 0) {
      throw new Error('Selected image appears empty or corrupted. Choose a different photo.');
    }
    onProgress?.(30);
    await yieldToMainThread();

    const boundedMax = Math.min(maxWidth, MAX_CANVAS_BOUND);
    const fullAttempts = [
      { maxDim: boundedMax, quality: initialQuality },
      { maxDim: Math.min(boundedMax, 800), quality: 0.6 },
      { maxDim: Math.min(boundedMax, 600), quality: 0.46 },
    ];

    let fullBlob: Blob | null = null;
    for (const attempt of fullAttempts) {
      const { width, height } = calculateScaledDimensions(decoded.width, decoded.height, attempt.maxDim);
      const candidate = await renderCanvasToJpegBlob(decoded.source, width, height, attempt.quality);
      fullBlob = candidate;
      if (candidate.size <= MAX_STORAGE_PHOTO_BYTES) {
        break;
      }
      await yieldToMainThread();
    }

    if (!fullBlob || fullBlob.size === 0 || fullBlob.size > MAX_STORAGE_PHOTO_BYTES * 2) {
      throw new Error('Photo could not be compressed under size limits. Try a smaller image.');
    }

    onProgress?.(65);
    await yieldToMainThread();

    const baseName = file.name.replace(/\.[^.]+$/, '') || 'photo';
    const compressedFile = new File([fullBlob], `${baseName}.jpg`, { type: 'image/jpeg' });

    const thumbAttempts = [
      { maxDim: 320, quality: 0.56 },
      { maxDim: 220, quality: 0.44 },
    ];
    let thumbBlob: Blob | null = null;
    for (const attempt of thumbAttempts) {
      const { width, height } = calculateScaledDimensions(decoded.width, decoded.height, attempt.maxDim);
      const candidate = await renderCanvasToJpegBlob(decoded.source, width, height, attempt.quality);
      thumbBlob = candidate;
      if (candidate.size <= MAX_STORAGE_THUMB_BYTES) {
        break;
      }
      await yieldToMainThread();
    }

    if (!thumbBlob || thumbBlob.size === 0) {
      throw new Error('Could not generate a compact feed thumbnail. Try a simpler image.');
    }

    const thumbFile = new File([thumbBlob], `${baseName}-thumb.jpg`, { type: 'image/jpeg' });
    const previewUrl = URL.createObjectURL(compressedFile);
    onProgress?.(100);

    const compressedSizeKb = Math.max(1, Math.round(compressedFile.size / 1024));
    const reductionPercentage =
      originalSizeKb > 0
        ? Math.max(0, Math.round(((originalSizeKb - compressedSizeKb) / originalSizeKb) * 100))
        : 0;

    return {
      file: compressedFile,
      thumbFile,
      previewUrl,
      originalSizeKb,
      compressedSizeKb,
      thumbSizeBytes: thumbFile.size,
      reductionPercentage,
    };
  } finally {
    decoded.release();
  }
}
