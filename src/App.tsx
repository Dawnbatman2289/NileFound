/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * NileFound - Root application shell and state wiring.
 */

import { lazy, Suspense, useState, useEffect, useRef, useCallback } from 'react';
import { motion, MotionConfig } from 'motion/react';
import { Navbar, AppTab } from './components/Navbar.tsx';
import { FeedView } from './components/FeedView.tsx';
import { NotificationToast } from './components/NotificationToast.tsx';
import { ErrorBoundary, reportError } from './components/ErrorBoundary.tsx';
import { CampusItem, ClaimRecord } from './types/index.ts';
import { useAuthSession } from './hooks/useAuthSession.ts';
import { useNotifications } from './hooks/useNotifications.ts';
import { useItemsFeed } from './hooks/useItemsFeed.ts';
import { useClaims } from './hooks/useClaims.ts';
import { fetchApprovedHandoverContact } from './services/firestoreService.ts';
import { safeSetStorage } from './utils/storage.ts';

const AdminPanel = lazy(() => import('./components/AdminPanel.tsx').then((m) => ({ default: m.AdminPanel })));
const PrivacyModal = lazy(() => import('./components/PrivacyModal.tsx').then((m) => ({ default: m.PrivacyModal })));
const ReportModal = lazy(() => import('./components/ReportModal.tsx').then((m) => ({ default: m.ReportModal })));
const ClaimModal = lazy(() => import('./components/ClaimModal.tsx').then((m) => ({ default: m.ClaimModal })));
const LoginPage = lazy(() => import('./components/LoginPage.tsx').then((m) => ({ default: m.LoginPage })));

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('feed');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [lowDataMode, setLowDataMode] = useState(() => {
    try { return localStorage.getItem('nilefound_low_data') === 'true'; } catch { return false; }
  });
  const [isDarkMode, setIsDarkMode] = useState(() => {
    try { return localStorage.getItem('nilefound_theme') === 'dark'; } catch { return false; }
  });
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportPrefill, setReportPrefill] = useState<Partial<Pick<CampusItem, 'type' | 'title' | 'category' | 'location'>> | null>(null);
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);
  const [selectedItemForClaim, setSelectedItemForClaim] = useState<CampusItem | null>(null);
  const [savedDraftCount, setSavedDraftCount] = useState(0);

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
    items: itemsFeed.items,
    setItems: itemsFeed.setItems,
    setOlderItems: itemsFeed.setOlderItems,
    dispatchNotification: notifState.dispatchNotification,
  });

  useEffect(() => {
    sessionHooksRef.current = {
      seedDemo: (demoItems, demoClaims) => { itemsFeed.setItems(demoItems); claimsState.setClaims(demoClaims); },
      clearAll: () => { itemsFeed.clearItems(); claimsState.clearClaims(); notifState.clearNotifications(); setSavedDraftCount(0); },
      removeItemClaims: claimsState.removeClaimsForItem,
    };
  }, [itemsFeed, claimsState, notifState]);

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

  const handleSelectNotificationItem = (itemId?: string, type?: string) => {
    if (type === 'admin_review' && authSession.isPrivileged) return setActiveTab('admin');
    if (!itemId) return;
    setActiveTab('feed');
    setTimeout(() => {
      const el = document.getElementById(`item-${itemId}`);
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-2', 'ring-[#0F6E6E]');
      setTimeout(() => el.classList.remove('ring-2', 'ring-[#0F6E6E]'), 3000);
    }, 150);
  };

  return (
    <ErrorBoundary>
      <MotionConfig reducedMotion="user">
        <div className="min-h-screen bg-[var(--color-paper)] text-[var(--color-ink)] flex flex-col font-sans selection:bg-[#0F6E6E] selection:text-white transition-colors duration-150">
          <Navbar
            activeTab={activeTab} setActiveTab={setActiveTab} isOnline={isOnline}
            lowDataMode={lowDataMode} setLowDataMode={setLowDataMode}
            isDemoMode={authSession.isDemoMode}
            setIsDemoMode={(v) => (v ? authSession.setIsDemoMode(true) : authSession.handleExitSimulation())}
            onOpenReportModal={() => { setReportPrefill(null); setIsReportModalOpen(true); }}
            savedDraftCount={savedDraftCount} currentUser={authSession.currentUser}
            pendingClaimsCount={claimsState.claims.filter((c) => c.status === 'pending').length}
            notifications={notifState.notifications}
            onMarkAllAsRead={notifState.markAllAsRead} onMarkAsRead={notifState.markAsRead}
            onSelectNotificationItem={handleSelectNotificationItem}
            isDarkMode={isDarkMode} onToggleDarkMode={() => setIsDarkMode((p) => !p)}
            onLogout={authSession.handleLogout}
          />

          {authSession.roleError && (
            <div role="alert" className="bg-[#FDF2F2] dark:bg-[#2B0E0E] border-b border-[#F87171]/50 text-[#9B1C1C] dark:text-[#F87171] px-4 py-2.5 text-sm flex flex-wrap items-center justify-between gap-3">
              <span>{authSession.roleError}</span>
              <button type="button" onClick={authSession.retryRoleCheck} className="min-h-[36px] px-3 rounded-[8px] border border-[#F87171]/50 bg-white dark:bg-[#1E1C18] text-xs font-semibold cursor-pointer">
                Retry role check
              </button>
            </div>
          )}

          {authSession.canUsePersonaSimulation && authSession.isSimulating && (
            <div className="bg-[#FAF6EF] dark:bg-[#1E1C18] border-b border-[#C4BBAF] dark:border-[#3E3931] px-4 py-2.5 text-sm flex flex-wrap items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#E8A317]" />
                <span className="font-bold text-[#1F1B16] dark:text-[#F5F1EA]">Dev Simulation:</span>
                <span className="text-[#4A443C] dark:text-[#CEC7BB]">
                  Viewing as <strong className="text-[#0F6E6E] dark:text-[#199595] font-bold">{authSession.currentUser?.name}</strong> ({authSession.currentUser?.role})
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setActiveTab('admin')} className="bg-white dark:bg-[#28241F] hover:bg-[#F5EFE4] dark:hover:bg-[#332E27] text-[#1F1B16] dark:text-[#F5F1EA] px-3 py-1.5 min-h-[44px] rounded-[10px] text-sm font-medium border border-[#857C70] dark:border-[#787065] transition-colors cursor-pointer btn-campus">
                  Switch Persona
                </button>
                <button type="button" onClick={authSession.handleExitSimulation} className="bg-[#0F6E6E] hover:bg-[#0C5656] text-white px-3.5 py-1.5 min-h-[44px] rounded-[10px] text-sm font-semibold transition-all cursor-pointer shadow-xs btn-campus">
                  Return to Master Admin
                </button>
              </div>
            </div>
          )}

          <main className="flex-1 max-w-7xl w-full min-w-0 mx-auto p-4 sm:p-6 lg:p-8 pb-24 sm:pb-6 transition-opacity duration-200">
            <motion.div key={activeTab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18, ease: 'easeOut' }}>
              {activeTab === 'feed' && (
                <FeedView
                  items={itemsFeed.mergedItems} claims={claimsState.claims} lowDataMode={lowDataMode}
                  itemsError={itemsFeed.itemsError} onRetryLoadItems={itemsFeed.retryLoadItems}
                  onClaimItem={(item) => (authSession.currentUser ? setSelectedItemForClaim(item) : setActiveTab('login'))}
                  onOpenReportModal={() => { setReportPrefill(null); setIsReportModalOpen(true); }}
                  onFoundMatch={(lostItem) => { setReportPrefill({ type: 'found', category: lostItem.category, location: lostItem.location, title: lostItem.title }); setIsReportModalOpen(true); }}
                  onFetchHandoverContact={(itemId) => (authSession.isDemoMode ? Promise.resolve({ authorName: 'Finder', authorEmail: 'finder@nileuniversity.edu.ng' }) : fetchApprovedHandoverContact(itemId))}
                  onFetchFullPhoto={itemsFeed.handleFetchFullPhoto}
                  onFetchClaimPrivateDetails={claimsState.handleFetchClaimPrivateDetails}
                  onApproveClaim={claimsState.handleApproveClaim} onRejectClaim={claimsState.handleRejectClaim}
                  onUpdateItemStatus={itemsFeed.handleUpdateItemStatus}
                  currentUser={authSession.currentUser} isDemoMode={authSession.isDemoMode}
                  onNavigateToLogin={() => setActiveTab('login')}
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
                    onUpdateItemStatus={itemsFeed.handleUpdateItemStatus} onDeleteItem={itemsFeed.handleDeleteItem}
                    onApproveClaim={claimsState.handleApproveClaim} onRejectClaim={claimsState.handleRejectClaim}
                    onExpireOldItems={itemsFeed.handleExpireOldItems} onNavigateToLogin={() => setActiveTab('login')}
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
                    onLogout={authSession.handleLogout} onNavigateToFeed={() => setActiveTab('feed')}
                    isDemoMode={authSession.isDemoMode}
                  />
                </Suspense>
              )}
            </motion.div>
          </main>

          {isReportModalOpen && (
            <Suspense fallback={null}>
              <ReportModal isOpen={isReportModalOpen} onClose={() => { setIsReportModalOpen(false); setReportPrefill(null); }} onSubmitItem={itemsFeed.handleAddItem} onDraftSaved={() => setSavedDraftCount(1)} currentUser={authSession.currentUser} initialPrefill={reportPrefill} onOpenLogin={() => { setIsReportModalOpen(false); setActiveTab('login'); }} />
            </Suspense>
          )}
          {selectedItemForClaim && (
            <Suspense fallback={null}>
              <ClaimModal item={selectedItemForClaim} onClose={() => setSelectedItemForClaim(null)} onSuccessClaim={claimsState.handleClaimSuccess} />
            </Suspense>
          )}
          <NotificationToast notification={notifState.activeToast} onDismiss={notifState.dismissToast} onView={(notif) => (notif.linkTab === 'admin' && authSession.isPrivileged ? setActiveTab('admin') : handleSelectNotificationItem(notif.itemId, notif.type))} />
          {isPrivacyModalOpen && (
            <Suspense fallback={null}><PrivacyModal isOpen={isPrivacyModalOpen} onClose={() => setIsPrivacyModalOpen(false)} /></Suspense>
          )}
          {activeTab === 'feed' && (
            <button type="button" onClick={() => setIsReportModalOpen(true)} className="sm:hidden fixed right-4 bottom-4 z-40 min-h-12 px-5 bg-[#0F6E6E] hover:bg-[#0C5656] text-white rounded-[10px] shadow-lg font-semibold text-sm cursor-pointer btn-campus" aria-label="Report an item">
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
      </MotionConfig>
    </ErrorBoundary>
  );
}
