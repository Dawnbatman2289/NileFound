/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Realtime claims subscription, pagination, resubmission, and approval/rejection state hook.
 */

import React, { useReducer, useEffect, useCallback, useRef } from 'react';
import { CampusItem, ClaimRecord, User } from '../types/index.ts';
import { readJson, safeSetStorage } from '../utils/storage.ts';
import { reportError } from '../components/ErrorBoundary.tsx';
import { auth } from '../lib/firebaseAuth.ts';
import { canUserModerate } from '../utils/admin.ts';
import type { DispatchNotificationFn } from './useNotifications.ts';
import { claimsReducer, type ClaimsState } from './reducers.ts';

interface UseClaimsOptions {
  isDemoMode: boolean;
  currentUser: User | null;
  items: CampusItem[];
  setItems: React.Dispatch<React.SetStateAction<CampusItem[]>>;
  setOlderItems: React.Dispatch<React.SetStateAction<CampusItem[]>>;
  dispatchNotification: DispatchNotificationFn;
}

function buildInitialClaimsState(isDemoMode: boolean): ClaimsState {
  return {
    claims: import.meta.env.DEV && isDemoMode ? readJson<ClaimRecord[]>('nilefound_demo_claims_v1', []) : [],
    claimsCursor: undefined,
    hasMoreClaims: false,
    isLoadingMoreClaims: false,
    claimsError: null,
    claimsRetryNonce: 0,
  };
}

