/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * NileFound Admin Panel
 * Layout: Operational summary metrics, claims approval queue, custody ledger, and post moderation.
 * Main Action: Review verification answers, approve/reject claims, and audit physical custody items.
 */

import React, { useState } from 'react';
import { 
  ShieldAlert, 
  CheckCircle, 
  XCircle, 
  Trash2, 
  Archive, 
  Download, 
  Check, 
  KeyRound
} from 'lucide-react';
import { CampusItem, ClaimRecord, User } from '../types/index.ts';
import { generateCampusAuditReport } from '../utils/admin.ts';
import { formatDateDDMMYYYY } from '../utils/dateFormatter.ts';

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
  const [activeTab, setActiveTab] = useState<'claims' | 'custody' | 'all_items'>('claims');
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Check permissions
  const isAdmin = currentUser?.role === 'admin' || currentUser?.isAdmin;
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
    setTimeout(() => setActionNotice(null), 3000);
  };

  const exportAuditLogCsv = () => {
    const headers = ['ID', 'Type', 'Title', 'Category', 'Location', 'Holding Desk', 'Status', 'Date Reported'];
    const rows = items.map(i => [
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
    showNotification('Audit log exported as CSV for Student Affairs.');
  };

  if (!hasAccess) {
    return (
      <div className="max-w-md mx-auto my-12 p-6 bg-white rounded-xl border border-stone-200 text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h3 className="font-bold text-stone-900 text-base">Restricted Administrator Area</h3>
        <p className="text-xs text-stone-600 leading-relaxed">
          This panel is restricted to verified administrators and Nile University Campus Security officers.
        </p>
        <button
          onClick={onNavigateToLogin}
          className="bg-emerald-800 text-white text-xs font-bold px-4 py-2 rounded-lg hover:bg-emerald-900 transition-colors"
        >
          Sign In to Authorized Account
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-emerald-950 text-white rounded-xl p-5 border border-emerald-900 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider mb-1">
            <KeyRound className="w-4 h-4" />
            <span>Admin Panel</span>
          </div>
          <h2 className="text-lg font-bold">Campus Custody & Verification Management</h2>
          <p className="text-xs text-emerald-200/90 mt-0.5 leading-relaxed">
            Signed in as <strong>{currentUser.name}</strong> ({currentUser.email}). Verify claims, audit gate-held items, and export records.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={exportAuditLogCsv}
            className="flex items-center gap-1.5 bg-emerald-800 hover:bg-emerald-700 text-white text-xs font-semibold px-3 py-2 rounded-lg border border-emerald-700 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={() => {
              onExpireOldItems();
              showNotification('Evaluated items: posts older than 60 days marked as expired.');
            }}
            className="flex items-center gap-1.5 bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold px-3 py-2 rounded-lg transition-colors"
            title="Auto-expire posts older than 60 days"
          >
            <Archive className="w-3.5 h-3.5" />
            <span>Auto-Expire (&gt;60d)</span>
          </button>
        </div>
      </div>

      {actionNotice && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs p-3 rounded-lg flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-700 shrink-0" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* KPI Stats Grid - real records only; "No data yet" when empty */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-xl border border-stone-200 text-left">
          <span className="text-[11px] font-bold text-stone-500 uppercase">Pending Claims</span>
          <div className="text-2xl font-extrabold text-amber-600 font-mono mt-1">
            {claims.length === 0 ? 'No data yet' : stats.pendingClaims}
          </div>
          <span className="text-[10px] text-stone-400">
            {claims.length === 0 ? 'No claims submitted' : 'Awaiting review'}
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-stone-200 text-left">
          <span className="text-[11px] font-bold text-stone-500 uppercase">At Main Gate Desk</span>
          <div className="text-2xl font-extrabold text-emerald-900 font-mono mt-1">
            {items.length === 0 ? 'No data yet' : stats.heldAtGate}
          </div>
          <span className="text-[10px] text-stone-400">
            {items.length === 0 ? 'No items recorded' : 'Physical custody'}
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-stone-200 text-left">
          <span className="text-[11px] font-bold text-stone-500 uppercase">Reunited Items</span>
          <div className="text-2xl font-extrabold text-stone-900 font-mono mt-1">
            {items.length === 0 ? 'No data yet' : stats.totalReturned}
          </div>
          <span className="text-[10px] text-stone-400">
            {items.length === 0 ? 'No returns yet' : 'Verified handovers'}
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-stone-200 text-left">
          <span className="text-[11px] font-bold text-stone-500 uppercase">Return Rate</span>
          <div className="text-2xl font-extrabold text-emerald-700 font-mono mt-1">
            {stats.totalFound === 0 ? 'No data yet' : `${stats.returnRate}%`}
          </div>
          <span className="text-[10px] text-stone-400">
            Target: &gt;= 45% (to be validated)
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-stone-200 gap-2 text-xs">
        <button
          onClick={() => setActiveTab('claims')}
          className={`py-2 px-3 font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === 'claims'
              ? 'border-emerald-700 text-emerald-900'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          <span>Claim Requests Queue</span>
          <span className="bg-amber-100 text-amber-900 font-mono text-[10px] px-1.5 py-0.2 rounded-full font-bold">
            {pendingClaims.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('custody')}
          className={`py-2 px-3 font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === 'custody'
              ? 'border-emerald-700 text-emerald-900'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          <span>Gate & Facility Custody Ledger</span>
          <span className="bg-stone-100 text-stone-700 font-mono text-[10px] px-1.5 py-0.2 rounded-full font-bold">
            {physicalCustodyItems.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('all_items')}
          className={`py-2 px-3 font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === 'all_items'
              ? 'border-emerald-700 text-emerald-900'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          <span>All Campus Items ({items.length})</span>
        </button>
      </div>

      {/* TAB 1: Claims Review Queue */}
      {activeTab === 'claims' && (
        <div className="space-y-4">
          {pendingClaims.length === 0 ? (
            <div className="bg-white rounded-xl border border-stone-200 p-8 text-center space-y-2">
              <CheckCircle className="w-8 h-8 text-emerald-600 mx-auto" />
              <h4 className="font-bold text-stone-800 text-sm">No pending claims</h4>
              <p className="text-xs text-stone-500">All submitted claims have been processed.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {pendingClaims.map((claim) => {
                const item = items.find((i) => i.id === claim.itemId);
                return (
                  <div key={claim.id} className="bg-white rounded-xl border border-stone-200 p-4 shadow-xs space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-100 pb-2">
                      <div>
                        <span className="text-[10px] font-bold text-amber-700 uppercase bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                          Claim for: {claim.itemTitle}
                        </span>
                        <div className="text-xs text-stone-600 mt-1">
                          Claimant: <strong className="text-stone-900">{claim.claimantName}</strong> ({claim.claimantEmail})
                        </div>
                      </div>

                      <span className="text-[11px] text-stone-400">
                        {formatDateDDMMYYYY(claim.createdAt)}
                      </span>
                    </div>

                    {/* Compare question vs claimant answer */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-stone-50 p-3 rounded-lg border border-stone-200">
                      <div>
                        <span className="text-[10px] font-bold text-stone-500 uppercase block">
                          Finder's Verification Question:
                        </span>
                        <p className="text-stone-800 font-medium mt-0.5">
                          "{item?.verificationQuestion || 'No question set'}"
                        </p>
                      </div>

                      <div>
                        <span className="text-[10px] font-bold text-emerald-800 uppercase block">
                          Claimant's Submitted Answer:
                        </span>
                        <p className="text-stone-900 font-bold bg-white p-2 rounded border border-stone-200 mt-0.5">
                          "{claim.submittedAnswer}"
                        </p>
                      </div>
                    </div>

                    {/* Admin Actions */}
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        onClick={() => {
                          onRejectClaim(claim.id);
                          showNotification(`Rejected claim from ${claim.claimantName}.`);
                        }}
                        className="flex items-center gap-1 px-3 py-1.5 bg-stone-100 hover:bg-rose-50 hover:text-rose-700 text-stone-700 text-xs font-semibold rounded-lg border border-stone-200 transition-colors"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Reject Claim</span>
                      </button>

                      <button
                        onClick={() => {
                          onApproveClaim(claim.id, claim.itemId);
                          showNotification(`Approved! ${claim.claimantName} verified as rightful owner.`);
                        }}
                        className="flex items-center gap-1 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-lg shadow-xs transition-colors"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>Approve & Verify Ownership</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Physical Custody Ledger */}
      {activeTab === 'custody' && (
        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden shadow-xs">
          <div className="p-4 border-b border-stone-200 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-stone-900 text-sm">Physical Gate & Facility Custody Ledger</h3>
              <p className="text-xs text-stone-500 mt-0.5">
                Items deposited in physical storage (Main Gate Security desk, Library desk, Student Affairs).
              </p>
            </div>
            <span className="text-xs bg-emerald-50 text-emerald-800 font-bold px-2 py-1 rounded border border-emerald-200">
              {physicalCustodyItems.length} Physical Records
            </span>
          </div>

          {physicalCustodyItems.length === 0 ? (
            <div className="p-8 text-center text-xs text-stone-500">
              No items currently held in physical campus facility custody.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-stone-50 text-stone-700 border-b border-stone-200">
                    <th className="py-2.5 px-3 font-semibold">Item</th>
                    <th className="py-2.5 px-3 font-semibold">Custody Desk</th>
                    <th className="py-2.5 px-3 font-semibold">Campus Location</th>
                    <th className="py-2.5 px-3 font-semibold">Status</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 text-stone-700">
                  {physicalCustodyItems.map((item) => (
                    <tr key={item.id} className="hover:bg-stone-50/70">
                      <td className="py-3 px-3 font-semibold text-stone-900">
                        {item.title}
                      </td>
                      <td className="py-3 px-3">
                        <span className="bg-stone-100 text-stone-800 px-2 py-0.5 rounded text-[11px] font-medium">
                          {item.holdingLocation === 'security_main_gate'
                            ? 'Main Gate Security'
                            : item.holdingLocation === 'student_affairs_office'
                            ? 'Student Affairs'
                            : 'Library Desk'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-stone-600">{item.location}</td>
                      <td className="py-3 px-3">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                          item.status === 'returned'
                            ? 'bg-emerald-100 text-emerald-800'
                            : item.status === 'claim_requested'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-stone-100 text-stone-700'
                        }`}>
                          {item.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        {item.status !== 'returned' ? (
                          <button
                            onClick={() => {
                              onUpdateItemStatus(item.id, 'returned');
                              showNotification(`Marked "${item.title}" as physically returned.`);
                            }}
                            className="bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold px-2.5 py-1 rounded transition-colors"
                          >
                            Mark Handed Over
                          </button>
                        ) : (
                          <span className="text-[11px] text-emerald-700 font-semibold flex items-center justify-end gap-1">
                            <Check className="w-3.5 h-3.5" /> Reunited
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: All Items Moderation */}
      {activeTab === 'all_items' && (
        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden shadow-xs">
          <div className="p-4 border-b border-stone-200">
            <h3 className="font-bold text-stone-900 text-sm">Post Moderation & Deletion</h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Review campus reports. Remove duplicate or test posts.
            </p>
          </div>

          {items.length === 0 ? (
            <div className="p-8 text-center text-xs text-stone-500">
              No campus items reported yet.
            </div>
          ) : (
            <div className="divide-y divide-stone-100">
              {items.map((item) => (
                <div key={item.id} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-stone-50">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded uppercase ${
                        item.type === 'found' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}>
                        {item.type}
                      </span>
                      <span className="font-bold text-xs text-stone-900">{item.title}</span>
                      <span className="text-[11px] text-stone-400">({item.location})</span>
                    </div>
                    <p className="text-xs text-stone-600 line-clamp-1">{item.description}</p>
                    <span className="text-[10px] text-stone-400">Date: {formatDateDDMMYYYY(item.dateLostOrFound)}</span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <select
                      value={item.status}
                      onChange={(e) => {
                        onUpdateItemStatus(item.id, e.target.value as CampusItem['status']);
                        showNotification(`Updated status for "${item.title}" to ${e.target.value}.`);
                      }}
                      className="text-xs py-1 px-2 border border-stone-200 rounded-md bg-white font-medium"
                    >
                      <option value="open">Open</option>
                      <option value="claim_requested">Claim Requested</option>
                      <option value="verified">Verified</option>
                      <option value="returned">Returned</option>
                      <option value="expired">Expired</option>
                    </select>

                    <button
                      onClick={() => {
                        if (confirm(`Are you sure you want to delete "${item.title}"?`)) {
                          onDeleteItem(item.id);
                          showNotification(`Deleted item "${item.title}".`);
                        }
                      }}
                      className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                      title="Delete item"
                      aria-label="Delete item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
