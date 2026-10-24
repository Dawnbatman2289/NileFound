/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { 
  extractKeywords, 
  calculateJaccardSimilarity, 
  calculateTemporalDecay, 
  calculateLocationProximity,
  calculateMatchScore 
} from './matching.ts';
import { CampusItem } from '../types/index.ts';

test('extractKeywords strips stopwords and punctuation', () => {
  const text = 'Lost my black Casio fx-991EX calculator in Ubangi House Lab 3!';
  const words = extractKeywords(text);
  assert.ok(words.includes('black'));
  assert.ok(words.includes('casio'));
  assert.ok(words.includes('calculator'));
  assert.ok(words.includes('ubangi'));
  assert.ok(!words.includes('my'));
  assert.ok(!words.includes('in'));
});

test('calculateJaccardSimilarity computes intersection over union correctly', () => {
  const textA = 'Casio scientific calculator fx-991EX black';
  const textB = 'Found scientific calculator fx-991EX';
  const score = calculateJaccardSimilarity(textA, textB);
  assert.ok(score > 0.4 && score <= 1.0, `Expected score > 0.4, got ${score}`);
});

test('calculateTemporalDecay matches e^(-lambda * delta_t)', () => {
  const sameDay = calculateTemporalDecay('2026-10-20', '2026-10-20', 0.2);
  assert.equal(sameDay, 1.0); // e^0 = 1

  const oneDay = calculateTemporalDecay('2026-10-20', '2026-10-21', 0.2);
  assert.ok(Math.abs(oneDay - Math.exp(-0.2)) < 0.001); // e^-0.2 ≈ 0.8187

  const fiveDays = calculateTemporalDecay('2026-10-20', '2026-10-25', 0.2);
  assert.ok(Math.abs(fiveDays - Math.exp(-1.0)) < 0.001); // e^-1.0 ≈ 0.3678
});

test('calculateLocationProximity recognizes exact and cluster proximity', () => {
  const exact = calculateLocationProximity(
    'Ubangi House (STEM Laboratories & Environmental Sciences)',
    'Ubangi House (STEM Laboratories & Environmental Sciences)'
  );
  assert.equal(exact, 1.0);

  const cluster = calculateLocationProximity(
    'Ubangi House (STEM Laboratories & Environmental Sciences)',
    'Volta Academic Building'
  );
  assert.equal(cluster, 0.5); // Both in STEM cluster

  const distant = calculateLocationProximity(
    'Ubangi House (STEM Laboratories & Environmental Sciences)',
    'Male Hostel Block A (Undergraduate)'
  );
  assert.equal(distant, 0.0);
});

test('calculateMatchScore meets the >= 0.60 specification threshold for Casio in Ubangi', () => {
  const lostItem: CampusItem = {
    id: 'lost-1',
    type: 'lost',
    title: 'Casio Calculator FX-991EX',
    category: 'calculator',
    description: 'Silver and black scientific calculator left after tutorial in Ubangi House',
    location: 'Ubangi House (STEM Laboratories & Environmental Sciences)',
    dateLostOrFound: '2026-10-22',
    status: 'open',
    holdingLocation: 'finder_holding',
    createdAt: '2026-10-22T10:00:00Z'
  };

  const foundItem: CampusItem = {
    id: 'found-1',
    type: 'found',
    title: 'Scientific Calculator (FX-991EX)',
    category: 'calculator',
    description: 'Found scientific calculator casing in Ubangi House near Lab 3',
    location: 'Ubangi House (STEM Laboratories & Environmental Sciences)',
    dateLostOrFound: '2026-10-22',
    status: 'open',
    holdingLocation: 'security_main_gate',
    createdAt: '2026-10-22T14:00:00Z'
  };

  const result = calculateMatchScore(lostItem, foundItem);
  assert.ok(result.score >= 80, `Expected score >= 80, got ${result.score}`);
  assert.equal(result.isLikelyMatch, true);
});
