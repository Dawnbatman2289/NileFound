/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * NileFound Claim Modal
 * Layout: Verification question prompt, claimant contact fields, and confirmation screen in Deep Navy (#0B1020) and Electric Lime (#C6FF3D).
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0B1020]/80 backdrop-blur-md">
      <div className="bg-[#141B33] text-[#F4F6FF] rounded-[20px] shadow-2xl max-w-lg w-full overflow-hidden border border-[#1E294B] my-6">
        {/* Header */}
        <div className="bg-[#0B1020] px-6 py-4 border-b border-[#1E294B] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-[#C6FF3D]" />
            <h3 className="font-extrabold text-base tracking-tight text-[#F4F6FF]">Claim Ownership Verification</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-[#F4F6FF] transition-colors p-1 rounded-lg cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-w-md mx-auto">
          {!isVerifiedDemo ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="bg-[#0B1020] border border-[#1E294B] rounded-xl p-3.5 text-xs text-slate-300">
                <p className="font-bold text-[#C6FF3D]">Item being claimed:</p>
                <p className="font-extrabold text-sm text-[#F4F6FF] mt-1">{item.title}</p>
                <p className="text-slate-400 text-xs mt-0.5">Found at: {item.location}</p>
              </div>

              {/* The Secret Verification Question */}
              {item.verificationQuestion && (
                <div className="bg-[#0B1020] border border-[#1E294B] rounded-xl p-4 space-y-2.5">
                  <div className="flex items-center gap-2 text-[#C6FF3D] font-bold text-xs uppercase tracking-wider">
                    <Lock className="w-3.5 h-3.5 text-[#C6FF3D]" />
                    <span>Finder's Verification Challenge</span>
                  </div>
                  <p className="text-xs text-slate-200 font-medium leading-relaxed">
                    "{item.verificationQuestion}"
                  </p>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 mb-1">
                      Your Precise Answer (Only visible to the finder/security):
                    </label>
                    <input
                      type="text"
                      value={verificationAnswer}
                      onChange={(e) => setVerificationAnswer(e.target.value)}
                      placeholder="e.g. Matric 23/1234, pink sticker on back..."
                      className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-[#1E294B] bg-[#141B33] text-[#F4F6FF] focus:border-[#C6FF3D] focus:outline-hidden min-h-[44px]"
                      required
                    />
                  </div>
                  <p className="text-[10px] text-slate-400">
                    💡 Anti-theft protection: Only the genuine owner knows this specific detail.
                  </p>
                </div>
              )}

              {/* Claimant Contact Details */}
              <div className="space-y-3 pt-1">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Your Full Name:
                  </label>
                  <input
                    type="text"
                    value={claimantName}
                    onChange={(e) => setClaimantName(e.target.value)}
                    placeholder="e.g. Ibrahim Abubakar"
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-[#1E294B] bg-[#0B1020] text-[#F4F6FF] focus:border-[#C6FF3D] focus:outline-hidden min-h-[44px]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Student Email (@nileuniversity.edu.ng):
                  </label>
                  <input
                    type="email"
                    value={claimantEmail}
                    onChange={(e) => setClaimantEmail(e.target.value)}
                    placeholder="student.name@nileuniversity.edu.ng"
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-[#1E294B] bg-[#0B1020] text-[#F4F6FF] focus:border-[#C6FF3D] focus:outline-hidden min-h-[44px]"
                    required
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    🔒 Protected under university privacy guidelines: Contact details are never displayed on the public feed.
                  </p>
                </div>
              </div>

              {errorMsg && (
                <div className="flex items-center gap-2 text-xs text-rose-300 bg-rose-950/40 p-3 rounded-xl border border-rose-500/40">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-1/2 py-2.5 text-xs font-bold text-slate-400 hover:text-[#F4F6FF] bg-[#0B1020] rounded-full border border-[#1E294B] transition-colors min-h-[44px] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-1/2 py-2.5 text-xs font-extrabold text-[#0B1020] bg-[#C6FF3D] hover:bg-[#b8f52f] rounded-full shadow-[0_0_15px_rgba(198,255,61,0.2)] transition-all flex items-center justify-center gap-1.5 min-h-[44px] cursor-pointer"
                >
                  {isSubmitting ? 'Verifying...' : 'Submit Claim Request'}
                </button>
              </div>
            </form>
          ) : (
            <div className="text-center py-5 space-y-5">
              <div className="w-14 h-14 bg-[#C6FF3D]/10 border border-[#C6FF3D]/30 text-[#C6FF3D] rounded-2xl flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 className="w-8 h-8 text-[#C6FF3D]" />
              </div>
              <div className="space-y-1">
                <h4 className="font-extrabold text-[#F4F6FF] text-lg tracking-tight">Claim Successfully Logged</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Your verification answer has been forwarded to the custodian ({item.holdingLocation.replace(/_/g, ' ')}).
                </p>
              </div>

              <div className="bg-[#0B1020] border border-[#1E294B] rounded-xl p-4 text-xs text-slate-300 space-y-2 text-left">
                <div className="flex items-center gap-2 font-bold text-[#C6FF3D]">
                  <MessageCircle className="w-4 h-4 text-[#C6FF3D] shrink-0" />
                  <span>Next Step: Security & Custodian Handover</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Once your answer is reviewed by the finder or campus security, an approval notification will confirm handover at a designated campus post.
                </p>
              </div>

              <button
                onClick={onClose}
                className="w-full py-3 bg-[#1E294B] hover:bg-[#2A3B66] text-[#F4F6FF] rounded-full text-xs font-bold border border-[#2A3B66] min-h-[44px] cursor-pointer"
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
