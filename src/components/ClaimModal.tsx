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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div className="bg-white dark:bg-[#1E1C18] text-[#1F1B16] dark:text-[#F5F1EA] rounded-[12px] shadow-xl max-w-lg w-full overflow-hidden border border-[#E6DFD2] dark:border-[#2E2A24] my-6">
        {/* Header */}
        <div className="bg-[#FAF6EF] dark:bg-[#141311] px-6 py-4 border-b border-[#E6DFD2] dark:border-[#2E2A24] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-[#0F6E6E] dark:text-[#199595]" />
            <h3 className="font-serif font-bold text-base tracking-tight text-[#1F1B16] dark:text-[#F5F1EA]">Claim Ownership Verification</h3>
          </div>
          <button
            onClick={onClose}
            className="text-[#7A7266] hover:text-[#1F1B16] dark:hover:text-[#F5F1EA] transition-colors p-1 rounded-[6px] cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-w-md mx-auto">
          {!isVerifiedDemo ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="bg-[#FAF6EF] dark:bg-[#141311] border border-[#E6DFD2] dark:border-[#2E2A24] rounded-[10px] p-3.5 text-xs text-[#544E45] dark:text-[#B8B0A2]">
                <p className="font-medium text-[#0F6E6E] dark:text-[#199595]">Item being claimed:</p>
                <p className="font-serif font-bold text-sm text-[#1F1B16] dark:text-[#F5F1EA] mt-1">{item.title}</p>
                <p className="text-[#7A7266] dark:text-[#857D71] text-xs mt-0.5">Found at: {item.location}</p>
              </div>

              {/* The Secret Verification Question */}
              {item.verificationQuestion && (
                <div className="bg-[#FAF6EF] dark:bg-[#141311] border border-[#E6DFD2] dark:border-[#2E2A24] rounded-[10px] p-4 space-y-2.5">
                  <div className="flex items-center gap-2 text-[#0F6E6E] dark:text-[#199595] font-semibold text-xs">
                    <Lock className="w-3.5 h-3.5 shrink-0" />
                    <span>Finder's Verification Challenge</span>
                  </div>
                  <p className="text-xs text-[#1F1B16] dark:text-[#F5F1EA] font-medium leading-relaxed">
                    "{item.verificationQuestion}"
                  </p>
                  <div>
                    <label className="block text-[11px] font-medium text-[#544E45] dark:text-[#B8B0A2] mb-1">
                      Your Precise Answer (Only visible to the finder and campus security):
                    </label>
                    <input
                      type="text"
                      value={verificationAnswer}
                      onChange={(e) => setVerificationAnswer(e.target.value)}
                      placeholder="e.g. Pink sticker on back, serial ends with 402..."
                      className="w-full text-xs px-3.5 py-2.5 rounded-[10px] border border-[#E6DFD2] dark:border-[#2E2A24] bg-white dark:bg-[#1E1C18] text-[#1F1B16] dark:text-[#F5F1EA] focus:border-[#0F6E6E] focus:outline-hidden min-h-[44px]"
                      required
                    />
                  </div>
                  <p className="text-[10px] text-[#7A7266] dark:text-[#857D71]">
                    Anti-theft protection: Only the genuine owner knows this specific detail.
                  </p>
                </div>
              )}

              {/* Claimant Contact Details */}
              <div className="space-y-3 pt-1">
                <div>
                  <label className="block text-xs font-medium text-[#544E45] dark:text-[#B8B0A2] mb-1.5">
                    Your Full Name:
                  </label>
                  <input
                    type="text"
                    value={claimantName}
                    onChange={(e) => setClaimantName(e.target.value)}
                    placeholder="e.g. Ibrahim Abubakar"
                    className="w-full text-xs px-3.5 py-2.5 rounded-[10px] border border-[#E6DFD2] dark:border-[#2E2A24] bg-white dark:bg-[#1E1C18] text-[#1F1B16] dark:text-[#F5F1EA] focus:border-[#0F6E6E] focus:outline-hidden min-h-[44px]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#544E45] dark:text-[#B8B0A2] mb-1.5">
                    Student Email (@nileuniversity.edu.ng):
                  </label>
                  <input
                    type="email"
                    value={claimantEmail}
                    onChange={(e) => setClaimantEmail(e.target.value)}
                    placeholder="student.name@nileuniversity.edu.ng"
                    className="w-full text-xs px-3.5 py-2.5 rounded-[10px] border border-[#E6DFD2] dark:border-[#2E2A24] bg-white dark:bg-[#1E1C18] text-[#1F1B16] dark:text-[#F5F1EA] focus:border-[#0F6E6E] focus:outline-hidden min-h-[44px]"
                    required
                  />
                  <p className="text-[10px] text-[#7A7266] dark:text-[#857D71] mt-1">
                    Protected under university privacy guidelines: Contact details are never displayed on the public feed.
                  </p>
                </div>
              </div>

              {errorMsg && (
                <div className="flex items-center gap-2 text-xs text-[#9B1C1C] dark:text-[#F87171] bg-[#FDF2F2] dark:bg-[#2B0E0E] p-3 rounded-[10px] border border-[#F87171]/40">
                  <AlertCircle className="w-4 h-4 shrink-0 text-[#9B1C1C]" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-1/2 py-2.5 text-xs font-medium text-[#544E45] dark:text-[#B8B0A2] hover:text-[#1F1B16] dark:hover:text-[#F5F1EA] bg-white dark:bg-[#28241F] rounded-[10px] border border-[#E6DFD2] dark:border-[#2E2A24] transition-colors min-h-[44px] cursor-pointer btn-campus"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-1/2 py-2.5 text-xs font-semibold text-white bg-[#0F6E6E] hover:bg-[#0C5656] rounded-[10px] shadow-xs transition-colors flex items-center justify-center gap-1.5 min-h-[44px] cursor-pointer btn-campus active:scale-98"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Claim Request'}
                </button>
              </div>
            </form>
          ) : (
            <div className="text-center py-5 space-y-5">
              <div className="w-14 h-14 bg-[#EDF7F1] dark:bg-[#0E2417] border border-[#2F7D4F]/30 text-[#2F7D4F] dark:text-[#75CE9A] rounded-[10px] flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h4 className="font-serif font-bold text-[#1F1B16] dark:text-[#F5F1EA] text-lg tracking-tight">Claim Successfully Logged</h4>
                <p className="text-xs text-[#544E45] dark:text-[#B8B0A2] leading-relaxed">
                  Your verification answer has been forwarded to the custodian ({item.holdingLocation.replace(/_/g, ' ')}).
                </p>
              </div>

              <div className="bg-[#FAF6EF] dark:bg-[#141311] border border-[#E6DFD2] dark:border-[#2E2A24] rounded-[10px] p-4 text-xs text-[#544E45] dark:text-[#B8B0A2] space-y-2 text-left">
                <div className="flex items-center gap-2 font-medium text-[#0F6E6E] dark:text-[#199595]">
                  <MessageCircle className="w-4 h-4 shrink-0" />
                  <span>Next Step: Security & Custodian Handover</span>
                </div>
                <p className="text-[11px] text-[#7A7266] dark:text-[#857D71] leading-relaxed">
                  Once your answer is reviewed by the finder or campus security, an approval notification will confirm handover at a designated campus post.
                </p>
              </div>

              <button
                onClick={onClose}
                className="w-full py-2.5 bg-[#0F6E6E] hover:bg-[#0C5656] text-white rounded-[10px] text-xs font-semibold min-h-[44px] cursor-pointer btn-campus shadow-xs"
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
