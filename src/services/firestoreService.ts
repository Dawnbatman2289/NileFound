/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Firestore persistence service for NileFound items, claims, roles, and notifications.
 */

import {
  collection, doc, addDoc, setDoc, getDoc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, where, limit, startAfter, getDocs, getCountFromServer,
  writeBatch, serverTimestamp, Timestamp,
  QueryDocumentSnapshot, DocumentData, Unsubscribe,
} from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase.ts';
import { CampusItem, ClaimRecord, User, UserRole, CampusNotification, ClaimMessage, ChatSenderRole } from '../types/index.ts';
import { ITEM_EXPIRY_DAYS } from '../config/catalog.ts';
import { canUserModerate, isMasterAdminUser } from '../utils/admin.ts';
import { validateNileEmail } from '../utils/authValidation.ts';
import { ClaimDecisionBatchPlan, decideClaimWithFreshPending } from '../utils/claimDecision.ts';
import { reportError } from '../components/ErrorBoundary.tsx';

const ITEMS = 'items';
const CLAIMS = 'claims';
const USERS = 'users';
const ROLES = 'roles';
const ADMINS = 'admins';
const STAFF_INVITES = 'staffInvites';
const NOTIFICATIONS = 'notifications';
const EXPIRY_MS = ITEM_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
const ITEMS_PAGE_SIZE = 20;
const CLAIMS_PAGE_SIZE = 20;
const ROLES_PAGE_SIZE = 25;

export interface UserRoleRecord {
  uid: string;
  email: string;
  role: UserRole;
  assignedAt?: string;
  assignedBy?: string;
  pending?: boolean;
  source?: 'admins' | 'roles' | 'invites';
}

export interface ItemPrivateDetails {
  authorName?: string;
  authorEmail?: string;
  expectedAnswer?: string;
}

export interface ClaimPrivateDetails {
  claimantName: string;
  claimantEmail: string;
  submittedAnswer: string;
}

export interface ItemPage {
  items: CampusItem[];
  nextCursor?: QueryDocumentSnapshot<DocumentData>;
  hasMore: boolean;
}

export interface ClaimsCursor {
  main?: QueryDocumentSnapshot<DocumentData>;
  claimant?: QueryDocumentSnapshot<DocumentData>;
  finder?: QueryDocumentSnapshot<DocumentData>;
}

export interface ClaimsPage {
  claims: ClaimRecord[];
  hasMore: boolean;
  cursor?: ClaimsCursor;
}

export interface ClaimMessagesPage {
  messages: ClaimMessage[];
  hasMore: boolean;
  nextCursor?: QueryDocumentSnapshot<DocumentData>;
}

export interface RolesPage {
  records: UserRoleRecord[];
  nextAdminsCursor?: QueryDocumentSnapshot<DocumentData>;
  nextRolesCursor?: QueryDocumentSnapshot<DocumentData>;
  nextInvitesCursor?: QueryDocumentSnapshot<DocumentData>;
  hasMore: boolean;
}

export interface CampusAuditCounts {
  totalItems: number;
  totalFound: number;
  foundReturned: number;
  totalReturned: number;
  custodyCount: number;
  pendingClaimsCount: number;
}

const NOTIF_TEMPLATES: Record<CampusNotification['type'], { title: string; message: string }> = {
  claim_received: { title: 'New claim on your item', message: 'A new ownership claim was filed for your item.' },
  claim_approved: { title: 'Claim approved', message: 'Your ownership claim was approved.' },
  claim_rejected: { title: 'Claim rejected', message: 'Your ownership claim was rejected.' },
  chat_message: { title: 'New handover message', message: 'You have a new message in your item handover chat.' },
  match_alert: { title: 'Possible item match', message: 'A possible match was found for your report.' },
  item_returned: { title: 'Item returned', message: 'Your reported item was marked returned.' },
  admin_review: { title: 'Review needed', message: 'A campus record needs administrator review.' },
};

function assertFirestoreReady(): void {
  if (!db) {
    throw new Error('Firestore service is not initialized yet. Reload and try again.');
  }
}

function isTransientOfflineError(error: unknown): boolean {
  const msg = (error instanceof Error ? error.message : String(error)).toLowerCase();
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code || '').toLowerCase()
      : '';
  return (
    code.includes('unavailable') ||
    code.includes('deadline-exceeded') ||
    msg.includes('client is offline') ||
    msg.includes('failed to get document because the client is offline') ||
    msg.includes('network-request-failed')
  );
}

async function withOfflineRetry<T>(operation: () => Promise<T>, maxRetries = 1): Promise<T> {
  assertFirestoreReady();
  let attempt = 0;
  while (true) {
    try {
      return await operation();
    } catch (error) {
      if (attempt >= maxRetries || !isTransientOfflineError(error)) {
        throw error;
      }
      attempt += 1;
      await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
    }
  }
}

function toIsoString(value: unknown): string {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value && typeof value === 'object' && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  if (typeof value === 'string' && value.trim()) return value;
  return new Date().toISOString();
}

