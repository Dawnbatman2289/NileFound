/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { 
  Shield, 
  Wifi, 
  WifiOff, 
  Zap, 
  Search, 
  ClipboardList, 
  BarChart3, 
  GraduationCap, 
  PlusCircle,
  KeyRound,
  UserCheck,
  User as UserIcon,
  FileCode
} from 'lucide-react';
import { User } from '../types/index.ts';

export type AppTab = 'feed' | 'admin' | 'prototype' | 'research' | 'metrics' | 'career' | 'login';

interface NavbarProps {
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
  isOnline: boolean;
  lowDataMode: boolean;
  setLowDataMode: (val: boolean) => void;
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
  onOpenReportModal,
  savedDraftCount,
  currentUser,
  pendingClaimsCount
}) => {
  const isAdmin = currentUser?.role === 'admin' || currentUser?.isAdmin;

  return (
    <header className="sticky top-0 z-30 bg-emerald-900 text-white shadow-md border-b border-emerald-800">
      {/* Top Banner: University & Network status */}
      <div className="bg-emerald-950 px-3 py-1.5 text-xs flex flex-wrap items-center justify-between border-b border-emerald-800/60">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 font-semibold text-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Nile University of Nigeria, Abuja
          </span>
          <span className="text-emerald-400/60 hidden sm:inline">•</span>
          <span className="text-emerald-300/80 text-[11px] hidden sm:inline">Engineering Design Mentorship Project</span>
        </div>

        <div className="flex items-center gap-3">
          {/* Online/Offline status indicator */}
          <div className="flex items-center gap-1 text-[11px]">
            {isOnline ? (
              <span className="flex items-center gap-1 text-emerald-300">
                <Wifi className="w-3.5 h-3.5" />
                <span className="hidden xs:inline">Campus Online</span>
              </span>
            ) : (
              <span className="flex items-center gap-1 text-amber-300 font-medium">
                <WifiOff className="w-3.5 h-3.5" />
                <span>Offline (Local Draft Active)</span>
              </span>
            )}
          </div>

          {/* Low Data Mode Toggle */}
          <button
            onClick={() => setLowDataMode(!lowDataMode)}
            className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
              lowDataMode
                ? 'bg-amber-400 text-stone-900 font-bold'
                : 'bg-emerald-800/80 text-emerald-100 hover:bg-emerald-700'
            }`}
            title="Saves mobile data by hiding photos and using compressed text"
          >
            <Zap className="w-3 h-3" />
            <span>Low-Data: {lowDataMode ? 'ON' : 'OFF'}</span>
          </button>
        </div>
      </div>

      {/* Main Bar */}
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-700 p-1.5 rounded-lg border border-emerald-600/60 text-white shadow-inner">
            <Shield className="w-6 h-6 text-emerald-200" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-lg leading-tight tracking-tight text-white">NileFound</h1>
              <span className="bg-emerald-800 text-emerald-200 text-[10px] uppercase font-bold px-1.5 py-0.5 rounded border border-emerald-700">
                Stage 1 Alpha
              </span>
            </div>
            <p className="text-xs text-emerald-200/80 leading-none mt-0.5">Campus Lost & Found Verification Network</p>
          </div>
        </div>

        {/* Action Button & User Login Status */}
        <div className="flex items-center gap-2">
          {currentUser ? (
            <button
              onClick={() => setActiveTab('login')}
              className="flex items-center gap-1.5 bg-emerald-800/80 hover:bg-emerald-700 text-emerald-100 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-emerald-700 transition-colors"
              title="View account profile"
            >
              <div className="w-5 h-5 rounded-full bg-emerald-700 text-amber-300 font-bold flex items-center justify-center text-[10px]">
                {currentUser.name.charAt(0)}
              </div>
              <span className="max-w-[100px] truncate hidden sm:inline">{currentUser.name}</span>
              {isAdmin && (
                <span className="bg-amber-400 text-stone-900 text-[9px] font-bold px-1 rounded uppercase">
                  Admin
                </span>
              )}
            </button>
          ) : (
            <button
              onClick={() => setActiveTab('login')}
              className="flex items-center gap-1 bg-emerald-800 hover:bg-emerald-700 text-emerald-100 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-emerald-700 transition-colors"
            >
              <UserIcon className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </button>
          )}

          <button
            onClick={onOpenReportModal}
            className="flex items-center gap-1.5 bg-amber-400 hover:bg-amber-300 active:bg-amber-500 text-stone-900 font-semibold px-3 py-1.5 rounded-lg text-xs sm:text-sm shadow-sm transition-all"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Report Item</span>
            {savedDraftCount > 0 && (
              <span className="bg-stone-900 text-amber-300 text-[10px] px-1 rounded-full ml-0.5 font-mono">
                1 draft
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <nav className="max-w-7xl mx-auto px-4 flex gap-1 overflow-x-auto text-xs border-t border-emerald-800/70 scrollbar-none">
        <button
          onClick={() => setActiveTab('feed')}
          className={`flex items-center gap-1.5 px-3 py-2 border-b-2 font-medium whitespace-nowrap transition-colors ${
            activeTab === 'feed'
              ? 'border-amber-400 text-white font-semibold'
              : 'border-transparent text-emerald-200/80 hover:text-white hover:border-emerald-700'
          }`}
        >
          <Search className="w-3.5 h-3.5" />
          <span>Campus Feed</span>
        </button>

        {/* Special Admin Tab for Ayomide & Security */}
        <button
          onClick={() => setActiveTab('admin')}
          className={`flex items-center gap-1.5 px-3 py-2 border-b-2 font-medium whitespace-nowrap transition-colors ${
            activeTab === 'admin'
              ? 'border-amber-400 text-amber-300 font-bold bg-emerald-950/40'
              : 'border-transparent text-amber-200/90 hover:text-white hover:border-emerald-700'
          }`}
        >
          <KeyRound className="w-3.5 h-3.5 text-amber-400" />
          <span>Ayomide's Admin Panel</span>
          {pendingClaimsCount > 0 && (
            <span className="bg-amber-400 text-stone-900 font-mono text-[10px] px-1.5 py-0.2 rounded-full font-bold ml-0.5">
              {pendingClaimsCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('prototype')}
          className={`flex items-center gap-1.5 px-3 py-2 border-b-2 font-medium whitespace-nowrap transition-colors ${
            activeTab === 'prototype'
              ? 'border-amber-400 text-white font-semibold'
              : 'border-transparent text-emerald-200/80 hover:text-white hover:border-emerald-700'
          }`}
        >
          <FileCode className="w-3.5 h-3.5 text-amber-300" />
          <span>Blueprint & Prototype</span>
        </button>

        <button
          onClick={() => setActiveTab('research')}
          className={`flex items-center gap-1.5 px-3 py-2 border-b-2 font-medium whitespace-nowrap transition-colors ${
            activeTab === 'research'
              ? 'border-amber-400 text-white font-semibold'
              : 'border-transparent text-emerald-200/80 hover:text-white hover:border-emerald-700'
          }`}
        >
          <ClipboardList className="w-3.5 h-3.5" />
          <span>Stage 1 Field Research</span>
        </button>

        <button
          onClick={() => setActiveTab('metrics')}
          className={`flex items-center gap-1.5 px-3 py-2 border-b-2 font-medium whitespace-nowrap transition-colors ${
            activeTab === 'metrics'
              ? 'border-amber-400 text-white font-semibold'
              : 'border-transparent text-emerald-200/80 hover:text-white hover:border-emerald-700'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5" />
          <span>Success Metrics</span>
        </button>

        <button
          onClick={() => setActiveTab('career')}
          className={`flex items-center gap-1.5 px-3 py-2 border-b-2 font-medium whitespace-nowrap transition-colors ${
            activeTab === 'career'
              ? 'border-amber-400 text-white font-semibold'
              : 'border-transparent text-emerald-200/80 hover:text-white hover:border-emerald-700'
          }`}
        >
          <GraduationCap className="w-3.5 h-3.5" />
          <span>Mentorship Hub</span>
        </button>

        <button
          onClick={() => setActiveTab('login')}
          className={`flex items-center gap-1.5 px-3 py-2 border-b-2 font-medium whitespace-nowrap transition-colors ml-auto ${
            activeTab === 'login'
              ? 'border-amber-400 text-white font-semibold'
              : 'border-transparent text-emerald-200/80 hover:text-white hover:border-emerald-700'
          }`}
        >
          <UserCheck className="w-3.5 h-3.5" />
          <span>Switch Account</span>
        </button>
      </nav>
    </header>
  );
};

