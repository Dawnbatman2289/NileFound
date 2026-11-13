/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * NileFound - Root application component and state orchestration.
 */

import React, { lazy, Suspense, useState, useEffect, useRef, useCallback } from 'react';
import { motion, MotionConfig } from 'motion/react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { Navbar, AppTab } from './components/Navbar.tsx';
import { FeedView } from './components/FeedView.tsx';
import { NotificationToast } from './components/NotificationToast.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { CampusItem, ClaimRecord, User, CampusNotification } from './types/index.ts';
import { expireOldItems } from './utils/admin.ts';
import { calculateMatchScore } from './utils/matching.ts';
import { auth, testConnection, clearOfflinePersistence } from './lib/firebase.ts';
import {
  subscribeToRealtimeItems, subscribeToRealtimeClaims, saveItemToFirestore, updateItemStatusInFirestore,
  deleteItemFromFirestore, saveClaimToFirestore, updateClaimStatusInFirestore, syncUserProfile,
  fetchUserRole, subscribeToRealtimeNotifications, saveNotificationToFirestore, markNotificationAsReadInFirestore,
  fetchApprovedHandoverContact,
} from './services/firestoreService.ts';
import {
  playNotificationChime,
  sendBrowserPushNotification,
  clearNotificationStorage,
} from './services/notificationService.ts';
import type { DemoPersonaOption } from './data/demoPersonas.ts';

const AdminPanel = lazy(() => import('./components/AdminPanel.tsx').then((m) => ({ default: m.AdminPanel })));
const PrivacyModal = lazy(() => import('./components/PrivacyModal.tsx').then((m) => ({ default: m.PrivacyModal })));
const ReportModal = lazy(() => import('./components/ReportModal.tsx').then((m) => ({ default: m.ReportModal })));
const ClaimModal = lazy(() => import('./components/ClaimModal.tsx').then((m) => ({ default: m.ClaimModal })));
const LoginPage = lazy(() => import('./components/LoginPage.tsx').then((m) => ({ default: m.LoginPage })));

const readJson = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

const safeSetStorage = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Ignore storage quota or restricted environments
  }
};

const safeRemoveStorage = (key: string) => {
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignore
  }
};

