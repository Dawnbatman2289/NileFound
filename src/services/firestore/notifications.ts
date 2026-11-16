/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Firestore realtime notification subscriptions and read-state writes.
 */

import {
  collection, doc, addDoc, setDoc, updateDoc, onSnapshot, query, where, orderBy, limit,
  writeBatch, serverTimestamp, Unsubscribe,
} from 'firebase/firestore';
import { db, auth } from '../../lib/firebase.ts';
import { User, CampusNotification } from '../../types/index.ts';
import { canUserModerate } from '../../utils/admin.ts';
import { reportError } from '../../components/ErrorBoundary.tsx';
import { NOTIFICATIONS, NOTIF_TEMPLATES, toIsoString } from './helpers.ts';

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
            type: (d.type || 'match_alert') as CampusNotification['type'],
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
  id?: string;
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
    if (notification.id && /^[a-zA-Z0-9_-]{1,128}$/.test(notification.id)) {
      await setDoc(doc(db, NOTIFICATIONS, notification.id), payload);
      return notification.id;
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
