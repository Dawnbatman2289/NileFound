/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Unit tests for Campus Notification & Admin Email Dispatch Service
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CAMPUS_OPERATIONS_CONTACT,
  getInitialCampusNotifications,
  createAdminEmailDispatch,
} from '../services/notificationService.ts';
import type { CampusNotification } from '../types/index.ts';

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
    recipientUid: 'admin',
    fromUid: 'test-user',
    type: 'admin_review',
    title: 'Test Lost Item: Casio fx-991EX',
    message: 'Lost in Ubangi House Room 204.',
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
