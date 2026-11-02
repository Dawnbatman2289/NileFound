/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * NileFound Slim Navbar & Header
 * Styled in Deep Navy (#0B1020), Soft White (#F4F6FF), and Electric Lime (#C6FF3D).
 */

import React from 'react';
import { 
  Sparkles, 
  Wifi, 
  WifiOff, 
  Zap, 
  Search, 
  Plus,
  KeyRound,
  User as UserIcon
} from 'lucide-react';
import { User } from '../types/index.ts';

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
  pendingClaimsCount
}) => {
  const isOwnerEmail = currentUser?.email?.trim().toLowerCase() === 'ayomide2289@gmail.com';
  const isAdmin = currentUser?.role === 'admin' || currentUser?.isAdmin || isOwnerEmail;
  const isSecurity = currentUser?.role === 'security';
  const canAccessAdmin = isAdmin || isSecurity;

  return (
    <header className="sticky top-0 z-30 bg-[#0B1020]/95 backdrop-blur-md border-b border-[#1E294B] text-[#F4F6FF]">
      {/* Slim Minimal Top Bar */}
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
        {/* Brand & BETA Tag */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <h1 className="font-extrabold text-xl leading-none tracking-tight text-[#F4F6FF]">
              NileFound
            </h1>
            <span className="bg-[#C6FF3D]/10 text-[#C6FF3D] border border-[#C6FF3D]/40 text-[10px] font-mono px-2 py-0.5 rounded-full font-bold tracking-wider">
              BETA
            </span>
          </div>
          <span className="hidden md:inline text-xs text-slate-400 font-medium border-l border-[#1E294B] pl-3">
            Nile University of Nigeria
          </span>
        </div>

        {/* Action Controls & Report Item Button */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          {/* Low-Data Toggle (Micro pill) */}
          <button
            onClick={() => setLowDataMode(!lowDataMode)}
            className={`hidden xs:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors cursor-pointer min-h-[36px] ${
              lowDataMode
                ? 'bg-[#C6FF3D]/15 text-[#C6FF3D] border-[#C6FF3D]/40'
                : 'bg-[#141B33] text-slate-400 border-[#1E294B] hover:text-[#F4F6FF]'
            }`}
            title="Saves mobile data by hiding photos"
          >
            <Zap className="w-3 h-3 text-[#C6FF3D]" />
            <span className="hidden sm:inline">Low-Data:</span> {lowDataMode ? 'ON' : 'OFF'}
          </button>

          {/* Connection Status indicator */}
          <div className="flex items-center text-[11px] text-slate-400">
            {isOnline ? (
              <span className="flex items-center gap-1 text-slate-300" title="Connected">
                <span className="w-2 h-2 rounded-full bg-[#C6FF3D]" />
                <span className="hidden sm:inline text-[11px]">Online</span>
              </span>
            ) : (
              <span className="flex items-center gap-1 text-amber-400 font-medium" title="Offline">
                <WifiOff className="w-3.5 h-3.5" />
                <span className="text-[11px]">Offline</span>
              </span>
            )}
          </div>

          {/* Account Login Button */}
          {currentUser ? (
            <button
              onClick={() => setActiveTab('login')}
              className="flex items-center gap-2 bg-[#141B33] hover:bg-[#1A2342] text-[#F4F6FF] px-3 py-1.5 rounded-full text-xs font-medium border border-[#1E294B] transition-colors min-h-[44px] cursor-pointer"
              title="Account Settings"
            >
              <div className="w-6 h-6 rounded-full bg-[#C6FF3D] text-[#0B1020] font-bold flex items-center justify-center text-xs">
                {currentUser.name.charAt(0)}
              </div>
              <span className="max-w-[100px] truncate hidden sm:inline">{currentUser.name}</span>
              {isAdmin && (
                <span className="bg-[#C6FF3D]/20 text-[#C6FF3D] text-[9px] font-bold px-1.5 py-0.2 rounded font-mono">
                  ADMIN
                </span>
              )}
            </button>
          ) : (
            <button
              onClick={() => setActiveTab('login')}
              className="flex items-center gap-1.5 bg-[#141B33] hover:bg-[#1A2342] text-[#F4F6FF] px-3.5 py-2 rounded-full text-xs font-medium border border-[#1E294B] transition-colors min-h-[44px] cursor-pointer"
            >
              <UserIcon className="w-3.5 h-3.5 text-slate-300" />
              <span>Sign In</span>
            </button>
          )}

          {/* Report Item Button: Lime, Pill-Shaped with Subtle Radar Ping */}
          <button
            onClick={onOpenReportModal}
            className="relative inline-flex items-center gap-2 bg-[#C6FF3D] hover:bg-[#b8f52f] text-[#0B1020] font-extrabold text-xs sm:text-sm px-4 sm:px-5 py-2.5 rounded-full shadow-[0_0_20px_rgba(198,255,61,0.25)] hover:shadow-[0_0_25px_rgba(198,255,61,0.4)] transition-all min-h-[44px] cursor-pointer active:scale-95"
          >
            <span className="radar-ping-ring" aria-hidden="true" />
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Report Item</span>
            {savedDraftCount > 0 && (
              <span className="bg-[#0B1020] text-[#C6FF3D] text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold">
                1 draft
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Navigation Tabs Bar */}
      <nav className="max-w-7xl mx-auto px-4 flex gap-2 overflow-x-auto text-xs border-t border-[#1E294B]/80 scrollbar-none">
        <button
          onClick={() => setActiveTab('feed')}
          className={`flex items-center gap-1.5 px-3 py-2.5 border-b-2 font-medium whitespace-nowrap transition-colors min-h-[44px] cursor-pointer ${
            activeTab === 'feed'
              ? 'border-[#C6FF3D] text-[#C6FF3D] font-bold'
              : 'border-transparent text-slate-400 hover:text-[#F4F6FF]'
          }`}
        >
          <Search className="w-3.5 h-3.5" />
          <span>Campus Feed</span>
        </button>

        {/* Admin Control Center Tab */}
        {canAccessAdmin && (
          <button
            onClick={() => setActiveTab('admin')}
            className={`flex items-center gap-1.5 px-3 py-2.5 border-b-2 font-medium whitespace-nowrap transition-colors min-h-[44px] cursor-pointer ${
              activeTab === 'admin'
                ? 'border-[#C6FF3D] text-[#C6FF3D] font-bold bg-[#141B33]/60'
                : 'border-transparent text-slate-400 hover:text-[#F4F6FF]'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5 text-[#C6FF3D]" />
            <span>Admin Control Center</span>
            {pendingClaimsCount > 0 && (
              <span className="bg-[#C6FF3D] text-[#0B1020] font-mono text-[10px] px-1.5 py-0.2 rounded-full font-bold ml-0.5">
                {pendingClaimsCount}
              </span>
            )}
          </button>
        )}
      </nav>
    </header>
  );
};
