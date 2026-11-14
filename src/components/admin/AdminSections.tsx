import React, { lazy, Suspense } from 'react';
import { ShieldAlert, ShieldCheck, UserCheck } from 'lucide-react';
import { CampusItem, ClaimRecord, User } from '../../types/index.ts';
import { generateCampusAuditReport } from '../../utils/admin.ts';
import type { DemoPersonaOption } from '../../data/demoPersonas.ts';
import type { useAdminPanel } from '../../hooks/useAdminPanel.ts';
import { ADMIN_CARD } from './adminStyles.ts';

const ClaimsTab = lazy(() => import('./ClaimsTab.tsx').then((m) => ({ default: m.ClaimsTab })));
const CustodyTab = lazy(() => import('./CustodyTab.tsx').then((m) => ({ default: m.CustodyTab })));
const AllItemsTab = lazy(() => import('./AllItemsTab.tsx').then((m) => ({ default: m.AllItemsTab })));
const RolesTab = lazy(() => import('./RolesTab.tsx').then((m) => ({ default: m.RolesTab })));
const PersonasTab = lazy(() => import('./PersonasTab.tsx').then((m) => ({ default: m.PersonasTab })));

export type DeskTab = 'claims' | 'custody' | 'all_items' | 'roles' | 'personas';

export interface ServerCounts {
  pendingClaimsCount: number;
  custodyCount: number;
  totalReturned: number;
  totalFound: number;
  foundReturned: number;
  totalItems: number;
}

export interface AdminTabHandlers {
  items: CampusItem[];
  isDemoMode?: boolean;
  claimsError?: string | null;
  onRetryClaims?: () => void;
  hasMoreClaims?: boolean;
  isLoadingMoreClaims?: boolean;
  onLoadMoreClaims?: () => Promise<void> | void;
  onFetchClaimPrivateDetails?: (itemId: string, claimId: string) => Promise<void>;
  onUpdateItemStatus: (itemId: string, status: CampusItem['status']) => Promise<boolean> | void;
  onApproveClaim: (claimId: string, itemId: string) => Promise<boolean> | void;
  onRejectClaim: (claimId: string) => Promise<boolean> | void;
  onSwitchPersona?: (user: User) => void;
  devPersonas?: DemoPersonaOption[];
}

export function buildDeskKpis(
  items: CampusItem[],
  claims: ClaimRecord[],
  custodyLen: number,
  pendingLen: number,
  sc: ServerCounts | null
) {
  const stats = generateCampusAuditReport(items, claims);
  const pendingTotal = sc ? sc.pendingClaimsCount : pendingLen;
  const custodyTotal = sc ? sc.custodyCount : custodyLen;
  const returnedTotal = sc ? sc.totalReturned : stats.totalReturned;
  const totalTracked = sc ? sc.totalItems : items.length;
  const returnRate = sc
    ? (sc.totalFound > 0 ? Math.min(100, Math.round((sc.foundReturned / sc.totalFound) * 100)) : 0)
    : stats.returnRate;

  return [
    { label: 'Pending Claims', value: pendingTotal, color: 'text-[#7A5000] dark:text-[#F9CF7C]', sub: pendingTotal === 0 ? 'Queue clear' : 'Awaiting review' },
    { label: 'Physical Custody', value: custodyTotal, color: 'text-[#0F6E6E] dark:text-[#199595]', sub: 'At Gate & Desks' },
    { label: 'Reunited Items', value: returnedTotal, color: 'text-[#2F7D4F] dark:text-[#75CE9A]', sub: `${returnRate}% of found returned` },
    { label: 'Total Tracked', value: totalTracked, color: 'text-[#1F1B16] dark:text-[#F5F1EA]', sub: sc ? 'Campus notices' : 'Loaded notices' },
  ];
}

export const RestrictedStaffView: React.FC<{ onNavigateToLogin: () => void }> = ({ onNavigateToLogin }) => (
  <div className={`max-w-md mx-auto my-12 p-8 text-center space-y-4 ${ADMIN_CARD}`}>
    <div className="w-12 h-12 rounded-[10px] bg-[#FAF6EF] dark:bg-[#141311] text-[#0F6E6E] dark:text-[#199595] flex items-center justify-center mx-auto border border-[#C4BBAF] dark:border-[#3E3931]">
      <ShieldAlert className="w-6 h-6" />
    </div>
    <div className="space-y-1">
      <h3 className="font-serif font-bold text-base tracking-tight">Restricted Staff Area</h3>
      <p className="text-sm text-[#4A443C] dark:text-[#CEC7BB] leading-relaxed">
        This desk is for the project owner and designated Nile University campus security personnel.
      </p>
    </div>
    <button type="button" onClick={onNavigateToLogin} className="bg-[#0F6E6E] text-white text-sm font-semibold px-5 py-2.5 rounded-[10px] hover:bg-[#0C5656] transition-colors min-h-[44px] cursor-pointer btn-campus shadow-xs">
      Sign In with Staff Account
    </button>
  </div>
);

const TAB_BASE = 'py-3 px-3.5 font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap min-h-[44px] cursor-pointer text-sm';
const TAB_ACTIVE = 'border-[#0F6E6E] dark:border-[#199595] text-[#0F6E6E] dark:text-[#199595] font-bold';
const TAB_IDLE = 'border-transparent text-[#4A443C] dark:text-[#CEC7BB] hover:text-[#1F1B16] dark:hover:text-[#F5F1EA]';

