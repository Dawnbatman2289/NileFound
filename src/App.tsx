/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * NileFound - Root application shell composing AppProvider, Navbar, routes, and modals.
 */

import React from 'react';
import { Navbar } from './components/Navbar.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { AppProvider, useAppContext } from './providers/AppContext.tsx';
import { AppStatusBanners, AppRoutes } from './routes/AppRoutes.tsx';
import { AppModals } from './routes/AppModals.tsx';

const AppShell: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    isOnline,
    lowDataMode,
    setLowDataMode,
    isDarkMode,
    toggleDarkMode,
    savedDraftCount,
    pendingClaimsCount,
    authSession,
    notifState,
    openReportModal,
    handleSetDemoMode,
    handleAppLogout,
    handleSelectNotificationItem,
    setIsPrivacyModalOpen,
  } = useAppContext();

  return (
    <div className="min-h-screen bg-[var(--color-paper)] text-[var(--color-ink)] flex flex-col font-sans selection:bg-[#0F6E6E] selection:text-white transition-colors duration-150">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isOnline={isOnline}
        lowDataMode={lowDataMode}
        setLowDataMode={setLowDataMode}
        isDemoMode={authSession.isDemoMode}
        setIsDemoMode={handleSetDemoMode}
        onOpenReportModal={() => openReportModal(null)}
        savedDraftCount={savedDraftCount}
        currentUser={authSession.currentUser}
        pendingClaimsCount={pendingClaimsCount}
        notifications={notifState.notifications}
        onMarkAllAsRead={notifState.markAllAsRead}
        onMarkAsRead={notifState.markAsRead}
        onSelectNotificationItem={handleSelectNotificationItem}
        isDarkMode={isDarkMode}
        onToggleDarkMode={toggleDarkMode}
        onLogout={handleAppLogout}
      />

      <AppStatusBanners />
      <AppRoutes />
      <AppModals />

      <footer className="bg-transparent border-t border-[#C4BBAF] dark:border-[#3E3931] mt-16 py-8 px-4 text-sm text-[#5C554C] dark:text-[#A8A095]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <div className="flex items-center gap-2">
            <span className="font-serif font-bold text-sm text-[#1F1B16] dark:text-[#F5F1EA] tracking-tight">NileFound</span>
            <span aria-hidden="true">•</span>
            <span>Nile University of Nigeria, Abuja</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <button
              type="button"
              onClick={() => setIsPrivacyModalOpen(true)}
              className="text-[#0F6E6E] dark:text-[#199595] hover:underline font-medium min-h-[44px] cursor-pointer"
            >
              Built with privacy in mind
            </button>
            <span aria-hidden="true">•</span>
            <span>Student notice board</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <AppShell />
      </AppProvider>
    </ErrorBoundary>
  );
}
