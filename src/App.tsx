/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * NileFound - Main Application Shell
 * Engineered for Nile University of Nigeria, Abuja
 * Mentorship and Co-building for Ayomide (100L Computer Engineering)
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
import { CampusItem, ClaimRecord, User } from './types/index.ts';
import { INITIAL_ITEMS, INITIAL_CLAIMS } from './data/mockItems.ts';
import { expireOldItems } from './utils/admin.ts';

export default function App() {
  const [items, setItems] = useState<CampusItem[]>(() => {
    const saved = localStorage.getItem('nilefound_items_v1');
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
    const saved = localStorage.getItem('nilefound_claims_v1');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return INITIAL_CLAIMS;
      }
    }
    return INITIAL_CLAIMS;
  });

  // Default active user is Ayomide (Admin) so you can immediately explore and use both student & admin tools
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('nilefound_user_v1');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // Fallback default
      }
    }
    return {
      id: 'admin-ayomide',
      name: 'Ayomide',
      email: 'ayomide2289@gmail.com',
      role: 'admin',
      matricNumber: '24/ENG/0192',
      department: 'Computer Engineering (100L)',
      isAdmin: true
    };
  });

  const [activeTab, setActiveTab] = useState<AppTab>('admin');
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [lowDataMode, setLowDataMode] = useState<boolean>(() => {
    return localStorage.getItem('nilefound_low_data') === 'true';
  });
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [selectedItemForClaim, setSelectedItemForClaim] = useState<CampusItem | null>(null);
  const [savedDraftCount, setSavedDraftCount] = useState<number>(0);

  // Sync state to localStorage
  useEffect(() => {
    localStorage.setItem('nilefound_items_v1', JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    localStorage.setItem('nilefound_claims_v1', JSON.stringify(claims));
  }, [claims]);

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
    // Add to claims queue for admin review
    setClaims((prev) => [newClaim, ...prev]);

    // Mark item status as claim_requested
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
              if (user.role === 'admin') {
                setActiveTab('admin');
              } else {
                setActiveTab('feed');
              }
            }}
            onLogout={() => setCurrentUser(null)}
            onNavigateToFeed={() => setActiveTab('feed')}
          />
        )}

        {activeTab === 'prototype' && <SystemDesignView />}

        {activeTab === 'research' && <ResearchKitView />}

        {activeTab === 'metrics' && <MetricsView />}

        {activeTab === 'career' && <CareerGuideView />}
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

      {/* Footer */}
      <footer className="bg-white border-t border-stone-200 mt-12 py-6 px-4 text-xs text-stone-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <div className="flex items-center gap-2">
            <span className="font-bold text-stone-800">NileFound</span>
            <span>•</span>
            <span>Nile University of Nigeria, Abuja</span>
          </div>

          <div className="text-[11px] text-stone-400">
            Engineered with privacy-first standards • Aligned with Nigeria Data Protection Act (NDPA) 2023
          </div>

          <div className="flex items-center gap-1.5 text-stone-600 font-medium">
            <span>Co-built with Ayomide (100L CoE)</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