export const AdminTabBar: React.FC<{
  activeTab: DeskTab;
  onSelectTab: (tab: DeskTab) => void;
  pendingCount: number;
  custodyCount: number;
  itemsCount: number;
  isAdmin: boolean;
  canUsePersonaSimulation: boolean;
}> = ({ activeTab, onSelectTab, pendingCount, custodyCount, itemsCount, isAdmin, canUsePersonaSimulation }) => {
  const tabClass = (tab: DeskTab) => `${TAB_BASE} ${activeTab === tab ? TAB_ACTIVE : TAB_IDLE}`;
  return (
    <div className="flex border-b border-[#C4BBAF] dark:border-[#3E3931] gap-2 overflow-x-auto scrollbar-none">
      <button type="button" onClick={() => onSelectTab('claims')} className={tabClass('claims')}>
        <span>Claim Requests</span>
        <span className="bg-[#FEF7E9] dark:bg-[#2B210A] text-[#7A5000] dark:text-[#F9CF7C] text-xs px-2 py-0.5 rounded-full font-bold">{pendingCount}</span>
      </button>
      <button type="button" onClick={() => onSelectTab('custody')} className={tabClass('custody')}>
        <span>Custody Ledger</span>
        <span className="bg-[#FAF6EF] dark:bg-[#28241F] border border-[#C4BBAF] dark:border-[#3E3931] text-[#4A443C] dark:text-[#CEC7BB] text-xs px-2 py-0.5 rounded-full font-medium">{custodyCount}</span>
      </button>
      <button type="button" onClick={() => onSelectTab('all_items')} className={tabClass('all_items')}>
        <span>All Campus Items ({itemsCount})</span>
      </button>
      {isAdmin && (
        <button type="button" onClick={() => onSelectTab('roles')} className={tabClass('roles')}>
          <UserCheck className="w-4 h-4 text-[#0F6E6E] dark:text-[#199595]" />
          <span>Staff Roles</span>
        </button>
      )}
      {canUsePersonaSimulation && (
        <button type="button" onClick={() => onSelectTab('personas')} className={tabClass('personas')}>
          <ShieldCheck className="w-4 h-4 text-[#0F6E6E] dark:text-[#199595]" />
          <span>Test Personas</span>
        </button>
      )}
    </div>
  );
};

export const AdminTabContent: React.FC<{
  activeTab: DeskTab;
  handlers: AdminTabHandlers;
  currentUser: User;
  isAdmin: boolean;
  isSecurity: boolean;
  canUsePersonaSimulation: boolean;
  physicalCustodyItems: CampusItem[];
  pendingClaims: ClaimRecord[];
  desk: ReturnType<typeof useAdminPanel>;
}> = ({
  activeTab, handlers, currentUser, isAdmin, isSecurity, canUsePersonaSimulation,
  physicalCustodyItems, pendingClaims, desk,
}) => (
  <Suspense fallback={<div className="p-6 text-sm text-[#5C554C] dark:text-[#A8A095]">Loading desk section…</div>}>
    {activeTab === 'claims' && (
      <ClaimsTab
        pendingClaims={pendingClaims}
        items={handlers.items}
        isAdmin={isAdmin}
        isDemoMode={Boolean(handlers.isDemoMode)}
        claimsError={handlers.claimsError ?? null}
        onRetryClaims={handlers.onRetryClaims}
        hasMoreClaims={Boolean(handlers.hasMoreClaims)}
        isLoadingMoreClaims={Boolean(handlers.isLoadingMoreClaims)}
        onLoadMoreClaims={handlers.onLoadMoreClaims}
        onFetchClaimPrivateDetails={handlers.onFetchClaimPrivateDetails}
        onApproveClaim={handlers.onApproveClaim}
        onRejectClaim={handlers.onRejectClaim}
        onSuccessNotice={desk.showNotification}
        onErrorNotice={desk.showError}
        onRefreshAudit={desk.refreshAuditCounts}
      />
    )}
    {activeTab === 'custody' && (
      <CustodyTab
        physicalCustodyItems={physicalCustodyItems}
        onUpdateItemStatus={handlers.onUpdateItemStatus}
        onSuccessNotice={desk.showNotification}
        onErrorNotice={desk.showError}
        onRefreshAudit={desk.refreshAuditCounts}
      />
    )}
    {activeTab === 'all_items' && (
      <AllItemsTab
        items={handlers.items}
        isAdmin={isAdmin}
        canInspect={isAdmin || isSecurity}
        onSelectItem={desk.setSelectedItem}
        onRequestDelete={desk.setPendingDelete}
        onUpdateItemStatus={handlers.onUpdateItemStatus}
        onSuccessNotice={desk.showNotification}
        onErrorNotice={desk.showError}
        onRefreshAudit={desk.refreshAuditCounts}
      />
    )}
    {activeTab === 'roles' && isAdmin && (
      <RolesTab
        currentUserId={currentUser.id}
        currentUserEmail={currentUser.email}
        isAdmin={isAdmin}
        isMasterOwner={desk.isMasterOwner}
        onSuccessNotice={desk.showNotification}
      />
    )}
    {activeTab === 'personas' && canUsePersonaSimulation && (
      <PersonasTab
        devPersonas={handlers.devPersonas ?? []}
        onSwitchPersona={handlers.onSwitchPersona}
        onSuccessNotice={desk.showNotification}
      />
    )}
  </Suspense>
);
