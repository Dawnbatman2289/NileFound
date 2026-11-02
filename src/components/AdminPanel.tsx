/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * NileFound Admin Panel - Built specially for ayomide2289@gmail.com
 * Layout: Primary administrator dashboard in Deep Navy (#0B1020), Muted Cards (#141B33), and Electric Lime (#C6FF3D).
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
  HelpCircle
} from 'lucide-react';
import { CampusItem, ClaimRecord, User } from '../types/index.ts';
import { generateCampusAuditReport } from '../utils/admin.ts';
import { formatDateDDMMYYYY } from '../utils/dateFormatter.ts';
import { 
  fetchAllRoles, 
  assignUserRole, 
  UserRoleRecord 
} from '../services/firestoreService.ts';

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
  onNavigateToLogin
}) => {
  const [activeTab, setActiveTab] = useState<'claims' | 'custody' | 'all_items' | 'roles'>('claims');
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Role management state
  const [roleRecords, setRoleRecords] = useState<UserRoleRecord[]>([]);
  const [isLoadingRoles, setIsLoadingRoles] = useState(false);
  const [newTargetUid, setNewTargetUid] = useState('');
  const [newTargetEmail, setNewTargetEmail] = useState('');
  const [newTargetRole, setNewTargetRole] = useState<'admin' | 'security'>('security');
  const [isSavingRole, setIsSavingRole] = useState(false);

  const isOwnerEmail = currentUser?.email?.trim().toLowerCase() === 'ayomide2289@gmail.com';
  const isAdmin = currentUser?.role === 'admin' || currentUser?.isAdmin || isOwnerEmail;
  const isSecurity = currentUser?.role === 'security';
  const hasAccess = isAdmin || isSecurity;

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
    if (!isOwnerEmail) {
      showNotification('Unauthorized: Only ayomide2289@gmail.com can provision new roles.');
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
        currentUser?.email || 'ayomide2289@gmail.com'
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
      i.id,
      i.type,
      `"${i.title.replace(/"/g, '""')}"`,
      i.category,
      `"${i.location}"`,
      i.holdingLocation,
      i.status,
      formatDateDDMMYYYY(i.dateLostOrFound)
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
      <div className="max-w-md mx-auto my-12 p-8 bg-[#141B33] rounded-[20px] border border-[#1E294B] text-center space-y-5 shadow-2xl">
        <div className="w-14 h-14 rounded-2xl bg-[#1E294B] text-[#C6FF3D] flex items-center justify-center mx-auto border border-[#2A3B66]">
          <ShieldAlert className="w-7 h-7" />
        </div>
        <div className="space-y-1.5">
          <h3 className="font-extrabold text-[#F4F6FF] text-lg tracking-tight">Restricted Administrator Area</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            This administration portal is specially configured for <strong className="text-[#C6FF3D]">ayomide2289@gmail.com</strong> and designated Nile University campus security personnel.
          </p>
        </div>
        <button
          onClick={onNavigateToLogin}
          className="bg-[#C6FF3D] text-[#0B1020] text-xs font-extrabold px-6 py-3 rounded-full hover:bg-[#b8f52f] transition-all min-h-[44px] shadow-[0_0_15px_rgba(198,255,61,0.2)] cursor-pointer"
        >
          Sign In with Admin Account
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner Dedicated to Ayomide */}
      <div className="bg-[#141B33] text-[#F4F6FF] rounded-[20px] p-6 border border-[#1E294B] shadow-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#C6FF3D]/5 rounded-full blur-3xl pointer-events-none" />

        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
            <span className="bg-[#C6FF3D] text-[#0B1020] font-extrabold text-[10px] uppercase px-2.5 py-0.5 rounded-full tracking-wide flex items-center gap-1 shadow-xs">
              <ShieldCheck className="w-3.5 h-3.5 stroke-[3]" />
              {isOwnerEmail ? 'System Owner & Primary Admin' : 'Campus Administrator'}
            </span>
            <span className="text-xs text-[#C6FF3D]/90 font-mono">
              ayomide2289@gmail.com
            </span>
          </div>

          <h2 className="text-xl font-extrabold text-[#F4F6FF] tracking-tight">
            NileFound Operations & Custody Desk
          </h2>
          <p className="text-xs text-slate-400 max-w-xl leading-relaxed">
            Full administrative control over campus items, claim approvals, security gate custody, and authorized campus staff roles.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={exportAuditLogCsv}
            className="flex items-center gap-2 bg-[#1E294B] hover:bg-[#2A3B66] text-[#F4F6FF] text-xs font-bold px-4 py-2.5 rounded-full border border-[#2A3B66] transition-colors min-h-[44px] cursor-pointer"
          >
            <Download className="w-4 h-4 text-[#C6FF3D]" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={() => {
              onExpireOldItems();
              showNotification('Evaluated items: posts older than 30 days marked as expired.');
            }}
            className="flex items-center gap-2 bg-[#0B1020] hover:bg-slate-900 text-slate-300 text-xs font-bold px-4 py-2.5 rounded-full border border-[#1E294B] transition-colors min-h-[44px] cursor-pointer"
            title="Auto-expire posts older than 30 days"
          >
            <Archive className="w-4 h-4 text-slate-400" />
            <span>Auto-Expire (&gt;30d)</span>
          </button>
        </div>
      </div>

      {actionNotice && (
        <div className="bg-[#C6FF3D]/10 border border-[#C6FF3D]/30 text-[#C6FF3D] text-xs p-3.5 rounded-xl flex items-center gap-2.5 shadow-sm">
          <Check className="w-4 h-4 text-[#C6FF3D] shrink-0" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-[#141B33] p-5 rounded-[20px] border border-[#1E294B] text-left hover:border-[#C6FF3D]/30 transition-colors shadow-lg">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Pending Claims</span>
          <div className="text-3xl font-extrabold text-[#C6FF3D] font-mono mt-1">
            {pendingClaims.length}
          </div>
          <span className="text-[10px] text-slate-400 mt-0.5 block">
            {pendingClaims.length === 0 ? 'Queue is clear' : 'Awaiting admin review'}
          </span>
        </div>

        <div className="bg-[#141B33] p-5 rounded-[20px] border border-[#1E294B] text-left hover:border-[#C6FF3D]/30 transition-colors shadow-lg">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Physical Custody</span>
          <div className="text-3xl font-extrabold text-[#F4F6FF] font-mono mt-1">
            {physicalCustodyItems.length}
          </div>
          <span className="text-[10px] text-slate-400 mt-0.5 block">
            At Security Gate & Desks
          </span>
        </div>

        <div className="bg-[#141B33] p-5 rounded-[20px] border border-[#1E294B] text-left hover:border-[#C6FF3D]/30 transition-colors shadow-lg">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Reunited Items</span>
          <div className="text-3xl font-extrabold text-emerald-400 font-mono mt-1">
            {stats.totalReturned}
          </div>
          <span className="text-[10px] text-slate-400 mt-0.5 block">
            Confirmed returned
          </span>
        </div>

        <div className="bg-[#141B33] p-5 rounded-[20px] border border-[#1E294B] text-left hover:border-[#C6FF3D]/30 transition-colors shadow-lg">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Tracked</span>
          <div className="text-3xl font-extrabold text-[#F4F6FF] font-mono mt-1">
            {items.length}
          </div>
          <span className="text-[10px] text-slate-400 mt-0.5 block">
            Lost and found posts
          </span>
        </div>
      </div>

      {/* Admin Tabs */}
      <div className="flex border-b border-[#1E294B] gap-2 text-xs overflow-x-auto scrollbar-none">
        <button
          onClick={() => setActiveTab('claims')}
          className={`py-3 px-4 font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap min-h-[44px] cursor-pointer ${
            activeTab === 'claims'
              ? 'border-[#C6FF3D] text-[#C6FF3D]'
              : 'border-transparent text-slate-400 hover:text-[#F4F6FF]'
          }`}
        >
          <span>Claim Requests Queue</span>
          <span className="bg-[#C6FF3D]/20 text-[#C6FF3D] font-mono text-[10px] px-2 py-0.5 rounded-full font-bold">
            {pendingClaims.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('custody')}
          className={`py-3 px-4 font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap min-h-[44px] cursor-pointer ${
            activeTab === 'custody'
              ? 'border-[#C6FF3D] text-[#C6FF3D]'
              : 'border-transparent text-slate-400 hover:text-[#F4F6FF]'
          }`}
        >
          <span>Gate Custody Ledger</span>
          <span className="bg-[#1E294B] text-slate-300 font-mono text-[10px] px-2 py-0.5 rounded-full font-bold">
            {physicalCustodyItems.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('all_items')}
          className={`py-3 px-4 font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap min-h-[44px] cursor-pointer ${
            activeTab === 'all_items'
              ? 'border-[#C6FF3D] text-[#C6FF3D]'
              : 'border-transparent text-slate-400 hover:text-[#F4F6FF]'
          }`}
        >
          <span>All Campus Items ({items.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('roles')}
          className={`py-3 px-4 font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap min-h-[44px] cursor-pointer ${
            activeTab === 'roles'
              ? 'border-[#C6FF3D] text-[#C6FF3D]'
              : 'border-transparent text-slate-400 hover:text-[#F4F6FF]'
          }`}
        >
          <UserCheck className="w-4 h-4 text-[#C6FF3D]" />
          <span>Staff Roles & Security</span>
        </button>
      </div>

      {/* TAB 1: Claims Review Queue */}
      {activeTab === 'claims' && (
        <div className="space-y-4">
          {pendingClaims.length === 0 ? (
            <div className="bg-[#141B33] rounded-[20px] border border-[#1E294B] p-10 text-center space-y-2 shadow-lg">
              <CheckCircle className="w-10 h-10 text-[#C6FF3D] mx-auto" />
              <h4 className="font-extrabold text-[#F4F6FF] text-base">No pending claims</h4>
              <p className="text-xs text-slate-400">All submitted claims have been processed.</p>
            </div>
          ) : (
            pendingClaims.map((claim) => {
              const matchedItem = items.find((i) => i.id === claim.itemId);
              return (
                <div
                  key={claim.id}
                  className="bg-[#141B33] rounded-[20px] border border-[#1E294B] p-5 space-y-4 shadow-xl hover:border-[#C6FF3D]/30 transition-all"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#1E294B] pb-4">
                    <div>
                      <div className="flex items-center gap-2.5">
                        <span className="font-extrabold text-[#F4F6FF] text-base">{claim.itemTitle}</span>
                        <span className="text-[10px] font-mono font-bold uppercase bg-amber-400/10 text-amber-300 border border-amber-400/30 px-2 py-0.5 rounded-full">
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
                        className="flex items-center gap-2 bg-[#C6FF3D] hover:bg-[#b8f52f] text-[#0B1020] text-xs font-extrabold px-4 py-2.5 rounded-full shadow-[0_0_15px_rgba(198,255,61,0.2)] transition-all min-h-[44px] cursor-pointer"
                      >
                        <CheckCircle className="w-4 h-4 stroke-[3]" />
                        <span>Approve & Return</span>
                      </button>

                      <button
                        onClick={() => {
                          onRejectClaim(claim.id);
                          showNotification(`Rejected claim from ${claim.claimantName}.`);
                        }}
                        className="flex items-center gap-2 bg-[#0B1020] hover:bg-rose-950/40 text-rose-300 text-xs font-bold px-4 py-2.5 rounded-full border border-rose-500/40 transition-colors min-h-[44px] cursor-pointer"
                      >
                        <XCircle className="w-4 h-4" />
                        <span>Reject</span>
                      </button>
                    </div>
                  </div>

                  {/* Verification QA Comparison */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs bg-[#0B1020] p-4 rounded-xl border border-[#1E294B]">
                    <div>
                      <span className="font-bold text-slate-400 block mb-1.5 uppercase text-[10px] tracking-wider">Item Details & Question:</span>
                      <p className="text-slate-300 leading-relaxed">{matchedItem?.description || 'No public description.'}</p>
                      {matchedItem?.verificationQuestion && (
                        <p className="mt-2 text-[#C6FF3D] font-medium">
                          <strong>Question:</strong> {matchedItem.verificationQuestion}
                        </p>
                      )}
                    </div>

                    <div>
                      <span className="font-bold text-slate-400 block mb-1.5 uppercase text-[10px] tracking-wider">Claimant Submitted Answer:</span>
                      <p className="bg-[#141B33] p-3 rounded-xl border border-[#1E294B] text-[#F4F6FF] font-mono text-xs leading-relaxed">
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
          <div className="bg-[#141B33] rounded-[20px] border border-[#1E294B] p-5 shadow-lg flex items-center justify-between">
            <div>
              <h3 className="font-extrabold text-[#F4F6FF] text-base">Nile University Gate Custody Ledger</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Physical inventory logged at security checkpoints and administration desks.
              </p>
            </div>
            <span className="text-xs bg-[#C6FF3D]/10 text-[#C6FF3D] border border-[#C6FF3D]/30 font-mono font-bold px-3 py-1 rounded-full">
              {physicalCustodyItems.length} Held Items
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {physicalCustodyItems.map((item) => (
              <div
                key={item.id}
                className="bg-[#141B33] rounded-[20px] border border-[#1E294B] p-5 space-y-3 shadow-lg hover:border-[#C6FF3D]/30 transition-all"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-extrabold text-[#F4F6FF] text-sm">{item.title}</span>
                  <span className="text-[10px] font-mono uppercase bg-[#1E294B] text-[#C6FF3D] border border-[#C6FF3D]/30 px-2.5 py-0.5 rounded-full font-bold">
                    {item.holdingLocation.replace(/_/g, ' ')}
                  </span>
                </div>

                <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">{item.description}</p>

                <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-[#1E294B]">
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-[#C6FF3D]" />
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
          <div className="bg-[#141B33] rounded-[20px] border border-[#1E294B] overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-[#1E294B] flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-[#F4F6FF] text-base">Master Inventory Control</h3>
                <p className="text-xs text-slate-400 mt-0.5">Update status or purge listings from the system.</p>
              </div>
              <span className="text-xs text-slate-400 font-mono">Total: {items.length}</span>
            </div>

            <div className="divide-y divide-[#1E294B] text-xs">
              {items.length === 0 ? (
                <div className="p-8 text-center text-slate-400">No items currently logged.</div>
              ) : (
                items.map((item) => (
                  <div key={item.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#0B1020]/40 transition-colors">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase ${
                          item.type === 'found' ? 'bg-[#C6FF3D]/10 text-[#C6FF3D]' : 'bg-amber-400/10 text-amber-300'
                        }`}>
                          {item.type}
                        </span>
                        <span className="font-bold text-[#F4F6FF] text-sm">{item.title}</span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">
                        {item.location} • Status: <strong className="text-slate-300">{item.status}</strong>
                      </p>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <select
                        value={item.status}
                        onChange={(e) => onUpdateItemStatus(item.id, e.target.value as CampusItem['status'])}
                        className="bg-[#0B1020] text-[#F4F6FF] border border-[#1E294B] rounded-xl px-3 py-2 text-xs focus:border-[#C6FF3D] focus:outline-hidden min-h-[44px] cursor-pointer"
                      >
                        <option value="open">Open</option>
                        <option value="claim_requested">Claim Pending</option>
                        <option value="returned">Returned / Reunited</option>
                        <option value="expired">Expired</option>
                      </select>

                      <button
                        onClick={() => {
                          if (confirm(`Permanently delete "${item.title}"?`)) {
                            onDeleteItem(item.id);
                            showNotification(`Removed item ${item.title}.`);
                          }
                        }}
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
      )}

      {/* TAB 4: Staff Roles & Security Provisioning */}
      {activeTab === 'roles' && (
        <div className="space-y-6">
          {isOwnerEmail ? (
            <div className="bg-[#141B33] rounded-[20px] border border-[#1E294B] p-6 shadow-2xl space-y-4">
              <div>
                <h3 className="font-extrabold text-[#F4F6FF] text-base">Provision Staff or Security Role</h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  As the primary system owner, grant campus administrators or security officers role access to review verification answers and manage custody desks.
                </p>
              </div>

              <form onSubmit={handleCreateOrUpdateRole} className="grid grid-cols-1 sm:grid-cols-4 gap-3.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1.5">
                    User Firebase UID
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. skBaRQGJm..."
                    value={newTargetUid}
                    onChange={(e) => setNewTargetUid(e.target.value)}
                    className="w-full text-xs p-3 rounded-xl border border-[#1E294B] bg-[#0B1020] text-[#F4F6FF] focus:border-[#C6FF3D] focus:outline-hidden min-h-[44px]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1.5">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="officer@nileuniversity.edu.ng"
                    value={newTargetEmail}
                    onChange={(e) => setNewTargetEmail(e.target.value)}
                    className="w-full text-xs p-3 rounded-xl border border-[#1E294B] bg-[#0B1020] text-[#F4F6FF] focus:border-[#C6FF3D] focus:outline-hidden min-h-[44px]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1.5">
                    Role
                  </label>
                  <select
                    value={newTargetRole}
                    onChange={(e) => setNewTargetRole(e.target.value as 'admin' | 'security')}
                    className="w-full text-xs p-3 rounded-xl border border-[#1E294B] bg-[#0B1020] text-[#F4F6FF] focus:border-[#C6FF3D] focus:outline-hidden min-h-[44px] cursor-pointer"
                  >
                    <option value="security">Campus Security Officer</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>

                <div className="flex items-end">
                  <button
                    type="submit"
                    disabled={isSavingRole}
                    className="w-full min-h-[44px] bg-[#C6FF3D] hover:bg-[#b8f52f] disabled:opacity-50 text-[#0B1020] font-extrabold text-xs py-3 px-4 rounded-full transition-all shadow-[0_0_15px_rgba(198,255,61,0.2)] flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Plus className="w-4 h-4 stroke-[3]" />
                    <span>{isSavingRole ? 'Saving...' : 'Assign Role'}</span>
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="bg-amber-400/10 border border-amber-400/30 text-amber-300 p-5 rounded-[20px] text-xs">
              <span className="font-bold">Role Provisioning Restricted:</span> Only the primary system owner (ayomide2289@gmail.com) is authorized to assign new administrator or campus security roles.
            </div>
          )}

          {/* Existing Roles List */}
          <div className="bg-[#141B33] rounded-[20px] border border-[#1E294B] overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-[#1E294B] flex items-center justify-between">
              <div>
                <h4 className="font-extrabold text-[#F4F6FF] text-sm uppercase tracking-wide">
                  Active System Roles (/roles)
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">Persisted in Cloud Firestore security rules</p>
              </div>
              <button
                onClick={loadRoles}
                className="text-xs text-[#C6FF3D] font-bold hover:underline flex items-center gap-1.5 min-h-[44px] px-3 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingRoles ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>

            <div className="divide-y divide-[#1E294B] text-xs">
              {/* Permanent Owner Entry */}
              <div className="p-4 sm:p-5 flex items-center justify-between bg-[#0B1020]/50">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#C6FF3D] text-[#0B1020] font-extrabold flex items-center justify-center text-xs shadow-md">
                    A
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-[#F4F6FF]">Ayomide (System Lead)</span>
                      <span className="bg-[#C6FF3D]/15 text-[#C6FF3D] border border-[#C6FF3D]/30 text-[9px] font-mono font-bold px-2 py-0.5 rounded-full uppercase">
                        Master Admin
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 font-mono mt-0.5">ayomide2289@gmail.com</p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[11px] text-[#C6FF3D] font-mono font-semibold">Active & Root</span>
                </div>
              </div>

              {/* Dynamic Database Roles */}
              {roleRecords.length === 0 ? (
                <div className="p-6 text-center text-slate-400">
                  No additional staff roles provisioned yet.
                </div>
              ) : (
                roleRecords.map((r) => (
                  <div key={r.uid} className="p-4 sm:p-5 flex items-center justify-between hover:bg-[#0B1020]/30 transition-colors">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[#F4F6FF]">{r.email || r.uid}</span>
                        <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-full uppercase bg-[#1E294B] text-slate-300 border border-[#2A3B66]">
                          {r.role}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 font-mono">UID: {r.uid}</p>
                    </div>

                    <div className="text-right text-[11px] text-slate-400">
                      <span>Assigned by {r.assignedBy || 'Admin'}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
