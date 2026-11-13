/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * NileFound - Root application component and state orchestration.
 */

import React, { lazy, Suspense, useState, useEffect, useRef } from 'react';
import type { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { motion } from 'motion/react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { Navbar, AppTab } from './components/Navbar.tsx';
import { FeedView } from './components/FeedView.tsx';
import { LoginPage } from './components/LoginPage.tsx';
import { ReportModal } from './components/ReportModal.tsx';
import { ClaimModal } from './components/ClaimModal.tsx';
import { NotificationToast } from './components/NotificationToast.tsx';
import { CampusItem, ClaimRecord, User, CampusNotification } from './types/index.ts';
import { DEMO_ITEMS, DEMO_CLAIMS, INITIAL_ITEMS, INITIAL_CLAIMS } from './data/mockItems.ts';
import { expireOldItems } from './utils/admin.ts';
import { isMasterAdminEmail } from './utils/authValidation.ts';
import { auth, testConnection } from './lib/firebase.ts';
import {
  fetchItemsPage, subscribeToRealtimeClaims, saveItemToFirestore, updateItemStatusInFirestore,
  deleteItemFromFirestore, saveClaimToFirestore, updateClaimStatusInFirestore, syncUserProfile,
  fetchUserRole, subscribeToRealtimeNotifications, saveNotificationToFirestore, markNotificationAsReadInFirestore,
} from './services/firestoreService.ts';
import { playNotificationChime, sendBrowserPushNotification } from './services/notificationService.ts';

const AdminPanel = lazy(() => import('./components/AdminPanel.tsx').then((m) => ({ default: m.AdminPanel })));
const PrivacyModal = lazy(() => import('./components/PrivacyModal.tsx').then((m) => ({ default: m.PrivacyModal })));

const readJson = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

export default function App() {
  const [isSimulating, setIsSimulating] = useState(() => localStorage.getItem('nilefound_admin_simulating') === 'true');
  const isSimulatingRef = useRef(isSimulating);
  useEffect(() => { isSimulatingRef.current = isSimulating; }, [isSimulating]);

  const [isDemoMode, setIsDemoMode] = useState(() => localStorage.getItem('nilefound_admin_simulating') === 'true');
  const [realUser, setRealUser] = useState<User | null>(null);
  const [items, setItems] = useState<CampusItem[]>(() => (isDemoMode ? readJson('nilefound_demo_items_v1', DEMO_ITEMS) : INITIAL_ITEMS));
  const [itemsCursor, setItemsCursor] = useState<QueryDocumentSnapshot<DocumentData>>();
  const [hasMoreItems, setHasMoreItems] = useState(true);
  const [isLoadingMoreItems, setIsLoadingMoreItems] = useState(false);
  const [claims, setClaims] = useState<ClaimRecord[]>(() => (isDemoMode ? readJson('nilefound_demo_claims_v1', DEMO_CLAIMS) : INITIAL_CLAIMS));

  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    if (localStorage.getItem('nilefound_admin_simulating') === 'true') {
      const persona = readJson<User | null>('nilefound_simulated_persona', null);
      if (persona) return persona;
    }
    return readJson<User | null>('nilefound_user_v1', null);
  });

  const [activeTab, setActiveTab] = useState<AppTab>('feed');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [lowDataMode, setLowDataMode] = useState(() => localStorage.getItem('nilefound_low_data') === 'true');
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('nilefound_theme') === 'dark');
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);
  const [selectedItemForClaim, setSelectedItemForClaim] = useState<CampusItem | null>(null);
  const [savedDraftCount, setSavedDraftCount] = useState(0);
  const [notifications, setNotifications] = useState<CampusNotification[]>([]);
  const [activeToast, setActiveToast] = useState<CampusNotification | null>(null);

  const isRealUserAdmin = realUser?.role === 'admin' || realUser?.isAdmin;
  const isPrivileged = currentUser?.role === 'admin' || currentUser?.isAdmin || currentUser?.role === 'security';
  const canUsePersonaSimulation = Boolean(import.meta.env.DEV && (isRealUserAdmin || currentUser?.role === 'admin' || isSimulating));

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
    localStorage.setItem('nilefound_theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  useEffect(() => {
    if (realUser && !isRealUserAdmin && !isSimulating) {
      setIsSimulating(false);
      setIsDemoMode(false);
      localStorage.removeItem('nilefound_admin_simulating');
      localStorage.removeItem('nilefound_simulated_persona');
    }
  }, [realUser, isRealUserAdmin, isSimulating]);

  useEffect(() => {
    if (currentUser && activeTab === 'login') setActiveTab(isPrivileged ? 'admin' : 'feed');
  }, [currentUser, activeTab, isPrivileged]);

  useEffect(() => {
    localStorage.setItem('nilefound_demo_mode', String(isDemoMode));
    localStorage.setItem(isDemoMode ? 'nilefound_demo_items_v1' : 'nilefound_real_items_v1', JSON.stringify(items));
  }, [items, isDemoMode]);

  useEffect(() => {
    localStorage.setItem(isDemoMode ? 'nilefound_demo_claims_v1' : 'nilefound_real_claims_v1', JSON.stringify(claims));
  }, [claims, isDemoMode]);

  useEffect(() => {
    if (currentUser) localStorage.setItem('nilefound_user_v1', JSON.stringify(currentUser));
    else localStorage.removeItem('nilefound_user_v1');
  }, [currentUser]);

  useEffect(() => { localStorage.setItem('nilefound_low_data', String(lowDataMode)); }, [lowDataMode]);
  useEffect(() => { testConnection(); }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser?.email) {
        const email = fbUser.email.trim().toLowerCase();
        if (!fbUser.emailVerified && !isMasterAdminEmail(email)) {
          setRealUser(null);
          if (!isSimulatingRef.current) setCurrentUser(null);
          return;
        }
        try {
          await fbUser.getIdToken(false);
        } catch {
          await signOut(auth);
          setRealUser(null);
          if (!isSimulatingRef.current) setCurrentUser(null);
          return;
        }
        const role = await fetchUserRole(fbUser.uid, email);
        const user: User = {
          id: fbUser.uid,
          name: (fbUser.displayName || email.split('@')[0]).split(' ')[0],
          email,
          role,
          isAdmin: role === 'admin',
          department: role === 'admin' ? 'University Administration' : role === 'security' ? 'Campus Security & Safety' : 'Nile University Member',
        };
        setRealUser(user);
        if (!isSimulatingRef.current && localStorage.getItem('nilefound_admin_simulating') !== 'true') {
          setCurrentUser(user);
          syncUserProfile(user).catch(() => {});
        }
      } else {
        setRealUser(null);
        setCurrentUser(null);
        setIsSimulating(false);
        setIsDemoMode(false);
        localStorage.removeItem('nilefound_user_v1');
        localStorage.removeItem('nilefound_admin_simulating');
        localStorage.removeItem('nilefound_simulated_persona');
        setActiveTab('login');
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (isDemoMode || !currentUser || (!auth.currentUser?.emailVerified && !isMasterAdminEmail(auth.currentUser?.email))) return;
    let cancelled = false;
    setItemsCursor(undefined);
    setHasMoreItems(true);
    fetchItemsPage()
      .then(({ items: pageItems, nextCursor }) => {
        if (cancelled) return;
        setItems(pageItems);
        setItemsCursor(nextCursor);
        setHasMoreItems(Boolean(nextCursor));
      })
      .catch(() => { if (!cancelled) setItems([]); });

    const unsubscribeClaims = subscribeToRealtimeClaims(currentUser, setClaims, () => {});
    return () => { cancelled = true; unsubscribeClaims(); };
  }, [isDemoMode, currentUser]);

  useEffect(() => {
    if (isDemoMode || !currentUser || (!auth.currentUser?.emailVerified && !isMasterAdminEmail(auth.currentUser?.email))) {
      setNotifications([]);
      return;
    }
    return subscribeToRealtimeNotifications(
      currentUser,
      (realtimeNotifs) => {
        setNotifications((prev) => {
          const prevIds = new Set(prev.map((n) => n.id));
          const newest = realtimeNotifs[0];
          if (newest && !prevIds.has(newest.id) && !newest.read) {
            playNotificationChime();
            setActiveToast(newest);
            sendBrowserPushNotification(newest.title, { body: newest.message });
          }
          return realtimeNotifs;
        });
      },
      () => {}
    );
  }, [isDemoMode, currentUser]);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    if (localStorage.getItem('nilefound_report_draft_v1')) setSavedDraftCount(1);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const dispatchNotification = (
    payload: Omit<CampusNotification, 'id' | 'read' | 'createdAt'>,
    { toast = false, push = false } = {}
  ) => {
    const record: CampusNotification = { ...payload, id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, read: false, createdAt: new Date().toISOString() };
    if (!isDemoMode) saveNotificationToFirestore(record).catch(() => {});
    const isForCurrentUser = record.recipientUid === currentUser?.id || (record.recipientUid === 'admin' && currentUser?.isAdmin);
    if (isForCurrentUser) {
      setNotifications((prev) => [record, ...prev]);
      if (toast) {
        playNotificationChime();
        setActiveToast(record);
        if (push) sendBrowserPushNotification(record.title, { body: record.message });
      }
    }
  };

  const handleSwitchPersona = (user: User) => {
    setIsSimulating(true);
    setIsDemoMode(true);
    setCurrentUser(user);
    localStorage.setItem('nilefound_admin_simulating', 'true');
    localStorage.setItem('nilefound_simulated_persona', JSON.stringify(user));
    setItems(readJson('nilefound_demo_items_v1', DEMO_ITEMS));
    setClaims(readJson('nilefound_demo_claims_v1', DEMO_CLAIMS));
    setActiveTab(user.role === 'admin' || user.role === 'security' ? 'admin' : 'feed');
  };

  const handleExitSimulation = () => {
    setIsSimulating(false);
    setIsDemoMode(false);
    localStorage.removeItem('nilefound_admin_simulating');
    localStorage.removeItem('nilefound_simulated_persona');
    if (realUser) {
      setCurrentUser(realUser);
      setActiveTab(realUser.role === 'admin' || realUser.role === 'security' ? 'admin' : 'feed');
    } else {
      setCurrentUser(null);
      setActiveTab('login');
    }
  };

  const handleLoadMoreItems = async () => {
    if (!itemsCursor || isLoadingMoreItems || !hasMoreItems) return;
    setIsLoadingMoreItems(true);
    try {
      const page = await fetchItemsPage(itemsCursor);
      setItems((prev) => [...prev, ...page.items]);
      setItemsCursor(page.nextCursor);
      setHasMoreItems(Boolean(page.nextCursor));
    } finally {
      setIsLoadingMoreItems(false);
    }
  };

  const handleAddItem = async (newItem: CampusItem): Promise<boolean> => {
    setSavedDraftCount(0);
    let finalItemId = newItem.id;
    if (isDemoMode) {
      setItems((prev) => [newItem, ...prev]);
    } else {
      try {
        finalItemId = await saveItemToFirestore(newItem, currentUser);
        setItems((prev) => [{ ...newItem, id: finalItemId }, ...prev]);
      } catch {
        setItems((prev) => [newItem, ...prev]);
      }
    }

    const fromUid = auth.currentUser?.uid || currentUser?.id || 'student';
    const sameCategoryAndLocation = (it: CampusItem, oppositeType: 'lost' | 'found') =>
      it.type === oppositeType && it.status === 'open' && it.category === newItem.category && it.location.trim().toLowerCase() === newItem.location.trim().toLowerCase();

    if (newItem.type === 'found') {
      items.filter((it) => sameCategoryAndLocation(it, 'lost')).forEach((lostItem) => {
        if (lostItem.authorId && lostItem.authorId !== fromUid) {
          dispatchNotification({ recipientUid: lostItem.authorId, fromUid, type: 'match_alert', title: `Possible match: ${lostItem.title}`, message: `A found item in the same category was just reported at ${newItem.location}. Check the feed!`, itemId: lostItem.id });
        }
      });
    } else {
      const foundMatch = items.find((it) => sameCategoryAndLocation(it, 'found'));
      if (foundMatch) {
        dispatchNotification({ recipientUid: fromUid, fromUid, type: 'match_alert', title: `Possible match found: ${newItem.title}`, message: `A matching ${newItem.category.replace(/_/g, ' ')} was already turned in at ${foundMatch.location}. Check feed to claim it.`, itemId: foundMatch.id });
      }
    }

    dispatchNotification(
      { recipientUid: 'admin', fromUid, type: 'admin_review', title: `New ${newItem.type.toUpperCase()}: ${newItem.title}`, message: `A new ${newItem.type} item was reported at ${newItem.location}. Verification review required.`, itemId: finalItemId },
      { toast: true, push: true }
    );
    return true;
  };

  const handleClaimSuccess = async (newClaim: ClaimRecord) => {
    const fromUid = auth.currentUser?.uid || currentUser?.id || 'claimant';
    const matchingItem = items.find((i) => i.id === newClaim.itemId);
    if (isDemoMode) {
      setClaims((prev) => [{ ...newClaim, claimantId: fromUid }, ...prev]);
      setItems((prev) => prev.map((it) => (it.id === newClaim.itemId ? { ...it, status: 'claim_requested' } : it)));
    } else {
      await saveClaimToFirestore(newClaim, currentUser, matchingItem?.authorId);
    }

    if (matchingItem?.authorId && matchingItem.authorId !== fromUid) {
      dispatchNotification({ recipientUid: matchingItem.authorId, fromUid, type: 'claim_received', title: `New claim on ${matchingItem.title}`, message: 'A new ownership claim was filed for your found item. Review it in the Admin Desk.', itemId: matchingItem.id });
    }
    dispatchNotification(
      { recipientUid: 'admin', fromUid, type: 'admin_review', title: `Claim needs review: ${matchingItem?.title || 'Campus Item'}`, message: `A new ownership claim was filed for "${matchingItem?.title || 'item'}". Physical verification pending.`, itemId: newClaim.itemId },
      { toast: true }
    );
  };

  const handleApproveClaim = async (claimId: string, itemId: string) => {
    const fromUid = auth.currentUser?.uid || currentUser?.id || 'admin';
    const claim = claims.find((c) => c.id === claimId);
    if (!isDemoMode) {
      try { await updateClaimStatusInFirestore(claimId, itemId, 'approved'); } catch { return; }
    }
    setClaims((prev) => prev.map((c) => (c.id === claimId ? { ...c, status: 'approved' } : c)));
    setItems((prev) => prev.map((it) => (it.id === itemId ? { ...it, status: 'returned' } : it)));

    if (claim?.claimantId) {
      dispatchNotification({ recipientUid: claim.claimantId, fromUid, type: 'claim_approved', title: `Claim approved: ${claim.itemTitle}`, message: `Your ownership claim for "${claim.itemTitle}" was approved. Collect it from campus security or designated office.`, itemId: claim.itemId, claimId: claim.id });
    }
    const item = items.find((i) => i.id === itemId);
    if (item?.authorId && item.authorId !== fromUid) {
      dispatchNotification({ recipientUid: item.authorId, fromUid, type: 'item_returned', title: `Item returned: ${item.title}`, message: `"${item.title}" has been successfully reunited and marked as Returned.`, itemId: item.id });
    }
  };

  const handleRejectClaim = async (claimId: string) => {
    const fromUid = auth.currentUser?.uid || currentUser?.id || 'admin';
    const claim = claims.find((c) => c.id === claimId);
    if (!claim) return;
    if (!isDemoMode) {
      try { await updateClaimStatusInFirestore(claimId, claim.itemId, 'rejected'); } catch { return; }
    }
    setClaims((prev) => prev.map((c) => (c.id === claimId ? { ...c, status: 'rejected' } : c)));
    if (claim.claimantId) {
      dispatchNotification({ recipientUid: claim.claimantId, fromUid, type: 'claim_rejected', title: `Claim rejected: ${claim.itemTitle}`, message: `Your verification answer for "${claim.itemTitle}" could not be confirmed. Contact Campus Security if this was an error.`, itemId: claim.itemId, claimId: claim.id });
    }
  };

  const handleUpdateItemStatus = async (itemId: string, status: CampusItem['status']) => {
    const fromUid = auth.currentUser?.uid || currentUser?.id || 'admin';
    if (!isDemoMode) {
      try { await updateItemStatusInFirestore(itemId, status); } catch { return; }
    }
    setItems((prev) => prev.map((it) => (it.id === itemId ? { ...it, status } : it)));
    if (status === 'returned') {
      const target = items.find((i) => i.id === itemId);
      if (target?.authorId) {
        dispatchNotification({ recipientUid: target.authorId, fromUid, type: 'item_returned', title: `Item returned: ${target.title}`, message: `"${target.title}" has been successfully reunited and marked as Returned.`, itemId: target.id });
      }
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!isDemoMode) {
      try { await deleteItemFromFirestore(itemId); } catch { return; }
    }
    setItems((prev) => prev.filter((it) => it.id !== itemId));
    setClaims((prev) => prev.filter((c) => c.itemId !== itemId));
  };

  const handleSelectNotificationItem = (itemId?: string, type?: string) => {
    if (type === 'admin_review' && isPrivileged) return setActiveTab('admin');
    if (itemId) {
      setActiveTab('feed');
      setTimeout(() => {
        const el = document.getElementById(`item-${itemId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.classList.add('ring-2', 'ring-[#0F6E6E]');
          setTimeout(() => el.classList.remove('ring-2', 'ring-[#0F6E6E]'), 3000);
        }
      }, 150);
    }
  };

  const handleLogout = async () => {
    await signOut(auth).catch(() => {});
    setRealUser(null);
    setIsSimulating(false);
    setIsDemoMode(false);
    localStorage.removeItem('nilefound_user_v1');
    localStorage.removeItem('nilefound_admin_simulating');
    localStorage.removeItem('nilefound_simulated_persona');
    setCurrentUser(null);
    setActiveTab('feed');
  };

  return (
    <div className="min-h-screen bg-[var(--color-paper)] text-[var(--color-ink)] flex flex-col font-sans selection:bg-[#0F6E6E] selection:text-white transition-colors duration-150">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isOnline={isOnline}
        lowDataMode={lowDataMode}
        setLowDataMode={setLowDataMode}
        isDemoMode={isDemoMode}
        setIsDemoMode={(v) => (v ? setIsDemoMode(true) : handleExitSimulation())}
        onOpenReportModal={() => setIsReportModalOpen(true)}
        savedDraftCount={savedDraftCount}
        currentUser={currentUser}
        pendingClaimsCount={claims.filter((c) => c.status === 'pending').length}
        notifications={notifications}
        onMarkAllAsRead={() => {
          setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
          notifications.forEach((n) => { if (!n.read) markNotificationAsReadInFirestore(n.id); });
        }}
        onMarkAsRead={(id) => {
          setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
          markNotificationAsReadInFirestore(id);
        }}
        onSelectNotificationItem={handleSelectNotificationItem}
        isDarkMode={isDarkMode}
        onToggleDarkMode={() => setIsDarkMode((prev) => !prev)}
        onLogout={handleLogout}
      />

      {canUsePersonaSimulation && isSimulating && (
        <div className="bg-[#FAF6EF] dark:bg-[#1E1C18] border-b border-[#E6DFD2] dark:border-[#2E2A24] px-4 py-2.5 text-xs flex flex-wrap items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#E8A317]" />
            <span className="font-bold text-[#1F1B16] dark:text-[#F5F1EA]">Admin Simulation:</span>
            <span className="text-[#544E45] dark:text-[#B8B0A2]">
              Viewing as <strong className="text-[#0F6E6E] dark:text-[#199595] font-bold">{currentUser?.name}</strong> ({currentUser?.role})
            </span>
            <span className="text-[#7A7266] dark:text-[#857D71] text-xs font-mono hidden md:inline">(Project owner)</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setActiveTab('admin')} className="bg-white dark:bg-[#28241F] hover:bg-[#F5EFE4] dark:hover:bg-[#332E27] text-[#1F1B16] dark:text-[#F5F1EA] px-3 py-1 rounded-[10px] text-xs font-medium border border-[#E6DFD2] dark:border-[#2E2A24] transition-colors cursor-pointer btn-campus">
              Switch Persona
            </button>
            <button onClick={handleExitSimulation} className="bg-[#0F6E6E] hover:bg-[#0C5656] text-white px-3.5 py-1 rounded-[10px] text-xs font-semibold transition-all cursor-pointer shadow-xs btn-campus">
              Return to Master Admin
            </button>
          </div>
        </div>
      )}

      <main className="flex-1 max-w-7xl w-full min-w-0 mx-auto p-4 sm:p-6 lg:p-8 pb-24 sm:pb-6 transition-opacity duration-200">
        <motion.div key={activeTab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18, ease: 'easeOut' }}>
          {activeTab === 'feed' && (
            <FeedView
              items={items}
              lowDataMode={lowDataMode}
              onClaimItem={(item) => (currentUser ? setSelectedItemForClaim(item) : setActiveTab('login'))}
              onOpenReportModal={() => setIsReportModalOpen(true)}
              currentUser={currentUser}
              isDemoMode={isDemoMode}
              onNavigateToLogin={() => setActiveTab('login')}
              onLoadMore={handleLoadMoreItems}
              hasMoreItems={hasMoreItems}
              isLoadingMoreItems={isLoadingMoreItems}
            />
          )}

          {activeTab === 'admin' && (
            <Suspense fallback={<div className="p-6 text-xs text-ink">Loading admin tools…</div>}>
              <AdminPanel
                currentUser={currentUser}
                items={items}
                claims={claims}
                onUpdateItemStatus={handleUpdateItemStatus}
                onDeleteItem={handleDeleteItem}
                onApproveClaim={handleApproveClaim}
                onRejectClaim={handleRejectClaim}
                onExpireOldItems={() => setItems((prev) => expireOldItems(prev, 60))}
                onNavigateToLogin={() => setActiveTab('login')}
                onSwitchPersona={canUsePersonaSimulation ? handleSwitchPersona : undefined}
              />
            </Suspense>
          )}

          {activeTab === 'login' && (
            <LoginPage
              currentUser={currentUser}
              onLogin={(user) => {
                if (user.id.startsWith('demo-') && isSimulating) return handleSwitchPersona(user);
                setCurrentUser(user);
                setActiveTab(user.role === 'admin' || user.role === 'security' ? 'admin' : 'feed');
              }}
              onLogout={handleLogout}
              onNavigateToFeed={() => setActiveTab('feed')}
              isDemoMode={isDemoMode}
            />
          )}
        </motion.div>
      </main>

      <ReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        onSubmitItem={handleAddItem}
        onDraftSaved={() => setSavedDraftCount(1)}
        currentUser={currentUser}
        onOpenLogin={() => { setIsReportModalOpen(false); setActiveTab('login'); }}
      />

      <ClaimModal item={selectedItemForClaim} onClose={() => setSelectedItemForClaim(null)} onSuccessClaim={handleClaimSuccess} />

      <NotificationToast
        notification={activeToast}
        onDismiss={() => setActiveToast(null)}
        onView={(notif) => setActiveTab(notif.linkTab === 'admin' && isPrivileged ? 'admin' : 'feed')}
      />

      <Suspense fallback={null}>
        <PrivacyModal isOpen={isPrivacyModalOpen} onClose={() => setIsPrivacyModalOpen(false)} />
      </Suspense>

      {activeTab === 'feed' && (
        <button
          onClick={() => setIsReportModalOpen(true)}
          className="sm:hidden fixed right-4 bottom-4 z-40 min-h-12 px-5 bg-[#0F6E6E] hover:bg-[#0C5656] text-white rounded-[10px] shadow-lg font-semibold text-sm cursor-pointer btn-campus"
          aria-label="Report an item"
        >
          + Report
        </button>
      )}

      <footer className="bg-transparent border-t border-[#E6DFD2] dark:border-[#2E2A24] mt-16 py-8 px-4 text-xs text-[#7A7266] dark:text-[#857D71]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <div className="flex items-center gap-2">
            <span className="font-serif font-bold text-sm text-[#1F1B16] dark:text-[#F5F1EA] tracking-tight">NileFound</span>
            <span className="text-[#D1C7B7] dark:text-[#3F3A32]">•</span>
            <span>Nile University of Nigeria, Abuja</span>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <button onClick={() => setIsPrivacyModalOpen(true)} className="text-[#0F6E6E] dark:text-[#199595] hover:underline font-medium cursor-pointer">
              Built with privacy in mind
            </button>
            <span className="text-[#D1C7B7] dark:text-[#3F3A32]">•</span>
            <span>Student notice board</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
