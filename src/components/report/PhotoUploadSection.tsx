import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle, Lock, Upload } from 'lucide-react';
import { isValidImageDataUrl, type CompressionResult } from '../../utils/imageCompressor.ts';

interface PhotoUploadSectionProps {
  isFoundStudentId: boolean;
  isCompressing: boolean;
  compressionProgress?: number;
  compressionResult: CompressionResult | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onImageChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveImage: () => void;
  onPickerOpen?: () => void;
  onPickerCancel?: () => void;
  onInvalidPreview?: (message: string) => void;
}

export const PhotoUploadSection: React.FC<PhotoUploadSectionProps> = ({
  isFoundStudentId,
  isCompressing,
  compressionProgress = 0,
  compressionResult,
  fileInputRef,
  onImageChange,
  onRemoveImage,
  onPickerOpen,
  onPickerCancel,
  onInvalidPreview,
}) => {
  const [previewFailed, setPreviewFailed] = useState(false);
  const triggerButtonRef = useRef<HTMLButtonElement>(null);
  const pickerPendingRef = useRef(false);
  const cancelTimerRef = useRef<number | null>(null);
  const onPickerCancelRef = useRef(onPickerCancel);

  useEffect(() => {
    onPickerCancelRef.current = onPickerCancel;
  }, [onPickerCancel]);

  useEffect(() => {
    setPreviewFailed(false);
  }, [compressionResult?.dataUrl]);

  useEffect(() => {
    const input = fileInputRef.current;
    if (!input) return;

    const handleNativeCancel = () => {
      if (!pickerPendingRef.current) return;
      pickerPendingRef.current = false;
      if (cancelTimerRef.current) {
        window.clearTimeout(cancelTimerRef.current);
        cancelTimerRef.current = null;
      }
      onPickerCancelRef.current?.();
    };

    const handleWindowFocusReturn = () => {
      if (!pickerPendingRef.current) return;
      if (cancelTimerRef.current) window.clearTimeout(cancelTimerRef.current);
      cancelTimerRef.current = window.setTimeout(() => {
        if (!pickerPendingRef.current) return;
        const hasChosenFile = Boolean(fileInputRef.current?.files?.length);
        pickerPendingRef.current = false;
        if (!hasChosenFile) {
          onPickerCancelRef.current?.();
        }
      }, 280);
    };

    input.addEventListener('cancel', handleNativeCancel);
    window.addEventListener('focus', handleWindowFocusReturn);
    return () => {
      input.removeEventListener('cancel', handleNativeCancel);
      window.removeEventListener('focus', handleWindowFocusReturn);
      if (cancelTimerRef.current) window.clearTimeout(cancelTimerRef.current);
    };
  }, [fileInputRef, isFoundStudentId]);

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

  const validPreviewUrl =
    compressionResult && isValidImageDataUrl(compressionResult.dataUrl) && !previewFailed
      ? compressionResult.dataUrl
      : null;

  const handleOpenPicker = () => {
    if (isCompressing) return;
    pickerPendingRef.current = true;
    onPickerOpen?.();
    fileInputRef.current?.click();
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    pickerPendingRef.current = false;
    if (cancelTimerRef.current) {
      window.clearTimeout(cancelTimerRef.current);
      cancelTimerRef.current = null;
    }
    if (!e.target.files || e.target.files.length === 0) {
      e.target.value = '';
      onPickerCancelRef.current?.();
      return;
    }
    onImageChange(e);
  };

  return (
    <div className="border border-dashed border-[#857C70] dark:border-[#787065] hover:border-[#0F6E6E] rounded-[10px] p-4 text-center bg-[#FAF6EF]/40 dark:bg-[#141311]/40 transition-colors">
      <input
        ref={fileInputRef}
        id="report-photo-upload"
        type="file"
        accept="image/jpeg,image/png,image/webp,image/*"
        onChange={handleFileInputChange}
        tabIndex={-1}
        aria-hidden="true"
        className="hidden"
      />
      <button
        ref={triggerButtonRef}
        type="button"
        onClick={handleOpenPicker}
        disabled={isCompressing}
        className="w-full min-h-[44px] py-1 px-2 rounded-[8px] flex flex-col items-center gap-1.5 cursor-pointer disabled:opacity-60"
      >
        <Upload className="w-6 h-6 text-[#0F6E6E] dark:text-[#199595]" />
        <span className="text-sm font-medium text-[#1F1B16] dark:text-[#F5F1EA]">
          {validPreviewUrl ? 'Change Photo' : 'Attach Photo (Optional)'}
        </span>
        <span className="text-sm text-[#5C554C] dark:text-[#A8A095]">
          Compressed on your device under 90KB to save mobile data
        </span>
      </button>

      {isCompressing && (
        <p role="status" className="text-sm text-[#0F6E6E] dark:text-[#199595] font-medium mt-2">
          Compressing photo in device memory{compressionProgress > 0 ? ` (${compressionProgress}%)` : ''}...
        </p>
      )}

      {validPreviewUrl && compressionResult && (
        <div className="mt-3 flex items-center justify-between gap-2 bg-white dark:bg-[#1E1C18] border border-[#C4BBAF] dark:border-[#3E3931] rounded-[10px] p-3 text-sm text-[#1F1B16] dark:text-[#F5F1EA] text-left">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src={validPreviewUrl}
              alt="Uploaded item preview"
              className="w-12 h-12 object-cover rounded-[10px] border border-[#C4BBAF] dark:border-[#3E3931] bg-[#FAF6EF] dark:bg-[#141311] shrink-0"
              loading="lazy"
              decoding="async"
              width={48}
              height={48}
              onLoad={(e) => {
                if (e.currentTarget.naturalWidth === 0) {
                  setPreviewFailed(true);
                  onRemoveImage();
                  onInvalidPreview?.('Selected image could not be displayed. Choose a different photo.');
                }
              }}
              onError={() => {
                setPreviewFailed(true);
                onRemoveImage();
                onInvalidPreview?.('Selected image could not be displayed. Choose a different photo.');
              }}
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
              onClick={() => {
                onRemoveImage();
                triggerButtonRef.current?.focus();
              }}
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
