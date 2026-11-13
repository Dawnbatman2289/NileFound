/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * NileFound Operations & Custody Desk
 * Supports Campus Administrators and Campus Security Officers on claims, custody, inventory, and staff roles.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldAlert, CheckCircle, XCircle, Trash2, Archive, Download, Check,
  ShieldCheck, UserCheck, Plus, RefreshCw, Clock, MapPin, X, Mail, User as UserIcon, Calendar, Tag, AlertTriangle,
} from 'lucide-react';
import { CampusItem, ClaimRecord, User } from '../types/index.ts';
import { generateCampusAuditReport } from '../utils/admin.ts';
import { formatDateDDMMYYYY } from '../utils/dateFormatter.ts';
import { sanitizeCsvCell } from '../utils/csv.ts';
import { isMasterAdminEmail } from '../utils/authValidation.ts';
import type { DemoPersonaOption } from '../data/demoPersonas.ts';
import {
  fetchAllRoles, assignUserRoleByEmail, fetchUsersDirectory,
  UserRoleRecord, fetchItemPrivateDetails, ItemPrivateDetails,
} from '../services/firestoreService.ts';

interface AdminPanelProps {
  currentUser: User | null;
  items: CampusItem[];
  claims: ClaimRecord[];
  hasMoreItems?: boolean;
  onLoadAll?: () => Promise<void>;
  onUpdateItemStatus: (itemId: string, status: CampusItem['status']) => void;
  onDeleteItem: (itemId: string) => void;
  onApproveClaim: (claimId: string, itemId: string) => void;
  onRejectClaim: (claimId: string) => void;
  onExpireOldItems: () => void;
  onNavigateToLogin: () => void;
  onSwitchPersona?: (user: User) => void;
  devPersonas?: DemoPersonaOption[];
}

const CARD = 'bg-white dark:bg-[#1E1C18] text-[#1F1B16] dark:text-[#F5F1EA] rounded-[12px] border border-[#C4BBAF] dark:border-[#3E3931] shadow-xs';
const INPUT =
  'w-full text-base sm:text-sm px-3.5 py-2.5 rounded-[10px] border border-[#A39A8C] dark:border-[#5A5349] bg-white dark:bg-[#141311] text-[#1F1B16] dark:text-[#F5F1EA] placeholder:text-[#5C554C] dark:placeholder:text-[#A8A095] focus:border-[#0F6E6E] min-h-[44px]';

