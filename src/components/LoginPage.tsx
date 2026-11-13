/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * NileFound Authentication Screen
 * Layout: Standard sign-in interface using paper neutral background and deep teal primary actions.
 * Main Action: Verified Nile University email and password authentication.
 */

import React, { useState, useEffect, useRef } from 'react';
import { Shield, Check, AlertCircle } from 'lucide-react';
import { User, UserRole } from '../types/index.ts';
import { auth } from '../lib/firebase.ts';
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
import { fetchUserRole, isConfiguredAdmin } from '../services/firestoreService.ts';
import { isMasterAdminEmail, validateFullName, validateNileEmail, validatePassword } from '../utils/authValidation.ts';

interface LoginPageProps {
  currentUser: User | null;
  onLogin: (user: User) => void;
  onLogout: () => void;
  onNavigateToFeed: () => void;
  isDemoMode: boolean;
}

const INPUT_CLASS =
  'w-full min-h-[44px] px-3.5 py-2.5 rounded-[10px] border border-[#A39A8C] dark:border-[#5A5349] bg-white dark:bg-[#141311] text-[#1F1B16] dark:text-[#F5F1EA] placeholder:text-[#5C554C] dark:placeholder:text-[#A8A095] text-base sm:text-sm focus:border-[#0F6E6E]';

