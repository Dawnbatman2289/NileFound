/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Firestore role lookup, provisioning, and revocation operations.
 */

import {
  collection, doc, getDoc, getDocs, deleteDoc, query, where, orderBy, limit, startAfter, writeBatch,
  serverTimestamp, QueryDocumentSnapshot, DocumentData,
} from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../../lib/firebase.ts';
import { UserRole } from '../../types/index.ts';
import { isMasterAdminUser } from '../../utils/admin.ts';
import { normalizeNileEmail, validateNileEmail } from '../../utils/authValidation.ts';
import { reportError } from '../../components/ErrorBoundary.tsx';
import {
  ADMINS, ROLES, STAFF_INVITES, USERS, ROLES_PAGE_SIZE,
  RolesPage, UserRoleRecord, toIsoString, withOfflineRetry,
} from './helpers.ts';

export async function isConfiguredAdmin(uid?: string): Promise<boolean> {
  if (!uid || !db) return false;
  try {
    const snapshot = await withOfflineRetry(() => getDoc(doc(db, ADMINS, uid)));
    return snapshot.exists() && snapshot.data().enabled === true;
  } catch (error) {
    reportError('isConfiguredAdmin', error);
    return false;
  }
}

export async function fetchUserRole(uid: string, email?: string | null): Promise<UserRole> {
  const normalizedEmail = normalizeNileEmail(email || auth.currentUser?.email || '');

  try {
    return await withOfflineRetry(async () => {
      if (uid) {
        if (isMasterAdminUser(uid) || (await isConfiguredAdmin(uid))) {
          return 'admin';
        }
        const snap = await getDoc(doc(db, ROLES, uid));
        if (snap.exists()) {
          const role = snap.data().role;
          return role === 'admin' || role === 'security' || role === 'staff' ? role : 'student';
        }
      }

      if (normalizedEmail) {
        const inviteSnap = await getDoc(doc(db, STAFF_INVITES, normalizedEmail));
        if (inviteSnap.exists()) {
          const role = inviteSnap.data().role;
          if (role === 'admin' || role === 'security' || role === 'staff') return role;
        }
      }

      return 'student';
    });
  } catch (error) {
    reportError('fetchUserRole', error);
    throw new Error('Could not verify your campus role. Check your connection and retry.');
  }
}

export async function assignUserRoleByEmail(
  targetEmail: string,
  newRole: UserRole,
  assignedByEmail?: string
): Promise<'assigned' | 'pending'> {
  if (!auth.currentUser || !isMasterAdminUser(auth.currentUser.uid)) {
    throw new Error('Unauthorized: only the project owner can provision campus roles.');
  }

  const email = normalizeNileEmail(targetEmail);
  if (!validateNileEmail(email)) {
    throw new Error('Enter a valid @nileuniversity.edu.ng email address.');
  }

  const actor = (assignedByEmail || auth.currentUser.email || 'admin').slice(0, 128);
  const payload = {
    role: newRole,
    email,
    assignedAt: serverTimestamp(),
    assignedBy: actor,
  };

  try {
    const userSnap = await getDocs(query(collection(db, USERS), where('email', '==', email), limit(1)));
    const batch = writeBatch(db);

    if (newRole === 'student') {
      batch.delete(doc(db, STAFF_INVITES, email));
      if (!userSnap.empty) {
        const targetUid = userSnap.docs[0].id;
        if (!isMasterAdminUser(targetUid)) {
          batch.delete(doc(db, ADMINS, targetUid));
          batch.delete(doc(db, ROLES, targetUid));
        }
      }
      await batch.commit();
      return userSnap.empty ? 'pending' : 'assigned';
    }

    batch.set(doc(db, STAFF_INVITES, email), payload, { merge: true });
    if (!userSnap.empty) {
      const targetUid = userSnap.docs[0].id;
      batch.set(doc(db, ROLES, targetUid), { ...payload, updatedAt: serverTimestamp() }, { merge: true });
      await batch.commit();
      return 'assigned';
    }

    await batch.commit();
    return 'pending';
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${STAFF_INVITES}/${email}`);
  }
}

export async function revokeStaffRole(
  record: Pick<UserRoleRecord, 'uid' | 'email' | 'pending'>
): Promise<void> {
  if (!auth.currentUser || !isMasterAdminUser(auth.currentUser.uid)) {
    throw new Error('Unauthorized: only the project owner can remove staff or admin access.');
  }
  const normalizedEmail = record.email ? normalizeNileEmail(record.email) : '';
  if (!record.pending && (isMasterAdminUser(record.uid) || record.uid === auth.currentUser.uid)) {
    throw new Error('The root owner account cannot be removed.');
  }

  try {
    if (record.pending) {
      const inviteKey = normalizedEmail || record.uid;
      if (!inviteKey) return;
      await deleteDoc(doc(db, STAFF_INVITES, inviteKey));
      return;
    }

    const batch = writeBatch(db);
    if (record.uid) {
      batch.delete(doc(db, ADMINS, record.uid));
      batch.delete(doc(db, ROLES, record.uid));
    }
    if (normalizedEmail) {
      batch.delete(doc(db, STAFF_INVITES, normalizedEmail));
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${ROLES}/${record.uid}`);
  }
}

