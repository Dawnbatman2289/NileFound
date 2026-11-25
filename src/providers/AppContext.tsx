/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Application state provider coordinating auth session, realtime feed, claims,
 * notifications, offline/low-data preferences, and modal orchestration.
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import type { AppTab } from '../components/Navbar.tsx';
import { reportError } from '../components/ErrorBoundary.tsx';
import { CampusItem, ClaimRecord, ReportPrefill } from '../types/index.ts';
import { useAuthSession } from '../hooks/useAuthSession.ts';
import { useNotifications } from '../hooks/useNotifications.ts';
import { useItemsFeed } from '../hooks/useItemsFeed.ts';
import { useClaims } from '../hooks/useClaims.ts';
import { safeSetStorage } from '../utils/storage.ts';
import {
  getUnreadChatClaimIds,
  resolveChatNotificationRecipient,
  shouldSendChatNotification,
} from '../utils/chat.ts';

export interface AppContextValue {
  activeTab: AppTab;
  prevTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
  isOnline: boolean;
  lowDataMode: boolean;
  setLowDataMode: React.Dispatch<React.SetStateAction<boolean>>;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  savedDraftCount: number;
  markDraftSaved: () => void;
  markDraftCleared: () => void;
  isReportModalOpen: boolean;
  reportPrefill: ReportPrefill | null;
  openReportModal: (prefill?: ReportPrefill | null) => void;
  closeReportModal: () => void;
  isPrivacyModalOpen: boolean;
  setIsPrivacyModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  selectedItemForClaim: CampusItem | null;
  setSelectedItemForClaim: React.Dispatch<React.SetStateAction<CampusItem | null>>;
  activeChatTarget: { claim: ClaimRecord; item?: CampusItem } | null;
  closeChatModal: () => void;
  openClaimChat: (claim: ClaimRecord, item?: CampusItem) => void;
  unreadChatClaimIds: Set<string>;
  pendingClaimsCount: number;
  authSession: ReturnType<typeof useAuthSession>;
  notifState: ReturnType<typeof useNotifications>;
  itemsFeed: ReturnType<typeof useItemsFeed>;
  claimsState: ReturnType<typeof useClaims>;
  handleSetDemoMode: (enabled: boolean) => void;
  handleResetAllDemoData: () => Promise<void>;
  handleAppLogout: () => Promise<void>;
  handleSelectNotificationItem: (itemId?: string, type?: string, claimId?: string) => void;
  handleClaimItem: (item: CampusItem) => void;
  handleFoundMatch: (lostItem: CampusItem) => void;
  handleFetchHandoverContact: (itemId: string) => Promise<{ authorName?: string; authorEmail?: string } | null>;
  handleChatMessageSent: (claim: ClaimRecord, item?: CampusItem) => void;
  navigateToLogin: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeTab, setActiveTabState] = useState<AppTab>('feed');
  const prevTabRef = useRef<AppTab>('feed');
  const setActiveTab = useCallback((nextTab: AppTab) => {
    setActiveTabState((curr) => {
      prevTabRef.current = curr;
      return nextTab;
    });
  }, []);

  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [lowDataMode, setLowDataMode] = useState(() => {
    try {
      return localStorage.getItem('nilefound_low_data') === 'true';
    } catch (err) {
      reportError('Read low-data preference failed', err);
      return false;
    }
  });
  const [isDarkMode, setIsDarkMode] = useState(() => {
    try {
      return localStorage.getItem('nilefound_theme') === 'dark';
    } catch (err) {
      reportError('Read theme preference failed', err);
      return false;
    }
  });
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportPrefill, setReportPrefill] = useState<ReportPrefill | null>(null);
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);
  const [selectedItemForClaim, setSelectedItemForClaim] = useState<CampusItem | null>(null);
  const [activeChatTarget, setActiveChatTarget] = useState<{ claim: ClaimRecord; item?: CampusItem } | null>(null);
  const [savedDraftCount, setSavedDraftCount] = useState(0);
  const lastChatNotifSentRef = useRef<Record<string, number>>({});

  const sessionHooksRef = useRef<{
    seedDemo: (demoItems: CampusItem[], demoClaims: ClaimRecord[]) => void;
    clearAll: () => void;
    removeItemClaims: (itemId: string) => void;
  }>({ seedDemo: () => {}, clearAll: () => {}, removeItemClaims: () => {} });

  const authSession = useAuthSession({
    activeTab,
    setActiveTab,
    onSeedDemoData: useCallback((demoItems, demoClaims) => sessionHooksRef.current.seedDemo(demoItems, demoClaims), []),
    onResetSessionData: useCallback(() => sessionHooksRef.current.clearAll(), []),
  });

  const notifState = useNotifications({
    isDemoMode: authSession.isDemoMode,
    currentUser: authSession.currentUser,
    isPrivileged: authSession.isPrivileged,
  });

  const itemsFeed = useItemsFeed({
    isDemoMode: authSession.isDemoMode,
    currentUser: authSession.currentUser,
    lowDataMode,
    dispatchNotification: notifState.dispatchNotification,
    onItemSubmitted: useCallback(() => setSavedDraftCount(0), []),
    onItemDeleted: useCallback((itemId: string) => sessionHooksRef.current.removeItemClaims(itemId), []),
  });

  const claimsState = useClaims({
    isDemoMode: authSession.isDemoMode,
    currentUser: authSession.currentUser,
    items: itemsFeed.mergedItems,
    setItems: itemsFeed.setItems,
    setOlderItems: itemsFeed.setOlderItems,
    dispatchNotification: notifState.dispatchNotification,
  });

  const { setItems: setFeedItems, clearItems: clearFeedItems } = itemsFeed;
  const { setClaims, clearClaims, removeClaimsForItem } = claimsState;
  const { clearNotifications, dispatchNotification, markClaimChatNotificationsRead } = notifState;

  useEffect(() => {
    sessionHooksRef.current = {
      seedDemo: (demoItems, demoClaims) => {
        setFeedItems(demoItems);
        setClaims(demoClaims);
      },
      clearAll: () => {
        clearFeedItems();
        clearClaims();
        clearNotifications();
        setSavedDraftCount(0);
      },
      removeItemClaims: removeClaimsForItem,
    };
  }, [setFeedItems, setClaims, clearFeedItems, clearClaims, clearNotifications, removeClaimsForItem]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
    safeSetStorage('nilefound_theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  useEffect(() => {
    safeSetStorage('nilefound_low_data', String(lowDataMode));
  }, [lowDataMode]);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    try {
      if (localStorage.getItem('nilefound_report_draft_v1')) setSavedDraftCount(1);
    } catch (err) {
      reportError('Read draft count failed', err);
    }
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const unreadChatClaimIds = useMemo(
    () => getUnreadChatClaimIds(notifState.notifications, authSession.currentUser?.id, authSession.isPrivileged),
    [notifState.notifications, authSession.currentUser?.id, authSession.isPrivileged]
  );

  const pendingClaimsCount = useMemo(
    () => claimsState.claims.filter((c) => c.status === 'pending').length,
    [claimsState.claims]
  );

  const activeChatClaimId = activeChatTarget?.claim.id;
  useEffect(() => {
    if (activeChatClaimId) {
      markClaimChatNotificationsRead(activeChatClaimId);
    }
  }, [activeChatClaimId, markClaimChatNotificationsRead]);

  const handleResetAllDemoData = useCallback(async () => {
    lastChatNotifSentRef.current = {};
    clearNotifications();
    await import('../components/ClaimChatModal.tsx')
      .then((m) => m.resetDemoChatThreads())
      .catch((err) => reportError('Reset chat threads failed', err));
    await authSession.handleResetDemoData();
  }, [clearNotifications, authSession]);

  const { handleLogout, setIsDemoMode, handleExitSimulation } = authSession;
  const handleAppLogout = useCallback(async () => {
    lastChatNotifSentRef.current = {};
    if (import.meta.env.DEV) {
      await import('../components/ClaimChatModal.tsx')
        .then((m) => m.resetDemoChatThreads())
        .catch((err) => reportError('Reset demo chat threads on logout failed', err));
    }
    await handleLogout();
  }, [handleLogout]);

  const claimsListRef = useRef(claimsState.claims);
  const mergedItemsRef = useRef(itemsFeed.mergedItems);
  useEffect(() => {
    claimsListRef.current = claimsState.claims;
  }, [claimsState.claims]);
  useEffect(() => {
    mergedItemsRef.current = itemsFeed.mergedItems;
  }, [itemsFeed.mergedItems]);

  const handleSelectNotificationItem = useCallback((itemId?: string, type?: string, claimId?: string) => {
    if (type === 'chat_message' && claimId) {
      const targetClaim = claimsListRef.current.find((c) => c.id === claimId);
      if (targetClaim) {
        const targetItem = mergedItemsRef.current.find((i) => i.id === (itemId || targetClaim.itemId));
        setActiveChatTarget({ claim: targetClaim, item: targetItem });
        return;
      }
    }
    if (type === 'claim_received' && authSession.isPrivileged) {
      setActiveTab('admin');
      return;
    }
    if (!itemId) return;
    setActiveTab('feed');
    setTimeout(() => {
      const el = document.getElementById(`item-${itemId}`);
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-2', 'ring-[#0F6E6E]');
      setTimeout(() => el.classList.remove('ring-2', 'ring-[#0F6E6E]'), 3000);
    }, 150);
  }, [authSession.isPrivileged, setActiveTab]);

  const openReportModal = useCallback((prefill: ReportPrefill | null = null) => {
    setReportPrefill(prefill);
    setIsReportModalOpen(true);
  }, []);

  const closeReportModal = useCallback(() => {
    setIsReportModalOpen(false);
    setReportPrefill(null);
  }, []);

  const handleClaimItem = useCallback(
    (item: CampusItem) => {
      if (authSession.currentUser) setSelectedItemForClaim(item);
      else setActiveTab('login');
    },
    [authSession.currentUser, setActiveTab]
  );

  const handleFoundMatch = useCallback((lostItem: CampusItem) => {
    openReportModal({ type: 'found', category: lostItem.category, location: lostItem.location, title: lostItem.title });
  }, [openReportModal]);

  const handleFetchHandoverContact = useCallback(
    (itemId: string) =>
      authSession.isDemoMode
        ? Promise.resolve({ authorName: 'Finder', authorEmail: 'finder@nileuniversity.edu.ng' })
        : import('../services/firestoreService.ts').then((m) => m.fetchApprovedHandoverContact(itemId)),
    [authSession.isDemoMode]
  );

  const openClaimChat = useCallback((claim: ClaimRecord, item?: CampusItem) => {
    setActiveChatTarget({ claim, item });
  }, []);

  const closeChatModal = useCallback(() => setActiveChatTarget(null), []);
  const navigateToLogin = useCallback(() => setActiveTab('login'), [setActiveTab]);
  const toggleDarkMode = useCallback(() => setIsDarkMode((p) => !p), []);
  const markDraftSaved = useCallback(() => setSavedDraftCount(1), []);
  const markDraftCleared = useCallback(() => setSavedDraftCount(0), []);

  const handleSetDemoMode = useCallback(
    (enabled: boolean) => (enabled ? setIsDemoMode(true) : handleExitSimulation()),
    [setIsDemoMode, handleExitSimulation]
  );

  const handleChatMessageSent = useCallback(
    (claim: ClaimRecord, item?: CampusItem) => {
      const senderId = authSession.currentUser?.id;
      if (!senderId) return;
      const recipientUid = resolveChatNotificationRecipient(claim, senderId, item?.holdingLocation);
      if (!recipientUid) return;
      const key = `${claim.id}:${senderId}:${recipientUid}`;
      const now = Date.now();
      if (!shouldSendChatNotification(lastChatNotifSentRef.current[key], now)) return;
      lastChatNotifSentRef.current[key] = now;
      dispatchNotification({
        recipientUid,
        fromUid: senderId,
        type: 'chat_message',
        title: 'New handover message',
        message: 'You have a new message in your item handover chat.',
        itemId: claim.itemId,
        claimId: claim.id,
      });
    },
    [authSession.currentUser?.id, dispatchNotification]
  );

  const value = useMemo<AppContextValue>(
    () => ({
      activeTab,
      prevTab: prevTabRef.current,
      setActiveTab,
      isOnline,
      lowDataMode,
      setLowDataMode,
      isDarkMode,
      toggleDarkMode,
      savedDraftCount,
      markDraftSaved,
      markDraftCleared,
      isReportModalOpen,
      reportPrefill,
      openReportModal,
      closeReportModal,
      isPrivacyModalOpen,
      setIsPrivacyModalOpen,
      selectedItemForClaim,
      setSelectedItemForClaim,
      activeChatTarget,
      closeChatModal,
      openClaimChat,
      unreadChatClaimIds,
      pendingClaimsCount,
      authSession,
      notifState,
      itemsFeed,
      claimsState,
      handleSetDemoMode,
      handleResetAllDemoData,
      handleAppLogout,
      handleSelectNotificationItem,
      handleClaimItem,
      handleFoundMatch,
      handleFetchHandoverContact,
      handleChatMessageSent,
      navigateToLogin,
    }),
    [
      activeTab, setActiveTab, isOnline, lowDataMode, isDarkMode, toggleDarkMode,
      savedDraftCount, markDraftSaved, markDraftCleared, isReportModalOpen, reportPrefill,
      openReportModal, closeReportModal, isPrivacyModalOpen, selectedItemForClaim,
      activeChatTarget, closeChatModal, openClaimChat, unreadChatClaimIds, pendingClaimsCount,
      authSession, notifState, itemsFeed, claimsState, handleSetDemoMode,
      handleResetAllDemoData, handleAppLogout, handleSelectNotificationItem, handleClaimItem,
      handleFoundMatch, handleFetchHandoverContact, handleChatMessageSent, navigateToLogin,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('useAppContext must be used inside AppProvider.');
  }
  return ctx;
}
