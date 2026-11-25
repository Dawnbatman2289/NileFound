/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Firestore claim lifecycle queries, private verification loading, and atomic decisions.
 */

import {
  collection, doc, getDoc, getDocs, onSnapshot, query, where, orderBy, limit, startAfter,
  runTransaction, serverTimestamp, QueryDocumentSnapshot, DocumentData, Unsubscribe,
} from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../../lib/firebase.ts';
import { ClaimRecord, User } from '../../types/index.ts';
import { canUserModerate } from '../../utils/admin.ts';
import { normalizeNileEmail, resolveDisplayName } from '../../utils/authValidation.ts';
import {
  ClaimDecisionBatchPlan,
  computeClaimDecisionBatchPlan,
  decideClaimWithFreshPending,
} from '../../utils/claimDecision.ts';
import { reportError } from '../../components/ErrorBoundary.tsx';
import {
  ITEMS, CLAIMS, CLAIMS_PAGE_SIZE, ClaimPrivateDetails, ClaimsCursor, ClaimsPage,
  assertFirestoreReady, mapDocToClaimRecord, withOfflineRetry,
} from './helpers.ts';

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

    const byId = new Map<string, ClaimRecord>();
    [...cDocs, ...fDocs].forEach((d) => byId.set(d.id, mapDocToClaimRecord(d)));
    const sorted = [...byId.values()].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return {
      claims: sorted,
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
  const email = normalizeNileEmail(auth.currentUser.email || claim.claimantEmail).slice(0, 100);
  const name = resolveDisplayName(auth.currentUser.displayName || claim.claimantName, email);
  const claimId = `${claim.itemId}_${uid}`;

  try {
    assertFirestoreReady();
    return await runTransaction(db, async (tx) => {
      const itemRef = doc(db, ITEMS, claim.itemId);
      const claimRef = doc(db, CLAIMS, claimId);
      const privateClaimRef = doc(db, ITEMS, claim.itemId, 'privateClaims', claimId);

      const [itemSnap, existingClaimSnap] = await Promise.all([
        tx.get(itemRef),
        tx.get(claimRef),
      ]);

      if (!itemSnap.exists()) {
        throw new Error('The item you tried to claim could not be found.');
      }
      if (existingClaimSnap.exists()) {
        throw new Error('You already have a claim recorded for this item.');
      }

      const itemData = itemSnap.data();
      if (itemData.type !== 'found') {
        throw new Error('Only found items can be claimed.');
      }
      if (itemData.authorId === uid) {
        throw new Error('You cannot submit a claim on your own item report.');
      }
      if (itemData.custodyStatus === 'awaiting_dropoff') {
        throw new Error('Claims are paused until campus desk staff confirm physical drop-off.');
      }
      if (itemData.status !== 'open' && itemData.status !== 'claim_requested') {
        throw new Error('This item is no longer open for new claims.');
      }
      const resolvedFinderId = finderId || itemData.authorId;
      if (!resolvedFinderId || resolvedFinderId !== itemData.authorId) {
        throw new Error('Could not verify the item reporter for this claim.');
      }

      const isFoundStudentId = itemData.type === 'found' && itemData.category === 'student_id';
      const safeItemTitle = isFoundStudentId ? 'A student ID card was found' : claim.itemTitle;

      tx.set(claimRef, {
        itemId: claim.itemId,
        itemTitle: safeItemTitle.slice(0, 100),
        claimantId: uid,
        finderId: resolvedFinderId,
        status: 'pending',
        resubmitted: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      tx.set(privateClaimRef, {
        itemId: claim.itemId,
        claimId,
        claimantId: uid,
        claimantName: name.slice(0, 100),
        claimantEmail: email.slice(0, 100),
        submittedAnswer: claim.submittedAnswer.slice(0, 500),
        createdAt: serverTimestamp(),
      });
      tx.update(itemRef, {
        status: 'claim_requested',
        updatedAt: serverTimestamp(),
      });
      return claimId;
    });
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
  const uid = auth.currentUser.uid;
  const cleanAnswer = updatedAnswer.trim().slice(0, 500);

  try {
    assertFirestoreReady();
    await runTransaction(db, async (tx) => {
      const itemRef = doc(db, ITEMS, itemId);
      const claimRef = doc(db, CLAIMS, claimId);
      const privateClaimRef = doc(db, ITEMS, itemId, 'privateClaims', claimId);

      const [itemSnap, claimSnap, privateClaimSnap] = await Promise.all([
        tx.get(itemRef),
        tx.get(claimRef),
        tx.get(privateClaimRef),
      ]);

      if (!itemSnap.exists() || !claimSnap.exists() || !privateClaimSnap.exists()) {
        throw new Error('The claim or item record no longer exists.');
      }

      const itemData = itemSnap.data();
      const claimData = claimSnap.data();
      if (claimData.claimantId !== uid) {
        throw new Error('You can only resubmit your own claim.');
      }
      if (claimData.status !== 'rejected' || claimData.resubmitted === true) {
        throw new Error('You have already used your one claim resubmission for this item.');
      }
      if (itemData.type !== 'found' || (itemData.status !== 'open' && itemData.status !== 'claim_requested')) {
        throw new Error('This item is no longer open for claim resubmission.');
      }
      if (itemData.custodyStatus === 'awaiting_dropoff') {
        throw new Error('Claims are paused until campus desk staff confirm physical drop-off.');
      }

      tx.update(claimRef, {
        status: 'pending',
        resubmitted: true,
        updatedAt: serverTimestamp(),
      });
      tx.update(privateClaimRef, {
        submittedAnswer: cleanAnswer,
        updatedAt: serverTimestamp(),
      });
      tx.update(itemRef, {
        status: 'claim_requested',
        updatedAt: serverTimestamp(),
      });
    });
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
    assertFirestoreReady();
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
      commitDecisionBatch: async (candidatePlan) => {
        const candidateIds = Array.from(new Set([claimId, ...candidatePlan.autoRejectedIds]));
        return await runTransaction(db, async (tx) => {
          const itemRef = doc(db, ITEMS, itemId);
          const targetClaimRef = doc(db, CLAIMS, claimId);
          const siblingIds = candidateIds.filter((id) => id !== claimId);

          const [itemSnap, targetClaimSnap, ...siblingSnaps] = await Promise.all([
            tx.get(itemRef),
            tx.get(targetClaimRef),
            ...siblingIds.map((id) => tx.get(doc(db, CLAIMS, id))),
          ]);

          if (!itemSnap.exists() || !targetClaimSnap.exists()) {
            throw new Error('Item or claim record no longer exists.');
          }
          if (itemSnap.data().status === 'returned') {
            throw new Error('This item has already been returned.');
          }
          if (targetClaimSnap.data().status !== 'pending') {
            throw new Error('This claim has already been processed.');
          }

          const confirmedPendingIds = [
            claimId,
            ...siblingSnaps
              .filter((snap) => snap.exists() && snap.data().status === 'pending')
              .map((snap) => snap.id),
          ];
          const txPlan = computeClaimDecisionBatchPlan(claimId, status, confirmedPendingIds);

          tx.update(targetClaimRef, { status, updatedAt: serverTimestamp() });
          if (status === 'approved') {
            tx.update(itemRef, { status: 'verified', updatedAt: serverTimestamp() });
            txPlan.autoRejectedIds.forEach((otherId) => {
              tx.update(doc(db, CLAIMS, otherId), { status: 'rejected', updatedAt: serverTimestamp() });
            });
          } else if (txPlan.nextItemStatus === 'open') {
            tx.update(itemRef, { status: 'open', updatedAt: serverTimestamp() });
          }
          return txPlan;
        });
      },
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${CLAIMS}/${claimId}`);
  }
}
