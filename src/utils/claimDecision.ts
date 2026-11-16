/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Pure helpers for claim approval/rejection decision plans using fresh pending claim IDs.
 */

export interface ClaimDecisionBatchPlan {
  nextItemStatus: 'verified' | 'open' | 'claim_requested';
  autoRejectedIds: string[];
}

export function computeClaimDecisionBatchPlan(
  targetClaimId: string,
  decision: 'approved' | 'rejected',
  freshPendingClaimIds: string[]
): ClaimDecisionBatchPlan {
  const otherPendingIds = freshPendingClaimIds.filter((id) => id !== targetClaimId);
  if (decision === 'approved') {
    return {
      nextItemStatus: 'verified',
      autoRejectedIds: otherPendingIds,
    };
  }
  return {
    nextItemStatus: otherPendingIds.length === 0 ? 'open' : 'claim_requested',
    autoRejectedIds: [],
  };
}

export async function decideClaimWithFreshPending(deps: {
  claimId: string;
  itemId: string;
  decision: 'approved' | 'rejected';
  queryPendingClaimIds: (itemId: string) => Promise<string[]>;
  commitDecisionBatch: (plan: ClaimDecisionBatchPlan) => Promise<ClaimDecisionBatchPlan | void>;
}): Promise<ClaimDecisionBatchPlan> {
  const freshPendingIds = await deps.queryPendingClaimIds(deps.itemId);
  const plan = computeClaimDecisionBatchPlan(deps.claimId, deps.decision, freshPendingIds);
  const committedPlan = await deps.commitDecisionBatch(plan);
  return committedPlan ?? plan;
}
