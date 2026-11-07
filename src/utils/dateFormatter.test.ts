/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Unit tests for dateFormatter utilities
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { formatDateDDMMYYYY, formatRelativeTime } from './dateFormatter.ts';

test('formatDateDDMMYYYY formats ISO strings to DD/MM/YYYY', () => {
  assert.equal(formatDateDDMMYYYY('2026-10-23T14:30:00.000Z'), '23/10/2026');
  assert.equal(formatDateDDMMYYYY('2026-05-04'), '04/05/2026');
});

test('formatRelativeTime returns accurate human-readable intervals', () => {
  const now = Date.now();
  
  // Just now (< 45s)
  assert.equal(formatRelativeTime(new Date(now - 10 * 1000).toISOString()), 'Just now');

  // Minutes ago
  assert.equal(formatRelativeTime(new Date(now - 5 * 60 * 1000).toISOString()), '5 min ago');
  assert.equal(formatRelativeTime(new Date(now - 45 * 60 * 1000).toISOString()), '45 min ago');

  // Hours ago
  assert.equal(formatRelativeTime(new Date(now - 2 * 60 * 60 * 1000).toISOString()), '2 hr ago');

  // Yesterday
  assert.equal(formatRelativeTime(new Date(now - 26 * 60 * 60 * 1000).toISOString()), 'Yesterday');

  // Days ago
  assert.equal(formatRelativeTime(new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString()), '3 days ago');
});
