/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Firestore persistence service for NileFound items, claims, roles, and notifications.
 */

import {
  collection, doc, addDoc, setDoc, getDoc, updateDoc,
  onSnapshot, query, orderBy, where, limit, startAfter, getDocs, getCountFromServer,
  writeBatch, serverTimestamp, Timestamp,
  QueryDocumentSnapshot, DocumentData, Unsubscribe,
} from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase.ts';
import { CampusItem, ClaimRecord, User, CampusNotification } from '../types/index.ts';
import { ITEM_EXPIRY_DAYS } from '../config/catalog.ts';
import { validateNileEmail } from '../utils/authValidation.ts';
import { reportError } from '../components/ErrorBoundary.tsx';

const ITEMS = 'items';
const CLAIMS = 'claims';
const USERS = 'users';
const ROLES = 'roles';
const STAFF_INVITES = 'staffInvites';
const NOTIFICATIONS = 'notifications';
const EXPIRY_MS = ITEM_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
const ITEMS_PAGE_SIZE = 20;
const CLAIMS_PAGE_SIZE = 20;
const ROLES_PAGE_SIZE = 25;
const USERS_PAGE_SIZE = 25;

export interface UserRoleRecord {
  uid: string;
  email: string;
  role: 'admin' | 'security' | 'student';
  assignedAt?: string;
  assignedBy?: string;
  pending?: boolean;
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

export interface RolesPage {
  records: UserRoleRecord[];
  nextRolesCursor?: QueryDocumentSnapshot<DocumentData>;
  nextInvitesCursor?: QueryDocumentSnapshot<DocumentData>;
  hasMore: boolean;
}

export interface UsersDirectoryPage {
  users: Array<{ uid: string; email: string; name: string }>;
  nextCursor?: QueryDocumentSnapshot<DocumentData>;
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
  match_alert: { title: 'Possible item match', message: 'A possible match was found for your report.' },
  item_returned: { title: 'Item returned', message: 'Your reported item was marked returned.' },
  admin_review: { title: 'Review needed', message: 'A campus record needs administrator review.' },
};

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
    claimantId: d.claimantId || undefined,
    finderId: d.finderId || undefined,
    createdAt: toIsoString(d.createdAt),
  };
}

export async function fetchUserRole(uid: string, email?: string | null): Promise<'admin' | 'security' | 'student'> {
  const normalizedEmail = (email || auth.currentUser?.email || '').trim().toLowerCase();

  try {
    if (uid) {
      if (await isConfiguredAdmin(uid)) {
        return 'admin';
      }
      const snap = await getDoc(doc(db, ROLES, uid));
      if (snap.exists()) {
        const role = snap.data().role;
        return role === 'admin' || role === 'security' ? role : 'student';
      }
    }

    if (normalizedEmail) {
      const inviteSnap = await getDoc(doc(db, STAFF_INVITES, normalizedEmail));
      if (inviteSnap.exists()) {
        const role = inviteSnap.data().role;
        if (role === 'admin' || role === 'security') return role;
      }
    }

    return 'student';
  } catch (error) {
    reportError('fetchUserRole', error);
    throw new Error('Could not verify your campus role. Check your connection and retry.');
  }
}

export async function assignUserRoleByEmail(
  targetEmail: string,
  newRole: 'admin' | 'security' | 'student',
  assignedByEmail?: string
): Promise<'assigned' | 'pending'> {
  if (!auth.currentUser || !(await isConfiguredAdmin(auth.currentUser.uid))) {
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
        batch.set(doc(db, ROLES, targetUid), { ...payload, updatedAt: serverTimestamp() }, { merge: true });
      }
      await batch.commit();
      return userSnap.empty ? 'pending' : 'assigned';
    }

    // Always anchor staff invites by verified token email so unverified profile changes cannot escalate privileges.
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

