import React, { useState, useEffect, useRef } from 'react';
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  getRedirectResult,
  signInWithPopup,
  signInWithRedirect,
  GoogleAuthProvider,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { auth } from '../lib/firebase.ts';
import { User, UserRole } from '../types/index.ts';
import { fetchUserRole, isConfiguredAdmin } from '../services/firestoreService.ts';
import { validateEmailFormat, validateFullName, validateNileEmail, validatePassword } from '../utils/authValidation.ts';
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
  'auth/too-many-requests': 'Too many sign-in attempts. Wait a moment and try again.',
  'auth/network-request-failed': 'Network connection error. Check your internet connection and try again.',
};

const friendlyAuthError = (error: unknown): string => {
  const code = (error as { code?: string })?.code || '';
  return AUTH_ERROR_MESSAGES[code] || 'Could not complete sign-in. Check your details and connection, then try again.';
};

async function buildUserFromFirebase(fbUser: import('firebase/auth').User): Promise<User> {
  const userEmail = (fbUser.email || '').trim().toLowerCase();
  const role: UserRole = await fetchUserRole(fbUser.uid, userEmail);
  return {
    id: fbUser.uid,
    name: (fbUser.displayName || userEmail.split('@')[0] || 'Campus User').split(' ')[0],
    email: userEmail,
    role,
    isAdmin: role === 'admin',
    department: role === 'admin' ? 'University Administration' : role === 'security' ? 'Campus Security Unit' : 'Nile University Member',
  };
}

interface UseLoginAuthOptions {
  onLogin: (user: User) => void;
  onLogout: () => void;
  onNavigateToFeed: () => void;
}

