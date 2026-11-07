/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Unit tests for Campus Notification & Admin Email Dispatch Service
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { 
  MASTER_ADMIN_EMAIL, 
  getInitialCampusNotifications, 
  createAdminEmailDispatch 
} from '../services/notificationService.ts';
import type { CampusNotification } from '../types/index.ts';

test('MASTER_ADMIN_EMAIL is set to ayomide2289@gmail.com', () => {
  assert.equal(MASTER_ADMIN_EMAIL, 'ayomide2289@gmail.com');
});

test('getInitialCampusNotifications seeds notifications with admin desk alerts', () => {
  const notifs = getInitialCampusNotifications();
  assert.ok(Array.isArray(notifs));
  assert.ok(notifs.length >= 3);

  // Check admin welcome notification specifically targeted to ayomide2289@gmail.com
  const adminNotif = notifs.find((n) => n.forAdminOnly && n.recipientEmail === 'ayomide2289@gmail.com');
  assert.ok(adminNotif, 'Should contain admin notification targeted to ayomide2289@gmail.com');
  assert.equal(adminNotif.priority, 'high');
});

test('createAdminEmailDispatch creates an email record targeted to ayomide2289@gmail.com', () => {
  // Mock window.open if running in node environment
  if (typeof window === 'undefined') {
    (globalThis as any).window = {
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
    type: 'item_reported_lost',
    title: 'Test Lost Item: Casio fx-991EX',
    message: 'Lost in Ubangi House Room 204.',
    location: 'Ubangi House',
    category: 'calculator',
    itemType: 'lost',
    forAdminOnly: true,
    priority: 'high',
    createdAt: new Date().toISOString(),
    read: false,
    reporterName: 'Chidera Okafor',
    reporterEmail: 'chidera@nileuniversity.edu.ng',
  };

  const dispatch = createAdminEmailDispatch(sampleNotif);
  assert.equal(dispatch.recipient, 'ayomide2289@gmail.com');
  assert.ok(dispatch.subject.includes('NileFound Alert'));
  assert.ok(dispatch.bodyText.includes('Ayomide'));
  assert.ok(dispatch.bodyText.includes('Ubangi House'));
  assert.ok(dispatch.bodyText.includes('Chidera Okafor'));
});
