/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * NileFound Admin Panel - Restricted to authorized project administrators.
 * Layout: Primary administrator dashboard in Deep Navy (#FAF6EF), Muted Cards (#1E1C18), and Electric Lime (#0F6E6E).
 * Main Action: Review verification answers, approve/reject claims, audit physical custody at university gates, and manage campus roles.
 */

import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  CheckCircle, 
  XCircle, 
  Trash2, 
  Archive, 
  Download, 
  Check, 
  KeyRound,
  ShieldCheck,
  UserCheck,
  Plus,
  RefreshCw,
  Clock,
  MapPin,
  HelpCircle,
  X,
  Mail,
  User as UserIcon,
  Calendar,
  Tag
} from 'lucide-react';
import { CampusItem, ClaimRecord, User } from '../types/index.ts';
import { generateCampusAuditReport } from '../utils/admin.ts';
import { formatDateDDMMYYYY } from '../utils/dateFormatter.ts';
import { sanitizeCsvCell } from '../utils/csv.ts';
import { 
  fetchAllRoles, 
  assignUserRole, 
  UserRoleRecord,
  fetchItemPrivateDetails,
  ItemPrivateDetails
} from '../services/firestoreService.ts';
import { PROJECT_OWNER_UID } from '../config/admin.ts';

interface AdminPanelProps {
  currentUser: User | null;
  items: CampusItem[];
  claims: ClaimRecord[];
  onUpdateItemStatus: (itemId: string, status: CampusItem['status']) => void;
  onDeleteItem: (itemId: string) => void;
  onApproveClaim: (claimId: string, itemId: string) => void;
  onRejectClaim: (claimId: string) => void;
  onExpireOldItems: () => void;
  onNavigateToLogin: () => void;
  onSwitchPersona?: (user: User) => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  currentUser,
  items,
  claims,
  onUpdateItemStatus,
  onDeleteItem,
  onApproveClaim,
  onRejectClaim,
  onExpireOldItems,
  onNavigateToLogin,
  onSwitchPersona
}) => {
  const [activeTab, setActiveTab] = useState<'claims' | 'custody' | 'all_items' | 'roles' | 'personas'>('claims');
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [selectedItemForDetail, setSelectedItemForDetail] = useState<CampusItem | null>(null);
  const [pendingDelete, setPendingDelete] = useState<CampusItem | null>(null);
  const [privateDetails, setPrivateDetails] = useState<ItemPrivateDetails>({});
  const [isLoadingPrivate, setIsLoadingPrivate] = useState(false);

  useEffect(() => {
    if (!selectedItemForDetail) {
      setPrivateDetails({});
      return;
    }
    let cancelled = false;
    setIsLoadingPrivate(true);
    fetchItemPrivateDetails(selectedItemForDetail.id)
      .then((details) => {
        if (!cancelled) setPrivateDetails(details);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingPrivate(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedItemForDetail]);

  // Role management state
  const [roleRecords, setRoleRecords] = useState<UserRoleRecord[]>([]);
  const [isLoadingRoles, setIsLoadingRoles] = useState(false);
  const [newTargetUid, setNewTargetUid] = useState('');
  const [newTargetEmail, setNewTargetEmail] = useState('');
  const [newTargetRole, setNewTargetRole] = useState<'admin' | 'security'>('security');
  const [isSavingRole, setIsSavingRole] = useState(false);

  const isOwner = currentUser?.id === PROJECT_OWNER_UID;
  const isAdmin = currentUser?.role === 'admin' || currentUser?.isAdmin || isOwner;
  const isSecurity = currentUser?.role === 'security';
  const canUsePersonaSimulation = import.meta.env.DEV && currentUser?.role === 'admin';
  const hasAccess = isAdmin;

  const stats = generateCampusAuditReport(items, claims);

  // Custody items held at university facilities
  const physicalCustodyItems = items.filter(
    (i) => i.holdingLocation === 'security_main_gate' || i.holdingLocation === 'student_affairs_office' || i.holdingLocation === 'library_desk'
  );

  const pendingClaims = claims.filter((c) => c.status === 'pending');

  const showNotification = (msg: string) => {
    setActionNotice(msg);
    setTimeout(() => setActionNotice(null), 3500);
  };

  const loadRoles = async () => {
    setIsLoadingRoles(true);
    try {
      const records = await fetchAllRoles();
      setRoleRecords(records);
    } catch {
      showNotification('Could not load roles. Please check network.');
    } finally {
      setIsLoadingRoles(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'roles' && hasAccess) {
      loadRoles();
    }
  }, [activeTab, hasAccess]);

  const handleCreateOrUpdateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOwner) {
      showNotification('Unauthorized: only the project owner can provision new roles.');
      return;
    }
    if (!newTargetUid.trim() || !newTargetEmail.trim()) {
      showNotification('Please fill in both the user ID and Nile email.');
      return;
    }
    setIsSavingRole(true);
    try {
      await assignUserRole(
        newTargetUid.trim(),
        newTargetEmail.trim().toLowerCase(),
        newTargetRole,
        currentUser?.email || 'owner@example.com'
      );
      showNotification(`Assigned ${newTargetRole} role to ${newTargetEmail.trim()}.`);
      setNewTargetUid('');
      setNewTargetEmail('');
      await loadRoles();
    } catch (err: any) {
      showNotification(err?.message || 'Could not save role. Check permissions.');
    } finally {
      setIsSavingRole(false);
    }
  };

  const exportAuditLogCsv = () => {
    const headers = ['ID', 'Type', 'Title', 'Category', 'Location', 'Holding Desk', 'Status', 'Date Reported'];
    const rows = items.map((i) => [
      sanitizeCsvCell(i.id),
      sanitizeCsvCell(i.type),
      sanitizeCsvCell(i.title),
      sanitizeCsvCell(i.category),
      sanitizeCsvCell(`${i.location}${i.locationDetails ? ` - ${i.locationDetails}` : ''}`),
      sanitizeCsvCell(i.holdingLocation),
      sanitizeCsvCell(i.status),
      sanitizeCsvCell(formatDateDDMMYYYY(i.dateLostOrFound))
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `nilefound_campus_audit_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showNotification('Audit log exported as CSV for Nile University Student Affairs.');
  };

  if (!hasAccess || !currentUser) {
    return (
      <div className="max-w-md mx-auto my-12 p-8 bg-white dark:bg-[#1E1C18] rounded-[12px] border border-[#E6DFD2] dark:border-[#2E2A24] text-center space-y-4 shadow-xs">
        <div className="w-12 h-12 rounded-[10px] bg-[#FAF6EF] dark:bg-[#141311] text-[#0F6E6E] dark:text-[#199595] flex items-center justify-center mx-auto border border-[#E6DFD2] dark:border-[#2E2A24]">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h3 className="font-serif font-bold text-[#1F1B16] dark:text-[#F5F1EA] text-base tracking-tight">Restricted Administrator Area</h3>
          <p className="text-xs text-[#544E45] dark:text-[#B8B0A2] leading-relaxed">
            This administration portal is configured for the project owner and designated Nile University campus security personnel.
          </p>
        </div>
        <button
          onClick={onNavigateToLogin}
          className="bg-[#0F6E6E] text-white text-xs font-semibold px-5 py-2.5 rounded-[10px] hover:bg-[#0C5656] transition-colors min-h-[44px] cursor-pointer btn-campus shadow-xs"
        >
          Sign In with Admin Account
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner Dedicated to Ayomide */}
      <div className="bg-white dark:bg-[#1E1C18] text-[#1F1B16] dark:text-[#F5F1EA] rounded-[12px] p-6 border border-[#E6DFD2] dark:border-[#2E2A24] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-5">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="bg-[#E7F3F3] dark:bg-[#0D2D2D] text-[#0F6E6E] dark:text-[#199595] font-semibold text-xs px-2.5 py-0.5 rounded-[10px] border border-[#0F6E6E]/20 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              {isOwner ? 'Project Owner & Primary Admin' : 'Campus Administrator'}
            </span>
            <span className="text-xs text-[#7A7266] dark:text-[#857D71] font-mono">
              Project owner
            </span>
          </div>

          <h2 className="font-serif text-xl font-bold tracking-tight">
            NileFound Operations & Custody Desk
          </h2>
          <p className="text-xs text-[#544E45] dark:text-[#B8B0A2] max-w-xl leading-relaxed">
            Administrative control over campus items, claim approvals, security gate custody, and authorized campus staff roles.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={exportAuditLogCsv}
            className="flex items-center gap-1.5 bg-white dark:bg-[#28241F] hover:bg-[#FAF6EF] dark:hover:bg-[#332E27] text-[#1F1B16] dark:text-[#F5F1EA] text-xs font-medium px-3.5 py-2 rounded-[10px] border border-[#E6DFD2] dark:border-[#2E2A24] transition-colors min-h-[44px] cursor-pointer btn-campus"
          >
            <Download className="w-4 h-4 text-[#0F6E6E] dark:text-[#199595]" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={() => {
              onExpireOldItems();
              showNotification('Evaluated items: posts older than 30 days marked as expired.');
            }}
            className="flex items-center gap-1.5 bg-white dark:bg-[#28241F] hover:bg-[#FAF6EF] dark:hover:bg-[#332E27] text-[#544E45] dark:text-[#B8B0A2] text-xs font-medium px-3.5 py-2 rounded-[10px] border border-[#E6DFD2] dark:border-[#2E2A24] transition-colors min-h-[44px] cursor-pointer btn-campus"
            title="Auto-expire posts older than 30 days"
          >
            <Archive className="w-4 h-4 text-[#7A7266]" />
            <span>Auto-Expire (&gt;30d)</span>
          </button>
        </div>
      </div>

      {actionNotice && (
        <div className="bg-[#EDF7F1] dark:bg-[#0E2417] border border-[#2F7D4F]/30 text-[#1B5633] dark:text-[#75CE9A] text-xs p-3.5 rounded-[10px] flex items-center gap-2.5 shadow-xs">
          <Check className="w-4 h-4 text-[#2F7D4F] shrink-0" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#1E1C18] p-4 sm:p-5 rounded-[12px] border border-[#E6DFD2] dark:border-[#2E2A24] text-left shadow-xs">
          <span className="text-xs font-medium text-[#7A7266] dark:text-[#857D71]">Pending Claims</span>
          <div className="text-2xl sm:text-3xl font-serif font-bold text-[#E8A317] mt-1">
            {pendingClaims.length}
          </div>
          <span className="text-xs text-[#7A7266] dark:text-[#857D71] mt-0.5 block">
            {pendingClaims.length === 0 ? 'Queue is clear' : 'Awaiting review'}
          </span>
        </div>

        <div className="bg-white dark:bg-[#1E1C18] p-4 sm:p-5 rounded-[12px] border border-[#E6DFD2] dark:border-[#2E2A24] text-left shadow-xs">
          <span className="text-xs font-medium text-[#7A7266] dark:text-[#857D71]">Physical Custody</span>
          <div className="text-2xl sm:text-3xl font-serif font-bold text-[#0F6E6E] dark:text-[#199595] mt-1">
            {physicalCustodyItems.length}
          </div>
          <span className="text-xs text-[#7A7266] dark:text-[#857D71] mt-0.5 block">
            At Security Gate & Desks
          </span>
        </div>

        <div className="bg-white dark:bg-[#1E1C18] p-4 sm:p-5 rounded-[12px] border border-[#E6DFD2] dark:border-[#2E2A24] text-left shadow-xs">
          <span className="text-xs font-medium text-[#7A7266] dark:text-[#857D71]">Reunited Items</span>
          <div className="text-2xl sm:text-3xl font-serif font-bold text-[#2F7D4F] dark:text-[#75CE9A] mt-1">
            {stats.totalReturned}
          </div>
          <span className="text-xs text-[#7A7266] dark:text-[#857D71] mt-0.5 block">
            Confirmed returned
          </span>
        </div>

        <div className="bg-white dark:bg-[#1E1C18] p-4 sm:p-5 rounded-[12px] border border-[#E6DFD2] dark:border-[#2E2A24] text-left shadow-xs">
          <span className="text-xs font-medium text-[#7A7266] dark:text-[#857D71]">Total Tracked</span>
          <div className="text-2xl sm:text-3xl font-serif font-bold text-[#1F1B16] dark:text-[#F5F1EA] mt-1">
            {items.length}
          </div>
          <span className="text-xs text-[#7A7266] dark:text-[#857D71] mt-0.5 block">
            Lost and found posts
          </span>
        </div>
      </div>

      {/* Admin Tabs */}
      <div className="flex border-b border-[#E6DFD2] dark:border-[#2E2A24] gap-2 text-xs overflow-x-auto scrollbar-none">
        <button
          onClick={() => setActiveTab('claims')}
          className={`py-3 px-4 font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap min-h-[44px] cursor-pointer ${
            activeTab === 'claims'
              ? 'border-[#0F6E6E] text-[#0F6E6E] dark:text-[#199595] font-bold'
              : 'border-transparent text-[#7A7266] dark:text-[#857D71] hover:text-[#1F1B16]'
          }`}
        >
          <span>Claim Requests Queue</span>
          <span className="bg-[#FEF7E9] dark:bg-[#2B210A] text-[#7A5000] dark:text-[#F9CF7C] text-xs px-2 py-0.5 rounded-full font-bold">
            {pendingClaims.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('custody')}
          className={`py-3 px-4 font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap min-h-[44px] cursor-pointer ${
            activeTab === 'custody'
              ? 'border-[#0F6E6E] text-[#0F6E6E] dark:text-[#199595] font-bold'
              : 'border-transparent text-[#7A7266] dark:text-[#857D71] hover:text-[#1F1B16]'
          }`}
        >
          <span>Gate Custody Ledger</span>
          <span className="bg-[#FAF6EF] dark:bg-[#141311] text-[#544E45] dark:text-[#B8B0A2] text-xs px-2 py-0.5 rounded-full font-medium">
            {physicalCustodyItems.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('all_items')}
          className={`py-3 px-4 font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap min-h-[44px] cursor-pointer ${
            activeTab === 'all_items'
              ? 'border-[#0F6E6E] text-[#0F6E6E] dark:text-[#199595] font-bold'
              : 'border-transparent text-[#7A7266] dark:text-[#857D71] hover:text-[#1F1B16]'
          }`}
        >
          <span>All Campus Items ({items.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('roles')}
          className={`py-3 px-4 font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap min-h-[44px] cursor-pointer ${
            activeTab === 'roles'
              ? 'border-[#0F6E6E] text-[#0F6E6E] dark:text-[#199595] font-bold'
              : 'border-transparent text-[#7A7266] dark:text-[#857D71] hover:text-[#1F1B16]'
          }`}
        >
          <UserCheck className="w-4 h-4 text-[#0F6E6E] dark:text-[#199595]" />
          <span>Staff Roles & Security</span>
        </button>

        {canUsePersonaSimulation && (
          <button
            onClick={() => setActiveTab('personas')}
            className={`py-3 px-4 font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap min-h-[44px] cursor-pointer ${
              activeTab === 'personas'
                ? 'border-[#0F6E6E] text-[#0F6E6E] dark:text-[#199595] font-bold'
                : 'border-transparent text-[#7A7266] dark:text-[#857D71] hover:text-[#1F1B16]'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-[#0F6E6E] dark:text-[#199595]" />
            <span>Test Personas (project owner only)</span>
          </button>
        )}
        {pendingDelete && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-3" role="dialog" aria-modal="true" aria-labelledby="delete-title">
            <div className="w-full max-w-[480px] rounded-[20px] bg-white dark:bg-[#1E1C18] p-5 shadow-xl">
              <h2 id="delete-title" className="text-sm font-bold text-[#1F1B16] dark:text-[#F5F1EA]">Delete this item?</h2>
              <p className="mt-2 text-xs text-[#544E45] dark:text-[#B8B0A2]">This permanently removes “{pendingDelete.title}”.</p>
              <div className="mt-5 flex justify-end gap-2">
                <button type="button" onClick={() => setPendingDelete(null)} className="min-h-[44px] rounded-[10px] border border-[#E6DFD2] px-4 text-xs">Cancel</button>
                <button type="button" onClick={() => { onDeleteItem(pendingDelete.id); showNotification(`Removed item ${pendingDelete.title}.`); setPendingDelete(null); setSelectedItemForDetail(null); }} className="min-h-[44px] rounded-[10px] bg-[#9B1C1C] px-4 text-xs font-medium text-white">Delete</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* TAB 1: Claims Review Queue */}
      {activeTab === 'claims' && (
        <div className="space-y-4">
          {pendingClaims.length === 0 ? (
            <div className="bg-[#1E1C18] rounded-[20px] border border-[#1E294B] p-10 text-center space-y-2 shadow-lg">
              <CheckCircle className="w-10 h-10 text-[#0F6E6E] mx-auto" />
              <h4 className="font-extrabold text-[#F4F6FF] text-base">No pending claims</h4>
              <p className="text-xs text-slate-400">All submitted claims have been processed.</p>
            </div>
          ) : (
            pendingClaims.map((claim) => {
              const matchedItem = items.find((i) => i.id === claim.itemId);
              return (
                <div
                  key={claim.id}
                  className="bg-[#1E1C18] rounded-[20px] border border-[#1E294B] p-5 space-y-4 shadow-xl hover:border-[#0F6E6E]/30 transition-all"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#1E294B] pb-4">
                    <div>
                      <div className="flex items-center gap-2.5">
                        <span className="font-extrabold text-[#F4F6FF] text-base">{claim.itemTitle}</span>
                        <span className="text-xs font-mono font-bold uppercase bg-amber-400/10 text-amber-300 border border-amber-400/30 px-2 py-0.5 rounded-full">
                          Pending Review
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        Claimed by <strong className="text-[#F4F6FF]">{claim.claimantName}</strong> ({claim.claimantEmail}) on {formatDateDDMMYYYY(claim.createdAt)}
                      </p>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <button
                        onClick={() => {
                          onApproveClaim(claim.id, claim.itemId);
                          showNotification(`Approved claim for ${claim.claimantName}. Item marked as returned.`);
                        }}
                        className="flex items-center gap-2 bg-[#0F6E6E] hover:bg-[#b8f52f] text-[#FAF6EF] text-xs font-extrabold px-4 py-2.5 rounded-full shadow-[0_0_15px_rgba(198,255,61,0.2)] transition-all min-h-[44px] cursor-pointer"
                      >
                        <CheckCircle className="w-4 h-4 stroke-[3]" />
                        <span>Approve & Return</span>
                      </button>

                      <button
                        onClick={() => {
                          onRejectClaim(claim.id);
                          showNotification(`Rejected claim from ${claim.claimantName}.`);
                        }}
                        className="flex items-center gap-2 bg-[#FAF6EF] hover:bg-rose-950/40 text-rose-300 text-xs font-bold px-4 py-2.5 rounded-full border border-rose-500/40 transition-colors min-h-[44px] cursor-pointer"
                      >
                        <XCircle className="w-4 h-4" />
                        <span>Reject</span>
                      </button>
                    </div>
                  </div>

                  {/* Verification QA Comparison */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs bg-[#FAF6EF] p-4 rounded-[20px] border border-[#1E294B]">
                    <div>
                      <span className="font-bold text-slate-400 block mb-1.5 uppercase text-xs tracking-wider">Item Details & Question:</span>
                      <p className="text-slate-300 leading-relaxed">{matchedItem?.description || 'No public description.'}</p>
                      {matchedItem?.verificationQuestion && (
                        <p className="mt-2 text-[#0F6E6E] font-medium">
                          <strong>Question:</strong> {matchedItem.verificationQuestion}
                        </p>
                      )}
                    </div>

                    <div>
                      <span className="font-bold text-slate-400 block mb-1.5 uppercase text-xs tracking-wider">Claimant Submitted Answer:</span>
                      <p className="bg-[#1E1C18] p-3 rounded-[20px] border border-[#1E294B] text-[#F4F6FF] font-mono text-xs leading-relaxed">
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

      {/* TAB 2: Gate Custody Ledger */}
      {activeTab === 'custody' && (
        <div className="space-y-4">
          <div className="bg-[#1E1C18] rounded-[20px] border border-[#1E294B] p-5 shadow-lg flex items-center justify-between">
            <div>
              <h3 className="font-extrabold text-[#F4F6FF] text-base">Nile University Gate Custody Ledger</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Physical inventory logged at security checkpoints and administration desks.
              </p>
            </div>
            <span className="text-xs bg-[#0F6E6E]/10 text-[#0F6E6E] border border-[#0F6E6E]/30 font-mono font-bold px-3 py-1 rounded-full">
              {physicalCustodyItems.length} Held Items
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {physicalCustodyItems.map((item) => (
              <div
                key={item.id}
                className="bg-[#1E1C18] rounded-[20px] border border-[#1E294B] p-5 space-y-3 shadow-lg hover:border-[#0F6E6E]/30 transition-all"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-extrabold text-[#F4F6FF] text-sm">{item.title}</span>
                  <span className="text-xs font-mono uppercase bg-[#1E294B] text-[#0F6E6E] border border-[#0F6E6E]/30 px-2.5 py-0.5 rounded-full font-bold">
                    {item.holdingLocation.replace(/_/g, ' ')}
                  </span>
                </div>

                <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">{item.description}</p>

                <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-[#1E294B]">
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-[#0F6E6E]" />
                    <span>{item.location}</span>
                  </span>
                  <span>Logged: {formatDateDDMMYYYY(item.dateLostOrFound)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: All Campus Items (Master Moderation) */}
      {activeTab === 'all_items' && (
        <div className="space-y-4">
          <div className="bg-[#1E1C18] rounded-[20px] border border-[#1E294B] overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-[#1E294B] flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-[#F4F6FF] text-base">Master Inventory Control</h3>
                <p className="text-xs text-slate-400 mt-0.5">Update status or purge listings from the system.</p>
              </div>
              <span className="text-xs text-slate-400 font-mono">Total: {items.length}</span>
            </div>

            <div className="overflow-x-auto">
              <div className="min-w-0 divide-y divide-[#1E294B] text-xs">
                {items.length === 0 ? (
                  <div className="p-8 text-center text-slate-400">No items currently logged.</div>
                ) : (
                  items.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => isAdmin && setSelectedItemForDetail(item)}
                      className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#FAF6EF]/60 transition-colors cursor-pointer"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded uppercase ${
                            item.type === 'found' ? 'bg-[#0F6E6E]/10 text-[#0F6E6E]' : 'bg-amber-400/10 text-amber-300'
                          }`}>
                            {item.type}
                          </span>
                          <span className="font-bold text-[#F4F6FF] text-sm">{item.title}</span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                          {item.location} • Status: <strong className="text-slate-300">{item.status}</strong> • <span className="text-[#0F6E6E] underline">Click to inspect full details</span>
                        </p>
                      </div>

                      <div className="flex items-center gap-2.5" onClick={(e) => e.stopPropagation()}>
                        <select
                          value={item.status}
                          onChange={(e) => onUpdateItemStatus(item.id, e.target.value as CampusItem['status'])}
                          className="bg-[#FAF6EF] text-[#F4F6FF] border border-[#1E294B] rounded-[20px] px-3 py-2 text-xs focus:border-[#0F6E6E] focus:outline-hidden min-h-[44px] cursor-pointer"
                        >
                          <option value="open">Open</option>
                          <option value="claim_requested">Claim Pending</option>
                          <option value="returned">Returned / Reunited</option>
                          <option value="expired">Expired</option>
                        </select>

                        <button
                          onClick={() => setPendingDelete(item)}
                          className="text-slate-400 hover:text-rose-400 p-2 min-h-[44px] flex items-center justify-center transition-colors cursor-pointer"
                          title="Delete item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: Staff Roles & Security Provisioning */}
      {activeTab === 'roles' && (
        <div className="space-y-6">
          {isOwner ? (
            <div className="bg-[#1E1C18] rounded-[20px] border border-[#1E294B] p-6 shadow-2xl space-y-4">
              <div>
                <h3 className="font-extrabold text-[#F4F6FF] text-base">Provision Staff or Security Role</h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  As the primary system owner, grant campus administrators or security officers role access to review verification answers and manage custody desks.
                </p>
              </div>

              <form onSubmit={handleCreateOrUpdateRole} className="grid grid-cols-1 sm:grid-cols-4 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1.5">
                    User Firebase UID
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. skBaRQGJm..."
                    value={newTargetUid}
                    onChange={(e) => setNewTargetUid(e.target.value)}
                    className="w-full text-xs p-3 rounded-[20px] border border-[#1E294B] bg-[#FAF6EF] text-[#F4F6FF] focus:border-[#0F6E6E] focus:outline-hidden min-h-[44px]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1.5">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="officer@nileuniversity.edu.ng"
                    value={newTargetEmail}
                    onChange={(e) => setNewTargetEmail(e.target.value)}
                    className="w-full text-xs p-3 rounded-[20px] border border-[#1E294B] bg-[#FAF6EF] text-[#F4F6FF] focus:border-[#0F6E6E] focus:outline-hidden min-h-[44px]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1.5">
                    Role
                  </label>
                  <select
                    value={newTargetRole}
                    onChange={(e) => setNewTargetRole(e.target.value as 'admin' | 'security')}
                    className="w-full text-xs p-3 rounded-[20px] border border-[#1E294B] bg-[#FAF6EF] text-[#F4F6FF] focus:border-[#0F6E6E] focus:outline-hidden min-h-[44px] cursor-pointer"
                  >
                    <option value="security">Campus Security Officer</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>

                <div className="flex items-end">
                  <button
                    type="submit"
                    disabled={isSavingRole}
                    className="w-full min-h-[44px] bg-[#0F6E6E] hover:bg-[#b8f52f] disabled:opacity-50 text-[#FAF6EF] font-extrabold text-xs py-3 px-4 rounded-full transition-all shadow-[0_0_15px_rgba(198,255,61,0.2)] flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Plus className="w-4 h-4 stroke-[3]" />
                    <span>{isSavingRole ? 'Saving...' : 'Assign Role'}</span>
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="bg-amber-400/10 border border-amber-400/30 text-amber-300 p-5 rounded-[20px] text-xs">
              <span className="font-bold">Role Provisioning Restricted:</span> Only the project owner is authorized to assign new administrator or campus security roles.
            </div>
          )}

          {/* Existing Roles List */}
          <div className="bg-[#1E1C18] rounded-[20px] border border-[#1E294B] overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-[#1E294B] flex items-center justify-between">
              <div>
                <h4 className="font-extrabold text-[#F4F6FF] text-sm uppercase tracking-wide">
                  Active System Roles (/roles)
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">Persisted in Cloud Firestore security rules</p>
              </div>
              <button
                onClick={loadRoles}
                className="text-xs text-[#0F6E6E] font-bold hover:underline flex items-center gap-1.5 min-h-[44px] px-3 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingRoles ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>

            <div className="divide-y divide-[#1E294B] text-xs">
              {/* Permanent Owner Entry */}
              <div className="p-4 sm:p-5 flex items-center justify-between bg-[#FAF6EF]/50">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#0F6E6E] text-[#FAF6EF] font-extrabold flex items-center justify-center text-xs shadow-md">
                    A
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-[#F4F6FF]">Ayomide (System Lead)</span>
                      <span className="bg-[#0F6E6E]/15 text-[#0F6E6E] border border-[#0F6E6E]/30 text-xs font-mono font-bold px-2 py-0.5 rounded-full uppercase">
                        Master Admin
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 font-mono mt-0.5">Project owner</p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xs text-[#0F6E6E] font-mono font-semibold">Active & Root</span>
                </div>
              </div>

              {/* Dynamic Database Roles */}
              {roleRecords.length === 0 ? (
                <div className="p-6 text-center text-slate-400">
                  No additional staff roles provisioned yet.
                </div>
              ) : (
                roleRecords.map((r) => (
                  <div key={r.uid} className="p-4 sm:p-5 flex items-center justify-between hover:bg-[#FAF6EF]/30 transition-colors">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[#F4F6FF]">{r.email || r.uid}</span>
                        <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full uppercase bg-[#1E294B] text-slate-300 border border-[#2A3B66]">
                          {r.role}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 font-mono">UID: {r.uid}</p>
                    </div>

                    <div className="text-right text-xs text-slate-400">
                      <span>Assigned by {r.assignedBy || 'Admin'}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: Test Personas (Strictly for the project owner) */}
      {activeTab === 'personas' && isOwner && (
        <div className="space-y-6">
          <div className="bg-[#1E1C18] rounded-[20px] border border-[#1E294B] p-6 shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-[#F4F6FF] text-base flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#0F6E6E]" />
                Root Admin Persona Switcher & Test Accounts
              </h3>
              <span className="text-xs bg-[#0F6E6E]/10 text-[#0F6E6E] border border-[#0F6E6E]/30 font-mono font-bold px-2 py-0.5 rounded-full">
                Project owner only
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              These test personas allow you, as the primary administrator, to preview and audit the portal from the perspective of students, security gate personnel, and departmental staff. All other users cannot see or access these accounts.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Persona 1: Student Chidera */}
            <div className="bg-[#1E1C18] rounded-[20px] border border-[#1E294B] p-5 space-y-4 hover:border-[#0F6E6E]/30 transition-all flex flex-col justify-between">
              <div className="space-y-2.5">
                <div className="w-10 h-10 rounded-[20px] bg-purple-500/20 text-purple-300 flex items-center justify-center font-bold text-sm border border-purple-500/30">
                  U
                </div>
                <div>
                  <h4 className="font-extrabold text-[#F4F6FF] text-sm">Chidera Eze</h4>
                  <span className="text-xs font-mono text-purple-300 font-bold uppercase">Student</span>
                  <p className="text-xs text-slate-400 font-mono">chidera@nileuniversity.edu.ng</p>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Test reporting items with challenge questions, filtering the campus feed, and submitting ownership claim verification answers.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (onSwitchPersona) {
                    onSwitchPersona({
                      id: 'demo-student-chidera',
                      name: 'Chidera Eze (Student)',
                      email: 'chidera@nileuniversity.edu.ng',
                      role: 'student',
                      matricNumber: '23/ENG/0481',
                      department: 'Computer Engineering',
                      isAdmin: false,
                    });
                    showNotification('Switched persona to Chidera Eze (Student).');
                  }
                }}
                className="w-full py-2.5 px-4 bg-[#1E294B] hover:bg-[#2A3B66] text-[#F4F6FF] rounded-full text-xs font-bold border border-[#2A3B66] transition-all cursor-pointer min-h-[44px]"
              >
                Switch to Student Persona
              </button>
            </div>

            {/* Persona 2: Security Musa */}
            <div className="bg-[#1E1C18] rounded-[20px] border border-[#1E294B] p-5 space-y-4 hover:border-[#0F6E6E]/30 transition-all flex flex-col justify-between">
              <div className="space-y-2.5">
                <div className="w-10 h-10 rounded-[20px] bg-blue-500/20 text-blue-300 flex items-center justify-center font-bold text-sm border border-blue-500/30">
                  S
                </div>
                <div>
                  <h4 className="font-extrabold text-[#F4F6FF] text-sm">Officer Musa</h4>
                  <span className="text-xs font-mono text-blue-300 font-bold uppercase">Security Guard</span>
                  <p className="text-xs text-slate-400 font-mono">security.gate@nileuniversity.edu.ng</p>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Test physical custody logging at Main Gate, in-person claimant verification handovers, and security desk custody records.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (onSwitchPersona) {
                    onSwitchPersona({
                      id: 'demo-security-musa',
                      name: 'Officer Musa (Main Gate)',
                      email: 'security.gate@nileuniversity.edu.ng',
                      role: 'security',
                      department: 'Campus Security & Safety',
                      isAdmin: false,
                    });
                    showNotification('Switched persona to Officer Musa (Main Gate).');
                  }
                }}
                className="w-full py-2.5 px-4 bg-[#1E294B] hover:bg-[#2A3B66] text-[#F4F6FF] rounded-full text-xs font-bold border border-[#2A3B66] transition-all cursor-pointer min-h-[44px]"
              >
                Switch to Security Persona
              </button>
            </div>

            {/* Persona 3: Campus Administrator */}
            <div className="bg-[#1E1C18] rounded-[20px] border border-[#1E294B] p-5 space-y-4 hover:border-[#0F6E6E]/30 transition-all flex flex-col justify-between">
              <div className="space-y-2.5">
                <div className="w-10 h-10 rounded-[20px] bg-amber-500/20 text-amber-300 flex items-center justify-center font-bold text-sm border border-amber-500/30">
                  A
                </div>
                <div>
                  <h4 className="font-extrabold text-[#F4F6FF] text-sm">Campus Administrator</h4>
                  <span className="text-xs font-mono text-amber-300 font-bold uppercase">Admin</span>
                  <p className="text-xs text-slate-400 font-mono">admin@nileuniversity.edu.ng</p>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Test claim resolution workflows, CSV audit exporting, auto-expiring old posts, and general campus operations.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (onSwitchPersona) {
                    onSwitchPersona({
                      id: 'demo-admin',
                      name: 'Campus Administrator',
                      email: 'admin@nileuniversity.edu.ng',
                      role: 'admin',
                      matricNumber: 'ADMIN-01',
                      department: 'Student Affairs',
                      isAdmin: true,
                    });
                    showNotification('Switched persona to Campus Administrator.');
                  }
                }}
                className="w-full py-2.5 px-4 bg-[#1E294B] hover:bg-[#2A3B66] text-[#F4F6FF] rounded-full text-xs font-bold border border-[#2A3B66] transition-all cursor-pointer min-h-[44px]"
              >
                Switch to Campus Admin
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Item Detail Panel Modal */}
      {selectedItemForDetail && isAdmin && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/50 backdrop-blur-xs overflow-y-auto"
          onClick={() => setSelectedItemForDetail(null)}
        >
          <div
            className="w-full max-w-[672px] bg-white dark:bg-[#1E1C18] text-[#1F1B16] dark:text-[#F5F1EA] rounded-[12px] border border-[#E6DFD2] dark:border-[#2E2A24] shadow-xl max-h-[100dvh] overflow-hidden my-3 sm:my-6 flex flex-col min-w-0"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-[#FAF6EF] dark:bg-[#141311] px-5 sm:px-6 py-4 border-b border-[#E6DFD2] dark:border-[#2E2A24] flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className={selectedItemForDetail.type === 'found' ? 'stamp-found' : 'stamp-lost'}>
                  {selectedItemForDetail.type}
                </span>
                <h3 className="font-serif font-bold text-base text-[#1F1B16] dark:text-[#F5F1EA] truncate">
                  {selectedItemForDetail.title}
                </h3>
              </div>
              <button
                onClick={() => setSelectedItemForDetail(null)}
                className="text-[#7A7266] hover:text-[#1F1B16] dark:hover:text-[#F5F1EA] p-1.5 rounded-[10px] cursor-pointer"
                aria-label="Close item details"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 sm:p-6 space-y-4 min-h-0 flex-1 overflow-y-auto text-xs">
              {/* Full-size Photo */}
              {selectedItemForDetail.imageUrl && (
                <div className="rounded-[10px] overflow-hidden bg-[#FAF6EF] dark:bg-[#141311] border border-[#E6DFD2] dark:border-[#2E2A24]">
                  <img
                    src={selectedItemForDetail.imageUrl}
                    alt={selectedItemForDetail.title}
                    className="w-full max-h-96 object-contain mx-auto"
                    loading="lazy"
                    decoding="async"
                    width={640}
                    height={360}
                  />
                </div>
              )}

              {/* Full Description */}
              <div className="bg-[#FAF6EF] dark:bg-[#141311] border border-[#E6DFD2] dark:border-[#2E2A24] rounded-[10px] p-4 space-y-1.5">
                <span className="text-xs font-sans font-medium uppercase text-[#7A7266] dark:text-[#857D71]">Full Description</span>
                <p className="text-sm text-[#1F1B16] dark:text-[#F5F1EA] leading-relaxed whitespace-pre-wrap">
                  {selectedItemForDetail.description}
                </p>
              </div>

              {/* Metadata Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-[#FAF6EF] dark:bg-[#141311] border border-[#E6DFD2] dark:border-[#2E2A24] rounded-[10px] p-3.5 space-y-1">
                  <span className="text-xs uppercase text-[#7A7266] dark:text-[#857D71] flex items-center gap-1 font-medium">
                    <Tag className="w-3 h-3 text-[#0F6E6E] dark:text-[#199595]" /> Category
                  </span>
                  <p className="font-semibold text-[#1F1B16] dark:text-[#F5F1EA]">{selectedItemForDetail.category}</p>
                </div>

                <div className="bg-[#FAF6EF] dark:bg-[#141311] border border-[#E6DFD2] dark:border-[#2E2A24] rounded-[10px] p-3.5 space-y-1">
                  <span className="text-xs uppercase text-[#7A7266] dark:text-[#857D71] flex items-center gap-1 font-medium">
                    <MapPin className="w-3 h-3 text-[#0F6E6E] dark:text-[#199595]" /> Campus Location
                  </span>
                  <p className="font-semibold text-[#1F1B16] dark:text-[#F5F1EA]">{selectedItemForDetail.location}</p>
                </div>

                <div className="bg-[#FAF6EF] dark:bg-[#141311] border border-[#E6DFD2] dark:border-[#2E2A24] rounded-[10px] p-3.5 space-y-1">
                  <span className="text-xs uppercase text-[#7A7266] dark:text-[#857D71] flex items-center gap-1 font-medium">
                    <Calendar className="w-3 h-3 text-[#0F6E6E] dark:text-[#199595]" /> Date Lost / Found
                  </span>
                  <p className="font-semibold text-[#1F1B16] dark:text-[#F5F1EA]">
                    {formatDateDDMMYYYY(selectedItemForDetail.dateLostOrFound)}
                  </p>
                </div>

                <div className="bg-[#FAF6EF] dark:bg-[#141311] border border-[#E6DFD2] dark:border-[#2E2A24] rounded-[10px] p-3.5 space-y-1">
                  <span className="text-xs uppercase text-[#7A7266] dark:text-[#857D71] flex items-center gap-1 font-medium">
                    <ShieldCheck className="w-3 h-3 text-[#0F6E6E] dark:text-[#199595]" /> Held-At Location
                  </span>
                  <p className="font-semibold text-[#1F1B16] dark:text-[#F5F1EA]">{selectedItemForDetail.holdingLocation}</p>
                </div>

                <div className="bg-[#FAF6EF] dark:bg-[#141311] border border-[#E6DFD2] dark:border-[#2E2A24] rounded-[10px] p-3.5 space-y-1">
                  <span className="text-xs uppercase text-[#7A7266] dark:text-[#857D71] font-medium">Status</span>
                  <p className="font-semibold text-[#0F6E6E] dark:text-[#199595] uppercase">{selectedItemForDetail.status}</p>
                </div>

                <div className="bg-[#FAF6EF] dark:bg-[#141311] border border-[#E6DFD2] dark:border-[#2E2A24] rounded-[10px] p-3.5 space-y-1">
                  <span className="text-xs uppercase text-[#7A7266] dark:text-[#857D71] flex items-center gap-1 font-medium">
                    <Clock className="w-3 h-3 text-[#0F6E6E] dark:text-[#199595]" /> Created Time
                  </span>
                  <p className="font-mono text-[#1F1B16] dark:text-[#F5F1EA]">
                    {new Date(selectedItemForDetail.createdAt).toLocaleString('en-GB')}
                  </p>
                </div>
              </div>

              {/* Admin-Only Private Reporter Details & Verification Answer */}
              <div className="bg-[#FAF6EF] dark:bg-[#141311] border border-[#0F6E6E]/30 rounded-[10px] p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-sans font-bold uppercase text-[#0F6E6E] dark:text-[#199595]">
                    Admin-Only Private Reporter & Verification Details
                  </span>
                  {isLoadingPrivate && (
                    <span className="text-xs text-[#7A7266] dark:text-[#857D71]">Loading...</span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <span className="text-xs text-[#7A7266] dark:text-[#857D71] flex items-center gap-1">
                      <UserIcon className="w-3 h-3" /> Reporter Name
                    </span>
                    <p className="font-semibold text-[#1F1B16] dark:text-[#F5F1EA] mt-0.5">
                      {privateDetails.authorName || 'Not recorded'}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-[#7A7266] dark:text-[#857D71] flex items-center gap-1">
                      <Mail className="w-3 h-3" /> Reporter Email
                    </span>
                    <p className="font-mono text-[#1F1B16] dark:text-[#F5F1EA] mt-0.5">
                      {privateDetails.authorEmail || 'Not recorded'}
                    </p>
                  </div>
                </div>

                {selectedItemForDetail.verificationQuestion && (
                  <div className="pt-2 border-t border-[#E6DFD2] dark:border-[#2E2A24] space-y-1">
                    <p className="text-[#544E45] dark:text-[#B8B0A2]">
                      <strong className="text-[#1F1B16] dark:text-[#F5F1EA]">Verification Question:</strong>{' '}
                      {selectedItemForDetail.verificationQuestion}
                    </p>
                    <p className="text-[#0F6E6E] dark:text-[#199595]">
                      <strong>Expected Answer:</strong>{' '}
                      {privateDetails.expectedAnswer || 'Not recorded'}
                    </p>
                  </div>
                )}
              </div>

              {/* Claims for this Item */}
              <div className="space-y-2.5">
                <h4 className="font-serif font-bold text-sm text-[#1F1B16] dark:text-[#F5F1EA]">
                  Ownership Claims ({claims.filter((c) => c.itemId === selectedItemForDetail.id).length})
                </h4>
                {claims.filter((c) => c.itemId === selectedItemForDetail.id).length === 0 ? (
                  <p className="text-[#7A7266] dark:text-[#857D71] bg-[#FAF6EF] dark:bg-[#141311] border border-[#E6DFD2] dark:border-[#2E2A24] rounded-[10px] p-3.5">
                    No claims submitted for this item yet.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {claims
                      .filter((c) => c.itemId === selectedItemForDetail.id)
                      .map((claim) => (
                        <div
                          key={claim.id}
                          className="bg-[#FAF6EF] dark:bg-[#141311] border border-[#E6DFD2] dark:border-[#2E2A24] rounded-[10px] p-3.5 space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="font-semibold text-[#1F1B16] dark:text-[#F5F1EA]">{claim.claimantName}</span>
                              <span className="text-[#7A7266] ml-2 font-mono text-xs">
                                ({claim.claimantEmail})
                              </span>
                            </div>
                            <span className="text-xs font-sans font-semibold uppercase px-2 py-0.5 rounded-[10px] bg-white dark:bg-[#1E1C18] border border-[#E6DFD2] dark:border-[#2E2A24] text-[#0F6E6E] dark:text-[#199595]">
                              {claim.status}
                            </span>
                          </div>
                          <p className="text-[#544E45] dark:text-[#B8B0A2]">
                            <strong className="text-[#1F1B16] dark:text-[#F5F1EA]">Submitted Answer:</strong>{' '}
                            {claim.submittedAnswer}
                          </p>
                          {claim.status === 'pending' && (
                            <div className="flex items-center gap-2 pt-1">
                              <button
                                onClick={() => {
                                  onApproveClaim(claim.id, selectedItemForDetail.id);
                                  showNotification(`Approved claim for ${selectedItemForDetail.title}.`);
                                }}
                                className="bg-[#2F7D4F] hover:bg-[#266841] text-white font-medium px-3 py-1.5 rounded-[10px] text-xs cursor-pointer btn-campus shadow-xs"
                              >
                                Approve Claim
                              </button>
                              <button
                                onClick={() => {
                                  onRejectClaim(claim.id);
                                  showNotification(`Rejected claim.`);
                                }}
                                className="bg-white dark:bg-[#28241F] hover:bg-[#FAF6EF] text-[#9B1C1C] dark:text-[#F87171] border border-[#F87171]/40 font-medium px-3 py-1.5 rounded-[10px] text-xs cursor-pointer btn-campus"
                              >
                                Reject
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>

            {/* Footer Actions */}
            <div className="bg-[#FAF6EF] dark:bg-[#141311] px-5 sm:px-6 py-4 border-t border-[#E6DFD2] dark:border-[#2E2A24] flex flex-wrap items-center justify-between gap-3">
              <button
                onClick={() => {
                  onUpdateItemStatus(selectedItemForDetail.id, 'returned');
                  setSelectedItemForDetail({ ...selectedItemForDetail, status: 'returned' });
                  showNotification(`Marked "${selectedItemForDetail.title}" as Resolved / Returned.`);
                }}
                disabled={selectedItemForDetail.status === 'returned'}
                className="bg-[#2F7D4F] hover:bg-[#266841] disabled:opacity-50 text-white font-medium px-4 py-2.5 rounded-[10px] text-xs flex items-center gap-2 cursor-pointer min-h-[44px] btn-campus shadow-xs"
              >
                <CheckCircle className="w-4 h-4" />
                <span>
                  {selectedItemForDetail.status === 'returned' ? 'Resolved (Returned)' : 'Mark Resolved'}
                </span>
              </button>

              <button
                onClick={() => setPendingDelete(selectedItemForDetail)}
                className="bg-white dark:bg-[#28241F] hover:bg-rose-50 dark:hover:bg-rose-950/20 text-[#9B1C1C] dark:text-[#F87171] border border-[#F87171]/40 font-medium px-4 py-2.5 rounded-[10px] text-xs flex items-center gap-2 cursor-pointer min-h-[44px] btn-campus"
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
