/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Privacy Policy Modal for NileFound
 * Plain-English explanation of data collection, 60-day auto-purge retention,
 * and user deletion requests styled in Nile Blue & White.
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 my-6">
        {/* Header */}
        <div className="bg-blue-950 text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-blue-300" />
            <h3 className="font-bold text-base">Privacy & Data Practices</h3>
          </div>
          <button
            onClick={onClose}
            className="text-blue-200 hover:text-white transition-colors p-1 rounded-lg"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 text-xs text-slate-700 leading-relaxed max-h-[75vh] overflow-y-auto">
          <p className="font-medium text-slate-800">
            NileFound is designed for Nile University students and staff. We do not track devices, sell data, or use advertising cookies.
          </p>

          {/* Section 1: Data Collected */}
          <div className="border border-slate-200 rounded-lg p-3.5 bg-slate-50/50 space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-slate-900 text-xs">
              <Database className="w-4 h-4 text-blue-900" />
              <span>What data is collected</span>
            </div>
            <ul className="list-disc list-inside space-y-1 pl-1 text-slate-600">
              <li><strong>Item descriptions:</strong> category, physical description, and campus location.</li>
              <li><strong>No public contact details:</strong> phone numbers, matric numbers, and emails are blocked from public listings.</li>
              <li><strong>Found Student ID cards:</strong> names and matric numbers are never displayed on public feeds. Photos of ID cards are completely disabled.</li>
              <li><strong>Verification answers:</strong> private questions and answers are stored separately in protected records and accessible only during verified ownership checks.</li>
            </ul>
          </div>

          {/* Section 2: Retention */}
          <div className="border border-slate-200 rounded-lg p-3.5 bg-slate-50/50 space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-slate-900 text-xs">
              <Clock className="w-4 h-4 text-blue-900" />
              <span>How long data is kept</span>
            </div>
            <p className="text-slate-600">
              Records are retained for a maximum of <strong>60 days</strong>. After 60 days, unclaimed or completed records are automatically purged to prevent stale campus records.
            </p>
          </div>

          {/* Section 3: Deletion */}
          <div className="border border-slate-200 rounded-lg p-3.5 bg-slate-50/50 space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-slate-900 text-xs">
              <Trash2 className="w-4 h-4 text-blue-900" />
              <span>How to request deletion</span>
            </div>
            <p className="text-slate-600">
              You can request immediate removal of any report or claim at any time:
            </p>
            <ul className="list-disc list-inside space-y-1 pl-1 text-slate-600">
              <li>Speak to the duty officer at the Main Campus Gate security post.</li>
              <li>Visit the Student Affairs office in Nile House.</li>
              <li>Or email the campus administrator at <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-800">studentaffairs@nileuniversity.edu.ng</code>.</li>
            </ul>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              onClick={onClose}
              className="bg-blue-900 hover:bg-blue-800 text-white font-semibold px-4 py-2 rounded-lg text-xs transition-colors"
            >
              Understood
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
