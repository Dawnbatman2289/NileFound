import React, { useState } from 'react';
import { AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { CampusItem, ClaimRecord } from '../../types/index.ts';
import { formatDateDDMMYYYY } from '../../utils/dateFormatter.ts';
import { fetchItemPrivateDetails } from '../../services/firestoreService.ts';
import { reportError } from '../ErrorBoundary.tsx';
import { ADMIN_CARD } from './adminStyles.ts';

interface ClaimsTabProps {
  pendingClaims: ClaimRecord[];
  items: CampusItem[];
  isAdmin: boolean;
  isDemoMode: boolean;
  claimsError: string | null;
  onRetryClaims?: () => void;
  hasMoreClaims: boolean;
  isLoadingMoreClaims: boolean;
  onLoadMoreClaims?: () => Promise<void> | void;
  onFetchClaimPrivateDetails?: (itemId: string, claimId: string) => Promise<void>;
  onApproveClaim: (claimId: string, itemId: string) => Promise<boolean> | void;
  onRejectClaim: (claimId: string) => Promise<boolean> | void;
  onSuccessNotice: (msg: string) => void;
  onErrorNotice: (msg: string) => void;
  onRefreshAudit: () => void;
}

export const ClaimsTab: React.FC<ClaimsTabProps> = ({
  pendingClaims,
  items,
  isAdmin,
  isDemoMode,
  claimsError,
  onRetryClaims,
  hasMoreClaims,
  isLoadingMoreClaims,
  onLoadMoreClaims,
  onFetchClaimPrivateDetails,
  onApproveClaim,
  onRejectClaim,
  onSuccessNotice,
  onErrorNotice,
  onRefreshAudit,
}) => {
  const [revealedAnswers, setRevealedAnswers] = useState<
    Record<string, { open: boolean; loading: boolean; answer?: string }>
  >({});
  const [loadingClaimPrivateId, setLoadingClaimPrivateId] = useState<string | null>(null);

  const toggleRevealAnswer = async (itemId: string) => {
    const existing = revealedAnswers[itemId];
    if (existing?.open) {
      setRevealedAnswers((prev) => ({ ...prev, [itemId]: { ...existing, open: false } }));
      return;
    }
    if (existing?.answer !== undefined) {
      setRevealedAnswers((prev) => ({ ...prev, [itemId]: { ...existing, open: true } }));
      return;
    }
    setRevealedAnswers((prev) => ({ ...prev, [itemId]: { open: true, loading: true } }));
    try {
      const details = await fetchItemPrivateDetails(itemId);
      setRevealedAnswers((prev) => ({
        ...prev,
        [itemId]: { open: true, loading: false, answer: details.expectedAnswer || 'No private answer recorded.' },
      }));
    } catch (err) {
      reportError('toggleRevealAnswer failed', err);
      setRevealedAnswers((prev) => ({
        ...prev,
        [itemId]: { open: true, loading: false, answer: 'Could not load expected answer.' },
      }));
    }
  };

  return (
    <div className="space-y-4">
      {claimsError && (
        <div role="alert" className="bg-[#FDF2F2] dark:bg-[#2B0E0E] border border-[#F87171]/50 text-[#9B1C1C] dark:text-[#F87171] p-4 rounded-[12px] text-sm flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{claimsError}</span>
          </div>
          {onRetryClaims && (
            <button
              type="button"
              onClick={onRetryClaims}
              className="min-h-[44px] px-4 rounded-[10px] border border-[#F87171]/50 bg-white dark:bg-[#1E1C18] text-sm font-medium cursor-pointer"
            >
              Retry
            </button>
          )}
        </div>
      )}

      {pendingClaims.length === 0 ? (
        <div className={`${ADMIN_CARD} p-10 text-center space-y-2`}>
          <CheckCircle className="w-10 h-10 text-[#0F6E6E] dark:text-[#199595] mx-auto" />
          <h4 className="font-serif font-bold text-base">No pending claims</h4>
          <p className="text-sm text-[#5C554C] dark:text-[#A8A095]">All submitted claims on loaded pages have been processed.</p>
        </div>
      ) : (
        pendingClaims.map((claim) => {
          const matchedItem = items.find((i) => i.id === claim.itemId);
          const reveal = revealedAnswers[claim.itemId];
          const isPrivateShown = claim.privateLoaded || isDemoMode;
          const canModerate = isAdmin || matchedItem?.holdingLocation !== 'finder_holding';

          return (
            <div key={claim.id} className={`${ADMIN_CARD} p-5 space-y-4 hover:border-[#0F6E6E]/40 transition-colors`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#C4BBAF] dark:border-[#3E3931] pb-4">
                <div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="font-serif font-bold text-base">{claim.itemTitle}</span>
                    <span className="text-xs font-mono font-bold uppercase bg-[#FEF7E9] dark:bg-[#2B210A] text-[#7A5000] dark:text-[#F9CF7C] border border-[#E8A317]/30 px-2 py-0.5 rounded-full">
                      Pending Review
                    </span>
                  </div>
                  <p className="text-sm text-[#4A443C] dark:text-[#CEC7BB] mt-1">
                    {isPrivateShown ? (
                      <>
                        Claimed by <strong className="text-[#1F1B16] dark:text-[#F5F1EA]">{claim.claimantName}</strong>{' '}
                        {claim.claimantEmail ? `(${claim.claimantEmail}) ` : ''}on {formatDateDDMMYYYY(claim.createdAt)}
                      </>
                    ) : (
                      <>Submitted on {formatDateDDMMYYYY(claim.createdAt)} • Expand below to load claimant identity &amp; answer</>
                    )}
                  </p>
                </div>

                <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
                  {!isPrivateShown && onFetchClaimPrivateDetails && (
                    <button
                      type="button"
                      disabled={loadingClaimPrivateId === claim.id}
                      onClick={async () => {
                        setLoadingClaimPrivateId(claim.id);
                        try {
                          await onFetchClaimPrivateDetails(claim.itemId, claim.id);
                        } catch (err: unknown) {
                          onErrorNotice(err instanceof Error ? err.message : 'Could not load claim verification details.');
                        } finally {
                          setLoadingClaimPrivateId(null);
                        }
                      }}
                      className="min-h-[44px] px-3.5 py-2 rounded-[10px] border border-[#857C70] dark:border-[#787065] text-sm font-medium text-[#0F6E6E] dark:text-[#199595] bg-white dark:bg-[#141311] cursor-pointer"
                    >
                      {loadingClaimPrivateId === claim.id ? 'Loading…' : 'Inspect Claimant & Answer'}
                    </button>
                  )}
                  {!canModerate ? (
                    <span className="text-xs text-[#5C554C] dark:text-[#A8A095] px-2.5 py-1.5 rounded-[8px] border border-[#C4BBAF] dark:border-[#3E3931]">
                      Held by finder — moderated by finder or Admin
                    </span>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={async () => {
                          const ok = await onApproveClaim(claim.id, claim.itemId);
                          if (ok === false) return onErrorNotice('Could not approve claim. Check your permissions and connection.');
                          onSuccessNotice(`Verified claim${isPrivateShown ? ` for ${claim.claimantName}` : ''}. Confirm handover when picked up.`);
                          onRefreshAudit();
                        }}
                        className="flex items-center gap-2 bg-[#0F6E6E] hover:bg-[#0C5656] text-white text-sm font-semibold px-4 py-2.5 rounded-[10px] transition-colors min-h-[44px] cursor-pointer btn-campus"
                      >
                        <CheckCircle className="w-4 h-4" />
                        <span>Approve for Handover</span>
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          const ok = await onRejectClaim(claim.id);
                          if (ok === false) return onErrorNotice('Could not reject claim. Check your permissions and connection.');
                          onSuccessNotice(`Rejected claim${isPrivateShown ? ` from ${claim.claimantName}` : ''}.`);
                          onRefreshAudit();
                        }}
                        className="flex items-center gap-2 bg-white dark:bg-[#28241F] hover:bg-[#FDF2F2] dark:hover:bg-[#2B0E0E] text-[#9B1C1C] dark:text-[#F87171] text-sm font-semibold px-4 py-2.5 rounded-[10px] border border-[#F87171]/50 transition-colors min-h-[44px] cursor-pointer btn-campus"
                      >
                        <XCircle className="w-4 h-4" />
                        <span>Reject</span>
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm bg-[#FAF6EF] dark:bg-[#141311] p-4 rounded-[10px] border border-[#C4BBAF] dark:border-[#3E3931]">
                <div className="space-y-2">
                  <div>
                    <span className="font-bold text-[#5C554C] dark:text-[#A8A095] block mb-1.5 uppercase tracking-wider text-xs">
                      Item Details &amp; Question
                    </span>
                    <p className="text-[#4A443C] dark:text-[#CEC7BB] leading-relaxed">{matchedItem?.description || 'No public description.'}</p>
                    {matchedItem?.verificationQuestion && (
                      <p className="mt-2 text-[#0F6E6E] dark:text-[#199595] font-medium">
                        <strong>Question:</strong> {matchedItem.verificationQuestion}
                      </p>
                    )}
                  </div>
                  {canModerate && (
                    <div>
                      <button
                        type="button"
                        onClick={() => toggleRevealAnswer(claim.itemId)}
                        className="text-xs font-semibold text-[#0F6E6E] dark:text-[#199595] hover:underline min-h-[44px] cursor-pointer"
                      >
                        {reveal?.open ? 'Hide Expected Answer' : 'Reveal Expected Answer'}
                      </button>
                      {reveal?.open && (
                        <p className="bg-white dark:bg-[#1E1C18] p-2.5 rounded-[10px] border border-[#0F6E6E]/30 font-mono text-xs text-[#0F6E6E] dark:text-[#199595]">
                          {reveal.loading ? 'Loading secret…' : reveal.answer}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <span className="font-bold text-[#5C554C] dark:text-[#A8A095] block mb-1.5 uppercase tracking-wider text-xs">
                    Claimant Submitted Answer
                  </span>
                  {isPrivateShown ? (
                    <p className="bg-white dark:bg-[#1E1C18] p-3 rounded-[10px] border border-[#C4BBAF] dark:border-[#3E3931] font-mono text-sm leading-relaxed">
                      {claim.submittedAnswer || 'No verification answer provided.'}
                    </p>
                  ) : (
                    <p className="bg-white dark:bg-[#1E1C18] p-3 rounded-[10px] border border-[#C4BBAF] dark:border-[#3E3931] text-xs text-[#5C554C] dark:text-[#A8A095]">
                      Loaded on demand to minimize mobile data usage. Click &ldquo;Inspect Claimant &amp; Answer&rdquo; above.
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })
      )}

      {hasMoreClaims && onLoadMoreClaims && (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            disabled={isLoadingMoreClaims}
            onClick={onLoadMoreClaims}
            className="min-h-[44px] rounded-[10px] border border-[#857C70] dark:border-[#787065] bg-white dark:bg-[#1E1C18] hover:bg-[#FAF6EF] dark:hover:bg-[#28241F] px-5 text-sm font-medium text-[#1F1B16] dark:text-[#F5F1EA] disabled:opacity-60 cursor-pointer btn-campus"
          >
            {isLoadingMoreClaims ? 'Loading more claims…' : 'Load more claims'}
          </button>
        </div>
      )}
    </div>
  );
};
