import React from 'react';
import { Calendar, CheckCircle, Clock, Mail, MapPin, ShieldCheck, Tag, Trash2, User as UserIcon, X } from 'lucide-react';
import { CampusItem, ClaimRecord } from '../../types/index.ts';
import { formatDateDDMMYYYY } from '../../utils/dateFormatter.ts';
import type { ItemPrivateDetails } from '../../services/firestoreService.ts';
import { ADMIN_CARD } from './adminStyles.ts';

interface ItemDetailModalProps {
  selectedItem: CampusItem;
  claims: ClaimRecord[];
  isAdmin: boolean;
  lowDataMode: boolean;
  selectedItemPhoto: string | null;
  isLoadingItemPhoto: boolean;
  privateDetails: ItemPrivateDetails;
  isLoadingPrivate: boolean;
  dialogRef: React.RefObject<HTMLDivElement | null>;
  onClose: () => void;
  onUpdateSelectedItem: (updated: CampusItem) => void;
  onRequestDelete: (item: CampusItem) => void;
  onApproveClaim: (claimId: string, itemId: string) => Promise<boolean> | void;
  onRejectClaim: (claimId: string) => Promise<boolean> | void;
  onUpdateItemStatus: (itemId: string, status: CampusItem['status']) => Promise<boolean> | void;
  onSuccessNotice: (msg: string) => void;
  onErrorNotice: (msg: string) => void;
  onRefreshAudit: () => void;
}

