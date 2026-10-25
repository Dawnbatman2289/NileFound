/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * NileFound Claim Modal
 * Layout: Verification question prompt, claimant contact fields, and confirmation screen in Nile Blue & White.
 * Main Action: Submit verification response to claim a found item.
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

    setTimeout(() => {
      setIsSubmitting(false);
      setIsVerifiedDemo(true);
      onSuccessClaim(newClaim);
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="bg-blue-900 text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-amber-300" />
            <h3 className="font-semibold text-base">Claim Ownership Verification</h3>
          </div>
          <button
            onClick={onClose}
            className="text-blue-200 hover:text-white transition-colors p-1 rounded-lg"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 max-w-md mx-auto">
          {!isVerifiedDemo ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-950">
                <p className="font-semibold text-blue-900">Item being claimed:</p>
                <p className="font-medium text-sm mt-0.5">{item.title}</p>
                <p className="text-blue-700 text-xs mt-0.5">Found at: {item.location}</p>
              </div>

              {/* The Secret Verification Question */}
              {item.verificationQuestion && (
                <div className="bg-amber-50/90 border border-amber-300/80 rounded-lg p-3.5 space-y-2">
                  <div className="flex items-center gap-1.5 text-amber-900 font-semibold text-xs uppercase tracking-wider">
                    <Lock className="w-3.5 h-3.5 text-amber-700" />
                    <span>Finder's Verification Challenge</span>
                  </div>
                  <p className="text-xs text-amber-950 font-medium leading-relaxed">
                    "{item.verificationQuestion}"
                  </p>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-700 mb-1">
                      Your Precise Answer (Only visible to the finder/security):
                    </label>
                    <input
                      type="text"
                      value={verificationAnswer}
                      onChange={(e) => setVerificationAnswer(e.target.value)}
                      placeholder="e.g. Matric 23/1234, pink sticker on back..."
                      className="w-full text-xs px-3 py-2 rounded-md border border-amber-300 focus:outline-hidden focus:ring-2 focus:ring-blue-800 bg-white"
                      required
                    />
                  </div>
                  <p className="text-[10px] text-amber-800/90">
                    💡 Anti-theft protection: Only the genuine owner knows this specific detail.
                  </p>
                </div>
              )}

              {/* Claimant Contact Details */}
              <div className="space-y-3 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Your Full Name:
                  </label>
                  <input
                    type="text"
                    value={claimantName}
                    onChange={(e) => setClaimantName(e.target.value)}
                    placeholder="e.g. Ibrahim Abubakar"
                    className="w-full text-xs px-3 py-2 rounded-md border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-800"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Student Email (@nileuniversity.edu.ng):
                  </label>
                  <input
                    type="email"
                    value={claimantEmail}
                    onChange={(e) => setClaimantEmail(e.target.value)}
                    placeholder="student.name@nileuniversity.edu.ng"
                    className="w-full text-xs px-3 py-2 rounded-md border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-800"
                    required
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    🔒 Protected under university privacy guidelines: Contact details are never displayed on the public feed.
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
                  className="w-1/2 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-1/2 py-2 text-xs font-semibold text-white bg-blue-900 hover:bg-blue-800 rounded-lg shadow-xs transition-colors flex items-center justify-center gap-1"
                >
                  {isSubmitting ? 'Verifying...' : 'Submit Claim Request'}
                </button>
              </div>
            </form>
          ) : (
            <div className="text-center py-4 space-y-4">
              <div className="w-12 h-12 bg-blue-100 text-blue-800 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-base">Claim Successfully Logged</h4>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Your verification answer has been forwarded to the custodian ({item.holdingLocation.replace(/_/g, ' ')}).
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-900 space-y-2 text-left">
                <div className="flex items-center gap-2 font-semibold">
                  <MessageCircle className="w-4 h-4 text-blue-700 shrink-0" />
                  <span>Next Step: Security & Custodian Handover</span>
                </div>
                <p className="text-[11px] text-blue-800">
                  Once your answer is reviewed by the finder or campus security, an approval notification will confirm handover at a designated campus post.
                </p>
              </div>

              <button
                onClick={onClose}
                className="w-full py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800"
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
