/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Unit tests for Campus Notification & Admin Email Dispatch Service
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { 
  PROJECT_OWNER_CONTACT,
  getInitialCampusNotifications, 
  createAdminEmailDispatch 
} from '../services/notificationService.ts';
import type { CampusNotification } from '../types/index.ts';

test('project-owner dispatch uses a safe placeholder contact', () => {
  assert.equal(PROJECT_OWNER_CONTACT, 'owner@example.com');
});

test('getInitialCampusNotifications is empty and contains no seeded data', () => {
  const notifs = getInitialCampusNotifications();
  assert.ok(Array.isArray(notifs));
  assert.equal(notifs.length, 0);
});

test('createAdminEmailDispatch creates an email record targeted to the placeholder owner contact', () => {
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
    type: 'admin_review',
    title: 'Test Lost Item: Casio fx-991EX',
    message: 'Lost in Ubangi House Room 204.',
    createdAt: new Date().toISOString(),
    read: false,
    itemId: 'item-1',
    itemTitle: 'Casio fx-991EX',
  };

  const dispatch = createAdminEmailDispatch(sampleNotif);
  assert.equal(dispatch.recipient, 'owner@example.com');
  assert.ok(dispatch.subject.includes('NileFound Alert'));
  assert.ok(dispatch.bodyText.includes('Ayomide'));
  assert.ok(dispatch.bodyText.includes('Casio fx-991EX'));
});
