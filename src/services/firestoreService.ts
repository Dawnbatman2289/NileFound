/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Firestore persistence service for NileFound items and claims
 */

import {
  collection,
  doc,
  addDoc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  where,
  limit,
  startAfter,
  getDocs,
  QueryDocumentSnapshot,
  DocumentData,
  Unsubscribe,
} from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase.ts';
import { CampusItem, ClaimRecord, User, CampusNotification } from '../types/index.ts';
import { BOOTSTRAPPED_ADMIN_EMAIL, isMasterAdminEmail } from '../utils/authValidation.ts';

const ITEMS_COLLECTION = 'items';
const CLAIMS_COLLECTION = 'claims';
const USERS_COLLECTION = 'users';
const ROLES_COLLECTION = 'roles';
const NOTIFICATIONS_COLLECTION = 'notifications';

export interface UserRoleRecord {
  uid: string;
  email?: string;
  role: 'admin' | 'security' | 'student';
  assignedAt?: string;
  assignedBy?: string;
}

/**
 * Fetch role document from /roles/{uid} or bootstrap project owner
 */
export async function fetchUserRole(uid: string, email?: string | null): Promise<'admin' | 'security' | 'student'> {
  const currentEmail = (email || auth.currentUser?.email || '').trim().toLowerCase();
  if (isMasterAdminEmail(currentEmail)) {
    if (uid) {
      setDoc(
        doc(db, ROLES_COLLECTION, uid),
        {
          role: 'admin',
          email: BOOTSTRAPPED_ADMIN_EMAIL,
          assignedAt: new Date().toISOString(),
          assignedBy: 'System Bootstrap',
        },
        { merge: true }
      ).catch(() => {});
      setDoc(
        doc(db, 'config', 'admins', uid),
        {
          enabled: true,
          email: BOOTSTRAPPED_ADMIN_EMAIL,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      ).catch(() => {});
    }
    return 'admin';
  }

  if (!uid) return 'student';

  try {
    const roleDocRef = doc(db, ROLES_COLLECTION, uid);
    const snap = await getDoc(roleDocRef);
    if (snap.exists()) {
      const data = snap.data();
      if (data.role === 'admin' || data.role === 'security') {
        return data.role;
      }
    }
  } catch {
    // A missing or unreadable role record means the user remains a student.
  }
  return 'student';
}

/**
 * Assign or update a user role in /roles/{uid} (Admin only)
 */
export async function assignUserRole(
  targetUid: string,
  targetEmail: string,
  newRole: 'admin' | 'security' | 'student',
  assignedByEmail: string = 'owner@example.com'
): Promise<void> {
  if (!auth.currentUser || (await fetchUserRole(auth.currentUser.uid)) !== 'admin') {
    throw new Error('Unauthorized: only an administrator can provision campus roles.');
  }

  const path = `${ROLES_COLLECTION}/${targetUid}`;
  try {
    const roleDocRef = doc(db, ROLES_COLLECTION, targetUid);
    await setDoc(
      roleDocRef,
      {
        role: newRole,
        email: targetEmail.trim().toLowerCase(),
        assignedAt: new Date().toISOString(),
        assignedBy: assignedByEmail,
      },
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Fetch all role records from /roles (Admin only)
 */
export async function fetchRolesPage(
  cursor?: QueryDocumentSnapshot<DocumentData>
): Promise<{ records: UserRoleRecord[]; nextCursor?: QueryDocumentSnapshot<DocumentData> }> {
  try {
    const rolesQuery = query(
      collection(db, ROLES_COLLECTION),
      orderBy('__name__'),
      limit(50),
      ...(cursor ? [startAfter(cursor)] : [])
    );
    const snap = await getDocs(rolesQuery);
    const records = snap.docs.map((d) => {
      const data = d.data();
      return {
        uid: d.id,
        email: data.email || '',
        role: data.role || 'student',
        assignedAt: data.assignedAt || data.updatedAt,
        assignedBy: data.assignedBy,
      };
    });
    return { records, nextCursor: snap.docs.at(-1) };
  } catch {
    return { records: [] };
  }
}

export async function fetchAllRoles(): Promise<UserRoleRecord[]> {
  const { records } = await fetchRolesPage();
  return records;
}

export async function isConfiguredAdmin(uid?: string, email?: string | null): Promise<boolean> {
  const currentEmail = (email || auth.currentUser?.email || '').trim().toLowerCase();
  if (isMasterAdminEmail(currentEmail)) {
    return true;
  }
  if (!uid) return false;
  try {
    const snapshot = await getDoc(doc(db, 'config', 'admins', uid));
    return snapshot.exists() && snapshot.data().enabled === true;
  } catch {
    return false;
  }
}

export interface ItemPage {
  items: CampusItem[];
  nextCursor?: QueryDocumentSnapshot<DocumentData>;
}

export async function fetchItemsPage(
  cursor?: QueryDocumentSnapshot<DocumentData>
): Promise<ItemPage> {
  const itemsRef = collection(db, ITEMS_COLLECTION);
  const itemsQuery = query(
    itemsRef,
    orderBy('createdAt', 'desc'),
    limit(20),
    ...(cursor ? [startAfter(cursor)] : [])
  );
  try {
    const snapshot = await getDocs(itemsQuery);
    const items = snapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        type: data.type || 'lost',
        title: data.title || '',
        category: data.category || 'other',
        description: data.description || '',
        location: data.location || '',
        locationDetails: data.locationDetails || undefined,
        dateLostOrFound: data.dateLostOrFound || data.createdAt || new Date().toISOString(),
        status: data.status || 'open',
        holdingLocation: data.holdingLocation || 'finder_holding',
        imageUrl: data.imageUrl || undefined,
        isSensitiveId: data.isSensitiveId || false,
        verificationQuestion: data.verificationQuestion || undefined,
        reportedByEmailDomain: 'nileuniversity.edu.ng',
        authorId: data.authorId || undefined,
        createdAt: data.createdAt || new Date().toISOString(),
      } as CampusItem;
    });
    return { items, nextCursor: snapshot.docs.at(-1) };
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, ITEMS_COLLECTION);
  }
}