export const AdminPanel: React.FC<AdminPanelProps> = ({
  currentUser,
  items,
  claims,
  hasMoreItems = false,
  onLoadAll,
  onUpdateItemStatus,
  onDeleteItem,
  onApproveClaim,
  onRejectClaim,
  onExpireOldItems,
  onNavigateToLogin,
  onSwitchPersona,
  devPersonas = [],
}) => {
  const [activeTab, setActiveTab] = useState<'claims' | 'custody' | 'all_items' | 'roles' | 'personas'>('claims');
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<CampusItem | null>(null);
  const [pendingDelete, setPendingDelete] = useState<CampusItem | null>(null);
  const [privateDetails, setPrivateDetails] = useState<ItemPrivateDetails>({});
  const [isLoadingPrivate, setIsLoadingPrivate] = useState(false);

  const [roleRecords, setRoleRecords] = useState<UserRoleRecord[]>([]);
  const [userSuggestions, setUserSuggestions] = useState<Array<{ email: string; name: string }>>([]);
  const [isLoadingRoles, setIsLoadingRoles] = useState(false);
  const [rolesError, setRolesError] = useState<string | null>(null);
  const [newTargetEmail, setNewTargetEmail] = useState('');
  const [newTargetRole, setNewTargetRole] = useState<'admin' | 'security'>('security');
  const [isSavingRole, setIsSavingRole] = useState(false);
  const [isExportingCsv, setIsExportingCsv] = useState(false);

  const deleteDialogRef = useRef<HTMLDivElement>(null);
  const detailDialogRef = useRef<HTMLDivElement>(null);

  const isAdmin = currentUser?.role === 'admin' || currentUser?.isAdmin;
  const isSecurity = currentUser?.role === 'security';
  const isMasterOwner = isMasterAdminEmail(currentUser?.email);
  const canUsePersonaSimulation = Boolean(import.meta.env.DEV && onSwitchPersona && devPersonas.length > 0);
  const hasAccess = isAdmin || isSecurity || canUsePersonaSimulation;

  const stats = generateCampusAuditReport(items, claims);
  const physicalCustodyItems = items.filter((i) =>
    i.holdingLocation === 'security_main_gate' || i.holdingLocation === 'student_affairs_office' || i.holdingLocation === 'library_desk'
  );
  const pendingClaims = claims.filter((c) => c.status === 'pending');

  const showNotification = (msg: string) => {
    setActionNotice(msg);
    setTimeout(() => setActionNotice(null), 4000);
  };

  useEffect(() => {
    if (!pendingDelete && !selectedItem) return;
    if (pendingDelete) deleteDialogRef.current?.focus();
    else if (selectedItem) detailDialogRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (pendingDelete) setPendingDelete(null);
        else setSelectedItem(null);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [pendingDelete, selectedItem]);

  useEffect(() => {
    if (!selectedItem) {
      setPrivateDetails({});
      return;
    }
    let cancelled = false;
    setIsLoadingPrivate(true);
    fetchItemPrivateDetails(selectedItem.id)
      .then((d) => { if (!cancelled) setPrivateDetails(d); })
      .catch(() => { if (!cancelled) setPrivateDetails({}); })
      .finally(() => { if (!cancelled) setIsLoadingPrivate(false); });
    return () => { cancelled = true; };
  }, [selectedItem]);

  const loadRoles = async () => {
    setIsLoadingRoles(true);
    setRolesError(null);
    try {
      const [records, directory] = await Promise.all([
        fetchAllRoles(),
        isAdmin ? fetchUsersDirectory().catch(() => []) : Promise.resolve([]),
      ]);
      setRoleRecords(records);
      setUserSuggestions(directory);
    } catch (err: unknown) {
      setRolesError(err instanceof Error ? err.message : 'Could not load staff roles. Check permissions and connection.');
    } finally {
      setIsLoadingRoles(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'roles' && hasAccess) loadRoles();
  }, [activeTab, hasAccess]);

  const handleAssignRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isMasterOwner) return showNotification('Unauthorized: only the project owner can provision new staff roles.');
    const email = newTargetEmail.trim().toLowerCase();
    if (!email) return showNotification('Enter the staff member’s Nile University email.');

    setIsSavingRole(true);
    try {
      const status = await assignUserRoleByEmail(email, newTargetRole, currentUser?.email || 'owner@example.com');
      showNotification(
        status === 'assigned'
          ? `Assigned ${newTargetRole} role to ${email}.`
          : `Saved ${newTargetRole} invite for ${email}. It activates when they verify and sign in.`
      );
      setNewTargetEmail('');
      await loadRoles();
    } catch (err: unknown) {
      showNotification(err instanceof Error ? err.message : 'Could not save role. Check permissions.');
    } finally {
      setIsSavingRole(false);
    }
  };

  const handleRevokeRole = async (email: string) => {
    if (!isMasterOwner || !email) return;
    setIsSavingRole(true);
    try {
      await assignUserRoleByEmail(email, 'student', currentUser?.email || 'owner@example.com');
      showNotification(`Reverted ${email} back to student access.`);
      await loadRoles();
    } catch (err: unknown) {
      showNotification(err instanceof Error ? err.message : 'Could not revoke role.');
    } finally {
      setIsSavingRole(false);
    }
  };

  const exportAuditLogCsv = async () => {
    setIsExportingCsv(true);
    try {
      if (hasMoreItems && onLoadAll) {
        await onLoadAll();
      }
      const headers = ['ID', 'Type', 'Title', 'Category', 'Location', 'Holding Desk', 'Status', 'Date Reported'];
      const rows = items.map((i) => [
        sanitizeCsvCell(i.id),
        sanitizeCsvCell(i.type),
        sanitizeCsvCell(i.title),
        sanitizeCsvCell(i.category),
        sanitizeCsvCell(`${i.location}${i.locationDetails ? ` - ${i.locationDetails}` : ''}`),
        sanitizeCsvCell(i.holdingLocation),
        sanitizeCsvCell(i.status),
        sanitizeCsvCell(formatDateDDMMYYYY(i.dateLostOrFound)),
      ]);
      const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `nilefound_campus_audit_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showNotification(`Exported ${items.length} records to CSV.`);
    } catch {
      showNotification('Could not complete full audit export. Please try again.');
    } finally {
      setIsExportingCsv(false);
    }
  };

  if (!hasAccess || !currentUser) {
    return (
      <div className={`max-w-md mx-auto my-12 p-8 text-center space-y-4 ${CARD}`}>
        <div className="w-12 h-12 rounded-[10px] bg-[#FAF6EF] dark:bg-[#141311] text-[#0F6E6E] dark:text-[#199595] flex items-center justify-center mx-auto border border-[#C4BBAF] dark:border-[#3E3931]">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h3 className="font-serif font-bold text-base tracking-tight">Restricted Staff Area</h3>
          <p className="text-sm text-[#4A443C] dark:text-[#CEC7BB] leading-relaxed">
            This desk is for the project owner and designated Nile University campus security personnel.
          </p>
        </div>
        <button
          type="button"
          onClick={onNavigateToLogin}
          className="bg-[#0F6E6E] text-white text-sm font-semibold px-5 py-2.5 rounded-[10px] hover:bg-[#0C5656] transition-colors min-h-[44px] cursor-pointer btn-campus shadow-xs"
        >
          Sign In with Staff Account
        </button>
      </div>
    );
  }

  const tabClass = (tab: typeof activeTab) =>
    `py-3 px-3.5 font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap min-h-[44px] cursor-pointer text-sm ${
      activeTab === tab
        ? 'border-[#0F6E6E] dark:border-[#199595] text-[#0F6E6E] dark:text-[#199595] font-bold'
        : 'border-transparent text-[#4A443C] dark:text-[#CEC7BB] hover:text-[#1F1B16] dark:hover:text-[#F5F1EA]'
    }`;

  return (
    <div className="space-y-6">
      <div className={`${CARD} p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-5`}>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="bg-[#E7F3F3] dark:bg-[#0D2D2D] text-[#0F6E6E] dark:text-[#199595] font-semibold text-xs px-2.5 py-0.5 rounded-[10px] border border-[#0F6E6E]/25 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              {isAdmin ? 'Campus Administrator' : 'Security Officer'}
            </span>
          </div>
          <h2 className="font-serif text-xl font-bold tracking-tight">NileFound Operations &amp; Custody Desk</h2>
          <p className="text-sm text-[#4A443C] dark:text-[#CEC7BB] max-w-xl leading-relaxed">
            Review ownership claims, track gate custody items, confirm handovers, and manage staff roles.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            disabled={isExportingCsv}
            onClick={exportAuditLogCsv}
            className="flex items-center gap-1.5 bg-white dark:bg-[#28241F] hover:bg-[#FAF6EF] dark:hover:bg-[#332E27] text-[#1F1B16] dark:text-[#F5F1EA] text-sm font-medium px-3.5 py-2 rounded-[10px] border border-[#A39A8C] dark:border-[#5A5349] transition-colors min-h-[44px] cursor-pointer btn-campus disabled:opacity-60"
          >
            <Download className="w-4 h-4 text-[#0F6E6E] dark:text-[#199595]" />
            <span>{isExportingCsv ? 'Exporting…' : 'Export CSV'}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              onExpireOldItems();
              showNotification('Evaluated loaded items: unclaimed notices older than 60 days marked expired.');
            }}
            className="flex items-center gap-1.5 bg-white dark:bg-[#28241F] hover:bg-[#FAF6EF] dark:hover:bg-[#332E27] text-[#4A443C] dark:text-[#CEC7BB] text-sm font-medium px-3.5 py-2 rounded-[10px] border border-[#A39A8C] dark:border-[#5A5349] transition-colors min-h-[44px] cursor-pointer btn-campus"
          >
            <Archive className="w-4 h-4 text-[#5C554C] dark:text-[#A8A095]" />
            <span>Auto-Expire (&gt;60d)</span>
          </button>
        </div>
      </div>

      {actionNotice && (
        <div role="status" className="bg-[#EDF7F1] dark:bg-[#0E2417] border border-[#2F7D4F]/35 text-[#1B5633] dark:text-[#75CE9A] text-sm p-3.5 rounded-[10px] flex items-center gap-2.5 shadow-xs">
          <Check className="w-4 h-4 text-[#2F7D4F] shrink-0" />
          <span>{actionNotice}</span>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Pending Claims', value: pendingClaims.length, color: 'text-[#7A5000] dark:text-[#F9CF7C]', sub: pendingClaims.length === 0 ? 'Queue clear' : 'Awaiting review' },
          { label: 'Physical Custody', value: physicalCustodyItems.length, color: 'text-[#0F6E6E] dark:text-[#199595]', sub: 'At Gate & Desks' },
          { label: 'Reunited Items', value: stats.totalReturned, color: 'text-[#2F7D4F] dark:text-[#75CE9A]', sub: `${stats.returnRate}% of found returned` },
          { label: 'Total Tracked', value: items.length, color: 'text-[#1F1B16] dark:text-[#F5F1EA]', sub: 'Loaded campus notices' },
        ].map((kpi) => (
          <div key={kpi.label} className={`${CARD} p-4 sm:p-5 text-left`}>
            <span className="text-sm font-medium text-[#5C554C] dark:text-[#A8A095]">{kpi.label}</span>
            <div className={`text-2xl sm:text-3xl font-serif font-bold mt-1 ${kpi.color}`}>{kpi.value}</div>
            <span className="text-xs text-[#5C554C] dark:text-[#A8A095] mt-0.5 block">{kpi.sub}</span>
          </div>
        ))}
      </div>

      <div className="flex border-b border-[#C4BBAF] dark:border-[#3E3931] gap-2 overflow-x-auto scrollbar-none">
        <button type="button" onClick={() => setActiveTab('claims')} className={tabClass('claims')}>
          <span>Claim Requests</span>
          <span className="bg-[#FEF7E9] dark:bg-[#2B210A] text-[#7A5000] dark:text-[#F9CF7C] text-xs px-2 py-0.5 rounded-full font-bold">
            {pendingClaims.length}
          </span>
        </button>
        <button type="button" onClick={() => setActiveTab('custody')} className={tabClass('custody')}>
          <span>Custody Ledger</span>
          <span className="bg-[#FAF6EF] dark:bg-[#28241F] border border-[#C4BBAF] dark:border-[#3E3931] text-[#4A443C] dark:text-[#CEC7BB] text-xs px-2 py-0.5 rounded-full font-medium">
            {physicalCustodyItems.length}
          </span>
        </button>
        <button type="button" onClick={() => setActiveTab('all_items')} className={tabClass('all_items')}>
          <span>All Campus Items ({items.length})</span>
        </button>
        <button type="button" onClick={() => setActiveTab('roles')} className={tabClass('roles')}>
          <UserCheck className="w-4 h-4 text-[#0F6E6E] dark:text-[#199595]" />
          <span>Staff Roles</span>
        </button>
        {canUsePersonaSimulation && (
          <button type="button" onClick={() => setActiveTab('personas')} className={tabClass('personas')}>
            <ShieldCheck className="w-4 h-4 text-[#0F6E6E] dark:text-[#199595]" />
            <span>Test Personas</span>
          </button>
        )}
      </div>

      {pendingDelete && (
        <div
          className="fixed inset-0 z-50 bg-black/55 flex items-center justify-center p-3"
          onClick={() => setPendingDelete(null)}
        >
          <div
            ref={deleteDialogRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-title"
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-[480px] p-5 shadow-xl outline-none ${CARD}`}
          >
            <h2 id="delete-title" className="text-base font-bold">Delete this item?</h2>
            <p className="mt-2 text-sm text-[#4A443C] dark:text-[#CEC7BB]">This permanently removes “{pendingDelete.title}” and its claims.</p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                className="min-h-[44px] rounded-[10px] border border-[#A39A8C] dark:border-[#5A5349] px-4 text-sm cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteItem(pendingDelete.id);
                  showNotification(`Removed item ${pendingDelete.title}.`);
                  setPendingDelete(null);
                  setSelectedItem(null);
                }}
                className="min-h-[44px] rounded-[10px] bg-[#9B1C1C] px-4 text-sm font-medium text-white cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'claims' && (
        <div className="space-y-4">
          {pendingClaims.length === 0 ? (
            <div className={`${CARD} p-10 text-center space-y-2`}>
              <CheckCircle className="w-10 h-10 text-[#0F6E6E] dark:text-[#199595] mx-auto" />
              <h4 className="font-serif font-bold text-base">No pending claims</h4>
              <p className="text-sm text-[#5C554C] dark:text-[#A8A095]">All submitted claims have been processed.</p>
            </div>
          ) : (
            pendingClaims.map((claim) => {
              const matchedItem = items.find((i) => i.id === claim.itemId);
              return (
                <div key={claim.id} className={`${CARD} p-5 space-y-4 hover:border-[#0F6E6E]/40 transition-colors`}>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#C4BBAF] dark:border-[#3E3931] pb-4">
                    <div>
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="font-serif font-bold text-base">{claim.itemTitle}</span>
                        <span className="text-xs font-mono font-bold uppercase bg-[#FEF7E9] dark:bg-[#2B210A] text-[#7A5000] dark:text-[#F9CF7C] border border-[#E8A317]/30 px-2 py-0.5 rounded-full">
                          Pending Review
                        </span>
                      </div>
                      <p className="text-sm text-[#4A443C] dark:text-[#CEC7BB] mt-1">
                        Claimed by <strong className="text-[#1F1B16] dark:text-[#F5F1EA]">{claim.claimantName}</strong> ({claim.claimantEmail}) on {formatDateDDMMYYYY(claim.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          onApproveClaim(claim.id, claim.itemId);
                          showNotification(`Verified claim for ${claim.claimantName}. Confirm handover when picked up.`);
                        }}
                        className="flex items-center gap-2 bg-[#0F6E6E] hover:bg-[#0C5656] text-white text-sm font-semibold px-4 py-2.5 rounded-[10px] transition-colors min-h-[44px] cursor-pointer btn-campus"
                      >
                        <CheckCircle className="w-4 h-4" />
                        <span>Approve for Handover</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onRejectClaim(claim.id);
                          showNotification(`Rejected claim from ${claim.claimantName}.`);
                        }}
                        className="flex items-center gap-2 bg-white dark:bg-[#28241F] hover:bg-[#FDF2F2] dark:hover:bg-[#2B0E0E] text-[#9B1C1C] dark:text-[#F87171] text-sm font-semibold px-4 py-2.5 rounded-[10px] border border-[#F87171]/50 transition-colors min-h-[44px] cursor-pointer btn-campus"
                      >
                        <XCircle className="w-4 h-4" />
                        <span>Reject</span>
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm bg-[#FAF6EF] dark:bg-[#141311] p-4 rounded-[10px] border border-[#C4BBAF] dark:border-[#3E3931]">
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
                    <div>
                      <span className="font-bold text-[#5C554C] dark:text-[#A8A095] block mb-1.5 uppercase tracking-wider text-xs">
                        Claimant Submitted Answer
                      </span>
                      <p className="bg-white dark:bg-[#1E1C18] p-3 rounded-[10px] border border-[#C4BBAF] dark:border-[#3E3931] font-mono text-sm leading-relaxed">
                        {claim.submittedAnswer || 'No verification answer provided.'}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {activeTab === 'custody' && (
        <div className="space-y-4">
          <div className={`${CARD} p-5 flex items-center justify-between gap-3`}>
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
            <div className={`${CARD} p-10 text-center space-y-2`}>
              <MapPin className="w-9 h-9 text-[#0F6E6E] dark:text-[#199595] mx-auto" />
              <h4 className="font-serif font-bold text-base">No items held at campus desks</h4>
              <p className="text-sm text-[#5C554C] dark:text-[#A8A095]">Found items handed to Security Gate, Library, or Student Affairs appear here.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {physicalCustodyItems.map((item) => (
                <div key={item.id} className={`${CARD} p-5 space-y-3 hover:border-[#0F6E6E]/40 transition-colors`}>
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
                      onClick={() => {
                        onUpdateItemStatus(item.id, 'returned');
                        showNotification(`Confirmed physical handover for "${item.title}".`);
                      }}
                      className="w-full min-h-[44px] bg-[#2F7D4F] hover:bg-[#266841] text-white text-sm font-medium rounded-[10px] cursor-pointer"
                    >
                      Confirm Handover (Mark Returned)
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'all_items' && (
        <div className={`${CARD} overflow-hidden`}>
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
                  onClick={() => (isAdmin || isSecurity) && setSelectedItem(item)}
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
                      onChange={(e) => onUpdateItemStatus(item.id, e.target.value as CampusItem['status'])}
                      className="flex-1 sm:flex-initial bg-white dark:bg-[#141311] text-[#1F1B16] dark:text-[#F5F1EA] border border-[#A39A8C] dark:border-[#5A5349] rounded-[10px] px-3 py-2 text-base sm:text-sm focus:border-[#0F6E6E] min-h-[44px] cursor-pointer"
                    >
                      <option value="open">Open</option>
                      <option value="claim_requested">Claim Pending</option>
                      <option value="verified">Verified (Handover Pending)</option>
                      <option value="returned">Returned / Reunited</option>
                      <option value="expired">Expired</option>
                    </select>

                    <button
                      type="button"
                      onClick={() => setPendingDelete(item)}
                      className="text-[#5C554C] dark:text-[#A8A095] hover:text-[#9B1C1C] dark:hover:text-[#F87171] p-2 min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors cursor-pointer"
                      title="Delete item"
                      aria-label={`Delete ${item.title}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === 'roles' && (
        <div className="space-y-6">
          {isMasterOwner ? (
            <div className={`${CARD} p-6 space-y-4`}>
              <div>
                <h3 className="font-serif font-bold text-base">Provision Staff or Security Role</h3>
                <p className="text-sm text-[#4A443C] dark:text-[#CEC7BB] mt-1 leading-relaxed">
                  Enter a staff member’s verified Nile University email. Invites bind to their verified auth token on sign-in.
                </p>
              </div>

              <form onSubmit={handleAssignRole} className="grid grid-cols-1 md:grid-cols-[1fr_220px_auto] gap-3.5 items-end">
                <div>
                  <label htmlFor="staff-email-input" className="block text-sm font-medium text-[#4A443C] dark:text-[#CEC7BB] mb-1.5">
                    Email Address
                  </label>
                  <input
                    id="staff-email-input"
                    type="email"
                    list="campus-user-emails"
                    required
                    placeholder="officer@nileuniversity.edu.ng"
                    value={newTargetEmail}
                    onChange={(e) => setNewTargetEmail(e.target.value)}
                    className={INPUT}
                  />
                  <datalist id="campus-user-emails">
                    {userSuggestions.map((u) => (
                      <option key={u.email} value={u.email}>{u.name}</option>
                    ))}
                  </datalist>
                </div>

                <div>
                  <label htmlFor="staff-role-select" className="block text-sm font-medium text-[#4A443C] dark:text-[#CEC7BB] mb-1.5">
                    Role
                  </label>
                  <select
                    id="staff-role-select"
                    value={newTargetRole}
                    onChange={(e) => setNewTargetRole(e.target.value as 'admin' | 'security')}
                    className={`${INPUT} cursor-pointer`}
                  >
                    <option value="security">Campus Security Officer</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={isSavingRole}
                  className="min-h-[44px] bg-[#0F6E6E] hover:bg-[#0C5656] disabled:opacity-50 text-white font-semibold text-sm py-2.5 px-5 rounded-[10px] transition-colors flex items-center justify-center gap-2 cursor-pointer btn-campus"
                >
                  <Plus className="w-4 h-4" />
                  <span>{isSavingRole ? 'Saving...' : 'Assign Role'}</span>
                </button>
              </form>
            </div>
          ) : (
            <div className="bg-[#FEF7E9] dark:bg-[#2B210A] border border-[#E8A317]/40 text-[#7A5000] dark:text-[#F9CF7C] p-5 rounded-[12px] text-sm">
              <span className="font-bold">Role Provisioning Restricted:</span> Only the project owner is authorized to assign or revoke staff roles.
            </div>
          )}

          {rolesError && (
            <div role="alert" className="bg-[#FDF2F2] dark:bg-[#2B0E0E] border border-[#F87171]/50 text-[#9B1C1C] dark:text-[#F87171] p-4 rounded-[12px] text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{rolesError}</span>
            </div>
          )}

          <div className={`${CARD} overflow-hidden`}>
            <div className="p-5 border-b border-[#C4BBAF] dark:border-[#3E3931] flex items-center justify-between">
              <div>
                <h4 className="font-serif font-bold text-sm">Active System Roles</h4>
                <p className="text-xs text-[#5C554C] dark:text-[#A8A095] mt-0.5">Persisted in Cloud Firestore security rules</p>
              </div>
              <button
                type="button"
                onClick={loadRoles}
                className="text-sm text-[#0F6E6E] dark:text-[#199595] font-semibold hover:underline flex items-center gap-1.5 min-h-[44px] px-3 cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${isLoadingRoles ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>

            <div className="divide-y divide-[#C4BBAF] dark:divide-[#3E3931] text-sm">
              <div className="p-4 sm:p-5 flex items-center justify-between bg-[#FAF6EF]/60 dark:bg-[#141311]/60">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#0F6E6E] text-white font-bold flex items-center justify-center text-xs">A</div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold">Ayomide (System Lead)</span>
                      <span className="bg-[#E7F3F3] dark:bg-[#0D2D2D] text-[#0F6E6E] dark:text-[#199595] border border-[#0F6E6E]/30 text-xs font-mono font-bold px-2 py-0.5 rounded-full uppercase">
                        Master Admin
                      </span>
                    </div>
                    <p className="text-xs text-[#5C554C] dark:text-[#A8A095] font-mono mt-0.5">Project owner</p>
                  </div>
                </div>
                <span className="text-xs text-[#0F6E6E] dark:text-[#199595] font-mono font-semibold">Active &amp; Root</span>
              </div>

              {roleRecords.length === 0 ? (
                <div className="p-6 text-center text-[#5C554C] dark:text-[#A8A095]">No additional staff roles provisioned yet.</div>
              ) : (
                roleRecords.map((r) => (
                  <div key={r.uid} className="p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3 hover:bg-[#FAF6EF]/40 dark:hover:bg-[#141311]/40 transition-colors">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">{r.email || 'Campus Staff'}</span>
                        <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full uppercase bg-[#FAF6EF] dark:bg-[#141311] text-[#4A443C] dark:text-[#CEC7BB] border border-[#C4BBAF] dark:border-[#3E3931]">
                          {r.role}
                        </span>
                        {r.pending && (
                          <span className="text-xs text-[#7A5000] dark:text-[#F9CF7C] bg-[#FEF7E9] dark:bg-[#2B210A] px-2 py-0.5 rounded-full">
                            Pending first sign-in
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-[#5C554C] dark:text-[#A8A095]">Assigned by {r.assignedBy || 'Admin'}</span>
                      {isMasterOwner && r.email && !isMasterAdminEmail(r.email) && (
                        <button
                          type="button"
                          disabled={isSavingRole}
                          onClick={() => handleRevokeRole(r.email)}
                          className="min-h-[44px] px-3 rounded-[10px] border border-[#F87171]/50 text-[#9B1C1C] dark:text-[#F87171] text-xs font-medium cursor-pointer"
                        >
                          Revoke
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'personas' && canUsePersonaSimulation && (
        <div className="space-y-6">
          <div className={`${CARD} p-6 space-y-2`}>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h3 className="font-serif font-bold text-base flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#0F6E6E] dark:text-[#199595]" />
                Development Persona Switcher
              </h3>
              <span className="text-xs bg-[#E7F3F3] dark:bg-[#0D2D2D] text-[#0F6E6E] dark:text-[#199595] border border-[#0F6E6E]/30 font-mono font-bold px-2.5 py-0.5 rounded-full">
                Dev mode only
              </span>
            </div>
            <p className="text-sm text-[#4A443C] dark:text-[#CEC7BB] leading-relaxed">
              Preview the interface locally as a student, security officer, or administrator. Disabled in production builds.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {devPersonas.map((persona) => (
              <div key={persona.user.id} className={`${CARD} p-5 space-y-4 hover:border-[#0F6E6E]/40 transition-colors flex flex-col justify-between`}>
                <div className="space-y-2.5 min-w-0">
                  <div className={`w-10 h-10 rounded-[10px] flex items-center justify-center font-bold text-sm border ${persona.badgeClass}`}>
                    {persona.initial}
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-serif font-bold text-sm">{persona.user.name.replace(/ \(.*\)$/, '')}</h4>
                    <span className="text-xs font-mono font-bold uppercase text-[#0F6E6E] dark:text-[#199595]">{persona.badge}</span>
                    <p className="text-xs text-[#5C554C] dark:text-[#A8A095] font-mono truncate">{persona.user.email}</p>
                  </div>
                  <p className="text-sm text-[#4A443C] dark:text-[#CEC7BB] leading-relaxed">{persona.description}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onSwitchPersona?.(persona.user);
                    showNotification(`Switched persona to ${persona.user.name}.`);
                  }}
                  className="w-full py-2.5 px-4 bg-[#FAF6EF] dark:bg-[#28241F] hover:bg-[#E7F3F3] dark:hover:bg-[#332E27] text-[#1F1B16] dark:text-[#F5F1EA] rounded-[10px] text-sm font-semibold border border-[#A39A8C] dark:border-[#5A5349] transition-colors cursor-pointer min-h-[44px] btn-campus"
                >
                  {persona.buttonLabel}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedItem && (isAdmin || isSecurity) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/55 overflow-y-auto" onClick={() => setSelectedItem(null)}>
          <div
            ref={detailDialogRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-item-modal-title"
            className={`w-full max-w-[672px] shadow-xl max-h-[90dvh] overflow-hidden flex flex-col min-w-0 outline-none ${CARD}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-[#FAF6EF] dark:bg-[#141311] px-5 sm:px-6 py-4 border-b border-[#C4BBAF] dark:border-[#3E3931] flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className={selectedItem.type === 'found' ? 'stamp-found' : 'stamp-lost'}>{selectedItem.type}</span>
                <h3 id="admin-item-modal-title" className="font-serif font-bold text-base truncate">{selectedItem.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="text-[#5C554C] dark:text-[#A8A095] hover:text-[#1F1B16] dark:hover:text-[#F5F1EA] p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-[10px] cursor-pointer"
                aria-label="Close item details"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 sm:p-6 space-y-4 min-h-0 flex-1 overflow-y-auto text-sm">
              {selectedItem.imageUrl && (
                <div className="rounded-[10px] overflow-hidden bg-[#FAF6EF] dark:bg-[#141311] border border-[#C4BBAF] dark:border-[#3E3931]">
                  <img src={selectedItem.imageUrl} alt={selectedItem.title} className="w-full max-h-96 object-contain mx-auto" loading="lazy" decoding="async" width={640} height={360} />
                </div>
              )}

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
                <h4 className="font-serif font-bold text-sm">
                  Ownership Claims ({claims.filter((c) => c.itemId === selectedItem.id).length})
                </h4>
                {claims.filter((c) => c.itemId === selectedItem.id).length === 0 ? (
                  <p className="text-[#5C554C] dark:text-[#A8A095] bg-[#FAF6EF] dark:bg-[#141311] border border-[#C4BBAF] dark:border-[#3E3931] rounded-[10px] p-3.5">
                    No claims submitted for this item yet.
                  </p>
                ) : (
                  claims
                    .filter((c) => c.itemId === selectedItem.id)
                    .map((claim) => (
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
                              onClick={() => {
                                onApproveClaim(claim.id, selectedItem.id);
                                showNotification(`Verified claim for ${selectedItem.title}.`);
                              }}
                              className="bg-[#2F7D4F] hover:bg-[#266841] text-white font-medium px-3 py-2 min-h-[44px] rounded-[10px] text-sm cursor-pointer btn-campus shadow-xs"
                            >
                              Approve for Handover
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                onRejectClaim(claim.id);
                                showNotification('Rejected claim.');
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
                onClick={() => {
                  onUpdateItemStatus(selectedItem.id, 'returned');
                  setSelectedItem({ ...selectedItem, status: 'returned' });
                  showNotification(`Confirmed handover and marked "${selectedItem.title}" as Returned.`);
                }}
                disabled={selectedItem.status === 'returned'}
                className="bg-[#2F7D4F] hover:bg-[#266841] disabled:opacity-50 text-white font-medium px-4 py-2.5 rounded-[10px] text-sm flex items-center gap-2 cursor-pointer min-h-[44px] btn-campus shadow-xs"
              >
                <CheckCircle className="w-4 h-4" />
                <span>{selectedItem.status === 'returned' ? 'Returned' : 'Confirm Handover (Mark Returned)'}</span>
              </button>
              <button
                type="button"
                onClick={() => setPendingDelete(selectedItem)}
                className="bg-white dark:bg-[#28241F] hover:bg-rose-50 dark:hover:bg-rose-950/20 text-[#9B1C1C] dark:text-[#F87171] border border-[#F87171]/50 font-medium px-4 py-2.5 rounded-[10px] text-sm flex items-center gap-2 cursor-pointer min-h-[44px] btn-campus"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
