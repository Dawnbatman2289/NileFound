import React, { memo, useState } from 'react';
import { MapPin, Calendar, Lock, MessageSquare } from 'lucide-react';
import { CampusItem, ClaimRecord, User } from '../types/index.ts';
import { formatDateDDMMYYYY } from '../utils/dateFormatter.ts';
import { reportError } from './ErrorBoundary.tsx';
import {
  getClaimButtonState,
  ItemCardMedia,
  ApprovedHandoverBanner,
  FinderApprovedHandoverBanner,
  FinderClaimReviewCard,
  ItemCardAction,
} from './ItemCardSections.tsx';

interface ItemCardProps {
  item: CampusItem;
  lowDataMode: boolean;
  currentUser?: User | null;
  isDemoMode?: boolean;
  myApprovedClaim?: ClaimRecord;
  myPendingClaim?: ClaimRecord;
  myRejectedClaim?: ClaimRecord;
  approvedFinderClaim?: ClaimRecord;
  pendingFinderClaims: ClaimRecord[];
  unreadChatClaimIds?: Set<string>;
  handoverInfo?: { authorName?: string; authorEmail?: string } | null;
  handoverError?: string;
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
  onOpenClaimChat?: (claim: ClaimRecord, item: CampusItem) => void;
}

const holdingLocationLabel = (loc: CampusItem['holdingLocation'], isFoundIdCard: boolean): string => {
  if (isFoundIdCard || loc === 'security_main_gate') return 'Main Gate Security Post';
  if (loc === 'library_desk') return 'Library Front Desk';
  if (loc === 'student_affairs_office') return 'Student Affairs Office';
  if (loc === 'faculty_officer') return 'Faculty Officer';
  return 'With Finder';
};

export const ItemCard: React.FC<ItemCardProps> = memo(({
  item, lowDataMode, currentUser, isDemoMode, myApprovedClaim, myPendingClaim, myRejectedClaim, approvedFinderClaim,
  pendingFinderClaims, unreadChatClaimIds, handoverInfo, handoverError, isLoadingHandover, onSelectDetail, onClaimItem,
  onOpenReportModal, onFoundMatch, onRequestHandoverContact, onFetchClaimPrivateDetails,
  onApproveClaim, onRejectClaim, onUpdateItemStatus, onOpenClaimChat,
}) => {
  const [loadingClaimId, setLoadingClaimId] = useState<string | null>(null);
  const [cardActionError, setCardActionError] = useState<string | null>(null);

  const isFound = item.type === 'found';
  const isReturned = item.status === 'returned';
  const isFoundIdCard = isFound && item.category === 'student_id';
  const displayTitle = isFoundIdCard ? 'A student ID card was found' : item.title;
  const previewPhoto = isFoundIdCard ? undefined : (item.thumbUrl || item.imageUrl);
  const claimState = getClaimButtonState(item, currentUser?.id, myPendingClaim, myApprovedClaim, myRejectedClaim);

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
    <article
      id={`item-${item.id}`}
      className={`notice-card flex flex-col justify-between overflow-hidden hover:-translate-y-0.5 ${isReturned ? 'opacity-70' : ''}`}
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
            <div className="bg-[#FAF6EF] dark:bg-[#141311] border border-[#C4BBAF] dark:border-[#3E3931] rounded-[10px] px-3 py-2 text-sm flex items-center justify-between gap-2 text-[#4A443C] dark:text-[#CEC7BB]">
              <span className="text-[#5C554C] dark:text-[#A8A095]">Held at:</span>
              <span className="font-medium text-[#1F1B16] dark:text-[#F5F1EA] text-right">
                {holdingLocationLabel(item.holdingLocation, isFoundIdCard)}
                {item.holdingLocation !== 'finder_holding' && item.custodyStatus === 'awaiting_dropoff' && (
                  <span className="block text-xs font-semibold text-[#7A5000] dark:text-[#F9CF7C]">Awaiting Desk Drop-off</span>
                )}
              </span>
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
            handoverError={handoverError}
            isLoadingHandover={isLoadingHandover}
            hasUnreadChat={unreadChatClaimIds?.has(myApprovedClaim.id)}
            onRequestHandoverContact={onRequestHandoverContact}
            onOpenChat={onOpenClaimChat ? () => onOpenClaimChat(myApprovedClaim, item) : undefined}
          />
        )}

        {approvedFinderClaim && (
          <FinderApprovedHandoverBanner
            item={item}
            claim={approvedFinderClaim}
            isDemoMode={isDemoMode}
            hasUnreadChat={unreadChatClaimIds?.has(approvedFinderClaim.id)}
            onOpenChat={onOpenClaimChat ? () => onOpenClaimChat(approvedFinderClaim, item) : undefined}
            onMarkReturned={
              onUpdateItemStatus
                ? async () => {
                    setCardActionError(null);
                    const ok = await onUpdateItemStatus(item.id, 'returned');
                    if (ok === false) setCardActionError('Could not confirm handover. Try again.');
                  }
                : undefined
            }
          />
        )}

        {myPendingClaim && onOpenClaimChat && item.status !== 'returned' && item.status !== 'expired' && (
          <button
            type="button"
            onClick={() => onOpenClaimChat(myPendingClaim, item)}
            className="w-full min-h-[44px] bg-white dark:bg-[#1E1C18] hover:bg-[#FAF6EF] dark:hover:bg-[#28241F] text-[#0F6E6E] dark:text-[#199595] border border-[#0F6E6E]/40 rounded-[10px] font-semibold text-sm inline-flex items-center justify-center gap-1.5 cursor-pointer btn-campus"
          >
            <MessageSquare className="w-4 h-4" />
            <span>Message Finder / Desk</span>
            {unreadChatClaimIds?.has(myPendingClaim.id) && (
              <span className="bg-[#E8A317] text-[#1F1B16] text-xs font-bold px-2 py-0.5 rounded-full">
                New
              </span>
            )}
          </button>
        )}

        {pendingFinderClaims.map((fc) => (
          <FinderClaimReviewCard
            key={fc.id}
            claim={fc}
            itemId={item.id}
            isDemoMode={isDemoMode}
            hasUnreadChat={unreadChatClaimIds?.has(fc.id)}
            loadingClaimId={loadingClaimId}
            onLoadPrivate={handleLoadClaimPrivate}
            onApproveClaim={onApproveClaim}
            onRejectClaim={onRejectClaim}
            onOpenChat={onOpenClaimChat ? (claimRecord) => onOpenClaimChat(claimRecord, item) : undefined}
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
    </article>
  );
});

ItemCard.displayName = 'ItemCard';
