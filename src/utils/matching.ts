/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * NileFound Rule-Based Proximity Matching Algorithm
 * Implementation of the official engineering design specification:
 * 
 * S(q, d) = w_c * C(q, d) + w_l * L(q, d) + w_t * T(q, d) + w_k * K(q, d)
 * 
 * Weights:
 * w_c = 0.35 (Category match)
 * w_l = 0.30 (Campus Location / Cluster match)
 * w_t = 0.20 (Temporal Exponential Decay: e^(-lambda * delta_t), lambda = 0.2)
 * w_k = 0.15 (Jaccard token similarity over title + description: |Q ∩ D| / |Q ∪ D|)
 * 
 * Thresholds:
 * S >= 0.60 (60%) -> Suggested Match Link
 * S >= 0.85 (85%) -> Duplicate Post Flag Warning
 */

import { CampusItem, MatchScoreResult } from '../types/index.ts';
import { CAMPUS_CLUSTERS } from '../data/mockItems.ts';

/**
 * Tokenizes text into normalized lowercase words, stripping punctuation and stopwords.
 */
export function extractKeywords(text: string): string[] {
  const stopwords = new Set([
    'a', 'an', 'the', 'and', 'or', 'in', 'on', 'at', 'with', 'my', 'i', 'lost', 'found',
    'near', 'inside', 'around', 'of', 'for', 'to', 'from', 'it', 'was', 'is', 'by', 'has', 'have',
    // Domain-specific campus stopwords suggested by Ayomide
    'please', 'pls', 'contact', 'campus', 'help', 'nile', 'anyone', 'item', 'someone', 'whatsapp'
  ]);

  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopwords.has(word));
}

/**
 * Jaccard Similarity: |Q ∩ D| / |Q ∪ D|
 * K(q, d) in [0, 1]
 */
export function calculateJaccardSimilarity(textA: string, textB: string): number {
  const setA = new Set(extractKeywords(textA));
  const setB = new Set(extractKeywords(textB));

  if (setA.size === 0 && setB.size === 0) return 0;

  let intersectionCount = 0;
  for (const item of setA) {
    if (setB.has(item)) {
      intersectionCount++;
    }
  }

  const unionCount = new Set([...setA, ...setB]).size;
  return unionCount === 0 ? 0 : intersectionCount / unionCount;
}

/**
 * Temporal Proximity Decay: T(q, d) = e^(-lambda * delta_t), lambda = 0.2
 * delta_t = |date_q - date_d| in days
 */
export function calculateTemporalDecay(dateLostStr: string, dateFoundStr: string, lambda = 0.2): number {
  const timeA = new Date(dateLostStr).getTime();
  const timeB = new Date(dateFoundStr).getTime();

  if (isNaN(timeA) || isNaN(timeB)) return 0.5;

  const deltaDays = Math.abs(timeA - timeB) / (1000 * 60 * 60 * 24);
  return Math.exp(-lambda * deltaDays);
}

/**
 * Campus Location Proximity: L(q, d)
 * 1.0 if exact location match
 * 0.5 if in the same campus cluster (e.g. STEM cluster: Ubangi, Volta, Congo)
 * 0.0 otherwise
 */
export function calculateLocationProximity(locA: string, locB: string): number {
  const normA = locA.trim().toLowerCase();
  const normB = locB.trim().toLowerCase();

  if (normA === normB && normA.length > 0) return 1.0;

  for (const clusterLocations of Object.values(CAMPUS_CLUSTERS)) {
    const normCluster = clusterLocations.map(l => l.toLowerCase());
    const matchA = normCluster.some(c => normA.includes(c) || c.includes(normA));
    const matchB = normCluster.some(c => normB.includes(c) || c.includes(normB));
    if (matchA && matchB) return 0.5;
  }

  return 0.0;
}

/**
 * Computes overall composite proximity score S(q, d) in [0, 1] (0 - 100%)
 */
export function calculateMatchScore(lostItem: CampusItem, foundItem: CampusItem): MatchScoreResult {
  const reasons: string[] = [];

  // 1. Category Match (w_c = 0.35)
  const categoryScore = lostItem.category === foundItem.category ? 1.0 : 0.0;
  if (categoryScore === 1.0) {
    reasons.push(`Matching category: ${lostItem.category.replace(/_/g, ' ')}`);
  }

  // 2. Campus Location Match (w_l = 0.30)
  const locationScore = calculateLocationProximity(lostItem.location, foundItem.location);
  if (locationScore === 1.0) {
    reasons.push(`Exact location match: ${lostItem.location}`);
  } else if (locationScore === 0.5) {
    reasons.push(`Adjacent campus cluster area`);
  }

  // 3. Temporal Decay (w_t = 0.20)
  const temporalScore = calculateTemporalDecay(lostItem.dateLostOrFound, foundItem.dateLostOrFound, 0.2);
  if (temporalScore >= 0.70) {
    reasons.push('High temporal proximity (within 1-2 days)');
  } else if (temporalScore >= 0.35) {
    reasons.push('Moderate temporal proximity (within ~5 days)');
  }

  // 4. Jaccard Keyword Similarity (w_k = 0.15)
  const fullTextLost = `${lostItem.title} ${lostItem.description}`;
  const fullTextFound = `${foundItem.title} ${foundItem.description}`;
  const jaccardScore = calculateJaccardSimilarity(fullTextLost, fullTextFound);
  if (jaccardScore >= 0.25) {
    reasons.push(`Strong textual similarity (Jaccard: ${(jaccardScore * 100).toFixed(0)}%)`);
  }

  // Composite Weighted Sum: S(q, d)
  const rawScore = (
    0.35 * categoryScore +
    0.30 * locationScore +
    0.20 * temporalScore +
    0.15 * jaccardScore
  );

  const normalizedPercentage = Math.round(Math.min(1.0, Math.max(0.0, rawScore)) * 100);
  const isLikelyMatch = normalizedPercentage >= 60; // Specification threshold: >= 0.60
  const isDuplicateCandidate = normalizedPercentage >= 85; // Edge case threshold: >= 0.85

  if (isDuplicateCandidate) {
    reasons.push('⚠️ Duplicate Candidate: Very high correlation across location, category and timeframe');
  }

  return {
    score: normalizedPercentage,
    reasons,
    isLikelyMatch
  };
}