export const ItemDetailModal: React.FC<ItemDetailModalProps> = ({
  selectedItem,
  claims,
  isAdmin,
  lowDataMode,
  selectedItemPhoto,
  isLoadingItemPhoto,
  privateDetails,
  isLoadingPrivate,
  dialogRef,
  onClose,
  onUpdateSelectedItem,
  onRequestDelete,
  onApproveClaim,
  onRejectClaim,
  onUpdateItemStatus,
  onSuccessNotice,
  onErrorNotice,
  onRefreshAudit,
}) => {
  const itemClaims = claims.filter((c) => c.itemId === selectedItem.id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/55 overflow-y-auto" onClick={onClose}>
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-item-modal-title"
        className={`w-full max-w-[672px] shadow-xl max-h-[90dvh] overflow-hidden flex flex-col min-w-0 outline-none ${ADMIN_CARD}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-[#FAF6EF] dark:bg-[#141311] px-5 sm:px-6 py-4 border-b border-[#C4BBAF] dark:border-[#3E3931] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className={selectedItem.type === 'found' ? 'stamp-found' : 'stamp-lost'}>{selectedItem.type}</span>
            <h3 id="admin-item-modal-title" className="font-serif font-bold text-base truncate">{selectedItem.title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#5C554C] dark:text-[#A8A095] hover:text-[#1F1B16] dark:hover:text-[#F5F1EA] p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-[10px] cursor-pointer"
            aria-label="Close item details"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-4 min-h-0 flex-1 overflow-y-auto text-sm">
          {selectedItem.category === 'student_id' ? null : lowDataMode ? (
            <div className="bg-[#E7F3F3] dark:bg-[#0D2D2D] border border-[#0F6E6E]/25 text-[#0F6E6E] dark:text-[#199595] rounded-[10px] p-3 text-sm">
              Low-Data mode active — full photo download skipped.
            </div>
          ) : isLoadingItemPhoto ? (
            <div className="h-44 rounded-[10px] bg-[#FAF6EF] dark:bg-[#141311] border border-[#C4BBAF] dark:border-[#3E3931] flex items-center justify-center text-[#5C554C] dark:text-[#A8A095]">
              Loading full-resolution photo…
            </div>
          ) : selectedItemPhoto ? (
            <div className="rounded-[10px] overflow-hidden bg-[#FAF6EF] dark:bg-[#141311] border border-[#C4BBAF] dark:border-[#3E3931]">
              <img src={selectedItemPhoto} alt={selectedItem.title} className="w-full max-h-96 object-contain mx-auto" loading="lazy" decoding="async" width={640} height={360} />
            </div>
          ) : null}

          <div className="bg-[#FAF6EF] dark:bg-[#141311] border border-[#C4BBAF] dark:border-[#3E3931] rounded-[10px] p-4 space-y-1.5">
            <span className="text-xs font-medium uppercase text-[#5C554C] dark:text-[#A8A095]">Full Description</span>
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{selectedItem.description}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { icon: Tag, label: 'Category', value: selectedItem.category },
              { icon: MapPin, label: 'Campus Location', value: selectedItem.location },
              { icon: Calendar, label: 'Date Lost / Found', value: formatDateDDMMYYYY(selectedItem.dateLostOrFound) },
              { icon: ShieldCheck, label: 'Held-At Location', value: selectedItem.holdingLocation },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="bg-[#FAF6EF] dark:bg-[#141311] border border-[#C4BBAF] dark:border-[#3E3931] rounded-[10px] p-3.5 space-y-1">
                <span className="text-xs uppercase text-[#5C554C] dark:text-[#A8A095] flex items-center gap-1 font-medium">
                  <Icon className="w-3.5 h-3.5 text-[#0F6E6E] dark:text-[#199595]" /> {label}
                </span>
                <p className="font-semibold">{value}</p>
              </div>
            ))}
            <div className="bg-[#FAF6EF] dark:bg-[#141311] border border-[#C4BBAF] dark:border-[#3E3931] rounded-[10px] p-3.5 space-y-1">
              <span className="text-xs uppercase text-[#5C554C] dark:text-[#A8A095] font-medium">Status</span>
              <p className="font-semibold text-[#0F6E6E] dark:text-[#199595] uppercase">{selectedItem.status}</p>
            </div>
            <div className="bg-[#FAF6EF] dark:bg-[#141311] border border-[#C4BBAF] dark:border-[#3E3931] rounded-[10px] p-3.5 space-y-1">
              <span className="text-xs uppercase text-[#5C554C] dark:text-[#A8A095] flex items-center gap-1 font-medium">
                <Clock className="w-3.5 h-3.5 text-[#0F6E6E] dark:text-[#199595]" /> Created Time
              </span>
              <p className="font-mono text-xs">{new Date(selectedItem.createdAt).toLocaleString('en-GB')}</p>
            </div>
          </div>

          <div className="bg-[#FAF6EF] dark:bg-[#141311] border border-[#0F6E6E]/35 rounded-[10px] p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase text-[#0F6E6E] dark:text-[#199595]">
                Staff-Only Reporter &amp; Verification Details
              </span>
              {isLoadingPrivate && <span className="text-xs text-[#5C554C] dark:text-[#A8A095]">Loading...</span>}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <span className="text-xs text-[#5C554C] dark:text-[#A8A095] flex items-center gap-1"><UserIcon className="w-3.5 h-3.5" /> Reporter Name</span>
                <p className="font-semibold mt-0.5">{privateDetails.authorName || 'Not recorded'}</p>
              </div>
              <div>
                <span className="text-xs text-[#5C554C] dark:text-[#A8A095] flex items-center gap-1"><Mail className="w-3.5 h-3.5" /> Reporter Email</span>
                <p className="font-mono text-xs mt-0.5 break-all">{privateDetails.authorEmail || 'Not recorded'}</p>
              </div>
            </div>
            {selectedItem.verificationQuestion && (
              <div className="pt-2 border-t border-[#C4BBAF] dark:border-[#3E3931] space-y-1">
                <p className="text-[#4A443C] dark:text-[#CEC7BB]">
                  <strong className="text-[#1F1B16] dark:text-[#F5F1EA]">Verification Question:</strong> {selectedItem.verificationQuestion}
                </p>
                <p className="text-[#0F6E6E] dark:text-[#199595]">
                  <strong>Expected Answer:</strong> {privateDetails.expectedAnswer || 'Not recorded'}
                </p>
              </div>
            )}
          </div>

          <div className="space-y-2.5">
            <h4 className="font-serif font-bold text-sm">Ownership Claims ({itemClaims.length})</h4>
            {itemClaims.length === 0 ? (
              <p className="text-[#5C554C] dark:text-[#A8A095] bg-[#FAF6EF] dark:bg-[#141311] border border-[#C4BBAF] dark:border-[#3E3931] rounded-[10px] p-3.5">
                No claims submitted for this item yet.
              </p>
            ) : (
              itemClaims.map((claim) => (
                <div key={claim.id} className="bg-[#FAF6EF] dark:bg-[#141311] border border-[#C4BBAF] dark:border-[#3E3931] rounded-[10px] p-3.5 space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div>
                      <span className="font-semibold">{claim.claimantName}</span>
                      <span className="text-[#5C554C] dark:text-[#A8A095] ml-2 font-mono text-xs">({claim.claimantEmail})</span>
                    </div>
                    <span className="text-xs font-semibold uppercase px-2 py-0.5 rounded-[10px] bg-white dark:bg-[#1E1C18] border border-[#C4BBAF] dark:border-[#3E3931] text-[#0F6E6E] dark:text-[#199595]">
                      {claim.status}
                    </span>
                  </div>
                  <p className="text-[#4A443C] dark:text-[#CEC7BB]">
                    <strong className="text-[#1F1B16] dark:text-[#F5F1EA]">Submitted Answer:</strong> {claim.submittedAnswer}
                  </p>
                  {claim.status === 'pending' && (
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={async () => {
                          const ok = await onApproveClaim(claim.id, selectedItem.id);
                          if (ok === false) return onErrorNotice('Could not approve claim. Check permissions and try again.');
                          onSuccessNotice(`Verified claim for ${selectedItem.title}.`);
                          onRefreshAudit();
                        }}
                        className="bg-[#0F6E6E] hover:bg-[#0C5656] text-white font-medium px-3 py-2 min-h-[44px] rounded-[10px] text-sm cursor-pointer btn-campus shadow-xs"
                      >
                        Approve for Handover
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          const ok = await onRejectClaim(claim.id);
                          if (ok === false) return onErrorNotice('Could not reject claim. Check permissions and try again.');
                          onSuccessNotice('Rejected claim.');
                          onRefreshAudit();
                        }}
                        className="bg-white dark:bg-[#28241F] hover:bg-[#FAF6EF] text-[#9B1C1C] dark:text-[#F87171] border border-[#F87171]/50 font-medium px-3 py-2 min-h-[44px] rounded-[10px] text-sm cursor-pointer btn-campus"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-[#FAF6EF] dark:bg-[#141311] px-5 sm:px-6 py-4 border-t border-[#C4BBAF] dark:border-[#3E3931] flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={async () => {
              const ok = await onUpdateItemStatus(selectedItem.id, 'returned');
              if (ok === false) return onErrorNotice('Could not confirm handover. Check permissions and try again.');
              onUpdateSelectedItem({ ...selectedItem, status: 'returned' });
              onSuccessNotice(`Confirmed handover and marked "${selectedItem.title}" as Returned.`);
              onRefreshAudit();
            }}
            disabled={selectedItem.status === 'returned'}
            className="bg-[#0F6E6E] hover:bg-[#0C5656] disabled:opacity-50 text-white font-medium px-4 py-2.5 rounded-[10px] text-sm flex items-center gap-2 cursor-pointer min-h-[44px] btn-campus shadow-xs"
          >
            <CheckCircle className="w-4 h-4" />
            <span>{selectedItem.status === 'returned' ? 'Returned' : 'Confirm Handover (Mark Returned)'}</span>
          </button>
          {isAdmin && (
            <button
              type="button"
              onClick={() => onRequestDelete(selectedItem)}
              className="bg-white dark:bg-[#28241F] hover:bg-rose-50 dark:hover:bg-rose-950/20 text-[#9B1C1C] dark:text-[#F87171] border border-[#F87171]/50 font-medium px-4 py-2.5 rounded-[10px] text-sm flex items-center gap-2 cursor-pointer min-h-[44px] btn-campus"
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
