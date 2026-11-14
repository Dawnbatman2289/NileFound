import { useState, useEffect, useRef, useCallback } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { CampusItem, ClaimRecord, User, UserRole } from '../types/index.ts';
import type { AppTab } from '../components/Navbar.tsx';
import type { DemoPersonaOption } from '../data/demoPersonas.ts';
import { reportError } from '../components/ErrorBoundary.tsx';
import { auth, testConnection, clearOfflinePersistence } from '../lib/firebase.ts';
import { syncUserProfile, fetchUserRole } from '../services/firestoreService.ts';
import { clearNotificationStorage } from '../services/notificationService.ts';
import { readJson, safeSetStorage, safeRemoveStorage } from '../utils/storage.ts';

interface UseAuthSessionOptions {
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
  onSeedDemoData: (items: CampusItem[], claims: ClaimRecord[]) => void;
  onResetSessionData: () => void;
}

export function useAuthSession({
  activeTab,
  setActiveTab,
  onSeedDemoData,
  onResetSessionData,
}: UseAuthSessionOptions) {
  const [isSimulating, setIsSimulating] = useState(() =>
    import.meta.env.DEV && localStorage.getItem('nilefound_admin_simulating') === 'true'
  );
  const isSimulatingRef = useRef(isSimulating);
  useEffect(() => {
    isSimulatingRef.current = isSimulating;
  }, [isSimulating]);

  const [isDemoMode, setIsDemoMode] = useState(() =>
    import.meta.env.DEV && localStorage.getItem('nilefound_admin_simulating') === 'true'
  );
  const [devPersonas, setDevPersonas] = useState<DemoPersonaOption[]>([]);
  const [realUser, setRealUser] = useState<User | null>(null);
  const [roleError, setRoleError] = useState<string | null>(null);
  const [roleRetryNonce, setRoleRetryNonce] = useState(0);
  const lastConfirmedRoleRef = useRef<Record<string, UserRole>>({});

  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    if (import.meta.env.DEV && localStorage.getItem('nilefound_admin_simulating') === 'true') {
      const persona = readJson<User | null>('nilefound_simulated_persona', null);
      if (persona) return persona;
    }
    return import.meta.env.DEV ? readJson<User | null>('nilefound_user_v1', null) : null;
  });

  const onSeedDemoDataRef = useRef(onSeedDemoData);
  const onResetSessionDataRef = useRef(onResetSessionData);
  const setActiveTabRef = useRef(setActiveTab);
  useEffect(() => {
    onSeedDemoDataRef.current = onSeedDemoData;
    onResetSessionDataRef.current = onResetSessionData;
    setActiveTabRef.current = setActiveTab;
  }, [onSeedDemoData, onResetSessionData, setActiveTab]);

  const isRealUserAdmin = realUser?.role === 'admin' || realUser?.isAdmin;
  const isPrivileged = currentUser?.role === 'admin' || currentUser?.isAdmin || currentUser?.role === 'security';
  const canUsePersonaSimulation = Boolean(
    import.meta.env.DEV && (isRealUserAdmin || currentUser?.role === 'admin' || isSimulating)
  );

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    import('../data/demoPersonas.ts')
      .then((m) => setDevPersonas(m.DEV_TEST_PERSONAS))
      .catch((err) => reportError('Load dev personas failed', err));
    if (isSimulating) {
      import('../data/mockItems.ts')
        .then((m) => {
          onSeedDemoDataRef.current(
            readJson('nilefound_demo_items_v1', m.DEMO_ITEMS),
            readJson('nilefound_demo_claims_v1', m.DEMO_CLAIMS)
          );
        })
        .catch((err) => reportError('Load demo seed items failed', err));
    }
  }, [isSimulating]);

  // Scrub legacy unencrypted real-mode item/claim storage if present from older builds.
  useEffect(() => {
    safeRemoveStorage('nilefound_real_items_v1');
    safeRemoveStorage('nilefound_real_claims_v1');
    if (!import.meta.env.DEV) {
      safeRemoveStorage('nilefound_user_v1');
      safeRemoveStorage('nilefound_admin_simulating');
      safeRemoveStorage('nilefound_simulated_persona');
    }
    testConnection();
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
    if (currentUser && activeTab === 'login') {
      setActiveTab(isPrivileged ? 'admin' : 'feed');
    }
  }, [currentUser, activeTab, isPrivileged, setActiveTab]);

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
        } catch (tokenErr) {
          reportError('Auth token check failed', tokenErr);
          await signOut(auth);
          setRealUser(null);
          if (!isSimulatingRef.current) setCurrentUser(null);
          return;
        }
        let role: UserRole = lastConfirmedRoleRef.current[fbUser.uid] || 'student';
        try {
          role = await fetchUserRole(fbUser.uid, email);
          lastConfirmedRoleRef.current[fbUser.uid] = role;
          setRoleError(null);
        } catch (roleErr) {
          reportError('Role check failed cleanly without demoting user', roleErr);
          setRoleError('Could not confirm your staff permissions. Check your connection and retry.');
        }
        const user: User = {
          id: fbUser.uid,
          name: (fbUser.displayName || email.split('@')[0]).split(' ')[0],
          email,
          role,
          isAdmin: role === 'admin',
          department:
            role === 'admin'
              ? 'University Administration'
              : role === 'security'
                ? 'Campus Security & Safety'
                : 'Nile University Member',
        };
        setRealUser(user);
        if (!isSimulatingRef.current) {
          setCurrentUser(user);
          syncUserProfile(user).catch((err) => reportError('syncUserProfile failed', err));
        }
      } else {
        setRealUser(null);
        setRoleError(null);
        setCurrentUser(null);
        onResetSessionDataRef.current();
        setIsSimulating(false);
        setIsDemoMode(false);
        safeRemoveStorage('nilefound_user_v1');
        safeRemoveStorage('nilefound_admin_simulating');
        safeRemoveStorage('nilefound_simulated_persona');
        setActiveTabRef.current('login');
      }
    });
    return () => unsubscribe();
  }, [roleRetryNonce]);

  const handleSwitchPersona = useCallback(async (user: User) => {
    if (!import.meta.env.DEV) return;
    setIsSimulating(true);
    setIsDemoMode(true);
    setCurrentUser(user);
    safeSetStorage('nilefound_admin_simulating', 'true');
    safeSetStorage('nilefound_simulated_persona', JSON.stringify(user));
    try {
      const m = await import('../data/mockItems.ts');
      onSeedDemoDataRef.current(
        readJson('nilefound_demo_items_v1', m.DEMO_ITEMS),
        readJson('nilefound_demo_claims_v1', m.DEMO_CLAIMS)
      );
    } catch (err) {
      reportError('Load simulation mock items failed', err);
    }
    setActiveTabRef.current(user.role === 'admin' || user.role === 'security' ? 'admin' : 'feed');
  }, []);

  const handleExitSimulation = useCallback(() => {
    setIsSimulating(false);
    setIsDemoMode(false);
    safeRemoveStorage('nilefound_admin_simulating');
    safeRemoveStorage('nilefound_simulated_persona');
    if (realUser) {
      setCurrentUser(realUser);
      setActiveTabRef.current(realUser.role === 'admin' || realUser.role === 'security' ? 'admin' : 'feed');
    } else {
      setCurrentUser(null);
      setActiveTabRef.current('login');
    }
  }, [realUser]);

  const handleLogout = useCallback(async () => {
    await signOut(auth).catch((err) => reportError('Sign out failed cleanly', err));
    setRealUser(null);
    setRoleError(null);
    setIsSimulating(false);
    setIsDemoMode(false);
    onResetSessionDataRef.current();

    safeRemoveStorage('nilefound_user_v1');
    safeRemoveStorage('nilefound_admin_simulating');
    safeRemoveStorage('nilefound_simulated_persona');
    safeRemoveStorage('nilefound_report_draft_v1');
    try {
      sessionStorage.removeItem('nilefound_feed_filters');
    } catch (err) {
      reportError('Clear feed filter session failed', err);
    }
    clearNotificationStorage();

    await clearOfflinePersistence();
    setCurrentUser(null);
    setActiveTabRef.current('feed');
  }, []);

  return {
    currentUser,
    setCurrentUser,
    isSimulating,
    isDemoMode,
    setIsDemoMode,
    devPersonas,
    roleError,
    retryRoleCheck: () => setRoleRetryNonce((n) => n + 1),
    isPrivileged,
    canUsePersonaSimulation,
    handleSwitchPersona,
    handleExitSimulation,
    handleLogout,
  };
}