/**
 * Subscribe to real-time items from Firestore
 * Feed requires signed-in Nile membership
 */
export function subscribeToRealtimeItems(
  onSuccess: (items: CampusItem[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const itemsRef = collection(db, ITEMS_COLLECTION);
  const q = query(itemsRef, orderBy('createdAt', 'desc'), limit(20));

  return onSnapshot(
    q,
    (snapshot) => {
      const items: CampusItem[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          type: data.type || 'lost',
          title: data.title || '',
          category: data.category || 'other',
          description: data.description || '',
          location: data.location || '',
          locationDetails: data.locationDetails || undefined,
          dateLostOrFound: data.dateLostOrFound || data.createdAt || new Date().toISOString(),
          status: data.status || 'open',
          holdingLocation: data.holdingLocation || 'finder_holding',
          imageUrl: data.imageUrl || undefined,
          isSensitiveId: data.isSensitiveId || false,
          verificationQuestion: data.verificationQuestion || undefined,
          reportedByEmailDomain: data.authorEmail ? data.authorEmail.split('@')[1] : 'nileuniversity.edu.ng',
          authorId: data.authorId || undefined,
          createdAt: data.createdAt || new Date().toISOString(),
        };
      });
      onSuccess(items);
    },
    (error) => {
      if (onError) {
        onError(error);
      }
      handleFirestoreError(error, OperationType.LIST, ITEMS_COLLECTION);
    }
  );
}

/**
 * Create a new item document in Firestore
 * If item has a verification answer, store it separately in /items/{itemId}/secrets/verification
 */
