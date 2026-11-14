import React from 'react';
import { Trash2 } from 'lucide-react';
import { CampusItem } from '../../types/index.ts';
import { ADMIN_CARD } from './adminStyles.ts';

interface AllItemsTabProps {
  items: CampusItem[];
  isAdmin: boolean;
  canInspect: boolean;
  onSelectItem: (item: CampusItem) => void;
  onRequestDelete: (item: CampusItem) => void;
  onUpdateItemStatus: (itemId: string, status: CampusItem['status']) => Promise<boolean> | void;
  onSuccessNotice: (msg: string) => void;
  onErrorNotice: (msg: string) => void;
  onRefreshAudit: () => void;
}

export const AllItemsTab: React.FC<AllItemsTabProps> = ({
  items,
  isAdmin,
  canInspect,
  onSelectItem,
  onRequestDelete,
  onUpdateItemStatus,
  onSuccessNotice,
  onErrorNotice,
  onRefreshAudit,
}) => (
  <div className={`${ADMIN_CARD} overflow-hidden`}>
    <div className="p-5 border-b border-[#C4BBAF] dark:border-[#3E3931] flex items-center justify-between">
      <div>
        <h3 className="font-serif font-bold text-base">Master Inventory Control</h3>
        <p className="text-sm text-[#4A443C] dark:text-[#CEC7BB] mt-0.5">Update status, confirm handover, or purge listings.</p>
      </div>
      <span className="text-xs text-[#5C554C] dark:text-[#A8A095] font-mono">Total: {items.length}</span>
    </div>

    <div className="divide-y divide-[#C4BBAF] dark:divide-[#3E3931] text-sm">
      {items.length === 0 ? (
        <div className="p-8 text-center text-[#5C554C] dark:text-[#A8A095]">No items currently logged.</div>
      ) : (
        items.map((item) => (
          <div
            key={item.id}
            onClick={() => canInspect && onSelectItem(item)}
            className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#FAF6EF] dark:hover:bg-[#141311]/70 transition-colors cursor-pointer"
          >
            <div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs font-mono font-bold px-2 py-0.5 rounded uppercase ${
                    item.type === 'found'
                      ? 'bg-[#EDF7F1] dark:bg-[#0E2417] text-[#1B5633] dark:text-[#75CE9A]'
                      : 'bg-[#FEF7E9] dark:bg-[#2B210A] text-[#7A5000] dark:text-[#F9CF7C]'
                  }`}
                >
                  {item.type}
                </span>
                <span className="font-serif font-bold text-base">{item.title}</span>
              </div>
              <p className="text-sm text-[#4A443C] dark:text-[#CEC7BB] mt-1">
                {item.location} • Status: <strong className="text-[#1F1B16] dark:text-[#F5F1EA]">{item.status}</strong> •{' '}
                <span className="text-[#0F6E6E] dark:text-[#199595] underline">Inspect details</span>
              </p>
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto" onClick={(e) => e.stopPropagation()}>
              <select
                aria-label={`Status for ${item.title}`}
                value={item.status}
                onChange={async (e) => {
                  const nextStatus = e.target.value as CampusItem['status'];
                  const ok = await onUpdateItemStatus(item.id, nextStatus);
                  if (ok === false) return onErrorNotice(`Could not update status for "${item.title}".`);
                  onSuccessNotice(`Updated status for "${item.title}" to ${nextStatus}.`);
                  onRefreshAudit();
                }}
                className="flex-1 sm:flex-initial bg-white dark:bg-[#141311] text-[#1F1B16] dark:text-[#F5F1EA] border border-[#857C70] dark:border-[#787065] rounded-[10px] px-3 py-2 text-base sm:text-sm focus:border-[#0F6E6E] min-h-[44px] cursor-pointer"
              >
                <option value="open">Open</option>
                <option value="claim_requested">Claim Pending</option>
                <option value="verified">Verified (Handover Pending)</option>
                <option value="returned">Returned / Reunited</option>
                <option value="expired">Expired</option>
              </select>

              {isAdmin && (
                <button
                  type="button"
                  onClick={() => onRequestDelete(item)}
                  className="text-[#5C554C] dark:text-[#A8A095] hover:text-[#9B1C1C] dark:hover:text-[#F87171] p-2 min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors cursor-pointer"
                  title="Delete item"
                  aria-label={`Delete ${item.title}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  </div>
);
