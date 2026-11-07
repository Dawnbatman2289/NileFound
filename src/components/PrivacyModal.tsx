/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Privacy Policy Modal for NileFound
 * Plain-English explanation of data collection, 60-day auto-purge retention,
 * and user deletion requests styled in Deep Navy (#0B1020) and Electric Lime (#C6FF3D).
 */

import React from 'react';
import { X, ShieldCheck, Clock, Trash2, Database } from 'lucide-react';

interface PrivacyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PrivacyModal: React.FC<PrivacyModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-[480px] bg-white dark:bg-[#1E1C18] text-[#1F1B16] dark:text-[#F5F1EA] rounded-[12px] shadow-xl max-h-[100dvh] overflow-hidden border border-[#E6DFD2] dark:border-[#2E2A24] my-3 sm:my-6 flex flex-col min-w-0">
        {/* Header */}
        <div className="bg-[#FAF6EF] dark:bg-[#141311] px-6 py-4 border-b border-[#E6DFD2] dark:border-[#2E2A24] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-[#0F6E6E] dark:text-[#199595]" />
            <h3 className="font-serif font-bold text-base tracking-tight text-[#1F1B16] dark:text-[#F5F1EA]">Privacy & Data Practices</h3>
          </div>
          <button
            onClick={onClose}
            className="text-[#7A7266] hover:text-[#1F1B16] dark:hover:text-[#F5F1EA] transition-colors p-1 rounded-[6px] cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 space-y-4 text-xs text-[#544E45] dark:text-[#B8B0A2] leading-relaxed min-h-0 flex-1 overflow-y-auto">
          <p className="font-medium text-[#1F1B16] dark:text-[#F5F1EA]">
            NileFound is designed for Nile University students and staff. We do not track devices, sell data, or use advertising cookies.
          </p>

          {/* Section 1: Data Collected */}
          <div className="border border-[#E6DFD2] dark:border-[#2E2A24] rounded-[10px] p-4 bg-[#FAF6EF] dark:bg-[#141311] space-y-2">
            <div className="flex items-center gap-2 font-semibold text-[#0F6E6E] dark:text-[#199595] text-xs">
              <Database className="w-4 h-4 shrink-0" />
              <span>What data is collected</span>
            </div>
            <ul className="list-disc list-inside space-y-1.5 pl-1 text-[#544E45] dark:text-[#B8B0A2]">
              <li><strong className="text-[#1F1B16] dark:text-[#F5F1EA]">Item descriptions:</strong> category, physical description, and campus location.</li>
              <li><strong className="text-[#1F1B16] dark:text-[#F5F1EA]">No public contact details:</strong> phone numbers, matric numbers, and emails are blocked from public listings.</li>
              <li><strong className="text-[#1F1B16] dark:text-[#F5F1EA]">Found Student ID cards:</strong> names and matric numbers are never displayed on public feeds. Photos of ID cards are completely disabled.</li>
              <li><strong className="text-[#1F1B16] dark:text-[#F5F1EA]">Verification answers:</strong> private questions and answers are stored separately in protected records and accessible only during verified ownership checks.</li>
            </ul>
          </div>

          {/* Section 2: Retention */}
          <div className="border border-[#E6DFD2] dark:border-[#2E2A24] rounded-[10px] p-4 bg-[#FAF6EF] dark:bg-[#141311] space-y-1.5">
            <div className="flex items-center gap-2 font-semibold text-[#0F6E6E] dark:text-[#199595] text-xs">
              <Clock className="w-4 h-4 shrink-0" />
              <span>How long data is kept</span>
            </div>
            <p className="text-[#544E45] dark:text-[#B8B0A2]">
              Records are retained for a maximum of <strong className="text-[#1F1B16] dark:text-[#F5F1EA]">60 days</strong>. After 60 days, unclaimed or completed records are automatically purged to prevent stale campus records.
            </p>
          </div>

          {/* Section 3: Deletion */}
          <div className="border border-[#E6DFD2] dark:border-[#2E2A24] rounded-[10px] p-4 bg-[#FAF6EF] dark:bg-[#141311] space-y-1.5">
            <div className="flex items-center gap-2 font-semibold text-[#0F6E6E] dark:text-[#199595] text-xs">
              <Trash2 className="w-4 h-4 shrink-0" />
              <span>How to request deletion</span>
            </div>
            <p className="text-[#544E45] dark:text-[#B8B0A2]">
              You can request immediate removal of any report or claim at any time:
            </p>
            <ul className="list-disc list-inside space-y-1 pl-1 text-[#544E45] dark:text-[#B8B0A2]">
              <li>Speak to the duty officer at the Main Campus Gate security post.</li>
              <li>Visit the Student Affairs office in Nile House.</li>
              <li>Or email the campus administrator at <code className="bg-white dark:bg-[#1E1C18] px-1.5 py-0.5 rounded text-[#0F6E6E] dark:text-[#199595] font-mono border border-[#E6DFD2] dark:border-[#2E2A24]">studentaffairs@nileuniversity.edu.ng</code>.</li>
            </ul>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              onClick={onClose}
              className="bg-[#0F6E6E] hover:bg-[#0C5656] text-white font-medium px-6 py-2.5 rounded-[10px] text-xs transition-colors shadow-xs cursor-pointer btn-campus"
            >
              Understood
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
