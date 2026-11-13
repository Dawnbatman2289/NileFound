/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * NileFound Admin Panel - Campus claims, custody ledger, item moderation, and staff roles.
 */

import React, { useState, useEffect } from 'react';
import {
  ShieldAlert, CheckCircle, XCircle, Trash2, Archive, Download, Check,
  ShieldCheck, UserCheck, Plus, RefreshCw, Clock, MapPin, X, Mail, User as UserIcon, Calendar, Tag,
} from 'lucide-react';
import { CampusItem, ClaimRecord, User } from '../types/index.ts';
import { generateCampusAuditReport } from '../utils/admin.ts';
import { formatDateDDMMYYYY } from '../utils/dateFormatter.ts';
import { sanitizeCsvCell } from '../utils/csv.ts';
import {
  fetchAllRoles, assignUserRoleByEmail, fetchUsersDirectory,
  UserRoleRecord, fetchItemPrivateDetails, ItemPrivateDetails,
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
  onSwitchPersona?: (user: User) => void;
}

const TEST_PERSONAS: Array<{
  badge: string; initial: string; badgeClass: string; buttonLabel: string;
  description: string; user: User;
}> = [
  {
    badge: 'Student',
    initial: 'U',
    badgeClass: 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30',
    buttonLabel: 'Switch to Student Persona',
    description: 'Test reporting items with challenge questions, filtering the campus feed, and submitting ownership claim verification answers.',
    user: { id: 'demo-student-chidera', name: 'Chidera Eze (Student)', email: 'chidera@nileuniversity.edu.ng', role: 'student', matricNumber: '23/ENG/0481', department: 'Computer Engineering', isAdmin: false },
  },
  {
    badge: 'Security Guard',
    initial: 'S',
    badgeClass: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30',
    buttonLabel: 'Switch to Security Persona',
    description: 'Test physical custody logging at Main Gate, in-person claimant verification handovers, and security desk custody records.',
    user: { id: 'demo-security-musa', name: 'Officer Musa (Main Gate)', email: 'security.gate@nileuniversity.edu.ng', role: 'security', department: 'Campus Security & Safety', isAdmin: false },
  },
  {
    badge: 'Admin',
    initial: 'A',
    badgeClass: 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30',
    buttonLabel: 'Switch to Campus Admin',
    description: 'Test claim resolution workflows, CSV audit exporting, auto-expiring old posts, and general campus operations.',
    user: { id: 'demo-admin', name: 'Campus Administrator', email: 'admin@nileuniversity.edu.ng', role: 'admin', matricNumber: 'ADMIN-01', department: 'Student Affairs', isAdmin: true },
  },
];

const CARD = 'bg-white dark:bg-[#1E1C18] text-[#1F1B16] dark:text-[#F5F1EA] rounded-[12px] border border-[#E6DFD2] dark:border-[#2E2A24] shadow-xs';
const INPUT = 'w-full text-xs px-3.5 py-2.5 rounded-[10px] border border-[#E6DFD2] dark:border-[#2E2A24] bg-white dark:bg-[#141311] text-[#1F1B16] dark:text-[#F5F1EA] placeholder:text-[#7A7266] dark:placeholder:text-[#857D71] focus:border-[#0F6E6E] focus:outline-hidden min-h-[44px]';

