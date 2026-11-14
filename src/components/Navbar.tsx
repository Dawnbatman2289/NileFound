/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * NileFound Slim Navbar & Header
 * Accessible mobile-first top bar using neutral paper surfaces and deep teal primary accent.
 */

import React, { useState, useRef, useCallback } from 'react';
import {
  WifiOff, Zap, Search, Plus, KeyRound, User as UserIcon, Bell, Sun, Moon, LogOut,
} from 'lucide-react';
import { User, CampusNotification } from '../types/index.ts';
import { NotificationDropdown } from './NotificationDropdown.tsx';

export type AppTab = 'feed' | 'admin' | 'login';

interface NavbarProps {
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
  isOnline: boolean;
  lowDataMode: boolean;
  setLowDataMode: (val: boolean) => void;
  isDemoMode: boolean;
  setIsDemoMode: (val: boolean) => void;
  onOpenReportModal: () => void;
  savedDraftCount: number;
  currentUser: User | null;
  pendingClaimsCount: number;
  notifications?: CampusNotification[];
  onMarkAllAsRead?: () => void;
  onMarkAsRead?: (id: string) => void;
  onSelectNotificationItem?: (itemId?: string, type?: string) => void;
  isDarkMode?: boolean;
  onToggleDarkMode?: () => void;
  onLogout?: () => void;
}

const NavbarNotifications: React.FC<{
  unreadCount: number;
  notifications: CampusNotification[];
  onMarkAllAsRead: () => void;
  onMarkAsRead: (id: string) => void;
  onSelectNotificationItem?: (itemId?: string, type?: string) => void;
}> = ({ unreadCount, notifications, onMarkAllAsRead, onMarkAsRead, onSelectNotificationItem }) => {
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const bellButtonRef = useRef<HTMLButtonElement>(null);
  const closeNotifDropdown = useCallback(() => setIsNotifOpen(false), []);

  return (
    <div className="relative">
      <button
        ref={bellButtonRef}
        type="button"
        onClick={() => setIsNotifOpen((prev) => !prev)}
        className="relative p-2.5 bg-white dark:bg-[#1E1C18] text-[#4A443C] dark:text-[#CEC7BB] hover:text-[#0F6E6E] dark:hover:text-[#199595] rounded-[10px] border border-[#857C70] dark:border-[#787065] transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center btn-campus"
        title="Campus Notifications"
        aria-label={`Campus Notifications (${unreadCount} unread)`}
        aria-expanded={isNotifOpen}
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-[#E8A317] text-[#1F1B16] text-xs font-bold font-sans min-w-[20px] h-5 px-1 rounded-full flex items-center justify-center shadow-xs">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      <NotificationDropdown
        isOpen={isNotifOpen}
        onClose={closeNotifDropdown}
        triggerRef={bellButtonRef}
        notifications={notifications}
        onMarkAllAsRead={onMarkAllAsRead}
        onMarkAsRead={onMarkAsRead}
        onSelectItem={(itemId, type) => onSelectNotificationItem?.(itemId, type)}
      />
    </div>
  );
};

const NavbarAccountMenu: React.FC<{
  currentUser: User | null;
  canAccessAdmin: boolean;
  isAdmin: boolean;
  isSecurity: boolean;
  setActiveTab: (tab: AppTab) => void;
  onLogout?: () => void;
}> = ({ currentUser, canAccessAdmin, isAdmin, isSecurity, setActiveTab, onLogout }) => {
  if (!currentUser) {
    return (
      <button
        type="button"
        onClick={() => setActiveTab('login')}
        className="flex items-center gap-1.5 bg-white dark:bg-[#1E1C18] hover:bg-[#F5EFE4] dark:hover:bg-[#28241F] text-[#1F1B16] dark:text-[#F5F1EA] px-3.5 py-2 rounded-[10px] text-sm font-medium border border-[#857C70] dark:border-[#787065] transition-colors min-h-[44px] cursor-pointer btn-campus"
      >
        <UserIcon className="w-4 h-4 text-[#4A443C] dark:text-[#CEC7BB]" />
        <span>Sign In</span>
      </button>
    );
  }
  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => setActiveTab(canAccessAdmin ? 'admin' : 'feed')}
        className="flex items-center gap-2 bg-white dark:bg-[#1E1C18] hover:bg-[#F5EFE4] dark:hover:bg-[#28241F] text-[#1F1B16] dark:text-[#F5F1EA] px-3 py-2 rounded-[10px] text-sm font-medium border border-[#857C70] dark:border-[#787065] transition-colors min-h-[44px] cursor-pointer btn-campus"
        title={canAccessAdmin ? 'Open Operations Desk' : 'Signed in account'}
      >
        <div className="w-6 h-6 rounded-full bg-[#E7F3F3] dark:bg-[#0D2D2D] text-[#0F6E6E] dark:text-[#199595] font-bold flex items-center justify-center text-xs border border-[#0F6E6E]/20">
          {currentUser.name.charAt(0)}
        </div>
        <span className="max-w-[100px] truncate hidden sm:inline">{currentUser.name}</span>
        {(isAdmin || isSecurity) && (
          <span className="bg-[#E7F3F3] dark:bg-[#0D2D2D] text-[#0F6E6E] dark:text-[#199595] text-xs font-bold px-1.5 py-0.5 rounded-[10px] border border-[#0F6E6E]/30 hidden sm:inline">
            {isAdmin ? 'Admin' : 'Security'}
          </span>
        )}
      </button>

      {onLogout && (
        <button
          type="button"
          onClick={onLogout}
          className="flex items-center gap-1.5 bg-white dark:bg-[#1E1C18] hover:bg-[#FDF2F2] dark:hover:bg-[#2B0E0E] text-[#4A443C] hover:text-[#9B1C1C] dark:text-[#CEC7BB] dark:hover:text-[#F87171] px-2.5 sm:px-3 py-2 rounded-[10px] text-sm font-medium border border-[#857C70] dark:border-[#787065] hover:border-[#F87171]/50 transition-colors min-h-[44px] cursor-pointer btn-campus"
          title="Sign out of your account"
          aria-label="Log Out"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden lg:inline">Log Out</span>
        </button>
      )}
    </div>
  );
};

