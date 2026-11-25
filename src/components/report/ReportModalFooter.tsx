/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Offline draft save, cancel, and publish actions footer for ReportModal.
 */

import React from 'react';
import { Save } from 'lucide-react';
import { ItemType, User } from '../../types/index.ts';

interface ReportModalFooterProps {
  reportType: ItemType;
  currentUser?: User | null;
  isSubmitting: boolean;
  isCompressing: boolean;
  isSigningIn: boolean;
  onSaveDraft: () => void;
  onCancel: () => void;
}

export const ReportModalFooter: React.FC<ReportModalFooterProps> = ({
  reportType,
  currentUser,
  isSubmitting,
  isCompressing,
  isSigningIn,
  onSaveDraft,
  onCancel,
}) => (
  <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-[#C4BBAF] dark:border-[#3E3931]">
    <button
      type="button"
      onClick={onSaveDraft}
      className="text-sm font-medium text-[#5C554C] dark:text-[#A8A095] hover:text-[#0F6E6E] dark:hover:text-[#199595] flex items-center gap-1.5 cursor-pointer min-h-[44px] py-2"
    >
      <Save className="w-4 h-4" />
      <span>Save Offline Draft</span>
    </button>
    <div className="flex gap-2.5">
      <button
        type="button"
        onClick={onCancel}
        className="px-4 py-2 text-sm font-medium text-[#4A443C] dark:text-[#CEC7BB] hover:text-[#1F1B16] dark:hover:text-[#F5F1EA] bg-white dark:bg-[#28241F] rounded-[10px] border border-[#857C70] dark:border-[#787065] transition-colors min-h-[44px] cursor-pointer btn-campus"
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={isSubmitting || isCompressing || isSigningIn}
        className={`px-5 py-2 text-sm font-semibold rounded-[10px] transition-colors min-h-[44px] cursor-pointer shadow-xs disabled:opacity-50 btn-campus ${reportType === 'lost' ? 'bg-[#E8A317] hover:bg-[#d69310] text-[#1F1B16]' : 'bg-[#0F6E6E] hover:bg-[#0C5656] text-white'}`}
      >
        {isSigningIn
          ? 'Signing in...'
          : isSubmitting
            ? 'Publishing...'
            : !currentUser
              ? `Sign in & Post ${reportType === 'lost' ? 'Lost' : 'Found'}`
              : `Post ${reportType === 'lost' ? 'Lost Notice' : 'Found Notice'}`}
      </button>
    </div>
  </div>
);
