/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Firestore handover chat subscription, pagination, and message creation.
 */

import {
  collection, addDoc, getDocs, onSnapshot, query, orderBy, limit, startAfter,
  serverTimestamp, QueryDocumentSnapshot, DocumentData, Unsubscribe,
} from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../../lib/firebase.ts';
import { ClaimMessage, ChatSenderRole } from '../../types/index.ts';
import { reportError } from '../../components/ErrorBoundary.tsx';
import {
  CLAIMS, ClaimMessagesPage, assertFirestoreReady, toIsoString, withOfflineRetry,
} from './helpers.ts';

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
