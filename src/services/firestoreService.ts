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
  getDocs,
  Unsubscribe,
} from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase.ts';
import { CampusItem, ClaimRecord, User } from '../types/index.ts';

const ITEMS_COLLECTION = 'items';
const CLAIMS_COLLECTION = 'claims';
const USERS_COLLECTION = 'users';
const ROLES_COLLECTION = 'roles';

export interface UserRoleRecord {
  uid: string;
  email?: string;
  role: 'admin' | 'security' | 'student';
  assignedAt?: string;
  assignedBy?: string;
}

/**
 * Fetch role document from /roles/{uid}
 * Specifically designates ayomide2289@gmail.com as Administrator
 */
export async function fetchUserRole(uid: string): Promise<'admin' | 'security' | 'student'> {
  if (!uid) return 'student';

  const currentEmail = auth.currentUser?.email?.trim().toLowerCase();
  if (currentEmail === 'ayomide2289@gmail.com') {
    // Automatically guarantee admin role document exists in /roles/{uid}
    try {
      const roleRef = doc(db, ROLES_COLLECTION, uid);
      await setDoc(
        roleRef,
        {
          role: 'admin',
          email: 'ayomide2289@gmail.com',
          name: 'Ayomide (Lead Admin)',
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch (e) {
      console.debug('Admin self-registration sync:', e);
    }
    return 'admin';
  }

  try {
    const roleDocRef = doc(db, ROLES_COLLECTION, uid);
    const snap = await getDoc(roleDocRef);
    if (snap.exists()) {
      const data = snap.data();
      if (data.role === 'admin' || data.role === 'security') {
        return data.role;
      }
    }
  } catch (error) {
    // Normal when non-admin student is signed in
    console.debug('Role check:', error);
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
  assignedByEmail: string = 'ayomide2289@gmail.com'
): Promise<void> {
  const currentEmail = auth.currentUser?.email?.trim().toLowerCase();
  if (currentEmail !== 'ayomide2289@gmail.com') {
    throw new Error('Unauthorized: Only ayomide2289@gmail.com is authorized to provision campus administrator and security roles.');
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
export async function fetchAllRoles(): Promise<UserRoleRecord[]> {
  try {
    const snap = await getDocs(collection(db, ROLES_COLLECTION));
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        uid: d.id,
        email: data.email || '',
        role: data.role || 'student',
        assignedAt: data.assignedAt || data.updatedAt,
        assignedBy: data.assignedBy,
      };
    });
  } catch (error) {
    console.warn('Could not fetch roles collection:', error);
    return [];
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
  // If client is not signed in to Firebase Auth, do not execute query
  if (!auth.currentUser) {
    onSuccess([]);
    return () => {};
  }

  const itemsRef = collection(db, ITEMS_COLLECTION);
  const q = query(itemsRef, orderBy('createdAt', 'desc'));

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
          dateLostOrFound: data.dateLostOrFound || data.createdAt || new Date().toISOString(),
          status: data.status || 'open',
          holdingLocation: data.holdingLocation || 'finder_holding',
          imageUrl: data.imageUrl || undefined,
          isSensitiveId: data.isSensitiveId || false,
          verificationQuestion: data.verificationQuestion || undefined,
          reportedByEmailDomain: data.authorEmail ? data.authorEmail.split('@')[1] : 'nileuniversity.edu.ng',
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
    authorName: authorName.slice(0, 100),
    authorEmail: authorEmail.slice(0, 100),
    createdAt: nowIso,
    updatedAt: nowIso,
  };

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

    // If there is an expected verification answer, save into protected subcollection
    if (item.verificationAnswerHash && item.type === 'found') {
      const secretRef = doc(db, ITEMS_COLLECTION, docRef.id, 'secrets', 'verification');
      await setDoc(secretRef, {
        itemId: docRef.id,
        authorId: currentUid,
        expectedAnswer: item.verificationAnswerHash.slice(0, 500),
        createdAt: new Date().toISOString(),
      });
    }

    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, ITEMS_COLLECTION);
  }
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
    (snapshot) => {
      const claims: ClaimRecord[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          itemId: data.itemId,
          itemTitle: data.itemTitle || 'Item',
          claimantName: data.claimantName || 'Claimant',
          claimantEmail: data.claimantEmail || '',
          submittedAnswer: data.submittedAnswer || '',
          status: data.status || 'pending',
          createdAt: data.createdAt || new Date().toISOString(),
        };
      });
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
    claimantName,
    claimantEmail,
    submittedAnswer: claim.submittedAnswer.slice(0, 500),
    status: 'pending',
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  if (finderId) {
    payload.finderId = finderId;
  }

  try {
    const docRef = await addDoc(collection(db, CLAIMS_COLLECTION), payload);
    // Also mark the item as claim_requested
    await updateItemStatusInFirestore(claim.itemId, 'claim_requested');
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
