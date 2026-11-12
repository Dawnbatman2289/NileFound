/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * NileFound - Production Pilot Web App
 * Engineered for Nile University of Nigeria, Abuja
 * Layout: Responsive single-page layout with Nile Blue & White branding.
 * Main Action: Browse campus listings, report lost/found items, and verify ownership claims.
 */

import React, { lazy, Suspense, useState, useEffect, useRef } from 'react';
import type { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { motion } from 'motion/react';
import { Navbar, AppTab } from './components/Navbar.tsx';
import { FeedView } from './components/FeedView.tsx';
const AdminPanel = lazy(() => import('./components/AdminPanel.tsx').then((module) => ({ default: module.AdminPanel })));
import { LoginPage } from './components/LoginPage.tsx';
import { ReportModal } from './components/ReportModal.tsx';
import { ClaimModal } from './components/ClaimModal.tsx';
const PrivacyModal = lazy(() => import('./components/PrivacyModal.tsx').then((module) => ({ default: module.PrivacyModal })));
import { NotificationToast } from './components/NotificationToast.tsx';
import { CampusItem, ClaimRecord, User, CampusNotification } from './types/index.ts';
import { DEMO_ITEMS, DEMO_CLAIMS, INITIAL_ITEMS, INITIAL_CLAIMS } from './data/mockItems.ts';
import { expireOldItems } from './utils/admin.ts';
import { isMasterAdminEmail } from './utils/authValidation.ts';
import { auth, testConnection } from './lib/firebase.ts';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import {
  fetchItemsPage,
  subscribeToRealtimeClaims,
  saveItemToFirestore,
  updateItemStatusInFirestore,
  deleteItemFromFirestore,
  saveClaimToFirestore,
  updateClaimStatusInFirestore,
  syncUserProfile,
  fetchUserRole,
  subscribeToRealtimeNotifications,
  saveNotificationToFirestore,
  markNotificationAsReadInFirestore,
} from './services/firestoreService.ts';
import {
  playNotificationChime,
  sendBrowserPushNotification,
} from './services/notificationService.ts';

export default function App() {
  // Admin Simulation mode: strictly reserved for the project owner.
  const [isSimulating, setIsSimulating] = useState<boolean>(() => {
    return localStorage.getItem('nilefound_admin_simulating') === 'true';
  });

  const isSimulatingRef = useRef(isSimulating);
  useEffect(() => {
    isSimulatingRef.current = isSimulating;
  }, [isSimulating]);

  // Demo Mode is enabled during an owner-controlled persona simulation.
  const [isDemoMode, setIsDemoMode] = useState<boolean>(() => {
    return localStorage.getItem('nilefound_admin_simulating') === 'true';
  });

  // Real authenticated user (tracks underlying Firebase identity while simulating other personas)
  const [realUser, setRealUser] = useState<User | null>(null);

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

    return INITIAL_ITEMS;
  });
  const [itemsCursor, setItemsCursor] = useState<QueryDocumentSnapshot<DocumentData>>();
  const [hasMoreItems, setHasMoreItems] = useState(true);
  const [isLoadingMoreItems, setIsLoadingMoreItems] = useState(false);

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

    return INITIAL_CLAIMS;
  });

  // Active user session (can be real user or simulated persona)
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const isSimulating = localStorage.getItem('nilefound_admin_simulating') === 'true';
    if (isSimulating) {
      const savedPersona = localStorage.getItem('nilefound_simulated_persona');
      if (savedPersona) {
        try {
          return JSON.parse(savedPersona);
        } catch {
          // ignore
        }
      }
    }
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
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('nilefound_theme') === 'dark';
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('nilefound_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('nilefound_theme', 'light');
    }
  }, [isDarkMode]);

  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);
  const [selectedItemForClaim, setSelectedItemForClaim] = useState<CampusItem | null>(null);
  const [savedDraftCount, setSavedDraftCount] = useState<number>(0);

  // Campus Notifications and Admin Alerts
  const [notifications, setNotifications] = useState<CampusNotification[]>(() => {
    return [];
  });
  const [activeToast, setActiveToast] = useState<CampusNotification | null>(null);

  const isRealUserAdmin = realUser?.role === 'admin' || realUser?.isAdmin;
  const canUsePersonaSimulation = Boolean(
    import.meta.env.DEV && (isRealUserAdmin || currentUser?.role === 'admin' || isSimulating)
  );

  useEffect(() => {
    if (realUser && !isRealUserAdmin && !isSimulating) {
      setIsSimulating(false);
      setIsDemoMode(false);
      localStorage.removeItem('nilefound_admin_simulating');
      localStorage.removeItem('nilefound_simulated_persona');
    }
  }, [realUser, isRealUserAdmin, isSimulating]);

  useEffect(() => {
    if (currentUser && activeTab === 'login') {
      const isPrivilegedUser = currentUser.role === 'admin' || currentUser.role === 'security' || currentUser.isAdmin;
      setActiveTab(isPrivilegedUser ? 'admin' : 'feed');
    }
  }, [currentUser, activeTab]);

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

  // Switch to simulated persona (project owner only)
  const handleSwitchPersona = (user: User) => {
    setIsSimulating(true);
    setIsDemoMode(true);
    setCurrentUser(user);
    localStorage.setItem('nilefound_admin_simulating', 'true');
    localStorage.setItem('nilefound_simulated_persona', JSON.stringify(user));
    const saved = localStorage.getItem('nilefound_demo_items_v1');
    setItems(saved ? JSON.parse(saved) : DEMO_ITEMS);
    const savedClaims = localStorage.getItem('nilefound_demo_claims_v1');
    setClaims(savedClaims ? JSON.parse(savedClaims) : DEMO_CLAIMS);
    if (user.role === 'admin' || user.role === 'security') {
      setActiveTab('admin');
    } else {
      setActiveTab('feed');
    }
  };

  // Exit simulation and return to real authenticated user
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

  // Handle switching between Demo Mode and Real Mode
  const handleToggleDemoMode = (newMode: boolean) => {
    if (!newMode) {
      handleExitSimulation();
    } else {
      setIsDemoMode(true);
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
        const email = fbUser.email.trim().toLowerCase();
        const isMaster = isMasterAdminEmail(email);

        if (!fbUser.emailVerified && !isMaster) {
          setRealUser(null);
          if (!isSimulatingRef.current) setCurrentUser(null);
          return;
        }

        // Pre-validate token retrieval before setting active state
        try {
          await fbUser.getIdToken(false);
        } catch (tokenErr: any) {
          await signOut(auth);
          setRealUser(null);
          if (!isSimulatingRef.current) {
            setCurrentUser(null);
          }
          return;
        }

        // Check role in /roles/{uid} or bootstrapped admin
        const assignedRole = await fetchUserRole(fbUser.uid, email);
        const role = assignedRole;

        const user: User = {
          id: fbUser.uid,
          name: (fbUser.displayName || email.split('@')[0]).split(' ')[0],
          email,
          role,
          isAdmin: role === 'admin',
          department: role === 'admin'
            ? 'University Administration'
            : role === 'security'
            ? (assignedRole === 'security' ? 'Campus Security & Safety' : 'University Administration')
            : 'Nile University Member',
        };
        setRealUser(user);

        const isCurrentlySimulating = isSimulatingRef.current || localStorage.getItem('nilefound_admin_simulating') === 'true';
        if (!isCurrentlySimulating) {
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

  // Real-time Firestore sync when in real mode
  useEffect(() => {
    if (isDemoMode || !currentUser || !auth.currentUser?.emailVerified) return;

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
      .catch(() => {
        if (!cancelled) setItems([]);
      });

    // Claims subscription (requires authenticated user)
    let unsubscribeClaims = () => {};
    if (currentUser) {
      unsubscribeClaims = subscribeToRealtimeClaims(
        currentUser,
        (realtimeClaims) => {
          setClaims(realtimeClaims);
        },
        (err) => {
        }
      );
    } else {
      setClaims([]);
    }

    return () => {
      cancelled = true;
      unsubscribeClaims();
    };
  }, [isDemoMode, currentUser]);

  const handleLoadMoreItems = async () => {
    if (!itemsCursor || isLoadingMoreItems || !hasMoreItems) return;
    setIsLoadingMoreItems(true);
    try {
      const page = await fetchItemsPage(itemsCursor);
      setItems((previous) => [...previous, ...page.items]);
      setItemsCursor(page.nextCursor);
      setHasMoreItems(Boolean(page.nextCursor));
    } finally {
      setIsLoadingMoreItems(false);
    }
  };

  // Real-time campus & admin notifications subscription
  useEffect(() => {
    if (isDemoMode || !currentUser || !auth.currentUser?.emailVerified) {
      setNotifications([]);
      return;
    }
    const unsubscribeNotifs = subscribeToRealtimeNotifications(
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
      (err) => {
      }
    );
    return () => unsubscribeNotifs();
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

    const currentUid = auth.currentUser?.uid || currentUser?.id || 'student';

    // Event 3: Check for matches (same category AND same campus location)
    if (newItem.type === 'found') {
      const matchingLost = items.filter(
        (it) =>
          it.type === 'lost' &&
          it.status === 'open' &&
          it.category === newItem.category &&
          it.location.trim().toLowerCase() === newItem.location.trim().toLowerCase()
      );
      for (const lostItem of matchingLost) {
        if (lostItem.authorId && lostItem.authorId !== currentUid) {
          const matchNotif = {
            recipientUid: lostItem.authorId,
            fromUid: currentUid,
            type: 'match_alert' as const,
            title: `Possible match: ${lostItem.title}`,
            message: `A found item in the same category was just reported at ${newItem.location}. Check the feed!`,
            read: false,
            createdAt: new Date().toISOString(),
            itemId: lostItem.id,
          };
          if (!isDemoMode) saveNotificationToFirestore(matchNotif).catch(() => {});
          if (matchNotif.recipientUid === currentUser?.id) {
            setNotifications((prev) => [{ ...matchNotif, id: `notif-match-${Date.now()}-${lostItem.id}` }, ...prev]);
          }
        }
      }
    } else if (newItem.type === 'lost') {
      const matchingFound = items.find(
        (it) =>
          it.type === 'found' &&
          it.status === 'open' &&
          it.category === newItem.category &&
          it.location.trim().toLowerCase() === newItem.location.trim().toLowerCase()
      );
      if (matchingFound) {
        const matchNotif = {
          recipientUid: currentUid,
          fromUid: currentUid,
          type: 'match_alert' as const,
          title: `Possible match found: ${newItem.title}`,
          message: `A matching ${newItem.category.replace(/_/g, ' ')} was already turned in at ${matchingFound.location}. Check feed to claim it.`,
          read: false,
          createdAt: new Date().toISOString(),
          itemId: matchingFound.id,
        };
        if (!isDemoMode) saveNotificationToFirestore(matchNotif).catch(() => {});
        if (matchNotif.recipientUid === currentUser?.id) {
          setNotifications((prev) => [{ ...matchNotif, id: `notif-match-${Date.now()}` }, ...prev]);
        }
      }
    }

    // Event 5: (admin) a new item needs review
    const adminNotif = {
      recipientUid: 'admin',
      fromUid: currentUid,
      type: 'admin_review' as const,
      title: `New ${newItem.type.toUpperCase()}: ${newItem.title}`,
      message: `A new ${newItem.type} item was reported at ${newItem.location}. Verification review required.`,
      read: false,
      createdAt: new Date().toISOString(),
      itemId: finalItemId,
    };

    if (!isDemoMode) {
      saveNotificationToFirestore(adminNotif).catch(() => {});
    }

    const localCreated: CampusNotification = {
      ...adminNotif,
      id: `notif-${Date.now()}`,
    };
    if (localCreated.recipientUid === currentUser?.id || (localCreated.recipientUid === 'admin' && currentUser?.isAdmin)) {
      setNotifications((prev) => [localCreated, ...prev]);
    }

    if (localCreated.recipientUid === currentUser?.id || (localCreated.recipientUid === 'admin' && currentUser?.isAdmin)) {
      playNotificationChime();
      setActiveToast(localCreated);
      sendBrowserPushNotification(localCreated.title, { body: localCreated.message });
    }
    return true;
  };

  const handleClaimSuccess = async (newClaim: ClaimRecord) => {
    const currentUid = auth.currentUser?.uid || currentUser?.id || 'claimant';
    const matchingItem = items.find((i) => i.id === newClaim.itemId);

    if (isDemoMode) {
      setClaims((prev) => [{ ...newClaim, claimantId: currentUid }, ...prev]);
      setItems((prev) =>
        prev.map((it) => (it.id === newClaim.itemId ? { ...it, status: 'claim_requested' } : it))
      );
    } else {
      try {
        await saveClaimToFirestore(newClaim, currentUser, matchingItem?.authorId);
      } catch (err) {
        throw err;
      }
    }

    // Event 1: someone claims my found item (notify finder)
    if (matchingItem?.authorId && matchingItem.authorId !== currentUid) {
      const finderNotif = {
        recipientUid: matchingItem.authorId,
        fromUid: currentUid,
        type: 'claim_received' as const,
        title: `New claim on ${matchingItem.title}`,
        message: `A new ownership claim was filed for your found item. Review it in the Admin Desk.`,
        read: false,
        createdAt: new Date().toISOString(),
        itemId: matchingItem.id,
      };
      if (!isDemoMode) saveNotificationToFirestore(finderNotif).catch(() => {});
      if (finderNotif.recipientUid === currentUser?.id) {
        setNotifications((prev) => [{ ...finderNotif, id: `notif-claim-rec-${Date.now()}` }, ...prev]);
      }
    }

    // Event 5: (admin) a new claim needs review
    const claimAdminNotif = {
      recipientUid: 'admin',
      fromUid: currentUid,
      type: 'admin_review' as const,
      title: `Claim needs review: ${matchingItem?.title || 'Campus Item'}`,
      message: `A new ownership claim was filed for "${matchingItem?.title || 'item'}". Physical verification pending.`,
      read: false,
      createdAt: new Date().toISOString(),
      itemId: newClaim.itemId,
    };

    if (!isDemoMode) {
      saveNotificationToFirestore(claimAdminNotif).catch(() => {});
    }

    const localClaimNotif: CampusNotification = {
      ...claimAdminNotif,
      id: `notif-claim-${Date.now()}`,
    };
    if (localClaimNotif.recipientUid === currentUser?.id || (localClaimNotif.recipientUid === 'admin' && currentUser?.isAdmin)) {
      setNotifications((prev) => [localClaimNotif, ...prev]);
    }

    if (localClaimNotif.recipientUid === currentUser?.id || (localClaimNotif.recipientUid === 'admin' && currentUser?.isAdmin)) {
      playNotificationChime();
      setActiveToast(localClaimNotif);
    }
  };

  const handleApproveClaim = async (claimId: string, itemId: string) => {
    const currentUid = auth.currentUser?.uid || currentUser?.id || 'admin';
    const claim = claims.find((c) => c.id === claimId);

    if (isDemoMode) {
      setClaims((prev) =>
        prev.map((c) => (c.id === claimId ? { ...c, status: 'approved' } : c))
      );
      setItems((prev) =>
        prev.map((it) => (it.id === itemId ? { ...it, status: 'returned' } : it))
      );
    } else {
      try {
        await updateClaimStatusInFirestore(claimId, itemId, 'approved');
        setClaims((prev) =>
          prev.map((c) => (c.id === claimId ? { ...c, status: 'approved' } : c))
        );
        setItems((prev) =>
          prev.map((it) => (it.id === itemId ? { ...it, status: 'returned' } : it))
        );
      } catch {
      }
    }

    // Event 2: my claim is approved (notify claimant)
    if (claim?.claimantId) {
      const approvedNotif = {
        recipientUid: claim.claimantId,
        fromUid: currentUid,
        type: 'claim_approved' as const,
        title: `Claim approved: ${claim.itemTitle}`,
        message: `Your ownership claim for "${claim.itemTitle}" was approved. Collect it from campus security or designated office.`,
        read: false,
        createdAt: new Date().toISOString(),
        itemId: claim.itemId,
        claimId: claim.id,
      };
      if (!isDemoMode) saveNotificationToFirestore(approvedNotif).catch(() => {});
      if (approvedNotif.recipientUid === currentUser?.id) {
        setNotifications((prev) => [{ ...approvedNotif, id: `notif-appr-${Date.now()}` }, ...prev]);
      }
    }

    // Event 4: item is marked Returned (notify item author)
    const item = items.find((i) => i.id === itemId);
    if (item?.authorId && item.authorId !== currentUid) {
      const returnedNotif = {
        recipientUid: item.authorId,
        fromUid: currentUid,
        type: 'item_returned' as const,
        title: `Item returned: ${item.title}`,
        message: `"${item.title}" has been successfully reunited and marked as Returned.`,
        read: false,
        createdAt: new Date().toISOString(),
        itemId: item.id,
      };
      if (!isDemoMode) saveNotificationToFirestore(returnedNotif).catch(() => {});
      if (returnedNotif.recipientUid === currentUser?.id) {
        setNotifications((prev) => [{ ...returnedNotif, id: `notif-ret-${Date.now()}` }, ...prev]);
      }
    }
  };

  const handleRejectClaim = async (claimId: string) => {
    const currentUid = auth.currentUser?.uid || currentUser?.id || 'admin';
    const claim = claims.find((c) => c.id === claimId);
    if (!claim) return;

    if (isDemoMode) {
      setClaims((prev) =>
        prev.map((c) => (c.id === claimId ? { ...c, status: 'rejected' } : c))
      );
    } else {
      try {
        await updateClaimStatusInFirestore(claimId, claim.itemId, 'rejected');
        setClaims((prev) =>
          prev.map((c) => (c.id === claimId ? { ...c, status: 'rejected' } : c))
        );
      } catch {
      }
    }

    // Event 2: my claim is rejected (notify claimant)
    if (claim.claimantId) {
      const rejectedNotif = {
        recipientUid: claim.claimantId,
        fromUid: currentUid,
        type: 'claim_rejected' as const,
        title: `Claim rejected: ${claim.itemTitle}`,
        message: `Your verification answer for "${claim.itemTitle}" could not be confirmed. Contact Campus Security if this was an error.`,
        read: false,
        createdAt: new Date().toISOString(),
        itemId: claim.itemId,
        claimId: claim.id,
      };
      if (!isDemoMode) saveNotificationToFirestore(rejectedNotif).catch(() => {});
      if (rejectedNotif.recipientUid === currentUser?.id) {
        setNotifications((prev) => [{ ...rejectedNotif, id: `notif-rej-${Date.now()}` }, ...prev]);
      }
    }
  };

  const handleUpdateItemStatus = async (itemId: string, status: CampusItem['status']) => {
    const currentUid = auth.currentUser?.uid || currentUser?.id || 'admin';

    if (isDemoMode) {
      setItems((prev) =>
        prev.map((it) => (it.id === itemId ? { ...it, status } : it))
      );
    } else {
      try {
        await updateItemStatusInFirestore(itemId, status);
        setItems((prev) =>
          prev.map((it) => (it.id === itemId ? { ...it, status } : it))
        );
      } catch {
      }
    }

    // Event 4: my item is marked Returned
    if (status === 'returned') {
      const targetItem = items.find((i) => i.id === itemId);
      if (targetItem?.authorId) {
        const returnedNotif = {
          recipientUid: targetItem.authorId,
          fromUid: currentUid,
          type: 'item_returned' as const,
          title: `Item returned: ${targetItem.title}`,
          message: `"${targetItem.title}" has been successfully reunited and marked as Returned.`,
          read: false,
          createdAt: new Date().toISOString(),
          itemId: targetItem.id,
        };
        if (!isDemoMode) saveNotificationToFirestore(returnedNotif).catch(() => {});
        if (returnedNotif.recipientUid === currentUser?.id) {
          setNotifications((prev) => [{ ...returnedNotif, id: `notif-ret-${Date.now()}` }, ...prev]);
        }
      }
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
    } catch {
    }
  };

  const handleExpireOldItems = () => {
    setItems((prev) => expireOldItems(prev, 60));
  };

  const pendingClaimsCount = claims.filter((c) => c.status === 'pending').length;

  const handleMarkAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    notifications.forEach((n) => {
      if (!n.read) markNotificationAsReadInFirestore(n.id);
    });
  };

  const handleMarkAsRead = (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    markNotificationAsReadInFirestore(id);
  };

  const handleSelectNotificationItem = (itemId?: string, type?: string) => {
    if (type === 'admin_review' && isPrivileged) {
      setActiveTab('admin');
      return;
    }
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

  const isPrivileged = currentUser?.role === 'admin' || currentUser?.isAdmin || currentUser?.role === 'security';

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch {
      // Ignore if offline
    }
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
        notifications={notifications}
        onMarkAllAsRead={handleMarkAllAsRead}
        onMarkAsRead={handleMarkAsRead}
        onSelectNotificationItem={handleSelectNotificationItem}
        isDarkMode={isDarkMode}
        onToggleDarkMode={() => setIsDarkMode((prev) => !prev)}
        onLogout={handleLogout}
      />

      {/* Simulation Banner: visible only during an owner-controlled simulation. */}
      {canUsePersonaSimulation && isSimulating && (
        <div className="bg-[#FAF6EF] dark:bg-[#1E1C18] border-b border-[#E6DFD2] dark:border-[#2E2A24] px-4 py-2.5 text-xs flex flex-wrap items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#E8A317]" />
            <span className="font-bold text-[#1F1B16] dark:text-[#F5F1EA]">Admin Simulation:</span>
            <span className="text-[#544E45] dark:text-[#B8B0A2]">
              Viewing as <strong className="text-[#0F6E6E] dark:text-[#199595] font-bold">{currentUser?.name}</strong> ({currentUser?.role})
            </span>
            <span className="text-[#7A7266] dark:text-[#857D71] text-xs font-mono hidden md:inline">
              (Project owner)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('admin')}
              className="bg-white dark:bg-[#28241F] hover:bg-[#F5EFE4] dark:hover:bg-[#332E27] text-[#1F1B16] dark:text-[#F5F1EA] px-3 py-1 rounded-[10px] text-xs font-medium border border-[#E6DFD2] dark:border-[#2E2A24] transition-colors cursor-pointer btn-campus"
            >
              Switch Persona
            </button>
            <button
              onClick={handleExitSimulation}
              className="bg-[#0F6E6E] hover:bg-[#0C5656] text-white px-3.5 py-1 rounded-[10px] text-xs font-semibold transition-all cursor-pointer shadow-xs btn-campus"
            >
              Return to Master Admin
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full min-w-0 mx-auto p-4 sm:p-6 lg:p-8 pb-24 sm:pb-6 transition-opacity duration-200">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
        >
          {activeTab === 'feed' && (
            <FeedView
              items={items}
              lowDataMode={lowDataMode}
              onClaimItem={(item) => {
                if (!currentUser) {
                  setActiveTab('login');
                  return;
                }
                setSelectedItemForClaim(item);
              }}
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
                onExpireOldItems={handleExpireOldItems}
                onNavigateToLogin={() => setActiveTab('login')}
                onSwitchPersona={canUsePersonaSimulation ? handleSwitchPersona : undefined}
              />
            </Suspense>
          )}

          {activeTab === 'login' && (
            <LoginPage
              currentUser={currentUser}
              onLogin={(user) => {
                if (user.id.startsWith('demo-') && isSimulating) {
                  handleSwitchPersona(user);
                } else {
                  setCurrentUser(user);
                  if (user.role === 'admin' || user.role === 'security') {
                    setActiveTab('admin');
                  } else {
                    setActiveTab('feed');
                  }
                }
              }}
              onLogout={handleLogout}
              onNavigateToFeed={() => setActiveTab('feed')}
              isDemoMode={isDemoMode}
            />
          )}
        </motion.div>
      </main>

      {/* Modals & Notification Drawers */}
      <ReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        onSubmitItem={handleAddItem}
        onDraftSaved={() => setSavedDraftCount(1)}
        currentUser={currentUser}
        onOpenLogin={() => {
          setIsReportModalOpen(false);
          setActiveTab('login');
        }}
      />

      <ClaimModal
        item={selectedItemForClaim}
        onClose={() => setSelectedItemForClaim(null)}
        onSuccessClaim={handleClaimSuccess}
      />

      <NotificationToast
        notification={activeToast}
        onDismiss={() => setActiveToast(null)}
        onView={(notif) => {
          if (notif.linkTab === 'admin' && isPrivileged) {
            setActiveTab('admin');
          } else {
            setActiveTab('feed');
          }
        }}
      />

      <Suspense fallback={null}>
        <PrivacyModal
          isOpen={isPrivacyModalOpen}
          onClose={() => setIsPrivacyModalOpen(false)}
        />
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

      {/* Footer */}
      <footer className="bg-transparent border-t border-[#E6DFD2] dark:border-[#2E2A24] mt-16 py-8 px-4 text-xs text-[#7A7266] dark:text-[#857D71]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <div className="flex items-center gap-2">
            <span className="font-serif font-bold text-sm text-[#1F1B16] dark:text-[#F5F1EA] tracking-tight">NileFound</span>
            <span className="text-[#D1C7B7] dark:text-[#3F3A32]">•</span>
            <span>Nile University of Nigeria, Abuja</span>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <button
              onClick={() => setIsPrivacyModalOpen(true)}
              className="text-[#0F6E6E] dark:text-[#199595] hover:underline font-medium cursor-pointer"
            >
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
