/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * NileFound Authentication Screen
 * Layout: Clean, standard sign-in interface in Deep Navy (#FAF6EF), Muted Card (#1E1C18), and Electric Lime (#0F6E6E).
 * Main Action: Verified Nile University email and password authentication.
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Shield, 
  Check, 
  AlertCircle, 
} from 'lucide-react';
import { User, UserRole } from '../types/index.ts';
import { auth } from '../lib/firebase.ts';
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { fetchUserRole, isConfiguredAdmin } from '../services/firestoreService.ts';
import { validateFullName, validateNileEmail, validatePassword } from '../utils/authValidation.ts';

interface LoginPageProps {
  currentUser: User | null;
  onLogin: (user: User) => void;
  onLogout: () => void;
  onNavigateToFeed: () => void;
  isDemoMode: boolean;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  currentUser,
  onLogin,
  onLogout,
  onNavigateToFeed,
  isDemoMode,
}) => {
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

  useEffect(() => {
    let active = true;
    getRedirectResult(auth).then(async (result) => {
      if (!active || !result?.user) return;
      const email = result.user.email?.toLowerCase() || '';
      if (!(await isConfiguredAdmin(result.user.uid)) && !validateNileEmail(email)) {
        await signOut(auth);
        setErrorMessage('Please use your @nileuniversity.edu.ng email.');
        return;
      }
      onLogin(await userFromFirebase(result.user));
      onNavigateToFeed();
    }).catch(() => {});
    return () => {
      active = false;
      if (cooldownTimer.current) window.clearInterval(cooldownTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!showInbox) return;
    const timer = window.setInterval(async () => {
      if (!auth.currentUser) return;
      await auth.currentUser.reload();
      if (auth.currentUser.emailVerified) {
        setShowInbox(false);
        onLogin(await userFromFirebase(auth.currentUser));
        onNavigateToFeed();
      }
    }, 5000);
    return () => window.clearInterval(timer);
  }, [showInbox]);

  const clearFeedback = () => {
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const friendlyAuthError = (error: any) => {
    if (error?.code === 'auth/invalid-credential' || error?.code === 'auth/invalid-login-credentials') {
      return 'The email or password is not correct.';
    }
    if (error?.code === 'auth/email-already-in-use') return 'An account already exists for this email.';
    if (error?.code === 'auth/weak-password') return 'Choose a stronger password with at least 8 characters.';
    if (error?.code === 'auth/account-exists-with-different-credential') return 'An account already exists with another sign-in method. Sign in with that method first.';
    if (error?.code === 'auth/too-many-requests') return 'Too many attempts. Please wait a moment and try again.';
    return 'Could not complete sign in. Please try again.';
  };

  const userFromFirebase = async (fbUser: import('firebase/auth').User): Promise<User> => {
    const userEmail = (fbUser.email || '').trim().toLowerCase();
    const assignedRole = await fetchUserRole(fbUser.uid);
    const role: UserRole = assignedRole;
    return {
      id: fbUser.uid,
      name: (fbUser.displayName || userEmail.split('@')[0] || 'Campus User').split(' ')[0],
      email: userEmail,
      role,
      isAdmin: role === 'admin',
      department: role === 'admin' ? 'University Administration' : 'Nile University Member',
    };
  };

  const handleEmailAuth = async (event: React.FormEvent) => {
    event.preventDefault();
    clearFeedback();
    setIsSigningIn(true);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      if (!validateNileEmail(normalizedEmail)) {
        setErrorMessage('Please use your @nileuniversity.edu.ng email.');
        return;
      }
      if (mode === 'sign-up' && !validateFullName(fullName)) {
        setErrorMessage('Enter your full name using 2-100 letters, spaces, hyphens, or apostrophes.');
        return;
      }
      if (mode === 'sign-up' && password !== confirmPassword) {
        setErrorMessage('Passwords do not match.');
        return;
      }
      if (mode === 'sign-up' && !validatePassword(password)) {
        setErrorMessage('Password must be at least 8 characters and include a letter and a number.');
        return;
      }
      const result = mode === 'sign-up'
        ? await createUserWithEmailAndPassword(auth, normalizedEmail, password)
        : await signInWithEmailAndPassword(auth, normalizedEmail, password);
      if (mode === 'sign-up') {
        await updateProfile(result.user, { displayName: fullName.trim() });
        await sendEmailVerification(result.user);
        setShowInbox(true);
        setSuccessMessage('Verification email sent. Check your inbox before continuing.');
      } else if (!result.user.emailVerified) {
        setShowInbox(true);
      } else {
        onLogin(await userFromFirebase(result.user));
        onNavigateToFeed();
      }
    } catch (err: any) {
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
      const timer = window.setInterval(() => {
        setCooldown((value) => {
          if (value <= 1) {
            window.clearInterval(timer);
            return 0;
          }
          return value - 1;
        });
      }, 1000);
      cooldownTimer.current = timer;
      setSuccessMessage('Verification email sent again.');
    } catch {
      setErrorMessage('Could not resend the verification email. Please try again.');
    }
  };

  const handleGoogleSignIn = async () => {
    clearFeedback();
    setIsSigningIn(true);
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const email = result.user.email?.toLowerCase() || '';
      if (!(await isConfiguredAdmin(result.user.uid)) && !validateNileEmail(email)) {
        await signOut(auth);
        setErrorMessage('Please use your @nileuniversity.edu.ng email.');
        return;
      }
      onLogin(await userFromFirebase(result.user));
      onNavigateToFeed();
    } catch (error: any) {
      if (error?.code === 'auth/popup-blocked' || error?.code === 'auth/popup-closed-by-user') {
        await signInWithRedirect(auth, provider);
        return;
      }
      setErrorMessage(friendlyAuthError(error));
    } finally {
      setIsSigningIn(false);
    }
  };

  const confirmVerified = async () => {
    if (!auth.currentUser) return;
    await auth.currentUser.reload();
    if (auth.currentUser.emailVerified) {
      onLogin(await userFromFirebase(auth.currentUser));
      onNavigateToFeed();
    } else {
      setErrorMessage('Your email is not verified yet. Open the verification link, then try again.');
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setErrorMessage('Enter your email address first.');
      return;
    }
    if (!validateNileEmail(email.trim().toLowerCase())) {
      setErrorMessage('Please use your @nileuniversity.edu.ng email.');
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setSuccessMessage('If an account exists for that email, a reset link has been sent.');
    } catch {
      setSuccessMessage('If an account exists for that email, a reset link has been sent.');
    }
  };

  /**
   * Handle Sign Out
   */
  const handleSignOut = async () => {
    clearFeedback();
    try {
      await signOut(auth);
    } catch {
    }
    onLogout();
  };

  return (
    <div className="max-w-xl mx-auto py-6 space-y-6">
      {/* Current Active Session Banner */}
      {currentUser && (
        <div className="bg-white dark:bg-[#1E1C18] text-[#1F1B16] dark:text-[#F5F1EA] rounded-[12px] p-5 border border-[#E6DFD2] dark:border-[#2E2A24] flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-full bg-[#E7F3F3] dark:bg-[#0D2D2D] text-[#0F6E6E] dark:text-[#199595] font-bold flex items-center justify-center text-sm border border-[#0F6E6E]/20">
              {currentUser.name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm">{currentUser.name}</span>
                <span
                  className={`text-xs font-sans font-medium px-2 py-0.5 rounded-[10px] border ${
                    currentUser.role === 'admin'
                      ? 'bg-[#E7F3F3] dark:bg-[#0D2D2D] text-[#0F6E6E] dark:text-[#199595] border-[#0F6E6E]/30'
                      : currentUser.role === 'security'
                      ? 'bg-[#EDF7F1] dark:bg-[#0E2417] text-[#1B5633] dark:text-[#75CE9A] border-[#2F7D4F]/30'
                      : 'bg-[#FAF6EF] dark:bg-[#141311] text-[#544E45] dark:text-[#B8B0A2] border-[#E6DFD2] dark:border-[#2E2A24]'
                  }`}
                >
                  {currentUser.role}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onNavigateToFeed}
              className="bg-[#0F6E6E] hover:bg-[#0C5656] text-white text-xs font-medium px-4 py-2 rounded-[10px] transition-colors min-h-[44px] cursor-pointer btn-campus shadow-xs"
            >
              Go to Feed
            </button>
            <button
              onClick={handleSignOut}
              className="bg-white dark:bg-[#28241F] hover:bg-[#FAF6EF] dark:hover:bg-[#332E27] text-[#544E45] dark:text-[#B8B0A2] text-xs font-medium px-4 py-2 rounded-[10px] border border-[#E6DFD2] dark:border-[#2E2A24] transition-colors min-h-[44px] cursor-pointer btn-campus"
            >
              Sign Out
            </button>
          </div>
        </div>
      )}

      {!currentUser && (
      <div className="bg-white dark:bg-[#1E1C18] rounded-[12px] border border-[#E6DFD2] dark:border-[#2E2A24] shadow-xs overflow-hidden">
        {/* Header Notice */}
        <div className="bg-[#FAF6EF] dark:bg-[#141311] px-5 py-3.5 border-b border-[#E6DFD2] dark:border-[#2E2A24] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#0F6E6E] dark:text-[#199595]" />
            <span className="font-medium text-xs text-[#1F1B16] dark:text-[#F5F1EA]">
              NileFound Campus Sign-In
            </span>
          </div>
          <span className="text-xs bg-[#E7F3F3] dark:bg-[#0D2D2D] text-[#0F6E6E] dark:text-[#199595] border border-[#0F6E6E]/20 font-sans font-medium px-2 py-0.5 rounded-[10px]">
            Nile University Account
          </span>
        </div>

        <div className="p-6 sm:p-8 space-y-6">
          <div className="space-y-1.5 text-center sm:text-left">
            <h2 className="font-serif text-lg sm:text-xl font-bold text-[#1F1B16] dark:text-[#F5F1EA] tracking-tight">
              Sign in to your campus account
            </h2>
            <p className="text-xs sm:text-sm text-[#544E45] dark:text-[#B8B0A2] leading-relaxed">
              Use your verified Nile University email and password to browse lost and found items, report misplaced belongings, and submit ownership verification claims.
            </p>
          </div>

          {/* Feedback Messages */}
          {errorMessage && (
            <div className="bg-[#FDF2F2] dark:bg-[#2B0E0E] border border-[#F87171]/40 text-[#9B1C1C] dark:text-[#F87171] text-xs p-3.5 rounded-[10px] flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 text-[#9B1C1C] shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="bg-[#EDF7F1] dark:bg-[#0E2417] border border-[#2F7D4F]/30 text-[#1B5633] dark:text-[#75CE9A] text-xs p-3.5 rounded-[10px] flex items-center gap-2.5">
              <Check className="w-4 h-4 text-[#2F7D4F] shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {showInbox ? (
            <div className="space-y-4 text-center">
              <h3 className="font-serif font-bold text-base">Check your inbox</h3>
              <p className="text-xs text-[#544E45] dark:text-[#B8B0A2]">Verify your email address before posting, claiming, or reading campus items.</p>
              <p className="text-xs text-[#7A7266]">Check your spam or junk folder if it does not arrive.</p>
              <button type="button" onClick={resendVerification} disabled={cooldown > 0} className="w-full min-h-[44px] bg-white dark:bg-[#28241F] border border-[#E6DFD2] dark:border-[#2E2A24] rounded-[10px] text-xs font-medium">
                {cooldown > 0 ? `Resend email (${cooldown}s)` : 'Resend email'}
              </button>
              <button type="button" onClick={confirmVerified} className="w-full min-h-[44px] bg-[#0F6E6E] text-white rounded-[10px] text-xs font-medium">
                I've verified
              </button>
              <button type="button" onClick={handleSignOut} className="text-xs text-[#0F6E6E] underline">Wrong email? Use a different one</button>
            </div>
          ) : (
          <>
          <form onSubmit={handleEmailAuth} className="space-y-3">
            {mode === 'sign-up' && <input type="text" required minLength={2} maxLength={100} value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Full name" className="w-full min-h-[44px] px-3 rounded-[10px] border border-[#E6DFD2] dark:border-[#2E2A24] bg-white dark:bg-[#141311] text-xs" />}
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@nileuniversity.edu.ng" className="w-full min-h-[44px] px-3 rounded-[10px] border border-[#E6DFD2] dark:border-[#2E2A24] bg-white dark:bg-[#141311] text-xs" />
            <div className="relative">
              <input type={showPassword ? 'text' : 'password'} required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className="w-full min-h-[44px] px-3 pr-20 rounded-[10px] border border-[#E6DFD2] dark:border-[#2E2A24] bg-white dark:bg-[#141311] text-xs" />
              <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-[#0F6E6E]" aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? 'Hide' : 'Show'}</button>
            </div>
            {mode === 'sign-up' && <input type={showPassword ? 'text' : 'password'} required minLength={8} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm password" className="w-full min-h-[44px] px-3 rounded-[10px] border border-[#E6DFD2] dark:border-[#2E2A24] bg-white dark:bg-[#141311] text-xs" />}
            {mode === 'sign-up' && <p className="text-xs text-[#544E45] dark:text-[#B8B0A2]">Password: 8+ characters, including one letter and one number.</p>}
            <button type="submit" disabled={isSigningIn} className="w-full min-h-[44px] bg-[#2F7D4F] text-white rounded-[10px] text-xs font-medium">
              {mode === 'sign-up' ? 'Create account' : 'Sign in with email'}
            </button>
            <div className="flex items-center justify-between text-xs">
              <button type="button" onClick={() => setMode(mode === 'sign-up' ? 'sign-in' : 'sign-up')} className="text-[#0F6E6E] underline">
                {mode === 'sign-up' ? 'Already have an account? Sign in' : 'Create an account'}
              </button>
              {mode === 'sign-in' && <button type="button" onClick={handleForgotPassword} className="text-[#0F6E6E] underline">Forgot password</button>}
            </div>
          </form>
          <div className="flex items-center gap-3 text-xs text-[#7A7266]"><span className="h-px flex-1 bg-[#E6DFD2]" /><span>or</span><span className="h-px flex-1 bg-[#E6DFD2]" /></div>
          <button type="button" onClick={handleGoogleSignIn} disabled={isSigningIn} className="w-full min-h-[44px] border border-[#E6DFD2] rounded-[10px] text-xs font-medium">Continue with Google</button>
          </>
          )}
        </div>
      </div>
      )}
    </div>
  );
};
