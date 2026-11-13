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
import { BOOTSTRAPPED_ADMIN_EMAIL, isMasterAdminEmail, validateNileEmail } from '../utils/authValidation.ts';

const ITEMS = 'items';
const CLAIMS = 'claims';
const USERS = 'users';
const ROLES = 'roles';
const STAFF_INVITES = 'staffInvites';
const NOTIFICATIONS = 'notifications';
const SIXTY_DAYS_MS = 60 * 24 * 60 * 60 * 1000;

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

export interface ItemPage {
  items: CampusItem[];
  nextCursor?: QueryDocumentSnapshot<DocumentData>;
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
  if (!Number.isNaN(createdMs) && Date.now() - createdMs > SIXTY_DAYS_MS) {
    return { ...item, status: 'expired' };
  }
  return item;
}

function mapDocToCampusItem(docSnap: QueryDocumentSnapshot<DocumentData>): CampusItem {
  const d = docSnap.data();
  const createdAt = toIsoString(d.createdAt);
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
    imageUrl: d.category === 'student_id' ? undefined : (d.imageUrl || undefined),
    isSensitiveId: d.isSensitiveId || d.category === 'student_id',
    verificationQuestion: d.verificationQuestion || undefined,
    reportedByEmailDomain: 'nileuniversity.edu.ng',
    authorId: d.authorId || undefined,
    createdAt,
  };
  return applyReadTimeExpiry(raw);
}

export async function fetchUserRole(uid: string, email?: string | null): Promise<'admin' | 'security' | 'student'> {
  const normalizedEmail = (email || auth.currentUser?.email || '').trim().toLowerCase();
  if (isMasterAdminEmail(normalizedEmail)) {
    return 'admin';
  }

  if (uid) {
    try {
      const snap = await getDoc(doc(db, ROLES, uid));
      if (snap.exists()) {
        const role = snap.data().role;
        return role === 'admin' || role === 'security' ? role : 'student';
      }
    } catch { /* fall through to email invite */ }
  }

  if (normalizedEmail) {
    try {
      const inviteSnap = await getDoc(doc(db, STAFF_INVITES, normalizedEmail));
      const role = inviteSnap.exists() ? inviteSnap.data().role : undefined;
      if (role === 'admin' || role === 'security') return role;
    } catch { /* remain student */ }
  }

  return 'student';
}

export async function assignUserRoleByEmail(
  targetEmail: string,
  newRole: 'admin' | 'security' | 'student',
  assignedByEmail = 'owner@example.com'
): Promise<'assigned' | 'pending'> {
  if (!auth.currentUser || !isMasterAdminEmail(auth.currentUser.email)) {
    throw new Error('Unauthorized: only the project owner can provision campus roles.');
  }

  const email = targetEmail.trim().toLowerCase();
  if (!validateNileEmail(email)) {
    throw new Error('Enter a valid @nileuniversity.edu.ng email address.');
  }

  const payload = {
    role: newRole,
    email,
    assignedAt: serverTimestamp(),
    assignedBy: assignedByEmail.slice(0, 128),
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

export async function fetchAllRoles(): Promise<UserRoleRecord[]> {
  try {
    const [rolesSnap, invitesSnap] = await Promise.all([
      getDocs(query(collection(db, ROLES), orderBy('__name__'), limit(50))),
      getDocs(query(collection(db, STAFF_INVITES), orderBy('__name__'), limit(50))),
    ]);

    const seenEmails = new Set<string>();
    const activeRoles: UserRoleRecord[] = rolesSnap.docs
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

    const pendingRoles: UserRoleRecord[] = invitesSnap.docs
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

    return [...activeRoles, ...pendingRoles];
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, ROLES);
  }
}

export async function fetchUsersDirectory(): Promise<Array<{ uid: string; email: string; name: string }>> {
  try {
    const snap = await getDocs(query(collection(db, USERS), limit(100)));
    return snap.docs
      .map((d) => ({ uid: d.id, email: String(d.data().email || ''), name: String(d.data().name || '') }))
      .filter((u) => Boolean(u.email));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, USERS);
  }
}

export async function isConfiguredAdmin(uid?: string, email?: string | null): Promise<boolean> {
  const currentEmail = (email || auth.currentUser?.email || '').trim().toLowerCase();
  if (isMasterAdminEmail(currentEmail)) return true;
  if (!uid) return false;
  try {
    const snapshot = await getDoc(doc(db, 'admins', uid));
    return snapshot.exists() && snapshot.data().enabled === true;
  } catch {
    return false;
  }
}

export function subscribeToRealtimeItems(
  pageLimit: number,
  onSuccess: (items: CampusItem[], hasMore: boolean) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const q = query(collection(db, ITEMS), orderBy('createdAt', 'desc'), limit(pageLimit + 1));
  return onSnapshot(
    q,
    (snapshot) => {
      const hasMore = snapshot.docs.length > pageLimit;
      const items = snapshot.docs.slice(0, pageLimit).map(mapDocToCampusItem);
      onSuccess(items, hasMore);
    },
    (error) => {
      onError?.(error);
    }
  );
}

