/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * NileFound Slim Navbar & Header
 * Styled in Deep Navy (#0B1020), Soft White (#F4F6FF), and Electric Lime (#C6FF3D).
 */

import React from 'react';
import { 
  Wifi, 
  WifiOff, 
  Zap, 
  Search, 
  Plus,
  KeyRound,
  User as UserIcon,
  Bell,
  Sun,
  Moon
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
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  isOnline,
  lowDataMode,
  setLowDataMode,
  isDemoMode,
  setIsDemoMode,
  onOpenReportModal,
  savedDraftCount,
  currentUser,
  pendingClaimsCount,
  notifications = [],
  onMarkAllAsRead = () => {},
  onMarkAsRead = () => {},
  onSelectNotificationItem,
  isDarkMode = false,
  onToggleDarkMode,
}) => {
  const [isNotifOpen, setIsNotifOpen] = React.useState(false);
  const isOwnerEmail = currentUser?.email?.trim().toLowerCase() === 'ayomide2289@gmail.com';
  const isAdmin = currentUser?.role === 'admin' || currentUser?.isAdmin || isOwnerEmail;
  const isSecurity = currentUser?.role === 'security';
  const canAccessAdmin = isAdmin || isSecurity;

  // Accurate unread count directly from notification state
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <header className="sticky top-0 z-30 bg-[#FAF6EF]/95 dark:bg-[#141311]/95 backdrop-blur-sm border-b border-[#E6DFD2] dark:border-[#2E2A24] text-[#1F1B16] dark:text-[#F5F1EA] transition-colors">
      {/* Simple, left-aligned notice board header */}
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3 min-w-0">
        {/* Brand & Small Beta Tag */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <h1 className="font-serif font-bold text-xl leading-none tracking-tight text-[#1F1B16] dark:text-[#F5F1EA]">
              NileFound
            </h1>
            <span className="hidden sm:inline bg-[#E6DFD2]/60 dark:bg-[#2E2A24] text-[#544E45] dark:text-[#B8B0A2] border border-[#D1C7B7] dark:border-[#3F3A32] text-[10px] font-sans font-medium px-2 py-0.5 rounded-[4px] tracking-wide">
              Beta
            </span>
          </div>
          <span className="hidden md:inline text-xs text-[#7A7266] dark:text-[#857D71] border-l border-[#E6DFD2] dark:border-[#2E2A24] pl-3">
            Nile University Campus Board
          </span>
        </div>

        {/* Action Controls & Report Item Button */}
        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 max-w-full shrink-0">
          {/* Dark Mode Toggle */}
          {onToggleDarkMode && (
            <button
              onClick={onToggleDarkMode}
              className="p-2.5 bg-white dark:bg-[#1E1C18] text-[#544E45] dark:text-[#B8B0A2] hover:text-[#0F6E6E] dark:hover:text-[#199595] rounded-[10px] border border-[#E6DFD2] dark:border-[#2E2A24] transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center btn-campus"
              title={isDarkMode ? 'Switch to light paper theme' : 'Switch to dark theme'}
              aria-label="Toggle theme"
            >
              {isDarkMode ? <Sun className="w-4 h-4 text-[#F0B336]" /> : <Moon className="w-4 h-4" />}
            </button>
          )}

          {/* Notification Center Trigger & Dropdown */}
          {currentUser && (
          <div className="relative">
            <button
              onClick={() => setIsNotifOpen((prev) => !prev)}
              className="relative p-2.5 bg-white dark:bg-[#1E1C18] text-[#544E45] dark:text-[#B8B0A2] hover:text-[#0F6E6E] dark:hover:text-[#199595] rounded-[10px] border border-[#E6DFD2] dark:border-[#2E2A24] transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center btn-campus"
              title="Campus Notifications"
              aria-label={`Campus Notifications (${unreadCount} unread)`}
              aria-expanded={isNotifOpen}
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-[#E8A317] text-[#1F1B16] text-[10px] font-bold font-sans w-5 h-5 rounded-full flex items-center justify-center shadow-xs">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>

            <NotificationDropdown
              isOpen={isNotifOpen}
              onClose={() => setIsNotifOpen(false)}
              notifications={notifications}
              onMarkAllAsRead={onMarkAllAsRead}
              onMarkAsRead={onMarkAsRead}
              onSelectItem={(itemId, type) => {
                if (onSelectNotificationItem) {
                  onSelectNotificationItem(itemId, type);
                }
              }}
            />
          </div>
          )}

          {/* Low-Data Toggle */}
          <button
            onClick={() => setLowDataMode(!lowDataMode)}
            className={`hidden xs:flex items-center gap-1.5 px-3 py-2 rounded-[10px] text-xs font-medium border transition-colors cursor-pointer min-h-[44px] btn-campus ${
              lowDataMode
                ? 'bg-[#E7F3F3] dark:bg-[#0D2D2D] text-[#0F6E6E] dark:text-[#199595] border-[#0F6E6E]/40'
                : 'bg-white dark:bg-[#1E1C18] text-[#544E45] dark:text-[#B8B0A2] border-[#E6DFD2] dark:border-[#2E2A24] hover:text-[#1F1B16] dark:hover:text-[#F5F1EA]'
            }`}
            title="Saves mobile data by hiding photos"
          >
            <Zap className="w-3.5 h-3.5 text-[#0F6E6E] dark:text-[#199595]" />
            <span className="hidden sm:inline">Low-Data:</span> {lowDataMode ? 'ON' : 'OFF'}
          </button>

          {/* Connection Status indicator */}
          <div className="hidden sm:flex items-center text-xs text-[#7A7266] dark:text-[#857D71]">
            {isOnline ? (
              <span className="flex items-center gap-1.5 text-[#544E45] dark:text-[#B8B0A2]" title="Connected to campus network">
                <span className="w-2 h-2 rounded-full bg-[#2F7D4F]" />
                <span className="text-xs">Online</span>
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[#E8A317] font-medium" title="Offline - saving reports locally">
                <WifiOff className="w-3.5 h-3.5" />
                <span className="text-xs">Offline</span>
              </span>
            )}
          </div>

          {/* Account Login Button */}
          {currentUser ? (
            <button
              onClick={() => setActiveTab('login')}
              className="flex items-center gap-2 bg-white dark:bg-[#1E1C18] hover:bg-[#F5EFE4] dark:hover:bg-[#28241F] text-[#1F1B16] dark:text-[#F5F1EA] px-3 py-2 rounded-[10px] text-xs font-medium border border-[#E6DFD2] dark:border-[#2E2A24] transition-colors min-h-[44px] cursor-pointer btn-campus"
              title="Account Settings"
            >
              <div className="w-6 h-6 rounded-full bg-[#E7F3F3] dark:bg-[#0D2D2D] text-[#0F6E6E] dark:text-[#199595] font-bold flex items-center justify-center text-xs border border-[#0F6E6E]/20">
                {currentUser.name.charAt(0)}
              </div>
              <span className="max-w-[100px] truncate hidden sm:inline">{currentUser.name}</span>
              {isAdmin && (
                <span className="bg-[#E7F3F3] dark:bg-[#0D2D2D] text-[#0F6E6E] dark:text-[#199595] text-[9px] font-bold px-1.5 py-0.5 rounded-[4px] border border-[#0F6E6E]/30">
                  <span className="hidden sm:inline">Admin</span>
                </span>
              )}
            </button>
          ) : (
            <button
              onClick={() => setActiveTab('login')}
              className="flex items-center gap-1.5 bg-white dark:bg-[#1E1C18] hover:bg-[#F5EFE4] dark:hover:bg-[#28241F] text-[#1F1B16] dark:text-[#F5F1EA] px-3.5 py-2 rounded-[10px] text-xs font-medium border border-[#E6DFD2] dark:border-[#2E2A24] transition-colors min-h-[44px] cursor-pointer btn-campus"
            >
              <UserIcon className="w-3.5 h-3.5 text-[#544E45] dark:text-[#B8B0A2]" />
              <span>Sign In</span>
            </button>
          )}

          {/* Report Item Button: Solid Deep Teal (#0F6E6E), 10px Radius, Normal Size */}
          <button
            onClick={onOpenReportModal}
            className="hidden sm:inline-flex items-center gap-2 bg-[#0F6E6E] hover:bg-[#0C5656] text-white font-medium text-xs sm:text-sm px-4 sm:px-5 py-2 rounded-[10px] shadow-xs transition-colors min-h-[44px] cursor-pointer btn-campus active:scale-98"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Report Item</span>
            {savedDraftCount > 0 && (
              <span className="bg-[#0C5656] text-white text-[10px] px-1.5 py-0.2 rounded font-sans font-medium">
                1 draft
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Navigation Tabs Bar */}
      <nav className="max-w-7xl mx-auto px-4 flex gap-4 overflow-x-auto text-xs border-t border-[#E6DFD2] dark:border-[#2E2A24]">
        <button
          onClick={() => setActiveTab('feed')}
          className={`flex items-center gap-1.5 py-2.5 border-b-2 font-medium whitespace-nowrap transition-colors min-h-[44px] cursor-pointer ${
            activeTab === 'feed'
              ? 'border-[#0F6E6E] text-[#0F6E6E] dark:text-[#199595] font-bold'
              : 'border-transparent text-[#7A7266] dark:text-[#857D71] hover:text-[#1F1B16] dark:hover:text-[#F5F1EA]'
          }`}
        >
          <Search className="w-3.5 h-3.5" />
          <span>Campus Feed</span>
        </button>

        {/* Admin Control Center Tab */}
        {canAccessAdmin && (
          <button
            onClick={() => setActiveTab('admin')}
            className={`flex items-center gap-1.5 py-2.5 border-b-2 font-medium whitespace-nowrap transition-colors min-h-[44px] cursor-pointer ${
              activeTab === 'admin'
                ? 'border-[#0F6E6E] text-[#0F6E6E] dark:text-[#199595] font-bold'
                : 'border-transparent text-[#7A7266] dark:text-[#857D71] hover:text-[#1F1B16] dark:hover:text-[#F5F1EA]'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5 text-[#0F6E6E] dark:text-[#199595]" />
            <span>Admin Control Center</span>
            {pendingClaimsCount > 0 && (
              <span className="bg-[#E8A317] text-[#1F1B16] font-sans text-[10px] px-1.5 py-0.2 rounded-full font-bold ml-0.5">
                {pendingClaimsCount}
              </span>
            )}
          </button>
        )}
      </nav>
    </header>
  );
};
