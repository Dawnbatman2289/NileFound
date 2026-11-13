/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Client-side image compression utility for NileFound.
 * Resizes and compresses item photos on-device before Firestore storage.
 */

import imageCompression from 'browser-image-compression';

export interface CompressionResult {
  file: File;
  dataUrl: string;
  originalSizeKb: number;
  compressedSizeKb: number;
  reductionPercentage: number;
}

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_FIRESTORE_DATA_URL_CHARS = 135000;

export function isSupportedImageFile(file: { type: string; size: number }): boolean {
  return ALLOWED_IMAGE_TYPES.has(file.type) && file.size > 0 && file.size <= MAX_UPLOAD_BYTES;
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
    throw new Error('Photo is still too large after compression. Try a smaller image.');
  }

  const compressedSizeKb = Math.max(1, Math.round(compressedFile.size / 1024));
  const reductionPercentage =
    originalSizeKb > 0
      ? Math.max(0, Math.round(((originalSizeKb - compressedSizeKb) / originalSizeKb) * 100))
      : 0;

  return {
    file: compressedFile,
    dataUrl,
    originalSizeKb,
    compressedSizeKb,
    reductionPercentage,
  };
}
