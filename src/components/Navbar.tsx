/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * NileFound Navbar & Header
 * Clean mobile-first navigation styled in Nile Blue (#002B66 / #0F3D78) and Crisp White.
 */

import React from 'react';
import { 
  Shield, 
  Wifi, 
  WifiOff, 
  Zap, 
  Search, 
  PlusCircle,
  KeyRound,
  User as UserIcon,
  Database
} from 'lucide-react';
import { User } from '../types/index.ts';

export type AppTab = 'feed' | 'admin' | 'prototype' | 'research' | 'metrics' | 'career' | 'login';

interface NavbarProps {
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
  isOnline: boolean;
  lowDataMode: boolean;
  setLowDataMode: (val: boolean) => void;
  isDemoMode: boolean;
  setIsDemoMode: (val: boolean) => void;
  builderMode: boolean;
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
  builderMode,
  onOpenReportModal,
  savedDraftCount,
  currentUser,
  pendingClaimsCount
}) => {
  const isAdmin = currentUser?.role === 'admin' || currentUser?.isAdmin;
  const isSecurity = currentUser?.role === 'security';
  const canAccessAdmin = isAdmin || isSecurity;

  return (
    <header className="sticky top-0 z-30 bg-blue-900 text-white shadow-xs border-b border-blue-800">
      {/* Top Banner: Device-only warning & Connectivity status */}
      <div className="bg-blue-950 px-3 py-1.5 text-xs flex flex-wrap items-center justify-between border-b border-blue-900 gap-2">
        <div className="flex items-center gap-2">
          <span className="text-amber-300 font-medium text-[11px] flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            Nile University of Nigeria • Abuja Campus Lost & Found
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Demo Data Mode Toggle */}
          <button
            onClick={() => setIsDemoMode(!isDemoMode)}
            className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
              isDemoMode
                ? 'bg-amber-400 text-slate-900 font-bold'
                : 'bg-blue-800 text-blue-200 hover:bg-blue-700'
            }`}
            title="Switch between Real Empty Pilot and Sample Demo Data"
          >
            <Database className="w-3 h-3" />
            <span>Demo Data: {isDemoMode ? 'ON' : 'OFF'}</span>
          </button>

          {/* Low Data Mode Toggle */}
          <button
            onClick={() => setLowDataMode(!lowDataMode)}
            className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
              lowDataMode
                ? 'bg-blue-700 text-white font-bold'
                : 'bg-blue-800/80 text-blue-200 hover:bg-blue-700'
            }`}
            title="Saves mobile data by hiding photos"
          >
            <Zap className="w-3 h-3" />
            <span className="hidden xs:inline">Low-Data: {lowDataMode ? 'ON' : 'OFF'}</span>
          </button>

          {/* Online/Offline status */}
          <div className="flex items-center gap-1 text-[11px]">
            {isOnline ? (
              <span className="flex items-center gap-1 text-blue-200">
                <Wifi className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Online</span>
              </span>
            ) : (
              <span className="flex items-center gap-1 text-amber-300 font-medium">
                <WifiOff className="w-3.5 h-3.5" />
                <span>Offline</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Main Bar */}
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="bg-blue-800 p-1.5 rounded-lg border border-blue-700 text-white">
            <Shield className="w-5 h-5 text-blue-200" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-lg leading-tight tracking-tight text-white">NileFound</h1>
              <span className="bg-blue-800 text-blue-100 text-[10px] uppercase font-bold px-1.5 py-0.5 rounded border border-blue-700">
                Beta
              </span>
            </div>
            <p className="text-xs text-blue-200/80 leading-none mt-0.5">Nile University of Nigeria</p>
          </div>
        </div>

        {/* Action Button & User Login Status */}
        <div className="flex items-center gap-2">
          {currentUser ? (
            <button
              onClick={() => setActiveTab('login')}
              className="flex items-center gap-1.5 bg-blue-800/80 hover:bg-blue-700 text-blue-100 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-blue-700 transition-colors"
              title="Account Settings"
            >
              <div className="w-5 h-5 rounded-full bg-blue-700 text-amber-300 font-bold flex items-center justify-center text-[10px]">
                {currentUser.name.charAt(0)}
              </div>
              <span className="max-w-[100px] truncate hidden sm:inline">{currentUser.name}</span>
              {isAdmin && (
                <span className="bg-amber-400 text-slate-900 text-[9px] font-bold px-1 rounded uppercase">
                  Admin
                </span>
              )}
            </button>
          ) : (
            <button
              onClick={() => setActiveTab('login')}
              className="flex items-center gap-1 bg-blue-800 hover:bg-blue-700 text-blue-100 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-blue-700 transition-colors"
            >
              <UserIcon className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </button>
          )}

          <button
            onClick={onOpenReportModal}
            className="flex items-center gap-1.5 bg-white hover:bg-blue-50 text-blue-950 font-semibold px-3 py-1.5 rounded-lg text-xs sm:text-sm shadow-xs transition-all border border-blue-200"
          >
            <PlusCircle className="w-4 h-4 text-blue-900" />
            <span>Report Item</span>
            {savedDraftCount > 0 && (
              <span className="bg-blue-950 text-white text-[10px] px-1 rounded-full ml-0.5 font-mono">
                1 draft
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Navigation Tabs - Students & Staff see only Feed, Report, and Admin Panel */}
      <nav className="max-w-7xl mx-auto px-4 flex gap-1 overflow-x-auto text-xs border-t border-blue-800 scrollbar-none">
        <button
          onClick={() => setActiveTab('feed')}
          className={`flex items-center gap-1.5 px-3 py-2 border-b-2 font-medium whitespace-nowrap transition-colors ${
            activeTab === 'feed'
              ? 'border-white text-white font-semibold'
              : 'border-transparent text-blue-200/80 hover:text-white hover:border-blue-700'
          }`}
        >
          <Search className="w-3.5 h-3.5" />
          <span>Campus Feed</span>
        </button>

        {/* Admin Panel (Admin/Security only) */}
        {canAccessAdmin && (
          <button
            onClick={() => setActiveTab('admin')}
            className={`flex items-center gap-1.5 px-3 py-2 border-b-2 font-medium whitespace-nowrap transition-colors ${
              activeTab === 'admin'
                ? 'border-amber-400 text-amber-300 font-bold bg-blue-950/40'
                : 'border-transparent text-amber-200/90 hover:text-white hover:border-blue-700'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5 text-amber-400" />
            <span>Admin Panel</span>
            {pendingClaimsCount > 0 && (
              <span className="bg-amber-400 text-slate-900 font-mono text-[10px] px-1.5 py-0.2 rounded-full font-bold ml-0.5">
                {pendingClaimsCount}
              </span>
            )}
          </button>
        )}

        {/* Builder scaffolding tabs: only visible if builderMode is enabled (?builder=1) */}
        {builderMode && (
          <>
            <button
              onClick={() => setActiveTab('prototype')}
              className={`flex items-center gap-1.5 px-3 py-2 border-b-2 font-medium whitespace-nowrap transition-colors ${
                activeTab === 'prototype'
                  ? 'border-white text-white font-semibold'
                  : 'border-transparent text-blue-300/70 hover:text-white'
              }`}
            >
              <span>Blueprint & Prototype</span>
            </button>

            <button
              onClick={() => setActiveTab('research')}
              className={`flex items-center gap-1.5 px-3 py-2 border-b-2 font-medium whitespace-nowrap transition-colors ${
                activeTab === 'research'
                  ? 'border-white text-white font-semibold'
                  : 'border-transparent text-blue-300/70 hover:text-white'
              }`}
            >
              <span>Field Research</span>
            </button>

            <button
              onClick={() => setActiveTab('metrics')}
              className={`flex items-center gap-1.5 px-3 py-2 border-b-2 font-medium whitespace-nowrap transition-colors ${
                activeTab === 'metrics'
                  ? 'border-white text-white font-semibold'
                  : 'border-transparent text-blue-300/70 hover:text-white'
              }`}
            >
              <span>Metrics & Simulator</span>
            </button>

            <button
              onClick={() => setActiveTab('career')}
              className={`flex items-center gap-1.5 px-3 py-2 border-b-2 font-medium whitespace-nowrap transition-colors ${
                activeTab === 'career'
                  ? 'border-white text-white font-semibold'
                  : 'border-transparent text-blue-300/70 hover:text-white'
              }`}
            >
              <span>Decision Matrix</span>
            </button>
          </>
        )}
      </nav>
    </header>
  );
};
