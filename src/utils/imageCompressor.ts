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
  quality = 0.7
): Promise<CompressionResult> {
  return new Promise((resolve, reject) => {
    const originalSizeKb = Math.round(file.size / 1024);

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.onload = (event) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to load image element'));
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Resize down proportionally if larger than maxDimension
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas 2D context not available'));
          return;
        }

        // Clean background for PNG transparency conversion
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to WebP or JPEG at designated quality
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        
        // Estimate base64 payload size in KB: (length * 3/4) / 1024
        const compressedSizeKb = Math.round((dataUrl.length * 3) / 4 / 1024);
        const reduction = originalSizeKb > 0
          ? Math.max(0, Math.round(((originalSizeKb - compressedSizeKb) / originalSizeKb) * 100))
          : 0;

        resolve({
          dataUrl,
          originalSizeKb,
          compressedSizeKb,
          reductionPercentage: reduction
        });
      };

      img.src = event.target?.result as string;
    };

    reader.readAsDataURL(file);
  });
}
