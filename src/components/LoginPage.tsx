/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * NileFound Authentication Screen
 * Layout: Clean single-column institutional sign-in card in Nile Blue (#002B66) and white with Google Sign-In button and demo account selector.
 * Main Action: Sign in with Google with no email domain restrictions, syncing user profile and roles to Firestore.
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
import { signInWithPopup, signOut } from 'firebase/auth';
import { fetchUserRole, syncUserProfile } from '../services/firestoreService.ts';

interface LoginPageProps {
  currentUser: User | null;
  onLogin: (user: User) => void;
  onLogout: () => void;
  onNavigateToFeed: () => void;
  isDemoMode: boolean;
  builderMode?: boolean;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  currentUser,
  onLogin,
  onLogout,
  onNavigateToFeed,
  isDemoMode,
  builderMode = false,
}) => {
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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
   * Handle standard Google Sign-In with popup (no email domain constraints)
   */
  const handleGoogleSignIn = async () => {
    clearFeedback();
    setIsSigningIn(true);

    try {
      const result = await signInWithPopup(auth, googleProvider);
      const fbUser = result.user;
      const email = (fbUser.email || '').trim().toLowerCase();
      const uid = fbUser.uid;

      // Check role in /roles/{uid}
      const assignedRole = await fetchUserRole(uid);
      const isStaffOrAdmin = assignedRole === 'admin' || assignedRole === 'security';
      const role: UserRole = isStaffOrAdmin ? assignedRole : 'student';
      const isAdmin = role === 'admin';

      const loggedUser: User = {
        id: uid,
        name: fbUser.displayName || email.split('@')[0] || 'Campus User',
        email,
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
      if (err?.code !== 'auth/popup-closed-by-user' && err?.code !== 'auth/cancelled-popup-request') {
        console.error('Sign-in error:', err);
        setErrorMessage(err?.message || 'Could not complete sign in. Please try again.');
      }
    } finally {
      setIsSigningIn(false);
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
              {isDemoMode && builderMode ? 'Demo Mode Authentication' : 'NileFound Campus Sign-In'}
            </span>
          </div>
          <span className="text-[10px] bg-blue-800 text-blue-200 font-semibold px-2 py-0.5 rounded">
            {isDemoMode && builderMode ? 'Demo Simulation' : 'Direct Access'}
          </span>
        </div>

        <div className="p-5 space-y-5">
          {/* Plain explanation */}
          <div className="text-xs text-slate-600 leading-relaxed space-y-1">
            <p className="font-semibold text-slate-900">
              Sign in with your Google account to access listings, report items, and submit claims.
            </p>
            <p>
              Standard accounts browse listings and file reports. Staff and admin privileges are assigned via the campus directory.
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

          {/* REAL MODE: Single-Tap Google Sign-In */}
          {(!isDemoMode || !builderMode) && (
            <div className="space-y-3 pt-2">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isSigningIn}
                className="w-full min-h-[48px] py-3 px-4 bg-blue-900 hover:bg-blue-800 disabled:opacity-50 text-white rounded-lg text-sm font-bold shadow-xs transition-colors flex items-center justify-center gap-3"
              >
                <LogIn className="w-5 h-5 text-blue-200" />
                <span>{isSigningIn ? 'Signing in with Google...' : 'Sign in with Google'}</span>
              </button>

              <p className="text-[11px] text-slate-500 text-center">
                Uses Google Authentication. No password or email verification link needed.
              </p>
            </div>
          )}

          {/* DEMO MODE ONLY: Simulated accounts (only visible when ?builder=1) */}
          {isDemoMode && builderMode && (
            <div className="pt-2 border-t border-slate-200 space-y-3">
              <div className="bg-amber-50 border border-amber-300 text-amber-950 p-2.5 rounded-lg text-xs">
                <span className="font-bold">Demo Mode active:</span> Choose a simulated campus account below. Real mode connects to live Google Auth.
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
