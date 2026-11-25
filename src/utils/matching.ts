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
import { CAMPUS_CLUSTERS } from '../config/catalog.ts';

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
  const normA = locA.trim().replace(/\s+/g, ' ').toLowerCase();
  const normB = locB.trim().replace(/\s+/g, ' ').toLowerCase();

  if (!normA || !normB) return 0.0;
  if (normA === normB) return 1.0;

  // Free-text places are allowed, so a short word ("hall", "gate") must not match every
  // cluster entry that happens to contain it. A typed place matches a cluster entry when:
  // - it is exactly that entry, or
  // - it contains the whole entry ("behind block a" contains "block a"), or
  // - it is a long enough part of a longer entry ("ubangi house" in "ubangi house (stem labs)").
  const MIN_PARTIAL_MATCH_LENGTH = 8;
  const clusterContains = (normCluster: string[], norm: string): boolean =>
    normCluster.some(
      (c) => c === norm || norm.includes(c) || (norm.length >= MIN_PARTIAL_MATCH_LENGTH && c.includes(norm))
    );

  for (const clusterLocations of Object.values(CAMPUS_CLUSTERS)) {
    const normCluster = clusterLocations.map(l => l.toLowerCase());
    if (clusterContains(normCluster, normA) && clusterContains(normCluster, normB)) return 0.5;
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
    reasons.push('Possible duplicate: high correlation across location, category and timeframe');
  }

  return {
    score: normalizedPercentage,
    reasons,
    isLikelyMatch
  };
}

export const MATCH_LOOKBACK_DAYS = 30;

/**
 * Restricts fuzzy matching scope to items logged within the past 30 days
 * to prevent main-thread UI lag on low-power devices.
 */
export function isWithinMatchingWindow(
  item: CampusItem,
  nowMs = Date.now(),
  lookbackDays = MATCH_LOOKBACK_DAYS
): boolean {
  const timestamp = new Date(item.createdAt || item.dateLostOrFound).getTime();
  if (Number.isNaN(timestamp)) return false;
  const maxAgeMs = lookbackDays * 24 * 60 * 60 * 1000;
  return nowMs - timestamp <= maxAgeMs;
}

export interface RankedItemMatch {
  item: CampusItem;
  result: MatchScoreResult;
}

export function findMatchingItems(
  targetItem: CampusItem,
  candidates: CampusItem[],
  options: { nowMs?: number; limit?: number } = {}
): RankedItemMatch[] {
  const nowMs = options.nowMs ?? Date.now();
  const maxResults = options.limit ?? 3;
  const oppositeType = targetItem.type === 'found' ? 'lost' : 'found';

  return candidates
    .filter(
      (candidate) =>
        candidate.id !== targetItem.id &&
        candidate.type === oppositeType &&
        candidate.status === 'open' &&
        isWithinMatchingWindow(candidate, nowMs, MATCH_LOOKBACK_DAYS)
    )
    .map((candidate) => ({
      item: candidate,
      result: calculateMatchScore(
        targetItem.type === 'lost' ? targetItem : candidate,
        targetItem.type === 'found' ? targetItem : candidate
      ),
    }))
    .filter(({ result }) => result.isLikelyMatch)
    .sort((a, b) => b.result.score - a.result.score)
    .slice(0, maxResults);
}