export async function saveItemToFirestore(item: CampusItem, _user?: User | null): Promise<string> {
  if (!auth.currentUser) {
    throw new Error('You must be signed in with a verified Nile account to report an item.');
  }
  const currentUid = auth.currentUser.uid;
  const authorEmail = auth.currentUser.email || 'student@nileuniversity.edu.ng';
  const authorName = auth.currentUser.displayName || authorEmail.split('@')[0];

  const nowIso = new Date().toISOString();
  const payload: Record<string, any> = {
    title: item.title.trim().slice(0, 100),
    type: item.type,
    category: item.category,
    description: item.description.trim().slice(0, 1000),
    location: item.location.slice(0, 100),
    dateLostOrFound: item.dateLostOrFound,
    status: 'open',
    holdingLocation: item.holdingLocation,
    authorId: currentUid,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  if (item.locationDetails?.trim()) {
    payload.locationDetails = item.locationDetails.trim().slice(0, 160);
  }

  if (item.imageUrl) {
    payload.imageUrl = item.imageUrl;
  }
  if (item.verificationQuestion) {
    payload.verificationQuestion = item.verificationQuestion.slice(0, 300);
  }
  if (item.isSensitiveId !== undefined) {
    payload.isSensitiveId = item.isSensitiveId;
  }

  try {
    const docRef = await addDoc(collection(db, ITEMS_COLLECTION), payload);

    // Store reporter contact details in private subcollection (readable only by owner & admin)
    const privateRef = doc(db, ITEMS_COLLECTION, docRef.id, 'private', 'details');
    await setDoc(privateRef, {
      itemId: docRef.id,
      authorId: currentUid,
      authorName: authorName.slice(0, 100),
      authorEmail: authorEmail.slice(0, 100),
      createdAt: nowIso,
    });

    // If there is an expected verification answer, save into protected subcollection
    if (item.verificationAnswerHash && item.type === 'found') {
      const secretRef = doc(db, ITEMS_COLLECTION, docRef.id, 'secrets', 'verification');
      await setDoc(secretRef, {
        itemId: docRef.id,
        authorId: currentUid,
        expectedAnswer: item.verificationAnswerHash.slice(0, 500),
        createdAt: nowIso,
      });
    }

    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, ITEMS_COLLECTION);
  }
}

export interface ItemPrivateDetails {
  authorName?: string;
  authorEmail?: string;
  expectedAnswer?: string;
}

async function fetchClaimPrivateDetails(itemId: string, claimId: string): Promise<Pick<ClaimRecord, 'claimantName' | 'claimantEmail' | 'submittedAnswer'>> {
  const snap = await getDoc(doc(db, ITEMS_COLLECTION, itemId, 'privateClaims', claimId));
  const data = snap.exists() ? snap.data() : {};
  return {
    claimantName: data.claimantName || 'Claimant',
    claimantEmail: data.claimantEmail || '',
    submittedAnswer: data.submittedAnswer || '',
  };
}

/**
 * Fetch private reporter details and verification answer for an item (Admin / Owner only)
 */
export async function fetchItemPrivateDetails(itemId: string): Promise<ItemPrivateDetails> {
  const result: ItemPrivateDetails = {};
  try {
    const privateRef = doc(db, ITEMS_COLLECTION, itemId, 'private', 'details');
    const privateSnap = await getDoc(privateRef);
    if (privateSnap.exists()) {
      const d = privateSnap.data();
      result.authorName = d.authorName;
      result.authorEmail = d.authorEmail;
    }
  } catch {
  }

  try {
    const secretRef = doc(db, ITEMS_COLLECTION, itemId, 'secrets', 'verification');
    const secretSnap = await getDoc(secretRef);
    if (secretSnap.exists()) {
      result.expectedAnswer = secretSnap.data().expectedAnswer;
    }
  } catch {
  }

  return result;
}

/**
 * Update the status of an existing item
 */