export async function fetchItemsPage(cursor?: QueryDocumentSnapshot<DocumentData>): Promise<ItemPage> {
  const q = query(collection(db, ITEMS), orderBy('createdAt', 'desc'), limit(20), ...(cursor ? [startAfter(cursor)] : []));
  try {
    const snapshot = await getDocs(q);
    const items = snapshot.docs.map(mapDocToCampusItem);
    return { items, nextCursor: snapshot.docs.at(-1) };
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, ITEMS);
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
    ...(!isStudentId && item.imageUrl && { imageUrl: item.imageUrl }),
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

export async function expireItemsBatchInFirestore(itemIds: string[]): Promise<void> {
  if (itemIds.length === 0) return;
  try {
    const chunkSize = 400;
    for (let i = 0; i < itemIds.length; i += chunkSize) {
      const batch = writeBatch(db);
      itemIds.slice(i, i + chunkSize).forEach((itemId) => {
        batch.update(doc(db, ITEMS, itemId), { status: 'expired', updatedAt: serverTimestamp() });
      });
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, ITEMS);
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
      getDocs(collection(db, ITEMS, itemId, 'privateClaims')),
      getDocs(query(collection(db, CLAIMS), where('itemId', '==', itemId))),
    ]);

    const batch = writeBatch(db);
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
  onSuccess: (claims: ClaimRecord[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const uid = auth.currentUser?.uid;
  if (!uid) {
    onSuccess([]);
    return () => {};
  }

  const isPrivileged = user?.isAdmin || user?.role === 'admin' || user?.role === 'security';

  const hydrateSnapshot = async (docs: QueryDocumentSnapshot<DocumentData>[]): Promise<ClaimRecord[]> => {
    const hydrated = await Promise.all(
      docs.map(async (docSnap) => {
        const d = docSnap.data();
        const privSnap = await getDoc(doc(db, ITEMS, d.itemId, 'privateClaims', docSnap.id)).catch(() => null);
        const priv = privSnap?.exists() ? privSnap.data() : {};
        return {
          id: docSnap.id,
          itemId: d.itemId,
          itemTitle: d.itemTitle || 'Item',
          claimantName: priv.claimantName || 'Claimant',
          claimantEmail: priv.claimantEmail || '',
          submittedAnswer: priv.submittedAnswer || '',
          status: (d.status || 'pending') as ClaimRecord['status'],
          claimantId: d.claimantId || undefined,
          createdAt: toIsoString(d.createdAt),
        };
      })
    );
    return hydrated.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  };

  if (isPrivileged) {
    const q = query(collection(db, CLAIMS), orderBy('createdAt', 'desc'), limit(50));
    return onSnapshot(
      q,
      async (snapshot) => {
        try {
          onSuccess(await hydrateSnapshot(snapshot.docs));
        } catch (err) {
          onError?.(err instanceof Error ? err : new Error('Could not load claims.'));
        }
      },
      (error) => {
        onError?.(error);
      }
    );
  }

  // Regular users see both claims they filed and claims filed against items they found
  let claimantDocs: QueryDocumentSnapshot<DocumentData>[] = [];
  let finderDocs: QueryDocumentSnapshot<DocumentData>[] = [];

  const emitMerged = async () => {
    const byId = new Map<string, QueryDocumentSnapshot<DocumentData>>();
    claimantDocs.forEach((d) => byId.set(d.id, d));
    finderDocs.forEach((d) => byId.set(d.id, d));
    onSuccess(await hydrateSnapshot([...byId.values()]));
  };

  const unsubClaimant = onSnapshot(
    query(collection(db, CLAIMS), where('claimantId', '==', uid), orderBy('createdAt', 'desc'), limit(30)),
    (snap) => { claimantDocs = snap.docs; emitMerged().catch((err) => onError?.(err)); },
    (error) => onError?.(error)
  );
  const unsubFinder = onSnapshot(
    query(collection(db, CLAIMS), where('finderId', '==', uid), orderBy('createdAt', 'desc'), limit(30)),
    (snap) => { finderDocs = snap.docs; emitMerged().catch((err) => onError?.(err)); },
    (error) => onError?.(error)
  );

  return () => {
    unsubClaimant();
    unsubFinder();
  };
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
  otherPendingClaimCount = 0
): Promise<'verified' | 'open' | 'claim_requested'> {
  try {
    const batch = writeBatch(db);
    batch.update(doc(db, CLAIMS, claimId), { status, updatedAt: serverTimestamp() });

    let nextItemStatus: 'verified' | 'open' | 'claim_requested' = 'claim_requested';
    if (status === 'approved') {
      // Mark verified for handover; physical handover confirmation marks it 'returned'.
      nextItemStatus = 'verified';
      batch.update(doc(db, ITEMS, itemId), { status: 'verified', updatedAt: serverTimestamp() });
    } else if (otherPendingClaimCount === 0) {
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
        role: isMasterAdminEmail(authEmail) ? user.role : 'student',
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
        ...(isMasterAdminEmail(authEmail) ? { role: user.role } : {}),
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
    (error) => onError?.(error)
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
  } catch {
    throw new Error('Could not save notification. Please try again.');
  }
}

export async function markNotificationAsReadInFirestore(notificationId: string): Promise<void> {
  if (!notificationId || notificationId.startsWith('local-') || notificationId.startsWith('notif-')) return;
  await updateDoc(doc(db, NOTIFICATIONS, notificationId), { read: true });
}
