/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Firestore item queries, reporting writes, custody updates, and deletion.
 */

import {
  collection, doc, getDoc, getDocs, getCountFromServer, updateDoc, onSnapshot,
  query, orderBy, where, limit, startAfter, writeBatch, serverTimestamp,
  Query, QueryDocumentSnapshot, DocumentData, Unsubscribe,
} from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../../lib/firebase.ts';
import { CampusItem, ItemCategory, ItemType, User } from '../../types/index.ts';
import { canUserModerate, isMasterAdminUser } from '../../utils/admin.ts';
import { normalizeNileEmail, resolveDisplayName } from '../../utils/authValidation.ts';
import { normalizeCustomLocation } from '../../config/locations.ts';
import { reportError } from '../../components/ErrorBoundary.tsx';
import {
  ITEMS, CLAIMS, ITEMS_PAGE_SIZE, CampusAuditCounts, ItemPage, ItemPrivateDetails,
  assertFirestoreReady, mapDocToCampusItem, withOfflineRetry,
} from './helpers.ts';
import { fetchUserRole, isConfiguredAdmin } from './roles.ts';

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

export async function fetchMatchCandidatesFromFirestore(
  targetType: ItemType,
  category: ItemCategory,
  maxResults = 20
): Promise<CampusItem[]> {
  try {
    assertFirestoreReady();
    const q = query(
      collection(db, ITEMS),
      where('type', '==', targetType),
      where('category', '==', category),
      where('status', '==', 'open'),
      orderBy('createdAt', 'desc'),
      limit(maxResults)
    );
    const snapshot = await withOfflineRetry(() => getDocs(q));
    return snapshot.docs.map(mapDocToCampusItem);
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

export async function saveItemToFirestore(item: CampusItem, user?: User | null): Promise<string> {
  if (!auth.currentUser) throw new Error('You must be signed in with a verified Nile account to report an item.');

  const uid = auth.currentUser.uid;
  const email = normalizeNileEmail(auth.currentUser.email || 'student@nileuniversity.edu.ng');
  const name = resolveDisplayName(auth.currentUser.displayName, email);
  const isStudentId = item.category === 'student_id';
  const resolvedHoldingLocation = isStudentId && item.type === 'found' ? 'security_main_gate' : item.holdingLocation;
  const isDeskFound = item.type === 'found' && resolvedHoldingLocation !== 'finder_holding';
  const isPrivilegedOfficer = canUserModerate(user);
  const resolvedCustodyStatus: CampusItem['custodyStatus'] =
    isDeskFound && !isPrivilegedOfficer ? 'awaiting_dropoff' : 'confirmed';

  const itemRef = doc(collection(db, ITEMS));
  const payload: Record<string, unknown> = {
    title: item.title.trim().slice(0, 100),
    type: item.type,
    category: item.category,
    description: item.description.trim().slice(0, 1000),
    location: normalizeCustomLocation(item.location),
    dateLostOrFound: item.dateLostOrFound.slice(0, 40),
    status: 'open',
    holdingLocation: resolvedHoldingLocation,
    custodyStatus: resolvedCustodyStatus,
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

export async function confirmItemCustodyInFirestore(itemId: string): Promise<void> {
  try {
    assertFirestoreReady();
    await updateDoc(doc(db, ITEMS, itemId), { custodyStatus: 'confirmed', updatedAt: serverTimestamp() });
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
    const [totalSnap, foundSnap, foundRetSnap, totalRetSnap, custodySnap, awaitingCustodySnap, pendingSnap] = await withOfflineRetry(() =>
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
        getCountFromServer(
          query(
            collection(db, ITEMS),
            where('type', '==', 'found'),
            where('custodyStatus', '==', 'awaiting_dropoff')
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
      awaitingCustodyCount: awaitingCustodySnap.data().count,
      pendingClaimsCount: pendingSnap.data().count,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, ITEMS);
  }
}

async function fetchAllPaginatedDocs(baseQuery: Query<DocumentData>): Promise<QueryDocumentSnapshot<DocumentData>[]> {
  const docs: QueryDocumentSnapshot<DocumentData>[] = [];
  let cursor: QueryDocumentSnapshot<DocumentData> | undefined;
  while (true) {
    const snap = await getDocs(
      cursor ? query(baseQuery, startAfter(cursor), limit(50)) : query(baseQuery, limit(50))
    );
    if (snap.empty) break;
    docs.push(...snap.docs);
    if (snap.docs.length < 50) break;
    cursor = snap.docs[snap.docs.length - 1];
  }
  return docs;
}

export async function deleteItemFromFirestore(itemId: string): Promise<void> {
  try {
    assertFirestoreReady();
    const uid = auth.currentUser?.uid;
    const isAdminUser = Boolean(
      uid && (isMasterAdminUser(uid) || (await isConfiguredAdmin(uid)) || (await fetchUserRole(uid)) === 'admin')
    );

    const [privateClaimsDocs, claimsDocs] = await Promise.all([
      fetchAllPaginatedDocs(query(collection(db, ITEMS, itemId, 'privateClaims'))),
      fetchAllPaginatedDocs(query(collection(db, CLAIMS), where('itemId', '==', itemId))),
    ]);

    const messageDocsPerClaim = await Promise.all(
      claimsDocs.map((claimDoc) =>
        fetchAllPaginatedDocs(query(collection(db, CLAIMS, claimDoc.id, 'messages')))
      )
    );

    const messageRefsToDelete = messageDocsPerClaim.flatMap((docs) =>
      docs
        .filter((d) => isAdminUser || (uid && d.data().senderId === uid))
        .map((d) => d.ref)
    );

    const refsToDelete = [
      ...messageRefsToDelete,
      doc(db, ITEMS, itemId, 'media', 'full'),
      doc(db, ITEMS, itemId, 'private', 'details'),
      doc(db, ITEMS, itemId, 'secrets', 'verification'),
      ...privateClaimsDocs.map((d) => d.ref),
      ...claimsDocs.map((d) => d.ref),
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
