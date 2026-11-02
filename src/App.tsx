/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * NileFound - Production Pilot Web App
 * Engineered for Nile University of Nigeria, Abuja
 * Layout: Responsive single-page layout with Nile Blue & White branding.
 * Main Action: Browse campus listings, report lost/found items, and verify ownership claims.
 */

import React, { useState, useEffect } from 'react';
import { Navbar, AppTab } from './components/Navbar.tsx';
import { FeedView } from './components/FeedView.tsx';
import { AdminPanel } from './components/AdminPanel.tsx';
import { LoginPage } from './components/LoginPage.tsx';
import { ReportModal } from './components/ReportModal.tsx';
import { ClaimModal } from './components/ClaimModal.tsx';
import { PrivacyModal } from './components/PrivacyModal.tsx';
import { CampusItem, ClaimRecord, User } from './types/index.ts';
import { DEMO_ITEMS, DEMO_CLAIMS, INITIAL_ITEMS, INITIAL_CLAIMS } from './data/mockItems.ts';
import { expireOldItems } from './utils/admin.ts';
import { auth, testConnection } from './lib/firebase.ts';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import {
  subscribeToRealtimeItems,
  subscribeToRealtimeClaims,
  saveItemToFirestore,
  updateItemStatusInFirestore,
  deleteItemFromFirestore,
  saveClaimToFirestore,
  updateClaimStatusInFirestore,
  syncUserProfile,
  fetchUserRole,
} from './services/firestoreService.ts';

