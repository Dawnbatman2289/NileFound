/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Authentication session lifecycle, role verification, and dev persona simulation hook.
 */

import { useReducer, useEffect, useRef, useCallback } from 'react';
import { onAuthStateChanged, signOut, type User as FirebaseUser } from 'firebase/auth';
import { CampusItem, ClaimRecord, User, UserRole } from '../types/index.ts';
import type { AppTab } from '../components/Navbar.tsx';
import { reportError } from '../components/ErrorBoundary.tsx';
import { auth } from '../lib/firebaseAuth.ts';
import { clearNotificationStorage } from '../services/notificationService.ts';
import { canUserModerate, getDefaultDepartmentForRole, isMasterAdminUser } from '../utils/admin.ts';
import {
  ensureFreshVerifiedIdToken,
  isCampusAccountAllowed,
  resolveDisplayName,
  validateNileEmail,
} from '../utils/authValidation.ts';
import { readJson, safeSetStorage, safeRemoveStorage } from '../utils/storage.ts';
import { authSessionReducer, type AuthSessionState } from './reducers.ts';

const CAMPUS_DOMAIN_REQUIRED_MSG =
  'Access restricted. Sign in with your @nileuniversity.edu.ng email address.';

interface UseAuthSessionOptions {
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
  onSeedDemoData: (items: CampusItem[], claims: ClaimRecord[]) => void;
  onResetSessionData: () => void;
}

function buildInitialAuthState(): AuthSessionState {
  const simulating =
    Boolean(import.meta.env.DEV) && localStorage.getItem('nilefound_admin_simulating') === 'true';
  const simUser = simulating ? readJson<User | null>('nilefound_simulated_persona', null) : null;
  const savedDevUser = import.meta.env.DEV ? readJson<User | null>('nilefound_user_v1', null) : null;
  return {
    isSimulating: simulating,
    isDemoMode: simulating,
    devPersonas: [],
    realUser: null,
    currentUser: simUser || savedDevUser,
    initializing: !simulating,
    roleError: null,
    authError: null,
    logoutNotice: null,
    roleRetryNonce: 0,
  };
}

function buildUserObject(uid: string, email: string, displayName: string | null, role: UserRole): User {
  return {
    id: uid,
    name: resolveDisplayName(displayName, email),
    email,
    role,
    isAdmin: role === 'admin',
    department: getDefaultDepartmentForRole(role),
  };
}

function clearSessionStorageKeys(): void {
  safeRemoveStorage('nilefound_user_v1');
  safeRemoveStorage('nilefound_admin_simulating');
  safeRemoveStorage('nilefound_simulated_persona');
}

