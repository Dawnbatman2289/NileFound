import React, { useEffect, useState } from 'react';
import { Shield, Mail, Image as ImageIcon, ShieldCheck, MessageSquare } from 'lucide-react';
import { CampusItem, ClaimRecord } from '../types/index.ts';
import { isValidImageDataUrl } from '../utils/imageCompressor.ts';

const STATUS_LABELS: Record<CampusItem['status'], string> = {
  open: 'Open',
  claim_requested: 'Claim pending',
  verified: 'Verified (Handover pending)',
  returned: 'Returned',
  expired: 'Expired',
};

export function getClaimButtonState(
  item: CampusItem,
  currentUserId: string | undefined,
  myPendingClaim?: ClaimRecord,
  myApprovedClaim?: ClaimRecord,
  myRejectedClaim?: ClaimRecord
): { disabled: boolean; label: string } {
  const isOwner = item.authorId === currentUserId;
  const awaitingDropoff =
    item.type === 'found' &&
    item.holdingLocation !== 'finder_holding' &&
    item.custodyStatus === 'awaiting_dropoff';
  const canRetryRejected = Boolean(
    myRejectedClaim && !myRejectedClaim.resubmitted && !awaitingDropoff && (item.status === 'open' || item.status === 'claim_requested')
  );
  const blockedRejected = Boolean(myRejectedClaim) && !canRetryRejected;

  const disabled = item.status === 'returned' || item.status === 'verified' || item.status === 'expired'
    || awaitingDropoff || Boolean(myPendingClaim) || Boolean(myApprovedClaim) || blockedRejected || isOwner;

  if (item.status === 'returned') return { disabled, label: 'Item Reunited' };
  if (item.status === 'verified') return { disabled, label: 'Verified, Awaiting Handover' };
  if (item.status === 'expired') return { disabled, label: 'Notice Expired' };
  if (awaitingDropoff) return { disabled, label: 'Awaiting Desk Drop-off' };
  if (myApprovedClaim) return { disabled, label: 'Claim Approved' };
  if (myPendingClaim) return { disabled, label: 'Claim Submitted' };
  if (canRetryRejected) return { disabled: false, label: 'Retry Claim (1 left)' };
  if (blockedRejected) return { disabled: true, label: 'Claim Rejected (Final)' };
  if (isOwner) return { disabled, label: 'Your Found Post' };
  return { disabled, label: 'This is Mine (Claim)' };
}

