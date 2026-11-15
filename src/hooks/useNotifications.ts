import { useState, useEffect, useRef, useCallback } from 'react';
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

  const userId = currentUser?.id;
  const userRole = currentUser?.role;
  const userIsAdmin = currentUser?.isAdmin;

  useEffect(() => {
    hasLoadedInitialRef.current = false;
    if (isDemoMode || !userId || !auth.currentUser?.emailVerified) {
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
  }, [isDemoMode, userId, userRole, userIsAdmin]);

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
        (record.recipientUid === 'admin' && canUserModerate(currentUser));
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
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
    if (unreadIds.length === 0) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    markNotificationsReadInFirestore(unreadIds).catch((err) =>
      reportError('Mark notifications read failed', err)
    );
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