export async function fetchRolesPage(
  rolesCursor?: QueryDocumentSnapshot<DocumentData>,
  invitesCursor?: QueryDocumentSnapshot<DocumentData>,
  pageSize = ROLES_PAGE_SIZE,
  fetchRoles = true,
  fetchInvites = true,
): Promise<RolesPage> {
  try {
    const [rolesSnap, invitesSnap] = await Promise.all([
      fetchRoles
        ? getDocs(query(collection(db, ROLES), orderBy('__name__'), limit(pageSize + 1), ...(rolesCursor ? [startAfter(rolesCursor)] : [])))
        : Promise.resolve(null),
      fetchInvites
        ? getDocs(query(collection(db, STAFF_INVITES), orderBy('__name__'), limit(pageSize + 1), ...(invitesCursor ? [startAfter(invitesCursor)] : [])))
        : Promise.resolve(null),
    ]);

    const rolesDocs = rolesSnap ? rolesSnap.docs.slice(0, pageSize) : [];
    const invitesDocs = invitesSnap ? invitesSnap.docs.slice(0, pageSize) : [];
    const hasMoreRoles = Boolean(rolesSnap && rolesSnap.docs.length > pageSize);
    const hasMoreInvites = Boolean(invitesSnap && invitesSnap.docs.length > pageSize);

    const seenEmails = new Set<string>();
    const activeRoles: UserRoleRecord[] = rolesDocs
      .map((d) => {
        const data = d.data();
        const email = String(data.email || '').toLowerCase();
        if (email) seenEmails.add(email);
        return {
          uid: d.id,
          email,
          role: (data.role || 'student') as UserRoleRecord['role'],
          assignedAt: data.assignedAt ? toIsoString(data.assignedAt) : data.updatedAt ? toIsoString(data.updatedAt) : undefined,
          assignedBy: data.assignedBy,
        };
      })
      .filter((r) => r.role !== 'student');

    const pendingRoles: UserRoleRecord[] = invitesDocs
      .filter((d) => !seenEmails.has(String(d.data().email || d.id).toLowerCase()))
      .map((d) => {
        const data = d.data();
        return {
          uid: d.id,
          email: String(data.email || d.id),
          role: (data.role || 'student') as UserRoleRecord['role'],
          assignedAt: data.assignedAt ? toIsoString(data.assignedAt) : undefined,
          assignedBy: data.assignedBy,
          pending: true,
        };
      })
      .filter((r) => r.role !== 'student');

    return {
      records: [...activeRoles, ...pendingRoles],
      nextRolesCursor: hasMoreRoles ? rolesDocs.at(-1) : undefined,
      nextInvitesCursor: hasMoreInvites ? invitesDocs.at(-1) : undefined,
      hasMore: hasMoreRoles || hasMoreInvites,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, ROLES);
  }
}

export async function fetchUsersDirectoryPage(
  cursor?: QueryDocumentSnapshot<DocumentData>,
  pageSize = USERS_PAGE_SIZE
): Promise<UsersDirectoryPage> {
  try {
    const snap = await getDocs(
      query(collection(db, USERS), orderBy('__name__'), limit(pageSize + 1), ...(cursor ? [startAfter(cursor)] : []))
    );
    const hasMore = snap.docs.length > pageSize;
    const pageDocs = snap.docs.slice(0, pageSize);
    return {
      users: pageDocs
        .map((d) => ({ uid: d.id, email: String(d.data().email || ''), name: String(d.data().name || '') }))
        .filter((u) => Boolean(u.email)),
      nextCursor: hasMore ? pageDocs.at(-1) : undefined,
      hasMore,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, USERS);
  }
}