function applyReadTimeExpiry(item: CampusItem): CampusItem {
  if (item.status === 'returned' || item.status === 'expired') return item;
  const createdMs = new Date(item.createdAt).getTime();
  if (!Number.isNaN(createdMs) && Date.now() - createdMs > EXPIRY_MS) {
    return { ...item, status: 'expired' };
  }
  return item;
}

function mapDocToCampusItem(docSnap: QueryDocumentSnapshot<DocumentData>): CampusItem {
  const d = docSnap.data();
  const createdAt = toIsoString(d.createdAt);
  const isStudentId = d.category === 'student_id';
  const raw: CampusItem = {
    id: docSnap.id,
    type: d.type || 'lost',
    title: d.title || '',
    category: d.category || 'other',
    description: d.description || '',
    location: d.location || '',
    locationDetails: d.locationDetails || undefined,
    dateLostOrFound: d.dateLostOrFound || createdAt,
    status: d.status || 'open',
    holdingLocation: d.holdingLocation || 'finder_holding',
    thumbUrl: isStudentId ? undefined : (d.thumbUrl || undefined),
    imageUrl: isStudentId ? undefined : (d.imageUrl || undefined),
    isSensitiveId: d.isSensitiveId || isStudentId,
    verificationQuestion: d.verificationQuestion || undefined,
    reportedByEmailDomain: 'nileuniversity.edu.ng',
    authorId: d.authorId || undefined,
    createdAt,
  };
  return applyReadTimeExpiry(raw);
}

function mapDocToClaimRecord(docSnap: QueryDocumentSnapshot<DocumentData>): ClaimRecord {
  const d = docSnap.data();
  return {
    id: docSnap.id,
    itemId: d.itemId,
    itemTitle: d.itemTitle || 'Item',
    claimantName: 'Verified Student',
    claimantEmail: '',
    submittedAnswer: '',
    privateLoaded: false,
    status: (d.status || 'pending') as ClaimRecord['status'],
    resubmitted: Boolean(d.resubmitted),
    claimantId: d.claimantId || undefined,
    finderId: d.finderId || undefined,
    createdAt: toIsoString(d.createdAt),
  };
}

export async function fetchUserRole(uid: string, email?: string | null): Promise<UserRole> {
  const normalizedEmail = (email || auth.currentUser?.email || '').trim().toLowerCase();

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

  const email = targetEmail.trim().toLowerCase();
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

    // Anchor staff invites by verified token email so unverified profile changes cannot escalate privileges.
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
  const normalizedEmail = record.email?.trim().toLowerCase();
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

    const byUid = new Map<string, UserRoleRecord>();
    const seenEmails = new Set<string>();

    for (const d of adminsDocs) {
      if (isMasterAdminUser(d.id)) continue;
      const data = d.data();
      if (data.enabled !== true) continue;
      const email = String(data.email || '').toLowerCase();
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
      const email = String(data.email || '').toLowerCase();
      if (email) seenEmails.add(email);
      const existing = byUid.get(d.id);
      byUid.set(d.id, {
        uid: d.id,
        email: existing?.email || email,
        role: existing?.role === 'admin' ? 'admin' : role,
        assignedAt: data.assignedAt ? toIsoString(data.assignedAt) : data.updatedAt ? toIsoString(data.updatedAt) : existing?.assignedAt,
        assignedBy: data.assignedBy || existing?.assignedBy,
        source: existing ? 'admins' : 'roles',
      });
    }

    const pendingRoles: UserRoleRecord[] = invitesDocs
      .filter((d) => !seenEmails.has(String(d.data().email || d.id).toLowerCase()))
      .map((d) => {
        const data = d.data();
        return {
          uid: d.id,
          email: String(data.email || d.id).toLowerCase(),
          role: (data.role || 'student') as UserRoleRecord['role'],
          assignedAt: data.assignedAt ? toIsoString(data.assignedAt) : undefined,
          assignedBy: data.assignedBy,
          pending: true,
          source: 'invites' as const,
        };
      })
      .filter((r) => r.role !== 'student');

    return {
      records: [...byUid.values(), ...pendingRoles],
      nextAdminsCursor: hasMoreAdmins ? adminsDocs.at(-1) : undefined,
      nextRolesCursor: hasMoreRoles ? rolesDocs.at(-1) : undefined,
      nextInvitesCursor: hasMoreInvites ? invitesDocs.at(-1) : undefined,
      hasMore: hasMoreAdmins || hasMoreRoles || hasMoreInvites,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, ROLES);
  }
}

export async function isConfiguredAdmin(uid?: string): Promise<boolean> {
  if (!uid || !db) return false;
  try {
    const snapshot = await withOfflineRetry(() => getDoc(doc(db, 'admins', uid)));
    return snapshot.exists() && snapshot.data().enabled === true;
  } catch (error) {
    reportError('isConfiguredAdmin', error);
    return false;
  }
}

