import React, { memo, useState } from 'react';
import { motion } from 'motion/react';
import { MapPin, Calendar, Lock } from 'lucide-react';
import { CampusItem, ClaimRecord, User } from '../types/index.ts';
import { formatDateDDMMYYYY } from '../utils/dateFormatter.ts';
import { reportError } from './ErrorBoundary.tsx';
import {
  getClaimButtonState,
  ItemCardMedia,
  ApprovedHandoverBanner,
  FinderClaimReviewCard,
  ItemCardAction,
} from './ItemCardSections.tsx';

interface ItemCardProps {
  item: CampusItem;
  index: number;
  lowDataMode: boolean;
  currentUser?: User | null;
  isDemoMode?: boolean;
  myApprovedClaim?: ClaimRecord;
  myPendingClaim?: ClaimRecord;
  pendingFinderClaims: ClaimRecord[];
  handoverInfo?: { authorName?: string; authorEmail?: string } | null;
  isLoadingHandover: boolean;
  onSelectDetail: (item: CampusItem) => void;
  onClaimItem: (item: CampusItem) => void;
  onOpenReportModal: () => void;
  onFoundMatch?: (lostItem: CampusItem) => void;
  onRequestHandoverContact?: (itemId: string) => void;
  onFetchClaimPrivateDetails?: (itemId: string, claimId: string) => Promise<void>;
  onApproveClaim?: (claimId: string, itemId: string) => Promise<boolean> | void;
  onRejectClaim?: (claimId: string) => Promise<boolean> | void;
  onUpdateItemStatus?: (itemId: string, status: CampusItem['status']) => Promise<boolean> | void;
}

const holdingLocationLabel = (loc: CampusItem['holdingLocation'], isFoundIdCard: boolean): string => {
  if (isFoundIdCard || loc === 'security_main_gate') return 'Main Gate Security Post';
  if (loc === 'library_desk') return 'Library Front Desk';
  if (loc === 'student_affairs_office') return 'Student Affairs Office';
  if (loc === 'faculty_officer') return 'Faculty Officer';
  return 'With Finder';
};