export default function App() {
  // Demo Mode toggle: Real mode starts empty by default
  const [isDemoMode, setIsDemoMode] = useState<boolean>(() => {
    return localStorage.getItem('nilefound_demo_mode') === 'true';
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

  // Active user session (starts null in real mode unless authenticated and emailVerified)
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    if (!isDemoMode) return null;
    const saved = localStorage.getItem('nilefound_user_v1');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
    return null;
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
      const saved = localStorage.getItem('nilefound_demo_items_v1');
      setItems(saved ? JSON.parse(saved) : DEMO_ITEMS);
      const savedClaims = localStorage.getItem('nilefound_demo_claims_v1');
      setClaims(savedClaims ? JSON.parse(savedClaims) : DEMO_CLAIMS);
    } else {
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

  // Test connection to Firestore on initial boot
  useEffect(() => {
    testConnection();
  }, []);

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser && fbUser.email) {
        // If a password provider user is detected, purge session to prevent Token Service API errors
        const isPasswordProvider = fbUser.providerData?.some((p) => p.providerId === 'password');
        if (isPasswordProvider) {
          console.warn('Stale password session detected. Signing out.');
          await signOut(auth);
          if (!isDemoMode) {
            setCurrentUser(null);
          }
          return;
        }

        // Pre-validate token retrieval before setting active state
        try {
          await fbUser.getIdToken(false);
        } catch (tokenErr: any) {
          console.warn('Token validation failed. Signing out stale session:', tokenErr);
          await signOut(auth);
          if (!isDemoMode) {
            setCurrentUser(null);
          }
          return;
        }

        const email = fbUser.email.trim().toLowerCase();
        const isOwner = email === 'ayomide2289@gmail.com';
        // Check role in /roles/{uid}
        const assignedRole = await fetchUserRole(fbUser.uid);
        const isStaffOrAdmin = isOwner || assignedRole === 'admin' || assignedRole === 'security';
        const role = isOwner ? 'admin' : (isStaffOrAdmin ? assignedRole : 'student');

        const user: User = {
          id: fbUser.uid,
          name: isOwner ? 'Ayomide' : (fbUser.displayName || email.split('@')[0]),
          email,
          role,
          isAdmin: role === 'admin',
          department: isOwner
            ? 'System Owner & University Administration'
            : isStaffOrAdmin
            ? (assignedRole === 'security' ? 'Campus Security & Safety' : 'University Administration')
            : 'Nile University Member',
        };
        setCurrentUser(user);
        syncUserProfile(user).catch((e) => console.debug('Profile sync:', e));
      } else {
        if (!isDemoMode) {
          setCurrentUser(null);
        }
      }
    });
    return () => unsubscribe();
  }, [isDemoMode]);

  // Real-time Firestore sync when in real mode AND authenticated
  useEffect(() => {
    if (isDemoMode) return;

    if (!currentUser) {
      setItems([]);
      setClaims([]);
      return;
    }

    const unsubscribeItems = subscribeToRealtimeItems(
      (realtimeItems) => {
        setItems(realtimeItems);
      },
      (err) => {
        console.warn('Real-time items sync error:', err);
      }
    );

    const unsubscribeClaims = subscribeToRealtimeClaims(
      currentUser,
      (realtimeClaims) => {
        setClaims(realtimeClaims);
      },
      (err) => {
        console.warn('Real-time claims sync error:', err);
      }
    );

    return () => {
      unsubscribeItems();
      unsubscribeClaims();
    };
  }, [isDemoMode, currentUser]);

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

  const handleAddItem = async (newItem: CampusItem) => {
    setSavedDraftCount(0);
    if (isDemoMode) {
      setItems((prev) => [newItem, ...prev]);
      return;
    }

    try {
      const docId = await saveItemToFirestore(newItem, currentUser);
      setItems((prev) => [{ ...newItem, id: docId }, ...prev]);
    } catch (err) {
      console.error('Error saving item to Firestore:', err);
      setItems((prev) => [newItem, ...prev]);
    }
  };

  const handleClaimSuccess = async (newClaim: ClaimRecord) => {
    if (isDemoMode) {
      setClaims((prev) => [newClaim, ...prev]);
      setItems((prev) =>
        prev.map((it) => (it.id === newClaim.itemId ? { ...it, status: 'claim_requested' } : it))
      );
      return;
    }

    try {
      const matchingItem = items.find((i) => i.id === newClaim.itemId);
      await saveClaimToFirestore(newClaim, currentUser, matchingItem?.id);
    } catch (err) {
      console.error('Error saving claim to Firestore:', err);
      setClaims((prev) => [newClaim, ...prev]);
    }
  };

  const handleApproveClaim = async (claimId: string, itemId: string) => {
    if (isDemoMode) {
      setClaims((prev) =>
        prev.map((c) => (c.id === claimId ? { ...c, status: 'approved' } : c))
      );
      setItems((prev) =>
        prev.map((it) => (it.id === itemId ? { ...it, status: 'returned' } : it))
      );
      return;
    }

    try {
      await updateClaimStatusInFirestore(claimId, itemId, 'approved');
      setClaims((prev) =>
        prev.map((c) => (c.id === claimId ? { ...c, status: 'approved' } : c))
      );
      setItems((prev) =>
        prev.map((it) => (it.id === itemId ? { ...it, status: 'returned' } : it))
      );
    } catch (err) {
      console.error('Error approving claim in Firestore:', err);
    }
  };

  const handleRejectClaim = async (claimId: string) => {
    if (isDemoMode) {
      setClaims((prev) =>
        prev.map((c) => (c.id === claimId ? { ...c, status: 'rejected' } : c))
      );
      return;
    }

    const claim = claims.find((c) => c.id === claimId);
    if (!claim) return;

    try {
      await updateClaimStatusInFirestore(claimId, claim.itemId, 'rejected');
      setClaims((prev) =>
        prev.map((c) => (c.id === claimId ? { ...c, status: 'rejected' } : c))
      );
    } catch (err) {
      console.error('Error rejecting claim in Firestore:', err);
    }
  };

  const handleUpdateItemStatus = async (itemId: string, status: CampusItem['status']) => {
    if (isDemoMode) {
      setItems((prev) =>
        prev.map((it) => (it.id === itemId ? { ...it, status } : it))
      );
      return;
    }

    try {
      await updateItemStatusInFirestore(itemId, status);
      setItems((prev) =>
        prev.map((it) => (it.id === itemId ? { ...it, status } : it))
      );
    } catch (err) {
      console.error('Error updating item status in Firestore:', err);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (isDemoMode) {
      setItems((prev) => prev.filter((it) => it.id !== itemId));
      setClaims((prev) => prev.filter((c) => c.itemId !== itemId));
      return;
    }

    try {
      await deleteItemFromFirestore(itemId);
      setItems((prev) => prev.filter((it) => it.id !== itemId));
      setClaims((prev) => prev.filter((c) => c.itemId !== itemId));
    } catch (err) {
      console.error('Error deleting item from Firestore:', err);
    }
  };

  const handleExpireOldItems = () => {
    setItems((prev) => expireOldItems(prev, 60));
  };

  const pendingClaimsCount = claims.filter((c) => c.status === 'pending').length;

  return (
    <div className="min-h-screen bg-[#0B1020] text-[#F4F6FF] flex flex-col font-sans selection:bg-[#C6FF3D] selection:text-[#0B1020]">
      {/* Top App Bar & Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isOnline={isOnline}
        lowDataMode={lowDataMode}
        setLowDataMode={setLowDataMode}
        isDemoMode={isDemoMode}
        setIsDemoMode={handleToggleDemoMode}
        onOpenReportModal={() => setIsReportModalOpen(true)}
        savedDraftCount={savedDraftCount}
        currentUser={currentUser}
        pendingClaimsCount={pendingClaimsCount}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 transition-opacity duration-200">
        {activeTab === 'feed' && (
          <FeedView
            items={items}
            lowDataMode={lowDataMode}
            onClaimItem={(item) => setSelectedItemForClaim(item)}
            onOpenReportModal={() => setIsReportModalOpen(true)}
            currentUser={currentUser}
            isDemoMode={isDemoMode}
            onNavigateToLogin={() => setActiveTab('login')}
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
      <footer className="bg-[#0B1020] border-t border-[#1E294B] mt-16 py-6 px-4 text-xs text-slate-400">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <div className="flex items-center gap-2">
            <span className="font-bold text-[#F4F6FF] tracking-tight">NileFound</span>
            <span className="text-[#C6FF3D]">•</span>
            <span className="text-slate-400">Nile University of Nigeria, Abuja</span>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <button
              onClick={() => setIsPrivacyModalOpen(true)}
              className="text-[#C6FF3D] hover:underline font-medium cursor-pointer"
            >
              Built with privacy in mind
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
