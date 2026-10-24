/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * NileFound - Production Pilot Web App
 * Engineered for Nile University of Nigeria, Abuja
 */

import React, { useState, useEffect } from 'react';
import { Navbar, AppTab } from './components/Navbar.tsx';
import { FeedView } from './components/FeedView.tsx';
import { ResearchKitView } from './components/ResearchKitView.tsx';
import { MetricsView } from './components/MetricsView.tsx';
import { CareerGuideView } from './components/CareerGuideView.tsx';
import { SystemDesignView } from './components/SystemDesignView.tsx';
import { AdminPanel } from './components/AdminPanel.tsx';
import { LoginPage } from './components/LoginPage.tsx';
import { ReportModal } from './components/ReportModal.tsx';
import { ClaimModal } from './components/ClaimModal.tsx';
import { PrivacyModal } from './components/PrivacyModal.tsx';
import { CampusItem, ClaimRecord, User } from './types/index.ts';
import { DEMO_ITEMS, DEMO_CLAIMS, INITIAL_ITEMS, INITIAL_CLAIMS } from './data/mockItems.ts';
import { expireOldItems } from './utils/admin.ts';

export default function App() {
  // Demo Mode toggle: Real mode starts empty by default
  const [isDemoMode, setIsDemoMode] = useState<boolean>(() => {
    return localStorage.getItem('nilefound_demo_mode') === 'true';
  });

  // Builder mode gating: Accessible only via ?builder=1 or footer link
  const [builderMode, setBuilderMode] = useState<boolean>(() => {
    return window.location.search.includes('builder=1');
  });

  const [items, setItems] = useState<CampusItem[]>(() => {
    if (isDemoMode) {
      const saved = localStorage.getItem('nilefound_demo_items_v1');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          return DEMO_ITEMS;
        }
      }
      return DEMO_ITEMS;
    }

    const saved = localStorage.getItem('nilefound_real_items_v1');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return INITIAL_ITEMS;
      }
    }
    return INITIAL_ITEMS;
  });

  const [claims, setClaims] = useState<ClaimRecord[]>(() => {
    if (isDemoMode) {
      const saved = localStorage.getItem('nilefound_demo_claims_v1');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          return DEMO_CLAIMS;
        }
      }
      return DEMO_CLAIMS;
    }

    const saved = localStorage.getItem('nilefound_real_claims_v1');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return INITIAL_CLAIMS;
      }
    }
    return INITIAL_CLAIMS;
  });

  // Active user session (defaults to null or saved student/staff session)
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('nilefound_user_v1');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
    // Default session for pilot testing
    return {
      id: 'admin-ayomide',
      name: 'Ayomide',
      email: 'ayomide2289@gmail.com',
      role: 'admin',
      matricNumber: '24/ENG/0192',
      department: 'Computer Engineering',
      isAdmin: true
    };
  });

  // Students and staff land on Campus Feed by default
  const [activeTab, setActiveTab] = useState<AppTab>('feed');
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [lowDataMode, setLowDataMode] = useState<boolean>(() => {
    return localStorage.getItem('nilefound_low_data') === 'true';
  });
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);
  const [selectedItemForClaim, setSelectedItemForClaim] = useState<CampusItem | null>(null);
  const [savedDraftCount, setSavedDraftCount] = useState<number>(0);

  // Sync state to localStorage according to demo mode
  useEffect(() => {
    localStorage.setItem('nilefound_demo_mode', String(isDemoMode));
    if (isDemoMode) {
      localStorage.setItem('nilefound_demo_items_v1', JSON.stringify(items));
    } else {
      localStorage.setItem('nilefound_real_items_v1', JSON.stringify(items));
    }
  }, [items, isDemoMode]);

  useEffect(() => {
    if (isDemoMode) {
      localStorage.setItem('nilefound_demo_claims_v1', JSON.stringify(claims));
    } else {
      localStorage.setItem('nilefound_real_claims_v1', JSON.stringify(claims));
    }
  }, [claims, isDemoMode]);

  // Handle switching between Demo Mode and Real Mode
  const handleToggleDemoMode = (newMode: boolean) => {
    setIsDemoMode(newMode);
    if (newMode) {
      // Load demo data
      const saved = localStorage.getItem('nilefound_demo_items_v1');
      setItems(saved ? JSON.parse(saved) : DEMO_ITEMS);
      const savedClaims = localStorage.getItem('nilefound_demo_claims_v1');
      setClaims(savedClaims ? JSON.parse(savedClaims) : DEMO_CLAIMS);
    } else {
      // Load real empty pilot data
      const saved = localStorage.getItem('nilefound_real_items_v1');
      setItems(saved ? JSON.parse(saved) : []);
      const savedClaims = localStorage.getItem('nilefound_real_claims_v1');
      setClaims(savedClaims ? JSON.parse(savedClaims) : []);
    }
  };

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('nilefound_user_v1', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('nilefound_user_v1');
    }
  }, [currentUser]);

  useEffect(() => {
    localStorage.setItem('nilefound_low_data', String(lowDataMode));
  }, [lowDataMode]);

  // Monitor connectivity
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const draft = localStorage.getItem('nilefound_report_draft_v1');
    if (draft) {
      setSavedDraftCount(1);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleAddItem = (newItem: CampusItem) => {
    setItems((prev) => [newItem, ...prev]);
    setSavedDraftCount(0);
  };

  const handleClaimSuccess = (newClaim: ClaimRecord) => {
    setClaims((prev) => [newClaim, ...prev]);
    setItems((prev) =>
      prev.map((it) => (it.id === newClaim.itemId ? { ...it, status: 'claim_requested' } : it))
    );
  };

  const handleApproveClaim = (claimId: string, itemId: string) => {
    setClaims((prev) =>
      prev.map((c) => (c.id === claimId ? { ...c, status: 'approved' } : c))
    );
    setItems((prev) =>
      prev.map((it) => (it.id === itemId ? { ...it, status: 'returned' } : it))
    );
  };

  const handleRejectClaim = (claimId: string) => {
    setClaims((prev) =>
      prev.map((c) => (c.id === claimId ? { ...c, status: 'rejected' } : c))
    );
  };

  const handleUpdateItemStatus = (itemId: string, status: CampusItem['status']) => {
    setItems((prev) =>
      prev.map((it) => (it.id === itemId ? { ...it, status } : it))
    );
  };

  const handleDeleteItem = (itemId: string) => {
    setItems((prev) => prev.filter((it) => it.id !== itemId));
    setClaims((prev) => prev.filter((c) => c.itemId !== itemId));
  };

  const handleExpireOldItems = () => {
    setItems((prev) => expireOldItems(prev, 60));
  };

  const pendingClaimsCount = claims.filter((c) => c.status === 'pending').length;

  return (
    <div className="min-h-screen bg-stone-100 flex flex-col font-sans text-stone-900 selection:bg-emerald-200">
      {/* Top App Bar & Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isOnline={isOnline}
        lowDataMode={lowDataMode}
        setLowDataMode={setLowDataMode}
        isDemoMode={isDemoMode}
        setIsDemoMode={handleToggleDemoMode}
        builderMode={builderMode}
        onOpenReportModal={() => setIsReportModalOpen(true)}
        savedDraftCount={savedDraftCount}
        currentUser={currentUser}
        pendingClaimsCount={pendingClaimsCount}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6">
        {activeTab === 'feed' && (
          <FeedView
            items={items}
            lowDataMode={lowDataMode}
            onClaimItem={(item) => setSelectedItemForClaim(item)}
            onOpenReportModal={() => setIsReportModalOpen(true)}
          />
        )}

        {activeTab === 'admin' && (
          <AdminPanel
            currentUser={currentUser}
            items={items}
            claims={claims}
            onUpdateItemStatus={handleUpdateItemStatus}
            onDeleteItem={handleDeleteItem}
            onApproveClaim={handleApproveClaim}
            onRejectClaim={handleRejectClaim}
            onExpireOldItems={handleExpireOldItems}
            onNavigateToLogin={() => setActiveTab('login')}
          />
        )}

        {activeTab === 'login' && (
          <LoginPage
            currentUser={currentUser}
            onLogin={(user) => {
              setCurrentUser(user);
              if (user.role === 'admin' || user.role === 'security') {
                setActiveTab('admin');
              } else {
                setActiveTab('feed');
              }
            }}
            onLogout={() => setCurrentUser(null)}
            onNavigateToFeed={() => setActiveTab('feed')}
            isDemoMode={isDemoMode}
          />
        )}

        {/* Builder Scaffolding Views (Only rendered if builder mode is open) */}
        {builderMode && activeTab === 'prototype' && <SystemDesignView />}
        {builderMode && activeTab === 'research' && <ResearchKitView />}
        {builderMode && activeTab === 'metrics' && <MetricsView />}
        {builderMode && activeTab === 'career' && <CareerGuideView />}
      </main>

      {/* Modals */}
      <ReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        onSubmitItem={handleAddItem}
        onDraftSaved={() => setSavedDraftCount(1)}
      />

      <ClaimModal
        item={selectedItemForClaim}
        onClose={() => setSelectedItemForClaim(null)}
        onSuccessClaim={handleClaimSuccess}
      />

      <PrivacyModal
        isOpen={isPrivacyModalOpen}
        onClose={() => setIsPrivacyModalOpen(false)}
      />

      {/* Footer */}
      <footer className="bg-white border-t border-stone-200 mt-12 py-5 px-4 text-xs text-stone-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <div className="flex items-center gap-2">
            <span className="font-bold text-stone-800">NileFound</span>
            <span>•</span>
            <span>Nile University of Nigeria, Abuja</span>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-stone-600">
            <button
              onClick={() => setIsPrivacyModalOpen(true)}
              className="text-emerald-800 hover:text-emerald-950 underline font-medium"
            >
              Built with privacy in mind
            </button>
          </div>

          <div className="flex items-center gap-2 text-stone-400 text-[11px]">
            <button
              onClick={() => setBuilderMode(!builderMode)}
              className="text-stone-400 hover:text-stone-600 underline"
            >
              {builderMode ? 'Hide Builder Notes' : 'Builder Notes'}
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