export default function App() {
  const [isSimulating, setIsSimulating] = useState(() =>
    import.meta.env.DEV && localStorage.getItem('nilefound_admin_simulating') === 'true'
  );
  const isSimulatingRef = useRef(isSimulating);
  useEffect(() => { isSimulatingRef.current = isSimulating; }, [isSimulating]);

  const [isDemoMode, setIsDemoMode] = useState(() =>
    import.meta.env.DEV && localStorage.getItem('nilefound_admin_simulating') === 'true'
  );
  const [devPersonas, setDevPersonas] = useState<DemoPersonaOption[]>([]);
  const [realUser, setRealUser] = useState<User | null>(null);
  const [items, setItems] = useState<CampusItem[]>([]);
  const [itemsPageLimit, setItemsPageLimit] = useState(20);
  const [hasMoreItems, setHasMoreItems] = useState(false);
  const [isLoadingMoreItems, setIsLoadingMoreItems] = useState(false);
  const [itemsError, setItemsError] = useState<string | null>(null);
  const [itemsRetryNonce, setItemsRetryNonce] = useState(0);
  const [claims, setClaims] = useState<ClaimRecord[]>([]);

  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    if (import.meta.env.DEV && localStorage.getItem('nilefound_admin_simulating') === 'true') {
      const persona = readJson<User | null>('nilefound_simulated_persona', null);
      if (persona) return persona;
    }
    return import.meta.env.DEV ? readJson<User | null>('nilefound_user_v1', null) : null;
  });

  const [activeTab, setActiveTab] = useState<AppTab>('feed');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [lowDataMode, setLowDataMode] = useState(() => {
    try { return localStorage.getItem('nilefound_low_data') === 'true'; } catch { return false; }
  });
  const [isDarkMode, setIsDarkMode] = useState(() => {
    try { return localStorage.getItem('nilefound_theme') === 'dark'; } catch { return false; }
  });
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportPrefill, setReportPrefill] = useState<Partial<Pick<CampusItem, 'type' | 'title' | 'category' | 'location'>> | null>(null);
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);
  const [selectedItemForClaim, setSelectedItemForClaim] = useState<CampusItem | null>(null);
  const [savedDraftCount, setSavedDraftCount] = useState(0);
  const [notifications, setNotifications] = useState<CampusNotification[]>([]);
  const [activeToast, setActiveToast] = useState<CampusNotification | null>(null);
  const hasLoadedInitialNotificationsRef = useRef(false);

  const isRealUserAdmin = realUser?.role === 'admin' || realUser?.isAdmin;
  const isPrivileged = currentUser?.role === 'admin' || currentUser?.isAdmin || currentUser?.role === 'security';
  const canUsePersonaSimulation = Boolean(import.meta.env.DEV && (isRealUserAdmin || currentUser?.role === 'admin' || isSimulating));

  useEffect(() => {
    if (import.meta.env.DEV) {
      import('./data/demoPersonas.ts').then((m) => setDevPersonas(m.DEV_TEST_PERSONAS)).catch(() => {});
      if (isSimulating && items.length === 0) {
        import('./data/mockItems.ts').then((m) => {
          setItems(readJson('nilefound_demo_items_v1', m.DEMO_ITEMS));
          setClaims(readJson('nilefound_demo_claims_v1', m.DEMO_CLAIMS));
        }).catch(() => {});
      }
    }
  }, [isSimulating]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
    safeSetStorage('nilefound_theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  // Scrub legacy unencrypted real-mode item/claim storage if present from older builds.
  useEffect(() => {
    safeRemoveStorage('nilefound_real_items_v1');
    safeRemoveStorage('nilefound_real_claims_v1');
    if (!import.meta.env.DEV) {
      safeRemoveStorage('nilefound_user_v1');
      safeRemoveStorage('nilefound_admin_simulating');
      safeRemoveStorage('nilefound_simulated_persona');
    }
  }, []);

  useEffect(() => {
    if (realUser && !isRealUserAdmin && !isSimulating) {
      setIsSimulating(false);
      setIsDemoMode(false);
      safeRemoveStorage('nilefound_admin_simulating');
      safeRemoveStorage('nilefound_simulated_persona');
    }
  }, [realUser, isRealUserAdmin, isSimulating]);

  useEffect(() => {
    if (currentUser && activeTab === 'login') setActiveTab(isPrivileged ? 'admin' : 'feed');
  }, [currentUser, activeTab, isPrivileged]);

  useEffect(() => {
    if (!import.meta.env.DEV || !isDemoMode) return;
    safeSetStorage('nilefound_demo_items_v1', JSON.stringify(items));
    safeSetStorage('nilefound_demo_claims_v1', JSON.stringify(claims));
  }, [items, claims, isDemoMode]);

  useEffect(() => { safeSetStorage('nilefound_low_data', String(lowDataMode)); }, [lowDataMode]);
  useEffect(() => { testConnection(); }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser?.email) {
        const email = fbUser.email.trim().toLowerCase();
        if (!fbUser.emailVerified) {
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
        if (!isSimulatingRef.current) {
          setCurrentUser(user);
          syncUserProfile(user).catch(() => {});
        }
      } else {
        setRealUser(null);
        setCurrentUser(null);
        setItems([]);
        setClaims([]);
        setNotifications([]);
        setIsSimulating(false);
        setIsDemoMode(false);
        safeRemoveStorage('nilefound_user_v1');
        safeRemoveStorage('nilefound_admin_simulating');
        safeRemoveStorage('nilefound_simulated_persona');
        setActiveTab('login');
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (isDemoMode || !currentUser || !auth.currentUser?.emailVerified) return;
    setItemsError(null);
    const unsubscribeItems = subscribeToRealtimeItems(
      itemsPageLimit,
      (liveItems, hasMore) => {
        setItems(liveItems);
        setHasMoreItems(hasMore);
        setIsLoadingMoreItems(false);
        setItemsError(null);
      },
      () => {
        setIsLoadingMoreItems(false);
        setItemsError('Could not load campus notices. Check your connection and try again.');
      }
    );

    const unsubscribeClaims = subscribeToRealtimeClaims(currentUser, setClaims, () => {});
    return () => {
      unsubscribeItems();
      unsubscribeClaims();
    };
  }, [isDemoMode, currentUser, itemsPageLimit, itemsRetryNonce]);

  useEffect(() => {
    hasLoadedInitialNotificationsRef.current = false;
    if (isDemoMode || !currentUser || !auth.currentUser?.emailVerified) {
      setNotifications([]);
      return;
    }
    return subscribeToRealtimeNotifications(
      currentUser,
      (realtimeNotifs) => {
        setNotifications((prev) => {
          if (!hasLoadedInitialNotificationsRef.current) {
            hasLoadedInitialNotificationsRef.current = true;
            return realtimeNotifs;
          }
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
    try {
      if (localStorage.getItem('nilefound_report_draft_v1')) setSavedDraftCount(1);
    } catch {}
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const dispatchNotification = (
    payload: Omit<CampusNotification, 'id' | 'read' | 'createdAt'>,
    { toast = false, push = false } = {}
  ) => {
    const record: CampusNotification = {
      ...payload,
      id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      read: false,
      createdAt: new Date().toISOString(),
    };
    if (!isDemoMode) saveNotificationToFirestore(record).catch(() => {});
    const isForCurrentUser =
      record.recipientUid === currentUser?.id || (record.recipientUid === 'admin' && (currentUser?.isAdmin || currentUser?.role === 'security'));
    if (isForCurrentUser) {
      setNotifications((prev) => [record, ...prev]);
      if (toast) {
        playNotificationChime();
        setActiveToast(record);
        if (push) sendBrowserPushNotification(record.title, { body: record.message });
      }
    }
  };

  const handleSwitchPersona = async (user: User) => {
    if (import.meta.env.DEV) {
      setIsSimulating(true);
      setIsDemoMode(true);
      setCurrentUser(user);
      safeSetStorage('nilefound_admin_simulating', 'true');
      safeSetStorage('nilefound_simulated_persona', JSON.stringify(user));
      try {
        const m = await import('./data/mockItems.ts');
        setItems(readJson('nilefound_demo_items_v1', m.DEMO_ITEMS));
        setClaims(readJson('nilefound_demo_claims_v1', m.DEMO_CLAIMS));
      } catch {}
      setActiveTab(user.role === 'admin' || user.role === 'security' ? 'admin' : 'feed');
    }
  };

  const handleExitSimulation = () => {
    setIsSimulating(false);
    setIsDemoMode(false);
    safeRemoveStorage('nilefound_admin_simulating');
    safeRemoveStorage('nilefound_simulated_persona');
    if (realUser) {
      setCurrentUser(realUser);
      setActiveTab(realUser.role === 'admin' || realUser.role === 'security' ? 'admin' : 'feed');
    } else {
      setCurrentUser(null);
      setActiveTab('login');
    }
  };

  const handleLoadMoreItems = useCallback(() => {
    if (isLoadingMoreItems || !hasMoreItems) return;
    setIsLoadingMoreItems(true);
    setItemsPageLimit((prev) => prev + 20);
  }, [isLoadingMoreItems, hasMoreItems]);

  const handleLoadAllItems = useCallback(async () => {
    if (isLoadingMoreItems || !hasMoreItems) return;
    setIsLoadingMoreItems(true);
    setItemsPageLimit((prev) => Math.max(prev + 100, 200));
  }, [isLoadingMoreItems, hasMoreItems]);

  const handleAddItem = async (newItem: CampusItem): Promise<boolean> => {
    let finalItemId = newItem.id;
    if (isDemoMode) {
      setItems((prev) => [newItem, ...prev]);
    } else {
      // Never swallow failures silently or keep local state when Firestore write fails (#79).
      finalItemId = await saveItemToFirestore(newItem, currentUser);
      setItems((prev) => [{ ...newItem, id: finalItemId }, ...prev]);
    }
    setSavedDraftCount(0);

    const fromUid = auth.currentUser?.uid || currentUser?.id || 'student';
    const oppositeType = newItem.type === 'found' ? 'lost' : 'found';
    const scoredMatches = items
      .filter((it) => it.type === oppositeType && it.status === 'open')
      .map((it) => ({
        item: it,
        result: calculateMatchScore(newItem.type === 'lost' ? newItem : it, newItem.type === 'found' ? newItem : it),
      }))
      .filter(({ result }) => result.isLikelyMatch)
      .sort((a, b) => b.result.score - a.result.score)
      .slice(0, 3);

    if (newItem.type === 'found') {
      scoredMatches.forEach(({ item: lostItem }) => {
        if (lostItem.authorId && lostItem.authorId !== fromUid) {
          dispatchNotification({
            recipientUid: lostItem.authorId,
            fromUid,
            type: 'match_alert',
            title: `Possible match: ${lostItem.title}`,
            message: `A found item reported at ${newItem.location} matches your notice.`,
            itemId: lostItem.id,
            sourceItemId: finalItemId,
          });
        }
      });
    } else if (scoredMatches.length > 0) {
      const topFound = scoredMatches[0].item;
      dispatchNotification({
        recipientUid: fromUid,
        fromUid,
        type: 'match_alert',
        title: `Possible match found: ${newItem.title}`,
        message: `A matching ${newItem.category.replace(/_/g, ' ')} was reported at ${topFound.location}. Check the feed to claim it.`,
        itemId: topFound.id,
      });
    }

    dispatchNotification(
      {
        recipientUid: 'admin',
        fromUid,
        type: 'admin_review',
        title: `New ${newItem.type.toUpperCase()}: ${newItem.title}`,
        message: `A new ${newItem.type} item was reported at ${newItem.location}.`,
        itemId: finalItemId,
      },
      { toast: true, push: true }
    );
    return true;
  };

  const handleClaimSuccess = async (newClaim: ClaimRecord) => {
    const fromUid = auth.currentUser?.uid || currentUser?.id || 'claimant';
    const matchingItem = items.find((i) => i.id === newClaim.itemId);
    let finalClaimId = newClaim.id;
    if (isDemoMode) {
      setClaims((prev) => [{ ...newClaim, claimantId: fromUid }, ...prev]);
      setItems((prev) => prev.map((it) => (it.id === newClaim.itemId ? { ...it, status: 'claim_requested' } : it)));
    } else {
      finalClaimId = await saveClaimToFirestore(newClaim, currentUser, matchingItem?.authorId);
      setItems((prev) => prev.map((it) => (it.id === newClaim.itemId ? { ...it, status: 'claim_requested' } : it)));
    }

    if (matchingItem?.authorId && matchingItem.authorId !== fromUid) {
      dispatchNotification({
        recipientUid: matchingItem.authorId,
        fromUid,
        type: 'claim_received',
        title: `New claim on ${matchingItem.title}`,
        message: 'A new ownership claim was filed for your found item. Review it on the card.',
        itemId: matchingItem.id,
        claimId: finalClaimId,
      });
    }
    dispatchNotification(
      {
        recipientUid: 'admin',
        fromUid,
        type: 'admin_review',
        title: `Claim needs review: ${matchingItem?.title || 'Campus Item'}`,
        message: `An ownership claim was filed for "${matchingItem?.title || 'item'}".`,
        itemId: newClaim.itemId,
        claimId: finalClaimId,
      },
      { toast: true }
    );
  };

  const handleApproveClaim = async (claimId: string, itemId: string) => {
    const fromUid = auth.currentUser?.uid || currentUser?.id || 'admin';
    const claim = claims.find((c) => c.id === claimId);
    if (!isDemoMode) {
      await updateClaimStatusInFirestore(claimId, itemId, 'approved');
    }
    setClaims((prev) => prev.map((c) => (c.id === claimId ? { ...c, status: 'approved' } : c)));
    setItems((prev) => prev.map((it) => (it.id === itemId ? { ...it, status: 'verified' } : it)));

    if (claim?.claimantId) {
      dispatchNotification({
        recipientUid: claim.claimantId,
        fromUid,
        type: 'claim_approved',
        title: `Claim approved: ${claim.itemTitle}`,
        message: `Your claim for "${claim.itemTitle}" was approved. Arrange collection from the custodian or security post.`,
        itemId: claim.itemId,
        claimId: claim.id,
      });
    }
  };

  const handleRejectClaim = async (claimId: string) => {
    const fromUid = auth.currentUser?.uid || currentUser?.id || 'admin';
    const claim = claims.find((c) => c.id === claimId);
    if (!claim) return;
    const otherPendingCount = claims.filter(
      (c) => c.itemId === claim.itemId && c.id !== claimId && c.status === 'pending'
    ).length;

    let nextItemStatus: CampusItem['status'] = otherPendingCount === 0 ? 'open' : 'claim_requested';
    if (!isDemoMode) {
      nextItemStatus = await updateClaimStatusInFirestore(claimId, claim.itemId, 'rejected', otherPendingCount);
    }
    setClaims((prev) => prev.map((c) => (c.id === claimId ? { ...c, status: 'rejected' } : c)));
    setItems((prev) => prev.map((it) => (it.id === claim.itemId ? { ...it, status: nextItemStatus } : it)));

    if (claim.claimantId) {
      dispatchNotification({
        recipientUid: claim.claimantId,
        fromUid,
        type: 'claim_rejected',
        title: `Claim rejected: ${claim.itemTitle}`,
        message: `Your verification answer for "${claim.itemTitle}" could not be confirmed. Contact Campus Security if needed.`,
        itemId: claim.itemId,
        claimId: claim.id,
      });
    }
  };

  const handleUpdateItemStatus = async (itemId: string, status: CampusItem['status']) => {
    const fromUid = auth.currentUser?.uid || currentUser?.id || 'admin';
    if (!isDemoMode) {
      await updateItemStatusInFirestore(itemId, status);
    }
    setItems((prev) => prev.map((it) => (it.id === itemId ? { ...it, status } : it)));
    if (status === 'returned') {
      const target = items.find((i) => i.id === itemId);
      if (target?.authorId) {
        dispatchNotification({
          recipientUid: target.authorId,
          fromUid,
          type: 'item_returned',
          title: `Item returned: ${target.title}`,
          message: `"${target.title}" was handed over and marked returned.`,
          itemId: target.id,
        });
      }
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!isDemoMode) {
      await deleteItemFromFirestore(itemId);
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
    setItems([]);
    setClaims([]);
    setNotifications([]);
    setSavedDraftCount(0);

    safeRemoveStorage('nilefound_user_v1');
    safeRemoveStorage('nilefound_admin_simulating');
    safeRemoveStorage('nilefound_simulated_persona');
    safeRemoveStorage('nilefound_report_draft_v1');
    try { sessionStorage.removeItem('nilefound_feed_filters'); } catch {}
    clearNotificationStorage();

    await clearOfflinePersistence();
    setCurrentUser(null);
    setActiveTab('feed');
  };

  return (
    <ErrorBoundary>
      <MotionConfig reducedMotion="user">
        <div className="min-h-screen bg-[var(--color-paper)] text-[var(--color-ink)] flex flex-col font-sans selection:bg-[#0F6E6E] selection:text-white transition-colors duration-150">
          <Navbar
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            isOnline={isOnline}
            lowDataMode={lowDataMode}
            setLowDataMode={setLowDataMode}
            isDemoMode={isDemoMode}
            setIsDemoMode={(v) => (v ? setIsDemoMode(true) : handleExitSimulation())}
            onOpenReportModal={() => { setReportPrefill(null); setIsReportModalOpen(true); }}
            savedDraftCount={savedDraftCount}
            currentUser={currentUser}
            pendingClaimsCount={claims.filter((c) => c.status === 'pending').length}
            notifications={notifications}
            onMarkAllAsRead={() => {
              setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
              notifications.forEach((n) => {
                if (!n.read) markNotificationAsReadInFirestore(n.id).catch(() => {});
              });
            }}
            onMarkAsRead={(id) => {
              setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
              markNotificationAsReadInFirestore(id).catch(() => {});
            }}
            onSelectNotificationItem={handleSelectNotificationItem}
            isDarkMode={isDarkMode}
            onToggleDarkMode={() => setIsDarkMode((prev) => !prev)}
            onLogout={handleLogout}
          />

          {canUsePersonaSimulation && isSimulating && (
            <div className="bg-[#FAF6EF] dark:bg-[#1E1C18] border-b border-[#C4BBAF] dark:border-[#3E3931] px-4 py-2.5 text-sm flex flex-wrap items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#E8A317]" />
                <span className="font-bold text-[#1F1B16] dark:text-[#F5F1EA]">Dev Simulation:</span>
                <span className="text-[#4A443C] dark:text-[#CEC7BB]">
                  Viewing as <strong className="text-[#0F6E6E] dark:text-[#199595] font-bold">{currentUser?.name}</strong> ({currentUser?.role})
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('admin')}
                  className="bg-white dark:bg-[#28241F] hover:bg-[#F5EFE4] dark:hover:bg-[#332E27] text-[#1F1B16] dark:text-[#F5F1EA] px-3 py-1.5 min-h-[44px] rounded-[10px] text-sm font-medium border border-[#A39A8C] dark:border-[#5A5349] transition-colors cursor-pointer btn-campus"
                >
                  Switch Persona
                </button>
                <button
                  type="button"
                  onClick={handleExitSimulation}
                  className="bg-[#0F6E6E] hover:bg-[#0C5656] text-white px-3.5 py-1.5 min-h-[44px] rounded-[10px] text-sm font-semibold transition-all cursor-pointer shadow-xs btn-campus"
                >
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
                  claims={claims}
                  lowDataMode={lowDataMode}
                  itemsError={itemsError}
                  onRetryLoadItems={() => setItemsRetryNonce((n) => n + 1)}
                  onClaimItem={(item) => (currentUser ? setSelectedItemForClaim(item) : setActiveTab('login'))}
                  onOpenReportModal={() => { setReportPrefill(null); setIsReportModalOpen(true); }}
                  onFoundMatch={(lostItem) => {
                    setReportPrefill({
                      type: 'found',
                      category: lostItem.category,
                      location: lostItem.location,
                      title: lostItem.title,
                    });
                    setIsReportModalOpen(true);
                  }}
                  onFetchHandoverContact={(itemId) =>
                    isDemoMode
                      ? Promise.resolve({ authorName: 'Finder', authorEmail: 'finder@nileuniversity.edu.ng' })
                      : fetchApprovedHandoverContact(itemId)
                  }
                  onApproveClaim={handleApproveClaim}
                  onRejectClaim={handleRejectClaim}
                  currentUser={currentUser}
                  isDemoMode={isDemoMode}
                  onNavigateToLogin={() => setActiveTab('login')}
                  onLoadMore={handleLoadMoreItems}
                  onLoadAll={handleLoadAllItems}
                  hasMoreItems={hasMoreItems}
                  isLoadingMoreItems={isLoadingMoreItems}
                />
              )}

              {activeTab === 'admin' && (
                <Suspense fallback={<div className="p-6 text-sm text-[#4A443C] dark:text-[#CEC7BB]">Loading operations desk…</div>}>
                  <AdminPanel
                    currentUser={currentUser}
                    items={items}
                    claims={claims}
                    hasMoreItems={hasMoreItems}
                    onLoadAll={handleLoadAllItems}
                    onUpdateItemStatus={handleUpdateItemStatus}
                    onDeleteItem={handleDeleteItem}
                    onApproveClaim={handleApproveClaim}
                    onRejectClaim={handleRejectClaim}
                    onExpireOldItems={() => setItems((prev) => expireOldItems(prev, 60))}
                    onNavigateToLogin={() => setActiveTab('login')}
                    onSwitchPersona={canUsePersonaSimulation ? handleSwitchPersona : undefined}
                    devPersonas={devPersonas}
                  />
                </Suspense>
              )}

              {activeTab === 'login' && (
                <Suspense fallback={<div className="p-6 text-sm text-[#4A443C] dark:text-[#CEC7BB]">Loading sign-in…</div>}>
                  <LoginPage
                    currentUser={currentUser}
                    onLogin={(user) => {
                      if (import.meta.env.DEV && user.id.startsWith('demo-') && isSimulating) return handleSwitchPersona(user);
                      setCurrentUser(user);
                      setActiveTab(user.role === 'admin' || user.role === 'security' ? 'admin' : 'feed');
                    }}
                    onLogout={handleLogout}
                    onNavigateToFeed={() => setActiveTab('feed')}
                    isDemoMode={isDemoMode}
                  />
                </Suspense>
              )}
            </motion.div>
          </main>

          {isReportModalOpen && (
            <Suspense fallback={null}>
              <ReportModal
                isOpen={isReportModalOpen}
                onClose={() => { setIsReportModalOpen(false); setReportPrefill(null); }}
                onSubmitItem={handleAddItem}
                onDraftSaved={() => setSavedDraftCount(1)}
                currentUser={currentUser}
                initialPrefill={reportPrefill}
                onOpenLogin={() => { setIsReportModalOpen(false); setActiveTab('login'); }}
              />
            </Suspense>
          )}

          {selectedItemForClaim && (
            <Suspense fallback={null}>
              <ClaimModal item={selectedItemForClaim} onClose={() => setSelectedItemForClaim(null)} onSuccessClaim={handleClaimSuccess} />
            </Suspense>
          )}

          <NotificationToast
            notification={activeToast}
            onDismiss={() => setActiveToast(null)}
            onView={(notif) => setActiveTab(notif.linkTab === 'admin' && isPrivileged ? 'admin' : 'feed')}
          />

          {isPrivacyModalOpen && (
            <Suspense fallback={null}>
              <PrivacyModal isOpen={isPrivacyModalOpen} onClose={() => setIsPrivacyModalOpen(false)} />
            </Suspense>
          )}

          {activeTab === 'feed' && (
            <button
              type="button"
              onClick={() => setIsReportModalOpen(true)}
              className="sm:hidden fixed right-4 bottom-4 z-40 min-h-12 px-5 bg-[#0F6E6E] hover:bg-[#0C5656] text-white rounded-[10px] shadow-lg font-semibold text-sm cursor-pointer btn-campus"
              aria-label="Report an item"
            >
              + Report
            </button>
          )}

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
      </MotionConfig>
    </ErrorBoundary>
  );
}
