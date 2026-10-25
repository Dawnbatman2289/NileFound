/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { canUserModerate, expireOldItems, generateCampusAuditReport } from './admin.ts';
import { User, CampusItem, ClaimRecord } from '../types/index.ts';

test('canUserModerate allows admin and security but blocks standard students', () => {
  const studentUser: User = {
    id: 'u1',
    name: 'Chidera Eze',
    email: 'chidera@nileuniversity.edu.ng',
    role: 'student'
  };
  const adminUser: User = {
    id: 'u2',
    name: 'Campus Administrator',
    email: 'admin@nileuniversity.edu.ng',
    role: 'admin',
    isAdmin: true
  };
  const securityUser: User = {
    id: 'u3',
    name: 'Officer Musa',
    email: 'security.gate@nileuniversity.edu.ng',
    role: 'security'
  };

  assert.equal(canUserModerate(studentUser), false);
  assert.equal(canUserModerate(adminUser), true);
  assert.equal(canUserModerate(securityUser), true);
  assert.equal(canUserModerate(null), false);
});

test('expireOldItems marks posts older than threshold as expired', () => {
  const now = new Date('2026-10-24T12:00:00Z');
  const items: CampusItem[] = [
    {
      id: 'recent',
      type: 'found',
      title: 'Oraimo Charger',
      category: 'phone_tech',
      description: 'Found yesterday',
      location: 'Block C',
      dateLostOrFound: '2026-10-23',
      status: 'open',
      holdingLocation: 'finder_holding',
      createdAt: '2026-10-23T10:00:00Z'
    },
    {
      id: 'old-item',
      type: 'found',
      title: 'Old Notebook',
      category: 'books_notes',
      description: 'Found 70 days ago',
      location: 'Library',
      dateLostOrFound: '2026-08-01',
      status: 'open',
      holdingLocation: 'security_main_gate',
      createdAt: '2026-08-01T10:00:00Z'
    }
  ];

  const updated = expireOldItems(items, 60, now);
  assert.equal(updated.find(i => i.id === 'recent')?.status, 'open');
  assert.equal(updated.find(i => i.id === 'old-item')?.status, 'expired');
});

test('generateCampusAuditReport computes metrics accurately', () => {
  const items: CampusItem[] = [
    {
      id: '1',
      type: 'found',
      title: 'ID Card',
      category: 'student_id',
      description: 'Found at gate',
      location: 'Main Gate',
      dateLostOrFound: '2026-10-20',
      status: 'returned',
      holdingLocation: 'security_main_gate',
      createdAt: '2026-10-20T10:00:00Z'
    },
    {
      id: '2',
      type: 'found',
      title: 'Keys',
      category: 'keys',
      description: 'Hostel keys',
      location: 'Hostel A',
      dateLostOrFound: '2026-10-22',
      status: 'open',
      holdingLocation: 'security_main_gate',
      createdAt: '2026-10-22T10:00:00Z'
    }
  ];

  const claims: ClaimRecord[] = [
    {
      id: 'c1',
      itemId: '2',
      itemTitle: 'Keys',
      claimantName: 'Tunde',
      claimantEmail: 'tunde@nileuniversity.edu.ng',
      submittedAnswer: 'Room 12B',
      status: 'pending',
      createdAt: '2026-10-23T10:00:00Z'
    }
  ];

  const report = generateCampusAuditReport(items, claims);
  assert.equal(report.totalItems, 2);
  assert.equal(report.totalFound, 2);
  assert.equal(report.totalReturned, 1);
  assert.equal(report.heldAtGate, 1);
  assert.equal(report.returnRate, 50);
  assert.equal(report.pendingClaims, 1);
});