export function useLoginAuth({ onLogin, onLogout, onNavigateToFeed }: UseLoginAuthOptions) {
  const [isSigningIn, setIsSigningIn] = useState(false);
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
  const onLoginRef = useRef(onLogin);
  const onNavigateRef = useRef(onNavigateToFeed);
  useEffect(() => {
    onLoginRef.current = onLogin;
    onNavigateRef.current = onNavigateToFeed;
  }, [onLogin, onNavigateToFeed]);

  const clearFeedback = () => {
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  useEffect(() => {
    let active = true;
    getRedirectResult(auth)
      .then(async (result) => {
        if (!active || !result?.user) return;
        const userEmail = result.user.email?.toLowerCase() || '';
        if (!(await isConfiguredAdmin(result.user.uid)) && !validateNileEmail(userEmail)) {
          await signOut(auth);
          setErrorMessage('Please use your @nileuniversity.edu.ng email.');
          return;
        }
        if (!result.user.emailVerified) {
          await signOut(auth);
          setErrorMessage('Verify your Google email address before accessing NileFound.');
          return;
        }
        const loggedUser = await buildUserFromFirebase(result.user);
        onLoginRef.current(loggedUser);
        if (!loggedUser.isAdmin && loggedUser.role !== 'admin' && loggedUser.role !== 'security') onNavigateRef.current();
      })
      .catch((err) => reportError('Google redirect sign-in check failed', err));

    return () => {
      active = false;
      if (cooldownTimer.current) window.clearInterval(cooldownTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!showInbox) return;
    let attempts = 0;
    const timer = window.setInterval(async () => {
      if (!auth.currentUser || !navigator.onLine || document.hidden) return;
      attempts += 1;
      if (attempts > 24) return window.clearInterval(timer);
      try {
        await auth.currentUser.reload();
        if (auth.currentUser.emailVerified) {
          setShowInbox(false);
          const loggedUser = await buildUserFromFirebase(auth.currentUser);
          onLoginRef.current(loggedUser);
          onNavigateRef.current();
        }
      } catch {
        // Poll silently until network returns
      }
    }, 5000);
    return () => window.clearInterval(timer);
  }, [showInbox]);

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
      const normalizedEmail = email.trim().toLowerCase();
      const validationErr = validateCredentials(normalizedEmail);
      if (validationErr) return setErrorMessage(validationErr);

      if (mode === 'sign-up') {
        const result = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
        await updateProfile(result.user, { displayName: fullName.trim() || 'Campus User' });
        await sendEmailVerification(result.user);
        setShowInbox(true);
        setSuccessMessage('Verification email sent. Check your inbox before continuing.');
        return;
      }

      const result = await signInWithEmailAndPassword(auth, normalizedEmail, password);
      if (!result.user.emailVerified) {
        await sendEmailVerification(result.user).catch((err) => reportError('Send verification email failed', err));
        setShowInbox(true);
        setSuccessMessage('Verify your email first, or sign in with Google if your institution uses Gmail.');
        return;
      }
      if (!validateNileEmail(normalizedEmail) && !(await isConfiguredAdmin(result.user.uid))) {
        await signOut(auth);
        setErrorMessage('Please use your @nileuniversity.edu.ng email.');
        return;
      }

      const loggedUser = await buildUserFromFirebase(result.user);
      onLogin(loggedUser);
      if (!loggedUser.isAdmin && loggedUser.role !== 'admin' && loggedUser.role !== 'security') onNavigateToFeed();
    } catch (err: unknown) {
      setErrorMessage(friendlyAuthError(err));
    } finally {
      setIsSigningIn(false);
    }
  };

  const resendVerification = async () => {
    if (!auth.currentUser || cooldown > 0) return;
    try {
      await sendEmailVerification(auth.currentUser);
      setCooldown(60);
      cooldownTimer.current = window.setInterval(() => {
        setCooldown((v) => {
          if (v <= 1 && cooldownTimer.current) window.clearInterval(cooldownTimer.current);
          return Math.max(0, v - 1);
        });
      }, 1000);
      setSuccessMessage('Verification email sent again.');
    } catch {
      setErrorMessage('Could not resend the verification email. Try again in a minute.');
    }
  };

  const handleGoogleSignIn = async () => {
    clearFeedback();
    setIsSigningIn(true);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      const result = await signInWithPopup(auth, provider);
      const userEmail = result.user.email?.toLowerCase() || '';
      if (!(await isConfiguredAdmin(result.user.uid)) && !validateNileEmail(userEmail)) {
        await signOut(auth);
        return setErrorMessage('Please use your @nileuniversity.edu.ng email.');
      }
      if (!result.user.emailVerified) {
        await signOut(auth);
        return setErrorMessage('Verify your Google email address before accessing NileFound.');
      }
      const loggedUser = await buildUserFromFirebase(result.user);
      onLogin(loggedUser);
      if (!loggedUser.isAdmin && loggedUser.role !== 'admin' && loggedUser.role !== 'security') onNavigateToFeed();
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
    if (!auth.currentUser) return;
    try {
      await auth.currentUser.reload();
      if (!auth.currentUser.emailVerified) {
        return setErrorMessage('Your email is not verified yet. Open the verification link, then try again.');
      }
      const loggedUser = await buildUserFromFirebase(auth.currentUser);
      onLogin(loggedUser);
      if (!loggedUser.isAdmin && loggedUser.role !== 'admin' && loggedUser.role !== 'security') onNavigateToFeed();
    } catch {
      setErrorMessage('Could not check verification status. Check your connection and try again.');
    }
  };

  const handleForgotPassword = async () => {
    clearFeedback();
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) return setErrorMessage('Enter your email address first.');
    if (!validateEmailFormat(normalizedEmail)) return setErrorMessage('Enter a valid email address.');
    try {
      await sendPasswordResetEmail(auth, normalizedEmail);
    } finally {
      setSuccessMessage('If an account exists for that email, a reset link has been sent.');
    }
  };

  const handleSignOut = async () => {
    clearFeedback();
    await signOut(auth).catch(() => {});
    onLogout();
  };

  return {
    isSigningIn, errorMessage, successMessage, mode, setMode,
    email, setEmail, password, setPassword, confirmPassword, setConfirmPassword,
    fullName, setFullName, showPassword, setShowPassword, showInbox, cooldown,
    clearFeedback, handleEmailAuth, resendVerification, handleGoogleSignIn, confirmVerified,
    handleForgotPassword, handleSignOut,
  };
}
