import React, { useState, useEffect, useCallback } from 'react';
import { CampusItem, ClaimRecord, User } from '../types/index.ts';
import { safeSetStorage } from '../utils/storage.ts';
import { reportError } from '../components/ErrorBoundary.tsx';
import { auth } from '../lib/firebase.ts';
import {
  subscribeToRealtimeClaims,
  fetchMoreClaimsPage,
  ClaimsCursor,
  fetchClaimPrivateDetails,
  saveClaimToFirestore,
  updateClaimStatusInFirestore,
} from '../services/firestoreService.ts';
import type { DispatchNotificationFn } from './useNotifications.ts';

interface UseClaimsOptions {
  isDemoMode: boolean;
  currentUser: User | null;
  items: CampusItem[];
  setItems: React.Dispatch<React.SetStateAction<CampusItem[]>>;
  setOlderItems: React.Dispatch<React.SetStateAction<CampusItem[]>>;
  dispatchNotification: DispatchNotificationFn;
}

export function useClaims({
  isDemoMode,
  currentUser,
  items,
  setItems,
  setOlderItems,
  dispatchNotification,
}: UseClaimsOptions) {
  const [claims, setClaims] = useState<ClaimRecord[]>([]);
  const [claimsCursor, setClaimsCursor] = useState<ClaimsCursor | undefined>(undefined);
  const [hasMoreClaims, setHasMoreClaims] = useState(false);
  const [isLoadingMoreClaims, setIsLoadingMoreClaims] = useState(false);
  const [claimsError, setClaimsError] = useState<string | null>(null);
  const [claimsRetryNonce, setClaimsRetryNonce] = useState(0);

  useEffect(() => {
    if (!import.meta.env.DEV || !isDemoMode) return;
    safeSetStorage('nilefound_demo_claims_v1', JSON.stringify(claims));
  }, [claims, isDemoMode]);

  useEffect(() => {
    if (isDemoMode || !currentUser || !auth.currentUser?.emailVerified) return;
    setClaimsError(null);
    return subscribeToRealtimeClaims(
      currentUser,
      (liveClaims, moreClaims, nextCursor) => {
        setClaims((prev) => {
          const prevPrivate = new Map(prev.filter((c) => c.privateLoaded).map((c) => [c.id, c]));
          return liveClaims.map((c) => {
            const hydrated = prevPrivate.get(c.id);
            return hydrated
              ? {
                  ...c,
                  claimantName: hydrated.claimantName,
                  claimantEmail: hydrated.claimantEmail,
                  submittedAnswer: hydrated.submittedAnswer,
                  privateLoaded: true,
                }
              : c;
          });
        });
        setHasMoreClaims(moreClaims);
        setClaimsCursor(nextCursor);
        setClaimsError(null);
      },
      (err) => {
        reportError('subscribeToRealtimeClaims failed', err);
        setClaimsError('Could not load claims. Check your connection and try again.');
      }
    );
  }, [isDemoMode, currentUser, claimsRetryNonce]);

  const handleLoadMoreClaims = useCallback(async () => {
    if (isDemoMode || isLoadingMoreClaims || !hasMoreClaims || !claimsCursor) return;
    setIsLoadingMoreClaims(true);
    setClaimsError(null);
    try {
      const page = await fetchMoreClaimsPage(currentUser, claimsCursor);
      setClaims((prev) => {
        const seen = new Set(prev.map((c) => c.id));
        return [...prev, ...page.claims.filter((c) => !seen.has(c.id))];
      });
      setHasMoreClaims(page.hasMore);
      setClaimsCursor(page.cursor);
    } catch (err: unknown) {
      reportError('handleLoadMoreClaims failed', err);
      setClaimsError(err instanceof Error ? err.message : 'Could not load more claims.');
    } finally {
      setIsLoadingMoreClaims(false);
    }
  }, [isDemoMode, isLoadingMoreClaims, hasMoreClaims, claimsCursor, currentUser]);

  const handleFetchClaimPrivateDetails = useCallback(async (itemId: string, claimId: string) => {
    const priv = await fetchClaimPrivateDetails(itemId, claimId);
    setClaims((prev) =>
      prev.map((c) =>
        c.id === claimId
          ? {
              ...c,
              claimantName: priv.claimantName,
              claimantEmail: priv.claimantEmail,
              submittedAnswer: priv.submittedAnswer,
              privateLoaded: true,
            }
          : c
      )
    );
  }, []);

  const handleClaimSuccess = useCallback(
    async (newClaim: ClaimRecord) => {
      const fromUid = auth.currentUser?.uid || currentUser?.id || 'claimant';
      const matchingItem = items.find((i) => i.id === newClaim.itemId);
      let finalClaimId = newClaim.id;
      if (isDemoMode) {
        setClaims((prev) => [{ ...newClaim, claimantId: fromUid }, ...prev]);
        setItems((prev) =>
          prev.map((it) => (it.id === newClaim.itemId ? { ...it, status: 'claim_requested' } : it))
        );
      } else {
        finalClaimId = await saveClaimToFirestore(newClaim, currentUser, matchingItem?.authorId);
        setItems((prev) =>
          prev.map((it) => (it.id === newClaim.itemId ? { ...it, status: 'claim_requested' } : it))
        );
      }

      if (matchingItem?.authorId && matchingItem.authorId !== fromUid) {
        dispatchNotification({
          recipientUid: matchingItem.authorId,
          fromUid,
          type: 'claim_received',
          title: `New claim on ${matchingItem.title}`,
          message: 'A new ownership claim was filed for your found item. Review it on the card.',
          itemId: matchingItem.id,
          claimId: finalClaimId,
        });
      }
      dispatchNotification(
        {
          recipientUid: 'admin',
          fromUid,
          type: 'admin_review',
          title: `Claim needs review: ${matchingItem?.title || 'Campus Item'}`,
          message: `An ownership claim was filed for "${matchingItem?.title || 'item'}".`,
          itemId: newClaim.itemId,
          claimId: finalClaimId,
        },
        { toast: true }
      );
    },
    [isDemoMode, currentUser, items, setItems, dispatchNotification]
  );

  const handleApproveClaim = useCallback(
    async (claimId: string, itemId: string): Promise<boolean> => {
      try {
        const fromUid = auth.currentUser?.uid || currentUser?.id || 'admin';
        const claim = claims.find((c) => c.id === claimId);
        const otherPendingIds = claims
          .filter((c) => c.itemId === itemId && c.id !== claimId && c.status === 'pending')
          .map((c) => c.id);
        if (!isDemoMode) {
          await updateClaimStatusInFirestore(claimId, itemId, 'approved', otherPendingIds);
        }
        const rejectedSet = new Set(otherPendingIds);
        setClaims((prev) =>
          prev.map((c) =>
            c.id === claimId
              ? { ...c, status: 'approved' }
              : rejectedSet.has(c.id)
                ? { ...c, status: 'rejected' }
                : c
          )
        );
        setItems((prev) => prev.map((it) => (it.id === itemId ? { ...it, status: 'verified' } : it)));
        setOlderItems((prev) => prev.map((it) => (it.id === itemId ? { ...it, status: 'verified' } : it)));

        if (claim?.claimantId) {
          dispatchNotification({
            recipientUid: claim.claimantId,
            fromUid,
            type: 'claim_approved',
            title: `Claim approved: ${claim.itemTitle}`,
            message: `Your claim for "${claim.itemTitle}" was approved. Arrange collection from the custodian or security post.`,
            itemId: claim.itemId,
            claimId: claim.id,
          });
        }
        return true;
      } catch {
        return false;
      }
    },
    [isDemoMode, currentUser, claims, setItems, setOlderItems, dispatchNotification]
  );

  const handleRejectClaim = useCallback(
    async (claimId: string): Promise<boolean> => {
      try {
        const fromUid = auth.currentUser?.uid || currentUser?.id || 'admin';
        const claim = claims.find((c) => c.id === claimId);
        if (!claim) return false;
        const otherPendingIds = claims
          .filter((c) => c.itemId === claim.itemId && c.id !== claimId && c.status === 'pending')
          .map((c) => c.id);

        let nextItemStatus: CampusItem['status'] =
          otherPendingIds.length === 0 ? 'open' : 'claim_requested';
        if (!isDemoMode) {
          nextItemStatus = await updateClaimStatusInFirestore(
            claimId,
            claim.itemId,
            'rejected',
            otherPendingIds
          );
        }
        setClaims((prev) => prev.map((c) => (c.id === claimId ? { ...c, status: 'rejected' } : c)));
        setItems((prev) =>
          prev.map((it) => (it.id === claim.itemId ? { ...it, status: nextItemStatus } : it))
        );
        setOlderItems((prev) =>
          prev.map((it) => (it.id === claim.itemId ? { ...it, status: nextItemStatus } : it))
        );

        if (claim.claimantId) {
          dispatchNotification({
            recipientUid: claim.claimantId,
            fromUid,
            type: 'claim_rejected',
            title: `Claim rejected: ${claim.itemTitle}`,
            message: `Your verification answer for "${claim.itemTitle}" could not be confirmed. Contact Campus Security if needed.`,
            itemId: claim.itemId,
            claimId: claim.id,
          });
        }
        return true;
      } catch {
        return false;
      }
    },
    [isDemoMode, currentUser, claims, setItems, setOlderItems, dispatchNotification]
  );

  const removeClaimsForItem = useCallback((itemId: string) => {
    setClaims((prev) => prev.filter((c) => c.itemId !== itemId));
  }, []);

  const clearClaims = useCallback(() => {
    setClaims([]);
    setClaimsCursor(undefined);
    setHasMoreClaims(false);
  }, []);

  return {
    claims,
    setClaims,
    hasMoreClaims,
    isLoadingMoreClaims,
    claimsError,
    retryClaims: () => setClaimsRetryNonce((n) => n + 1),
    handleLoadMoreClaims,
    handleFetchClaimPrivateDetails,
    handleClaimSuccess,
    handleApproveClaim,
    handleRejectClaim,
    removeClaimsForItem,
    clearClaims,
  };
}
