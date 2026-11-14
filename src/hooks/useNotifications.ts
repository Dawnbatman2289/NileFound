import { useState, useEffect, useRef, useCallback } from 'react';
import { CampusNotification, User } from '../types/index.ts';
import type { AppTab } from '../components/Navbar.tsx';
import { reportError } from '../components/ErrorBoundary.tsx';
import { auth } from '../lib/firebase.ts';
import {
  subscribeToRealtimeNotifications,
  saveNotificationToFirestore,
  markNotificationAsReadInFirestore,
} from '../services/firestoreService.ts';
import {
  playNotificationChime,
  sendBrowserPushNotification,
} from '../services/notificationService.ts';

export type DispatchNotificationFn = (
  payload: Omit<CampusNotification, 'id' | 'read' | 'createdAt'>,
  options?: { toast?: boolean; push?: boolean }
) => void;

interface UseNotificationsOptions {
  isDemoMode: boolean;
  currentUser: User | null;
  isPrivileged: boolean;
}

export function useNotifications({
  isDemoMode,
  currentUser,
  isPrivileged,
}: UseNotificationsOptions) {
  const [notifications, setNotifications] = useState<CampusNotification[]>([]);
  const [activeToast, setActiveToast] = useState<CampusNotification | null>(null);
  const hasLoadedInitialRef = useRef(false);

  useEffect(() => {
    hasLoadedInitialRef.current = false;
    if (isDemoMode || !currentUser || !auth.currentUser?.emailVerified) {
      setNotifications([]);
      return;
    }
    return subscribeToRealtimeNotifications(
      currentUser,
      (realtimeNotifs) => {
        setNotifications((prev) => {
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
  }, [isDemoMode, currentUser]);

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
      if (!isDemoMode) {
        saveNotificationToFirestore(record).catch((err) =>
          reportError('saveNotificationToFirestore failed', err)
        );
      }
      const isForCurrentUser =
        record.recipientUid === currentUser?.id ||
        (record.recipientUid === 'admin' &&
          (currentUser?.isAdmin || currentUser?.role === 'security'));
      if (isForCurrentUser) {
        setNotifications((prev) => [record, ...prev]);
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
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    notifications.forEach((n) => {
      if (!n.read) {
        markNotificationAsReadInFirestore(n.id).catch((err) =>
          reportError('Mark notification read failed', err)
        );
      }
    });
  }, [notifications]);

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    markNotificationAsReadInFirestore(id).catch((err) =>
      reportError('Mark notification read failed', err)
    );
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
    setActiveToast(null);
  }, []);

  return {
    notifications,
    activeToast,
    dispatchNotification,
    dismissToast,
    markAllAsRead,
    markAsRead,
    clearNotifications,
  };
}