export const ItemCard: React.FC<ItemCardProps> = memo(({
  item, index, lowDataMode, currentUser, isDemoMode, myApprovedClaim, myPendingClaim,
  pendingFinderClaims, handoverInfo, isLoadingHandover, onSelectDetail, onClaimItem,
  onOpenReportModal, onFoundMatch, onRequestHandoverContact, onFetchClaimPrivateDetails,
  onApproveClaim, onRejectClaim, onUpdateItemStatus,
}) => {
  const [loadingClaimId, setLoadingClaimId] = useState<string | null>(null);
  const [cardActionError, setCardActionError] = useState<string | null>(null);

  const isFound = item.type === 'found';
  const isReturned = item.status === 'returned';
  const isFoundIdCard = isFound && item.category === 'student_id';
  const displayTitle = isFoundIdCard ? 'A student ID card was found' : item.title;
  const previewPhoto = isFoundIdCard ? undefined : (item.thumbUrl || item.imageUrl);
  const claimState = getClaimButtonState(item, currentUser?.id, myPendingClaim, myApprovedClaim);

  const handleLoadClaimPrivate = async (claimId: string) => {
    if (!onFetchClaimPrivateDetails) return;
    setLoadingClaimId(claimId);
    setCardActionError(null);
    try {
      await onFetchClaimPrivateDetails(item.id, claimId);
    } catch (err) {
      reportError('Load claim private details failed', err);
      setCardActionError('Could not load claim verification answer.');
    } finally {
      setLoadingClaimId(null);
    }
  };

  return (
    <motion.article
      id={`item-${item.id}`}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.995 }}
      transition={{ duration: 0.18, delay: Math.min(index * 0.03, 0.24) }}
      className={`notice-card flex flex-col justify-between overflow-hidden ${isReturned ? 'opacity-70' : ''}`}
    >
      <div>
        <ItemCardMedia
          item={item}
          isFound={isFound}
          isFoundIdCard={isFoundIdCard}
          displayTitle={displayTitle}
          previewPhoto={previewPhoto}
          lowDataMode={lowDataMode}
          onSelectDetail={onSelectDetail}
        />

        <div className="p-4 space-y-3">
          <div>
            <h3 className="font-serif font-bold text-base text-[#1F1B16] dark:text-[#F5F1EA] leading-snug">{displayTitle}</h3>
            <p className="text-sm text-[#4A443C] dark:text-[#CEC7BB] line-clamp-2 mt-1 leading-relaxed">
              {isFoundIdCard ? `Found in the vicinity of ${item.location}. Handed to campus security for safekeeping.` : item.description}
            </p>
          </div>

          <div className="space-y-1.5 text-sm text-[#5C554C] dark:text-[#A8A095] pt-2 border-t border-[#C4BBAF] dark:border-[#3E3931]">
            <div className="flex items-center gap-1.5 text-[#4A443C] dark:text-[#CEC7BB]">
              <MapPin className="w-4 h-4 text-[#0F6E6E] dark:text-[#199595] shrink-0" />
              <span className="font-medium truncate">{item.location}{item.locationDetails ? ` - ${item.locationDetails}` : ''}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4 shrink-0" />
              <span>{isFound ? 'Found' : 'Reported'}: {formatDateDDMMYYYY(item.dateLostOrFound)}</span>
            </div>
          </div>

          {isFound && (
            <div className="bg-[#FAF6EF] dark:bg-[#141311] border border-[#C4BBAF] dark:border-[#3E3931] rounded-[10px] px-3 py-2 text-sm flex items-center justify-between text-[#4A443C] dark:text-[#CEC7BB]">
              <span className="text-[#5C554C] dark:text-[#A8A095]">Held at:</span>
              <span className="font-medium text-[#1F1B16] dark:text-[#F5F1EA]">{holdingLocationLabel(item.holdingLocation, isFoundIdCard)}</span>
            </div>
          )}

          {isFound && item.verificationQuestion && (
            <div className="text-xs text-[#0F6E6E] dark:text-[#199595] bg-[#E7F3F3] dark:bg-[#0D2D2D] border border-[#0F6E6E]/25 px-2.5 py-1.5 rounded-[10px] flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 shrink-0" />
              <span>Ownership verification required to claim</span>
            </div>
          )}
        </div>
      </div>

      <div className="p-3.5 bg-[#FAF6EF]/50 dark:bg-[#141311]/50 border-t border-[#C4BBAF] dark:border-[#3E3931] space-y-2.5">
        {myApprovedClaim && (
          <ApprovedHandoverBanner
            item={item}
            handoverInfo={handoverInfo}
            isLoadingHandover={isLoadingHandover}
            onRequestHandoverContact={onRequestHandoverContact}
          />
        )}

        {pendingFinderClaims.map((fc) => (
          <FinderClaimReviewCard
            key={fc.id}
            claim={fc}
            itemId={item.id}
            isDemoMode={isDemoMode}
            loadingClaimId={loadingClaimId}
            onLoadPrivate={handleLoadClaimPrivate}
            onApproveClaim={onApproveClaim}
            onRejectClaim={onRejectClaim}
            onActionError={setCardActionError}
          />
        ))}

        {cardActionError && item.authorId === currentUser?.id && (
          <p role="alert" className="text-xs text-[#9B1C1C] dark:text-[#F87171]">{cardActionError}</p>
        )}

        <ItemCardAction
          item={item}
          isFound={isFound}
          isReturned={isReturned}
          isAuthor={Boolean(currentUser && item.authorId === currentUser.id)}
          claimState={claimState}
          onClaimItem={onClaimItem}
          onUpdateItemStatus={onUpdateItemStatus}
          onFoundMatch={onFoundMatch}
          onOpenReportModal={onOpenReportModal}
        />
      </div>
    </motion.article>
  );
});

ItemCard.displayName = 'ItemCard';