export async function isConfiguredAdmin(uid?: string): Promise<boolean> {
  if (!uid) return false;
  try {
    const snapshot = await getDoc(doc(db, 'admins', uid));
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
  const safeLimit = Math.min(Math.max(1, pageLimit), 49);
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
}

export async function fetchItemsPage(cursor?: QueryDocumentSnapshot<DocumentData>): Promise<ItemPage> {
  const q = query(
    collection(db, ITEMS),
    orderBy('createdAt', 'desc'),
    limit(ITEMS_PAGE_SIZE + 1),
    ...(cursor ? [startAfter(cursor)] : [])
  );
  try {
    const snapshot = await getDocs(q);
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
    const snap = await getDoc(doc(db, ITEMS, itemId, 'media', 'full'));
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
  const [privateSnap, secretSnap] = await Promise.all([
    getDoc(doc(db, ITEMS, itemId, 'private', 'details')),
    getDoc(doc(db, ITEMS, itemId, 'secrets', 'verification')),
  ]);
  return {
    authorName: privateSnap.exists() ? privateSnap.data().authorName : undefined,
    authorEmail: privateSnap.exists() ? privateSnap.data().authorEmail : undefined,
    expectedAnswer: secretSnap.exists() ? secretSnap.data().expectedAnswer : undefined,
  };
}

export async function fetchClaimPrivateDetails(itemId: string, claimId: string): Promise<ClaimPrivateDetails> {
  try {
    const snap = await getDoc(doc(db, ITEMS, itemId, 'privateClaims', claimId));
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
    const snap = await getDoc(doc(db, ITEMS, itemId, 'private', 'details'));
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
    await updateDoc(doc(db, ITEMS, itemId), { status, updatedAt: serverTimestamp() });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${ITEMS}/${itemId}`);
  }
}

export async function fetchCampusAuditCounts(): Promise<CampusAuditCounts> {
  const [totalSnap, foundSnap, foundRetSnap, totalRetSnap, custodySnap, pendingSnap] = await Promise.all([
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
  ]);
  return {
    totalItems: totalSnap.data().count,
    totalFound: foundSnap.data().count,
    foundReturned: foundRetSnap.data().count,
    totalReturned: totalRetSnap.data().count,
    custodyCount: custodySnap.data().count,
    pendingClaimsCount: pendingSnap.data().count,
  };
}

export async function deleteItemFromFirestore(itemId: string): Promise<void> {
  try {
    const [privateClaimsSnap, claimsSnap] = await Promise.all([
      getDocs(query(collection(db, ITEMS, itemId, 'privateClaims'), limit(50))),
      getDocs(query(collection(db, CLAIMS), where('itemId', '==', itemId), limit(50))),
    ]);

    const batch = writeBatch(db);
    batch.delete(doc(db, ITEMS, itemId, 'media', 'full'));
    batch.delete(doc(db, ITEMS, itemId, 'private', 'details'));
    batch.delete(doc(db, ITEMS, itemId, 'secrets', 'verification'));
    privateClaimsSnap.docs.forEach((d) => batch.delete(d.ref));
    claimsSnap.docs.forEach((d) => batch.delete(d.ref));
    batch.delete(doc(db, ITEMS, itemId));
    await batch.commit();
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
  if (!uid) {
    onSuccess([], false, undefined);
    return () => {};
  }

  const isPrivileged = user?.isAdmin || user?.role === 'admin' || user?.role === 'security';

  if (isPrivileged) {
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
  const unsubFinder = onSnapshot(
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

  return () => {
    unsubClaimant();
    unsubFinder();
  };
}

export async function fetchMoreClaimsPage(
  user: User | null,
  cursor: ClaimsCursor,
  pageSize = CLAIMS_PAGE_SIZE
): Promise<ClaimsPage> {
  const uid = auth.currentUser?.uid;
  if (!uid) return { claims: [], hasMore: false };
  const isPrivileged = user?.isAdmin || user?.role === 'admin' || user?.role === 'security';

  try {
    if (isPrivileged) {
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

export async function updateClaimStatusInFirestore(
  claimId: string,
  itemId: string,
  status: 'approved' | 'rejected',
  otherPendingClaimIds: string[] = []
): Promise<'verified' | 'open' | 'claim_requested'> {
  try {
    const batch = writeBatch(db);
    batch.update(doc(db, CLAIMS, claimId), { status, updatedAt: serverTimestamp() });

    let nextItemStatus: 'verified' | 'open' | 'claim_requested' = 'claim_requested';
    if (status === 'approved') {
      // Mark verified for handover and atomically close competing pending claims.
      nextItemStatus = 'verified';
      batch.update(doc(db, ITEMS, itemId), { status: 'verified', updatedAt: serverTimestamp() });
      otherPendingClaimIds.forEach((otherId) => {
        if (otherId !== claimId) {
          batch.update(doc(db, CLAIMS, otherId), { status: 'rejected', updatedAt: serverTimestamp() });
        }
      });
    } else if (otherPendingClaimIds.length === 0) {
      nextItemStatus = 'open';
      batch.update(doc(db, ITEMS, itemId), { status: 'open', updatedAt: serverTimestamp() });
    }

    await batch.commit();
    return nextItemStatus;
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
      const preservedDept = user.department?.trim() || existingData.department || '';
      const preservedMatric = user.matricNumber?.trim() || existingData.matricNumber || '';
      await updateDoc(userRef, {
        name: displayName,
        email: authEmail,
        department: preservedDept.slice(0, 100),
        matricNumber: preservedMatric.slice(0, 20),
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
  if (!auth.currentUser || !currentUser) {
    onSuccess([]);
    return () => {};
  }
  const isStaff = currentUser.role === 'admin' || currentUser.role === 'security' || currentUser.isAdmin;
  const q = isStaff
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
  try {
    const docRef = await addDoc(collection(db, NOTIFICATIONS), {
      recipientUid: notification.recipientUid.slice(0, 128),
      fromUid: auth.currentUser.uid.slice(0, 128),
      type: notification.type,
      title: template.title,
      message: template.message,
      read: false,
      createdAt: serverTimestamp(),
      ...(notification.itemId && { itemId: notification.itemId.slice(0, 128) }),
      ...(notification.claimId && { claimId: notification.claimId.slice(0, 128) }),
      ...(notification.sourceItemId && { sourceItemId: notification.sourceItemId.slice(0, 128) }),
    });
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
