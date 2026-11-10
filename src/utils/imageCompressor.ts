/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * NileFound Client-Side Image Compressor
 * 
 * Why client-side compression?
 * In Nigerian universities, mobile data is expensive and 3G/4G connections can drop.
 * A 4MB smartphone camera shot will fail to upload or drain the student's data.
 * This compresses images down to < 100KB directly in the browser's RAM before
 * sending a single byte over the mobile network.
 */

export interface CompressionResult {
  dataUrl: string;
  originalSizeKb: number;
  compressedSizeKb: number;
  reductionPercentage: number;
}

export function isSupportedImageFile(file: Pick<File, 'type' | 'size'>, maxBytes = 5 * 1024 * 1024): boolean {
  return /^(image\/jpeg|image\/png|image\/webp)$/.test(file.type) && file.size > 0 && file.size <= maxBytes;
}

export function compressImageFile(
  file: File,
  maxDimension = 800,
  quality = 0.7,
): Promise<CompressionResult> {
  const originalSizeKb = Math.round(file.size / 1024);
  return imageCompression(file, {
    maxSizeMB: 0.09,
    maxWidthOrHeight: maxDimension,
    initialQuality: quality,
    fileType: 'image/jpeg',
    useWebWorker: true,
  }).then((compressedFile) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read compressed image'));
    reader.onload = () => {
      const dataUrl = String(reader.result);
      const compressedSizeKb = Math.round(compressedFile.size / 1024);
      resolve({
        dataUrl,
        originalSizeKb,
        compressedSizeKb,
        reductionPercentage: originalSizeKb > 0
          ? Math.max(0, Math.round(((originalSizeKb - compressedSizeKb) / originalSizeKb) * 100))
          : 0,
      });
    };
    reader.readAsDataURL(compressedFile);
  }));
}
import imageCompression from 'browser-image-compression';