export function useClaims({
  isDemoMode,
  currentUser,
  items,
  setItems,
  setOlderItems,
  dispatchNotification,
}: UseClaimsOptions) {
  const [state, dispatch] = useReducer(claimsReducer, isDemoMode, buildInitialClaimsState);
  const hasSeededOrMutatedDemoRef = useRef(false);

  const setClaims = useCallback<React.Dispatch<React.SetStateAction<ClaimRecord[]>>>((updater) => {
    hasSeededOrMutatedDemoRef.current = true;
    dispatch({ type: 'SET_CLAIMS', updater });
  }, []);

  const userId = currentUser?.id;
  const userRole = currentUser?.role;
  const userIsAdmin = currentUser?.isAdmin;

  useEffect(() => {
    if (!import.meta.env.DEV || !isDemoMode) return;
    if (state.claims.length === 0 && !hasSeededOrMutatedDemoRef.current) return;
    safeSetStorage('nilefound_demo_claims_v1', JSON.stringify(state.claims));
  }, [state.claims, isDemoMode]);

  useEffect(() => {
    if (isDemoMode || !userId || !auth.currentUser?.emailVerified) return;
    let isMounted = true;
    let unsubscribe: (() => void) | undefined;
    dispatch({ type: 'RESET_LISTENER' });
    import('../services/firestoreService.ts')
      .then(({ subscribeToRealtimeClaims }) => {
        if (!isMounted) return;
        unsubscribe = subscribeToRealtimeClaims(
          currentUser,
          (liveClaims, moreClaims, nextCursor) => {
            if (!isMounted) return;
            hasSeededOrMutatedDemoRef.current = true;
            dispatch({ type: 'LIVE_CLAIMS_RECEIVED', claims: liveClaims, hasMore: moreClaims, cursor: nextCursor });
          },
          (err) => {
            if (!isMounted) return;
            reportError('subscribeToRealtimeClaims failed', err);
            dispatch({ type: 'SET_ERROR', error: 'Could not load claims. Check your connection and try again.' });
          }
        );
      })
      .catch((err) => {
        if (!isMounted) return;
        reportError('Load Firestore claims module failed', err);
        dispatch({ type: 'SET_ERROR', error: 'Could not load claims. Check your connection and try again.' });
      });
    return () => {
      isMounted = false;
      unsubscribe?.();
    };
  }, [isDemoMode, userId, userRole, userIsAdmin, state.claimsRetryNonce]);

  const handleLoadMoreClaims = useCallback(async () => {
    if (isDemoMode || state.isLoadingMoreClaims || !state.hasMoreClaims || !state.claimsCursor) return;
    dispatch({ type: 'START_LOAD_MORE' });
    try {
      const { fetchMoreClaimsPage } = await import('../services/firestoreService.ts');
      const page = await fetchMoreClaimsPage(currentUser, state.claimsCursor);
      hasSeededOrMutatedDemoRef.current = true;
      dispatch({ type: 'APPEND_CLAIMS_PAGE', claims: page.claims, hasMore: page.hasMore, cursor: page.cursor });
    } catch (err: unknown) {
      reportError('handleLoadMoreClaims failed', err);
      dispatch({ type: 'SET_ERROR', error: err instanceof Error ? err.message : 'Could not load more claims.' });
    }
  }, [isDemoMode, state.isLoadingMoreClaims, state.hasMoreClaims, state.claimsCursor, currentUser]);

  const handleFetchClaimPrivateDetails = useCallback(
    async (itemId: string, claimId: string) => {
      const { fetchClaimPrivateDetails } = await import('../services/firestoreService.ts');
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
    },
    [setClaims]
  );

  const handleClaimSuccess = useCallback(
    async (newClaim: ClaimRecord) => {
      const fromUid = auth.currentUser?.uid || currentUser?.id || 'claimant';
      const matchingItem = items.find((i) => i.id === newClaim.itemId);
      let finalClaimId = newClaim.id;
      if (isDemoMode) {
        setClaims((prev) => [{ ...newClaim, claimantId: fromUid }, ...prev]);
      } else {
        const { saveClaimToFirestore } = await import('../services/firestoreService.ts');
        finalClaimId = await saveClaimToFirestore(newClaim, currentUser, matchingItem?.authorId);
      }
      setItems((prev) =>
        prev.map((it) => (it.id === newClaim.itemId ? { ...it, status: 'claim_requested' } : it))
      );

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
    },
    [isDemoMode, currentUser, items, setClaims, setItems, dispatchNotification]
  );

  const handleResubmitClaim = useCallback(
    async (claim: ClaimRecord, updatedAnswer: string): Promise<void> => {
      if (claim.status !== 'rejected' || claim.resubmitted) {
        throw new Error('You have already used your one claim resubmission for this item.');
      }
      const cleanAnswer = updatedAnswer.trim().slice(0, 500);
      const fromUid = auth.currentUser?.uid || currentUser?.id || 'claimant';
      const matchingItem = items.find((i) => i.id === claim.itemId);

      if (!isDemoMode) {
        const { resubmitClaimInFirestore } = await import('../services/firestoreService.ts');
        await resubmitClaimInFirestore(claim.id, claim.itemId, cleanAnswer);
      }
      setClaims((prev) =>
        prev.map((c) =>
          c.id === claim.id
            ? {
                ...c,
                status: 'pending',
                resubmitted: true,
                submittedAnswer: cleanAnswer,
                ...(isDemoMode ? { privateLoaded: true } : {}),
              }
            : c
        )
      );
      setItems((prev) =>
        prev.map((it) => (it.id === claim.itemId ? { ...it, status: 'claim_requested' } : it))
      );
      setOlderItems((prev) =>
        prev.map((it) => (it.id === claim.itemId ? { ...it, status: 'claim_requested' } : it))
      );

      if (matchingItem?.authorId && matchingItem.authorId !== fromUid) {
        dispatchNotification({
          recipientUid: matchingItem.authorId,
          fromUid,
          type: 'claim_received',
          title: `Updated claim on ${matchingItem.title}`,
          message: 'A claimant submitted their final updated verification answer.',
          itemId: matchingItem.id,
          claimId: claim.id,
        });
      }
    },
    [isDemoMode, currentUser, items, setClaims, setItems, setOlderItems, dispatchNotification]
  );

  const handleApproveClaim = useCallback(
    async (claimId: string, itemId: string): Promise<boolean> => {
      try {
        const fromUid = auth.currentUser?.uid || currentUser?.id || 'admin';
        const claim = state.claims.find((c) => c.id === claimId);
        let autoRejectedIds = state.claims
          .filter((c) => c.itemId === itemId && c.id !== claimId && c.status === 'pending')
          .map((c) => c.id);

        if (!isDemoMode) {
          const { updateClaimStatusInFirestore } = await import('../services/firestoreService.ts');
          const finderFilter = canUserModerate(currentUser) ? undefined : fromUid;
          const result = await updateClaimStatusInFirestore(claimId, itemId, 'approved', finderFilter);
          autoRejectedIds = result.autoRejectedIds;
        }

        const rejectedSet = new Set(autoRejectedIds);
        setClaims((prev) =>
          prev.map((c) =>
            c.id === claimId ? { ...c, status: 'approved' } : rejectedSet.has(c.id) ? { ...c, status: 'rejected' } : c
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
      } catch (err) {
        reportError('handleApproveClaim failed', err);
        dispatch({ type: 'SET_ERROR', error: 'Could not approve claim. Check your connection and try again.' });
        return false;
      }
    },
    [isDemoMode, currentUser, state.claims, setClaims, setItems, setOlderItems, dispatchNotification]
  );

  const handleRejectClaim = useCallback(
    async (claimId: string): Promise<boolean> => {
      try {
        const fromUid = auth.currentUser?.uid || currentUser?.id || 'admin';
        const claim = state.claims.find((c) => c.id === claimId);
        if (!claim) return false;
        const localOtherPending = state.claims.filter(
          (c) => c.itemId === claim.itemId && c.id !== claimId && c.status === 'pending'
        ).length;

        let nextItemStatus: CampusItem['status'] = localOtherPending === 0 ? 'open' : 'claim_requested';
        if (!isDemoMode) {
          const { updateClaimStatusInFirestore } = await import('../services/firestoreService.ts');
          const finderFilter = canUserModerate(currentUser) ? undefined : fromUid;
          const result = await updateClaimStatusInFirestore(claimId, claim.itemId, 'rejected', finderFilter);
          nextItemStatus = result.nextItemStatus;
        }
        setClaims((prev) => prev.map((c) => (c.id === claimId ? { ...c, status: 'rejected' } : c)));
        setItems((prev) => prev.map((it) => (it.id === claim.itemId ? { ...it, status: nextItemStatus } : it)));
        setOlderItems((prev) => prev.map((it) => (it.id === claim.itemId ? { ...it, status: nextItemStatus } : it)));

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
      } catch (err) {
        reportError('handleRejectClaim failed', err);
        dispatch({ type: 'SET_ERROR', error: 'Could not reject claim. Check your connection and try again.' });
        return false;
      }
    },
    [isDemoMode, currentUser, state.claims, setClaims, setItems, setOlderItems, dispatchNotification]
  );

  const removeClaimsForItem = useCallback(
    (itemId: string) => setClaims((prev) => prev.filter((c) => c.itemId !== itemId)),
    [setClaims]
  );
  const clearClaims = useCallback(() => dispatch({ type: 'CLEAR_CLAIMS' }), []);
  const retryClaims = useCallback(() => dispatch({ type: 'RETRY_CLAIMS' }), []);

  return {
    claims: state.claims,
    setClaims,
    hasMoreClaims: state.hasMoreClaims,
    isLoadingMoreClaims: state.isLoadingMoreClaims,
    claimsError: state.claimsError,
    retryClaims,
    handleLoadMoreClaims,
    handleFetchClaimPrivateDetails,
    handleClaimSuccess,
    handleResubmitClaim,
    handleApproveClaim,
    handleRejectClaim,
    removeClaimsForItem,
    clearClaims,
  };
}
