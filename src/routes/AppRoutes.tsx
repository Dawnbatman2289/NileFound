/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Route views, status banners, dev persona bar, and lazy page rendering.
 */

import React, { lazy, Suspense } from 'react';
import { FeedView } from '../components/FeedView.tsx';
import { getAppTabTransitionClass } from '../utils/chat.ts';
import { useAppContext } from '../providers/AppContext.tsx';

const AdminPanel = lazy(() => import('../components/AdminPanel.tsx').then((m) => ({ default: m.AdminPanel })));
const LoginPage = lazy(() => import('../components/LoginPage.tsx').then((m) => ({ default: m.LoginPage })));

export const AppStatusBanners: React.FC = () => {
  const { authSession, handleResetAllDemoData } = useAppContext();

  return (
    <>
      {authSession.roleError && (
        <div
          role="alert"
          className="bg-[#FDF2F2] dark:bg-[#2B0E0E] border-b border-[#F87171]/50 text-[#9B1C1C] dark:text-[#F87171] px-4 py-2.5 text-sm flex flex-wrap items-center justify-between gap-3"
        >
          <span>{authSession.roleError}</span>
          <button
            type="button"
            onClick={authSession.retryRoleCheck}
            className="min-h-[36px] px-3 rounded-[8px] border border-[#F87171]/50 bg-white dark:bg-[#1E1C18] text-xs font-semibold cursor-pointer"
          >
            Retry role check
          </button>
        </div>
      )}

      {authSession.logoutNotice && (
        <div
          role="status"
          className="bg-[#FEF7E9] dark:bg-[#2B210A] border-b border-[#E8A317]/40 text-[#7A5000] dark:text-[#F9CF7C] px-4 py-2.5 text-sm"
        >
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
            <button
              type="button"
              onClick={handleResetAllDemoData}
              className="bg-white dark:bg-[#28241F] hover:bg-[#F5EFE4] dark:hover:bg-[#332E27] text-[#1F1B16] dark:text-[#F5F1EA] px-3 py-1.5 min-h-[44px] rounded-[10px] text-xs font-medium border border-[#857C70] dark:border-[#787065] transition-colors cursor-pointer btn-campus"
            >
              Reset Demo
            </button>
            <button
              type="button"
              onClick={authSession.handleExitSimulation}
              className="bg-[#0F6E6E] hover:bg-[#0C5656] text-white px-3.5 py-1.5 min-h-[44px] rounded-[10px] text-xs font-semibold transition-all cursor-pointer shadow-xs btn-campus"
            >
              Exit Test Mode
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export const AppRoutes: React.FC = () => {
  const {
    activeTab,
    prevTab,
    setActiveTab,
    lowDataMode,
    unreadChatClaimIds,
    authSession,
    itemsFeed,
    claimsState,
    openReportModal,
    handleClaimItem,
    handleFoundMatch,
    handleFetchHandoverContact,
    openClaimChat,
    navigateToLogin,
    handleAppLogout,
  } = useAppContext();

  return (
    <>
      <main className="flex-1 max-w-7xl w-full min-w-0 mx-auto p-4 sm:p-6 lg:p-8 pb-24 sm:pb-6 overflow-x-clip">
        {authSession.initializing ? (
          <div role="status" aria-live="polite" className="min-h-[45vh] flex flex-col items-center justify-center gap-3 text-center">
            <div className="w-8 h-8 rounded-full border-2 border-[#C4BBAF] dark:border-[#3E3931] border-t-[#0F6E6E] dark:border-t-[#199595] animate-spin" />
            <p className="text-sm text-[#4A443C] dark:text-[#CEC7BB]">Checking campus sign-in…</p>
          </div>
        ) : (
          <div key={activeTab} className={getAppTabTransitionClass(prevTab, activeTab)}>
            {activeTab === 'feed' && (
              <FeedView
                items={itemsFeed.mergedItems}
                claims={claimsState.claims}
                lowDataMode={lowDataMode}
                itemsError={itemsFeed.itemsError}
                onRetryLoadItems={itemsFeed.retryLoadItems}
                onClaimItem={handleClaimItem}
                onOpenReportModal={() => openReportModal(null)}
                onFoundMatch={handleFoundMatch}
                onFetchHandoverContact={handleFetchHandoverContact}
                onFetchFullPhoto={itemsFeed.handleFetchFullPhoto}
                onFetchClaimPrivateDetails={claimsState.handleFetchClaimPrivateDetails}
                onApproveClaim={claimsState.handleApproveClaim}
                onRejectClaim={claimsState.handleRejectClaim}
                onUpdateItemStatus={itemsFeed.handleUpdateItemStatus}
                onOpenClaimChat={openClaimChat}
                unreadChatClaimIds={unreadChatClaimIds}
                currentUser={authSession.currentUser}
                isDemoMode={authSession.isDemoMode}
                onNavigateToLogin={navigateToLogin}
                onLoadMore={itemsFeed.handleLoadMoreItems}
                onLoadAll={itemsFeed.handleLoadAllItems}
                hasMoreItems={itemsFeed.hasMoreItems}
                isLoadingMoreItems={itemsFeed.isLoadingMoreItems}
              />
            )}

            {activeTab === 'admin' && (
              <Suspense fallback={<div className="p-6 text-sm text-[#4A443C] dark:text-[#CEC7BB]">Loading operations desk…</div>}>
                <AdminPanel
                  currentUser={authSession.currentUser}
                  items={itemsFeed.mergedItems}
                  claims={claimsState.claims}
                  isDemoMode={authSession.isDemoMode}
                  lowDataMode={lowDataMode}
                  hasMoreItems={itemsFeed.hasMoreItems}
                  claimsError={claimsState.claimsError}
                  onRetryClaims={claimsState.retryClaims}
                  hasMoreClaims={claimsState.hasMoreClaims}
                  isLoadingMoreClaims={claimsState.isLoadingMoreClaims}
                  onLoadMoreClaims={claimsState.handleLoadMoreClaims}
                  onFetchClaimPrivateDetails={claimsState.handleFetchClaimPrivateDetails}
                  onFetchFullPhoto={itemsFeed.handleFetchFullPhoto}
                  onLoadAll={itemsFeed.handleLoadAllItems}
                  onUpdateItemStatus={itemsFeed.handleUpdateItemStatus}
                  onConfirmCustody={itemsFeed.handleConfirmCustody}
                  onDeleteItem={itemsFeed.handleDeleteItem}
                  onApproveClaim={claimsState.handleApproveClaim}
                  onRejectClaim={claimsState.handleRejectClaim}
                  onExpireOldItems={itemsFeed.handleExpireOldItems}
                  onOpenClaimChat={openClaimChat}
                  onOpenAddFoundItem={() =>
                    openReportModal({ type: 'found', holdingLocation: 'security_main_gate', location: 'Main Campus Gate' })
                  }
                  unreadChatClaimIds={unreadChatClaimIds}
                  onNavigateToLogin={navigateToLogin}
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
                    if (import.meta.env.DEV && user.id.startsWith('demo-') && authSession.isSimulating) {
                      return authSession.handleSwitchPersona(user);
                    }
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

      {activeTab === 'feed' && (
        <button
          type="button"
          onClick={() => openReportModal(null)}
          className="sm:hidden fixed right-4 bottom-4 z-40 min-h-12 px-5 bg-[#0F6E6E] hover:bg-[#0C5656] text-white rounded-[10px] shadow-lg font-semibold text-sm cursor-pointer btn-campus"
          aria-label="Report an item"
        >
          + Report
        </button>
      )}
    </>
  );
};