export const ItemCardMedia: React.FC<{
  item: CampusItem;
  isFound: boolean;
  isFoundIdCard: boolean;
  displayTitle: string;
  previewPhoto?: string;
  lowDataMode: boolean;
  onSelectDetail: (item: CampusItem) => void;
}> = ({ item, isFound, isFoundIdCard, displayTitle, previewPhoto, lowDataMode, onSelectDetail }) => {
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [previewPhoto]);

  const hasValidPreview = Boolean(
    previewPhoto &&
    !imgFailed &&
    (isValidImageDataUrl(previewPhoto) || /^https?:\/\//i.test(previewPhoto))
  );

  if (isFoundIdCard) {
    return (
      <div className="p-4 bg-[#FAF6EF] dark:bg-[#141311] border-b border-[#C4BBAF] dark:border-[#3E3931] flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-[#4A443C] dark:text-[#CEC7BB]">
          <Shield className="w-4 h-4 text-[#0F6E6E] dark:text-[#199595]" />
          <span className="font-medium">Student ID Record</span>
        </div>
        <span className="stamp-found">Found</span>
      </div>
    );
  }
  if (hasValidPreview && previewPhoto && !lowDataMode) {
    return (
      <div className="h-48 sm:h-52 w-full overflow-hidden bg-[#FAF6EF] dark:bg-[#141311] border-b border-[#C4BBAF] dark:border-[#3E3931] relative">
        <button type="button" onClick={() => onSelectDetail(item)} className="w-full h-full block cursor-pointer focus:outline-none" aria-label={`View full details and photo for ${displayTitle}`}>
          <img
            src={previewPhoto}
            alt={item.title}
            className="w-full h-full object-cover transition-transform duration-200 hover:scale-[1.01]"
            loading="lazy"
            decoding="async"
            width={640}
            height={360}
            onLoad={(e) => {
              if (e.currentTarget.naturalWidth === 0) setImgFailed(true);
            }}
            onError={() => setImgFailed(true)}
          />
        </button>
        <div className="absolute top-3 left-3 pointer-events-none">
          <span className={isFound ? 'stamp-found' : 'stamp-lost'}>{isFound ? 'Found' : 'Lost'}</span>
        </div>
        <button type="button" onClick={() => onSelectDetail(item)} className="absolute bottom-2.5 right-2.5 bg-black/65 hover:bg-black/80 text-white text-xs font-medium px-2.5 py-1 rounded-[8px] inline-flex items-center gap-1 cursor-pointer">
          <ImageIcon className="w-3.5 h-3.5" />
          <span>View photo</span>
        </button>
      </div>
    );
  }
  return (
    <div className="p-3.5 bg-[#FAF6EF]/60 dark:bg-[#141311] border-b border-[#C4BBAF] dark:border-[#3E3931] flex items-center justify-between gap-2">
      <span className={isFound ? 'stamp-found' : 'stamp-lost'}>{isFound ? 'Found' : 'Lost'}</span>
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-[#5C554C] dark:text-[#A8A095]">{STATUS_LABELS[item.status]}</span>
        <button type="button" onClick={() => onSelectDetail(item)} className="text-xs font-medium text-[#0F6E6E] dark:text-[#199595] underline cursor-pointer">
          Details
        </button>
      </div>
    </div>
  );
};

export const ApprovedHandoverBanner: React.FC<{
  item: CampusItem;
  handoverInfo?: { authorName?: string; authorEmail?: string } | null;
  handoverError?: string;
  isLoadingHandover: boolean;
  hasUnreadChat?: boolean;
  onRequestHandoverContact?: (itemId: string) => void;
  onOpenChat?: () => void;
}> = ({ item, handoverInfo, handoverError, isLoadingHandover, hasUnreadChat, onRequestHandoverContact, onOpenChat }) => (
  <div className="bg-[#EDF7F1] dark:bg-[#0E2417] border border-[#2F7D4F]/30 rounded-[10px] p-3 text-sm space-y-2">
    <div className="flex items-center justify-between gap-2 flex-wrap">
      <span className="font-semibold text-[#1B5633] dark:text-[#75CE9A]">Claim Approved</span>
      {!handoverInfo && onRequestHandoverContact && (
        <button type="button" disabled={isLoadingHandover} onClick={() => onRequestHandoverContact(item.id)} className="text-sm font-semibold text-[#0F6E6E] dark:text-[#199595] underline cursor-pointer min-h-[44px]">
          {isLoadingHandover ? 'Loading…' : 'View handover contact'}
        </button>
      )}
    </div>
    {handoverError && (
      <p role="alert" className="text-xs text-[#9B1C1C] dark:text-[#F87171]">
        {handoverError}
      </p>
    )}
    {handoverInfo && (
      <div className="text-[#1F1B16] dark:text-[#F5F1EA] flex items-center gap-1.5 flex-wrap">
        <Mail className="w-4 h-4 text-[#0F6E6E] dark:text-[#199595] shrink-0" />
        <span>{handoverInfo.authorName || 'Finder'}:</span>
        {handoverInfo.authorEmail ? (
          <a href={`mailto:${handoverInfo.authorEmail}`} className="font-mono underline text-[#0F6E6E] dark:text-[#199595] break-all">
            {handoverInfo.authorEmail}
          </a>
        ) : (
          <span>Collect from {item.holdingLocation.replace(/_/g, ' ')}</span>
        )}
      </div>
    )}
    {onOpenChat && item.status !== 'returned' && item.status !== 'expired' && (
      <button
        type="button"
        onClick={onOpenChat}
        className="w-full min-h-[44px] bg-white dark:bg-[#1E1C18] hover:bg-[#FAF6EF] dark:hover:bg-[#28241F] text-[#0F6E6E] dark:text-[#199595] border border-[#0F6E6E]/40 rounded-[10px] font-semibold text-sm inline-flex items-center justify-center gap-1.5 cursor-pointer btn-campus"
      >
        <MessageSquare className="w-4 h-4" />
        <span>Open Handover Chat</span>
        {hasUnreadChat && (
          <span className="bg-[#E8A317] text-[#1F1B16] text-xs font-bold px-2 py-0.5 rounded-full">
            New
          </span>
        )}
      </button>
    )}
  </div>
);

export const FinderApprovedHandoverBanner: React.FC<{
  item: CampusItem;
  claim: ClaimRecord;
  isDemoMode?: boolean;
  hasUnreadChat?: boolean;
  onOpenChat?: () => void;
  onMarkReturned?: () => void;
}> = ({ item, claim, isDemoMode, hasUnreadChat, onOpenChat, onMarkReturned }) => (
  <div className="bg-[#EDF7F1] dark:bg-[#0E2417] border border-[#2F7D4F]/30 rounded-[10px] p-3 text-sm space-y-2">
    <div className="flex items-center justify-between gap-2 flex-wrap">
      <span className="font-semibold text-[#1B5633] dark:text-[#75CE9A]">
        {claim.privateLoaded || isDemoMode ? `Approved for ${claim.claimantName}` : 'Claim Approved for Handover'}
      </span>
    </div>
    {onOpenChat && item.status !== 'returned' && item.status !== 'expired' && (
      <button
        type="button"
        onClick={onOpenChat}
        className="w-full min-h-[44px] bg-white dark:bg-[#1E1C18] hover:bg-[#FAF6EF] dark:hover:bg-[#28241F] text-[#0F6E6E] dark:text-[#199595] border border-[#0F6E6E]/40 rounded-[10px] font-semibold text-sm inline-flex items-center justify-center gap-1.5 cursor-pointer btn-campus"
      >
        <MessageSquare className="w-4 h-4" />
        <span>Open Handover Chat</span>
        {hasUnreadChat && (
          <span className="bg-[#E8A317] text-[#1F1B16] text-xs font-bold px-2 py-0.5 rounded-full">
            New
          </span>
        )}
      </button>
    )}
    {onMarkReturned && item.status !== 'returned' && (
      <button
        type="button"
        onClick={onMarkReturned}
        className="w-full min-h-[44px] bg-[#0F6E6E] hover:bg-[#0C5656] text-white rounded-[10px] font-semibold text-sm inline-flex items-center justify-center gap-1.5 cursor-pointer btn-campus"
      >
        <ShieldCheck className="w-4 h-4" />
        <span>Confirm Handover (Mark Returned)</span>
      </button>
    )}
  </div>
);

export const FinderClaimReviewCard: React.FC<{
  claim: ClaimRecord;
  itemId: string;
  isDemoMode?: boolean;
  hasUnreadChat?: boolean;
  loadingClaimId: string | null;
  onLoadPrivate: (claimId: string) => void;
  onApproveClaim?: (claimId: string, itemId: string) => Promise<boolean> | void;
  onRejectClaim?: (claimId: string) => Promise<boolean> | void;
  onOpenChat?: (claim: ClaimRecord) => void;
  onActionError: (msg: string | null) => void;
}> = ({ claim, itemId, isDemoMode, hasUnreadChat, loadingClaimId, onLoadPrivate, onApproveClaim, onRejectClaim, onOpenChat, onActionError }) => {
  const showDetails = claim.privateLoaded || isDemoMode;
  return (
    <div className="bg-[#FEF7E9] dark:bg-[#2B210A] border border-[#E8A317]/40 rounded-[10px] p-3 text-sm space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="font-semibold text-[#7A5000] dark:text-[#F9CF7C]">
          {showDetails ? `Claim from ${claim.claimantName}` : 'Pending ownership claim'}
        </p>
        <div className="flex items-center gap-2">
          {!showDetails && (
            <button
              type="button"
              disabled={loadingClaimId === claim.id}
              onClick={() => onLoadPrivate(claim.id)}
              className="text-xs font-semibold text-[#0F6E6E] dark:text-[#199595] underline cursor-pointer min-h-[36px]"
            >
              {loadingClaimId === claim.id ? 'Loading…' : 'Review answer'}
            </button>
          )}
          {onOpenChat && (
            <button
              type="button"
              onClick={() => onOpenChat(claim)}
              className="text-xs font-semibold text-[#0F6E6E] dark:text-[#199595] bg-white dark:bg-[#1E1C18] border border-[#0F6E6E]/35 rounded-[8px] px-2.5 min-h-[44px] inline-flex items-center gap-1 cursor-pointer"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Chat</span>
              {hasUnreadChat && (
                <span className="bg-[#E8A317] text-[#1F1B16] text-xs font-bold px-1.5 py-0.5 rounded-full">
                  New
                </span>
              )}
            </button>
          )}
        </div>
      </div>
      {showDetails && (
        <p className="text-[#4A443C] dark:text-[#CEC7BB]">Answer: {claim.submittedAnswer || 'None provided'}</p>
      )}
      {onApproveClaim && onRejectClaim && (
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={async () => {
              onActionError(null);
              const ok = await onApproveClaim(claim.id, itemId);
              if (ok === false) onActionError('Could not approve claim. Check your connection and try again.');
            }}
            className="flex-1 min-h-[44px] bg-[#0F6E6E] hover:bg-[#0C5656] text-white rounded-[10px] font-medium cursor-pointer"
          >
            Approve
          </button>
          <button
            type="button"
            onClick={async () => {
              onActionError(null);
              const ok = await onRejectClaim(claim.id);
              if (ok === false) onActionError('Could not reject claim. Check your connection and try again.');
            }}
            className="flex-1 min-h-[44px] bg-white dark:bg-[#1E1C18] text-[#9B1C1C] dark:text-[#F87171] border border-[#F87171]/50 rounded-[10px] font-medium cursor-pointer"
          >
            Reject
          </button>
        </div>
      )}
    </div>
  );
};

export const ItemCardAction: React.FC<{
  item: CampusItem;
  isFound: boolean;
  isReturned: boolean;
  isAuthor: boolean;
  claimState: { disabled: boolean; label: string };
  onClaimItem: (item: CampusItem) => void;
  onUpdateItemStatus?: (itemId: string, status: CampusItem['status']) => Promise<boolean> | void;
  onFoundMatch?: (lostItem: CampusItem) => void;
  onOpenReportModal: () => void;
}> = ({
  item, isFound, isReturned, isAuthor, claimState, onClaimItem, onUpdateItemStatus, onFoundMatch, onOpenReportModal,
}) => {
  if (isFound) {
    return (
      <button
        type="button"
        onClick={() => onClaimItem(item)}
        disabled={claimState.disabled}
        className={`w-full py-2.5 px-4 rounded-[10px] text-sm font-medium transition-colors flex items-center justify-center gap-2 min-h-[44px] cursor-pointer btn-campus ${
          claimState.disabled ? 'bg-[#EDE7DC] dark:bg-[#2E2A24] text-[#5C554C] dark:text-[#A8A095] cursor-not-allowed' : 'bg-[#0F6E6E] hover:bg-[#0C5656] text-white active:scale-98 shadow-xs'
        }`}
      >
        <ShieldCheck className="w-4 h-4" />
        <span>{claimState.label}</span>
      </button>
    );
  }
  if (isAuthor && onUpdateItemStatus) {
    const label = isReturned ? 'Item Marked Found' : item.status === 'expired' ? 'Renew Lost Notice' : 'Mark as Found / Returned';
    return (
      <button
        type="button"
        disabled={isReturned}
        onClick={() => onUpdateItemStatus(item.id, item.status === 'expired' ? 'open' : 'returned')}
        className="w-full text-center py-2 px-3 text-sm text-[#0F6E6E] dark:text-[#199595] bg-[#E7F3F3] dark:bg-[#0D2D2D] hover:bg-[#D5EBEB] rounded-[10px] border border-[#0F6E6E]/30 min-h-[44px] flex items-center justify-center font-semibold cursor-pointer disabled:opacity-60 transition-colors"
      >
        {label}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={() => (onFoundMatch ? onFoundMatch(item) : onOpenReportModal())}
      disabled={isReturned || item.status === 'expired'}
      className="w-full text-center py-2 px-3 text-sm text-[#7A5000] dark:text-[#F9CF7C] bg-[#FEF7E9] dark:bg-[#2B210A] hover:bg-[#FCEEC9] dark:hover:bg-[#3A2B0D] rounded-[10px] border border-[#E8A317]/40 min-h-[44px] flex items-center justify-center font-semibold cursor-pointer disabled:opacity-60 transition-colors"
    >
      {isReturned ? 'Item Returned' : 'I Found This — Post Match'}
    </button>
  );
};
