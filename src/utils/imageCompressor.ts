/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Client-side image compression utility for NileFound.
 * Generates both a <= 3 KB inline thumbnail and a compressed full photo on-device.
 */

import imageCompression from 'browser-image-compression';

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
export const MAX_FIRESTORE_DATA_URL_CHARS = 135000;
export const MAX_THUMB_DATA_URL_CHARS = 4096;

export function isSupportedImageFile(file: { type: string; size: number }): boolean {
  return ALLOWED_IMAGE_TYPES.has(file.type.toLowerCase()) && file.size > 0 && file.size <= MAX_UPLOAD_BYTES;
}

function readFileAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('Could not read compressed image.'));
    };
    reader.onerror = () => reject(new Error('Could not read compressed image.'));
    reader.readAsDataURL(file);
  });
}

async function createInlineThumbnailDataUrl(sourceFile: File): Promise<string> {
  const attempts = [
    { maxSizeMB: 0.0028, maxWidthOrHeight: 200, initialQuality: 0.52 },
    { maxSizeMB: 0.0022, maxWidthOrHeight: 144, initialQuality: 0.4 },
    { maxSizeMB: 0.0018, maxWidthOrHeight: 112, initialQuality: 0.32 },
  ];

  let thumbDataUrl = '';
  for (const opts of attempts) {
    const thumbFile = await imageCompression(sourceFile, {
      ...opts,
      useWebWorker: false,
      fileType: 'image/jpeg',
    });
    thumbDataUrl = await readFileAsDataUrl(thumbFile);
    if (thumbDataUrl.length <= MAX_THUMB_DATA_URL_CHARS) {
      return thumbDataUrl;
    }
  }

  throw new Error('Could not generate a compact feed thumbnail under 3 KB. Try a simpler image.');
}

export async function compressImageFile(
  file: File,
  maxWidth = 800,
  initialQuality = 0.72,
): Promise<CompressionResult> {
  if (!isSupportedImageFile(file)) {
    throw new Error('Choose a JPEG, PNG, or WebP photo under 5MB.');
  }

  const originalSizeKb = Math.round(file.size / 1024);

  // Target <= 85KB binary so Base64 dataUrl stays comfortably below Firestore's 140,000 char cap
  let compressedFile = await imageCompression(file, {
    maxSizeMB: 0.085,
    maxWidthOrHeight: maxWidth,
    useWebWorker: false,
    initialQuality,
    fileType: 'image/jpeg',
  });

  let dataUrl = await readFileAsDataUrl(compressedFile);

  if (dataUrl.length > MAX_FIRESTORE_DATA_URL_CHARS) {
    compressedFile = await imageCompression(file, {
      maxSizeMB: 0.06,
      maxWidthOrHeight: 600,
      useWebWorker: false,
      initialQuality: 0.55,
      fileType: 'image/jpeg',
    });
    dataUrl = await readFileAsDataUrl(compressedFile);
  }

  if (dataUrl.length > MAX_FIRESTORE_DATA_URL_CHARS) {
    compressedFile = await imageCompression(file, {
      maxSizeMB: 0.045,
      maxWidthOrHeight: 420,
      useWebWorker: false,
      initialQuality: 0.45,
      fileType: 'image/jpeg',
    });
    dataUrl = await readFileAsDataUrl(compressedFile);
  }

  if (dataUrl.length > MAX_FIRESTORE_DATA_URL_CHARS) {
    throw new Error('Photo is still too large after compression. Try a smaller image.');
  }

  const thumbSource = new File([compressedFile], 'thumb.jpg', { type: 'image/jpeg' });
  const thumbDataUrl = await createInlineThumbnailDataUrl(thumbSource);
  const thumbSizeBytes = thumbDataUrl.length;

  const compressedSizeKb = Math.max(1, Math.round(compressedFile.size / 1024));
  const reductionPercentage =
    originalSizeKb > 0
      ? Math.max(0, Math.round(((originalSizeKb - compressedSizeKb) / originalSizeKb) * 100))
      : 0;

  return {
    file: compressedFile,
    dataUrl,
    thumbDataUrl,
    originalSizeKb,
    compressedSizeKb,
    thumbSizeBytes,
    reductionPercentage,
  };
}