export function subscribeToRealtimeItems(
  pageLimit: number,
  onSuccess: (items: CampusItem[], hasMore: boolean, lastDoc?: QueryDocumentSnapshot<DocumentData>) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  if (!db) {
    onError?.(new Error('Firestore service is unavailable right now.'));
    return () => {};
  }
  const safeLimit = Math.min(Math.max(1, pageLimit), 49);
  try {
    const q = query(collection(db, ITEMS), orderBy('createdAt', 'desc'), limit(safeLimit + 1));
    return onSnapshot(
      q,
      (snapshot) => {
        const hasMore = snapshot.docs.length > safeLimit;
        const pageDocs = snapshot.docs.slice(0, safeLimit);
        onSuccess(pageDocs.map(mapDocToCampusItem), hasMore, hasMore ? pageDocs.at(-1) : undefined);
      },
      (error) => {
        reportError('subscribeToRealtimeItems', error);
        onError?.(error);
      }
    );
  } catch (error) {
    reportError('subscribeToRealtimeItems(init)', error);
    onError?.(error instanceof Error ? error : new Error('Could not start items feed listener.'));
    return () => {};
  }
}

export async function fetchItemsPage(cursor?: QueryDocumentSnapshot<DocumentData>): Promise<ItemPage> {
  try {
    assertFirestoreReady();
    const q = query(
      collection(db, ITEMS),
      orderBy('createdAt', 'desc'),
      limit(ITEMS_PAGE_SIZE + 1),
      ...(cursor ? [startAfter(cursor)] : [])
    );
    const snapshot = await withOfflineRetry(() => getDocs(q));
    const hasMore = snapshot.docs.length > ITEMS_PAGE_SIZE;
    const pageDocs = snapshot.docs.slice(0, ITEMS_PAGE_SIZE);
    return {
      items: pageDocs.map(mapDocToCampusItem),
      nextCursor: hasMore ? pageDocs.at(-1) : undefined,
      hasMore,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, ITEMS);
  }
}

export async function fetchItemFullPhoto(itemId: string, lowDataMode = false): Promise<string | null> {
  if (lowDataMode) return null;
  try {
    const snap = await withOfflineRetry(() => getDoc(doc(db, ITEMS, itemId, 'media', 'full')));
    return snap.exists() ? (snap.data().dataUrl || null) : null;
  } catch (error) {
    reportError(`fetchItemFullPhoto(${itemId})`, error);
    throw new Error('Could not load full photo. Check your connection and try again.');
  }
}

export async function saveItemToFirestore(item: CampusItem, _user?: User | null): Promise<string> {
  if (!auth.currentUser) throw new Error('You must be signed in with a verified Nile account to report an item.');

  const uid = auth.currentUser.uid;
  const email = auth.currentUser.email || 'student@nileuniversity.edu.ng';
  const rawName = auth.currentUser.displayName || email.split('@')[0] || 'Student';
  const name = rawName.trim().length >= 2 ? rawName.trim() : 'Student';
  const isStudentId = item.category === 'student_id';

  const itemRef = doc(collection(db, ITEMS));
  const payload: Record<string, unknown> = {
    title: item.title.trim().slice(0, 100),
    type: item.type,
    category: item.category,
    description: item.description.trim().slice(0, 1000),
    location: item.location.slice(0, 100),
    dateLostOrFound: item.dateLostOrFound.slice(0, 40),
    status: 'open',
    holdingLocation: isStudentId && item.type === 'found' ? 'security_main_gate' : item.holdingLocation,
    authorId: uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...(item.locationDetails?.trim() && { locationDetails: item.locationDetails.trim().slice(0, 160) }),
    ...(!isStudentId && item.thumbUrl && { thumbUrl: item.thumbUrl }),
    ...(item.verificationQuestion?.trim() && { verificationQuestion: item.verificationQuestion.trim().slice(0, 300) }),
    ...((isStudentId || item.isSensitiveId !== undefined) && { isSensitiveId: isStudentId ? true : item.isSensitiveId }),
  };

  try {
    const batch = writeBatch(db);
    batch.set(itemRef, payload);
    batch.set(doc(db, ITEMS, itemRef.id, 'private', 'details'), {
      itemId: itemRef.id,
      authorId: uid,
      authorName: name.slice(0, 100),
      authorEmail: email.slice(0, 100),
      createdAt: serverTimestamp(),
    });
    if (!isStudentId && item.imageUrl) {
      batch.set(doc(db, ITEMS, itemRef.id, 'media', 'full'), {
        itemId: itemRef.id,
        authorId: uid,
        dataUrl: item.imageUrl,
        createdAt: serverTimestamp(),
      });
    }
    if (item.verificationAnswer && item.type === 'found') {
      batch.set(doc(db, ITEMS, itemRef.id, 'secrets', 'verification'), {
        itemId: itemRef.id,
        authorId: uid,
        expectedAnswer: item.verificationAnswer.slice(0, 500),
        createdAt: serverTimestamp(),
      });
    }
    await batch.commit();
    return itemRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, ITEMS);
  }
}

