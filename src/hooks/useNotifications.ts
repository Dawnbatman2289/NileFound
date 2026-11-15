import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { CampusNotification, User } from '../types/index.ts';
import type { AppTab } from '../components/Navbar.tsx';
import { reportError } from '../components/ErrorBoundary.tsx';
import { auth } from '../lib/firebase.ts';
import {
  subscribeToRealtimeNotifications,
  saveNotificationToFirestore,
  markNotificationAsReadInFirestore,
  markNotificationsReadInFirestore,
} from '../services/firestoreService.ts';
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
    return subscribeToRealtimeNotifications(
      currentUser,
      (realtimeNotifs) => {
        setLiveNotifications((prev) => {
          if (!hasLoadedInitialRef.current) {
            hasLoadedInitialRef.current = true;
            return realtimeNotifs;
          }
          const prevIds = new Set(prev.map((n) => n.id));
          const newest = realtimeNotifs[0];
          if (newest && !prevIds.has(newest.id) && !newest.read) {
            playNotificationChime();
            setActiveToast(newest);
            sendBrowserPushNotification(newest.title, { body: newest.message });
          }
          return realtimeNotifs;
        });
      },
      (err) => reportError('subscribeToRealtimeNotifications failed', err)
    );
  }, [isDemoMode, userId, userRole, userIsAdmin]);

  const notifications = useMemo(() => {
    if (!isDemoMode) return liveNotifications;
    if (!currentUser) return [];
    const moderate = canUserModerate(currentUser);
    return demoNotifications.filter(
      (n) => n.recipientUid === currentUser.id || (n.recipientUid === 'admin' && moderate)
    );
  }, [isDemoMode, liveNotifications, demoNotifications, currentUser]);

  const dispatchNotification = useCallback<DispatchNotificationFn>(
    (payload, { toast = false, push = false } = {}) => {
      const linkTab: AppTab =
        payload.type === 'admin_review' || (payload.type === 'claim_received' && isPrivileged)
          ? 'admin'
          : 'feed';
      const record: CampusNotification = {
        ...payload,
        linkTab,
        id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        read: false,
        createdAt: new Date().toISOString(),
      };
      if (isDemoMode) {
        setDemoNotifications((prev) => [record, ...prev]);
        const isForCurrentUser =
          record.recipientUid === currentUser?.id ||
          (record.recipientUid === 'admin' && canUserModerate(currentUser));
        if (isForCurrentUser && toast) {
          playNotificationChime();
          setActiveToast(record);
          if (push) sendBrowserPushNotification(record.title, { body: record.message });
        }
        return;
      }

      saveNotificationToFirestore(record).catch((err) =>
        reportError('saveNotificationToFirestore failed', err)
      );
      const isForCurrentUser =
        record.recipientUid === currentUser?.id ||
        (record.recipientUid === 'admin' && canUserModerate(currentUser));
      if (isForCurrentUser) {
        setLiveNotifications((prev) => [record, ...prev]);
        if (toast) {
          playNotificationChime();
          setActiveToast(record);
          if (push) sendBrowserPushNotification(record.title, { body: record.message });
        }
      }
    },
    [isDemoMode, isPrivileged, currentUser]
  );

  const dismissToast = useCallback(() => setActiveToast(null), []);

  const markAllAsRead = useCallback(() => {
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
    if (unreadIds.length === 0) return;
    if (isDemoMode) {
      const unreadSet = new Set(unreadIds);
      setDemoNotifications((prev) => prev.map((n) => (unreadSet.has(n.id) ? { ...n, read: true } : n)));
      return;
    }
    setLiveNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    markNotificationsReadInFirestore(unreadIds).catch((err) =>
      reportError('Mark notifications read failed', err)
    );
  }, [notifications, isDemoMode]);

  const markAsRead = useCallback(
    (id: string) => {
      if (isDemoMode) {
        setDemoNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
        return;
      }
      setLiveNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
      markNotificationAsReadInFirestore(id).catch((err) =>
        reportError('Mark notification read failed', err)
      );
    },
    [isDemoMode]
  );

  const markClaimChatNotificationsRead = useCallback(
    (claimId: string) => {
      if (!claimId) return;
      const unreadIds = notifications
        .filter((n) => !n.read && n.type === 'chat_message' && n.claimId === claimId)
        .map((n) => n.id);
      if (unreadIds.length === 0) return;
      const unreadSet = new Set(unreadIds);
      if (isDemoMode) {
        setDemoNotifications((prev) => prev.map((n) => (unreadSet.has(n.id) ? { ...n, read: true } : n)));
        return;
      }
      setLiveNotifications((prev) => prev.map((n) => (unreadSet.has(n.id) ? { ...n, read: true } : n)));
      markNotificationsReadInFirestore(unreadIds).catch((err) =>
        reportError('Mark chat notifications read failed', err)
      );
    },
    [notifications, isDemoMode]
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
