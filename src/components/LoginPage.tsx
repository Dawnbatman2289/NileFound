/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * NileFound Authentication Screen
 * Layout: Clean single-column card with Nile green branding and quick-role test selectors.
 * Main Action: Sign in as student, campus security officer, or Ayomide (System Admin).
 */

import React, { useState } from 'react';
import { Shield, KeyRound, Check, UserCheck, ArrowRight, Lock } from 'lucide-react';
import { User, UserRole } from '../types/index.ts';

interface LoginPageProps {
  currentUser: User | null;
  onLogin: (user: User) => void;
  onLogout: () => void;
  onNavigateToFeed: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  currentUser,
  onLogin,
  onLogout,
  onNavigateToFeed
}) => {
  const [emailInput, setEmailInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole>('admin');
  const [loginMessage, setLoginMessage] = useState<string | null>(null);

  // Preset demo accounts for rapid testing on campus
  const PRESET_ACCOUNTS: User[] = [
    {
      id: 'admin-ayomide',
      name: 'Ayomide (Project Lead)',
      email: 'ayomide2289@gmail.com',
      role: 'admin',
      matricNumber: '24/ENG/0192',
      department: 'Computer Engineering (100L)',
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
      department: 'Campus Security & Safety Dept',
      isAdmin: false
    }
  ];

  const handleCustomLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim()) return;

    const isAdminEmail = 
      emailInput.toLowerCase().includes('ayomide') || 
      emailInput.toLowerCase() === 'ayomide2289@gmail.com' ||
      selectedRole === 'admin';

    const user: User = {
      id: `user-${Date.now()}`,
      name: nameInput.trim() || (isAdminEmail ? 'Ayomide (Admin)' : 'Nile Student'),
      email: emailInput.trim().toLowerCase(),
      role: isAdminEmail ? 'admin' : selectedRole,
      isAdmin: isAdminEmail,
      department: 'Nile University of Nigeria'
    };

    onLogin(user);
    setLoginMessage(`Logged in as ${user.name}`);
  };

  const handleSelectPreset = (preset: User) => {
    onLogin(preset);
    setLoginMessage(`Switched active account to ${preset.name}`);
  };

  return (
    <div className="max-w-xl mx-auto py-4 space-y-6">
      {/* Current Session Banner if logged in */}
      {currentUser && (
        <div className="bg-emerald-900 text-white rounded-xl p-4 shadow-sm border border-emerald-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-800 border border-emerald-700 flex items-center justify-center font-bold text-amber-300 text-sm">
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
              </div>
              <p className="text-xs text-emerald-200/80">{currentUser.email}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onNavigateToFeed}
              className="bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
            >
              Go to Feed
            </button>
            <button
              onClick={onLogout}
              className="bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      )}

      {/* Main Login Card */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-xs overflow-hidden">
        <div className="bg-emerald-950 text-white p-5 border-b border-emerald-900">
          <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-wider mb-1">
            <Lock className="w-4 h-4" />
            <span>Nile University Authentication Portal</span>
          </div>
          <h2 className="text-lg font-bold">Sign In to NileFound</h2>
          <p className="text-xs text-emerald-200/90 mt-1 leading-relaxed">
            Select your account profile or sign in with your campus email address. Special administrative privileges are reserved for Ayomide.
          </p>
        </div>

        <div className="p-5 space-y-5">
          {loginMessage && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs p-3 rounded-lg flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>{loginMessage}</span>
            </div>
          )}

          {/* Quick 1-Click Role Switcher */}
          <div>
            <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-2">
              Quick Sign-In Presets (Ready for Demo):
            </label>
            <div className="grid grid-cols-1 gap-2.5">
              {PRESET_ACCOUNTS.map((account) => {
                const isActive = currentUser?.email === account.email;
                return (
                  <button
                    key={account.id}
                    type="button"
                    onClick={() => handleSelectPreset(account)}
                    className={`w-full p-3 rounded-lg border text-left transition-all flex items-center justify-between ${
                      isActive
                        ? 'border-emerald-600 bg-emerald-50/80 ring-1 ring-emerald-600'
                        : 'border-stone-200 hover:border-emerald-500 hover:bg-stone-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                        account.role === 'admin'
                          ? 'bg-amber-400 text-stone-900'
                          : account.role === 'security'
                          ? 'bg-emerald-800 text-white'
                          : 'bg-stone-200 text-stone-700'
                      }`}>
                        {account.role === 'admin' ? '★' : account.role === 'security' ? '🛡' : '🎓'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-stone-900">{account.name}</span>
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded uppercase bg-stone-100 text-stone-600">
                            {account.role}
                          </span>
                        </div>
                        <span className="text-[11px] text-stone-500">{account.email}</span>
                      </div>
                    </div>

                    <div className="text-right">
                      {isActive ? (
                        <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                          <UserCheck className="w-4 h-4" /> Active
                        </span>
                      ) : (
                        <span className="text-xs font-semibold text-stone-500 hover:text-stone-900">
                          Sign In →
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-stone-200"></div>
            <span className="flex-shrink mx-3 text-stone-400 text-[11px] uppercase font-bold">Or Enter Custom Credentials</span>
            <div className="flex-grow border-t border-stone-200"></div>
          </div>

          {/* Custom Form */}
          <form onSubmit={handleCustomLogin} className="space-y-3.5">
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                Full Name:
              </label>
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="e.g. Ayomide or Aisha Bello"
                className="w-full text-xs px-3 py-2.5 rounded-lg border border-stone-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                Email Address: <span className="text-rose-500">*</span>
              </label>
              <input
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="ayomide2289@gmail.com or matric@nileuniversity.edu.ng"
                className="w-full text-xs px-3 py-2.5 rounded-lg border border-stone-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-600"
                required
              />
              <span className="text-[10px] text-stone-500 mt-1 block">
                Tip: Signing in with Ayomide's email automatically grants full Admin Panel rights.
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                Assign Role:
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['student', 'security', 'admin'] as UserRole[]).map((role) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => setSelectedRole(role)}
                    className={`py-2 text-xs font-bold rounded-lg border transition-all uppercase text-center ${
                      selectedRole === role
                        ? 'bg-emerald-800 text-white border-emerald-900 shadow-xs'
                        : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                    }`}
                  >
                    {role}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg text-xs font-bold shadow-xs transition-colors mt-2"
            >
              Sign In to Account
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