export async function fetchItemPrivateDetails(itemId: string): Promise<ItemPrivateDetails> {
  try {
    const [privateSnap, secretSnap] = await withOfflineRetry(() =>
      Promise.all([
        getDoc(doc(db, ITEMS, itemId, 'private', 'details')),
        getDoc(doc(db, ITEMS, itemId, 'secrets', 'verification')),
      ])
    );
    return {
      authorName: privateSnap.exists() ? privateSnap.data().authorName : undefined,
      authorEmail: privateSnap.exists() ? privateSnap.data().authorEmail : undefined,
      expectedAnswer: secretSnap.exists() ? secretSnap.data().expectedAnswer : undefined,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `${ITEMS}/${itemId}/private`);
  }
}

export async function fetchClaimPrivateDetails(itemId: string, claimId: string): Promise<ClaimPrivateDetails> {
  try {
    const snap = await withOfflineRetry(() => getDoc(doc(db, ITEMS, itemId, 'privateClaims', claimId)));
    if (!snap.exists()) {
      return { claimantName: 'Claimant', claimantEmail: '', submittedAnswer: 'No private claim details recorded.' };
    }
    const data = snap.data();
    return {
      claimantName: data.claimantName || 'Claimant',
      claimantEmail: data.claimantEmail || '',
      submittedAnswer: data.submittedAnswer || 'None provided',
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `${ITEMS}/${itemId}/privateClaims/${claimId}`);
  }
}

export async function fetchApprovedHandoverContact(itemId: string): Promise<{ authorName?: string; authorEmail?: string } | null> {
  try {
    const snap = await withOfflineRetry(() => getDoc(doc(db, ITEMS, itemId, 'private', 'details')));
    if (!snap.exists()) return null;
    return {
      authorName: snap.data().authorName,
      authorEmail: snap.data().authorEmail,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `${ITEMS}/${itemId}/private/details`);
  }
}

export async function updateItemStatusInFirestore(itemId: string, status: CampusItem['status']): Promise<void> {
  try {
    assertFirestoreReady();
    await updateDoc(doc(db, ITEMS, itemId), { status, updatedAt: serverTimestamp() });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${ITEMS}/${itemId}`);
  }
}

export async function expireItemsInFirestore(itemIds: string[]): Promise<void> {
  if (itemIds.length === 0) return;
  try {
    assertFirestoreReady();
    for (let i = 0; i < itemIds.length; i += 450) {
      const batch = writeBatch(db);
      itemIds.slice(i, i + 450).forEach((id) => {
        batch.update(doc(db, ITEMS, id), { status: 'expired', updatedAt: serverTimestamp() });
      });
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, ITEMS);
  }
}

export async function fetchCampusAuditCounts(): Promise<CampusAuditCounts> {
  try {
    const [totalSnap, foundSnap, foundRetSnap, totalRetSnap, custodySnap, pendingSnap] = await withOfflineRetry(() =>
      Promise.all([
        getCountFromServer(collection(db, ITEMS)),
        getCountFromServer(query(collection(db, ITEMS), where('type', '==', 'found'))),
        getCountFromServer(query(collection(db, ITEMS), where('type', '==', 'found'), where('status', '==', 'returned'))),
        getCountFromServer(query(collection(db, ITEMS), where('status', '==', 'returned'))),
        getCountFromServer(
          query(
            collection(db, ITEMS),
            where('holdingLocation', 'in', ['security_main_gate', 'student_affairs_office', 'library_desk', 'faculty_officer'])
          )
        ),
        getCountFromServer(query(collection(db, CLAIMS), where('status', '==', 'pending'))),
      ])
    );
    return {
      totalItems: totalSnap.data().count,
      totalFound: foundSnap.data().count,
      foundReturned: foundRetSnap.data().count,
      totalReturned: totalRetSnap.data().count,
      custodyCount: custodySnap.data().count,
      pendingClaimsCount: pendingSnap.data().count,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, ITEMS);
  }
}

export async function deleteItemFromFirestore(itemId: string): Promise<void> {
  try {
    const uid = auth.currentUser?.uid;
    const isAdminUser = Boolean(
      uid && (isMasterAdminUser(uid) || (await isConfiguredAdmin(uid)) || (await fetchUserRole(uid)) === 'admin')
    );

    const [privateClaimsSnap, claimsSnap] = await Promise.all([
      getDocs(query(collection(db, ITEMS, itemId, 'privateClaims'), limit(50))),
      getDocs(query(collection(db, CLAIMS), where('itemId', '==', itemId), limit(50))),
    ]);

    const messageSnaps = await Promise.all(
      claimsSnap.docs.map((claimDoc) =>
        getDocs(query(collection(db, CLAIMS, claimDoc.id, 'messages'), limit(50)))
      )
    );

    const messageRefsToDelete = messageSnaps.flatMap((snap) =>
      snap.docs
        .filter((d) => isAdminUser || (uid && d.data().senderId === uid))
        .map((d) => d.ref)
    );

    const refsToDelete = [
      ...messageRefsToDelete,
      doc(db, ITEMS, itemId, 'media', 'full'),
      doc(db, ITEMS, itemId, 'private', 'details'),
      doc(db, ITEMS, itemId, 'secrets', 'verification'),
      ...privateClaimsSnap.docs.map((d) => d.ref),
      ...claimsSnap.docs.map((d) => d.ref),
      doc(db, ITEMS, itemId),
    ];

    for (let i = 0; i < refsToDelete.length; i += 450) {
      const batch = writeBatch(db);
      refsToDelete.slice(i, i + 450).forEach((ref) => batch.delete(ref));
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${ITEMS}/${itemId}`);
  }
}

