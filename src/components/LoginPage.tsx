/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * NileFound Authentication Screen
 * Layout: Clean, standard sign-in interface in Deep Navy (#0B1020), Muted Card (#141B33), and Electric Lime (#C6FF3D).
 * Main Action: Normal Google Sign-In with standard campus wording.
 */

import React, { useState } from 'react';
import { 
  Shield, 
  Check, 
  UserCheck, 
  AlertCircle, 
  LogIn, 
  LogOut, 
  ArrowRight 
} from 'lucide-react';
import { User, UserRole } from '../types/index.ts';
import { auth, googleProvider } from '../lib/firebase.ts';
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { fetchUserRole, syncUserProfile } from '../services/firestoreService.ts';
import { validateAuthEmail, validatePassword } from '../utils/authValidation.ts';

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
  const [showInbox, setShowInbox] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const isMasterAdmin = currentUser?.email?.trim().toLowerCase() === 'ayomide2289@gmail.com';
  const isAdminSimulation = isDemoMode && !!currentUser;
  const canViewDemoAccounts = isMasterAdmin || isAdminSimulation;

  // Master Admin & Test Personas strictly restricted to ayomide2289@gmail.com
  const DEMO_ACCOUNTS: User[] = [
    {
      id: 'master-ayomide',
      name: 'Ayomide (Master Admin)',
      email: 'ayomide2289@gmail.com',
      role: 'admin',
      isAdmin: true,
      department: 'System Owner & University Administration',
    },
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
      name: 'Chidera Eze (Student)',
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

  const friendlyAuthError = (error: any) => {
    if (error?.code === 'auth/account-exists-with-different-credential') {
      return 'An account already exists with another sign-in method. Try Google or use the email address already linked to your account.';
    }
    if (error?.code === 'auth/invalid-credential' || error?.code === 'auth/invalid-login-credentials') {
      return 'The email or password is not correct.';
    }
    if (error?.code === 'auth/email-already-in-use') return 'An account already exists for this email.';
    if (error?.code === 'auth/weak-password') return 'Choose a stronger password with at least six characters.';
    if (error?.code === 'auth/too-many-requests') return 'Too many attempts. Please wait a moment and try again.';
    return 'Could not complete sign in. Please try again.';
  };

  const userFromFirebase = async (fbUser: import('firebase/auth').User): Promise<User> => {
    const userEmail = (fbUser.email || '').trim().toLowerCase();
    const assignedRole = await fetchUserRole(fbUser.uid);
    const isOwner = userEmail === 'ayomide2289@gmail.com';
    const role: UserRole = isOwner ? 'admin' : assignedRole;
    return {
      id: fbUser.uid,
      name: isOwner ? 'Ayomide' : (fbUser.displayName || userEmail.split('@')[0] || 'Campus User').split(' ')[0],
      email: userEmail,
      role,
      isAdmin: role === 'admin',
      department: isOwner ? 'System Owner & University Administration' : 'Nile University Member',
    };
  };

  const handleSelectDemoAccount = (preset: User) => {
    if (!canViewDemoAccounts) {
      setErrorMessage('Unauthorized: Demo accounts are strictly reserved for ayomide2289@gmail.com.');
      return;
    }
    onLogin(preset);
    setSuccessMessage(`Switched active persona to ${preset.name} (${preset.role})`);
  };

  /**
   * Handle standard Google Sign-In with popup
   */
  const handleGoogleSignIn = async () => {
    clearFeedback();
    setIsSigningIn(true);

    try {
      let result;
      try {
        result = await signInWithPopup(auth, googleProvider);
      } catch (popupError: any) {
        if (popupError?.code === 'auth/popup-blocked' || popupError?.code === 'auth/operation-not-supported-in-this-environment') {
          await signInWithRedirect(auth, googleProvider);
          return;
        }
        throw popupError;
      }
      const fbUser = result.user;
      if (!validateAuthEmail(fbUser.email || '')) {
        await signOut(auth);
        setErrorMessage('Use your Nile University email address or the authorized administrator account.');
        return;
      }
      const loggedUser = await userFromFirebase(fbUser);

      try {
        await syncUserProfile(loggedUser);
      } catch (err) {
        console.warn('Could not sync user profile to Firestore:', err);
      }

      onLogin(loggedUser);
      setSuccessMessage(`Signed in as ${loggedUser.name}`);
      onNavigateToFeed();
    } catch (err: any) {
      if (err?.code !== 'auth/popup-closed-by-user' && err?.code !== 'auth/cancelled-popup-request') {
        setErrorMessage(friendlyAuthError(err));
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleEmailAuth = async (event: React.FormEvent) => {
    event.preventDefault();
    clearFeedback();
    setIsSigningIn(true);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      if (!validateAuthEmail(normalizedEmail)) {
        setErrorMessage('Use your Nile University email address or the authorized administrator account.');
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
        await updateProfile(result.user, { displayName: email.trim().split('@')[0] });
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
      setSuccessMessage('Verification email sent again.');
    } catch {
      setErrorMessage('Could not resend the verification email. Please try again.');
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
    } catch (err) {
      console.warn('Sign out error:', err);
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
                  className={`text-[10px] font-sans font-medium px-2 py-0.5 rounded-[4px] border ${
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

      {/* Main Authentication Card */}
      <div className="bg-white dark:bg-[#1E1C18] rounded-[12px] border border-[#E6DFD2] dark:border-[#2E2A24] shadow-xs overflow-hidden">
        {/* Header Notice */}
        <div className="bg-[#FAF6EF] dark:bg-[#141311] px-5 py-3.5 border-b border-[#E6DFD2] dark:border-[#2E2A24] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#0F6E6E] dark:text-[#199595]" />
            <span className="font-medium text-xs text-[#1F1B16] dark:text-[#F5F1EA]">
              NileFound Campus Sign-In
            </span>
          </div>
          <span className="text-[10px] bg-[#E7F3F3] dark:bg-[#0D2D2D] text-[#0F6E6E] dark:text-[#199595] border border-[#0F6E6E]/20 font-sans font-medium px-2 py-0.5 rounded-[4px]">
            Nile University Account
          </span>
        </div>

        <div className="p-6 sm:p-8 space-y-6">
          <div className="space-y-1.5 text-center sm:text-left">
            <h2 className="font-serif text-lg sm:text-xl font-bold text-[#1F1B16] dark:text-[#F5F1EA] tracking-tight">
              Sign in to your campus account
            </h2>
            <p className="text-xs sm:text-sm text-[#544E45] dark:text-[#B8B0A2] leading-relaxed">
              Sign in with your Google account to browse lost and found items, report misplaced belongings, and submit ownership verification claims across Nile University.
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
              <button type="button" onClick={resendVerification} disabled={cooldown > 0} className="w-full min-h-[44px] bg-white dark:bg-[#28241F] border border-[#E6DFD2] dark:border-[#2E2A24] rounded-[10px] text-xs font-medium">
                {cooldown > 0 ? `Resend email (${cooldown}s)` : 'Resend email'}
              </button>
              <button type="button" onClick={confirmVerified} className="w-full min-h-[44px] bg-[#0F6E6E] text-white rounded-[10px] text-xs font-medium">
                I've verified
              </button>
            </div>
          ) : (
          <>
          {/* Standard Single-Tap Google Sign-In */}
          <div className="space-y-3 pt-1">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isSigningIn}
              className="w-full min-h-[48px] py-3 px-6 bg-[#0F6E6E] hover:bg-[#0C5656] disabled:opacity-50 text-white rounded-[10px] text-sm font-medium shadow-xs transition-colors flex items-center justify-center gap-2.5 cursor-pointer active:scale-98 btn-campus"
            >
              <LogIn className="w-4 h-4 text-white" />
              <span>{isSigningIn ? 'Connecting to Google...' : 'Sign in with Google'}</span>
            </button>

            <p className="text-[11px] text-[#7A7266] dark:text-[#857D71] text-center">
              Fast, secure sign-in with your Google account. No password or email link required.
            </p>
          </div>

          <div className="flex items-center gap-3 text-[11px] text-[#7A7266]"><span className="h-px bg-[#E6DFD2] flex-1" /><span>or</span><span className="h-px bg-[#E6DFD2] flex-1" /></div>

          <form onSubmit={handleEmailAuth} className="space-y-3">
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="University email" className="w-full min-h-[44px] px-3 rounded-[10px] border border-[#E6DFD2] dark:border-[#2E2A24] bg-white dark:bg-[#141311] text-xs" />
            <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className="w-full min-h-[44px] px-3 rounded-[10px] border border-[#E6DFD2] dark:border-[#2E2A24] bg-white dark:bg-[#141311] text-xs" />
            <button type="submit" disabled={isSigningIn} className="w-full min-h-[44px] bg-[#2F7D4F] text-white rounded-[10px] text-xs font-medium">
              {mode === 'sign-up' ? 'Create account' : 'Sign in with email'}
            </button>
            <div className="flex items-center justify-between text-[11px]">
              <button type="button" onClick={() => setMode(mode === 'sign-up' ? 'sign-in' : 'sign-up')} className="text-[#0F6E6E] underline">
                {mode === 'sign-up' ? 'Already have an account? Sign in' : 'Create an account'}
              </button>
              {mode === 'sign-in' && <button type="button" onClick={handleForgotPassword} className="text-[#0F6E6E] underline">Forgot password</button>}
            </div>
          </form>
          </>
          )}

          {/* Root Admin Persona Switcher (For Ayomide) */}
          {canViewDemoAccounts && (
            <div className="pt-5 border-t border-[#E6DFD2] dark:border-[#2E2A24] space-y-3">
              <div className="bg-[#FAF6EF] dark:bg-[#141311] border border-[#E6DFD2] dark:border-[#2E2A24] p-3.5 rounded-[10px] text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#0F6E6E] dark:text-[#199595] flex items-center gap-1.5">
                    <Shield className="w-4 h-4" /> Admin Persona Simulation
                  </span>
                  <span className="text-[10px] bg-white dark:bg-[#1E1C18] text-[#544E45] dark:text-[#B8B0A2] px-2 py-0.5 rounded-[4px] border border-[#E6DFD2] dark:border-[#2E2A24]">
                    ayomide2289@gmail.com
                  </span>
                </div>
                <p className="text-[11px] text-[#544E45] dark:text-[#B8B0A2]">
                  Switch between demo personas to test how students, security officers, and administrators experience NileFound.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-2">
                {DEMO_ACCOUNTS.map((account) => {
                  const isActive = currentUser?.email === account.email;
                  return (
                    <button
                      key={account.id}
                      type="button"
                      onClick={() => handleSelectDemoAccount(account)}
                      className={`w-full min-h-[44px] p-3 rounded-[10px] border text-left transition-colors flex items-center justify-between cursor-pointer btn-campus ${
                        isActive
                          ? 'border-[#0F6E6E] bg-[#E7F3F3] dark:bg-[#0D2D2D]'
                          : 'border-[#E6DFD2] dark:border-[#2E2A24] bg-white dark:bg-[#141311] hover:bg-[#FAF6EF] dark:hover:bg-[#1E1C18]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-7 h-7 rounded-[6px] flex items-center justify-center font-bold text-xs bg-[#FAF6EF] dark:bg-[#1E1C18] text-[#1F1B16] dark:text-[#F5F1EA] border border-[#E6DFD2] dark:border-[#2E2A24]"
                        >
                          {account.name.charAt(0)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-xs text-[#1F1B16] dark:text-[#F5F1EA]">{account.name}</span>
                            <span className="text-[9px] font-sans font-medium px-1.5 py-0.2 rounded-[4px] uppercase bg-[#FAF6EF] dark:bg-[#1E1C18] text-[#544E45] dark:text-[#B8B0A2] border border-[#E6DFD2] dark:border-[#2E2A24]">
                              {account.role}
                            </span>
                          </div>
                          <span className="text-[10px] text-[#7A7266] dark:text-[#857D71]">{account.email}</span>
                        </div>
                      </div>

                      <div className="text-right">
                        {isActive ? (
                          <span className="text-xs font-medium text-[#0F6E6E] dark:text-[#199595] flex items-center gap-1">
                            <UserCheck className="w-3.5 h-3.5" /> Active
                          </span>
                        ) : (
                          <span className="text-xs text-[#7A7266] hover:text-[#1F1B16] dark:hover:text-[#F5F1EA]">
                            Switch →
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
