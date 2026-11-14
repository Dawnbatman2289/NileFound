/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * NileFound Operations & Custody Desk
 */

import React, { useState } from 'react';
import { Archive, Download, Check, ShieldCheck, AlertTriangle } from 'lucide-react';
import { CampusItem, ClaimRecord, User } from '../types/index.ts';
import { ITEM_EXPIRY_DAYS } from '../config/catalog.ts';
import type { DemoPersonaOption } from '../data/demoPersonas.ts';
import { useAdminPanel } from '../hooks/useAdminPanel.ts';
import { ADMIN_CARD } from './admin/adminStyles.ts';
import { DeleteConfirmModal } from './admin/DeleteConfirmModal.tsx';
import { ItemDetailModal } from './admin/ItemDetailModal.tsx';
import {
  DeskTab,
  buildDeskKpis,
  RestrictedStaffView,
  AdminTabBar,
  AdminTabContent,
} from './admin/AdminSections.tsx';

interface AdminPanelProps {
  currentUser: User | null;
  items: CampusItem[];
  claims: ClaimRecord[];
  isDemoMode?: boolean;
  lowDataMode?: boolean;
  hasMoreItems?: boolean;
  claimsError?: string | null;
  onRetryClaims?: () => void;
  hasMoreClaims?: boolean;
  isLoadingMoreClaims?: boolean;
  onLoadMoreClaims?: () => Promise<void> | void;
  onFetchClaimPrivateDetails?: (itemId: string, claimId: string) => Promise<void>;
  onFetchFullPhoto?: (itemId: string) => Promise<string | null>;
  onLoadAll?: () => Promise<void>;
  onUpdateItemStatus: (itemId: string, status: CampusItem['status']) => Promise<boolean> | void;
  onDeleteItem: (itemId: string) => Promise<boolean> | void;
  onApproveClaim: (claimId: string, itemId: string) => Promise<boolean> | void;
  onRejectClaim: (claimId: string) => Promise<boolean> | void;
  onExpireOldItems: () => Promise<boolean> | void;
  onNavigateToLogin: () => void;
  onSwitchPersona?: (user: User) => void;
  devPersonas?: DemoPersonaOption[];
}

