/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Privacy Policy Modal for NileFound
 * Accurate explanation of data collection, 60-day visual expiry, and user/staff deletion.
 */

import React, { useEffect, useRef } from 'react';
import { X, ShieldCheck, Clock, Trash2, Database } from 'lucide-react';
import { ITEM_EXPIRY_DAYS } from '../config/catalog.ts';

interface PrivacyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PrivacyModal: React.FC<PrivacyModalProps> = ({ isOpen, onClose }) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const timer = window.setTimeout(() => dialogRef.current?.focus(), 0);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('keydown', onKeyDown);
      previousFocusRef.current?.focus?.();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/55 overflow-y-auto"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="privacy-modal-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[480px] bg-white dark:bg-[#1E1C18] text-[#1F1B16] dark:text-[#F5F1EA] rounded-[12px] shadow-xl max-h-[90dvh] overflow-hidden border border-[#C4BBAF] dark:border-[#3E3931] flex flex-col min-w-0 outline-none"
      >
        <div className="bg-[#FAF6EF] dark:bg-[#141311] px-6 py-4 border-b border-[#C4BBAF] dark:border-[#3E3931] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-[#0F6E6E] dark:text-[#199595]" />
            <h3 id="privacy-modal-title" className="font-serif font-bold text-base tracking-tight text-[#1F1B16] dark:text-[#F5F1EA]">
              Privacy & Data Practices
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#5C554C] dark:text-[#A8A095] hover:text-[#1F1B16] dark:hover:text-[#F5F1EA] transition-colors p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-[10px] cursor-pointer"
            aria-label="Close privacy dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-4 text-sm text-[#4A443C] dark:text-[#CEC7BB] leading-relaxed min-h-0 flex-1 overflow-y-auto">
          <p className="font-medium text-[#1F1B16] dark:text-[#F5F1EA]">
            NileFound is built for Nile University students and staff. We do not track devices, sell data, or use advertising cookies.
          </p>

          <div className="border border-[#C4BBAF] dark:border-[#3E3931] rounded-[10px] p-4 bg-[#FAF6EF] dark:bg-[#141311] space-y-2">
            <div className="flex items-center gap-2 font-semibold text-[#0F6E6E] dark:text-[#199595] text-sm">
              <Database className="w-4 h-4 shrink-0" />
              <span>What data is collected</span>
            </div>
            <ul className="list-disc list-inside space-y-1.5 pl-1 text-[#4A443C] dark:text-[#CEC7BB]">
              <li><strong className="text-[#1F1B16] dark:text-[#F5F1EA]">Item descriptions:</strong> category, physical description, and campus location.</li>
              <li><strong className="text-[#1F1B16] dark:text-[#F5F1EA]">No public contact details:</strong> phone numbers, matric numbers, and emails are blocked from public listings.</li>
              <li><strong className="text-[#1F1B16] dark:text-[#F5F1EA]">Found Student ID cards:</strong> names and matric numbers are blocked, and ID card photos are disabled in both the app and security rules.</li>
              <li><strong className="text-[#1F1B16] dark:text-[#F5F1EA]">Verification answers:</strong> private answers are stored in protected Firestore subcollections accessible only to the finder and authorised staff.</li>
            </ul>
          </div>

          <div className="border border-[#C4BBAF] dark:border-[#3E3931] rounded-[10px] p-4 bg-[#FAF6EF] dark:bg-[#141311] space-y-1.5">
            <div className="flex items-center gap-2 font-semibold text-[#0F6E6E] dark:text-[#199595] text-sm">
              <Clock className="w-4 h-4 shrink-0" />
              <span>Retention and {ITEM_EXPIRY_DAYS}-day expiry</span>
            </div>
            <p className="text-[#4A443C] dark:text-[#CEC7BB]">
              Unclaimed notices older than <strong className="text-[#1F1B16] dark:text-[#F5F1EA]">{ITEM_EXPIRY_DAYS} days</strong> are automatically marked as expired in the feed. Campus administrators review and delete resolved or expired records manually from the Operations Desk.
            </p>
          </div>

          <div className="border border-[#C4BBAF] dark:border-[#3E3931] rounded-[10px] p-4 bg-[#FAF6EF] dark:bg-[#141311] space-y-1.5">
            <div className="flex items-center gap-2 font-semibold text-[#0F6E6E] dark:text-[#199595] text-sm">
              <Trash2 className="w-4 h-4 shrink-0" />
              <span>How to delete your notice</span>
            </div>
            <p className="text-[#4A443C] dark:text-[#CEC7BB]">
              You can request immediate removal of any report or claim at any time:
            </p>
            <ul className="list-disc list-inside space-y-1 pl-1 text-[#4A443C] dark:text-[#CEC7BB]">
              <li>Speak to the duty officer at the Main Campus Gate security post.</li>
              <li>Visit the Student Affairs office in Nile House.</li>
              <li>Email the campus office at <code className="bg-white dark:bg-[#1E1C18] px-1.5 py-0.5 rounded text-[#0F6E6E] dark:text-[#199595] font-mono border border-[#C4BBAF] dark:border-[#3E3931]">studentaffairs@nileuniversity.edu.ng</code>.</li>
            </ul>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="bg-[#0F6E6E] hover:bg-[#0C5656] text-white font-medium px-6 py-2.5 min-h-[44px] rounded-[10px] text-sm transition-colors shadow-xs cursor-pointer btn-campus"
            >
              Understood
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
