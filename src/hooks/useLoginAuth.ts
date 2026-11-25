import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  getRedirectResult,
  signInWithPopup,
  signInWithRedirect,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  updateProfile,
  type User as FirebaseUser,
} from 'firebase/auth';
import { auth } from '../lib/firebaseAuth.ts';
import { User, UserRole } from '../types/index.ts';
import { canUserModerate, getDefaultDepartmentForRole, isMasterAdminUser } from '../utils/admin.ts';
import {
  ensureFreshVerifiedIdToken,
  isCampusAccountAllowed,
  normalizeNileEmail,
  resolveDisplayName,
  validateEmailFormat,
  validateFullName,
  validateNileEmail,
  validatePassword,
} from '../utils/authValidation.ts';
import { reportError } from '../components/ErrorBoundary.tsx';

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  'auth/invalid-credential': 'The email or password is not correct. Switch to "Create an account" if you have not registered yet.',
  'auth/invalid-login-credentials': 'The email or password is not correct. Switch to "Create an account" if you have not registered yet.',
  'auth/wrong-password': 'The email or password is not correct. Switch to "Create an account" if you have not registered yet.',
  'auth/user-not-found': 'No account was found for this email. Switch to "Create an account" to register.',
  'auth/email-already-in-use': 'An account already exists for this email. Try "Sign in" or "Continue with Google".',
  'auth/weak-password': 'Choose a password with at least 8 characters, including a letter and a number.',
  'auth/account-exists-with-different-credential': 'An account already exists with another sign-in method. Try "Continue with Google".',
  'auth/operation-not-allowed': 'Email sign-in is unavailable right now. Use "Continue with Google".',
  'auth/popup-blocked': 'Pop-up was blocked by your browser. Allow pop-ups to complete Google sign-in.',
  'auth/popup-closed-by-user': 'Google sign-in popup was closed before completing. Please try again.',
  'auth/too-many-requests': 'Too many attempts. Wait a moment and try again.',
  'auth/network-request-failed': 'Network connection error. Check your internet connection and try again.',
};

const friendlyAuthError = (error: unknown): string => {
  const code = (error as { code?: string })?.code || '';
  return AUTH_ERROR_MESSAGES[code] || 'Could not complete sign-in. Check your details and connection, then try again.';
};

async function isAllowedCampusAccount(
  uid: string,
  email: string,
  emailVerified: boolean
): Promise<boolean> {
  const normalizedEmail = normalizeNileEmail(email);
  const isMaster = isMasterAdminUser(uid);
  let isDelegated = false;
  if (!validateNileEmail(normalizedEmail) && !isMaster && emailVerified) {
    const { isConfiguredAdmin } = await import('../services/firestore/roles.ts');
    isDelegated = await isConfiguredAdmin(uid);
  }
  return isCampusAccountAllowed({
    email: normalizedEmail,
    emailVerified,
    isMasterAdmin: isMaster,
    isDelegatedAdmin: isDelegated,
  });
}

async function buildUserFromFirebase(fbUser: FirebaseUser): Promise<User> {
  const userEmail = normalizeNileEmail(fbUser.email || '');
  const { fetchUserRole } = await import('../services/firestore/roles.ts');
  const role: UserRole = await fetchUserRole(fbUser.uid, userEmail);
  return {
    id: fbUser.uid,
    name: resolveDisplayName(fbUser.displayName, userEmail),
    email: userEmail,
    role,
    isAdmin: role === 'admin',
    department: getDefaultDepartmentForRole(role),
  };
}

interface UseLoginAuthOptions {
  onLogin: (user: User) => void;
  onLogout: () => void;
  onNavigateToFeed: () => void;
  onClearSessionAuthError?: () => void;
}