export function useAuthSession({
  activeTab,
  setActiveTab,
  onSeedDemoData,
  onResetSessionData,
}: UseAuthSessionOptions) {
  const [state, dispatch] = useReducer(authSessionReducer, undefined, buildInitialAuthState);
  const isSimulatingRef = useRef(state.isSimulating);
  const lastConfirmedRoleRef = useRef<Record<string, UserRole>>({});
  const lastRoleCheckMsRef = useRef<number>(0);
  const hasSeededDemoRef = useRef(false);

  const onSeedDemoDataRef = useRef(onSeedDemoData);
  const onResetSessionDataRef = useRef(onResetSessionData);
  const setActiveTabRef = useRef(setActiveTab);

  useEffect(() => {
    isSimulatingRef.current = state.isSimulating;
  }, [state.isSimulating]);

  useEffect(() => {
    onSeedDemoDataRef.current = onSeedDemoData;
    onResetSessionDataRef.current = onResetSessionData;
    setActiveTabRef.current = setActiveTab;
  }, [onSeedDemoData, onResetSessionData, setActiveTab]);

  const isRealUserAdmin = state.realUser?.role === 'admin' || state.realUser?.isAdmin;
  const isPrivileged = canUserModerate(state.currentUser);
  const canUsePersonaSimulation = Boolean(
    import.meta.env.DEV &&
      (isRealUserAdmin || state.currentUser?.role === 'admin' || state.isSimulating)
  );

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    import('../data/demoPersonas.ts')
      .then((m) => dispatch({ type: 'SET_DEV_PERSONAS', personas: m.DEV_TEST_PERSONAS }))
      .catch((err) => reportError('Load dev personas failed', err));

    if (!state.isSimulating || hasSeededDemoRef.current) return;
    hasSeededDemoRef.current = true;
    import('../data/mockItems.ts')
      .then((m) => {
        const savedItems = readJson<CampusItem[]>('nilefound_demo_items_v1', []);
        const savedClaims = readJson<ClaimRecord[]>('nilefound_demo_claims_v1', []);
        onSeedDemoDataRef.current(
          savedItems.length > 0 ? savedItems : m.DEMO_ITEMS,
          savedClaims.length > 0 ? savedClaims : m.DEMO_CLAIMS
        );
      })
      .catch((err) => reportError('Load demo seed items failed', err));
  }, [state.isSimulating]);

  useEffect(() => {
    safeRemoveStorage('nilefound_real_items_v1');
    safeRemoveStorage('nilefound_real_claims_v1');
    if (!import.meta.env.DEV) clearSessionStorageKeys();
    const runBootCheck = async () => {
      if (typeof auth.authStateReady === 'function') {
        await auth.authStateReady();
      }
      if (!auth.currentUser) return;
      const { testConnection } = await import('../lib/firebase.ts');
      await testConnection();
    };
    runBootCheck().catch((err) => reportError('Boot connection check failed', err));
  }, []);

  useEffect(() => {
    if (state.realUser && !isRealUserAdmin && !state.isSimulating) {
      clearSessionStorageKeys();
      dispatch({ type: 'EXIT_SIMULATION', realUser: state.realUser });
    }
  }, [state.realUser, isRealUserAdmin, state.isSimulating]);

  useEffect(() => {
    if (state.currentUser && activeTab === 'login') {
      setActiveTab(isPrivileged ? 'admin' : 'feed');
    }
  }, [state.currentUser, activeTab, isPrivileged, setActiveTab]);

  useEffect(() => {
    let isActive = true;
    const rejectDisallowedAccount = async () => {
      await signOut(auth).catch((err) => reportError('Sign out disallowed account failed', err));
      if (!isActive) return;
      hasSeededDemoRef.current = false;
      onResetSessionDataRef.current();
      clearSessionStorageKeys();
      dispatch({
        type: 'AUTH_SIGNED_OUT',
        keepSimulation: isSimulatingRef.current,
        authError: CAMPUS_DOMAIN_REQUIRED_MSG,
      });
      setActiveTabRef.current('login');
    };

    const handleVerifiedUser = async (fbUser: FirebaseUser) => {
      const email = (fbUser.email || '').trim().toLowerCase();
      try {
        await ensureFreshVerifiedIdToken(fbUser);
      } catch (tokenErr) {
        if (!isActive) return;
        reportError('Auth token check failed', tokenErr);
        await signOut(auth);
        if (isActive) dispatch({ type: 'AUTH_SIGNED_OUT', keepSimulation: isSimulatingRef.current });
        return;
      }

      if (!isActive) return;
      const isMaster = isMasterAdminUser(fbUser.uid);
      let isDelegated = false;
      if (!validateNileEmail(email) && !isMaster) {
        try {
          const { isConfiguredAdmin } = await import('../services/firestore/roles.ts');
          isDelegated = await isConfiguredAdmin(fbUser.uid);
        } catch (adminCheckErr) {
          reportError('Delegated admin check failed cleanly', adminCheckErr);
        }
      }
      if (!isActive) return;

      if (
        !isCampusAccountAllowed({
          email,
          emailVerified: fbUser.emailVerified,
          isMasterAdmin: isMaster,
          isDelegatedAdmin: isDelegated,
        })
      ) {
        reportError(
          'Blocked non-campus Google/Firebase account',
          new Error(`Disallowed campus email domain for uid=${fbUser.uid}`)
        );
        await rejectDisallowedAccount();
        return;
      }

      let role: UserRole = lastConfirmedRoleRef.current[fbUser.uid] || 'student';
      let nextRoleError: string | null = null;
      try {
        const { fetchUserRole } = await import('../services/firestore/roles.ts');
        role = await fetchUserRole(fbUser.uid, email);
        if (!isActive) return;
        lastConfirmedRoleRef.current[fbUser.uid] = role;
        lastRoleCheckMsRef.current = Date.now();
      } catch (roleErr) {
        if (!isActive) return;
        reportError('Role check failed cleanly without demoting user', roleErr);
        nextRoleError = 'Could not confirm your staff permissions. Check your connection and retry.';
      }

      const user = buildUserObject(fbUser.uid, email, fbUser.displayName, role);
      dispatch({ type: 'VERIFIED_SIGN_IN', user, roleError: nextRoleError });
      if (!isSimulatingRef.current) {
        import('../services/firestore/profile.ts')
          .then(({ syncUserProfile }) => syncUserProfile(user))
          .catch((err) => reportError('syncUserProfile failed', err));
      }
    };

    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (!isActive) return;
      if (fbUser?.email && fbUser.emailVerified) {
        await handleVerifiedUser(fbUser);
        return;
      }
      if (fbUser && (!fbUser.email || !fbUser.emailVerified)) {
        const email = (fbUser.email || '').trim().toLowerCase();
        if (email && !validateNileEmail(email) && !isMasterAdminUser(fbUser.uid)) {
          await rejectDisallowedAccount();
          return;
        }
        dispatch({ type: 'AUTH_SIGNED_OUT', keepSimulation: isSimulatingRef.current });
        return;
      }
      if (import.meta.env.DEV && isSimulatingRef.current) {
        dispatch({ type: 'AUTH_SIGNED_OUT', keepSimulation: true });
        return;
      }
      hasSeededDemoRef.current = false;
      onResetSessionDataRef.current();
      clearSessionStorageKeys();
      dispatch({ type: 'AUTH_SIGNED_OUT', keepSimulation: false });
      setActiveTabRef.current('login');
    });
    return () => {
      isActive = false;
      unsubscribe();
    };
  }, [state.roleRetryNonce]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      const fbUser = auth.currentUser;
      if (!fbUser?.email || !fbUser.emailVerified || isSimulatingRef.current) return;
      const now = Date.now();
      if (now - lastRoleCheckMsRef.current < 60_000) return;
      lastRoleCheckMsRef.current = now;
      const email = fbUser.email.trim().toLowerCase();
      import('../services/firestore/roles.ts')
        .then(({ fetchUserRole }) => fetchUserRole(fbUser.uid, email))
        .then((nextRole) => {
          lastConfirmedRoleRef.current[fbUser.uid] = nextRole;
          const refreshed = buildUserObject(fbUser.uid, email, fbUser.displayName, nextRole);
          dispatch({ type: 'VERIFIED_SIGN_IN', user: refreshed, roleError: null });
        })
        .catch((err) => reportError('Visibility role refresh failed cleanly', err));
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  const handleSwitchPersona = useCallback(async (user: User) => {
    if (!import.meta.env.DEV) return;
    if (!isSimulatingRef.current || !hasSeededDemoRef.current) {
      hasSeededDemoRef.current = true;
      try {
        const m = await import('../data/mockItems.ts');
        const savedItems = readJson<CampusItem[]>('nilefound_demo_items_v1', []);
        const savedClaims = readJson<ClaimRecord[]>('nilefound_demo_claims_v1', []);
        onSeedDemoDataRef.current(
          savedItems.length > 0 ? savedItems : m.DEMO_ITEMS,
          savedClaims.length > 0 ? savedClaims : m.DEMO_CLAIMS
        );
      } catch (err) {
        reportError('Load simulation mock items failed', err);
      }
    }
    dispatch({ type: 'ENTER_SIMULATION', user });
    safeSetStorage('nilefound_admin_simulating', 'true');
    safeSetStorage('nilefound_simulated_persona', JSON.stringify(user));
    setActiveTabRef.current(user.role === 'admin' || user.role === 'security' ? 'admin' : 'feed');
  }, []);

  const handleResetDemoData = useCallback(async () => {
    if (!import.meta.env.DEV) return;
    safeRemoveStorage('nilefound_demo_items_v1');
    safeRemoveStorage('nilefound_demo_claims_v1');
    safeRemoveStorage('nilefound_demo_notifs_v1');
    hasSeededDemoRef.current = true;
    try {
      const m = await import('../data/mockItems.ts');
      onSeedDemoDataRef.current(m.DEMO_ITEMS, m.DEMO_CLAIMS);
    } catch (err) {
      reportError('Reset simulation mock items failed', err);
    }
  }, []);

  const handleExitSimulation = useCallback(() => {
    hasSeededDemoRef.current = false;
    safeRemoveStorage('nilefound_admin_simulating');
    safeRemoveStorage('nilefound_simulated_persona');
    dispatch({ type: 'EXIT_SIMULATION', realUser: state.realUser });
    if (state.realUser) {
      setActiveTabRef.current(
        state.realUser.role === 'admin' || state.realUser.role === 'security' ? 'admin' : 'feed'
      );
      return;
    }
    onResetSessionDataRef.current();
    setActiveTabRef.current('login');
  }, [state.realUser]);

  const handleLogout = useCallback(async () => {
    hasSeededDemoRef.current = false;
    await signOut(auth).catch((err) => reportError('Sign out failed cleanly', err));
    onResetSessionDataRef.current();
    clearSessionStorageKeys();
    safeRemoveStorage('nilefound_demo_items_v1');
    safeRemoveStorage('nilefound_demo_claims_v1');
    safeRemoveStorage('nilefound_demo_notifs_v1');
    safeRemoveStorage('nilefound_report_draft_v1');
    try {
      sessionStorage.removeItem('nilefound_feed_filters');
    } catch (err) {
      reportError('Clear feed filter session failed', err);
    }
    clearNotificationStorage();

    const { clearOfflinePersistence } = await import('../lib/firebase.ts');
    const { cleared } = await clearOfflinePersistence();
    dispatch({ type: 'PREPARE_LOGOUT' });
    setActiveTabRef.current('login');
    if (!cleared) {
      dispatch({
        type: 'SET_LOGOUT_NOTICE',
        notice: 'Offline cache is open in another tab. Close other NileFound tabs to wipe offline data. Reloading...',
      });
      await new Promise((resolve) => window.setTimeout(resolve, 1200));
    }
    window.location.assign('/');
  }, []);

  const setCurrentUser = useCallback(
    (user: User | null) => dispatch({ type: 'SET_CURRENT_USER', user }),
    []
  );
  const setIsDemoMode = useCallback(
    (enabled: boolean) => dispatch({ type: 'SET_DEMO_MODE', enabled }),
    []
  );
  const retryRoleCheck = useCallback(() => dispatch({ type: 'RETRY_ROLE_CHECK' }), []);
  const clearAuthError = useCallback(() => dispatch({ type: 'SET_AUTH_ERROR', error: null }), []);

  return {
    currentUser: state.currentUser,
    setCurrentUser,
    initializing: state.initializing,
    isSimulating: state.isSimulating,
    isDemoMode: state.isDemoMode,
    setIsDemoMode,
    devPersonas: state.devPersonas,
    roleError: state.roleError,
    authError: state.authError,
    clearAuthError,
    logoutNotice: state.logoutNotice,
    retryRoleCheck,
    isPrivileged,
    canUsePersonaSimulation,
    handleSwitchPersona,
    handleResetDemoData,
    handleExitSimulation,
    handleLogout,
  };
}