export const AdminPanel: React.FC<AdminPanelProps> = (props) => {
  const { currentUser, items, claims, onUpdateItemStatus, onDeleteItem, onApproveClaim, onRejectClaim, onExpireOldItems, onNavigateToLogin } = props;
  const [activeTab, setActiveTab] = useState<DeskTab>('claims');
  const isAdmin = currentUser?.role === 'admin' || Boolean(currentUser?.isAdmin);
  const isSecurity = currentUser?.role === 'security';
  const canUsePersonaSimulation = Boolean(import.meta.env.DEV && props.onSwitchPersona && (props.devPersonas?.length ?? 0) > 0);
  const desk = useAdminPanel({
    currentUser,
    items,
    isAdmin,
    isSecurity,
    isDemoMode: Boolean(props.isDemoMode),
    lowDataMode: Boolean(props.lowDataMode),
    hasMoreItems: Boolean(props.hasMoreItems),
    onFetchFullPhoto: props.onFetchFullPhoto,
    onLoadAll: props.onLoadAll,
  });

  if (!(isAdmin || isSecurity || canUsePersonaSimulation) || !currentUser) {
    return <RestrictedStaffView onNavigateToLogin={onNavigateToLogin} />;
  }

  const physicalCustodyItems = items.filter((i) => i.holdingLocation !== 'finder_holding');
  const pendingClaims = claims.filter((c) => c.status === 'pending');
  const kpis = buildDeskKpis(items, claims, physicalCustodyItems.length, pendingClaims.length, desk.serverCounts);
  const roleLabel = desk.isMasterOwner ? 'Master Owner' : isAdmin ? 'Campus Administrator' : 'Security Officer';

  return (
    <div className="space-y-6">
      <div className={`${ADMIN_CARD} p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-5`}>
        <div className="space-y-1.5">
          <span className="inline-flex items-center gap-1 bg-[#E7F3F3] dark:bg-[#0D2D2D] text-[#0F6E6E] dark:text-[#199595] font-semibold text-xs px-2.5 py-0.5 rounded-[10px] border border-[#0F6E6E]/25">
            <ShieldCheck className="w-3.5 h-3.5" />
            {roleLabel}
          </span>
          <h2 className="font-serif text-xl font-bold tracking-tight">NileFound Operations &amp; Custody Desk</h2>
          <p className="text-sm text-[#4A443C] dark:text-[#CEC7BB] max-w-xl leading-relaxed">
            Review ownership claims, track gate custody items, confirm handovers, and manage staff roles.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button type="button" disabled={desk.isExportingCsv} onClick={desk.exportAuditLogCsv} className="flex items-center gap-1.5 bg-white dark:bg-[#28241F] hover:bg-[#FAF6EF] dark:hover:bg-[#332E27] text-[#1F1B16] dark:text-[#F5F1EA] text-sm font-medium px-3.5 py-2 rounded-[10px] border border-[#857C70] dark:border-[#787065] transition-colors min-h-[44px] cursor-pointer btn-campus disabled:opacity-60">
            <Download className="w-4 h-4 text-[#0F6E6E] dark:text-[#199595]" />
            <span>{desk.isExportingCsv ? 'Exporting…' : 'Export CSV'}</span>
          </button>
          <button
            type="button"
            onClick={async () => {
              const ok = await onExpireOldItems();
              if (ok === false) return desk.showError('Could not update expired items. Check your permissions and connection.');
              desk.showNotification(`Evaluated open notices: items older than ${ITEM_EXPIRY_DAYS} days marked expired.`);
              desk.refreshAuditCounts();
            }}
            className="flex items-center gap-1.5 bg-white dark:bg-[#28241F] hover:bg-[#FAF6EF] dark:hover:bg-[#332E27] text-[#4A443C] dark:text-[#CEC7BB] text-sm font-medium px-3.5 py-2 rounded-[10px] border border-[#857C70] dark:border-[#787065] transition-colors min-h-[44px] cursor-pointer btn-campus"
          >
            <Archive className="w-4 h-4 text-[#5C554C] dark:text-[#A8A095]" />
            <span>Auto-Expire (&gt;{ITEM_EXPIRY_DAYS}d)</span>
          </button>
        </div>
      </div>

      {desk.actionNotice && (
        <div role="status" className="bg-[#EDF7F1] dark:bg-[#0E2417] border border-[#2F7D4F]/35 text-[#1B5633] dark:text-[#75CE9A] text-sm p-3.5 rounded-[10px] flex items-center gap-2.5 shadow-xs">
          <Check className="w-4 h-4 text-[#2F7D4F] shrink-0" />
          <span>{desk.actionNotice}</span>
        </div>
      )}

      {desk.actionError && (
        <div role="alert" className="bg-[#FDF2F2] dark:bg-[#2B0E0E] border border-[#F87171]/50 text-[#9B1C1C] dark:text-[#F87171] text-sm p-3.5 rounded-[10px] flex items-center gap-2.5 shadow-xs">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{desk.actionError}</span>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className={`${ADMIN_CARD} p-4 sm:p-5 text-left`}>
            <span className="text-sm font-medium text-[#5C554C] dark:text-[#A8A095]">{kpi.label}</span>
            <div className={`text-2xl sm:text-3xl font-serif font-bold mt-1 ${kpi.color}`}>{kpi.value}</div>
            <span className="text-xs text-[#5C554C] dark:text-[#A8A095] mt-0.5 block">{kpi.sub}</span>
          </div>
        ))}
      </div>

      <AdminTabBar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        pendingCount={pendingClaims.length}
        custodyCount={physicalCustodyItems.length}
        itemsCount={items.length}
        isAdmin={isAdmin}
        canUsePersonaSimulation={canUsePersonaSimulation}
      />

      <DeleteConfirmModal
        pendingDelete={desk.pendingDelete}
        dialogRef={desk.deleteDialogRef}
        onCancel={() => desk.setPendingDelete(null)}
        onConfirmDelete={async (target) => {
          desk.setPendingDelete(null);
          const ok = await onDeleteItem(target.id);
          if (ok === false) return desk.showError(`Could not remove "${target.title}". Check permissions and connection.`);
          desk.setSelectedItem(null);
          desk.showNotification(`Removed item ${target.title}.`);
          desk.refreshAuditCounts();
        }}
      />

      <AdminTabContent
        activeTab={activeTab}
        handlers={props}
        currentUser={currentUser}
        isAdmin={isAdmin}
        isSecurity={isSecurity}
        canUsePersonaSimulation={canUsePersonaSimulation}
        physicalCustodyItems={physicalCustodyItems}
        pendingClaims={pendingClaims}
        desk={desk}
      />

      {desk.selectedItem && (isAdmin || isSecurity) && (
        <ItemDetailModal
          selectedItem={desk.selectedItem}
          claims={claims}
          isAdmin={isAdmin}
          lowDataMode={Boolean(props.lowDataMode)}
          selectedItemPhoto={desk.selectedItemPhoto}
          isLoadingItemPhoto={desk.isLoadingItemPhoto}
          privateDetails={desk.privateDetails}
          isLoadingPrivate={desk.isLoadingPrivate}
          dialogRef={desk.detailDialogRef}
          onClose={() => desk.setSelectedItem(null)}
          onUpdateSelectedItem={desk.setSelectedItem}
          onRequestDelete={desk.setPendingDelete}
          onApproveClaim={onApproveClaim}
          onRejectClaim={onRejectClaim}
          onUpdateItemStatus={onUpdateItemStatus}
          onSuccessNotice={desk.showNotification}
          onErrorNotice={desk.showError}
          onRefreshAudit={desk.refreshAuditCounts}
        />
      )}
    </div>
  );
};
