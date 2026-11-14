import React, { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, Plus, RefreshCw } from 'lucide-react';
import type { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import {
  fetchRolesPage,
  assignUserRoleByEmail,
  fetchUsersDirectoryPage,
  UserRoleRecord,
} from '../../services/firestoreService.ts';
import { reportError } from '../ErrorBoundary.tsx';
import { ADMIN_CARD, ADMIN_INPUT } from './adminStyles.ts';

interface RolesTabProps {
  currentUserId?: string;
  currentUserEmail?: string;
  isAdmin: boolean;
  isMasterOwner: boolean;
  onSuccessNotice: (msg: string) => void;
}

export const RolesTab: React.FC<RolesTabProps> = ({
  currentUserId,
  currentUserEmail,
  isAdmin,
  isMasterOwner,
  onSuccessNotice,
}) => {
  const [roleRecords, setRoleRecords] = useState<UserRoleRecord[]>([]);
  const [rolesCursor, setRolesCursor] = useState<QueryDocumentSnapshot<DocumentData> | undefined>(undefined);
  const [invitesCursor, setInvitesCursor] = useState<QueryDocumentSnapshot<DocumentData> | undefined>(undefined);
  const [hasMoreRoles, setHasMoreRoles] = useState(false);
  const [isLoadingMoreRoles, setIsLoadingMoreRoles] = useState(false);
  const [userSuggestions, setUserSuggestions] = useState<Array<{ email: string; name: string }>>([]);
  const [usersCursor, setUsersCursor] = useState<QueryDocumentSnapshot<DocumentData> | undefined>(undefined);
  const [hasMoreUsers, setHasMoreUsers] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [isLoadingRoles, setIsLoadingRoles] = useState(false);
  const [rolesError, setRolesError] = useState<string | null>(null);
  const [newTargetEmail, setNewTargetEmail] = useState('');
  const [newTargetRole, setNewTargetRole] = useState<'admin' | 'security'>('security');
  const [isSavingRole, setIsSavingRole] = useState(false);

  const loadRoles = useCallback(async () => {
    setIsLoadingRoles(true);
    setRolesError(null);
    setUsersError(null);
    try {
      const rolesPage = await fetchRolesPage(undefined, undefined, 25, true, true);
      setRoleRecords(rolesPage.records);
      setRolesCursor(rolesPage.nextRolesCursor);
      setInvitesCursor(rolesPage.nextInvitesCursor);
      setHasMoreRoles(rolesPage.hasMore);
    } catch (err: unknown) {
      setRolesError(err instanceof Error ? err.message : 'Could not load staff roles. Check permissions and connection.');
    }

    if (isAdmin) {
      try {
        const usersPage = await fetchUsersDirectoryPage(undefined, 25);
        setUserSuggestions(usersPage.users.map((u) => ({ email: u.email, name: u.name })));
        setUsersCursor(usersPage.nextCursor);
        setHasMoreUsers(usersPage.hasMore);
      } catch (err: unknown) {
        reportError('fetchUsersDirectoryPage failed', err);
        setUsersError(err instanceof Error ? err.message : 'Could not load campus email suggestions.');
      }
    }
    setIsLoadingRoles(false);
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin) loadRoles();
  }, [isAdmin, loadRoles]);

  const handleLoadMoreRoles = async () => {
    if (!hasMoreRoles || isLoadingMoreRoles) return;
    setIsLoadingMoreRoles(true);
    setRolesError(null);
    try {
      const next = await fetchRolesPage(rolesCursor, invitesCursor, 25, Boolean(rolesCursor), Boolean(invitesCursor));
      setRoleRecords((prev) => {
        const seen = new Set(prev.map((r) => `${r.pending ? 'p' : 'a'}:${r.uid}`));
        return [...prev, ...next.records.filter((r) => !seen.has(`${r.pending ? 'p' : 'a'}:${r.uid}`))];
      });
      setRolesCursor(next.nextRolesCursor);
      setInvitesCursor(next.nextInvitesCursor);
      setHasMoreRoles(next.hasMore);
    } catch (err: unknown) {
      setRolesError(err instanceof Error ? err.message : 'Could not load additional roles.');
    } finally {
      setIsLoadingMoreRoles(false);
    }
  };

  const handleLoadMoreUsers = async () => {
    if (!hasMoreUsers || !usersCursor) return;
    setUsersError(null);
    try {
      const next = await fetchUsersDirectoryPage(usersCursor, 25);
      setUserSuggestions((prev) => {
        const seen = new Set(prev.map((u) => u.email));
        return [...prev, ...next.users.filter((u) => !seen.has(u.email)).map((u) => ({ email: u.email, name: u.name }))];
      });
      setUsersCursor(next.nextCursor);
      setHasMoreUsers(next.hasMore);
    } catch (err: unknown) {
      setUsersError(err instanceof Error ? err.message : 'Could not load more user suggestions.');
    }
  };

  const handleAssignRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isMasterOwner) return onSuccessNotice('Unauthorized: only the project owner can provision new staff roles.');
    const normalizedEmail = newTargetEmail.trim().toLowerCase();
    if (!normalizedEmail) return onSuccessNotice('Enter the staff member’s Nile University email.');

    setIsSavingRole(true);
    try {
      const status = await assignUserRoleByEmail(normalizedEmail, newTargetRole, currentUserEmail || 'admin');
      onSuccessNotice(
        status === 'assigned'
          ? `Assigned ${newTargetRole} role to ${normalizedEmail}.`
          : `Saved ${newTargetRole} invite for ${normalizedEmail}. It activates when they verify and sign in.`
      );
      setNewTargetEmail('');
      await loadRoles();
    } catch (err: unknown) {
      onSuccessNotice(err instanceof Error ? err.message : 'Could not save role. Check permissions.');
    } finally {
      setIsSavingRole(false);
    }
  };

  const handleRevokeRole = async (email: string) => {
    if (!isMasterOwner || !email) return;
    setIsSavingRole(true);
    try {
      await assignUserRoleByEmail(email, 'student', currentUserEmail || 'admin');
      onSuccessNotice(`Reverted ${email} back to student access.`);
      await loadRoles();
    } catch (err: unknown) {
      onSuccessNotice(err instanceof Error ? err.message : 'Could not revoke role.');
    } finally {
      setIsSavingRole(false);
    }
  };

  return (
    <div className="space-y-6">
      {isMasterOwner ? (
        <div className={`${ADMIN_CARD} p-6 space-y-4`}>
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
                className={ADMIN_INPUT}
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
          <span className="font-bold">Role Provisioning Restricted:</span> Only the project owner is authorized to assign or revoke staff roles.
        </div>
      )}

      {rolesError && (
        <div role="alert" className="bg-[#FDF2F2] dark:bg-[#2B0E0E] border border-[#F87171]/50 text-[#9B1C1C] dark:text-[#F87171] p-4 rounded-[12px] text-sm flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{rolesError}</span>
          </div>
          <button
            type="button"
            onClick={loadRoles}
            className="min-h-[44px] px-3 rounded-[10px] border border-[#F87171]/50 bg-white dark:bg-[#1E1C18] text-xs font-medium cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {usersError && (
        <div role="alert" className="bg-[#FEF7E9] dark:bg-[#2B210A] border border-[#E8A317]/40 text-[#7A5000] dark:text-[#F9CF7C] p-3.5 rounded-[12px] text-sm flex items-center justify-between gap-2">
          <span>Directory note: {usersError}</span>
          {hasMoreUsers && (
            <button type="button" onClick={handleLoadMoreUsers} className="underline text-xs font-medium cursor-pointer">
              Retry
            </button>
          )}
        </div>
      )}

      {hasMoreUsers && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleLoadMoreUsers}
            className="text-xs font-medium text-[#0F6E6E] dark:text-[#199595] hover:underline min-h-[36px] cursor-pointer"
          >
            Load more directory email suggestions ({userSuggestions.length} loaded)
          </button>
        </div>
      )}

      <div className={`${ADMIN_CARD} overflow-hidden`}>
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
              <div className="w-9 h-9 rounded-full bg-[#0F6E6E] text-white font-bold flex items-center justify-center text-xs">R</div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold">Project Owner (Root)</span>
                  <span className="bg-[#E7F3F3] dark:bg-[#0D2D2D] text-[#0F6E6E] dark:text-[#199595] border border-[#0F6E6E]/30 text-xs font-mono font-bold px-2 py-0.5 rounded-full uppercase">
                    Master Admin
                  </span>
                </div>
                <p className="text-xs text-[#5C554C] dark:text-[#A8A095] font-mono mt-0.5">Verified root UID</p>
              </div>
            </div>
            <span className="text-xs text-[#0F6E6E] dark:text-[#199595] font-mono font-semibold">Active &amp; Root</span>
          </div>

          {roleRecords.length === 0 ? (
            <div className="p-6 text-center text-[#5C554C] dark:text-[#A8A095]">No additional staff roles provisioned yet.</div>
          ) : (
            roleRecords.map((r) => (
              <div key={`${r.pending ? 'pending' : 'active'}-${r.uid}`} className="p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3 hover:bg-[#FAF6EF]/40 dark:hover:bg-[#141311]/40 transition-colors">
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
                  {isMasterOwner && r.email && r.uid !== currentUserId && (
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

        {hasMoreRoles && (
          <div className="p-4 border-t border-[#C4BBAF] dark:border-[#3E3931] flex justify-center">
            <button
              type="button"
              disabled={isLoadingMoreRoles}
              onClick={handleLoadMoreRoles}
              className="min-h-[44px] rounded-[10px] border border-[#857C70] dark:border-[#787065] bg-white dark:bg-[#1E1C18] hover:bg-[#FAF6EF] dark:hover:bg-[#28241F] px-5 text-sm font-medium text-[#1F1B16] dark:text-[#F5F1EA] disabled:opacity-60 cursor-pointer btn-campus"
            >
              {isLoadingMoreRoles ? 'Loading more roles…' : 'Load more roles'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