export const AdminPanel: React.FC<AdminPanelProps> = ({
  currentUser, items, claims, onUpdateItemStatus, onDeleteItem,
  onApproveClaim, onRejectClaim, onExpireOldItems, onNavigateToLogin, onSwitchPersona,
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
  const [newTargetEmail, setNewTargetEmail] = useState('');
  const [newTargetRole, setNewTargetRole] = useState<'admin' | 'security'>('security');
  const [isSavingRole, setIsSavingRole] = useState(false);

  const isAdmin = currentUser?.role === 'admin' || currentUser?.isAdmin;
  const isSecurity = currentUser?.role === 'security';
  const canUsePersonaSimulation = Boolean(onSwitchPersona);
  const hasAccess = isAdmin || isSecurity || canUsePersonaSimulation;

  const stats = generateCampusAuditReport(items, claims);
  const physicalCustodyItems = items.filter((i) =>
    i.holdingLocation === 'security_main_gate' || i.holdingLocation === 'student_affairs_office' || i.holdingLocation === 'library_desk'
  );
  const pendingClaims = claims.filter((c) => c.status === 'pending');

  const showNotification = (msg: string) => {
    setActionNotice(msg);
    setTimeout(() => setActionNotice(null), 3500);
  };

  useEffect(() => {
    if (!selectedItem) {
      setPrivateDetails({});
      return;
    }
    let cancelled = false;
    setIsLoadingPrivate(true);
    fetchItemPrivateDetails(selectedItem.id)
      .then((d) => { if (!cancelled) setPrivateDetails(d); })
      .finally(() => { if (!cancelled) setIsLoadingPrivate(false); });
    return () => { cancelled = true; };
  }, [selectedItem]);

  const loadRoles = async () => {
    setIsLoadingRoles(true);
    try {
      const [records, directory] = await Promise.all([
        fetchAllRoles(),
        isAdmin ? fetchUsersDirectory() : Promise.resolve([]),
      ]);
      setRoleRecords(records);
      setUserSuggestions(directory);
    } catch {
      showNotification('Could not load roles. Please check network.');
    } finally {
      setIsLoadingRoles(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'roles' && hasAccess) loadRoles();
  }, [activeTab, hasAccess]);

  const handleAssignRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return showNotification('Unauthorized: only the project owner can provision new roles.');
    const email = newTargetEmail.trim().toLowerCase();
    if (!email) return showNotification('Enter the staff member’s Nile University email.');

    setIsSavingRole(true);
    try {
      const status = await assignUserRoleByEmail(email, newTargetRole, currentUser?.email || 'owner@example.com');
      showNotification(
        status === 'assigned'
          ? `Assigned ${newTargetRole} role to ${email}.`
          : `Saved ${newTargetRole} role for ${email}. It activates when they sign in.`
      );
      setNewTargetEmail('');
      await loadRoles();
    } catch (err: unknown) {
      showNotification(err instanceof Error ? err.message : 'Could not save role. Check permissions.');
    } finally {
      setIsSavingRole(false);
    }
  };

  const exportAuditLogCsv = () => {
    const headers = ['ID', 'Type', 'Title', 'Category', 'Location', 'Holding Desk', 'Status', 'Date Reported'];
    const rows = items.map((i) => [
      sanitizeCsvCell(i.id), sanitizeCsvCell(i.type), sanitizeCsvCell(i.title), sanitizeCsvCell(i.category),
      sanitizeCsvCell(`${i.location}${i.locationDetails ? ` - ${i.locationDetails}` : ''}`),
      sanitizeCsvCell(i.holdingLocation), sanitizeCsvCell(i.status), sanitizeCsvCell(formatDateDDMMYYYY(i.dateLostOrFound)),
    ]);
    const link = document.createElement('a');
    link.href = encodeURI('data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n'));
    link.download = `nilefound_campus_audit_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showNotification('Audit log exported as CSV for Nile University Student Affairs.');
  };

  if (!hasAccess || !currentUser) {
    return (
      <div className={`max-w-md mx-auto my-12 p-8 text-center space-y-4 ${CARD}`}>
        <div className="w-12 h-12 rounded-[10px] bg-[#FAF6EF] dark:bg-[#141311] text-[#0F6E6E] dark:text-[#199595] flex items-center justify-center mx-auto border border-[#E6DFD2] dark:border-[#2E2A24]">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h3 className="font-serif font-bold text-base tracking-tight">Restricted Administrator Area</h3>
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

  const tabClass = (tab: typeof activeTab) =>
    `py-3 px-3.5 font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap min-h-[44px] cursor-pointer ${
      activeTab === tab
        ? 'border-[#0F6E6E] dark:border-[#199595] text-[#0F6E6E] dark:text-[#199595] font-bold'
        : 'border-transparent text-[#544E45] dark:text-[#B8B0A2] hover:text-[#1F1B16] dark:hover:text-[#F5F1EA]'
    }`;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className={`${CARD} p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-5`}>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="bg-[#E7F3F3] dark:bg-[#0D2D2D] text-[#0F6E6E] dark:text-[#199595] font-semibold text-xs px-2.5 py-0.5 rounded-[10px] border border-[#0F6E6E]/20 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              {isAdmin ? 'Campus Administrator' : 'Restricted Access'}
            </span>
            <span className="text-xs text-[#7A7266] dark:text-[#857D71] font-mono">Project owner</span>
          </div>
          <h2 className="font-serif text-xl font-bold tracking-tight">NileFound Operations & Custody Desk</h2>
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
            <Archive className="w-4 h-4 text-[#7A7266] dark:text-[#B8B0A2]" />
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

      {/* KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Pending Claims', value: pendingClaims.length, color: 'text-[#E8A317]', sub: pendingClaims.length === 0 ? 'Queue is clear' : 'Awaiting review' },
          { label: 'Physical Custody', value: physicalCustodyItems.length, color: 'text-[#0F6E6E] dark:text-[#199595]', sub: 'At Security Gate & Desks' },
          { label: 'Reunited Items', value: stats.totalReturned, color: 'text-[#2F7D4F] dark:text-[#75CE9A]', sub: 'Confirmed returned' },
          { label: 'Total Tracked', value: items.length, color: 'text-[#1F1B16] dark:text-[#F5F1EA]', sub: 'Lost and found posts' },
        ].map((kpi) => (
          <div key={kpi.label} className={`${CARD} p-4 sm:p-5 text-left`}>
            <span className="text-xs font-medium text-[#7A7266] dark:text-[#857D71]">{kpi.label}</span>
            <div className={`text-2xl sm:text-3xl font-serif font-bold mt-1 ${kpi.color}`}>{kpi.value}</div>
            <span className="text-xs text-[#7A7266] dark:text-[#857D71] mt-0.5 block">{kpi.sub}</span>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#E6DFD2] dark:border-[#2E2A24] gap-2 text-xs overflow-x-auto scrollbar-none">
        <button onClick={() => setActiveTab('claims')} className={tabClass('claims')}>
          <span>Claim Requests Queue</span>
          <span className="bg-[#FEF7E9] dark:bg-[#2B210A] text-[#7A5000] dark:text-[#F9CF7C] text-xs px-2 py-0.5 rounded-full font-bold">
            {pendingClaims.length}
          </span>
        </button>
        <button onClick={() => setActiveTab('custody')} className={tabClass('custody')}>
          <span>Gate Custody Ledger</span>
          <span className="bg-[#FAF6EF] dark:bg-[#28241F] border border-[#E6DFD2] dark:border-[#2E2A24] text-[#544E45] dark:text-[#B8B0A2] text-xs px-2 py-0.5 rounded-full font-medium">
            {physicalCustodyItems.length}
          </span>
        </button>
        <button onClick={() => setActiveTab('all_items')} className={tabClass('all_items')}>
          <span>All Campus Items ({items.length})</span>
        </button>
        <button onClick={() => setActiveTab('roles')} className={tabClass('roles')}>
          <UserCheck className="w-4 h-4 text-[#0F6E6E] dark:text-[#199595]" />
          <span>Staff Roles & Security</span>
        </button>
        {canUsePersonaSimulation && (
          <button onClick={() => setActiveTab('personas')} className={tabClass('personas')}>
            <ShieldCheck className="w-4 h-4 text-[#0F6E6E] dark:text-[#199595]" />
            <span>Test Personas</span>
          </button>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {pendingDelete && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-3" role="dialog" aria-modal="true" aria-labelledby="delete-title">
          <div className={`w-full max-w-[480px] p-5 shadow-xl ${CARD}`}>
            <h2 id="delete-title" className="text-sm font-bold">Delete this item?</h2>
            <p className="mt-2 text-xs text-[#544E45] dark:text-[#B8B0A2]">This permanently removes “{pendingDelete.title}”.</p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setPendingDelete(null)} className="min-h-[44px] rounded-[10px] border border-[#E6DFD2] dark:border-[#2E2A24] px-4 text-xs cursor-pointer">
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
                className="min-h-[44px] rounded-[10px] bg-[#9B1C1C] px-4 text-xs font-medium text-white cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 1: Claims Review Queue */}
      {activeTab === 'claims' && (
        <div className="space-y-4">
          {pendingClaims.length === 0 ? (
            <div className={`${CARD} p-10 text-center space-y-2`}>
              <CheckCircle className="w-10 h-10 text-[#0F6E6E] dark:text-[#199595] mx-auto" />
              <h4 className="font-serif font-bold text-base">No pending claims</h4>
              <p className="text-xs text-[#7A7266] dark:text-[#857D71]">All submitted claims have been processed.</p>
            </div>
          ) : (
            pendingClaims.map((claim) => {
              const matchedItem = items.find((i) => i.id === claim.itemId);
              return (
                <div key={claim.id} className={`${CARD} p-5 space-y-4 hover:border-[#0F6E6E]/40 transition-colors`}>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E6DFD2] dark:border-[#2E2A24] pb-4">
                    <div>
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="font-serif font-bold text-base">{claim.itemTitle}</span>
                        <span className="text-xs font-mono font-bold uppercase bg-[#FEF7E9] dark:bg-[#2B210A] text-[#7A5000] dark:text-[#F9CF7C] border border-[#E8A317]/30 px-2 py-0.5 rounded-full">
                          Pending Review
                        </span>
                      </div>
                      <p className="text-xs text-[#544E45] dark:text-[#B8B0A2] mt-1">
                        Claimed by <strong className="text-[#1F1B16] dark:text-[#F5F1EA]">{claim.claimantName}</strong> ({claim.claimantEmail}) on {formatDateDDMMYYYY(claim.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2.5 shrink-0">
                      <button
                        onClick={() => {
                          onApproveClaim(claim.id, claim.itemId);
                          showNotification(`Approved claim for ${claim.claimantName}. Item marked as returned.`);
                        }}
                        className="flex items-center gap-2 bg-[#0F6E6E] hover:bg-[#0C5656] text-white text-xs font-semibold px-4 py-2.5 rounded-[10px] transition-colors min-h-[44px] cursor-pointer btn-campus"
                      >
                        <CheckCircle className="w-4 h-4" />
                        <span>Approve & Return</span>
                      </button>
                      <button
                        onClick={() => {
                          onRejectClaim(claim.id);
                          showNotification(`Rejected claim from ${claim.claimantName}.`);
                        }}
                        className="flex items-center gap-2 bg-white dark:bg-[#28241F] hover:bg-[#FDF2F2] dark:hover:bg-[#2B0E0E] text-[#9B1C1C] dark:text-[#F87171] text-xs font-semibold px-4 py-2.5 rounded-[10px] border border-[#F87171]/40 transition-colors min-h-[44px] cursor-pointer btn-campus"
                      >
                        <XCircle className="w-4 h-4" />
                        <span>Reject</span>
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs bg-[#FAF6EF] dark:bg-[#141311] p-4 rounded-[10px] border border-[#E6DFD2] dark:border-[#2E2A24]">
                    <div>
                      <span className="font-bold text-[#7A7266] dark:text-[#857D71] block mb-1.5 uppercase tracking-wider">Item Details & Question:</span>
                      <p className="text-[#544E45] dark:text-[#B8B0A2] leading-relaxed">{matchedItem?.description || 'No public description.'}</p>
                      {matchedItem?.verificationQuestion && (
                        <p className="mt-2 text-[#0F6E6E] dark:text-[#199595] font-medium">
                          <strong>Question:</strong> {matchedItem.verificationQuestion}
                        </p>
                      )}
                    </div>
                    <div>
                      <span className="font-bold text-[#7A7266] dark:text-[#857D71] block mb-1.5 uppercase tracking-wider">Claimant Submitted Answer:</span>
                      <p className="bg-white dark:bg-[#1E1C18] p-3 rounded-[10px] border border-[#E6DFD2] dark:border-[#2E2A24] font-mono text-xs leading-relaxed">
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
          <div className={`${CARD} p-5 flex items-center justify-between gap-3`}>
            <div>
              <h3 className="font-serif font-bold text-base">Nile University Gate Custody Ledger</h3>
              <p className="text-xs text-[#544E45] dark:text-[#B8B0A2] mt-0.5">
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
              <p className="text-xs text-[#7A7266] dark:text-[#B8B0A2]">Found items handed to Security Gate, Library, or Student Affairs will appear here.</p>
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
                <p className="text-xs text-[#544E45] dark:text-[#B8B0A2] line-clamp-2 leading-relaxed">{item.description}</p>
                <div className="flex items-center justify-between text-xs text-[#7A7266] dark:text-[#857D71] pt-2 border-t border-[#E6DFD2] dark:border-[#2E2A24]">
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-[#0F6E6E] dark:text-[#199595]" />
                    <span>{item.location}</span>
                  </span>
                  <span>Logged: {formatDateDDMMYYYY(item.dateLostOrFound)}</span>
                </div>
              </div>
            ))}
          </div>
          )}
        </div>
      )}

      {/* TAB 3: All Campus Items */}
      {activeTab === 'all_items' && (
        <div className={`${CARD} overflow-hidden`}>
          <div className="p-5 border-b border-[#E6DFD2] dark:border-[#2E2A24] flex items-center justify-between">
            <div>
              <h3 className="font-serif font-bold text-base">Master Inventory Control</h3>
              <p className="text-xs text-[#544E45] dark:text-[#B8B0A2] mt-0.5">Update status or purge listings from the system.</p>
            </div>
            <span className="text-xs text-[#7A7266] dark:text-[#857D71] font-mono">Total: {items.length}</span>
          </div>

          <div className="divide-y divide-[#E6DFD2] dark:divide-[#2E2A24] text-xs">
            {items.length === 0 ? (
              <div className="p-8 text-center text-[#7A7266] dark:text-[#857D71]">No items currently logged.</div>
            ) : (
              items.map((item) => (
                <div
                  key={item.id}
                  onClick={() => isAdmin && setSelectedItem(item)}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#FAF6EF] dark:hover:bg-[#141311]/70 transition-colors cursor-pointer"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded uppercase ${
                        item.type === 'found'
                          ? 'bg-[#EDF7F1] dark:bg-[#0E2417] text-[#1B5633] dark:text-[#75CE9A]'
                          : 'bg-[#FEF7E9] dark:bg-[#2B210A] text-[#7A5000] dark:text-[#F9CF7C]'
                      }`}>
                        {item.type}
                      </span>
                      <span className="font-serif font-bold text-sm">{item.title}</span>
                    </div>
                    <p className="text-xs text-[#544E45] dark:text-[#B8B0A2] mt-1">
                      {item.location} • Status: <strong className="text-[#1F1B16] dark:text-[#F5F1EA]">{item.status}</strong> •{' '}
                      <span className="text-[#0F6E6E] dark:text-[#199595] underline">Click to inspect full details</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-2.5 w-full sm:w-auto" onClick={(e) => e.stopPropagation()}>
                    <select
                      aria-label={`Status for ${item.title}`}
                      value={item.status}
                      onChange={(e) => onUpdateItemStatus(item.id, e.target.value as CampusItem['status'])}
                      className="flex-1 sm:flex-initial bg-white dark:bg-[#141311] text-[#1F1B16] dark:text-[#F5F1EA] border border-[#E6DFD2] dark:border-[#2E2A24] rounded-[10px] px-3 py-2 text-xs focus:border-[#0F6E6E] focus:outline-hidden min-h-[44px] cursor-pointer"
                    >
                      <option value="open">Open</option>
                      <option value="claim_requested">Claim Pending</option>
                      <option value="returned">Returned / Reunited</option>
                      <option value="expired">Expired</option>
                    </select>

                    <button
                      onClick={() => setPendingDelete(item)}
                      className="text-[#7A7266] hover:text-[#9B1C1C] dark:hover:text-[#F87171] p-2 min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors cursor-pointer"
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

      {/* TAB 4: Staff Roles & Security (By Email — no Firebase UID needed) */}
      {activeTab === 'roles' && (
        <div className="space-y-6">
          {isAdmin ? (
            <div className={`${CARD} p-6 space-y-4`}>
              <div>
                <h3 className="font-serif font-bold text-base">Provision Staff or Security Role</h3>
                <p className="text-xs text-[#544E45] dark:text-[#B8B0A2] mt-1 leading-relaxed">
                  Enter a staff member’s Nile University email to grant administrator or security officer access.
                </p>
              </div>

              <form onSubmit={handleAssignRole} className="grid grid-cols-1 md:grid-cols-[1fr_220px_auto] gap-3.5 items-end">
                <div>
                  <label htmlFor="staff-email-input" className="block text-xs font-medium text-[#544E45] dark:text-[#B8B0A2] mb-1.5">
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
                  <label htmlFor="staff-role-select" className="block text-xs font-medium text-[#544E45] dark:text-[#B8B0A2] mb-1.5">
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
                  className="min-h-[44px] bg-[#0F6E6E] hover:bg-[#0C5656] disabled:opacity-50 text-white font-semibold text-xs py-2.5 px-5 rounded-[10px] transition-colors flex items-center justify-center gap-2 cursor-pointer btn-campus"
                >
                  <Plus className="w-4 h-4" />
                  <span>{isSavingRole ? 'Saving...' : 'Assign Role'}</span>
                </button>
              </form>
            </div>
          ) : (
            <div className="bg-[#FEF7E9] dark:bg-[#2B210A] border border-[#E8A317]/40 text-[#7A5000] dark:text-[#F9CF7C] p-5 rounded-[12px] text-xs">
              <span className="font-bold">Role Provisioning Restricted:</span> Only the project owner is authorized to assign new administrator or campus security roles.
            </div>
          )}

          {/* Active System Roles */}
          <div className={`${CARD} overflow-hidden`}>
            <div className="p-5 border-b border-[#E6DFD2] dark:border-[#2E2A24] flex items-center justify-between">
              <div>
                <h4 className="font-serif font-bold text-sm">Active System Roles</h4>
                <p className="text-xs text-[#7A7266] dark:text-[#857D71] mt-0.5">Persisted in Cloud Firestore security rules</p>
              </div>
              <button
                onClick={loadRoles}
                className="text-xs text-[#0F6E6E] dark:text-[#199595] font-semibold hover:underline flex items-center gap-1.5 min-h-[44px] px-3 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingRoles ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>

            <div className="divide-y divide-[#E6DFD2] dark:divide-[#2E2A24] text-xs">
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
                    <p className="text-xs text-[#7A7266] dark:text-[#857D71] font-mono mt-0.5">Project owner</p>
                  </div>
                </div>
                <span className="text-xs text-[#0F6E6E] dark:text-[#199595] font-mono font-semibold">Active & Root</span>
              </div>

              {roleRecords.length === 0 ? (
                <div className="p-6 text-center text-[#7A7266] dark:text-[#857D71]">No additional staff roles provisioned yet.</div>
              ) : (
                roleRecords.map((r) => (
                  <div key={r.uid} className="p-4 sm:p-5 flex items-center justify-between gap-3 hover:bg-[#FAF6EF]/40 dark:hover:bg-[#141311]/40 transition-colors">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">{r.email || 'Campus Staff'}</span>
                        <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full uppercase bg-[#FAF6EF] dark:bg-[#141311] text-[#544E45] dark:text-[#B8B0A2] border border-[#E6DFD2] dark:border-[#2E2A24]">
                          {r.role}
                        </span>
                        {r.pending && (
                          <span className="text-xs text-[#7A5000] dark:text-[#F9CF7C] bg-[#FEF7E9] dark:bg-[#2B210A] px-2 py-0.5 rounded-full">
                            Pending first sign-in
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-[#7A7266] dark:text-[#857D71] shrink-0">Assigned by {r.assignedBy || 'Admin'}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: Test Personas */}
      {activeTab === 'personas' && isAdmin && (
        <div className="space-y-6">
          <div className={`${CARD} p-6 space-y-2`}>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h3 className="font-serif font-bold text-base flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#0F6E6E] dark:text-[#199595]" />
                Root Admin Persona Switcher & Test Accounts
              </h3>
              <span className="text-xs bg-[#E7F3F3] dark:bg-[#0D2D2D] text-[#0F6E6E] dark:text-[#199595] border border-[#0F6E6E]/30 font-mono font-bold px-2.5 py-0.5 rounded-full">
                Project owner only
              </span>
            </div>
            <p className="text-xs text-[#544E45] dark:text-[#B8B0A2] leading-relaxed">
              These test personas allow you, as the primary administrator, to preview and audit the portal from the perspective of students, security gate personnel, and departmental staff. All other users cannot see or access these accounts.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {TEST_PERSONAS.map((persona) => (
              <div key={persona.user.id} className={`${CARD} p-5 space-y-4 hover:border-[#0F6E6E]/40 transition-colors flex flex-col justify-between`}>
                <div className="space-y-2.5 min-w-0">
                  <div className={`w-10 h-10 rounded-[10px] flex items-center justify-center font-bold text-sm border ${persona.badgeClass}`}>
                    {persona.initial}
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-serif font-bold text-sm">{persona.user.name.replace(/ \(.*\)$/, '')}</h4>
                    <span className="text-xs font-mono font-bold uppercase text-[#0F6E6E] dark:text-[#199595]">{persona.badge}</span>
                    <p className="text-xs text-[#7A7266] dark:text-[#B8B0A2] font-mono truncate">{persona.user.email}</p>
                  </div>
                  <p className="text-xs text-[#544E45] dark:text-[#B8B0A2] leading-relaxed">{persona.description}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onSwitchPersona?.(persona.user);
                    showNotification(`Switched persona to ${persona.user.name}.`);
                  }}
                  className="w-full py-2.5 px-4 bg-[#FAF6EF] dark:bg-[#28241F] hover:bg-[#E7F3F3] dark:hover:bg-[#332E27] text-[#1F1B16] dark:text-[#F5F1EA] rounded-[10px] text-xs font-semibold border border-[#E6DFD2] dark:border-[#2E2A24] transition-colors cursor-pointer min-h-[44px] btn-campus"
                >
                  {persona.buttonLabel}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Admin Item Detail Panel Modal */}
      {selectedItem && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/50 backdrop-blur-xs overflow-y-auto" onClick={() => setSelectedItem(null)}>
          <div className={`w-full max-w-[672px] shadow-xl max-h-[90dvh] overflow-hidden flex flex-col min-w-0 ${CARD}`} onClick={(e) => e.stopPropagation()}>
            <div className="bg-[#FAF6EF] dark:bg-[#141311] px-5 sm:px-6 py-4 border-b border-[#E6DFD2] dark:border-[#2E2A24] flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className={selectedItem.type === 'found' ? 'stamp-found' : 'stamp-lost'}>{selectedItem.type}</span>
                <h3 className="font-serif font-bold text-base truncate">{selectedItem.title}</h3>
              </div>
              <button onClick={() => setSelectedItem(null)} className="text-[#7A7266] hover:text-[#1F1B16] dark:hover:text-[#F5F1EA] p-1.5 rounded-[10px] cursor-pointer" aria-label="Close item details">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 sm:p-6 space-y-4 min-h-0 flex-1 overflow-y-auto text-xs">
              {selectedItem.imageUrl && (
                <div className="rounded-[10px] overflow-hidden bg-[#FAF6EF] dark:bg-[#141311] border border-[#E6DFD2] dark:border-[#2E2A24]">
                  <img src={selectedItem.imageUrl} alt={selectedItem.title} className="w-full max-h-96 object-contain mx-auto" loading="lazy" decoding="async" width={640} height={360} />
                </div>
              )}

              <div className="bg-[#FAF6EF] dark:bg-[#141311] border border-[#E6DFD2] dark:border-[#2E2A24] rounded-[10px] p-4 space-y-1.5">
                <span className="text-xs font-medium uppercase text-[#7A7266] dark:text-[#857D71]">Full Description</span>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{selectedItem.description}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { icon: Tag, label: 'Category', value: selectedItem.category },
                  { icon: MapPin, label: 'Campus Location', value: selectedItem.location },
                  { icon: Calendar, label: 'Date Lost / Found', value: formatDateDDMMYYYY(selectedItem.dateLostOrFound) },
                  { icon: ShieldCheck, label: 'Held-At Location', value: selectedItem.holdingLocation },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} className="bg-[#FAF6EF] dark:bg-[#141311] border border-[#E6DFD2] dark:border-[#2E2A24] rounded-[10px] p-3.5 space-y-1">
                    <span className="text-xs uppercase text-[#7A7266] dark:text-[#857D71] flex items-center gap-1 font-medium">
                      <Icon className="w-3 h-3 text-[#0F6E6E] dark:text-[#199595]" /> {label}
                    </span>
                    <p className="font-semibold">{value}</p>
                  </div>
                ))}
                <div className="bg-[#FAF6EF] dark:bg-[#141311] border border-[#E6DFD2] dark:border-[#2E2A24] rounded-[10px] p-3.5 space-y-1">
                  <span className="text-xs uppercase text-[#7A7266] dark:text-[#857D71] font-medium">Status</span>
                  <p className="font-semibold text-[#0F6E6E] dark:text-[#199595] uppercase">{selectedItem.status}</p>
                </div>
                <div className="bg-[#FAF6EF] dark:bg-[#141311] border border-[#E6DFD2] dark:border-[#2E2A24] rounded-[10px] p-3.5 space-y-1">
                  <span className="text-xs uppercase text-[#7A7266] dark:text-[#857D71] flex items-center gap-1 font-medium">
                    <Clock className="w-3 h-3 text-[#0F6E6E] dark:text-[#199595]" /> Created Time
                  </span>
                  <p className="font-mono">{new Date(selectedItem.createdAt).toLocaleString('en-GB')}</p>
                </div>
              </div>

              <div className="bg-[#FAF6EF] dark:bg-[#141311] border border-[#0F6E6E]/30 rounded-[10px] p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase text-[#0F6E6E] dark:text-[#199595]">
                    Admin-Only Private Reporter & Verification Details
                  </span>
                  {isLoadingPrivate && <span className="text-xs text-[#7A7266] dark:text-[#857D71]">Loading...</span>}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <span className="text-xs text-[#7A7266] dark:text-[#857D71] flex items-center gap-1"><UserIcon className="w-3 h-3" /> Reporter Name</span>
                    <p className="font-semibold mt-0.5">{privateDetails.authorName || 'Not recorded'}</p>
                  </div>
                  <div>
                    <span className="text-xs text-[#7A7266] dark:text-[#857D71] flex items-center gap-1"><Mail className="w-3 h-3" /> Reporter Email</span>
                    <p className="font-mono mt-0.5">{privateDetails.authorEmail || 'Not recorded'}</p>
                  </div>
                </div>
                {selectedItem.verificationQuestion && (
                  <div className="pt-2 border-t border-[#E6DFD2] dark:border-[#2E2A24] space-y-1">
                    <p className="text-[#544E45] dark:text-[#B8B0A2]">
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
                  <p className="text-[#7A7266] dark:text-[#857D71] bg-[#FAF6EF] dark:bg-[#141311] border border-[#E6DFD2] dark:border-[#2E2A24] rounded-[10px] p-3.5">
                    No claims submitted for this item yet.
                  </p>
                ) : (
                  claims.filter((c) => c.itemId === selectedItem.id).map((claim) => (
                    <div key={claim.id} className="bg-[#FAF6EF] dark:bg-[#141311] border border-[#E6DFD2] dark:border-[#2E2A24] rounded-[10px] p-3.5 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-semibold">{claim.claimantName}</span>
                          <span className="text-[#7A7266] ml-2 font-mono text-xs">({claim.claimantEmail})</span>
                        </div>
                        <span className="text-xs font-semibold uppercase px-2 py-0.5 rounded-[10px] bg-white dark:bg-[#1E1C18] border border-[#E6DFD2] dark:border-[#2E2A24] text-[#0F6E6E] dark:text-[#199595]">
                          {claim.status}
                        </span>
                      </div>
                      <p className="text-[#544E45] dark:text-[#B8B0A2]">
                        <strong className="text-[#1F1B16] dark:text-[#F5F1EA]">Submitted Answer:</strong> {claim.submittedAnswer}
                      </p>
                      {claim.status === 'pending' && (
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            onClick={() => {
                              onApproveClaim(claim.id, selectedItem.id);
                              showNotification(`Approved claim for ${selectedItem.title}.`);
                            }}
                            className="bg-[#2F7D4F] hover:bg-[#266841] text-white font-medium px-3 py-1.5 rounded-[10px] text-xs cursor-pointer btn-campus shadow-xs"
                          >
                            Approve Claim
                          </button>
                          <button
                            onClick={() => {
                              onRejectClaim(claim.id);
                              showNotification('Rejected claim.');
                            }}
                            className="bg-white dark:bg-[#28241F] hover:bg-[#FAF6EF] text-[#9B1C1C] dark:text-[#F87171] border border-[#F87171]/40 font-medium px-3 py-1.5 rounded-[10px] text-xs cursor-pointer btn-campus"
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

            <div className="bg-[#FAF6EF] dark:bg-[#141311] px-5 sm:px-6 py-4 border-t border-[#E6DFD2] dark:border-[#2E2A24] flex flex-wrap items-center justify-between gap-3">
              <button
                onClick={() => {
                  onUpdateItemStatus(selectedItem.id, 'returned');
                  setSelectedItem({ ...selectedItem, status: 'returned' });
                  showNotification(`Marked "${selectedItem.title}" as Resolved / Returned.`);
                }}
                disabled={selectedItem.status === 'returned'}
                className="bg-[#2F7D4F] hover:bg-[#266841] disabled:opacity-50 text-white font-medium px-4 py-2.5 rounded-[10px] text-xs flex items-center gap-2 cursor-pointer min-h-[44px] btn-campus shadow-xs"
              >
                <CheckCircle className="w-4 h-4" />
                <span>{selectedItem.status === 'returned' ? 'Resolved (Returned)' : 'Mark Resolved'}</span>
              </button>
              <button
                onClick={() => setPendingDelete(selectedItem)}
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
