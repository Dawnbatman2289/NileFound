/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Firestore persistence service for NileFound items, claims, roles, and notifications.
 */

import {
  collection, doc, addDoc, setDoc, getDoc, updateDoc,
  onSnapshot, query, orderBy, where, limit, startAfter, getDocs,
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

export async function fetchUserRole(uid: string, email?: string | null): Promise<'admin' | 'security' | 'student'> {
  const normalizedEmail = (email || auth.currentUser?.email || '').trim().toLowerCase();
  if (isMasterAdminEmail(normalizedEmail)) {
    if (uid) {
      setDoc(
        doc(db, ROLES, uid),
        { role: 'admin', email: BOOTSTRAPPED_ADMIN_EMAIL, assignedAt: serverTimestamp(), updatedAt: serverTimestamp(), assignedBy: 'System Bootstrap' },
        { merge: true }
      ).catch(() => {});
      setDoc(
        doc(db, 'admins', uid),
        { enabled: true, email: BOOTSTRAPPED_ADMIN_EMAIL, updatedAt: serverTimestamp() },
        { merge: true }
      ).catch(() => {});
    }
    return 'admin';
  }

  if (uid) {
    try {
      const snap = await getDoc(doc(db, ROLES, uid));
      const role = snap.exists() ? snap.data().role : undefined;
      if (role === 'admin' || role === 'security') return role;
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
  if (!auth.currentUser || (await fetchUserRole(auth.currentUser.uid)) !== 'admin') {
    throw new Error('Unauthorized: only an administrator can provision campus roles.');
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
    if (!userSnap.empty) {
      const targetUid = userSnap.docs[0].id;
      const batch = writeBatch(db);
      batch.set(doc(db, ROLES, targetUid), { ...payload, updatedAt: serverTimestamp() }, { merge: true });
      batch.delete(doc(db, STAFF_INVITES, email));
      await batch.commit();
      return 'assigned';
    }
    await setDoc(doc(db, STAFF_INVITES, email), payload, { merge: true });
    return 'pending';
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${ROLES}/${email}`);
  }
}

export async function fetchAllRoles(): Promise<UserRoleRecord[]> {
  try {
    const [rolesSnap, invitesSnap] = await Promise.all([
      getDocs(query(collection(db, ROLES), orderBy('__name__'), limit(50))),
      getDocs(query(collection(db, STAFF_INVITES), orderBy('__name__'), limit(50))).catch(() => null),
    ]);

    const seenEmails = new Set<string>();
    const activeRoles: UserRoleRecord[] = rolesSnap.docs.map((d) => {
      const data = d.data();
      const email = String(data.email || '').toLowerCase();
      if (email) seenEmails.add(email);
      return {
        uid: d.id,
        email,
        role: data.role || 'student',
        assignedAt: data.assignedAt ? toIsoString(data.assignedAt) : data.updatedAt ? toIsoString(data.updatedAt) : undefined,
        assignedBy: data.assignedBy,
      };
    });

    const pendingRoles: UserRoleRecord[] = (invitesSnap?.docs ?? [])
      .filter((d) => !seenEmails.has(String(d.data().email || d.id).toLowerCase()))
      .map((d) => {
        const data = d.data();
        return {
          uid: d.id,
          email: String(data.email || d.id),
          role: data.role || 'student',
          assignedAt: data.assignedAt ? toIsoString(data.assignedAt) : undefined,
          assignedBy: data.assignedBy,
          pending: true,
        };
      });

    return [...activeRoles, ...pendingRoles];
  } catch {
    return [];
  }
}

export async function fetchUsersDirectory(): Promise<Array<{ uid: string; email: string; name: string }>> {
  try {
    const snap = await getDocs(query(collection(db, USERS), limit(100)));
    return snap.docs
      .map((d) => ({ uid: d.id, email: String(d.data().email || ''), name: String(d.data().name || '') }))
      .filter((u) => Boolean(u.email));
  } catch {
    return [];
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

export async function fetchItemsPage(cursor?: QueryDocumentSnapshot<DocumentData>): Promise<ItemPage> {
  const q = query(collection(db, ITEMS), orderBy('createdAt', 'desc'), limit(20), ...(cursor ? [startAfter(cursor)] : []));
  try {
    const snapshot = await getDocs(q);
    const items = snapshot.docs.map((docSnap) => {
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
    });
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
    if (item.verificationAnswerHash && item.type === 'found') {
      batch.set(doc(db, ITEMS, itemRef.id, 'secrets', 'verification'), {
        itemId: itemRef.id,
        authorId: uid,
        expectedAnswer: item.verificationAnswerHash.slice(0, 500),
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
    getDoc(doc(db, ITEMS, itemId, 'private', 'details')).catch(() => null),
    getDoc(doc(db, ITEMS, itemId, 'secrets', 'verification')).catch(() => null),
  ]);
  return {
    authorName: privateSnap?.exists() ? privateSnap.data().authorName : undefined,
    authorEmail: privateSnap?.exists() ? privateSnap.data().authorEmail : undefined,
    expectedAnswer: secretSnap?.exists() ? secretSnap.data().expectedAnswer : undefined,
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
  } catch {
    return null;
  }
}

export async function updateItemStatusInFirestore(itemId: string, status: CampusItem['status']): Promise<void> {
  try {
    await updateDoc(doc(db, ITEMS, itemId), { status, updatedAt: serverTimestamp() });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${ITEMS}/${itemId}`);
  }
}

export async function deleteItemFromFirestore(itemId: string): Promise<void> {
  try {
    const [privateClaimsSnap, claimsSnap] = await Promise.all([
      getDocs(collection(db, ITEMS, itemId, 'privateClaims')).catch(() => null),
      getDocs(query(collection(db, CLAIMS), where('itemId', '==', itemId))).catch(() => null),
    ]);

    const batch = writeBatch(db);
    batch.delete(doc(db, ITEMS, itemId, 'private', 'details'));
    batch.delete(doc(db, ITEMS, itemId, 'secrets', 'verification'));
    privateClaimsSnap?.docs.forEach((d) => batch.delete(d.ref));
    claimsSnap?.docs.forEach((d) => batch.delete(d.ref));
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
    const q = query(collection(db, CLAIMS), orderBy('createdAt', 'desc'));
    return onSnapshot(
      q,
      async (snapshot) => onSuccess(await hydrateSnapshot(snapshot.docs)),
      (error) => {
        onError?.(error);
        handleFirestoreError(error, OperationType.LIST, CLAIMS);
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
    query(collection(db, CLAIMS), where('claimantId', '==', uid)),
    (snap) => { claimantDocs = snap.docs; emitMerged().catch(() => {}); },
    (error) => onError?.(error)
  );
  const unsubFinder = onSnapshot(
    query(collection(db, CLAIMS), where('finderId', '==', uid)),
    (snap) => { finderDocs = snap.docs; emitMerged().catch(() => {}); },
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

  const resolvedFinderId = finderId || (await getDoc(doc(db, ITEMS, claim.itemId))).data()?.authorId;
  if (!resolvedFinderId) throw new Error('The item you tried to claim could not be found.');

  const claimId = `${claim.itemId}_${uid}`;

  try {
    const batch = writeBatch(db);
    batch.set(doc(db, CLAIMS, claimId), {
      itemId: claim.itemId,
      itemTitle: claim.itemTitle.slice(0, 100),
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
  status: 'approved' | 'rejected'
): Promise<void> {
  try {
    const batch = writeBatch(db);
    batch.update(doc(db, CLAIMS, claimId), { status, updatedAt: serverTimestamp() });
    if (status === 'approved') {
      batch.update(doc(db, ITEMS, itemId), { status: 'returned', updatedAt: serverTimestamp() });
    }
    await batch.commit();
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
    const existingSnap = await getDoc(userRef).catch(() => null);
    if (!existingSnap?.exists()) {
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
      await updateDoc(userRef, {
        name: displayName,
        email: authEmail,
        department: user.department?.slice(0, 100) || '',
        matricNumber: user.matricNumber?.slice(0, 20) || '',
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
    ? query(collection(db, NOTIFICATIONS), where('recipientUid', 'in', [currentUser.id, 'admin']), limit(20))
    : query(collection(db, NOTIFICATIONS), where('recipientUid', '==', currentUser.id), limit(20));

  return onSnapshot(
    q,
    (snapshot) => {
      const notifications = snapshot.docs
        .map((docSnap) => {
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
        })
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
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
  await updateDoc(doc(db, NOTIFICATIONS, notificationId), { read: true }).catch(() => {});
}