export const Navbar: React.FC<NavbarProps> = ({
  activeTab, setActiveTab, isOnline, lowDataMode, setLowDataMode, onOpenReportModal, savedDraftCount,
  currentUser, pendingClaimsCount, notifications = [], onMarkAllAsRead = () => {}, onMarkAsRead = () => {},
  onSelectNotificationItem, isDarkMode = false, onToggleDarkMode, onLogout,
}) => {
  const isAdmin = Boolean(currentUser?.role === 'admin' || currentUser?.isAdmin);
  const isSecurity = currentUser?.role === 'security';
  const canAccessAdmin = isAdmin || isSecurity;
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <header className="sticky top-0 z-30 bg-[#FAF6EF]/95 dark:bg-[#141311]/95 backdrop-blur-sm border-b border-[#C4BBAF] dark:border-[#3E3931] text-[#1F1B16] dark:text-[#F5F1EA] shadow-[0_1px_0_rgba(31,27,22,0.03),0_8px_24px_rgba(31,27,22,0.04)] transition-colors">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3 min-w-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <h1 className="font-serif font-bold text-xl leading-none tracking-tight text-[#1F1B16] dark:text-[#F5F1EA]">
              NileFound
            </h1>
            <span className="hidden sm:inline bg-[#F5EFE4] dark:bg-[#28241F] text-[#4A443C] dark:text-[#CEC7BB] border border-[#857C70] dark:border-[#787065] text-xs font-sans font-medium px-2 py-0.5 rounded-[10px] tracking-wide">
              Campus Board
            </span>
          </div>
          <span className="hidden lg:inline text-sm text-[#5C554C] dark:text-[#A8A095] border-l border-[#C4BBAF] dark:border-[#3E3931] pl-3">
            Nile University of Nigeria
          </span>
        </div>

        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 max-w-full shrink-0">
          {onToggleDarkMode && (
            <button
              type="button"
              onClick={onToggleDarkMode}
              className="p-2.5 bg-white dark:bg-[#1E1C18] text-[#4A443C] dark:text-[#CEC7BB] hover:text-[#0F6E6E] dark:hover:text-[#199595] rounded-[10px] border border-[#857C70] dark:border-[#787065] transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center btn-campus"
              title={isDarkMode ? 'Switch to light theme' : 'Switch to dark theme'}
              aria-label={isDarkMode ? 'Switch to light theme' : 'Switch to dark theme'}
            >
              {isDarkMode ? <Sun className="w-4 h-4 text-[#F0B336]" /> : <Moon className="w-4 h-4" />}
            </button>
          )}

          {currentUser && (
            <NavbarNotifications
              unreadCount={unreadCount}
              notifications={notifications}
              onMarkAllAsRead={onMarkAllAsRead}
              onMarkAsRead={onMarkAsRead}
              onSelectNotificationItem={onSelectNotificationItem}
            />
          )}

          <button
            type="button"
            onClick={() => setLowDataMode(!lowDataMode)}
            aria-pressed={lowDataMode}
            aria-label={`Low-Data mode: ${lowDataMode ? 'ON' : 'OFF'}`}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-[10px] text-sm font-medium border transition-colors cursor-pointer min-h-[44px] min-w-[44px] justify-center btn-campus ${
              lowDataMode
                ? 'bg-[#E7F3F3] dark:bg-[#0D2D2D] text-[#0F6E6E] dark:text-[#199595] border-[#0F6E6E]/50'
                : 'bg-white dark:bg-[#1E1C18] text-[#4A443C] dark:text-[#CEC7BB] border-[#857C70] dark:border-[#787065] hover:text-[#1F1B16] dark:hover:text-[#F5F1EA]'
            }`}
            title="Saves mobile data by hiding photos"
          >
            <Zap className="w-4 h-4 text-[#0F6E6E] dark:text-[#199595] shrink-0" />
            <span className="hidden xl:inline">Low-Data:</span>
            <span className="hidden sm:inline">{lowDataMode ? 'ON' : 'OFF'}</span>
          </button>

          <div className="hidden lg:flex items-center text-sm text-[#5C554C] dark:text-[#A8A095]">
            {isOnline ? (
              <span className="flex items-center gap-1.5 text-[#4A443C] dark:text-[#CEC7BB]" title="Connected to campus network">
                <span className="w-2 h-2 rounded-full bg-[#2F7D4F]" />
                <span>Online</span>
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[#7A5000] dark:text-[#F9CF7C] font-medium" title="Offline - drafts saved locally">
                <WifiOff className="w-4 h-4" />
                <span>Offline</span>
              </span>
            )}
          </div>

          <NavbarAccountMenu
            currentUser={currentUser}
            canAccessAdmin={canAccessAdmin}
            isAdmin={isAdmin}
            isSecurity={isSecurity}
            setActiveTab={setActiveTab}
            onLogout={onLogout}
          />

          <button
            type="button"
            onClick={onOpenReportModal}
            className="hidden sm:inline-flex items-center gap-2 bg-[#0F6E6E] hover:bg-[#0C5656] text-white font-medium text-sm px-4 sm:px-5 py-2 rounded-[10px] shadow-xs transition-colors min-h-[44px] cursor-pointer btn-campus active:scale-98"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Report Item</span>
            {savedDraftCount > 0 && (
              <span className="bg-[#0C5656] text-white text-xs px-1.5 py-0.5 rounded font-sans font-medium">
                1 draft
              </span>
            )}
          </button>
        </div>
      </div>

      <nav aria-label="Primary navigation" className="max-w-7xl mx-auto px-4 flex gap-5 overflow-x-auto text-sm border-t border-[#C4BBAF] dark:border-[#3E3931]">
        <button
          type="button"
          onClick={() => setActiveTab('feed')}
          className={`flex items-center gap-1.5 py-2.5 border-b-2 font-medium whitespace-nowrap transition-colors min-h-[44px] cursor-pointer ${
            activeTab === 'feed'
              ? 'border-[#0F6E6E] dark:border-[#199595] text-[#0F6E6E] dark:text-[#199595] font-bold'
              : 'border-transparent text-[#4A443C] dark:text-[#CEC7BB] hover:text-[#1F1B16] dark:hover:text-[#F5F1EA]'
          }`}
        >
          <Search className="w-4 h-4" />
          <span>Campus Feed</span>
        </button>

        {canAccessAdmin && (
          <button
            type="button"
            onClick={() => setActiveTab('admin')}
            className={`flex items-center gap-1.5 py-2.5 border-b-2 font-medium whitespace-nowrap transition-colors min-h-[44px] cursor-pointer ${
              activeTab === 'admin'
                ? 'border-[#0F6E6E] dark:border-[#199595] text-[#0F6E6E] dark:text-[#199595] font-bold'
                : 'border-transparent text-[#4A443C] dark:text-[#CEC7BB] hover:text-[#1F1B16] dark:hover:text-[#F5F1EA]'
            }`}
          >
            <KeyRound className="w-4 h-4 text-[#0F6E6E] dark:text-[#199595]" />
            <span>Operations Desk</span>
            {pendingClaimsCount > 0 && (
              <span className="bg-[#E8A317] text-[#1F1B16] font-sans text-xs px-2 py-0.5 rounded-full font-bold ml-0.5">
                {pendingClaimsCount}
              </span>
            )}
          </button>
        )}
      </nav>
    </header>
  );
};
