/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * NileFound Authentication Screen
 * Layout: Institutional single-column card with Email/Password tabs (Sign In, Create Account, Email Verification, Reset Password) and demo account selector in Nile Blue and white.
 * Main Action: Authenticate using a verified Nile University email address (@nileuniversity.edu.ng).
 */

import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  Check, 
  UserCheck, 
  AlertCircle, 
  Mail, 
  Lock, 
  KeyRound, 
  RotateCw, 
  LogOut, 
  ArrowRight 
} from 'lucide-react';
import { User, UserRole } from '../types/index.ts';
import { auth } from '../lib/firebase.ts';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  sendEmailVerification, 
  sendPasswordResetEmail, 
  signOut 
} from 'firebase/auth';
import { fetchUserRole, syncUserProfile } from '../services/firestoreService.ts';

interface LoginPageProps {
  currentUser: User | null;
  onLogin: (user: User) => void;
  onLogout: () => void;
  onNavigateToFeed: () => void;
  isDemoMode: boolean;
}

type AuthMode = 'signin' | 'signup' | 'verify' | 'forgot';

export const LoginPage: React.FC<LoginPageProps> = ({
  currentUser,
  onLogin,
  onLogout,
  onNavigateToFeed,
  isDemoMode,
}) => {
  const [authMode, setAuthMode] = useState<AuthMode>(() => {
    if (auth.currentUser && !auth.currentUser.emailVerified) {
      return 'verify';
    }
    return 'signin';
  });

  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [unverifiedEmail, setUnverifiedEmail] = useState<string>(() => {
    return auth.currentUser?.email || '';
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVerifyingCheck, setIsVerifyingCheck] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // 60-second cooldown timer for resending verification email
  const [resendCooldown, setResendCooldown] = useState<number>(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  // Sync unverified user state if Firebase current user exists
  useEffect(() => {
    if (auth.currentUser && !auth.currentUser.emailVerified) {
      setUnverifiedEmail(auth.currentUser.email || '');
      setAuthMode('verify');
    }
  }, []);

  // Preset accounts for Demo Mode testing only (completely isolated from real Firestore)
  const DEMO_ACCOUNTS: User[] = [
    {
      id: 'demo-admin',
      name: 'Campus Administrator',
      email: 'admin@nileuniversity.edu.ng',
      role: 'admin',
      matricNumber: 'ADMIN-01',
      department: 'Student Affairs',
      isAdmin: true,
    },
    {
      id: 'demo-student-chidera',
      name: 'Chidera Eze',
      email: 'chidera@nileuniversity.edu.ng',
      role: 'student',
      matricNumber: '23/ENG/0481',
      department: 'Computer Engineering',
      isAdmin: false,
    },
    {
      id: 'demo-security-musa',
      name: 'Officer Musa (Main Gate)',
      email: 'security.gate@nileuniversity.edu.ng',
      role: 'security',
      department: 'Campus Security & Safety',
      isAdmin: false,
    },
  ];

  const clearFeedback = () => {
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const handleSelectDemoAccount = (preset: User) => {
    onLogin(preset);
    setSuccessMessage(`Active demo account: ${preset.name}`);
  };

  /**
   * Validates email domain and password requirements
   */
  const validateCredentials = (isRegistration: boolean): boolean => {
    const trimmed = emailInput.trim().toLowerCase();
    if (!trimmed.endsWith('@nileuniversity.edu.ng')) {
      setErrorMessage('Use your Nile University email.');
      return false;
    }
    if (isRegistration && passwordInput.length < 8) {
      setErrorMessage('Password must be at least 8 characters.');
      return false;
    }
    if (!passwordInput) {
      setErrorMessage('Please enter your password.');
      return false;
    }
    return true;
  };

  /**
   * Real Mode: Handle Email & Password Sign Up
   */
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    clearFeedback();

    if (!validateCredentials(true)) return;

    const trimmedEmail = emailInput.trim().toLowerCase();
    const cleanPassword = passwordInput;
    // Wipe password state immediately after extracting to avoid memory retention
    setPasswordInput('');

    setIsSubmitting(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, trimmedEmail, cleanPassword);
      // Immediately send verification email
      await sendEmailVerification(userCredential.user);

      setUnverifiedEmail(trimmedEmail);
      setAuthMode('verify');
      setResendCooldown(60);
      setSuccessMessage('We sent a link to your Nile email. Check your inbox and junk folder.');
    } catch (err: any) {
      if (err?.code === 'auth/email-already-in-use') {
        setErrorMessage('An account with this email already exists. Sign in instead.');
      } else if (err?.code === 'auth/weak-password') {
        setErrorMessage('Password must be at least 8 characters.');
      } else if (err?.code === 'auth/network-request-failed') {
        setErrorMessage('Network connection failed. Check your data connection.');
      } else {
        setErrorMessage(err?.message || 'Could not create account. Please check your details.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Real Mode: Handle Email & Password Sign In
   */
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    clearFeedback();

    const trimmedEmail = emailInput.trim().toLowerCase();
    if (!trimmedEmail.endsWith('@nileuniversity.edu.ng')) {
      setErrorMessage('Use your Nile University email.');
      return;
    }
    if (!passwordInput) {
      setErrorMessage('Please enter your password.');
      return;
    }

    const cleanPassword = passwordInput;
    setPasswordInput('');

    setIsSubmitting(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, trimmedEmail, cleanPassword);
      const fbUser = userCredential.user;

      // If email is not verified, gate access and route to verify screen
      if (!fbUser.emailVerified) {
        setUnverifiedEmail(trimmedEmail);
        setAuthMode('verify');
        setErrorMessage('Your email address is not verified yet. Please check your inbox.');
        setIsSubmitting(false);
        return;
      }

      // Check role in /roles/{uid}
      const assignedRole = await fetchUserRole(fbUser.uid);
      const role: UserRole = assignedRole === 'admin' || assignedRole === 'security'
        ? assignedRole
        : 'student';
      const isAdmin = role === 'admin';

      const loggedUser: User = {
        id: fbUser.uid,
        name: fbUser.displayName || trimmedEmail.split('@')[0],
        email: trimmedEmail,
        role,
        isAdmin,
        department: role === 'security' ? 'Campus Security & Safety' : 'Nile University of Nigeria',
      };

      try {
        await syncUserProfile(loggedUser);
      } catch (err) {
        console.warn('Could not sync user profile to Firestore:', err);
      }

      onLogin(loggedUser);
      setSuccessMessage(`Signed in as ${loggedUser.name}`);
      onNavigateToFeed();
    } catch (err: any) {
      if (
        err?.code === 'auth/invalid-credential' ||
        err?.code === 'auth/wrong-password' ||
        err?.code === 'auth/user-not-found'
      ) {
        setErrorMessage('Incorrect email or password. Please check your details.');
      } else if (err?.code === 'auth/too-many-requests') {
        setErrorMessage('Too many failed attempts. Please wait a few minutes.');
      } else if (err?.code === 'auth/network-request-failed') {
        setErrorMessage('Network connection failed. Check your data connection.');
      } else {
        setErrorMessage(err?.message || 'Could not sign in. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Real Mode: Handle "I've verified" confirmation
   * Must reload the user and force-refresh the ID token (getIdToken(true))
   */
  const handleVerifyCheck = async () => {
    clearFeedback();
    setIsVerifyingCheck(true);

    try {
      if (!auth.currentUser) {
        setErrorMessage('No active session found. Please sign in with your credentials.');
        setAuthMode('signin');
        setIsVerifyingCheck(false);
        return;
      }

      // Reload user record from Firebase Auth server
      await auth.currentUser.reload();
      // Force refresh the token to retrieve refreshed claims and verification status
      await auth.currentUser.getIdToken(true);

      if (auth.currentUser.emailVerified) {
        const email = (auth.currentUser.email || '').trim().toLowerCase();
        const uid = auth.currentUser.uid;
        const assignedRole = await fetchUserRole(uid);
        const role: UserRole = assignedRole === 'admin' || assignedRole === 'security'
          ? assignedRole
          : 'student';
        const isAdmin = role === 'admin';

        const loggedUser: User = {
          id: uid,
          name: auth.currentUser.displayName || email.split('@')[0],
          email,
          role,
          isAdmin,
          department: role === 'security' ? 'Campus Security & Safety' : 'Nile University of Nigeria',
        };

        try {
          await syncUserProfile(loggedUser);
        } catch (err) {
          console.warn('Could not sync profile:', err);
        }

        onLogin(loggedUser);
        setSuccessMessage('Email verified successfully.');
        onNavigateToFeed();
      } else {
        setErrorMessage('Your email is still unverified. Please open the confirmation link in your inbox or junk folder and try again.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Could not check verification status. Check your network.');
    } finally {
      setIsVerifyingCheck(false);
    }
  };

  /**
   * Real Mode: Handle Resend Verification Email with 60-second cooldown
   */
  const handleResendEmail = async () => {
    if (resendCooldown > 0) return;
    clearFeedback();

    try {
      if (auth.currentUser) {
        await sendEmailVerification(auth.currentUser);
        setResendCooldown(60);
        setSuccessMessage('Verification link resent. Check your inbox and junk folder.');
      } else {
        setErrorMessage('Please sign in to request a verification email.');
        setAuthMode('signin');
      }
    } catch (err: any) {
      if (err?.code === 'auth/too-many-requests') {
        setErrorMessage('Too many requests. Please wait a few minutes before resending.');
      } else {
        setErrorMessage(err?.message || 'Could not send verification email. Try again.');
      }
    }
  };

  /**
   * Real Mode: Handle Forgot Password
   */
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    clearFeedback();

    const trimmedEmail = emailInput.trim().toLowerCase();
    if (!trimmedEmail.endsWith('@nileuniversity.edu.ng')) {
      setErrorMessage('Use your Nile University email.');
      return;
    }

    setIsSubmitting(true);
    try {
      await sendPasswordResetEmail(auth, trimmedEmail);
      setSuccessMessage('Password reset link sent to your Nile email. Check your inbox.');
    } catch (err: any) {
      if (err?.code === 'auth/user-not-found') {
        setSuccessMessage('If that account exists, a reset link was sent.');
      } else {
        setErrorMessage(err?.message || 'Could not send reset link. Try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Real Mode: Handle Sign Out
   */
  const handleSignOut = async () => {
    clearFeedback();
    try {
      await signOut(auth);
    } catch (err) {
      console.warn('Sign out error:', err);
    }
    onLogout();
    setEmailInput('');
    setPasswordInput('');
    setAuthMode('signin');
  };

  return (
    <div className="max-w-xl mx-auto py-4 space-y-6">
      {/* Current Active Session Banner */}
      {currentUser && (
        <div className="bg-blue-950 text-white rounded-lg p-4 border border-blue-900 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-900 border border-blue-800 flex items-center justify-center font-bold text-blue-200 text-sm">
              {currentUser.name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-white">{currentUser.name}</span>
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                    currentUser.role === 'admin'
                      ? 'bg-amber-400 text-slate-900'
                      : currentUser.role === 'security'
                      ? 'bg-blue-700 text-blue-100'
                      : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  {currentUser.role}
                </span>
              </div>
              <p className="text-xs text-blue-200/80">{currentUser.email}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onNavigateToFeed}
              className="bg-blue-800 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors min-h-[44px]"
            >
              Go to Feed
            </button>
            <button
              onClick={handleSignOut}
              className="bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold px-3 py-2 rounded-lg transition-colors min-h-[44px]"
            >
              Sign Out
            </button>
          </div>
        </div>
      )}

      {/* Main Authentication Card */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
        {/* Header Notice */}
        <div className="bg-blue-900 text-white px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-blue-300" />
            <span className="font-bold text-xs uppercase tracking-wider">
              {isDemoMode ? 'Demo Mode Authentication' : 'Nile University Institutional Access'}
            </span>
          </div>
          <span className="text-[10px] bg-blue-800 text-blue-200 font-semibold px-2 py-0.5 rounded">
            {isDemoMode ? 'Demo Simulation' : 'Verified Accounts Only'}
          </span>
        </div>

        <div className="p-5 space-y-5">
          {/* Plain explanation */}
          <div className="text-xs text-slate-600 leading-relaxed space-y-1">
            <p className="font-semibold text-slate-900">
              Only verified Nile University community members can access listings and submit claims.
            </p>
            <p>
              Use your institutional email ending in <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-800 font-mono">@nileuniversity.edu.ng</code>.
            </p>
          </div>

          {/* Feedback Messages */}
          {errorMessage && (
            <div className="bg-rose-50 border border-rose-300 text-rose-900 text-xs p-3 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="bg-blue-50 border border-blue-200 text-blue-950 text-xs p-3 rounded-lg flex items-center gap-2">
              <Check className="w-4 h-4 text-blue-800 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* REAL MODE: Email/Password Authentication Forms */}
          {!isDemoMode && (
            <div>
              {/* Screen 1: Verify Email Pending Screen */}
              {authMode === 'verify' && (
                <div className="space-y-4 pt-1">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
                    <div className="flex items-center gap-2 text-blue-900 font-bold text-xs uppercase tracking-wider">
                      <Mail className="w-4 h-4 text-blue-800" />
                      <span>Verification Required</span>
                    </div>
                    <p className="text-xs text-slate-700 leading-relaxed font-medium">
                      We sent a link to your Nile email. Check your inbox and junk folder.
                    </p>
                    {unverifiedEmail && (
                      <p className="text-xs font-mono bg-white px-2.5 py-1.5 rounded border border-blue-200 text-slate-800 inline-block">
                        {unverifiedEmail}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2 pt-2">
                    <button
                      type="button"
                      onClick={handleVerifyCheck}
                      disabled={isVerifyingCheck}
                      className="w-full min-h-[44px] py-2.5 px-4 bg-blue-900 hover:bg-blue-800 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-2"
                    >
                      <RotateCw className={`w-4 h-4 ${isVerifyingCheck ? 'animate-spin' : ''}`} />
                      <span>{isVerifyingCheck ? 'Checking verification...' : "I've verified"}</span>
                    </button>

                    <div className="flex flex-col sm:flex-row gap-2">
                      <button
                        type="button"
                        onClick={handleResendEmail}
                        disabled={resendCooldown > 0}
                        className="flex-1 min-h-[44px] py-2.5 px-4 bg-white border border-slate-300 hover:border-slate-400 disabled:opacity-50 text-slate-700 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
                      >
                        <Mail className="w-3.5 h-3.5 text-slate-500" />
                        <span>
                          {resendCooldown > 0 ? `Resend (${resendCooldown}s)` : 'Resend link'}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={handleSignOut}
                        className="min-h-[44px] py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
                      >
                        <LogOut className="w-3.5 h-3.5 text-slate-500" />
                        <span>Sign out</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Screen 2: Sign In Form */}
              {authMode === 'signin' && (
                <form onSubmit={handleSignIn} className="space-y-3.5 pt-1">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Nile Email Address
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        required
                        value={emailInput}
                        onChange={(e) => setEmailInput(e.target.value)}
                        placeholder="yourname@nileuniversity.edu.ng"
                        className="w-full text-xs pl-9 pr-3 py-2.5 min-h-[44px] rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-800 bg-slate-50/50"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-slate-700">
                        Password
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          clearFeedback();
                          setAuthMode('forgot');
                        }}
                        className="text-[11px] text-blue-900 hover:underline font-medium"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="password"
                        required
                        value={passwordInput}
                        onChange={(e) => setPasswordInput(e.target.value)}
                        placeholder="Enter your password"
                        className="w-full text-xs pl-9 pr-3 py-2.5 min-h-[44px] rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-800 bg-slate-50/50"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full min-h-[44px] py-2.5 px-4 bg-blue-900 hover:bg-blue-800 disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-xs transition-colors flex items-center justify-center gap-2"
                  >
                    <span>{isSubmitting ? 'Signing in...' : 'Sign In'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  <div className="pt-2 text-center text-xs text-slate-600">
                    <span>Don't have an account? </span>
                    <button
                      type="button"
                      onClick={() => {
                        clearFeedback();
                        setPasswordInput('');
                        setAuthMode('signup');
                      }}
                      className="text-blue-900 font-bold hover:underline"
                    >
                      Create account
                    </button>
                  </div>
                </form>
              )}

              {/* Screen 3: Sign Up Form */}
              {authMode === 'signup' && (
                <form onSubmit={handleSignUp} className="space-y-3.5 pt-1">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Nile Email Address
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        required
                        value={emailInput}
                        onChange={(e) => setEmailInput(e.target.value)}
                        placeholder="yourname@nileuniversity.edu.ng"
                        className="w-full text-xs pl-9 pr-3 py-2.5 min-h-[44px] rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-800 bg-slate-50/50"
                      />
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Must end in @nileuniversity.edu.ng
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Create Password
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="password"
                        required
                        minLength={8}
                        value={passwordInput}
                        onChange={(e) => setPasswordInput(e.target.value)}
                        placeholder="Minimum 8 characters"
                        className="w-full text-xs pl-9 pr-3 py-2.5 min-h-[44px] rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-800 bg-slate-50/50"
                      />
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Minimum 8 characters. Never shared with anyone.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full min-h-[44px] py-2.5 px-4 bg-blue-900 hover:bg-blue-800 disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-xs transition-colors flex items-center justify-center gap-2"
                  >
                    <span>{isSubmitting ? 'Creating account...' : 'Create Account'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  <div className="pt-2 text-center text-xs text-slate-600">
                    <span>Already have an account? </span>
                    <button
                      type="button"
                      onClick={() => {
                        clearFeedback();
                        setPasswordInput('');
                        setAuthMode('signin');
                      }}
                      className="text-blue-900 font-bold hover:underline"
                    >
                      Sign in
                    </button>
                  </div>
                </form>
              )}

              {/* Screen 4: Forgot Password Form */}
              {authMode === 'forgot' && (
                <form onSubmit={handleForgotPassword} className="space-y-3.5 pt-1">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Nile Email Address
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        required
                        value={emailInput}
                        onChange={(e) => setEmailInput(e.target.value)}
                        placeholder="yourname@nileuniversity.edu.ng"
                        className="w-full text-xs pl-9 pr-3 py-2.5 min-h-[44px] rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-800 bg-slate-50/50"
                      />
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      We'll send a password reset link to this institutional address.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full min-h-[44px] py-2.5 px-4 bg-blue-900 hover:bg-blue-800 disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-xs transition-colors flex items-center justify-center gap-2"
                  >
                    <KeyRound className="w-4 h-4" />
                    <span>{isSubmitting ? 'Sending link...' : 'Send reset link'}</span>
                  </button>

                  <div className="pt-2 text-center text-xs text-slate-600">
                    <button
                      type="button"
                      onClick={() => {
                        clearFeedback();
                        setAuthMode('signin');
                      }}
                      className="text-blue-900 font-bold hover:underline"
                    >
                      Back to sign in
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* DEMO MODE ONLY: Clearly labelled simulated accounts */}
          {isDemoMode && (
            <div className="pt-2 border-t border-slate-200 space-y-3">
              <div className="bg-amber-50 border border-amber-300 text-amber-950 p-2.5 rounded-lg text-xs">
                <span className="font-bold">Demo Mode active:</span> Choose a simulated campus account below. Real mode uses Firebase Email/Password with verification.
              </div>

              <div className="grid grid-cols-1 gap-2">
                {DEMO_ACCOUNTS.map((account) => {
                  const isActive = currentUser?.email === account.email;
                  return (
                    <button
                      key={account.id}
                      type="button"
                      onClick={() => handleSelectDemoAccount(account)}
                      className={`w-full min-h-[44px] p-2.5 rounded-lg border text-left transition-all flex items-center justify-between ${
                        isActive
                          ? 'border-blue-700 bg-blue-50/80 ring-1 ring-blue-700'
                          : 'border-slate-200 hover:border-blue-500 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-7 h-7 rounded-md flex items-center justify-center font-bold text-xs ${
                            account.role === 'admin'
                              ? 'bg-amber-400 text-slate-900'
                              : account.role === 'security'
                              ? 'bg-blue-900 text-white'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {account.role === 'admin' ? 'A' : account.role === 'security' ? 'S' : 'U'}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-xs text-slate-900">{account.name}</span>
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded uppercase bg-slate-100 text-slate-600">
                              {account.role}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-500">{account.email}</span>
                        </div>
                      </div>

                      <div className="text-right">
                        {isActive ? (
                          <span className="text-xs font-bold text-blue-900 flex items-center gap-1">
                            <UserCheck className="w-3.5 h-3.5" /> Active
                          </span>
                        ) : (
                          <span className="text-xs font-semibold text-slate-500 hover:text-slate-900">
                            Select →
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
