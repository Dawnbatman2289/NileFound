/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * NileFound Authentication Screen
 * Layout: Card with security requirements, domain validation, and role assignment.
 * Main Action: Sign in using Nile University student or staff credentials.
 */

import React, { useState } from 'react';
import { Shield, Check, UserCheck, AlertTriangle, Lock } from 'lucide-react';
import { User, UserRole } from '../types/index.ts';

interface LoginPageProps {
  currentUser: User | null;
  onLogin: (user: User) => void;
  onLogout: () => void;
  onNavigateToFeed: () => void;
  isDemoMode: boolean;
}

const ADMIN_EMAILS = [
  'ayomide2289@gmail.com', // Pilot exception: project lead
  'admin@nileuniversity.edu.ng'
];

const SECURITY_EMAILS = [
  'security.gate@nileuniversity.edu.ng',
  'security@nileuniversity.edu.ng',
  'musa.security@nileuniversity.edu.ng'
];

export function resolveUserRole(email: string): { role: UserRole; isAdmin: boolean; isPilotException?: boolean } {
  const normalized = email.trim().toLowerCase();
  if (normalized === 'ayomide2289@gmail.com') {
    return { role: 'admin', isAdmin: true, isPilotException: true };
  }
  if (ADMIN_EMAILS.includes(normalized)) {
    return { role: 'admin', isAdmin: true };
  }
  if (SECURITY_EMAILS.includes(normalized) || normalized.includes('security@nileuniversity.edu.ng')) {
    return { role: 'security', isAdmin: false };
  }
  return { role: 'student', isAdmin: false };
}