function normalizeRoleRecords(
  adminsDocs: QueryDocumentSnapshot<DocumentData>[],
  rolesDocs: QueryDocumentSnapshot<DocumentData>[],
  invitesDocs: QueryDocumentSnapshot<DocumentData>[]
): UserRoleRecord[] {
  const byUid = new Map<string, UserRoleRecord>();
  const seenEmails = new Set<string>();

  for (const d of adminsDocs) {
    if (isMasterAdminUser(d.id)) continue;
    const data = d.data();
    if (data.enabled !== true) continue;
    const email = normalizeNileEmail(String(data.email || ''));
    if (email) seenEmails.add(email);
    byUid.set(d.id, {
      uid: d.id,
      email,
      role: 'admin',
      assignedAt: data.updatedAt ? toIsoString(data.updatedAt) : undefined,
      assignedBy: 'Delegated Admin',
      source: 'admins',
    });
  }

  for (const d of rolesDocs) {
    if (isMasterAdminUser(d.id)) continue;
    const data = d.data();
    const role = (data.role || 'student') as UserRoleRecord['role'];
    if (role === 'student') continue;
    const email = normalizeNileEmail(String(data.email || ''));
    if (email) seenEmails.add(email);
    const existing = byUid.get(d.id);
    byUid.set(d.id, {
      uid: d.id,
      email: existing?.email || email,
      role: existing?.role === 'admin' ? 'admin' : role,
      assignedAt: data.assignedAt
        ? toIsoString(data.assignedAt)
        : data.updatedAt
          ? toIsoString(data.updatedAt)
          : existing?.assignedAt,
      assignedBy: data.assignedBy || existing?.assignedBy,
      source: existing ? 'admins' : 'roles',
    });
  }

  const pendingRoles: UserRoleRecord[] = invitesDocs
    .filter((d) => !seenEmails.has(normalizeNileEmail(String(d.data().email || d.id))))
    .map((d) => {
      const data = d.data();
      return {
        uid: d.id,
        email: normalizeNileEmail(String(data.email || d.id)),
        role: (data.role || 'student') as UserRoleRecord['role'],
        assignedAt: data.assignedAt ? toIsoString(data.assignedAt) : undefined,
        assignedBy: data.assignedBy,
        pending: true,
        source: 'invites' as const,
      };
    })
    .filter((r) => r.role !== 'student');

  return [...byUid.values(), ...pendingRoles];
}

export async function fetchRolesPage(
  cursors: {
    admins?: QueryDocumentSnapshot<DocumentData>;
    roles?: QueryDocumentSnapshot<DocumentData>;
    invites?: QueryDocumentSnapshot<DocumentData>;
  } = {},
  pageSize = ROLES_PAGE_SIZE,
  options: { fetchAdmins?: boolean; fetchRoles?: boolean; fetchInvites?: boolean } = {}
): Promise<RolesPage> {
  const { fetchAdmins = false, fetchRoles = true, fetchInvites = true } = options;
  try {
    const [adminsSnap, rolesSnap, invitesSnap] = await Promise.all([
      fetchAdmins
        ? getDocs(query(collection(db, ADMINS), orderBy('__name__'), limit(pageSize + 1), ...(cursors.admins ? [startAfter(cursors.admins)] : [])))
        : Promise.resolve(null),
      fetchRoles
        ? getDocs(query(collection(db, ROLES), orderBy('__name__'), limit(pageSize + 1), ...(cursors.roles ? [startAfter(cursors.roles)] : [])))
        : Promise.resolve(null),
      fetchInvites
        ? getDocs(query(collection(db, STAFF_INVITES), orderBy('__name__'), limit(pageSize + 1), ...(cursors.invites ? [startAfter(cursors.invites)] : [])))
        : Promise.resolve(null),
    ]);

    const adminsDocs = adminsSnap ? adminsSnap.docs.slice(0, pageSize) : [];
    const rolesDocs = rolesSnap ? rolesSnap.docs.slice(0, pageSize) : [];
    const invitesDocs = invitesSnap ? invitesSnap.docs.slice(0, pageSize) : [];
    const hasMoreAdmins = Boolean(adminsSnap && adminsSnap.docs.length > pageSize);
    const hasMoreRoles = Boolean(rolesSnap && rolesSnap.docs.length > pageSize);
    const hasMoreInvites = Boolean(invitesSnap && invitesSnap.docs.length > pageSize);

    return {
      records: normalizeRoleRecords(adminsDocs, rolesDocs, invitesDocs),
      nextAdminsCursor: hasMoreAdmins ? adminsDocs.at(-1) : undefined,
      nextRolesCursor: hasMoreRoles ? rolesDocs.at(-1) : undefined,
      nextInvitesCursor: hasMoreInvites ? invitesDocs.at(-1) : undefined,
      hasMore: hasMoreAdmins || hasMoreRoles || hasMoreInvites,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, ROLES);
  }
}
