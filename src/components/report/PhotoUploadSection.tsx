import React from 'react';
import { CheckCircle, Lock, Upload } from 'lucide-react';
import type { CompressionResult } from '../../utils/imageCompressor.ts';

interface PhotoUploadSectionProps {
  isFoundStudentId: boolean;
  isCompressing: boolean;
  compressionResult: CompressionResult | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onImageChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveImage: () => void;
}

export const PhotoUploadSection: React.FC<PhotoUploadSectionProps> = ({
  isFoundStudentId,
  isCompressing,
  compressionResult,
  fileInputRef,
  onImageChange,
  onRemoveImage,
}) => {
  if (isFoundStudentId) {
    return (
      <div className="border border-[#C4BBAF] dark:border-[#3E3931] bg-[#FAF6EF] dark:bg-[#141311] rounded-[10px] p-4 text-center text-sm text-[#4A443C] dark:text-[#CEC7BB]">
        <Lock className="w-5 h-5 text-[#5C554C] dark:text-[#A8A095] mx-auto mb-1.5" />
        <p className="font-medium text-[#1F1B16] dark:text-[#F5F1EA]">Photos of student ID cards are prohibited.</p>
        <p className="text-sm text-[#5C554C] dark:text-[#A8A095] mt-0.5">
          Hand the physical ID card to the Main Gate Security Post.
        </p>
      </div>
    );
  }

  return (
    <div className="border border-dashed border-[#857C70] dark:border-[#787065] hover:border-[#0F6E6E] rounded-[10px] p-4 text-center bg-[#FAF6EF]/40 dark:bg-[#141311]/40 transition-colors">
      <label htmlFor="report-photo-upload" className="cursor-pointer block">
        <input
          ref={fileInputRef}
          id="report-photo-upload"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/*"
          onChange={onImageChange}
          className="sr-only"
        />
        <div className="flex flex-col items-center gap-1.5">
          <Upload className="w-6 h-6 text-[#0F6E6E] dark:text-[#199595]" />
          <span className="text-sm font-medium text-[#1F1B16] dark:text-[#F5F1EA]">
            {compressionResult ? 'Change Photo' : 'Attach Photo (Optional)'}
          </span>
          <span className="text-sm text-[#5C554C] dark:text-[#A8A095]">
            Compressed on your device under 90KB to save mobile data
          </span>
        </div>
      </label>

      {isCompressing && (
        <p className="text-sm text-[#0F6E6E] dark:text-[#199595] font-medium mt-2">
          Compressing photo in device memory...
        </p>
      )}

      {compressionResult && (
        <div className="mt-3 flex items-center justify-between gap-2 bg-white dark:bg-[#1E1C18] border border-[#C4BBAF] dark:border-[#3E3931] rounded-[10px] p-3 text-sm text-[#1F1B16] dark:text-[#F5F1EA] text-left">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src={compressionResult.dataUrl}
              alt="Uploaded item preview"
              className="w-12 h-12 object-cover rounded-[10px] border border-[#C4BBAF] dark:border-[#3E3931] shrink-0"
              loading="lazy"
              decoding="async"
              width={48}
              height={48}
            />
            <div className="min-w-0">
              <span className="font-semibold block text-sm">
                Compressed: {compressionResult.compressedSizeKb} KB
              </span>
              <span className="text-sm text-[#5C554C] dark:text-[#A8A095]">
                Reduced from {compressionResult.originalSizeKb} KB (-{compressionResult.reductionPercentage}%)
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <CheckCircle className="w-5 h-5 text-[#2F7D4F] shrink-0" />
            <button
              type="button"
              onClick={onRemoveImage}
              className="text-xs font-medium text-[#9B1C1C] dark:text-[#F87171] hover:underline min-h-[44px] px-2 cursor-pointer"
            >
              Remove
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