export function subscribeToRealtimeClaims(
  user: User | null,
  onSuccess: (claims: ClaimRecord[], hasMore: boolean, cursor?: ClaimsCursor) => void,
  onError?: (err: Error) => void,
  pageSize = CLAIMS_PAGE_SIZE
): Unsubscribe {
  const uid = auth.currentUser?.uid;
  if (!uid || !db) {
    if (!db) onError?.(new Error('Firestore service is unavailable right now.'));
    else onSuccess([], false, undefined);
    return () => {};
  }

  try {
    if (canUserModerate(user)) {
      const q = query(collection(db, CLAIMS), orderBy('createdAt', 'desc'), limit(pageSize + 1));
      return onSnapshot(
        q,
        (snapshot) => {
          const hasMore = snapshot.docs.length > pageSize;
          const pageDocs = snapshot.docs.slice(0, pageSize);
          onSuccess(pageDocs.map(mapDocToClaimRecord), hasMore, hasMore ? { main: pageDocs.at(-1) } : undefined);
        },
        (error) => {
          reportError('subscribeToRealtimeClaims(privileged)', error);
          onError?.(error);
        }
      );
    }

    let claimantDocs: QueryDocumentSnapshot<DocumentData>[] = [];
    let finderDocs: QueryDocumentSnapshot<DocumentData>[] = [];
    let hasMoreClaimant = false;
    let hasMoreFinder = false;

    const emitMerged = () => {
      const byId = new Map<string, ClaimRecord>();
      [...claimantDocs, ...finderDocs].forEach((d) => byId.set(d.id, mapDocToClaimRecord(d)));
      const sorted = [...byId.values()].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      onSuccess(
        sorted,
        hasMoreClaimant || hasMoreFinder,
        hasMoreClaimant || hasMoreFinder
          ? {
              claimant: hasMoreClaimant ? claimantDocs.at(-1) : undefined,
              finder: hasMoreFinder ? finderDocs.at(-1) : undefined,
            }
          : undefined
      );
    };

    const unsubClaimant = onSnapshot(
      query(collection(db, CLAIMS), where('claimantId', '==', uid), orderBy('createdAt', 'desc'), limit(pageSize + 1)),
      (snap) => {
        hasMoreClaimant = snap.docs.length > pageSize;
        claimantDocs = snap.docs.slice(0, pageSize);
        emitMerged();
      },
      (error) => {
        reportError('subscribeToRealtimeClaims(claimant)', error);
        onError?.(error);
      }
    );

    let unsubFinder: Unsubscribe = () => {};
    try {
      unsubFinder = onSnapshot(
        query(collection(db, CLAIMS), where('finderId', '==', uid), orderBy('createdAt', 'desc'), limit(pageSize + 1)),
        (snap) => {
          hasMoreFinder = snap.docs.length > pageSize;
          finderDocs = snap.docs.slice(0, pageSize);
          emitMerged();
        },
        (error) => {
          reportError('subscribeToRealtimeClaims(finder)', error);
          onError?.(error);
        }
      );
    } catch (finderInitErr) {
      unsubClaimant();
      throw finderInitErr;
    }

    return () => {
      unsubClaimant();
      unsubFinder();
    };
  } catch (error) {
    reportError('subscribeToRealtimeClaims(init)', error);
    onError?.(error instanceof Error ? error : new Error('Could not start claims listener.'));
    return () => {};
  }
}

