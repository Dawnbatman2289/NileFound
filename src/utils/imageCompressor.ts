/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Client-side single-decode Canvas image compression utility for NileFound.
 * Bounds target dimensions (<= 1280px) before allocating canvas memory and
 * generates both a <= 3 KB inline feed thumbnail and compressed full photo on-device.
 */

export interface CompressionResult {
  file: File;
  dataUrl: string;
  thumbDataUrl: string;
  originalSizeKb: number;
  compressedSizeKb: number;
  thumbSizeBytes: number;
  reductionPercentage: number;
}

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const MAX_CANVAS_BOUND = 1280;
export const MAX_FIRESTORE_DATA_URL_CHARS = 135000;
export const MAX_THUMB_DATA_URL_CHARS = 4096;

const VALID_IMAGE_DATA_URL_RE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]{16,}$/;

export function isValidImageDataUrl(src?: string | null): src is string {
  return typeof src === 'string' && VALID_IMAGE_DATA_URL_RE.test(src.trim());
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

function renderCanvasToJpeg(
  source: CanvasImageSource,
  targetWidth: number,
  targetHeight: number,
  quality: number
): { canvas: HTMLCanvasElement; dataUrl: string } {
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not initialize image compressor on this browser.');
  }
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, targetWidth, targetHeight);
  ctx.drawImage(source, 0, 0, targetWidth, targetHeight);
  const dataUrl = canvas.toDataURL('image/jpeg', quality);
  return { canvas, dataUrl };
}

function canvasToFile(canvas: HTMLCanvasElement, dataUrl: string, fileName: string, quality: number): Promise<File> {
  return new Promise((resolve) => {
    if (typeof canvas.toBlob === 'function') {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(new File([blob], fileName, { type: 'image/jpeg' }));
            return;
          }
          resolve(dataUrlToFileFallback(dataUrl, fileName));
        },
        'image/jpeg',
        quality
      );
      return;
    }
    resolve(dataUrlToFileFallback(dataUrl, fileName));
  });
}

function dataUrlToFileFallback(dataUrl: string, fileName: string): File {
  const base64 = dataUrl.split(',')[1] || '';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new File([bytes], fileName, { type: 'image/jpeg' });
}

export async function compressImageFile(
  file: File,
  maxWidth = 800,
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
    onProgress?.(35);

    const boundedMax = Math.min(maxWidth, MAX_CANVAS_BOUND);
    const fullAttempts = [
      { maxDim: boundedMax, quality: initialQuality },
      { maxDim: Math.min(boundedMax, 640), quality: 0.56 },
      { maxDim: Math.min(boundedMax, 460), quality: 0.45 },
    ];

    let fullRender: { canvas: HTMLCanvasElement; dataUrl: string; quality: number } | null = null;
    for (const attempt of fullAttempts) {
      const { width, height } = calculateScaledDimensions(decoded.width, decoded.height, attempt.maxDim);
      const rendered = renderCanvasToJpeg(decoded.source, width, height, attempt.quality);
      if (!isValidImageDataUrl(rendered.dataUrl)) {
        continue;
      }
      fullRender = { ...rendered, quality: attempt.quality };
      if (rendered.dataUrl.length <= MAX_FIRESTORE_DATA_URL_CHARS) {
        break;
      }
    }

    if (!fullRender || !isValidImageDataUrl(fullRender.dataUrl) || fullRender.dataUrl.length > MAX_FIRESTORE_DATA_URL_CHARS) {
      throw new Error('Photo could not be processed under size limits. Try a smaller image.');
    }

    onProgress?.(65);
    const baseName = file.name.replace(/\.[^.]+$/, '') || 'photo';
    const compressedFile = await canvasToFile(
      fullRender.canvas,
      fullRender.dataUrl,
      `${baseName}.jpg`,
      fullRender.quality
    );

    const thumbAttempts = [
      { maxDim: 180, quality: 0.5 },
      { maxDim: 136, quality: 0.38 },
      { maxDim: 104, quality: 0.3 },
    ];
    let thumbDataUrl = '';
    for (const attempt of thumbAttempts) {
      const { width, height } = calculateScaledDimensions(decoded.width, decoded.height, attempt.maxDim);
      const { dataUrl: candidateThumb } = renderCanvasToJpeg(decoded.source, width, height, attempt.quality);
      if (!isValidImageDataUrl(candidateThumb)) {
        continue;
      }
      thumbDataUrl = candidateThumb;
      if (thumbDataUrl.length <= MAX_THUMB_DATA_URL_CHARS) {
        break;
      }
    }

    if (!isValidImageDataUrl(thumbDataUrl) || thumbDataUrl.length > MAX_THUMB_DATA_URL_CHARS) {
      throw new Error('Could not generate a compact feed thumbnail under 3 KB. Try a simpler image.');
    }

    onProgress?.(100);

    const compressedSizeKb = Math.max(1, Math.round(compressedFile.size / 1024));
    const reductionPercentage =
      originalSizeKb > 0
        ? Math.max(0, Math.round(((originalSizeKb - compressedSizeKb) / originalSizeKb) * 100))
        : 0;

    return {
      file: compressedFile,
      dataUrl: fullRender.dataUrl,
      thumbDataUrl,
      originalSizeKb,
      compressedSizeKb,
      thumbSizeBytes: thumbDataUrl.length,
      reductionPercentage,
    };
  } finally {
    decoded.release();
  }
}
