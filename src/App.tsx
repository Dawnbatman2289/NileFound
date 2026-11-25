/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * NileFound - Root application shell and state wiring.
 */

import { lazy, Suspense, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Navbar, AppTab } from './components/Navbar.tsx';
import { FeedView } from './components/FeedView.tsx';
import { NotificationToast } from './components/NotificationToast.tsx';
import { ErrorBoundary, reportError } from './components/ErrorBoundary.tsx';
import { CampusItem, ClaimRecord, ReportPrefill } from './types/index.ts';
import { useAuthSession } from './hooks/useAuthSession.ts';
import { useNotifications } from './hooks/useNotifications.ts';
import { useItemsFeed } from './hooks/useItemsFeed.ts';
import { useClaims } from './hooks/useClaims.ts';
import { safeSetStorage } from './utils/storage.ts';
import {
  getAppTabTransitionClass,
  getUnreadChatClaimIds,
  resolveChatNotificationRecipient,
  shouldSendChatNotification,
} from './utils/chat.ts';

const AdminPanel = lazy(() => import('./components/AdminPanel.tsx').then((m) => ({ default: m.AdminPanel })));
const PrivacyModal = lazy(() => import('./components/PrivacyModal.tsx').then((m) => ({ default: m.PrivacyModal })));
const ReportModal = lazy(() => import('./components/ReportModal.tsx').then((m) => ({ default: m.ReportModal })));
const ClaimModal = lazy(() => import('./components/ClaimModal.tsx').then((m) => ({ default: m.ClaimModal })));
const ClaimChatModal = lazy(() => import('./components/ClaimChatModal.tsx').then((m) => ({ default: m.ClaimChatModal })));
const LoginPage = lazy(() => import('./components/LoginPage.tsx').then((m) => ({ default: m.LoginPage })));