export async function fetchMoreClaimsPage(
  user: User | null,
  cursor: ClaimsCursor,
  pageSize = CLAIMS_PAGE_SIZE
): Promise<ClaimsPage> {
  const uid = auth.currentUser?.uid;
  if (!uid) return { claims: [], hasMore: false };

  try {
    if (canUserModerate(user)) {
      if (!cursor.main) return { claims: [], hasMore: false };
      const snap = await getDocs(
        query(collection(db, CLAIMS), orderBy('createdAt', 'desc'), startAfter(cursor.main), limit(pageSize + 1))
      );
      const hasMore = snap.docs.length > pageSize;
      const pageDocs = snap.docs.slice(0, pageSize);
      return {
        claims: pageDocs.map(mapDocToClaimRecord),
        hasMore,
        cursor: hasMore ? { main: pageDocs.at(-1) } : undefined,
      };
    }

    const [claimantSnap, finderSnap] = await Promise.all([
      cursor.claimant
        ? getDocs(query(collection(db, CLAIMS), where('claimantId', '==', uid), orderBy('createdAt', 'desc'), startAfter(cursor.claimant), limit(pageSize + 1)))
        : Promise.resolve(null),
      cursor.finder
        ? getDocs(query(collection(db, CLAIMS), where('finderId', '==', uid), orderBy('createdAt', 'desc'), startAfter(cursor.finder), limit(pageSize + 1)))
        : Promise.resolve(null),
    ]);

    const cHasMore = Boolean(claimantSnap && claimantSnap.docs.length > pageSize);
    const fHasMore = Boolean(finderSnap && finderSnap.docs.length > pageSize);
    const cDocs = claimantSnap ? claimantSnap.docs.slice(0, pageSize) : [];
    const fDocs = finderSnap ? finderSnap.docs.slice(0, pageSize) : [];
    const merged = [...cDocs, ...fDocs].map(mapDocToClaimRecord);

    return {
      claims: merged,
      hasMore: cHasMore || fHasMore,
      cursor: cHasMore || fHasMore
        ? {
            claimant: cHasMore ? cDocs.at(-1) : undefined,
            finder: fHasMore ? fDocs.at(-1) : undefined,
          }
        : undefined,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, CLAIMS);
  }
}