export const LoginPage: React.FC<LoginPageProps> = ({
  currentUser,
  onLogin,
  onLogout,
  onNavigateToFeed,
  isDemoMode
}) => {
  const [emailInput, setEmailInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [loginMessage, setLoginMessage] = useState<string | null>(null);
  const [domainError, setDomainError] = useState<string | null>(null);

  // Preset demo accounts for rapid testing on campus (only shown when demo mode is active)
  const DEMO_ACCOUNTS: User[] = [
    {
      id: 'admin-ayomide',
      name: 'Ayomide (Project Lead)',
      email: 'ayomide2289@gmail.com',
      role: 'admin',
      matricNumber: '24/ENG/0192',
      department: 'Computer Engineering',
      isAdmin: true
    },
    {
      id: 'student-chidera',
      name: 'Chidera Eze',
      email: 'chidera@nileuniversity.edu.ng',
      role: 'student',
      matricNumber: '23/ENG/0481',
      department: 'Computer Engineering',
      isAdmin: false
    },
    {
      id: 'security-musa',
      name: 'Officer Musa (Main Gate)',
      email: 'security.gate@nileuniversity.edu.ng',
      role: 'security',
      department: 'Campus Security & Safety',
      isAdmin: false
    }
  ];

  const handleCustomLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setDomainError(null);
    setLoginMessage(null);

    const email = emailInput.trim().toLowerCase();
    if (!email) return;

    // Check institutional domain with pilot exception for Ayomide
    const isPilotAdmin = email === 'ayomide2289@gmail.com';
    const isNileDomain = email.endsWith('@nileuniversity.edu.ng');

    if (!isPilotAdmin && !isNileDomain) {
      setDomainError('Only @nileuniversity.edu.ng emails can sign in during the pilot.');
      return;
    }

    const { role, isAdmin, isPilotException } = resolveUserRole(email);

    const user: User = {
      id: `user-${Date.now()}`,
      name: nameInput.trim() || (isPilotAdmin ? 'Ayomide' : 'Nile Student'),
      email,
      role,
      isAdmin,
      department: role === 'security' ? 'Campus Security & Safety' : 'Nile University of Nigeria'
    };

    onLogin(user);
    setLoginMessage(`Signed in as ${user.name} (${role.toUpperCase()}${isPilotException ? ' - Pilot Exception' : ''})`);
  };

  const handleSelectDemoAccount = (preset: User) => {
    onLogin(preset);
    setLoginMessage(`Switched active account to ${preset.name}`);
  };

  return (
    <div className="max-w-xl mx-auto py-4 space-y-6">
      {/* Current Session Banner if logged in */}
      {currentUser && (
        <div className="bg-emerald-950 text-white rounded-xl p-4 shadow-xs border border-emerald-900 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-900 border border-emerald-800 flex items-center justify-center font-bold text-amber-300 text-sm">
              {currentUser.name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-white">{currentUser.name}</span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                  currentUser.role === 'admin'
                    ? 'bg-amber-400 text-stone-900'
                    : currentUser.role === 'security'
                    ? 'bg-emerald-700 text-emerald-200'
                    : 'bg-stone-800 text-stone-300'
                }`}>
                  {currentUser.role}
                </span>
                {currentUser.email === 'ayomide2289@gmail.com' && (
                  <span className="text-[9px] bg-amber-400/20 text-amber-300 px-1 rounded border border-amber-400/40">
                    Pilot exception
                  </span>
                )}
              </div>
              <p className="text-xs text-emerald-200/80">{currentUser.email}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onNavigateToFeed}
              className="bg-emerald-800 hover:bg-emerald-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
            >
              Go to Feed
            </button>
            <button
              onClick={onLogout}
              className="bg-stone-900 hover:bg-stone-800 text-stone-300 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      )}

      {/* Main Login Card */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-xs overflow-hidden">
        {/* Prominent DEMO LOGIN NOT SECURE badge */}
        <div className="bg-amber-500 text-stone-950 px-4 py-2.5 font-bold text-xs uppercase tracking-wider flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-stone-950" />
            DEMO LOGIN – NOT SECURE
          </span>
          <span className="text-[10px] bg-stone-900 text-amber-400 font-bold px-1.5 py-0.5 rounded">
            Pilot Prototype
          </span>
        </div>

        {/* Technical requirements explanation */}
        <div className="bg-amber-50 border-b border-amber-200 p-4 text-xs text-amber-950 leading-relaxed">
          <p className="font-semibold text-amber-950 mb-1">Production Architecture Requirement:</p>
          <p className="text-amber-900">
            A production app needs Supabase Auth with Google OAuth restricted to @nileuniversity.edu.ng, plus Row-Level Security policies in Postgres so students can't edit each other's data or view hidden verification answers.
          </p>
        </div>

        <div className="p-5 space-y-5">
          {domainError && (
            <div className="bg-rose-50 border border-rose-300 text-rose-900 text-xs p-3 rounded-lg flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{domainError}</span>
            </div>
          )}

          {loginMessage && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs p-3 rounded-lg flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>{loginMessage}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleCustomLogin} className="space-y-3.5">
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                Full Name:
              </label>
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="e.g. Tunde or Aisha"
                className="w-full text-xs px-3 py-2.5 rounded-lg border border-stone-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                Campus Email Address: <span className="text-rose-500">*</span>
              </label>
              <input
                type="email"
                value={emailInput}
                onChange={(e) => {
                  setEmailInput(e.target.value);
                  setDomainError(null);
                }}
                placeholder="matric@nileuniversity.edu.ng"
                className="w-full text-xs px-3 py-2.5 rounded-lg border border-stone-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-600"
                required
              />
              <span className="text-[11px] text-stone-500 mt-1 block">
                Must end with <code className="bg-stone-100 px-1 py-0.5 rounded text-stone-700 font-mono">@nileuniversity.edu.ng</code>.
                Roles are assigned automatically from the campus registry.
              </span>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg text-xs font-bold shadow-xs transition-colors mt-2"
            >
              Sign In
            </button>
          </form>

          {/* Demo Accounts (For testing only - only visible in demo mode) */}
          {isDemoMode && (
            <div className="pt-4 border-t border-stone-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-stone-700 uppercase tracking-wider">
                  Demo accounts (for testing only):
                </span>
                <span className="text-[10px] text-stone-400">Demo mode active</span>
              </div>

              <div className="grid grid-cols-1 gap-2">
                {DEMO_ACCOUNTS.map((account) => {
                  const isActive = currentUser?.email === account.email;
                  return (
                    <button
                      key={account.id}
                      type="button"
                      onClick={() => handleSelectDemoAccount(account)}
                      className={`w-full p-2.5 rounded-lg border text-left transition-all flex items-center justify-between ${
                        isActive
                          ? 'border-emerald-600 bg-emerald-50/80 ring-1 ring-emerald-600'
                          : 'border-stone-200 hover:border-emerald-500 hover:bg-stone-50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={`w-7 h-7 rounded-md flex items-center justify-center font-bold text-xs ${
                          account.role === 'admin'
                            ? 'bg-amber-400 text-stone-900'
                            : account.role === 'security'
                            ? 'bg-emerald-800 text-white'
                            : 'bg-stone-200 text-stone-700'
                        }`}>
                          {account.role === 'admin' ? '★' : account.role === 'security' ? '🛡' : '🎓'}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-xs text-stone-900">{account.name}</span>
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded uppercase bg-stone-100 text-stone-600">
                              {account.role}
                            </span>
                            {account.email === 'ayomide2289@gmail.com' && (
                              <span className="text-[9px] bg-amber-100 text-amber-800 px-1 rounded">
                                Pilot exception
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-stone-500">{account.email}</span>
                        </div>
                      </div>

                      <div className="text-right">
                        {isActive ? (
                          <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                            <UserCheck className="w-3.5 h-3.5" /> Active
                          </span>
                        ) : (
                          <span className="text-xs font-semibold text-stone-500 hover:text-stone-900">
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
