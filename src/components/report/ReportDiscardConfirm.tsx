/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Discard-confirmation banner inside the item reporting dialog.
 */

import React from 'react';

interface ReportDiscardConfirmProps {
  onKeepEditing: () => void;
  onConfirmClose: () => void;
}

export const ReportDiscardConfirm: React.FC<ReportDiscardConfirmProps> = ({
  onKeepEditing,
  onConfirmClose,
}) => (
  <div
    role="alertdialog"
    aria-labelledby="discard-report-title"
    className="bg-[#FEF7E9] dark:bg-[#2B210A] border-b border-[#E8A317]/40 px-5 py-3.5 text-sm space-y-2.5"
  >
    <p id="discard-report-title" className="font-semibold text-[#7A5000] dark:text-[#F9CF7C]">
      Close this report form?
    </p>
    <p className="text-xs text-[#7A5000] dark:text-[#F9CF7C]">
      Your text fields are saved offline as a draft, but attached photos and secret verification answers are not saved until submitted.
    </p>
    <div className="flex flex-wrap gap-2 justify-end">
      <button
        type="button"
        onClick={onKeepEditing}
        className="min-h-[44px] px-3.5 rounded-[10px] bg-white dark:bg-[#1E1C18] border border-[#857C70] dark:border-[#787065] text-xs font-semibold text-[#1F1B16] dark:text-[#F5F1EA] cursor-pointer"
      >
        Keep editing
      </button>
      <button
        type="button"
        onClick={onConfirmClose}
        className="min-h-[44px] px-3.5 rounded-[10px] bg-[#9B1C1C] text-white text-xs font-semibold cursor-pointer"
      >
        Close form
      </button>
    </div>
  </div>
);