export default function App() {
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
    try { return localStorage.getItem('nilefound_low_data') === 'true'; } catch (err) { reportError('Read low-data preference failed', err); return false; }
  });
  const [isDarkMode, setIsDarkMode] = useState(() => {
    try { return localStorage.getItem('nilefound_theme') === 'dark'; } catch (err) { reportError('Read theme preference failed', err); return false; }
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
  const { clearNotifications } = notifState;

  useEffect(() => {
    sessionHooksRef.current = {
      seedDemo: (demoItems, demoClaims) => { setFeedItems(demoItems); setClaims(demoClaims); },
      clearAll: () => { clearFeedItems(); clearClaims(); clearNotifications(); setSavedDraftCount(0); },
      removeItemClaims: removeClaimsForItem,
    };
  }, [setFeedItems, setClaims, clearFeedItems, clearClaims, clearNotifications, removeClaimsForItem]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
    safeSetStorage('nilefound_theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  useEffect(() => { safeSetStorage('nilefound_low_data', String(lowDataMode)); }, [lowDataMode]);

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
    return () => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline); };
  }, []);

  const unreadChatClaimIds = useMemo(
    () =>
      getUnreadChatClaimIds(
        notifState.notifications,
        authSession.currentUser?.id,
        authSession.isPrivileged
      ),
    [notifState.notifications, authSession.currentUser?.id, authSession.isPrivileged]
  );

  const pendingClaimsCount = useMemo(
    () => claimsState.claims.filter((c) => c.status === 'pending').length,
    [claimsState.claims]
  );

  const activeChatClaimId = activeChatTarget?.claim.id;
  const markChatRead = notifState.markClaimChatNotificationsRead;
  useEffect(() => {
    if (activeChatClaimId) {
      markChatRead(activeChatClaimId);
    }
  }, [activeChatClaimId, markChatRead]);

  const handleResetAllDemoData = useCallback(async () => {
    lastChatNotifSentRef.current = {};
    clearNotifications();
    await import('./components/ClaimChatModal.tsx')
      .then((m) => m.resetDemoChatThreads())
      .catch((err) => reportError('Reset chat threads failed', err));
    await authSession.handleResetDemoData();
  }, [clearNotifications, authSession]);

  const { handleLogout } = authSession;
  const handleAppLogout = useCallback(async () => {
    lastChatNotifSentRef.current = {};
    if (import.meta.env.DEV) {
      await import('./components/ClaimChatModal.tsx')
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
    if (type === 'claim_received' && authSession.isPrivileged) return setActiveTab('admin');
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

  const handleOpenReportModal = useCallback(() => {
    setReportPrefill(null);
    setIsReportModalOpen(true);
  }, []);

  const handleClaimItem = useCallback(
    (item: CampusItem) => (authSession.currentUser ? setSelectedItemForClaim(item) : setActiveTab('login')),
    [authSession.currentUser, setActiveTab]
  );

  const handleFoundMatch = useCallback((lostItem: CampusItem) => {
    setReportPrefill({ type: 'found', category: lostItem.category, location: lostItem.location, title: lostItem.title });
    setIsReportModalOpen(true);
  }, []);

  const handleFetchHandoverContact = useCallback(
    (itemId: string) =>
      authSession.isDemoMode
        ? Promise.resolve({ authorName: 'Finder', authorEmail: 'finder@nileuniversity.edu.ng' })
        : import('./services/firestoreService.ts').then((m) => m.fetchApprovedHandoverContact(itemId)),
    [authSession.isDemoMode]
  );

  const handleOpenClaimChat = useCallback((claim: ClaimRecord, item?: CampusItem) => {
    setActiveChatTarget({ claim, item });
  }, []);

  const handleNavigateToLogin = useCallback(() => setActiveTab('login'), [setActiveTab]);
  const handleToggleDarkMode = useCallback(() => setIsDarkMode((p) => !p), []);
  const { setIsDemoMode, handleExitSimulation } = authSession;
  const handleSetDemoMode = useCallback(
    (v: boolean) => (v ? setIsDemoMode(true) : handleExitSimulation()),
    [setIsDemoMode, handleExitSimulation]
  );

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-[var(--color-paper)] text-[var(--color-ink)] flex flex-col font-sans selection:bg-[#0F6E6E] selection:text-white transition-colors duration-150">
          <Navbar
            activeTab={activeTab} setActiveTab={setActiveTab} isOnline={isOnline}
            lowDataMode={lowDataMode} setLowDataMode={setLowDataMode}
            isDemoMode={authSession.isDemoMode}
            setIsDemoMode={handleSetDemoMode}
            onOpenReportModal={handleOpenReportModal}
            savedDraftCount={savedDraftCount} currentUser={authSession.currentUser}
            pendingClaimsCount={pendingClaimsCount}
            notifications={notifState.notifications}
            onMarkAllAsRead={notifState.markAllAsRead} onMarkAsRead={notifState.markAsRead}
            onSelectNotificationItem={handleSelectNotificationItem}
            isDarkMode={isDarkMode} onToggleDarkMode={handleToggleDarkMode}
            onLogout={handleAppLogout}
          />

          {authSession.roleError && (
            <div role="alert" className="bg-[#FDF2F2] dark:bg-[#2B0E0E] border-b border-[#F87171]/50 text-[#9B1C1C] dark:text-[#F87171] px-4 py-2.5 text-sm flex flex-wrap items-center justify-between gap-3">
              <span>{authSession.roleError}</span>
              <button type="button" onClick={authSession.retryRoleCheck} className="min-h-[36px] px-3 rounded-[8px] border border-[#F87171]/50 bg-white dark:bg-[#1E1C18] text-xs font-semibold cursor-pointer">
                Retry role check
              </button>
            </div>
          )}

          {authSession.logoutNotice && (
            <div role="status" className="bg-[#FEF7E9] dark:bg-[#2B210A] border-b border-[#E8A317]/40 text-[#7A5000] dark:text-[#F9CF7C] px-4 py-2.5 text-sm">
              {authSession.logoutNotice}
            </div>
          )}

          {import.meta.env.DEV && authSession.canUsePersonaSimulation && authSession.isSimulating && (
            <div className="bg-[#FAF6EF] dark:bg-[#1E1C18] border-b border-[#C4BBAF] dark:border-[#3E3931] px-4 py-2.5 text-sm flex flex-wrap items-center justify-between gap-2.5 shadow-xs">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 font-bold text-[#1F1B16] dark:text-[#F5F1EA]">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#E8A317]" />
                  Test Mode:
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {authSession.devPersonas.map((persona) => {
                    const isCurrent = authSession.currentUser?.id === persona.user.id;
                    return (
                      <button
                        key={persona.user.id}
                        type="button"
                        onClick={() => authSession.handleSwitchPersona(persona.user)}
                        aria-pressed={isCurrent}
                        className={`min-h-[44px] px-3 py-1.5 rounded-[10px] text-xs font-semibold border transition-colors cursor-pointer ${
                          isCurrent
                            ? 'bg-[#0F6E6E] text-white border-[#0F6E6E]'
                            : 'bg-white dark:bg-[#28241F] text-[#1F1B16] dark:text-[#F5F1EA] border-[#C4BBAF] dark:border-[#3E3931] hover:border-[#0F6E6E]'
                        }`}
                      >
                        {persona.user.name.replace(/^Dr\.\s+/i, '').split(' ')[0]} · {persona.badge}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={handleResetAllDemoData} className="bg-white dark:bg-[#28241F] hover:bg-[#F5EFE4] dark:hover:bg-[#332E27] text-[#1F1B16] dark:text-[#F5F1EA] px-3 py-1.5 min-h-[44px] rounded-[10px] text-xs font-medium border border-[#857C70] dark:border-[#787065] transition-colors cursor-pointer btn-campus">
                  Reset Demo
                </button>
                <button type="button" onClick={authSession.handleExitSimulation} className="bg-[#0F6E6E] hover:bg-[#0C5656] text-white px-3.5 py-1.5 min-h-[44px] rounded-[10px] text-xs font-semibold transition-all cursor-pointer shadow-xs btn-campus">
                  Exit Test Mode
                </button>
              </div>
            </div>
          )}

          <main className="flex-1 max-w-7xl w-full min-w-0 mx-auto p-4 sm:p-6 lg:p-8 pb-24 sm:pb-6 overflow-x-clip">
            {authSession.initializing ? (
              <div role="status" aria-live="polite" className="min-h-[45vh] flex flex-col items-center justify-center gap-3 text-center">
                <div className="w-8 h-8 rounded-full border-2 border-[#C4BBAF] dark:border-[#3E3931] border-t-[#0F6E6E] dark:border-t-[#199595] animate-spin" />
                <p className="text-sm text-[#4A443C] dark:text-[#CEC7BB]">Checking campus sign-in…</p>
              </div>
            ) : (
            <div key={activeTab} className={getAppTabTransitionClass(prevTabRef.current, activeTab)}>
              {activeTab === 'feed' && (
                <FeedView
                  items={itemsFeed.mergedItems} claims={claimsState.claims} lowDataMode={lowDataMode}
                  itemsError={itemsFeed.itemsError} onRetryLoadItems={itemsFeed.retryLoadItems}
                  onClaimItem={handleClaimItem}
                  onOpenReportModal={handleOpenReportModal}
                  onFoundMatch={handleFoundMatch}
                  onFetchHandoverContact={handleFetchHandoverContact}
                  onFetchFullPhoto={itemsFeed.handleFetchFullPhoto}
                  onFetchClaimPrivateDetails={claimsState.handleFetchClaimPrivateDetails}
                  onApproveClaim={claimsState.handleApproveClaim} onRejectClaim={claimsState.handleRejectClaim}
                  onUpdateItemStatus={itemsFeed.handleUpdateItemStatus}
                  onOpenClaimChat={handleOpenClaimChat}
                  unreadChatClaimIds={unreadChatClaimIds}
                  currentUser={authSession.currentUser} isDemoMode={authSession.isDemoMode}
                  onNavigateToLogin={handleNavigateToLogin}
                  onLoadMore={itemsFeed.handleLoadMoreItems} onLoadAll={itemsFeed.handleLoadAllItems}
                  hasMoreItems={itemsFeed.hasMoreItems} isLoadingMoreItems={itemsFeed.isLoadingMoreItems}
                />
              )}

              {activeTab === 'admin' && (
                <Suspense fallback={<div className="p-6 text-sm text-[#4A443C] dark:text-[#CEC7BB]">Loading operations desk…</div>}>
                  <AdminPanel
                    currentUser={authSession.currentUser} items={itemsFeed.mergedItems} claims={claimsState.claims}
                    isDemoMode={authSession.isDemoMode} lowDataMode={lowDataMode} hasMoreItems={itemsFeed.hasMoreItems}
                    claimsError={claimsState.claimsError} onRetryClaims={claimsState.retryClaims}
                    hasMoreClaims={claimsState.hasMoreClaims} isLoadingMoreClaims={claimsState.isLoadingMoreClaims}
                    onLoadMoreClaims={claimsState.handleLoadMoreClaims}
                    onFetchClaimPrivateDetails={claimsState.handleFetchClaimPrivateDetails}
                    onFetchFullPhoto={itemsFeed.handleFetchFullPhoto} onLoadAll={itemsFeed.handleLoadAllItems}
                    onUpdateItemStatus={itemsFeed.handleUpdateItemStatus} onConfirmCustody={itemsFeed.handleConfirmCustody} onDeleteItem={itemsFeed.handleDeleteItem}
                    onApproveClaim={claimsState.handleApproveClaim} onRejectClaim={claimsState.handleRejectClaim}
                    onExpireOldItems={itemsFeed.handleExpireOldItems}
                    onOpenClaimChat={handleOpenClaimChat}
                    onOpenAddFoundItem={() => {
                      setReportPrefill({ type: 'found', holdingLocation: 'security_main_gate', location: 'Main Campus Gate' });
                      setIsReportModalOpen(true);
                    }}
                    unreadChatClaimIds={unreadChatClaimIds}
                    onNavigateToLogin={handleNavigateToLogin}
                    onSwitchPersona={authSession.canUsePersonaSimulation ? authSession.handleSwitchPersona : undefined}
                    devPersonas={authSession.devPersonas}
                  />
                </Suspense>
              )}

              {activeTab === 'login' && (
                <Suspense fallback={<div className="p-6 text-sm text-[#4A443C] dark:text-[#CEC7BB]">Loading sign-in…</div>}>
                  <LoginPage
                    currentUser={authSession.currentUser}
                    onLogin={(user) => {
                      if (import.meta.env.DEV && user.id.startsWith('demo-') && authSession.isSimulating) return authSession.handleSwitchPersona(user);
                      authSession.setCurrentUser(user);
                      setActiveTab(user.role === 'admin' || user.role === 'security' ? 'admin' : 'feed');
                    }}
                    onLogout={handleAppLogout}
                    onNavigateToFeed={() => setActiveTab('feed')}
                    sessionAuthError={authSession.authError}
                    onClearSessionAuthError={authSession.clearAuthError}
                    devPersonas={authSession.devPersonas}
                    onSwitchDemoPersona={import.meta.env.DEV ? authSession.handleSwitchPersona : undefined}
                  />
                </Suspense>
              )}
            </div>
            )}
          </main>

          {isReportModalOpen && (
            <Suspense fallback={null}>
              <ReportModal isOpen={isReportModalOpen} onClose={() => { setIsReportModalOpen(false); setReportPrefill(null); }} onSubmitItem={itemsFeed.handleAddItem} onDraftSaved={() => setSavedDraftCount(1)} onDraftCleared={() => setSavedDraftCount(0)} currentUser={authSession.currentUser} initialPrefill={reportPrefill} onOpenLogin={() => { setIsReportModalOpen(false); setActiveTab('login'); }} />
            </Suspense>
          )}
          {selectedItemForClaim && (
            <Suspense fallback={null}>
              <ClaimModal
                item={selectedItemForClaim}
                currentUser={authSession.currentUser}
                existingClaim={claimsState.claims.find((c) => c.itemId === selectedItemForClaim.id && c.claimantId === authSession.currentUser?.id)}
                onClose={() => setSelectedItemForClaim(null)}
                onSuccessClaim={claimsState.handleClaimSuccess}
                onResubmitClaim={claimsState.handleResubmitClaim}
              />
            </Suspense>
          )}
          {activeChatTarget && (
            <Suspense fallback={null}>
              <ClaimChatModal
                claim={claimsState.claims.find((c) => c.id === activeChatTarget.claim.id) || activeChatTarget.claim}
                item={itemsFeed.mergedItems.find((i) => i.id === activeChatTarget.claim.itemId) || activeChatTarget.item}
                currentUser={authSession.currentUser}
                isDemoMode={authSession.isDemoMode}
                onMessageSent={(claim, item) => {
                  const senderId = authSession.currentUser?.id;
                  if (!senderId) return;
                  const recipientUid = resolveChatNotificationRecipient(claim, senderId, item?.holdingLocation);
                  if (!recipientUid) return;
                  const key = `${claim.id}:${senderId}:${recipientUid}`;
                  const now = Date.now();
                  if (!shouldSendChatNotification(lastChatNotifSentRef.current[key], now)) return;
                  lastChatNotifSentRef.current[key] = now;
                  notifState.dispatchNotification({
                    recipientUid,
                    fromUid: senderId,
                    type: 'chat_message',
                    title: 'New handover message',
                    message: 'You have a new message in your item handover chat.',
                    itemId: claim.itemId,
                    claimId: claim.id,
                  });
                }}
                onClose={() => setActiveChatTarget(null)}
              />
            </Suspense>
          )}
          <NotificationToast
            notification={notifState.activeToast}
            onDismiss={notifState.dismissToast}
            onView={(notif) => {
              if (notif.type === 'chat_message' && notif.claimId) {
                handleSelectNotificationItem(notif.itemId, notif.type, notif.claimId);
                return;
              }
              if (notif.linkTab === 'admin' && authSession.isPrivileged) {
                setActiveTab('admin');
                return;
              }
              handleSelectNotificationItem(notif.itemId, notif.type, notif.claimId);
            }}
          />
          {isPrivacyModalOpen && (
            <Suspense fallback={null}><PrivacyModal isOpen={isPrivacyModalOpen} onClose={() => setIsPrivacyModalOpen(false)} /></Suspense>
          )}
          {activeTab === 'feed' && (
            <button type="button" onClick={() => { setReportPrefill(null); setIsReportModalOpen(true); }} className="sm:hidden fixed right-4 bottom-4 z-40 min-h-12 px-5 bg-[#0F6E6E] hover:bg-[#0C5656] text-white rounded-[10px] shadow-lg font-semibold text-sm cursor-pointer btn-campus" aria-label="Report an item">
              + Report
            </button>
          )}

          <footer className="bg-transparent border-t border-[#C4BBAF] dark:border-[#3E3931] mt-16 py-8 px-4 text-sm text-[#5C554C] dark:text-[#A8A095]">
            <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
              <div className="flex items-center gap-2">
                <span className="font-serif font-bold text-sm text-[#1F1B16] dark:text-[#F5F1EA] tracking-tight">NileFound</span>
                <span aria-hidden="true">•</span>
                <span>Nile University of Nigeria, Abuja</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <button type="button" onClick={() => setIsPrivacyModalOpen(true)} className="text-[#0F6E6E] dark:text-[#199595] hover:underline font-medium min-h-[44px] cursor-pointer">
                  Built with privacy in mind
                </button>
                <span aria-hidden="true">•</span>
                <span>Student notice board</span>
              </div>
            </div>
          </footer>
      </div>
    </ErrorBoundary>
  );
}
