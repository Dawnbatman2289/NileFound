/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * NileFound Authentication Screen
 * Layout: Modern dark card in Deep Navy (#0B1020), Muted Card (#141B33), and Electric Lime (#C6FF3D).
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
      const isOwner = email === 'ayomide2289@gmail.com';
      const isStaffOrAdmin = isOwner || assignedRole === 'admin' || assignedRole === 'security';
      const role: UserRole = isOwner ? 'admin' : (isStaffOrAdmin ? assignedRole : 'student');
      const isAdmin = role === 'admin';

      const loggedUser: User = {
        id: uid,
        name: isOwner ? 'Ayomide' : (fbUser.displayName || email.split('@')[0] || 'Campus User'),
        email,
        role,
        isAdmin,
        department: isOwner
          ? 'System Owner & University Administration'
          : (role === 'security' ? 'Campus Security & Safety' : 'Nile University of Nigeria'),
      };

      try {
        await syncUserProfile(loggedUser);
      } catch (err) {
        console.warn('Could not sync user profile to Firestore:', err);
      }

      onLogin(loggedUser);
      setSuccessMessage(`Signed in as ${loggedUser.name}`);
      if (isAdmin) {
        onLogin(loggedUser);
      } else {
        onNavigateToFeed();
      }
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
    <div className="max-w-xl mx-auto py-6 space-y-6">
      {/* Current Active Session Banner */}
      {currentUser && (
        <div className="bg-[#141B33] text-[#F4F6FF] rounded-[20px] p-5 border border-[#1E294B] flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-full bg-[#C6FF3D] text-[#0B1020] font-extrabold flex items-center justify-center text-sm shadow-md">
              {currentUser.name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm text-[#F4F6FF]">{currentUser.name}</span>
                <span
                  className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase ${
                    currentUser.role === 'admin'
                      ? 'bg-[#C6FF3D]/15 text-[#C6FF3D] border border-[#C6FF3D]/30'
                      : currentUser.role === 'security'
                      ? 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
                      : 'bg-[#1E294B] text-slate-300'
                  }`}
                >
                  {currentUser.role}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">{currentUser.email}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onNavigateToFeed}
              className="bg-[#1E294B] hover:bg-[#2A3B66] text-[#F4F6FF] text-xs font-bold px-4 py-2.5 rounded-full border border-[#2A3B66] transition-colors min-h-[44px] cursor-pointer"
            >
              Go to Feed
            </button>
            <button
              onClick={handleSignOut}
              className="bg-[#0B1020] hover:bg-slate-900 text-slate-300 text-xs font-bold px-4 py-2.5 rounded-full border border-[#1E294B] transition-colors min-h-[44px] cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        </div>
      )}

      {/* Main Authentication Card */}
      <div className="bg-[#141B33] rounded-[20px] border border-[#1E294B] shadow-2xl overflow-hidden hover:border-[#C6FF3D]/30 transition-all duration-200">
        {/* Header Notice */}
        <div className="bg-[#0B1020] px-5 py-3.5 border-b border-[#1E294B] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#C6FF3D]" />
            <span className="font-bold text-xs uppercase tracking-wider text-[#F4F6FF]">
              {isDemoMode ? 'Demo Mode Sign-In' : 'NileFound Campus Sign-In'}
            </span>
          </div>
          <span className="text-[10px] bg-[#C6FF3D]/10 text-[#C6FF3D] border border-[#C6FF3D]/30 font-mono font-bold px-2 py-0.5 rounded-full">
            {isDemoMode ? 'Demo Simulation' : 'Live Google Auth'}
          </span>
        </div>

        <div className="p-6 space-y-5">
          {/* Plain explanation */}
          <div className="text-xs text-slate-400 leading-relaxed space-y-1.5">
            <p className="font-bold text-[#F4F6FF] text-sm">
              Sign in with your Google account to access listings, report items, and submit claims.
            </p>
            <p>
              Standard accounts browse listings and file reports. The primary administrator account (<span className="font-mono text-[#C6FF3D] font-medium">ayomide2289@gmail.com</span>) automatically opens the Operations & Custody Desk.
            </p>
          </div>

          {/* Feedback Messages */}
          {errorMessage && (
            <div className="bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs p-3.5 rounded-xl flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="bg-[#C6FF3D]/10 border border-[#C6FF3D]/30 text-[#C6FF3D] text-xs p-3.5 rounded-xl flex items-center gap-2.5">
              <Check className="w-4 h-4 text-[#C6FF3D] shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Live Single-Tap Google Sign-In */}
          <div className="space-y-3 pt-2">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isSigningIn}
              className="w-full min-h-[48px] py-3.5 px-5 bg-[#C6FF3D] hover:bg-[#b8f52f] disabled:opacity-50 text-[#0B1020] rounded-full text-sm font-extrabold shadow-[0_0_20px_rgba(198,255,61,0.25)] hover:shadow-[0_0_25px_rgba(198,255,61,0.4)] transition-all flex items-center justify-center gap-3 cursor-pointer active:scale-95"
            >
              <LogIn className="w-5 h-5 text-[#0B1020]" />
              <span>{isSigningIn ? 'Signing in with Google...' : 'Sign in with Google'}</span>
            </button>

            <p className="text-[11px] text-slate-400 text-center">
              Uses Google Authentication. No password or email verification link needed.
            </p>
          </div>

          {/* DEMO MODE ONLY: Simulated accounts when demo toggle is enabled in navbar */}
          {isDemoMode && (
            <div className="pt-4 border-t border-[#1E294B] space-y-3">
              <div className="bg-amber-400/10 border border-amber-400/30 text-amber-300 p-3 rounded-xl text-xs">
                <span className="font-bold">Demo Mode active:</span> Choose a simulated campus account below for offline testing.
              </div>

              <div className="grid grid-cols-1 gap-2.5">
                {DEMO_ACCOUNTS.map((account) => {
                  const isActive = currentUser?.email === account.email;
                  return (
                    <button
                      key={account.id}
                      type="button"
                      onClick={() => handleSelectDemoAccount(account)}
                      className={`w-full min-h-[44px] p-3 rounded-xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                        isActive
                          ? 'border-[#C6FF3D] bg-[#C6FF3D]/10 ring-1 ring-[#C6FF3D]'
                          : 'border-[#1E294B] bg-[#0B1020] hover:border-[#2A3B66]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                            account.role === 'admin'
                              ? 'bg-[#C6FF3D] text-[#0B1020]'
                              : account.role === 'security'
                              ? 'bg-blue-600 text-white'
                              : 'bg-[#1E294B] text-slate-300'
                          }`}
                        >
                          {account.role === 'admin' ? 'A' : account.role === 'security' ? 'S' : 'U'}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-[#F4F6FF]">{account.name}</span>
                            <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded uppercase bg-[#141B33] text-slate-400 border border-[#1E294B]">
                              {account.role}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400">{account.email}</span>
                        </div>
                      </div>

                      <div className="text-right">
                        {isActive ? (
                          <span className="text-xs font-bold text-[#C6FF3D] flex items-center gap-1">
                            <UserCheck className="w-3.5 h-3.5" /> Active
                          </span>
                        ) : (
                          <span className="text-xs font-semibold text-slate-400 hover:text-[#F4F6FF]">
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
