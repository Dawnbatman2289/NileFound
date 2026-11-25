import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { CampusNotification, User } from '../types/index.ts';
import type { AppTab } from '../components/Navbar.tsx';
import { reportError } from '../components/ErrorBoundary.tsx';
import { auth } from '../lib/firebaseAuth.ts';
import {
  playNotificationChime,
  sendBrowserPushNotification,
} from '../services/notificationService.ts';
import { canUserModerate } from '../utils/admin.ts';
import { readJson, safeSetStorage, safeRemoveStorage } from '../utils/storage.ts';

export type DispatchNotificationFn = (
  payload: Omit<CampusNotification, 'id' | 'read' | 'createdAt'>,
  options?: { toast?: boolean; push?: boolean }
) => void;

interface UseNotificationsOptions {
  isDemoMode: boolean;
  currentUser: User | null;
  isPrivileged: boolean;
}

const DEMO_NOTIFS_KEY = 'nilefound_demo_notifs_v1';

export function createNotificationDocId(
  payload: Pick<CampusNotification, 'type' | 'claimId' | 'recipientUid'>
): string {
  if (payload.type === 'chat_message' && payload.claimId) {
    return `chat_${payload.claimId}_${payload.recipientUid}`;
  }
  return `notif_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function shouldAlertIncomingNotification(
  prevIds: Set<string>,
  newest: CampusNotification | undefined,
  currentUserId?: string | null
): boolean {
  if (!newest || newest.read) return false;
  if (prevIds.has(newest.id)) return false;
  if (currentUserId && newest.fromUid === currentUserId) return false;
  return true;
}

export function useNotifications({
  isDemoMode,
  currentUser,
  isPrivileged,
}: UseNotificationsOptions) {
  const [liveNotifications, setLiveNotifications] = useState<CampusNotification[]>([]);
  const [demoNotifications, setDemoNotifications] = useState<CampusNotification[]>(() =>
    import.meta.env.DEV ? readJson<CampusNotification[]>(DEMO_NOTIFS_KEY, []) : []
  );
  const [activeToast, setActiveToast] = useState<CampusNotification | null>(null);
  const hasLoadedInitialRef = useRef(false);

  const userId = currentUser?.id;
  const userRole = currentUser?.role;
  const userIsAdmin = currentUser?.isAdmin;

  useEffect(() => {
    if (!import.meta.env.DEV || !isDemoMode) return;
    safeSetStorage(DEMO_NOTIFS_KEY, JSON.stringify(demoNotifications.slice(0, 50)));
  }, [demoNotifications, isDemoMode]);

  useEffect(() => {
    hasLoadedInitialRef.current = false;
    if (isDemoMode || !userId || !auth.currentUser?.emailVerified) {
      setLiveNotifications([]);
      return;
    }
    let isMounted = true;
    let unsubscribe: (() => void) | undefined;
    import('../services/firestoreService.ts')
      .then(({ subscribeToRealtimeNotifications }) => {
        if (!isMounted) return;
        unsubscribe = subscribeToRealtimeNotifications(
          currentUser,
          (realtimeNotifs) => {
            if (!isMounted) return;
            setLiveNotifications((prev) => {
              if (!hasLoadedInitialRef.current) {
                hasLoadedInitialRef.current = true;
                return realtimeNotifs;
              }
              const prevIds = new Set(prev.map((n) => n.id));
              const newest = realtimeNotifs[0];
              if (shouldAlertIncomingNotification(prevIds, newest, userId)) {
                playNotificationChime();
                setActiveToast(newest);
                sendBrowserPushNotification(newest.title, { body: newest.message });
              }
              return realtimeNotifs;
            });
          },
          (err) => {
            if (isMounted) reportError('subscribeToRealtimeNotifications failed', err);
          }
        );
      })
      .catch((err) => {
        if (isMounted) reportError('Load Firestore notifications module failed', err);
      });
    return () => {
      isMounted = false;
      unsubscribe?.();
    };
  }, [isDemoMode, userId, userRole, userIsAdmin]);

  const notifications = useMemo(() => {
    if (!isDemoMode) return liveNotifications;
    if (!currentUser) return [];
    const moderate = canUserModerate(currentUser);
    return demoNotifications.filter(
      (n) => n.recipientUid === currentUser.id || (n.recipientUid === 'admin' && moderate)
    );
  }, [isDemoMode, liveNotifications, demoNotifications, currentUser]);

  const notificationsRef = useRef(notifications);
  const currentUserRef = useRef(currentUser);
  useEffect(() => {
    notificationsRef.current = notifications;
  }, [notifications]);
  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  const dispatchNotification = useCallback<DispatchNotificationFn>(
    (payload, { toast = false, push = false } = {}) => {
      const linkTab: AppTab =
        payload.type === 'claim_received' && isPrivileged
          ? 'admin'
          : 'feed';
      const deterministicId = createNotificationDocId(payload);
      const record: CampusNotification = {
        ...payload,
        linkTab,
        id: deterministicId,
        read: false,
        createdAt: new Date().toISOString(),
      };
      const activeUser = currentUserRef.current;
      if (isDemoMode) {
        setDemoNotifications((prev) => [record, ...prev.filter((n) => n.id !== record.id)]);
        const isForCurrentUser =
          record.recipientUid === activeUser?.id ||
          (record.recipientUid === 'admin' && canUserModerate(activeUser));
        if (isForCurrentUser && toast) {
          playNotificationChime();
          setActiveToast(record);
          if (push) sendBrowserPushNotification(record.title, { body: record.message });
        }
        return;
      }

      import('../services/firestoreService.ts')
        .then(({ saveNotificationToFirestore }) => saveNotificationToFirestore(record))
        .catch((err) => reportError('saveNotificationToFirestore failed', err));
      const isForCurrentUser =
        record.recipientUid === activeUser?.id ||
        (record.recipientUid === 'admin' && canUserModerate(activeUser));
      if (isForCurrentUser) {
        setLiveNotifications((prev) => [record, ...prev.filter((n) => n.id !== record.id)]);
        if (toast) {
          playNotificationChime();
          setActiveToast(record);
          if (push) sendBrowserPushNotification(record.title, { body: record.message });
        }
      }
    },
    [isDemoMode, isPrivileged]
  );

  const dismissToast = useCallback(() => setActiveToast(null), []);

  const markAllAsRead = useCallback(() => {
    const unreadIds = notificationsRef.current.filter((n) => !n.read).map((n) => n.id);
    if (unreadIds.length === 0) return;
    if (isDemoMode) {
      const unreadSet = new Set(unreadIds);
      setDemoNotifications((prev) => prev.map((n) => (unreadSet.has(n.id) ? { ...n, read: true } : n)));
      return;
    }
    setLiveNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    import('../services/firestoreService.ts')
      .then(({ markNotificationsReadInFirestore }) => markNotificationsReadInFirestore(unreadIds))
      .catch((err) => reportError('Mark notifications read failed', err));
  }, [isDemoMode]);

  const markAsRead = useCallback(
    (id: string) => {
      if (isDemoMode) {
        setDemoNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
        return;
      }
      setLiveNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
      import('../services/firestoreService.ts')
        .then(({ markNotificationAsReadInFirestore }) => markNotificationAsReadInFirestore(id))
        .catch((err) => reportError('Mark notification read failed', err));
    },
    [isDemoMode]
  );

  const markClaimChatNotificationsRead = useCallback(
    (claimId: string) => {
      if (!claimId) return;
      const unreadIds = notificationsRef.current
        .filter((n) => !n.read && n.type === 'chat_message' && n.claimId === claimId)
        .map((n) => n.id);
      if (unreadIds.length === 0) return;
      const unreadSet = new Set(unreadIds);
      if (isDemoMode) {
        setDemoNotifications((prev) => prev.map((n) => (unreadSet.has(n.id) ? { ...n, read: true } : n)));
        return;
      }
      setLiveNotifications((prev) => prev.map((n) => (unreadSet.has(n.id) ? { ...n, read: true } : n)));
      import('../services/firestoreService.ts')
        .then(({ markNotificationsReadInFirestore }) => markNotificationsReadInFirestore(unreadIds))
        .catch((err) => reportError('Mark chat notifications read failed', err));
    },
    [isDemoMode]
  );

  const clearNotifications = useCallback(() => {
    setLiveNotifications([]);
    setDemoNotifications([]);
    safeRemoveStorage(DEMO_NOTIFS_KEY);
    setActiveToast(null);
  }, []);

  return {
    notifications,
    activeToast,
    dispatchNotification,
    dismissToast,
    markAllAsRead,
    markAsRead,
    markClaimChatNotificationsRead,
    clearNotifications,
  };
}
