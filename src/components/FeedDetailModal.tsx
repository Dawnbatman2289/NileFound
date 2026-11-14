import React from 'react';
import { X } from 'lucide-react';
import { CampusItem } from '../types/index.ts';
import { formatDateDDMMYYYY } from '../utils/dateFormatter.ts';

interface FeedDetailModalProps {
  detailItem: CampusItem;
  lowDataMode: boolean;
  detailPhotoUrl: string | null;
  isLoadingDetailPhoto: boolean;
  detailPhotoError: string | null;
  onClose: () => void;
}

export const FeedDetailModal: React.FC<FeedDetailModalProps> = ({
  detailItem,
  lowDataMode,
  detailPhotoUrl,
  isLoadingDetailPhoto,
  detailPhotoError,
  onClose,
}) => (
  <div className="fixed inset-0 z-50 bg-black/55 flex items-center justify-center p-3 sm:p-5 overflow-y-auto" onClick={onClose}>
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="feed-detail-title"
      onClick={(e) => e.stopPropagation()}
      className="w-full max-w-lg bg-white dark:bg-[#1E1C18] text-[#1F1B16] dark:text-[#F5F1EA] rounded-[12px] border border-[#C4BBAF] dark:border-[#3E3931] shadow-xl overflow-hidden flex flex-col max-h-[90dvh]"
    >
      <div className="bg-[#FAF6EF] dark:bg-[#141311] px-5 py-4 border-b border-[#C4BBAF] dark:border-[#3E3931] flex items-center justify-between gap-3">
        <h3 id="feed-detail-title" className="font-serif font-bold text-base truncate">
          {detailItem.type === 'found' && detailItem.category === 'student_id' ? 'A student ID card was found' : detailItem.title}
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-[#5C554C] dark:text-[#A8A095] hover:text-[#1F1B16] dark:hover:text-[#F5F1EA] cursor-pointer"
          aria-label="Close item details"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="p-5 space-y-4 overflow-y-auto text-sm">
        {detailItem.category === 'student_id' ? null : lowDataMode ? (
          <div className="bg-[#E7F3F3] dark:bg-[#0D2D2D] border border-[#0F6E6E]/25 text-[#0F6E6E] dark:text-[#199595] rounded-[10px] p-3 text-sm">
            Low-Data mode is enabled — full-resolution photos are skipped to save mobile data.
          </div>
        ) : isLoadingDetailPhoto ? (
          <div className="h-56 rounded-[10px] bg-[#FAF6EF] dark:bg-[#141311] border border-[#C4BBAF] dark:border-[#3E3931] flex items-center justify-center text-[#5C554C] dark:text-[#A8A095]">
            Loading full-resolution photo…
          </div>
        ) : detailPhotoUrl ? (
          <div className="rounded-[10px] overflow-hidden bg-[#FAF6EF] dark:bg-[#141311] border border-[#C4BBAF] dark:border-[#3E3931]">
            <img src={detailPhotoUrl} alt={detailItem.title} className="w-full max-h-96 object-contain mx-auto" />
          </div>
        ) : null}

        {detailPhotoError && (
          <p role="alert" className="text-xs text-[#9B1C1C] dark:text-[#F87171]">{detailPhotoError}</p>
        )}

        <p className="text-[#4A443C] dark:text-[#CEC7BB] leading-relaxed whitespace-pre-wrap">
          {detailItem.type === 'found' && detailItem.category === 'student_id'
            ? `Found in the vicinity of ${detailItem.location}. Handed to campus security for safekeeping.`
            : detailItem.description}
        </p>

        <div className="text-xs text-[#5C554C] dark:text-[#A8A095] space-y-1 pt-2 border-t border-[#C4BBAF] dark:border-[#3E3931]">
          <p>Location: {detailItem.location}{detailItem.locationDetails ? ` - ${detailItem.locationDetails}` : ''}</p>
          <p>Date: {formatDateDDMMYYYY(detailItem.dateLostOrFound)}</p>
        </div>
      </div>
    </div>
  </div>
);
