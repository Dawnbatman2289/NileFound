/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * NileFound Admin and Access Control Logic
 * Pure functions for role-based moderation, status lifecycles, and audit reporting.
 */

import { User, CampusItem, ClaimRecord } from '../types/index.ts';

/**
 * Checks whether a user has administrative or security officer moderation rights.
 */
export function canUserModerate(user: User | null): boolean {
  if (!user) return false;
  return user.role === 'admin' || user.role === 'security' || user.isAdmin === true;
}

/**
 * Flags items that have been inactive or past the expiry window (e.g., 60 days).
 */
export function expireOldItems(items: CampusItem[], daysThreshold = 60, referenceDate = new Date()): CampusItem[] {
  const refTime = referenceDate.getTime();
  const thresholdMs = daysThreshold * 24 * 60 * 60 * 1000;

  return items.map((item) => {
    if (item.status === 'returned' || item.status === 'verified' || item.status === 'claim_requested' || item.status === 'expired') {
      return item;
    }
    const itemTime = new Date(item.createdAt).getTime();
    if (!isNaN(itemTime) && (refTime - itemTime) > thresholdMs) {
      return { ...item, status: 'expired' };
    }
    return item;
  });
}

/**
 * Aggregates statistics for the Student Affairs & Security audit log.
 */
export function generateCampusAuditReport(items: CampusItem[], claims: ClaimRecord[]) {
  const totalFound = items.filter(i => i.type === 'found').length;
  const totalLost = items.filter(i => i.type === 'lost').length;
  const totalReturned = items.filter(i => i.status === 'returned').length;
  const foundReturned = items.filter(i => i.type === 'found' && i.status === 'returned').length;
  const heldAtGate = items.filter(i => i.holdingLocation === 'security_main_gate' && i.status !== 'returned').length;
  const heldAtStudentAffairs = items.filter(i => i.holdingLocation === 'student_affairs_office' && i.status !== 'returned').length;

  const returnRate = totalFound > 0 ? Math.min(100, Math.round((foundReturned / totalFound) * 100)) : 0;
  const pendingClaims = claims.filter(c => c.status === 'pending').length;

  return {
    totalItems: items.length,
    totalFound,
    totalLost,
    totalReturned,
    heldAtGate,
    heldAtStudentAffairs,
    returnRate,
    pendingClaims
  };
}
