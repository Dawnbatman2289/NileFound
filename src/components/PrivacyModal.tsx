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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#0B1020]/80 backdrop-blur-md overflow-y-auto">
      <div className="bg-[#141B33] text-[#F4F6FF] rounded-[20px] shadow-2xl max-w-lg w-full overflow-hidden border border-[#1E294B] my-6">
        {/* Header */}
        <div className="bg-[#0B1020] px-6 py-4 border-b border-[#1E294B] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-[#C6FF3D]" />
            <h3 className="font-extrabold text-base tracking-tight text-[#F4F6FF]">Privacy & Data Practices</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-[#F4F6FF] transition-colors p-1 rounded-lg cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 text-xs text-slate-300 leading-relaxed max-h-[75vh] overflow-y-auto">
          <p className="font-medium text-[#F4F6FF]">
            NileFound is designed for Nile University students and staff. We do not track devices, sell data, or use advertising cookies.
          </p>

          {/* Section 1: Data Collected */}
          <div className="border border-[#1E294B] rounded-xl p-4 bg-[#0B1020] space-y-2">
            <div className="flex items-center gap-2 font-bold text-[#C6FF3D] text-xs">
              <Database className="w-4 h-4 text-[#C6FF3D]" />
              <span>What data is collected</span>
            </div>
            <ul className="list-disc list-inside space-y-1.5 pl-1 text-slate-400">
              <li><strong className="text-slate-200">Item descriptions:</strong> category, physical description, and campus location.</li>
              <li><strong className="text-slate-200">No public contact details:</strong> phone numbers, matric numbers, and emails are blocked from public listings.</li>
              <li><strong className="text-slate-200">Found Student ID cards:</strong> names and matric numbers are never displayed on public feeds. Photos of ID cards are completely disabled.</li>
              <li><strong className="text-slate-200">Verification answers:</strong> private questions and answers are stored separately in protected records and accessible only during verified ownership checks.</li>
            </ul>
          </div>

          {/* Section 2: Retention */}
          <div className="border border-[#1E294B] rounded-xl p-4 bg-[#0B1020] space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-[#C6FF3D] text-xs">
              <Clock className="w-4 h-4 text-[#C6FF3D]" />
              <span>How long data is kept</span>
            </div>
            <p className="text-slate-400">
              Records are retained for a maximum of <strong className="text-slate-200">60 days</strong>. After 60 days, unclaimed or completed records are automatically purged to prevent stale campus records.
            </p>
          </div>

          {/* Section 3: Deletion */}
          <div className="border border-[#1E294B] rounded-xl p-4 bg-[#0B1020] space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-[#C6FF3D] text-xs">
              <Trash2 className="w-4 h-4 text-[#C6FF3D]" />
              <span>How to request deletion</span>
            </div>
            <p className="text-slate-400">
              You can request immediate removal of any report or claim at any time:
            </p>
            <ul className="list-disc list-inside space-y-1 pl-1 text-slate-400">
              <li>Speak to the duty officer at the Main Campus Gate security post.</li>
              <li>Visit the Student Affairs office in Nile House.</li>
              <li>Or email the campus administrator at <code className="bg-[#141B33] px-1.5 py-0.5 rounded text-[#C6FF3D] font-mono border border-[#1E294B]">studentaffairs@nileuniversity.edu.ng</code>.</li>
            </ul>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              onClick={onClose}
              className="bg-[#C6FF3D] hover:bg-[#b8f52f] text-[#0B1020] font-extrabold px-6 py-2.5 rounded-full text-xs transition-all shadow-[0_0_15px_rgba(198,255,61,0.2)] cursor-pointer"
            >
              Understood
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