export async function updateItemStatusInFirestore(
  itemId: string,
  newStatus: CampusItem['status']
): Promise<void> {
  const path = `${ITEMS_COLLECTION}/${itemId}`;
  try {
    const docRef = doc(db, ITEMS_COLLECTION, itemId);
    await updateDoc(docRef, {
      status: newStatus,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

/**
 * Delete an item from Firestore
 */
export async function deleteItemFromFirestore(itemId: string): Promise<void> {
  const path = `${ITEMS_COLLECTION}/${itemId}`;
  try {
    const docRef = doc(db, ITEMS_COLLECTION, itemId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/**
 * Subscribe to claims in Firestore
 */
export function subscribeToRealtimeClaims(
  user: User | null,
  onSuccess: (claims: ClaimRecord[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  // If user is not authenticated in Firebase, claims cannot be read
  if (!auth.currentUser) {
    onSuccess([]);
    return () => {};
  }

  const claimsRef = collection(db, CLAIMS_COLLECTION);
  // Admins can read all claims. Regular students only read claims they filed
  const q = user?.isAdmin
    ? query(claimsRef, orderBy('createdAt', 'desc'))
    : query(claimsRef, where('claimantId', '==', auth.currentUser.uid));

  return onSnapshot(
    q,
    async (snapshot) => {
      const claims = await Promise.all(snapshot.docs.map(async (docSnap) => {
        const data = docSnap.data();
        const privateDetails = await fetchClaimPrivateDetails(data.itemId, docSnap.id).catch(() => ({
          claimantName: 'Claimant',
          claimantEmail: '',
          submittedAnswer: '',
        }));
        return {
          id: docSnap.id,
          itemId: data.itemId,
          itemTitle: data.itemTitle || 'Item',
          claimantName: privateDetails.claimantName,
          claimantEmail: privateDetails.claimantEmail,
          submittedAnswer: privateDetails.submittedAnswer,
          status: data.status || 'pending',
          claimantId: data.claimantId || undefined,
          createdAt: data.createdAt || new Date().toISOString(),
        };
      }));
      onSuccess(claims);
    },
    (error) => {
      if (onError) {
        onError(error);
      }
      handleFirestoreError(error, OperationType.LIST, CLAIMS_COLLECTION);
    }
  );
}

/**
 * Submit a new claim for an item
 */
export async function saveClaimToFirestore(
  claim: ClaimRecord,
  _user?: User | null,
  finderId?: string
): Promise<string> {
  if (!auth.currentUser) {
    throw new Error('You must be signed in with a verified Nile account to submit a claim.');
  }
  const currentUid = auth.currentUser.uid;
  const claimantEmail = auth.currentUser.email || claim.claimantEmail.slice(0, 100);
  const claimantName = auth.currentUser.displayName || claim.claimantName.slice(0, 100);
  const nowIso = new Date().toISOString();

  const payload: Record<string, any> = {
    itemId: claim.itemId,
    itemTitle: claim.itemTitle.slice(0, 100),
    claimantId: currentUid,
    status: 'pending',
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  if (finderId) {
    payload.finderId = finderId;
  }

  try {
    const docRef = await addDoc(collection(db, CLAIMS_COLLECTION), payload);
    await setDoc(doc(db, ITEMS_COLLECTION, claim.itemId, 'privateClaims', docRef.id), {
      itemId: claim.itemId,
      claimId: docRef.id,
      claimantId: currentUid,
      claimantName: claimantName.slice(0, 100),
      claimantEmail: claimantEmail.slice(0, 100),
      submittedAnswer: claim.submittedAnswer.slice(0, 500),
      createdAt: nowIso,
    });
    // Also mark the item as claim_requested
    try {
      await updateItemStatusInFirestore(claim.itemId, 'claim_requested');
    } catch {
      // The claim and its private details are already persisted; status is best effort.
    }
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, CLAIMS_COLLECTION);
  }
}

/**
 * Update claim status (approved / rejected)
 */
export async function updateClaimStatusInFirestore(
  claimId: string,
  itemId: string,
  status: 'approved' | 'rejected'
): Promise<void> {
  const path = `${CLAIMS_COLLECTION}/${claimId}`;
  try {
    const docRef = doc(db, CLAIMS_COLLECTION, claimId);
    await updateDoc(docRef, {
      status,
      updatedAt: new Date().toISOString(),
    });

    if (status === 'approved') {
      await updateItemStatusInFirestore(itemId, 'returned');
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

/**
 * Sync user profile to Firestore /users/{userId}
 */
export async function syncUserProfile(user: User): Promise<void> {
  if (!user || !user.id) return;
  const path = `${USERS_COLLECTION}/${user.id}`;
  try {
    const userRef = doc(db, USERS_COLLECTION, user.id);
    await setDoc(
      userRef,
      {
        name: user.name.slice(0, 100),
        email: user.email.slice(0, 100),
        role: user.role,
        department: user.department?.slice(0, 100) || '',
        matricNumber: user.matricNumber?.slice(0, 20) || '',
        createdAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Subscribe to real-time campus & admin notifications
 * Complies with Spark free-tier: Single onSnapshot limited to latest 20 documents.
 * Unsubscribes on unmount.
 */
export function subscribeToRealtimeNotifications(
  currentUser: User | null,
  onSuccess: (notifications: CampusNotification[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  if (!auth.currentUser || !currentUser) {
    onSuccess([]);
    return () => {};
  }

  const notifsRef = collection(db, NOTIFICATIONS_COLLECTION);
  const isAdmin = currentUser.role === 'admin' || currentUser.isAdmin;

  // Single onSnapshot listener limited to latest 20 items (free-tier constraint)
  const q = isAdmin
    ? query(notifsRef, where('recipientUid', 'in', [currentUser.id, 'admin']), limit(20))
    : query(notifsRef, where('recipientUid', '==', currentUser.id), limit(20));

  return onSnapshot(
    q,
    (snapshot) => {
      const notifications: CampusNotification[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          recipientUid: data.recipientUid || '',
          fromUid: data.fromUid || '',
          type: data.type || 'admin_review',
          title: data.title || 'Campus Notification',
          message: data.message || '',
          read: Boolean(data.read),
          createdAt: data.createdAt || new Date().toISOString(),
          itemId: data.itemId || undefined,
          claimId: data.claimId || undefined,
        };
      }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      onSuccess(notifications);
    },
    (error) => {
      if (onError) onError(error);
    }
  );
}

/**
 * Save a notification to Firestore
 * Validates fields according to security rules:
 * Allowed keys: recipientUid, fromUid, type, title, message, read, createdAt, itemId
 */
export async function saveNotificationToFirestore(
  notification: {
    recipientUid: string;
    fromUid?: string;
    type: CampusNotification['type'];
    title: string;
    message: string;
    itemId?: string;
    claimId?: string;
    createdAt?: string;
  }
): Promise<string> {
  if (!auth.currentUser?.uid) {
    throw new Error('You must be signed in to create a notification.');
  }
  const currentUid = auth.currentUser.uid;
  const nowIso = notification.createdAt || new Date().toISOString();

  const templates: Record<CampusNotification['type'], { title: string; message: string }> = {
    claim_received: { title: 'New claim on your item', message: 'A new ownership claim was filed for your item.' },
    claim_approved: { title: 'Claim approved', message: 'Your ownership claim was approved.' },
    claim_rejected: { title: 'Claim rejected', message: 'Your ownership claim was rejected.' },
    match_alert: { title: 'Possible item match', message: 'A possible match was found for your report.' },
    item_returned: { title: 'Item returned', message: 'Your reported item was marked returned.' },
    admin_review: { title: 'Review needed', message: 'A campus record needs administrator review.' },
  };
  const template = templates[notification.type];
  const payload: Record<string, any> = {
    recipientUid: notification.recipientUid.slice(0, 128),
    fromUid: currentUid.slice(0, 128),
    type: notification.type,
    title: template.title,
    message: template.message,
    read: false,
    createdAt: nowIso.slice(0, 50),
  };

  if (notification.itemId) {
    payload.itemId = notification.itemId.slice(0, 128);
  }
  if (notification.claimId) {
    payload.claimId = notification.claimId.slice(0, 128);
  }

  try {
    const docRef = await addDoc(collection(db, NOTIFICATIONS_COLLECTION), payload);
    return docRef.id;
  } catch {
    throw new Error('Could not save notification. Please try again.');
  }
}

/**
 * Mark a notification as read
 * Only updates the 'read' field as strictly enforced by security rules
 */
export async function markNotificationAsReadInFirestore(notificationId: string): Promise<void> {
  if (!notificationId || notificationId.startsWith('local-') || notificationId.startsWith('notif-')) {
    return;
  }
  try {
    const docRef = doc(db, NOTIFICATIONS_COLLECTION, notificationId);
    await updateDoc(docRef, { read: true });
  } catch {
  }
}
