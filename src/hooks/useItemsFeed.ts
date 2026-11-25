/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Realtime campus feed items subscription, pagination, matching alerts, and status actions.
 */

import React, { useReducer, useEffect, useCallback, useMemo, useRef } from 'react';
import type { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { CampusItem, User } from '../types/index.ts';
import { ITEM_EXPIRY_DAYS } from '../config/catalog.ts';
import { expireOldItems } from '../utils/admin.ts';
import { calculateMatchScore } from '../utils/matching.ts';
import { readJson, safeSetStorage } from '../utils/storage.ts';
import { reportError } from '../components/ErrorBoundary.tsx';
import { auth } from '../lib/firebaseAuth.ts';
import type { DispatchNotificationFn } from './useNotifications.ts';
import { itemsFeedReducer, type ItemsFeedState } from './reducers.ts';

interface UseItemsFeedOptions {
  isDemoMode: boolean;
  currentUser: User | null;
  lowDataMode: boolean;
  dispatchNotification: DispatchNotificationFn;
  onItemSubmitted?: () => void;
  onItemDeleted?: (itemId: string) => void;
}

function buildInitialFeedState(isDemoMode: boolean): ItemsFeedState {
  return {
    items: import.meta.env.DEV && isDemoMode ? readJson<CampusItem[]>('nilefound_demo_items_v1', []) : [],
    olderItems: [],
    itemsCursor: undefined,
    hasMoreItems: false,
    isLoadingMoreItems: false,
    itemsError: null,
    itemsRetryNonce: 0,
  };
}

function dispatchMatchNotifications(
  newItem: CampusItem,
  finalItemId: string,
  fromUid: string,
  matchPool: CampusItem[],
  dispatchNotification: DispatchNotificationFn
): void {
  const oppositeType = newItem.type === 'found' ? 'lost' : 'found';
  const scoredMatches = matchPool
    .filter((it) => it.id !== finalItemId && it.type === oppositeType && it.status === 'open')
    .map((it) => ({
      item: it,
      result: calculateMatchScore(
        newItem.type === 'lost' ? newItem : it,
        newItem.type === 'found' ? newItem : it
      ),
    }))
    .filter(({ result }) => result.isLikelyMatch)
    .sort((a, b) => b.result.score - a.result.score)
    .slice(0, 3);

  if (newItem.type === 'found') {
    scoredMatches.forEach(({ item: lostItem }) => {
      if (lostItem.authorId && lostItem.authorId !== fromUid) {
        dispatchNotification({
          recipientUid: lostItem.authorId,
          fromUid,
          type: 'match_alert',
          title: `Possible match: ${lostItem.title}`,
          message: `A found item reported at ${newItem.location} matches your notice.`,
          itemId: lostItem.id,
          sourceItemId: finalItemId,
        });
      }
    });
    return;
  }

  if (scoredMatches.length > 0) {
    const topFound = scoredMatches[0].item;
    dispatchNotification({
      recipientUid: fromUid,
      fromUid,
      type: 'match_alert',
      title: `Possible match found: ${newItem.title}`,
      message: `A matching ${newItem.category.replace(/_/g, ' ')} was reported at ${topFound.location}. Check the feed to claim it.`,
      itemId: topFound.id,
    });
  }
}

export function useItemsFeed({
  isDemoMode,
  currentUser,
  lowDataMode,
  dispatchNotification,
  onItemSubmitted,
  onItemDeleted,
}: UseItemsFeedOptions) {
  const [state, dispatch] = useReducer(itemsFeedReducer, isDemoMode, buildInitialFeedState);
  const hasPaginatedRef = useRef(false);
  const hasSeededOrMutatedDemoRef = useRef(false);

  const setItems = useCallback<React.Dispatch<React.SetStateAction<CampusItem[]>>>((updater) => {
    hasSeededOrMutatedDemoRef.current = true;
    dispatch({ type: 'SET_ITEMS', updater });
  }, []);

  const setOlderItems = useCallback<React.Dispatch<React.SetStateAction<CampusItem[]>>>((updater) => {
    dispatch({ type: 'SET_OLDER_ITEMS', updater });
  }, []);

  const mergedItems = useMemo(() => {
    if (state.olderItems.length === 0) return state.items;
    const seen = new Set(state.items.map((it) => it.id));
    return [...state.items, ...state.olderItems.filter((it) => !seen.has(it.id))];
  }, [state.items, state.olderItems]);

  useEffect(() => {
    if (!import.meta.env.DEV || !isDemoMode) return;
    if (state.items.length === 0 && !hasSeededOrMutatedDemoRef.current) return;
    safeSetStorage('nilefound_demo_items_v1', JSON.stringify(state.items));
  }, [state.items, isDemoMode]);

  const userId = currentUser?.id;

  useEffect(() => {
    if (isDemoMode || !userId || !auth.currentUser?.emailVerified) return;
    let isMounted = true;
    let unsubscribe: (() => void) | undefined;
    hasPaginatedRef.current = false;
    dispatch({ type: 'RESET_LISTENER' });
    import('../services/firestoreService.ts')
      .then(({ subscribeToRealtimeItems }) => {
        if (!isMounted) return;
        unsubscribe = subscribeToRealtimeItems(
          25,
          (liveItems, hasMore, lastDoc) => {
            if (!isMounted) return;
            dispatch({
              type: 'LIVE_ITEMS_RECEIVED',
              items: liveItems,
              hasMore,
              cursor: lastDoc,
              preservePagination: hasPaginatedRef.current,
            });
          },
          (err) => {
            if (!isMounted) return;
            reportError('subscribeToRealtimeItems failed', err);
            dispatch({ type: 'SET_ERROR', error: 'Could not load campus notices. Check your connection and try again.' });
          }
        );
      })
      .catch((err) => {
        if (!isMounted) return;
        reportError('Load Firestore items module failed', err);
        dispatch({ type: 'SET_ERROR', error: 'Could not load campus notices. Check your connection and try again.' });
      });
    return () => {
      isMounted = false;
      unsubscribe?.();
    };
  }, [isDemoMode, userId, state.itemsRetryNonce]);

  const handleLoadMoreItems = useCallback(async () => {
    if (isDemoMode || state.isLoadingMoreItems || !state.hasMoreItems || !state.itemsCursor) return;
    dispatch({ type: 'START_LOAD_MORE' });
    try {
      const { fetchItemsPage } = await import('../services/firestoreService.ts');
      const page = await fetchItemsPage(state.itemsCursor);
      hasPaginatedRef.current = true;
      dispatch({
        type: 'APPEND_OLDER_ITEMS',
        items: page.items,
        hasMore: page.hasMore,
        cursor: page.nextCursor,
      });
    } catch (err: unknown) {
      reportError('handleLoadMoreItems failed', err);
      dispatch({ type: 'SET_ERROR', error: err instanceof Error ? err.message : 'Could not load more notices.' });
    }
  }, [isDemoMode, state.isLoadingMoreItems, state.hasMoreItems, state.itemsCursor]);

  const handleLoadAllItems = useCallback(async (): Promise<CampusItem[] | null> => {
    if (isDemoMode || !state.hasMoreItems || !state.itemsCursor) return mergedItems;
    if (state.isLoadingMoreItems) return null;
    dispatch({ type: 'START_LOAD_MORE' });
    try {
      const { fetchItemsPage } = await import('../services/firestoreService.ts');
      let cursor: QueryDocumentSnapshot<DocumentData> | undefined = state.itemsCursor;
      let more = true;
      let pages = 0;
      const accumulated: CampusItem[] = [];
      while (more && cursor && pages < 25) {
        const page = await fetchItemsPage(cursor);
        accumulated.push(...page.items);
        cursor = page.nextCursor;
        more = page.hasMore;
        pages += 1;
      }
      hasPaginatedRef.current = true;
      dispatch({ type: 'APPEND_OLDER_ITEMS', items: accumulated, hasMore: more, cursor });
      const seen = new Set(mergedItems.map((it) => it.id));
      return [...mergedItems, ...accumulated.filter((it) => !seen.has(it.id))];
    } catch (err: unknown) {
      reportError('handleLoadAllItems failed', err);
      dispatch({ type: 'SET_ERROR', error: err instanceof Error ? err.message : 'Could not load remaining notices.' });
      return null;
    }
  }, [isDemoMode, state.isLoadingMoreItems, state.hasMoreItems, state.itemsCursor, mergedItems]);

  const handleFetchFullPhoto = useCallback(
    async (itemId: string) => {
      const { fetchItemFullPhoto } = await import('../services/firestoreService.ts');
      return fetchItemFullPhoto(itemId, lowDataMode);
    },
    [lowDataMode]
  );

  const handleAddItem = useCallback(
    async (newItem: CampusItem): Promise<boolean> => {
      let finalItemId = newItem.id;
      if (isDemoMode) {
        setItems((prev) => [newItem, ...prev]);
      } else {
        const { saveItemToFirestore } = await import('../services/firestoreService.ts');
        finalItemId = await saveItemToFirestore(newItem, currentUser);
        setItems((prev) => [{ ...newItem, id: finalItemId }, ...prev]);
      }
      onItemSubmitted?.();

      const fromUid = auth.currentUser?.uid || currentUser?.id || 'student';
      const oppositeType = newItem.type === 'found' ? 'lost' : 'found';
      let matchPool = state.items.filter((it) => it.type === oppositeType && it.status === 'open');
      if (!isDemoMode) {
        try {
          const { fetchMatchCandidatesFromFirestore } = await import('../services/firestoreService.ts');
          matchPool = await fetchMatchCandidatesFromFirestore(oppositeType, newItem.category);
        } catch (err) {
          reportError('fetchMatchCandidatesFromFirestore failed', err);
        }
      }
      dispatchMatchNotifications(newItem, finalItemId, fromUid, matchPool, dispatchNotification);
      return true;
    },
    [isDemoMode, currentUser, state.items, setItems, dispatchNotification, onItemSubmitted]
  );

  const handleUpdateItemStatus = useCallback(
    async (itemId: string, status: CampusItem['status']): Promise<boolean> => {
      try {
        const fromUid = auth.currentUser?.uid || currentUser?.id || 'admin';
        if (!isDemoMode) {
          const { updateItemStatusInFirestore } = await import('../services/firestoreService.ts');
          await updateItemStatusInFirestore(itemId, status);
        }
        setItems((prev) => prev.map((it) => (it.id === itemId ? { ...it, status } : it)));
        setOlderItems((prev) => prev.map((it) => (it.id === itemId ? { ...it, status } : it)));
        if (status === 'returned') {
          const target = mergedItems.find((i) => i.id === itemId);
          if (target?.authorId) {
            dispatchNotification({
              recipientUid: target.authorId,
              fromUid,
              type: 'item_returned',
              title: `Item returned: ${target.title}`,
              message: `"${target.title}" was handed over and marked returned.`,
              itemId: target.id,
            });
          }
        }
        return true;
      } catch (err) {
        reportError('handleUpdateItemStatus failed', err);
        dispatch({ type: 'SET_ERROR', error: 'Could not update item status. Check your connection and try again.' });
        return false;
      }
    },
    [isDemoMode, currentUser, mergedItems, setItems, setOlderItems, dispatchNotification]
  );

  const handleConfirmCustody = useCallback(
    async (itemId: string): Promise<boolean> => {
      try {
        const fromUid = auth.currentUser?.uid || currentUser?.id || 'security';
        if (!isDemoMode) {
          const { confirmItemCustodyInFirestore } = await import('../services/firestoreService.ts');
          await confirmItemCustodyInFirestore(itemId);
        }
        setItems((prev) => prev.map((it) => (it.id === itemId ? { ...it, custodyStatus: 'confirmed' } : it)));
        setOlderItems((prev) => prev.map((it) => (it.id === itemId ? { ...it, custodyStatus: 'confirmed' } : it)));
        const target = mergedItems.find((i) => i.id === itemId);
        if (target?.authorId && target.authorId !== fromUid) {
          dispatchNotification({
            recipientUid: target.authorId,
            fromUid,
            type: 'custody_confirmed',
            title: 'Drop-off confirmed',
            message: 'Campus desk confirmed physical custody of your found item.',
            itemId: target.id,
          });
        }
        return true;
      } catch (err) {
        reportError('handleConfirmCustody failed', err);
        dispatch({ type: 'SET_ERROR', error: 'Could not confirm drop-off custody. Check your permissions and connection.' });
        return false;
      }
    },
    [isDemoMode, currentUser, mergedItems, setItems, setOlderItems, dispatchNotification]
  );

  const handleDeleteItem = useCallback(
    async (itemId: string): Promise<boolean> => {
      try {
        if (!isDemoMode) {
          const { deleteItemFromFirestore } = await import('../services/firestoreService.ts');
          await deleteItemFromFirestore(itemId);
        }
        setItems((prev) => prev.filter((it) => it.id !== itemId));
        setOlderItems((prev) => prev.filter((it) => it.id !== itemId));
        onItemDeleted?.(itemId);
        return true;
      } catch (err) {
        reportError('handleDeleteItem failed', err);
        dispatch({ type: 'SET_ERROR', error: 'Could not delete item. Check your connection and try again.' });
        return false;
      }
    },
    [isDemoMode, setItems, setOlderItems, onItemDeleted]
  );

  const handleExpireOldItems = useCallback(async (): Promise<boolean> => {
    try {
      const nextItems = expireOldItems(state.items, ITEM_EXPIRY_DAYS);
      const nextOlder = expireOldItems(state.olderItems, ITEM_EXPIRY_DAYS);
      const expiredIds = [
        ...nextItems.filter((it, idx) => it.status === 'expired' && state.items[idx]?.status !== 'expired'),
        ...nextOlder.filter((it, idx) => it.status === 'expired' && state.olderItems[idx]?.status !== 'expired'),
      ].map((it) => it.id);
      if (!isDemoMode && expiredIds.length > 0) {
        const { expireItemsInFirestore } = await import('../services/firestoreService.ts');
        await expireItemsInFirestore(expiredIds);
      }
      setItems(nextItems);
      setOlderItems(nextOlder);
      return true;
    } catch (err) {
      reportError('handleExpireOldItems failed', err);
      return false;
    }
  }, [state.items, state.olderItems, isDemoMode, setItems, setOlderItems]);

  const clearItems = useCallback(() => dispatch({ type: 'CLEAR_ITEMS' }), []);
  const retryLoadItems = useCallback(() => dispatch({ type: 'RETRY_ITEMS' }), []);

  return {
    items: state.items,
    setItems,
    setOlderItems,
    mergedItems,
    hasMoreItems: state.hasMoreItems,
    isLoadingMoreItems: state.isLoadingMoreItems,
    itemsError: state.itemsError,
    retryLoadItems,
    handleLoadMoreItems,
    handleLoadAllItems,
    handleFetchFullPhoto,
    handleAddItem,
    handleUpdateItemStatus,
    handleConfirmCustody,
    handleDeleteItem,
    handleExpireOldItems,
    clearItems,
  };
}
