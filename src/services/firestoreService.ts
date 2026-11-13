/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Firestore persistence service for NileFound items, claims, roles, and notifications.
 */

import {
  collection, doc, addDoc, setDoc, getDoc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, where, limit, startAfter, getDocs,
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

export async function fetchUserRole(uid: string, email?: string | null): Promise<'admin' | 'security' | 'student'> {
  const normalizedEmail = (email || auth.currentUser?.email || '').trim().toLowerCase();
  if (isMasterAdminEmail(normalizedEmail)) {
    if (uid) {
      const now = new Date().toISOString();
      setDoc(doc(db, ROLES, uid), { role: 'admin', email: BOOTSTRAPPED_ADMIN_EMAIL, assignedAt: now, assignedBy: 'System Bootstrap' }, { merge: true }).catch(() => {});
      setDoc(doc(db, 'admins', uid), { enabled: true, email: BOOTSTRAPPED_ADMIN_EMAIL, updatedAt: now }, { merge: true }).catch(() => {});
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

  const now = new Date().toISOString();
  const payload = { role: newRole, email, assignedAt: now, assignedBy: assignedByEmail };

  try {
    const userSnap = await getDocs(query(collection(db, USERS), where('email', '==', email), limit(1)));
    if (!userSnap.empty) {
      const targetUid = userSnap.docs[0].id;
      await setDoc(doc(db, ROLES, targetUid), payload, { merge: true });
      deleteDoc(doc(db, STAFF_INVITES, email)).catch(() => {});
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
        assignedAt: data.assignedAt || data.updatedAt,
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
          assignedAt: data.assignedAt,
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
      return {
        id: docSnap.id,
        type: d.type || 'lost',
        title: d.title || '',
        category: d.category || 'other',
        description: d.description || '',
        location: d.location || '',
        locationDetails: d.locationDetails || undefined,
        dateLostOrFound: d.dateLostOrFound || d.createdAt || new Date().toISOString(),
        status: d.status || 'open',
        holdingLocation: d.holdingLocation || 'finder_holding',
        imageUrl: d.imageUrl || undefined,
        isSensitiveId: d.isSensitiveId || false,
        verificationQuestion: d.verificationQuestion || undefined,
        reportedByEmailDomain: 'nileuniversity.edu.ng',
        authorId: d.authorId || undefined,
        createdAt: d.createdAt || new Date().toISOString(),
      } as CampusItem;
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
  const name = auth.currentUser.displayName || email.split('@')[0];
  const now = new Date().toISOString();

  const payload: Record<string, unknown> = {
    title: item.title.trim().slice(0, 100),
    type: item.type,
    category: item.category,
    description: item.description.trim().slice(0, 1000),
    location: item.location.slice(0, 100),
    dateLostOrFound: item.dateLostOrFound,
    status: 'open',
    holdingLocation: item.holdingLocation,
    authorId: uid,
    createdAt: now,
    updatedAt: now,
    ...(item.locationDetails?.trim() && { locationDetails: item.locationDetails.trim().slice(0, 160) }),
    ...(item.imageUrl && { imageUrl: item.imageUrl }),
    ...(item.verificationQuestion && { verificationQuestion: item.verificationQuestion.slice(0, 300) }),
    ...(item.isSensitiveId !== undefined && { isSensitiveId: item.isSensitiveId }),
  };

  try {
    const docRef = await addDoc(collection(db, ITEMS), payload);
    await setDoc(doc(db, ITEMS, docRef.id, 'private', 'details'), {
      itemId: docRef.id,
      authorId: uid,
      authorName: name.slice(0, 100),
      authorEmail: email.slice(0, 100),
      createdAt: now,
    });
    if (item.verificationAnswerHash && item.type === 'found') {
      await setDoc(doc(db, ITEMS, docRef.id, 'secrets', 'verification'), {
        itemId: docRef.id,
        authorId: uid,
        expectedAnswer: item.verificationAnswerHash.slice(0, 500),
        createdAt: now,
      });
    }
    return docRef.id;
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

export async function updateItemStatusInFirestore(itemId: string, status: CampusItem['status']): Promise<void> {
  try {
    await updateDoc(doc(db, ITEMS, itemId), { status, updatedAt: new Date().toISOString() });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${ITEMS}/${itemId}`);
  }
}

export async function deleteItemFromFirestore(itemId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, ITEMS, itemId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${ITEMS}/${itemId}`);
  }
}

export function subscribeToRealtimeClaims(
  user: User | null,
  onSuccess: (claims: ClaimRecord[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  if (!auth.currentUser) {
    onSuccess([]);
    return () => {};
  }
  const q = user?.isAdmin
    ? query(collection(db, CLAIMS), orderBy('createdAt', 'desc'))
    : query(collection(db, CLAIMS), where('claimantId', '==', auth.currentUser.uid));

  return onSnapshot(
    q,
    async (snapshot) => {
      const claims = await Promise.all(
        snapshot.docs.map(async (docSnap) => {
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
            status: d.status || 'pending',
            claimantId: d.claimantId || undefined,
            createdAt: d.createdAt || new Date().toISOString(),
          };
        })
      );
      onSuccess(claims);
    },
    (error) => {
      onError?.(error);
      handleFirestoreError(error, OperationType.LIST, CLAIMS);
    }
  );
}

export async function saveClaimToFirestore(claim: ClaimRecord, _user?: User | null, finderId?: string): Promise<string> {
  if (!auth.currentUser) throw new Error('You must be signed in with a verified Nile account to submit a claim.');

  const uid = auth.currentUser.uid;
  const email = auth.currentUser.email || claim.claimantEmail.slice(0, 100);
  const name = auth.currentUser.displayName || claim.claimantName.slice(0, 100);
  const now = new Date().toISOString();

  try {
    const docRef = await addDoc(collection(db, CLAIMS), {
      itemId: claim.itemId,
      itemTitle: claim.itemTitle.slice(0, 100),
      claimantId: uid,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
      ...(finderId && { finderId }),
    });
    await setDoc(doc(db, ITEMS, claim.itemId, 'privateClaims', docRef.id), {
      itemId: claim.itemId,
      claimId: docRef.id,
      claimantId: uid,
      claimantName: name.slice(0, 100),
      claimantEmail: email.slice(0, 100),
      submittedAnswer: claim.submittedAnswer.slice(0, 500),
      createdAt: now,
    });
    await updateItemStatusInFirestore(claim.itemId, 'claim_requested').catch(() => {});
    return docRef.id;
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
    await updateDoc(doc(db, CLAIMS, claimId), { status, updatedAt: new Date().toISOString() });
    if (status === 'approved') await updateItemStatusInFirestore(itemId, 'returned');
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${CLAIMS}/${claimId}`);
  }
}

export async function syncUserProfile(user: User): Promise<void> {
  if (!user?.id) return;
  try {
    await setDoc(
      doc(db, USERS, user.id),
      {
        name: user.name.slice(0, 100),
        email: user.email.trim().toLowerCase().slice(0, 100),
        role: user.role,
        department: user.department?.slice(0, 100) || '',
        matricNumber: user.matricNumber?.slice(0, 20) || '',
        createdAt: new Date().toISOString(),
      },
      { merge: true }
    );
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
  const isAdmin = currentUser.role === 'admin' || currentUser.isAdmin;
  const q = isAdmin
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
            createdAt: d.createdAt || new Date().toISOString(),
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
      createdAt: (notification.createdAt || new Date().toISOString()).slice(0, 50),
      ...(notification.itemId && { itemId: notification.itemId.slice(0, 128) }),
      ...(notification.claimId && { claimId: notification.claimId.slice(0, 128) }),
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