export const LoginPage: React.FC<LoginPageProps> = ({
  currentUser,
  onLogin,
  onLogout,
  onNavigateToFeed,
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
  const onLoginRef = useRef(onLogin);
  const onNavigateRef = useRef(onNavigateToFeed);
  useEffect(() => {
    onLoginRef.current = onLogin;
    onNavigateRef.current = onNavigateToFeed;
  }, [onLogin, onNavigateToFeed]);

  const userFromFirebase = async (fbUser: import('firebase/auth').User): Promise<User> => {
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
  };

  useEffect(() => {
    let active = true;
    getRedirectResult(auth)
      .then(async (result) => {
        if (!active || !result?.user) return;
        const userEmail = result.user.email?.toLowerCase() || '';
        if (!(await isConfiguredAdmin(result.user.uid, userEmail)) && !validateNileEmail(userEmail)) {
          await signOut(auth);
          setErrorMessage('Please use your @nileuniversity.edu.ng email.');
          return;
        }
        if (!result.user.emailVerified) {
          await signOut(auth);
          setErrorMessage('Verify your Google email address before accessing NileFound.');
          return;
        }
        const loggedUser = await userFromFirebase(result.user);
        onLoginRef.current(loggedUser);
        if (!loggedUser.isAdmin && loggedUser.role !== 'admin' && loggedUser.role !== 'security') {
          onNavigateRef.current();
        }
      })
      .catch(() => {
        // Ignore absent redirect result
      });

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
      if (attempts > 24) {
        window.clearInterval(timer);
        return;
      }
      try {
        await auth.currentUser.reload();
        if (auth.currentUser.emailVerified) {
          setShowInbox(false);
          const loggedUser = await userFromFirebase(auth.currentUser);
          onLoginRef.current(loggedUser);
          onNavigateRef.current();
        }
      } catch {
        // Poll silently until network returns
      }
    }, 5000);
    return () => window.clearInterval(timer);
  }, [showInbox]);

  const clearFeedback = () => {
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const friendlyAuthError = (error: unknown) => {
    const err = error as { code?: string };
    const code = err?.code || '';
    if (code === 'auth/invalid-credential' || code === 'auth/invalid-login-credentials' || code === 'auth/wrong-password') {
      return 'The email or password is not correct. Switch to "Create an account" if you have not registered yet.';
    }
    if (code === 'auth/user-not-found') {
      return 'No account was found for this email. Switch to "Create an account" to register.';
    }
    if (code === 'auth/email-already-in-use') {
      return 'An account already exists for this email. Try "Sign in" or "Continue with Google".';
    }
    if (code === 'auth/weak-password') {
      return 'Choose a password with at least 8 characters, including a letter and a number.';
    }
    if (code === 'auth/account-exists-with-different-credential') {
      return 'An account already exists with another sign-in method. Try "Continue with Google".';
    }
    if (code === 'auth/operation-not-allowed') {
      return 'Email sign-in is unavailable right now. Use "Continue with Google".';
    }
    if (code === 'auth/popup-blocked') {
      return 'Pop-up was blocked by your browser. Allow pop-ups to complete Google sign-in.';
    }
    if (code === 'auth/popup-closed-by-user') {
      return 'Google sign-in popup was closed before completing. Please try again.';
    }
    if (code === 'auth/too-many-requests') {
      return 'Too many sign-in attempts. Wait a moment and try again.';
    }
    if (code === 'auth/network-request-failed') {
      return 'Network connection error. Check your internet connection and try again.';
    }
    return 'Could not complete sign-in. Check your details and connection, then try again.';
  };

  const handleEmailAuth = async (event: React.FormEvent) => {
    event.preventDefault();
    clearFeedback();
    setIsSigningIn(true);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      if (!isMasterAdminEmail(normalizedEmail) && !validateNileEmail(normalizedEmail)) {
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

      if (mode === 'sign-up') {
        const result = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
        await updateProfile(result.user, {
          displayName: fullName.trim() || 'Campus User',
        });
        await sendEmailVerification(result.user);
        setShowInbox(true);
        setSuccessMessage('Verification email sent. Check your inbox before continuing.');
        return;
      }

      const result = await signInWithEmailAndPassword(auth, normalizedEmail, password);
      if (!result.user.emailVerified) {
        await sendEmailVerification(result.user).catch(() => {});
        setShowInbox(true);
        setSuccessMessage('Verify your email first, or sign in with Google if your institution uses Gmail.');
        return;
      }

      const loggedUser = await userFromFirebase(result.user);
      onLogin(loggedUser);
      if (!loggedUser.isAdmin && loggedUser.role !== 'admin' && loggedUser.role !== 'security') {
        onNavigateToFeed();
      }
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
      if (!(await isConfiguredAdmin(result.user.uid, userEmail)) && !validateNileEmail(userEmail)) {
        await signOut(auth);
        setErrorMessage('Please use your @nileuniversity.edu.ng email.');
        return;
      }
      if (!result.user.emailVerified) {
        await signOut(auth);
        setErrorMessage('Verify your Google email address before accessing NileFound.');
        return;
      }
      const loggedUser = await userFromFirebase(result.user);
      onLogin(loggedUser);
      if (!loggedUser.isAdmin && loggedUser.role !== 'admin' && loggedUser.role !== 'security') {
        onNavigateToFeed();
      }
    } catch (error: unknown) {
      const code = (error as { code?: string })?.code;
      if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
        await signInWithRedirect(auth, provider).catch((redirectErr) => {
          setErrorMessage(friendlyAuthError(redirectErr));
        });
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
      if (auth.currentUser.emailVerified) {
        const loggedUser = await userFromFirebase(auth.currentUser);
        onLogin(loggedUser);
        if (!loggedUser.isAdmin && loggedUser.role !== 'admin' && loggedUser.role !== 'security') {
          onNavigateToFeed();
        }
      } else {
        setErrorMessage('Your email is not verified yet. Open the verification link, then try again.');
      }
    } catch {
      setErrorMessage('Could not check verification status. Check your connection and try again.');
    }
  };

  const handleForgotPassword = async () => {
    clearFeedback();
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setErrorMessage('Enter your email address first.');
      return;
    }
    if (!isMasterAdminEmail(normalizedEmail) && !validateNileEmail(normalizedEmail)) {
      setErrorMessage('Please use your @nileuniversity.edu.ng email.');
      return;
    }
    try {
      await sendPasswordResetEmail(auth, normalizedEmail);
      setSuccessMessage('If an account exists for that email, a reset link has been sent.');
    } catch {
      setSuccessMessage('If an account exists for that email, a reset link has been sent.');
    }
  };

  const handleSignOut = async () => {
    clearFeedback();
    try {
      await signOut(auth);
    } catch {
      // Proceed with local logout state cleanup
    }
    onLogout();
  };

  return (
    <div className="max-w-xl mx-auto py-6 space-y-6">
      {currentUser && (
        <div className="bg-white dark:bg-[#1E1C18] text-[#1F1B16] dark:text-[#F5F1EA] rounded-[12px] p-5 border border-[#C4BBAF] dark:border-[#3E3931] flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
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
                      : 'bg-[#FAF6EF] dark:bg-[#141311] text-[#4A443C] dark:text-[#CEC7BB] border-[#C4BBAF] dark:border-[#3E3931]'
                  }`}
                >
                  {currentUser.role}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onNavigateToFeed}
              className="bg-[#0F6E6E] hover:bg-[#0C5656] text-white text-sm font-medium px-4 py-2 rounded-[10px] transition-colors min-h-[44px] cursor-pointer btn-campus shadow-xs"
            >
              Go to Feed
            </button>
            <button
              type="button"
              onClick={handleSignOut}
              className="bg-white dark:bg-[#28241F] hover:bg-[#FAF6EF] dark:hover:bg-[#332E27] text-[#4A443C] dark:text-[#CEC7BB] text-sm font-medium px-4 py-2 rounded-[10px] border border-[#A39A8C] dark:border-[#5A5349] transition-colors min-h-[44px] cursor-pointer btn-campus"
            >
              Sign Out
            </button>
          </div>
        </div>
      )}

      {!currentUser && (
        <div className="bg-white dark:bg-[#1E1C18] rounded-[12px] border border-[#C4BBAF] dark:border-[#3E3931] shadow-xs overflow-hidden">
          <div className="bg-[#FAF6EF] dark:bg-[#141311] px-5 py-3.5 border-b border-[#C4BBAF] dark:border-[#3E3931] flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-[#0F6E6E] dark:text-[#199595]" />
              <span className="font-medium text-sm text-[#1F1B16] dark:text-[#F5F1EA]">
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
              <p className="text-sm text-[#4A443C] dark:text-[#CEC7BB] leading-relaxed">
                Use your verified Nile University email and password to browse lost and found items, report misplaced belongings, and submit ownership claims.
              </p>
            </div>

            {errorMessage && (
              <div role="alert" className="bg-[#FDF2F2] dark:bg-[#2B0E0E] border border-[#F87171]/50 text-[#9B1C1C] dark:text-[#F87171] text-sm p-3.5 rounded-[10px] flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {successMessage && (
              <div role="status" className="bg-[#EDF7F1] dark:bg-[#0E2417] border border-[#2F7D4F]/40 text-[#1B5633] dark:text-[#75CE9A] text-sm p-3.5 rounded-[10px] flex items-center gap-2.5">
                <Check className="w-4 h-4 shrink-0" />
                <span>{successMessage}</span>
              </div>
            )}

            {showInbox ? (
              <div className="space-y-4 text-center">
                <h3 className="font-serif font-bold text-base text-[#1F1B16] dark:text-[#F5F1EA]">Check your inbox</h3>
                <p className="text-sm text-[#4A443C] dark:text-[#CEC7BB]">
                  Verify your email address before posting, claiming, or reading campus items.
                </p>
                <p className="text-sm text-[#5C554C] dark:text-[#A8A095]">
                  Check your spam or junk folder if the email does not arrive.
                </p>
                <button
                  type="button"
                  onClick={resendVerification}
                  disabled={cooldown > 0}
                  className="w-full min-h-[44px] bg-white dark:bg-[#28241F] hover:bg-[#FAF6EF] dark:hover:bg-[#332E27] text-[#1F1B16] dark:text-[#F5F1EA] border border-[#A39A8C] dark:border-[#5A5349] rounded-[10px] text-sm font-medium cursor-pointer transition-colors"
                >
                  {cooldown > 0 ? `Resend email (${cooldown}s)` : 'Resend email'}
                </button>
                <button
                  type="button"
                  onClick={confirmVerified}
                  className="w-full min-h-[44px] bg-[#0F6E6E] hover:bg-[#0C5656] text-white rounded-[10px] text-sm font-medium cursor-pointer transition-colors"
                >
                  I have verified
                </button>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="text-sm text-[#0F6E6E] dark:text-[#199595] underline cursor-pointer min-h-[44px] px-2"
                >
                  Wrong email? Use a different one
                </button>
              </div>
            ) : (
              <>
                <form onSubmit={handleEmailAuth} className="space-y-3.5">
                  {mode === 'sign-up' && (
                    <div>
                      <label htmlFor="login-full-name" className="block text-sm font-medium text-[#4A443C] dark:text-[#CEC7BB] mb-1">
                        Full name
                      </label>
                      <input
                        id="login-full-name"
                        type="text"
                        autoComplete="name"
                        required
                        minLength={2}
                        maxLength={100}
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="e.g. Chidera Eze"
                        className={INPUT_CLASS}
                      />
                    </div>
                  )}

                  <div>
                    <label htmlFor="login-email" className="block text-sm font-medium text-[#4A443C] dark:text-[#CEC7BB] mb-1">
                      Nile University email
                    </label>
                    <input
                      id="login-email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@nileuniversity.edu.ng"
                      className={INPUT_CLASS}
                    />
                  </div>

                  <div>
                    <label htmlFor="login-password" className="block text-sm font-medium text-[#4A443C] dark:text-[#CEC7BB] mb-1">
                      Password
                    </label>
                    <div className="relative">
                      <input
                        id="login-password"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'}
                        required
                        minLength={8}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Password"
                        className={`${INPUT_CLASS} pr-20`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((value) => !value)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 px-2.5 py-1.5 text-sm font-medium text-[#0F6E6E] dark:text-[#199595] hover:underline cursor-pointer"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? 'Hide' : 'Show'}
                      </button>
                    </div>
                  </div>

                  {mode === 'sign-up' && (
                    <div>
                      <label htmlFor="login-confirm-password" className="block text-sm font-medium text-[#4A443C] dark:text-[#CEC7BB] mb-1">
                        Confirm password
                      </label>
                      <input
                        id="login-confirm-password"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        required
                        minLength={8}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm password"
                        className={INPUT_CLASS}
                      />
                      <p className="text-sm text-[#5C554C] dark:text-[#A8A095] mt-1">
                        Password: 8+ characters, including one letter and one number.
                      </p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isSigningIn}
                    className="w-full min-h-[44px] bg-[#0F6E6E] hover:bg-[#0C5656] disabled:opacity-60 text-white rounded-[10px] text-sm font-semibold cursor-pointer btn-campus shadow-xs"
                  >
                    {mode === 'sign-up' ? 'Create account' : 'Sign in with email'}
                  </button>

                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <button
                      type="button"
                      onClick={() => { clearFeedback(); setMode(mode === 'sign-up' ? 'sign-in' : 'sign-up'); }}
                      className="text-[#0F6E6E] dark:text-[#199595] underline cursor-pointer min-h-[44px]"
                    >
                      {mode === 'sign-up' ? 'Already have an account? Sign in' : 'Create an account'}
                    </button>
                    {mode === 'sign-in' && (
                      <button
                        type="button"
                        onClick={handleForgotPassword}
                        className="text-[#0F6E6E] dark:text-[#199595] underline cursor-pointer min-h-[44px]"
                      >
                        Forgot password
                      </button>
                    )}
                  </div>
                </form>

                <div className="flex items-center gap-3 text-sm text-[#5C554C] dark:text-[#A8A095]">
                  <span className="h-px flex-1 bg-[#C4BBAF] dark:bg-[#3E3931]" />
                  <span>or</span>
                  <span className="h-px flex-1 bg-[#C4BBAF] dark:bg-[#3E3931]" />
                </div>

                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={isSigningIn}
                  className="w-full min-h-[44px] bg-white dark:bg-[#28241F] hover:bg-[#FAF6EF] dark:hover:bg-[#332E27] text-[#1F1B16] dark:text-[#F5F1EA] border border-[#A39A8C] dark:border-[#5A5349] rounded-[10px] text-sm font-medium cursor-pointer"
                >
                  Continue with Google
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
