/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Unit tests for Campus Notification Service and duplicate-echo suppression.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CAMPUS_OPERATIONS_CONTACT,
  getInitialCampusNotifications,
  createAdminEmailDispatch,
} from '../services/notificationService.ts';
import type { CampusNotification } from '../types/index.ts';

function createNotifId(payload: Pick<CampusNotification, 'type' | 'claimId' | 'recipientUid'>): string {
  if (payload.type === 'chat_message' && payload.claimId) {
    return `chat_${payload.claimId}_${payload.recipientUid}`;
  }
  return `notif_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function shouldAlertIncoming(
  prevIds: Set<string>,
  newest: CampusNotification | undefined,
  currentUserId?: string | null
): boolean {
  if (!newest || newest.read) return false;
  if (prevIds.has(newest.id)) return false;
  if (currentUserId && newest.fromUid === currentUserId) return false;
  return true;
}

test('operations dispatch defaults to the campus operations contact', () => {
  assert.equal(CAMPUS_OPERATIONS_CONTACT, 'studentaffairs@nileuniversity.edu.ng');
});

test('getInitialCampusNotifications is empty and contains no seeded data', () => {
  const notifs = getInitialCampusNotifications();
  assert.ok(Array.isArray(notifs));
  assert.equal(notifs.length, 0);
});

test('createAdminEmailDispatch targets the configured recipient without hardcoded placeholders', () => {
  if (typeof window === 'undefined') {
    (globalThis as unknown as { window: Record<string, unknown> }).window = {
      open: () => {},
      localStorage: {
        getItem: () => null,
        setItem: () => {},
      },
    };
  } else if (!window.open) {
    window.open = () => null;
  }

  const sampleNotif: CampusNotification = {
    id: 'test-notif-1',
    recipientUid: 'student-123',
    fromUid: 'finder-456',
    type: 'claim_received',
    title: 'New claim on your item',
    message: 'A new ownership claim was filed for your item.',
    createdAt: new Date().toISOString(),
    read: false,
    itemId: 'item-1',
    itemTitle: 'Casio fx-991EX',
  };

  const dispatch = createAdminEmailDispatch(sampleNotif);
  assert.equal(dispatch.recipient, 'studentaffairs@nileuniversity.edu.ng');
  assert.ok(dispatch.subject.includes('NileFound Alert'));
  assert.ok(dispatch.bodyText.includes('Campus Operations Team'));
  assert.ok(dispatch.bodyText.includes('Casio fx-991EX'));
});

test('sender never triggers duplicate notification chimes or toasts on Firestore echo', () => {
  const id = createNotifId({ type: 'match_alert', recipientUid: 'uid-1' });
  assert.match(id, /^[a-zA-Z0-9_-]+$/);

  const prevIds = new Set([id]);
  const echoedNotif: CampusNotification = {
    id,
    recipientUid: 'uid-1',
    fromUid: 'uid-1',
    type: 'match_alert',
    title: 'Possible item match',
    message: 'A possible match was found for your report.',
    read: false,
    createdAt: new Date().toISOString(),
  };

  assert.equal(shouldAlertIncoming(prevIds, echoedNotif, 'uid-1'), false);
  assert.equal(shouldAlertIncoming(new Set(), echoedNotif, 'uid-1'), false);

  const incomingFromPeer: CampusNotification = {
    id: 'notif_peer_1',
    recipientUid: 'uid-1',
    fromUid: 'uid-2',
    type: 'claim_received',
    title: 'New claim on your item',
    message: 'A new ownership claim was filed for your item.',
    read: false,
    createdAt: new Date().toISOString(),
  };
  assert.equal(shouldAlertIncoming(new Set(), incomingFromPeer, 'uid-1'), true);
});
