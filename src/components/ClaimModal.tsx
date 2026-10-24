/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ShieldCheck, Lock, AlertCircle, MessageCircle, X, CheckCircle2 } from 'lucide-react';
import { CampusItem, ClaimRecord } from '../types/index.ts';

interface ClaimModalProps {
  item: CampusItem | null;
  onClose: () => void;
  onSuccessClaim: (claim: ClaimRecord) => void;
}

export const ClaimModal: React.FC<ClaimModalProps> = ({ item, onClose, onSuccessClaim }) => {
  const [claimantName, setClaimantName] = useState('');
  const [claimantEmail, setClaimantEmail] = useState('');
  const [verificationAnswer, setVerificationAnswer] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVerifiedDemo, setIsVerifiedDemo] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!item) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!claimantName.trim() || !claimantEmail.trim()) {
      setErrorMsg('Please enter your full name and student email.');
      return;
    }
    if (item.verificationQuestion && !verificationAnswer.trim()) {
      setErrorMsg('Please answer the finder’s secret verification question.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    const newClaim: ClaimRecord = {
      id: `claim-${Date.now()}`,
      itemId: item.id,
      itemTitle: item.title,
      claimantName: claimantName.trim(),
      claimantEmail: claimantEmail.trim(),
      submittedAnswer: verificationAnswer.trim(),
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    // Simulate verification
    setTimeout(() => {
      setIsSubmitting(false);
      setIsVerifiedDemo(true);
      onSuccessClaim(newClaim);
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full overflow-hidden border border-emerald-900/10">
        {/* Header */}
        <div className="bg-emerald-900 text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-amber-300" />
            <h3 className="font-semibold text-base">Claim Ownership Verification</h3>
          </div>
          <button
            onClick={onClose}
            className="text-emerald-200 hover:text-white transition-colors p-1 rounded-lg"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 max-w-md mx-auto">
          {!isVerifiedDemo ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-200/80 rounded-lg p-3 text-xs text-emerald-950">
                <p className="font-semibold text-emerald-900">Item being claimed:</p>
                <p className="font-medium text-sm mt-0.5">{item.title}</p>
                <p className="text-emerald-700 text-xs mt-0.5">Found at: {item.location}</p>
              </div>

              {/* The Secret Verification Question (Core anti-theft mechanism) */}
              {item.verificationQuestion && (
                <div className="bg-amber-50/90 border border-amber-300/80 rounded-lg p-3.5 space-y-2">
                  <div className="flex items-center gap-1.5 text-amber-900 font-semibold text-xs uppercase tracking-wider">
                    <Lock className="w-3.5 h-3.5 text-amber-700" />
                    <span>Finder's Secret Verification Challenge</span>
                  </div>
                  <p className="text-xs text-amber-950 font-medium leading-relaxed">
                    "{item.verificationQuestion}"
                  </p>
                  <div>
                    <label className="block text-[11px] font-medium text-stone-700 mb-1">
                      Your Precise Answer (Only visible to the finder/security):
                    </label>
                    <input
                      type="text"
                      value={verificationAnswer}
                      onChange={(e) => setVerificationAnswer(e.target.value)}
                      placeholder="e.g. Matric 23/1234, pink sticker on back..."
                      className="w-full text-xs px-3 py-2 rounded-md border border-amber-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-600 bg-white"
                      required
                    />
                  </div>
                  <p className="text-[10px] text-amber-800/90">
                    💡 <strong>Anti-theft protection:</strong> If someone made a false claim, they wouldn’t know this detail.
                  </p>
                </div>
              )}

              {/* Claimant Contact Details */}
              <div className="space-y-3 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Your Full Name:
                  </label>
                  <input
                    type="text"
                    value={claimantName}
                    onChange={(e) => setClaimantName(e.target.value)}
                    placeholder="e.g. Ibrahim Abubakar"
                    className="w-full text-xs px-3 py-2 rounded-md border border-stone-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-600"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Student Email (@nileuniversity.edu.ng):
                  </label>
                  <input
                    type="email"
                    value={claimantEmail}
                    onChange={(e) => setClaimantEmail(e.target.value)}
                    placeholder="student.name@nileuniversity.edu.ng"
                    className="w-full text-xs px-3 py-2 rounded-md border border-stone-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-600"
                    required
                  />
                  <p className="text-[10px] text-stone-500 mt-1">
                    🔒 NDPA 2023 Compliance: Your contact details are never shown on the public feed.
                  </p>
                </div>
              </div>

              {errorMsg && (
                <div className="flex items-center gap-1.5 text-xs text-rose-600 bg-rose-50 p-2 rounded border border-rose-200">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-1/2 py-2 text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-1/2 py-2 text-xs font-semibold text-stone-900 bg-amber-400 hover:bg-amber-300 rounded-lg shadow-xs transition-colors flex items-center justify-center gap-1"
                >
                  {isSubmitting ? 'Verifying...' : 'Submit Claim Request'}
                </button>
              </div>
            </form>
          ) : (
            <div className="text-center py-4 space-y-4">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div>
                <h4 className="font-bold text-stone-900 text-base">Claim Successfully Logged!</h4>
                <p className="text-xs text-stone-600 mt-1 leading-relaxed">
                  Your verification answer has been forwarded to the custodian ({item.holdingLocation.replace(/_/g, ' ')}).
                </p>
              </div>

              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs text-emerald-900 space-y-2 text-left">
                <div className="flex items-center gap-2 font-semibold">
                  <MessageCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Secure WhatsApp Relay Link (Demo)</span>
                </div>
                <p className="text-[11px] text-emerald-800">
                  Because your secret detail matched, the secure chat relay is unlocked for hand-off at a designated public campus zone:
                </p>
                <a
                  href={`https://wa.me/?text=Hello!+I+am+the+verified+owner+of+the+item+(${encodeURIComponent(item.title)})+on+NileFound.`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 bg-emerald-600 text-white px-3 py-1.5 rounded-md text-xs font-semibold hover:bg-emerald-700 transition-colors shadow-xs"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  Connect via Safe WhatsApp Relay
                </a>
              </div>

              <button
                onClick={onClose}
                className="w-full py-2 bg-stone-900 text-white rounded-lg text-xs font-semibold hover:bg-stone-800"
              >
                Close & Return to Feed
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
