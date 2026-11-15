import React, { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, Plus, RefreshCw, Trash2 } from 'lucide-react';
import type { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import {
  fetchRolesPage,
  assignUserRoleByEmail,
  revokeStaffRole,
  UserRoleRecord,
} from '../../services/firestoreService.ts';
import { isMasterAdminUser } from '../../utils/admin.ts';
import { validateNileEmail } from '../../utils/authValidation.ts';
import { ADMIN_CARD, ADMIN_INPUT } from './adminStyles.ts';

interface RolesTabProps {
  currentUserId?: string;
  currentUserEmail?: string;
  isAdmin: boolean;
  isMasterOwner: boolean;
  onSuccessNotice: (msg: string) => void;
  onErrorNotice: (msg: string) => void;
}

interface RoleCursors {
  admins?: QueryDocumentSnapshot<DocumentData>;
  roles?: QueryDocumentSnapshot<DocumentData>;
  invites?: QueryDocumentSnapshot<DocumentData>;
}

const mergeRoleRecords = (prev: UserRoleRecord[], next: UserRoleRecord[]) => {
  const seen = new Set(prev.map((r) => `${r.pending ? 'p' : 'a'}:${r.uid}`));
  return [...prev, ...next.filter((r) => !seen.has(`${r.pending ? 'p' : 'a'}:${r.uid}`))];
};

export const RolesTab: React.FC<RolesTabProps> = ({
  currentUserId,
  currentUserEmail,
  isAdmin,
  isMasterOwner,
  onSuccessNotice,
  onErrorNotice,
}) => {
  const [roleRecords, setRoleRecords] = useState<UserRoleRecord[]>([]);
  const [cursors, setCursors] = useState<RoleCursors>({});
  const [hasMoreRoles, setHasMoreRoles] = useState(false);
  const [isLoadingRoles, setIsLoadingRoles] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [rolesError, setRolesError] = useState<string | null>(null);
  const [newTargetEmail, setNewTargetEmail] = useState('');
  const [newTargetRole, setNewTargetRole] = useState<'admin' | 'security'>('security');
  const [isSavingRole, setIsSavingRole] = useState(false);
  const [confirmRemoveKey, setConfirmRemoveKey] = useState<string | null>(null);

  const loadRoles = useCallback(async () => {
    setIsLoadingRoles(true);
    setRolesError(null);
    setConfirmRemoveKey(null);
    try {
      const page = await fetchRolesPage({}, 25, { fetchAdmins: isMasterOwner, fetchRoles: true, fetchInvites: true });
      setRoleRecords(page.records);
      setCursors({ admins: page.nextAdminsCursor, roles: page.nextRolesCursor, invites: page.nextInvitesCursor });
      setHasMoreRoles(page.hasMore);
    } catch (err: unknown) {
      setRolesError(err instanceof Error ? err.message : 'Could not load staff roles. Check permissions and connection.');
    } finally {
      setIsLoadingRoles(false);
    }
  }, [isMasterOwner]);

  useEffect(() => {
    if (isAdmin) loadRoles();
  }, [isAdmin, loadRoles]);

  const handleLoadMoreRoles = async () => {
    if (!hasMoreRoles || isLoadingMore) return;
    setIsLoadingMore(true);
    setRolesError(null);
    try {
      const page = await fetchRolesPage(cursors, 25, {
        fetchAdmins: Boolean(cursors.admins),
        fetchRoles: Boolean(cursors.roles),
        fetchInvites: Boolean(cursors.invites),
      });
      setRoleRecords((prev) => mergeRoleRecords(prev, page.records));
      setCursors({ admins: page.nextAdminsCursor, roles: page.nextRolesCursor, invites: page.nextInvitesCursor });
      setHasMoreRoles(page.hasMore);
    } catch (err: unknown) {
      setRolesError(err instanceof Error ? err.message : 'Could not load additional roles.');
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleAssignRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isMasterOwner) return onErrorNotice('Only the project owner can add staff or admins.');
    const normalizedEmail = newTargetEmail.trim().toLowerCase();
    if (!validateNileEmail(normalizedEmail)) return onErrorNotice('Enter a valid @nileuniversity.edu.ng email.');

    setIsSavingRole(true);
    try {
      const status = await assignUserRoleByEmail(normalizedEmail, newTargetRole, currentUserEmail || 'admin');
      onSuccessNotice(
        status === 'assigned'
          ? `Assigned ${newTargetRole} access to ${normalizedEmail}.`
          : `Saved ${newTargetRole} invite for ${normalizedEmail}. It activates when they verify and sign in.`
      );
      setNewTargetEmail('');
      await loadRoles();
    } catch (err: unknown) {
      onErrorNotice(err instanceof Error ? err.message : 'Could not save role. Check permissions.');
    } finally {
      setIsSavingRole(false);
    }
  };

  const handleRemoveStaff = async (record: UserRoleRecord) => {
    if (!isMasterOwner) return;
    setIsSavingRole(true);
    try {
      await revokeStaffRole(record);
      onSuccessNotice(`Removed ${record.role} access for ${record.email || record.uid}.`);
      setConfirmRemoveKey(null);
      await loadRoles();
    } catch (err: unknown) {
      onErrorNotice(err instanceof Error ? err.message : 'Could not remove access.');
    } finally {
      setIsSavingRole(false);
    }
  };

  return (
    <div className="space-y-6">
      {isMasterOwner ? (
        <div className={`${ADMIN_CARD} p-6 space-y-4`}>
          <div>
            <h3 className="font-serif font-bold text-base">Add Admin or Security Staff</h3>
            <p className="text-sm text-[#4A443C] dark:text-[#CEC7BB] mt-1 leading-relaxed">
              Enter their @nileuniversity.edu.ng email. Access binds to their verified login automatically.
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
                required
                placeholder="officer@nileuniversity.edu.ng"
                value={newTargetEmail}
                onChange={(e) => setNewTargetEmail(e.target.value)}
                className={ADMIN_INPUT}
              />
            </div>

            <div>
              <label htmlFor="staff-role-select" className="block text-sm font-medium text-[#4A443C] dark:text-[#CEC7BB] mb-1.5">
                Role
              </label>
              <select
                id="staff-role-select"
                value={newTargetRole}
                onChange={(e) => setNewTargetRole(e.target.value as 'admin' | 'security')}
                className={`${ADMIN_INPUT} cursor-pointer`}
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
          <span className="font-bold">Role Provisioning Restricted:</span> Only the project owner can add or remove admins and security staff.
        </div>
      )}

      {rolesError && (
        <div role="alert" className="bg-[#FDF2F2] dark:bg-[#2B0E0E] border border-[#F87171]/50 text-[#9B1C1C] dark:text-[#F87171] p-4 rounded-[12px] text-sm flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{rolesError}</span>
          </div>
          <button type="button" onClick={loadRoles} className="min-h-[44px] px-3 rounded-[10px] border border-[#F87171]/50 bg-white dark:bg-[#1E1C18] text-xs font-medium cursor-pointer">
            Retry
          </button>
        </div>
      )}

      <div className={`${ADMIN_CARD} overflow-hidden`}>
        <div className="p-5 border-b border-[#C4BBAF] dark:border-[#3E3931] flex items-center justify-between">
          <div>
            <h4 className="font-serif font-bold text-sm">Active System Roles</h4>
            <p className="text-xs text-[#5C554C] dark:text-[#A8A095] mt-0.5">Admins, security officers, and pending invites</p>
          </div>
          <button type="button" onClick={loadRoles} className="text-sm text-[#0F6E6E] dark:text-[#199595] font-semibold hover:underline flex items-center gap-1.5 min-h-[44px] px-3 cursor-pointer">
            <RefreshCw className={`w-4 h-4 ${isLoadingRoles ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        <div className="divide-y divide-[#C4BBAF] dark:divide-[#3E3931] text-sm">
          <div className="p-4 sm:p-5 flex items-center justify-between bg-[#FAF6EF]/60 dark:bg-[#141311]/60">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-[#0F6E6E] text-white font-bold flex items-center justify-center text-xs">R</div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold">Project Owner (Root)</span>
                  <span className="bg-[#E7F3F3] dark:bg-[#0D2D2D] text-[#0F6E6E] dark:text-[#199595] border border-[#0F6E6E]/30 text-xs font-mono font-bold px-2 py-0.5 rounded-full uppercase">
                    Master Admin
                  </span>
                </div>
                <p className="text-xs text-[#5C554C] dark:text-[#A8A095] font-mono mt-0.5">Protected root owner</p>
              </div>
            </div>
            <span className="text-xs text-[#0F6E6E] dark:text-[#199595] font-mono font-semibold">Active &amp; Root</span>
          </div>

          {roleRecords.length === 0 ? (
            <div className="p-6 text-center text-[#5C554C] dark:text-[#A8A095]">No additional admins or security staff added yet.</div>
          ) : (
            roleRecords.map((r) => {
              const rowKey = `${r.pending ? 'p' : r.source || 'a'}-${r.uid}`;
              const canRemove = isMasterOwner && !isMasterAdminUser(r.uid) && r.uid !== currentUserId;
              const isConfirming = confirmRemoveKey === rowKey;
              return (
                <div key={rowKey} className="p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3 hover:bg-[#FAF6EF]/40 dark:hover:bg-[#141311]/40 transition-colors">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">{r.email || 'Campus Staff Member'}</span>
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full uppercase bg-[#FAF6EF] dark:bg-[#141311] text-[#4A443C] dark:text-[#CEC7BB] border border-[#C4BBAF] dark:border-[#3E3931]">
                      {r.role}
                    </span>
                    {r.pending && (
                      <span className="text-xs text-[#7A5000] dark:text-[#F9CF7C] bg-[#FEF7E9] dark:bg-[#2B210A] px-2 py-0.5 rounded-full">
                        Pending first sign-in
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="text-xs text-[#5C554C] dark:text-[#A8A095]">Added by {r.assignedBy || 'Owner'}</span>
                    {canRemove && !isConfirming && (
                      <button
                        type="button"
                        disabled={isSavingRole}
                        onClick={() => setConfirmRemoveKey(rowKey)}
                        className="min-h-[44px] px-3 rounded-[10px] border border-[#F87171]/50 text-[#9B1C1C] dark:text-[#F87171] hover:bg-[#FDF2F2] dark:hover:bg-[#2B0E0E] text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Remove</span>
                      </button>
                    )}
                    {canRemove && isConfirming && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={isSavingRole}
                          onClick={() => handleRemoveStaff(r)}
                          className="min-h-[44px] px-3 rounded-[10px] bg-[#9B1C1C] text-white text-xs font-semibold cursor-pointer disabled:opacity-60"
                        >
                          {isSavingRole ? 'Removing…' : 'Confirm remove'}
                        </button>
                        <button
                          type="button"
                          disabled={isSavingRole}
                          onClick={() => setConfirmRemoveKey(null)}
                          className="min-h-[44px] px-3 rounded-[10px] border border-[#857C70] dark:border-[#787065] text-xs font-medium cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {hasMoreRoles && (
          <div className="p-4 border-t border-[#C4BBAF] dark:border-[#3E3931] flex justify-center">
            <button
              type="button"
              disabled={isLoadingMore}
              onClick={handleLoadMoreRoles}
              className="min-h-[44px] rounded-[10px] border border-[#857C70] dark:border-[#787065] bg-white dark:bg-[#1E1C18] hover:bg-[#FAF6EF] dark:hover:bg-[#28241F] px-5 text-sm font-medium text-[#1F1B16] dark:text-[#F5F1EA] disabled:opacity-60 cursor-pointer btn-campus"
            >
              {isLoadingMore ? 'Loading more roles…' : 'Load more roles'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
