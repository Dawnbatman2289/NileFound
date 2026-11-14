/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * NileFound Authentication Screen
 * Layout: Standard sign-in interface using paper neutral background and deep teal primary actions.
 */

import React from 'react';
import { Shield, Check, AlertCircle } from 'lucide-react';
import { User } from '../types/index.ts';
import { useLoginAuth } from '../hooks/useLoginAuth.ts';
import { SignedInCard } from './login/SignedInCard.tsx';
import { InboxVerificationCard } from './login/InboxVerificationCard.tsx';

interface LoginPageProps {
  currentUser: User | null;
  onLogin: (user: User) => void;
  onLogout: () => void;
  onNavigateToFeed: () => void;
  isDemoMode: boolean;
}

const INPUT_CLASS =
  'w-full min-h-[44px] px-3.5 py-2.5 rounded-[10px] border border-[#857C70] dark:border-[#787065] bg-white dark:bg-[#141311] text-[#1F1B16] dark:text-[#F5F1EA] placeholder:text-[#5C554C] dark:placeholder:text-[#A8A095] text-base sm:text-sm focus:border-[#0F6E6E]';

export const LoginPage: React.FC<LoginPageProps> = ({
  currentUser,
  onLogin,
  onLogout,
  onNavigateToFeed,
}) => {
  const authState = useLoginAuth({ onLogin, onLogout, onNavigateToFeed });

  return (
    <div className="max-w-xl mx-auto py-6 space-y-6">
      {currentUser ? (
        <SignedInCard currentUser={currentUser} onNavigateToFeed={onNavigateToFeed} onSignOut={authState.handleSignOut} />
      ) : (
        <div className="bg-white dark:bg-[#1E1C18] rounded-[12px] border border-[#C4BBAF] dark:border-[#3E3931] shadow-xs overflow-hidden">
          <div className="bg-[#FAF6EF] dark:bg-[#141311] px-5 py-3.5 border-b border-[#C4BBAF] dark:border-[#3E3931] flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-[#0F6E6E] dark:text-[#199595]" />
              <span className="font-medium text-sm text-[#1F1B16] dark:text-[#F5F1EA]">NileFound Campus Sign-In</span>
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

            {authState.errorMessage && (
              <div role="alert" className="bg-[#FDF2F2] dark:bg-[#2B0E0E] border border-[#F87171]/50 text-[#9B1C1C] dark:text-[#F87171] text-sm p-3.5 rounded-[10px] flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{authState.errorMessage}</span>
              </div>
            )}

            {authState.successMessage && (
              <div role="status" className="bg-[#EDF7F1] dark:bg-[#0E2417] border border-[#2F7D4F]/40 text-[#1B5633] dark:text-[#75CE9A] text-sm p-3.5 rounded-[10px] flex items-center gap-2.5">
                <Check className="w-4 h-4 shrink-0" />
                <span>{authState.successMessage}</span>
              </div>
            )}

            {authState.showInbox ? (
              <InboxVerificationCard
                cooldown={authState.cooldown}
                onResend={authState.resendVerification}
                onConfirmVerified={authState.confirmVerified}
                onSignOut={authState.handleSignOut}
              />
            ) : (
              <>
                <form onSubmit={authState.handleEmailAuth} className="space-y-3.5">
                  {authState.mode === 'sign-up' && (
                    <div>
                      <label htmlFor="login-full-name" className="block text-sm font-medium text-[#4A443C] dark:text-[#CEC7BB] mb-1">Full name</label>
                      <input id="login-full-name" type="text" autoComplete="name" required minLength={2} maxLength={100} value={authState.fullName} onChange={(e) => authState.setFullName(e.target.value)} placeholder="e.g. Chidera Eze" className={INPUT_CLASS} />
                    </div>
                  )}

                  <div>
                    <label htmlFor="login-email" className="block text-sm font-medium text-[#4A443C] dark:text-[#CEC7BB] mb-1">Nile University email</label>
                    <input id="login-email" type="email" autoComplete="email" required value={authState.email} onChange={(e) => authState.setEmail(e.target.value)} placeholder="name@nileuniversity.edu.ng" className={INPUT_CLASS} />
                  </div>

                  <div>
                    <label htmlFor="login-password" className="block text-sm font-medium text-[#4A443C] dark:text-[#CEC7BB] mb-1">Password</label>
                    <div className="relative">
                      <input id="login-password" type={authState.showPassword ? 'text' : 'password'} autoComplete={authState.mode === 'sign-up' ? 'new-password' : 'current-password'} required minLength={8} value={authState.password} onChange={(e) => authState.setPassword(e.target.value)} placeholder="Password" className={`${INPUT_CLASS} pr-20`} />
                      <button type="button" onClick={() => authState.setShowPassword((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 px-2.5 py-1.5 text-sm font-medium text-[#0F6E6E] dark:text-[#199595] hover:underline cursor-pointer" aria-label={authState.showPassword ? 'Hide password' : 'Show password'}>
                        {authState.showPassword ? 'Hide' : 'Show'}
                      </button>
                    </div>
                  </div>

                  {authState.mode === 'sign-up' && (
                    <div>
                      <label htmlFor="login-confirm-password" className="block text-sm font-medium text-[#4A443C] dark:text-[#CEC7BB] mb-1">Confirm password</label>
                      <input id="login-confirm-password" type={authState.showPassword ? 'text' : 'password'} autoComplete="new-password" required minLength={8} value={authState.confirmPassword} onChange={(e) => authState.setConfirmPassword(e.target.value)} placeholder="Confirm password" className={INPUT_CLASS} />
                      <p className="text-sm text-[#5C554C] dark:text-[#A8A095] mt-1">Password: 8+ characters, including one letter and one number.</p>
                    </div>
                  )}

                  <button type="submit" disabled={authState.isSigningIn} className="w-full min-h-[44px] bg-[#0F6E6E] hover:bg-[#0C5656] disabled:opacity-60 text-white rounded-[10px] text-sm font-semibold cursor-pointer btn-campus shadow-xs">
                    {authState.mode === 'sign-up' ? 'Create account' : 'Sign in with email'}
                  </button>

                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <button type="button" onClick={() => { authState.clearFeedback(); authState.setMode(authState.mode === 'sign-up' ? 'sign-in' : 'sign-up'); }} className="text-[#0F6E6E] dark:text-[#199595] underline cursor-pointer min-h-[44px]">
                      {authState.mode === 'sign-up' ? 'Already have an account? Sign in' : 'Create an account'}
                    </button>
                    {authState.mode === 'sign-in' && (
                      <button type="button" onClick={authState.handleForgotPassword} className="text-[#0F6E6E] dark:text-[#199595] underline cursor-pointer min-h-[44px]">
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

                <button type="button" onClick={authState.handleGoogleSignIn} disabled={authState.isSigningIn} className="w-full min-h-[44px] bg-white dark:bg-[#28241F] hover:bg-[#FAF6EF] dark:hover:bg-[#332E27] text-[#1F1B16] dark:text-[#F5F1EA] border border-[#857C70] dark:border-[#787065] rounded-[10px] text-sm font-medium cursor-pointer">
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