export function useLoginAuth({
  onLogin,
  onLogout,
  onNavigateToFeed,
  onClearSessionAuthError,
}: UseLoginAuthOptions) {
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isCheckingVerification, setIsCheckingVerification] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showInbox, setShowInbox] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const cooldownTimer = useRef<number | null>(null);
  const verificationCheckInFlightRef = useRef(false);
  const onLoginRef = useRef(onLogin);
  const onNavigateRef = useRef(onNavigateToFeed);
  const onClearSessionErrorRef = useRef(onClearSessionAuthError);
  useEffect(() => {
    onLoginRef.current = onLogin;
    onNavigateRef.current = onNavigateToFeed;
    onClearSessionErrorRef.current = onClearSessionAuthError;
  }, [onLogin, onNavigateToFeed, onClearSessionAuthError]);

  const clearFeedback = useCallback(() => {
    setErrorMessage(null);
    setSuccessMessage(null);
    onClearSessionErrorRef.current?.();
  }, []);

  const startResendCooldown = useCallback((seconds = 60) => {
    if (cooldownTimer.current) window.clearInterval(cooldownTimer.current);
    setCooldown(seconds);
    cooldownTimer.current = window.setInterval(() => {
      setCooldown((v) => {
        if (v <= 1 && cooldownTimer.current) {
          window.clearInterval(cooldownTimer.current);
          cooldownTimer.current = null;
        }
        return Math.max(0, v - 1);
      });
    }, 1000);
  }, []);

  const completeVerifiedAuth = useCallback(async (fbUser: FirebaseUser): Promise<boolean> => {
    await ensureFreshVerifiedIdToken(fbUser);
    const userEmail = normalizeNileEmail(fbUser.email || '');
    if (!(await isAllowedCampusAccount(fbUser.uid, userEmail, fbUser.emailVerified))) {
      await signOut(auth);
      setShowInbox(false);
      setErrorMessage('Please use your @nileuniversity.edu.ng email.');
      return false;
    }
    setShowInbox(false);
    const loggedUser = await buildUserFromFirebase(fbUser);
    onLoginRef.current(loggedUser);
    if (!canUserModerate(loggedUser)) onNavigateRef.current();
    return true;
  }, []);

  useEffect(() => {
    let active = true;

    const syncPendingUser = (fbUser: FirebaseUser | null) => {
      if (!active) return;
      if (!fbUser) {
        setShowInbox(false);
        return;
      }
      const userEmail = normalizeNileEmail(fbUser.email || '');
      if (!fbUser.emailVerified && userEmail && (validateNileEmail(userEmail) || isMasterAdminUser(fbUser.uid))) {
        setEmail((prev) => prev || userEmail);
        setShowInbox(true);
      }
    };

    syncPendingUser(auth.currentUser);
    const unsubscribeAuth = onAuthStateChanged(auth, syncPendingUser);

    getRedirectResult(auth)
      .then(async (result) => {
        if (!active || !result?.user) return;
        if (!result.user.emailVerified) {
          await signOut(auth);
          setErrorMessage('Verify your Google email address before accessing NileFound.');
          return;
        }
        await completeVerifiedAuth(result.user);
      })
      .catch((err) => reportError('Google redirect sign-in check failed', err));

    return () => {
      active = false;
      unsubscribeAuth();
      if (cooldownTimer.current) window.clearInterval(cooldownTimer.current);
    };
  }, [completeVerifiedAuth]);

  const checkVerificationNow = useCallback(
    async (manualTrigger = false) => {
      if (!auth.currentUser || verificationCheckInFlightRef.current) return;
      if (!manualTrigger && (!navigator.onLine || document.hidden)) return;
      verificationCheckInFlightRef.current = true;
      if (manualTrigger) {
        clearFeedback();
        setIsCheckingVerification(true);
      }
      try {
        await auth.currentUser.reload();
        if (auth.currentUser.emailVerified) {
          await completeVerifiedAuth(auth.currentUser);
        } else if (manualTrigger) {
          setErrorMessage(
            'Your email is not verified yet. Open the verification link in your Nile inbox or spam folder, then tap "I have verified" again.'
          );
        }
      } catch (err) {
        reportError('Verification status check failed', err);
        if (manualTrigger) {
          setErrorMessage('Could not check verification status. Check your connection and try again.');
        }
      } finally {
        verificationCheckInFlightRef.current = false;
        if (manualTrigger) setIsCheckingVerification(false);
      }
    },
    [clearFeedback, completeVerifiedAuth]
  );

  useEffect(() => {
    if (!showInbox) return;
    let pollCount = 0;
    const timer = window.setInterval(() => {
      if (pollCount >= 60) return;
      pollCount += 1;
      void checkVerificationNow(false);
    }, 5000);

    const onReturnToApp = () => {
      if (document.visibilityState === 'visible') {
        void checkVerificationNow(false);
      }
    };
    window.addEventListener('focus', onReturnToApp);
    document.addEventListener('visibilitychange', onReturnToApp);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', onReturnToApp);
      document.removeEventListener('visibilitychange', onReturnToApp);
    };
  }, [showInbox, checkVerificationNow]);

  const validateCredentials = (normalizedEmail: string): string | null => {
    if (mode === 'sign-up' && !validateNileEmail(normalizedEmail)) return 'Please use your @nileuniversity.edu.ng email.';
    if (!validateEmailFormat(normalizedEmail)) return 'Enter a valid email address.';
    if (mode === 'sign-up' && !validateFullName(fullName)) return 'Enter your full name using 2-100 letters, spaces, hyphens, or apostrophes.';
    if (mode === 'sign-up' && password !== confirmPassword) return 'Passwords do not match.';
    if (mode === 'sign-up' && !validatePassword(password)) return 'Password must be at least 8 characters and include a letter and a number.';
    return null;
  };

  const handleEmailAuth = async (event: React.FormEvent) => {
    event.preventDefault();
    clearFeedback();
    setIsSigningIn(true);
    try {
      const normalizedEmail = normalizeNileEmail(email);
      const validationErr = validateCredentials(normalizedEmail);
      if (validationErr) return setErrorMessage(validationErr);

      if (mode === 'sign-up') {
        const result = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
        await updateProfile(result.user, { displayName: fullName.trim() || 'Campus User' }).catch((err) =>
          reportError('Update initial profile name failed cleanly', err)
        );
        setShowInbox(true);
        try {
          await sendEmailVerification(result.user);
          startResendCooldown(60);
          setSuccessMessage('Verification email sent. Check your inbox or spam folder before continuing.');
        } catch (verifyErr) {
          reportError('Initial sendEmailVerification failed', verifyErr);
          setErrorMessage('Account created, but we could not send the verification email yet. Tap "Resend email" in a moment.');
        }
        return;
      }

      const result = await signInWithEmailAndPassword(auth, normalizedEmail, password);
      if (!result.user.emailVerified) {
        if (!validateNileEmail(normalizedEmail) && !isMasterAdminUser(result.user.uid)) {
          await signOut(auth);
          setErrorMessage('Please use your @nileuniversity.edu.ng email.');
          return;
        }
        setShowInbox(true);
        await sendEmailVerification(result.user)
          .then(() => startResendCooldown(60))
          .catch((err) => reportError('Send verification email failed', err));
        setSuccessMessage('Verify your email first, or sign in with Google if your institution uses Gmail.');
        return;
      }

      await completeVerifiedAuth(result.user);
    } catch (err: unknown) {
      setErrorMessage(friendlyAuthError(err));
    } finally {
      setIsSigningIn(false);
    }
  };

  const resendVerification = async () => {
    if (!auth.currentUser || cooldown > 0) return;
    clearFeedback();
    try {
      await sendEmailVerification(auth.currentUser);
      startResendCooldown(60);
      setSuccessMessage('Verification email sent again.');
    } catch (err) {
      reportError('Resend verification email failed', err);
      setErrorMessage('Could not resend the verification email. Wait a moment and try again.');
    }
  };

  const handleGoogleSignIn = async () => {
    clearFeedback();
    setIsSigningIn(true);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      const result = await signInWithPopup(auth, provider);
      if (!result.user.emailVerified) {
        await signOut(auth);
        return setErrorMessage('Verify your Google email address before accessing NileFound.');
      }
      await completeVerifiedAuth(result.user);
    } catch (error: unknown) {
      const code = (error as { code?: string })?.code;
      if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
        await signInWithRedirect(auth, provider).catch((e) => setErrorMessage(friendlyAuthError(e)));
        return;
      }
      setErrorMessage(friendlyAuthError(error));
    } finally {
      setIsSigningIn(false);
    }
  };

  const confirmVerified = async () => {
    await checkVerificationNow(true);
  };

  const handleForgotPassword = async () => {
    clearFeedback();
    const normalizedEmail = normalizeNileEmail(email);
    if (!normalizedEmail) return setErrorMessage('Enter your email address first.');
    if (!validateEmailFormat(normalizedEmail)) return setErrorMessage('Enter a valid email address.');
    try {
      await sendPasswordResetEmail(auth, normalizedEmail);
    } catch (err) {
      reportError('Password reset email request failed', err);
    } finally {
      setSuccessMessage('If an account exists for that email, a reset link has been sent.');
    }
  };

  const handleSignOut = async () => {
    clearFeedback();
    setShowInbox(false);
    await signOut(auth).catch((err) => reportError('Sign out from login failed', err));
    onLogout();
  };

  return {
    isSigningIn,
    isCheckingVerification,
    errorMessage,
    successMessage,
    mode,
    setMode,
    email,
    setEmail,
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    fullName,
    setFullName,
    showPassword,
    setShowPassword,
    showInbox,
    cooldown,
    clearFeedback,
    handleEmailAuth,
    resendVerification,
    handleGoogleSignIn,
    confirmVerified,
    handleForgotPassword,
    handleSignOut,
  };
}
