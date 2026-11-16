import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { CampusItem, User } from '../types/index.ts';
import { ITEM_EXPIRY_DAYS } from '../config/catalog.ts';
import { expireOldItems } from '../utils/admin.ts';
import { calculateMatchScore } from '../utils/matching.ts';
import { readJson, safeSetStorage } from '../utils/storage.ts';
import { reportError } from '../components/ErrorBoundary.tsx';
import { auth } from '../lib/firebase.ts';
import {
  subscribeToRealtimeItems,
  fetchItemsPage,
  saveItemToFirestore,
  updateItemStatusInFirestore,
  expireItemsInFirestore,
  fetchItemFullPhoto,
  deleteItemFromFirestore,
} from '../services/firestoreService.ts';
import type { DispatchNotificationFn } from './useNotifications.ts';

interface UseItemsFeedOptions {
  isDemoMode: boolean;
  currentUser: User | null;
  lowDataMode: boolean;
  dispatchNotification: DispatchNotificationFn;
  onItemSubmitted?: () => void;
  onItemDeleted?: (itemId: string) => void;
}

export function useItemsFeed({
  isDemoMode,
  currentUser,
  lowDataMode,
  dispatchNotification,
  onItemSubmitted,
  onItemDeleted,
}: UseItemsFeedOptions) {
  const [items, setItemsState] = useState<CampusItem[]>(() =>
    import.meta.env.DEV && isDemoMode ? readJson<CampusItem[]>('nilefound_demo_items_v1', []) : []
  );
  const [olderItems, setOlderItems] = useState<CampusItem[]>([]);
  const [itemsCursor, setItemsCursor] = useState<QueryDocumentSnapshot<DocumentData> | undefined>(undefined);
  const [hasMoreItems, setHasMoreItems] = useState(false);
  const [isLoadingMoreItems, setIsLoadingMoreItems] = useState(false);
  const [itemsError, setItemsError] = useState<string | null>(null);
  const [itemsRetryNonce, setItemsRetryNonce] = useState(0);
  const hasPaginatedRef = useRef(false);
  const hasSeededOrMutatedDemoRef = useRef(false);

  const setItems = useCallback<React.Dispatch<React.SetStateAction<CampusItem[]>>>((updater) => {
    hasSeededOrMutatedDemoRef.current = true;
    setItemsState(updater);
  }, []);

  const mergedItems = useMemo(() => {
    if (olderItems.length === 0) return items;
    const seen = new Set(items.map((it) => it.id));
    return [...items, ...olderItems.filter((it) => !seen.has(it.id))];
  }, [items, olderItems]);

  useEffect(() => {
    if (!import.meta.env.DEV || !isDemoMode) return;
    if (items.length === 0 && !hasSeededOrMutatedDemoRef.current) return;
    safeSetStorage('nilefound_demo_items_v1', JSON.stringify(items));
  }, [items, isDemoMode]);

  const userId = currentUser?.id;

  useEffect(() => {
    if (isDemoMode || !userId || !auth.currentUser?.emailVerified) return;
    let isMounted = true;
    hasPaginatedRef.current = false;
    setItemsError(null);
    setOlderItems([]);
    setItemsCursor(undefined);
    const unsubscribe = subscribeToRealtimeItems(
      20,
      (liveItems, hasMore, lastDoc) => {
        if (!isMounted) return;
        setItems(liveItems);
        if (!hasPaginatedRef.current) {
          setItemsCursor(lastDoc);
          setHasMoreItems(hasMore);
        }
        setIsLoadingMoreItems(false);
        setItemsError(null);
      },
      (err) => {
        if (!isMounted) return;
        reportError('subscribeToRealtimeItems failed', err);
        setIsLoadingMoreItems(false);
        setItemsError('Could not load campus notices. Check your connection and try again.');
      }
    );
    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [isDemoMode, userId, itemsRetryNonce]);

  const handleLoadMoreItems = useCallback(async () => {
    if (isDemoMode || isLoadingMoreItems || !hasMoreItems || !itemsCursor) return;
    setIsLoadingMoreItems(true);
    setItemsError(null);
    try {
      const page = await fetchItemsPage(itemsCursor);
      hasPaginatedRef.current = true;
      setOlderItems((prev) => {
        const seen = new Set(prev.map((it) => it.id));
        return [...prev, ...page.items.filter((it) => !seen.has(it.id))];
      });
      setItemsCursor(page.nextCursor);
      setHasMoreItems(page.hasMore);
    } catch (err: unknown) {
      reportError('handleLoadMoreItems failed', err);
      setItemsError(err instanceof Error ? err.message : 'Could not load more notices.');
    } finally {
      setIsLoadingMoreItems(false);
    }
  }, [isDemoMode, isLoadingMoreItems, hasMoreItems, itemsCursor]);

  const handleLoadAllItems = useCallback(async () => {
    if (isDemoMode || isLoadingMoreItems || !hasMoreItems || !itemsCursor) return;
    setIsLoadingMoreItems(true);
    setItemsError(null);
    try {
      let cursor: QueryDocumentSnapshot<DocumentData> | undefined = itemsCursor;
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
      setOlderItems((prev) => {
        const seen = new Set(prev.map((it) => it.id));
        return [...prev, ...accumulated.filter((it) => !seen.has(it.id))];
      });
      setItemsCursor(cursor);
      setHasMoreItems(more);
    } catch (err: unknown) {
      reportError('handleLoadAllItems failed', err);
      setItemsError(err instanceof Error ? err.message : 'Could not load remaining notices.');
    } finally {
      setIsLoadingMoreItems(false);
    }
  }, [isDemoMode, isLoadingMoreItems, hasMoreItems, itemsCursor]);

  const handleFetchFullPhoto = useCallback(
    async (itemId: string) => fetchItemFullPhoto(itemId, lowDataMode),
    [lowDataMode]
  );

  const handleAddItem = useCallback(
    async (newItem: CampusItem): Promise<boolean> => {
      let finalItemId = newItem.id;
      if (isDemoMode) {
        setItems((prev) => [newItem, ...prev]);
      } else {
        // Never swallow failures silently or keep local state when Firestore write fails (#79).
        finalItemId = await saveItemToFirestore(newItem, currentUser);
        setItems((prev) => [{ ...newItem, id: finalItemId }, ...prev]);
      }
      onItemSubmitted?.();

      const fromUid = auth.currentUser?.uid || currentUser?.id || 'student';
      const oppositeType = newItem.type === 'found' ? 'lost' : 'found';
      const scoredMatches = items
        .filter((it) => it.type === oppositeType && it.status === 'open')
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
      } else if (scoredMatches.length > 0) {
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

      dispatchNotification(
        {
          recipientUid: 'admin',
          fromUid,
          type: 'admin_review',
          title: `New ${newItem.type.toUpperCase()}: ${newItem.title}`,
          message: `A new ${newItem.type} item was reported at ${newItem.location}.`,
          itemId: finalItemId,
        },
        { toast: true, push: true }
      );
      return true;
    },
    [isDemoMode, currentUser, items, dispatchNotification, onItemSubmitted]
  );

  const handleUpdateItemStatus = useCallback(
    async (itemId: string, status: CampusItem['status']): Promise<boolean> => {
      try {
        const fromUid = auth.currentUser?.uid || currentUser?.id || 'admin';
        if (!isDemoMode) {
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
        setItemsError('Could not update item status. Check your connection and try again.');
        return false;
      }
    },
    [isDemoMode, currentUser, mergedItems, dispatchNotification]
  );

  const handleDeleteItem = useCallback(
    async (itemId: string): Promise<boolean> => {
      try {
        if (!isDemoMode) {
          await deleteItemFromFirestore(itemId);
        }
        setItems((prev) => prev.filter((it) => it.id !== itemId));
        setOlderItems((prev) => prev.filter((it) => it.id !== itemId));
        onItemDeleted?.(itemId);
        return true;
      } catch (err) {
        reportError('handleDeleteItem failed', err);
        setItemsError('Could not delete item. Check your connection and try again.');
        return false;
      }
    },
    [isDemoMode, onItemDeleted]
  );

  const handleExpireOldItems = useCallback(async (): Promise<boolean> => {
    try {
      const nextItems = expireOldItems(items, ITEM_EXPIRY_DAYS);
      const nextOlder = expireOldItems(olderItems, ITEM_EXPIRY_DAYS);
      const expiredIds = [
        ...nextItems.filter((it, idx) => it.status === 'expired' && items[idx]?.status !== 'expired'),
        ...nextOlder.filter((it, idx) => it.status === 'expired' && olderItems[idx]?.status !== 'expired'),
      ].map((it) => it.id);

      if (!isDemoMode && expiredIds.length > 0) {
        await expireItemsInFirestore(expiredIds);
      }
      setItems(nextItems);
      setOlderItems(nextOlder);
      return true;
    } catch (err) {
      reportError('handleExpireOldItems failed', err);
      return false;
    }
  }, [items, olderItems, isDemoMode]);

  const clearItems = useCallback(() => {
    setItems([]);
    setOlderItems([]);
    setItemsCursor(undefined);
    setHasMoreItems(false);
  }, []);

  return {
    items,
    setItems,
    setOlderItems,
    mergedItems,
    hasMoreItems,
    isLoadingMoreItems,
    itemsError,
    retryLoadItems: () => setItemsRetryNonce((n) => n + 1),
    handleLoadMoreItems,
    handleLoadAllItems,
    handleFetchFullPhoto,
    handleAddItem,
    handleUpdateItemStatus,
    handleDeleteItem,
    handleExpireOldItems,
    clearItems,
  };
}
