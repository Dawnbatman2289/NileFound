import React from 'react';
import { MapPin } from 'lucide-react';
import { CampusItem } from '../../types/index.ts';
import { formatDateDDMMYYYY } from '../../utils/dateFormatter.ts';
import { ADMIN_CARD } from './adminStyles.ts';

interface CustodyTabProps {
  physicalCustodyItems: CampusItem[];
  onUpdateItemStatus: (itemId: string, status: CampusItem['status']) => Promise<boolean> | void;
  onSuccessNotice: (msg: string) => void;
  onErrorNotice: (msg: string) => void;
  onRefreshAudit: () => void;
}

export const CustodyTab: React.FC<CustodyTabProps> = ({
  physicalCustodyItems,
  onUpdateItemStatus,
  onSuccessNotice,
  onErrorNotice,
  onRefreshAudit,
}) => (
  <div className="space-y-4">
    <div className={`${ADMIN_CARD} p-5 flex items-center justify-between gap-3`}>
      <div>
        <h3 className="font-serif font-bold text-base">Gate &amp; Office Custody Ledger</h3>
        <p className="text-sm text-[#4A443C] dark:text-[#CEC7BB] mt-0.5">
          Physical inventory logged at security checkpoints and administration desks.
        </p>
      </div>
      <span className="text-xs bg-[#E7F3F3] dark:bg-[#0D2D2D] text-[#0F6E6E] dark:text-[#199595] border border-[#0F6E6E]/30 font-mono font-bold px-3 py-1 rounded-full shrink-0">
        {physicalCustodyItems.length} Held Items
      </span>
    </div>

    {physicalCustodyItems.length === 0 ? (
      <div className={`${ADMIN_CARD} p-10 text-center space-y-2`}>
        <MapPin className="w-9 h-9 text-[#0F6E6E] dark:text-[#199595] mx-auto" />
        <h4 className="font-serif font-bold text-base">No items held at campus desks</h4>
        <p className="text-sm text-[#5C554C] dark:text-[#A8A095]">
          Found items handed to Security Gate, Library, or Student Affairs appear here.
        </p>
      </div>
    ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {physicalCustodyItems.map((item) => (
          <div key={item.id} className={`${ADMIN_CARD} p-5 space-y-3 hover:border-[#0F6E6E]/40 transition-colors`}>
            <div className="flex items-center justify-between gap-2">
              <span className="font-serif font-bold text-sm">{item.title}</span>
              <span className="text-xs font-mono uppercase bg-[#FAF6EF] dark:bg-[#141311] text-[#0F6E6E] dark:text-[#199595] border border-[#0F6E6E]/30 px-2.5 py-0.5 rounded-full font-bold shrink-0">
                {item.holdingLocation.replace(/_/g, ' ')}
              </span>
            </div>
            <p className="text-sm text-[#4A443C] dark:text-[#CEC7BB] line-clamp-2 leading-relaxed">{item.description}</p>
            <div className="flex items-center justify-between text-xs text-[#5C554C] dark:text-[#A8A095] pt-2 border-t border-[#C4BBAF] dark:border-[#3E3931]">
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#0F6E6E] dark:text-[#199595]" />
                <span>{item.location}</span>
              </span>
              <span>Logged: {formatDateDDMMYYYY(item.dateLostOrFound)}</span>
            </div>
            {item.status === 'verified' && (
              <button
                type="button"
                onClick={async () => {
                  const ok = await onUpdateItemStatus(item.id, 'returned');
                  if (ok === false) return onErrorNotice('Could not mark handover returned. Check permissions and connection.');
                  onSuccessNotice(`Confirmed physical handover for "${item.title}".`);
                  onRefreshAudit();
                }}
                className="w-full min-h-[44px] bg-[#0F6E6E] hover:bg-[#0C5656] text-white text-sm font-medium rounded-[10px] cursor-pointer"
              >
                Confirm Handover (Mark Returned)
              </button>
            )}
          </div>
        ))}
      </div>
    )}
  </div>
);