export async function saveClaimToFirestore(claim: ClaimRecord, _user?: User | null, finderId?: string): Promise<string> {
  if (!auth.currentUser) throw new Error('You must be signed in with a verified Nile account to submit a claim.');

  const uid = auth.currentUser.uid;
  const email = auth.currentUser.email || claim.claimantEmail.slice(0, 100);
  const rawName = auth.currentUser.displayName || claim.claimantName || 'Claimant';
  const name = rawName.trim().length >= 2 ? rawName.trim() : 'Claimant';

  const itemSnap = await getDoc(doc(db, ITEMS, claim.itemId));
  const itemData = itemSnap.exists() ? itemSnap.data() : undefined;
  const resolvedFinderId = finderId || itemData?.authorId;
  if (!resolvedFinderId) throw new Error('The item you tried to claim could not be found.');

  const isFoundStudentId = itemData?.type === 'found' && itemData?.category === 'student_id';
  const safeItemTitle = isFoundStudentId ? 'A student ID card was found' : claim.itemTitle;
  const claimId = `${claim.itemId}_${uid}`;

  try {
    const batch = writeBatch(db);
    batch.set(doc(db, CLAIMS, claimId), {
      itemId: claim.itemId,
      itemTitle: safeItemTitle.slice(0, 100),
      claimantId: uid,
      finderId: resolvedFinderId,
      status: 'pending',
      resubmitted: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(db, ITEMS, claim.itemId, 'privateClaims', claimId), {
      itemId: claim.itemId,
      claimId,
      claimantId: uid,
      claimantName: name.slice(0, 100),
      claimantEmail: email.slice(0, 100),
      submittedAnswer: claim.submittedAnswer.slice(0, 500),
      createdAt: serverTimestamp(),
    });
    batch.update(doc(db, ITEMS, claim.itemId), {
      status: 'claim_requested',
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
    return claimId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, CLAIMS);
  }
}

export async function resubmitClaimInFirestore(
  claimId: string,
  itemId: string,
  updatedAnswer: string
): Promise<void> {
  if (!auth.currentUser) throw new Error('You must be signed in with a verified Nile account to resubmit a claim.');
  try {
    const batch = writeBatch(db);
    batch.update(doc(db, CLAIMS, claimId), {
      status: 'pending',
      resubmitted: true,
      updatedAt: serverTimestamp(),
    });
    batch.update(doc(db, ITEMS, itemId, 'privateClaims', claimId), {
      submittedAnswer: updatedAnswer.trim().slice(0, 500),
      updatedAt: serverTimestamp(),
    });
    batch.update(doc(db, ITEMS, itemId), {
      status: 'claim_requested',
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${CLAIMS}/${claimId}`);
  }
}

export async function updateClaimStatusInFirestore(
  claimId: string,
  itemId: string,
  status: 'approved' | 'rejected',
  finderIdForQuery?: string
): Promise<ClaimDecisionBatchPlan> {
  try {
    return await decideClaimWithFreshPending({
      claimId,
      itemId,
      decision: status,
      queryPendingClaimIds: async (targetItemId) => {
        const pendingSnap = await getDocs(
          query(
            collection(db, CLAIMS),
            where('itemId', '==', targetItemId),
            where('status', '==', 'pending'),
            ...(finderIdForQuery ? [where('finderId', '==', finderIdForQuery)] : []),
            limit(50)
          )
        );
        return pendingSnap.docs.map((d) => d.id);
      },
      commitDecisionBatch: async (plan) => {
        const batch = writeBatch(db);
        batch.update(doc(db, CLAIMS, claimId), { status, updatedAt: serverTimestamp() });
        if (status === 'approved') {
          batch.update(doc(db, ITEMS, itemId), { status: 'verified', updatedAt: serverTimestamp() });
          plan.autoRejectedIds.forEach((otherId) => {
            batch.update(doc(db, CLAIMS, otherId), { status: 'rejected', updatedAt: serverTimestamp() });
          });
        } else if (plan.nextItemStatus === 'open') {
          batch.update(doc(db, ITEMS, itemId), { status: 'open', updatedAt: serverTimestamp() });
        }
        await batch.commit();
      },
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${CLAIMS}/${claimId}`);
  }
}

export async function syncUserProfile(user: User): Promise<void> {
  if (!user?.id) return;
  const userRef = doc(db, USERS, user.id);
  const authEmail = (auth.currentUser?.email || user.email).trim().toLowerCase().slice(0, 100);
  const displayName = user.name.trim().length >= 2 ? user.name.trim().slice(0, 100) : 'Campus User';

  try {
    const existingSnap = await getDoc(userRef);
    if (!existingSnap.exists()) {
      await setDoc(userRef, {
        name: displayName,
        email: authEmail,
        role: 'student',
        department: user.department?.slice(0, 100) || '',
        matricNumber: user.matricNumber?.slice(0, 20) || '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      const existingData = existingSnap.data();
      const preservedDept = (user.department?.trim() || existingData.department || '').slice(0, 100);
      const preservedMatric = (user.matricNumber?.trim() || existingData.matricNumber || '').slice(0, 20);
      if (
        existingData.name === displayName &&
        existingData.email === authEmail &&
        (existingData.department || '') === preservedDept &&
        (existingData.matricNumber || '') === preservedMatric
      ) {
        return;
      }
      await updateDoc(userRef, {
        name: displayName,
        email: authEmail,
        department: preservedDept,
        matricNumber: preservedMatric,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${USERS}/${user.id}`);
  }
}

export function subscribeToRealtimeNotifications(
  currentUser: User | null,
  onSuccess: (notifications: CampusNotification[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  if (!auth.currentUser || !currentUser || !db) {
    if (!db) onError?.(new Error('Firestore service is unavailable right now.'));
    else onSuccess([]);
    return () => {};
  }
  try {
    const q = canUserModerate(currentUser)
      ? query(collection(db, NOTIFICATIONS), where('recipientUid', 'in', [currentUser.id, 'admin']), orderBy('createdAt', 'desc'), limit(25))
      : query(collection(db, NOTIFICATIONS), where('recipientUid', '==', currentUser.id), orderBy('createdAt', 'desc'), limit(25));

    return onSnapshot(
      q,
      (snapshot) => {
        const notifications = snapshot.docs.map((docSnap) => {
          const d = docSnap.data();
          return {
            id: docSnap.id,
            recipientUid: d.recipientUid || '',
            fromUid: d.fromUid || '',
            type: d.type || 'admin_review',
            title: d.title || 'Campus Notification',
            message: d.message || '',
            read: Boolean(d.read),
            createdAt: toIsoString(d.createdAt),
            itemId: d.itemId || undefined,
            claimId: d.claimId || undefined,
          };
        });
        onSuccess(notifications);
      },
      (error) => {
        reportError('subscribeToRealtimeNotifications', error);
        onError?.(error);
      }
    );
  } catch (error) {
    reportError('subscribeToRealtimeNotifications(init)', error);
    onError?.(error instanceof Error ? error : new Error('Could not start notifications listener.'));
    return () => {};
  }
}

export async function saveNotificationToFirestore(notification: {
  recipientUid: string;
  fromUid?: string;
  type: CampusNotification['type'];
  title: string;
  message: string;
  itemId?: string;
  claimId?: string;
  sourceItemId?: string;
  createdAt?: string;
}): Promise<string> {
  if (!auth.currentUser?.uid) throw new Error('You must be signed in to create a notification.');
  const template = NOTIF_TEMPLATES[notification.type];
  const recipientUid = notification.recipientUid.slice(0, 128);
  const claimId = notification.claimId ? notification.claimId.slice(0, 128) : undefined;
  const payload = {
    recipientUid,
    fromUid: auth.currentUser.uid.slice(0, 128),
    type: notification.type,
    title: template.title,
    message: template.message,
    read: false,
    createdAt: serverTimestamp(),
    ...(notification.itemId && { itemId: notification.itemId.slice(0, 128) }),
    ...(claimId && { claimId }),
    ...(notification.sourceItemId && { sourceItemId: notification.sourceItemId.slice(0, 128) }),
  };

  try {
    if (notification.type === 'chat_message' && claimId) {
      const docId = `chat_${claimId}_${recipientUid}`;
      await setDoc(doc(db, NOTIFICATIONS, docId), payload);
      return docId;
    }
    const docRef = await addDoc(collection(db, NOTIFICATIONS), payload);
    return docRef.id;
  } catch (error) {
    reportError('saveNotificationToFirestore', error);
    throw new Error('Could not save notification. Please try again.');
  }
}

export async function markNotificationAsReadInFirestore(notificationId: string): Promise<void> {
  if (!notificationId || notificationId.startsWith('local-') || notificationId.startsWith('notif-')) return;
  try {
    await updateDoc(doc(db, NOTIFICATIONS, notificationId), { read: true });
  } catch (error) {
    reportError(`markNotificationAsReadInFirestore(${notificationId})`, error);
    throw error;
  }
}

export async function markNotificationsReadInFirestore(notificationIds: string[]): Promise<void> {
  const persistedIds = notificationIds.filter((id) => id && !id.startsWith('local-') && !id.startsWith('notif-'));
  if (persistedIds.length === 0) return;
  try {
    const batch = writeBatch(db);
    persistedIds.slice(0, 450).forEach((id) => {
      batch.update(doc(db, NOTIFICATIONS, id), { read: true });
    });
    await batch.commit();
  } catch (error) {
    reportError('markNotificationsReadInFirestore', error);
    throw error;
  }
}

function mapDocToClaimMessage(docSnap: QueryDocumentSnapshot<DocumentData>, claimId: string): ClaimMessage {
  const d = docSnap.data();
  return {
    id: docSnap.id,
    claimId,
    senderId: String(d.senderId || ''),
    senderRole: (d.senderRole || 'Claimant') as ChatSenderRole,
    text: String(d.text || ''),
    createdAt: toIsoString(d.createdAt),
  };
}

export function subscribeToClaimMessages(
  claimId: string,
  onSuccess: (messages: ClaimMessage[], hasMore: boolean, nextCursor?: QueryDocumentSnapshot<DocumentData>) => void,
  onError?: (err: Error) => void,
  pageSize = 49
): Unsubscribe {
  if (!auth.currentUser || !claimId || !db) {
    if (!db) onError?.(new Error('Firestore service is unavailable right now.'));
    else onSuccess([], false, undefined);
    return () => {};
  }
  const safeLimit = Math.min(Math.max(1, pageSize), 49);
  try {
    const q = query(
      collection(db, CLAIMS, claimId, 'messages'),
      orderBy('createdAt', 'desc'),
      limit(safeLimit + 1)
    );
    return onSnapshot(
      q,
      (snapshot) => {
        const hasMore = snapshot.docs.length > safeLimit;
        const pageDocs = snapshot.docs.slice(0, safeLimit);
        const oldestDoc = pageDocs.at(-1);
        const messages = [...pageDocs].reverse().map((docSnap) => mapDocToClaimMessage(docSnap, claimId));
        onSuccess(messages, hasMore, hasMore ? oldestDoc : undefined);
      },
      (error) => {
        reportError(`subscribeToClaimMessages(${claimId})`, error);
        onError?.(error);
      }
    );
  } catch (error) {
    reportError(`subscribeToClaimMessages(${claimId})(init)`, error);
    onError?.(error instanceof Error ? error : new Error('Could not connect to handover chat.'));
    return () => {};
  }
}

export async function fetchOlderClaimMessages(
  claimId: string,
  cursor: QueryDocumentSnapshot<DocumentData>,
  pageSize = 49
): Promise<ClaimMessagesPage> {
  const safeLimit = Math.min(Math.max(1, pageSize), 49);
  try {
    assertFirestoreReady();
    const q = query(
      collection(db, CLAIMS, claimId, 'messages'),
      orderBy('createdAt', 'desc'),
      startAfter(cursor),
      limit(safeLimit + 1)
    );
    const snapshot = await withOfflineRetry(() => getDocs(q));
    const hasMore = snapshot.docs.length > safeLimit;
    const pageDocs = snapshot.docs.slice(0, safeLimit);
    const oldestDoc = pageDocs.at(-1);
    return {
      messages: [...pageDocs].reverse().map((docSnap) => mapDocToClaimMessage(docSnap, claimId)),
      hasMore,
      nextCursor: hasMore ? oldestDoc : undefined,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, `${CLAIMS}/${claimId}/messages`);
  }
}

export async function sendClaimMessageToFirestore(
  claimId: string,
  text: string,
  senderRole: ChatSenderRole
): Promise<string> {
  if (!auth.currentUser?.uid) {
    throw new Error('Sign in with your verified Nile account to send messages.');
  }
  const cleanText = text.trim().slice(0, 500);
  if (!cleanText) {
    throw new Error('Type a short message before sending.');
  }
  try {
    const ref = await addDoc(collection(db, CLAIMS, claimId, 'messages'), {
      senderId: auth.currentUser.uid,
      senderRole,
      text: cleanText,
      createdAt: serverTimestamp(),
    });
    return ref.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `${CLAIMS}/${claimId}/messages`);
  }
}

