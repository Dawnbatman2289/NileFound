/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Reporter identity banner, draft status alerts, and officer quick-fill presets.
 */

import React from 'react';
import { AlertTriangle, CheckCircle, Lock, Save } from 'lucide-react';
import { User } from '../../types/index.ts';
import { getRoleDisplayLabel } from '../../utils/admin.ts';
import { OFFICER_INTAKE_PRESETS, type OfficerIntakePreset } from '../../utils/reportPresets.ts';
import type { ReportFormError } from '../../hooks/useReportDraft.ts';

interface ReportIdentityBannerProps {
  currentUser?: User | null;
  isOfficer: boolean;
  isSigningIn: boolean;
  hasRestoredDraft: boolean;
  saveNotice: string | null;
  formError: ReportFormError | null;
  onStartSignIn: () => void;
  onClearDraft: () => void;
  onApplyPreset: (preset: OfficerIntakePreset) => void;
}

export const ReportIdentityBanner: React.FC<ReportIdentityBannerProps> = ({
  currentUser,
  isOfficer,
  isSigningIn,
  hasRestoredDraft,
  saveNotice,
  formError,
  onStartSignIn,
  onClearDraft,
  onApplyPreset,
}) => (
  <>
    {currentUser ? (
      <div className="bg-[#FAF6EF] dark:bg-[#141311] border border-[#C4BBAF] dark:border-[#3E3931] px-3.5 py-2.5 rounded-[10px] text-sm flex items-center justify-between gap-2">
        <span className="text-[#4A443C] dark:text-[#CEC7BB]">Reporting as:</span>
        <span className="font-medium text-[#0F6E6E] dark:text-[#199595] flex items-center gap-1.5 truncate">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span className="truncate">{currentUser.name}</span>
          <span className="text-xs px-1.5 py-0.5 rounded bg-white dark:bg-[#1E1C18] border border-[#C4BBAF] dark:border-[#3E3931] text-[#4A443C] dark:text-[#CEC7BB]">
            {getRoleDisplayLabel(currentUser.role, currentUser.isAdmin)}
          </span>
        </span>
      </div>
    ) : (
      <div className="bg-[#FAF6EF] dark:bg-[#141311] border border-[#C4BBAF] dark:border-[#3E3931] p-3.5 rounded-[10px] text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <Lock className="w-4 h-4 text-[#0F6E6E] dark:text-[#199595] shrink-0" />
          <span className="text-[#4A443C] dark:text-[#CEC7BB]">Sign in required to publish notices and get updates.</span>
        </div>
        <button
          type="button"
          onClick={onStartSignIn}
          disabled={isSigningIn}
          className="bg-[#0F6E6E] hover:bg-[#0C5656] disabled:opacity-50 text-white px-3.5 py-2 rounded-[10px] font-medium text-sm min-h-[44px] shrink-0 cursor-pointer shadow-xs transition-colors text-center btn-campus"
        >
          Open sign-in
        </button>
      </div>
    )}

    {hasRestoredDraft && (
      <div className="flex items-center justify-between text-sm bg-[#FEF7E9] dark:bg-[#2B210A] text-[#7A5000] dark:text-[#F9CF7C] border border-[#E8A317]/40 p-3 rounded-[10px]">
        <span className="flex items-center gap-2"><Save className="w-4 h-4 shrink-0" />Restored unfinished draft</span>
        <button type="button" onClick={onClearDraft} className="font-bold underline hover:opacity-80 cursor-pointer shrink-0 ml-2 min-h-[44px] px-2">
          Clear
        </button>
      </div>
    )}

    {saveNotice && (
      <div role="status" className="text-sm bg-[#E7F3F3] dark:bg-[#0D2D2D] text-[#0F6E6E] dark:text-[#199595] border border-[#0F6E6E]/30 p-3 rounded-[10px] flex items-center gap-2">
        <CheckCircle className="w-4 h-4 shrink-0" />
        <span>{saveNotice}</span>
      </div>
    )}

    {formError && (
      <div role="alert" className="bg-[#FDF2F2] dark:bg-[#2B0E0E] border border-[#F87171]/50 text-[#9B1C1C] dark:text-[#F87171] text-sm p-3.5 rounded-[10px] flex items-start gap-2.5">
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
        <div>
          <p className="font-bold">{formError.heading}</p>
          <p className="mt-0.5">{formError.detail}</p>
        </div>
      </div>
    )}

    {isOfficer && (
      <div className="bg-[#FAF6EF] dark:bg-[#141311] border border-[#C4BBAF] dark:border-[#3E3931] rounded-[10px] p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-[#0F6E6E] dark:text-[#199595]">
            Quick Officer Intake
          </span>
          <span className="text-xs text-[#5C554C] dark:text-[#A8A095]">1-tap gate custody fill</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {OFFICER_INTAKE_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => onApplyPreset(preset)}
              className="min-h-[44px] px-3 py-1.5 rounded-[10px] border border-[#857C70] dark:border-[#787065] bg-white dark:bg-[#1E1C18] hover:border-[#0F6E6E] text-xs font-medium text-[#1F1B16] dark:text-[#F5F1EA] cursor-pointer transition-colors btn-campus"
            >
              + {preset.label}
            </button>
          ))}
        </div>
      </div>
    )}
  </>
);
