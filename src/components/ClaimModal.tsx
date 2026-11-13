/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * NileFound Claim Modal
 * Layout: Accessible verification question prompt, claimant contact fields, and confirmation screen.
 * Main Action: Submit verification response to claim a found item.
 */

import React, { useState, useEffect, useRef } from 'react';
import { ShieldCheck, Lock, AlertCircle, MessageCircle, X, CheckCircle2 } from 'lucide-react';
import { CampusItem, ClaimRecord } from '../types/index.ts';
import { validateNileEmail } from '../utils/authValidation.ts';

interface ClaimModalProps {
  item: CampusItem | null;
  onClose: () => void;
  onSuccessClaim: (claim: ClaimRecord) => Promise<void> | void;
}

const INPUT_CLASS =
  'w-full text-base sm:text-sm px-3.5 py-2.5 rounded-[10px] border border-[#A39A8C] dark:border-[#5A5349] bg-white dark:bg-[#1E1C18] text-[#1F1B16] dark:text-[#F5F1EA] placeholder:text-[#5C554C] dark:placeholder:text-[#A8A095] focus:border-[#0F6E6E] min-h-[44px]';

export const ClaimModal: React.FC<ClaimModalProps> = ({ item, onClose, onSuccessClaim }) => {
  const [claimantName, setClaimantName] = useState('');
  const [claimantEmail, setClaimantEmail] = useState('');
  const [verificationAnswer, setVerificationAnswer] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!item) return;
    setIsSubmitted(false);
    setErrorMsg('');
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
  }, [item, onClose]);

  if (!item) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const sanitizedName = claimantName.trim().slice(0, 100);
    const sanitizedEmail = claimantEmail.trim().toLowerCase().slice(0, 100);
    const sanitizedAnswer = verificationAnswer.trim().slice(0, 500);

    if (!sanitizedName || !sanitizedEmail) {
      setErrorMsg('Please enter your full name and student email.');
      return;
    }
    if (!validateNileEmail(sanitizedEmail)) {
      setErrorMsg('Use your Nile University email address (@nileuniversity.edu.ng).');
      return;
    }
    if (item.verificationQuestion && !sanitizedAnswer) {
      setErrorMsg('Please answer the finder’s secret verification question.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    const displayTitle = item.type === 'found' && item.category === 'student_id'
      ? 'A student ID card was found'
      : item.title;

    const newClaim: ClaimRecord = {
      id: `claim-${Date.now()}`,
      itemId: item.id,
      itemTitle: displayTitle,
      claimantName: sanitizedName,
      claimantEmail: sanitizedEmail,
      submittedAnswer: sanitizedAnswer,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    try {
      await onSuccessClaim(newClaim);
      setIsSubmitted(true);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not save your claim to the database. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

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
        aria-labelledby="claim-modal-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[480px] bg-white dark:bg-[#1E1C18] text-[#1F1B16] dark:text-[#F5F1EA] rounded-[12px] shadow-xl max-h-[90dvh] overflow-hidden border border-[#C4BBAF] dark:border-[#3E3931] flex flex-col min-w-0 outline-none"
      >
        <div className="bg-[#FAF6EF] dark:bg-[#141311] px-6 py-4 border-b border-[#C4BBAF] dark:border-[#3E3931] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-[#0F6E6E] dark:text-[#199595]" />
            <h3 id="claim-modal-title" className="font-serif font-bold text-base tracking-tight text-[#1F1B16] dark:text-[#F5F1EA]">
              Claim Ownership Verification
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#5C554C] dark:text-[#A8A095] hover:text-[#1F1B16] dark:hover:text-[#F5F1EA] transition-colors p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-[10px] cursor-pointer"
            aria-label="Close claim dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 sm:p-6 max-w-md mx-auto min-h-0 flex-1 overflow-y-auto">
          {!isSubmitted ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="bg-[#FAF6EF] dark:bg-[#141311] border border-[#C4BBAF] dark:border-[#3E3931] rounded-[10px] p-3.5 text-sm text-[#4A443C] dark:text-[#CEC7BB]">
                <p className="font-medium text-[#0F6E6E] dark:text-[#199595]">Item being claimed:</p>
                <p className="font-serif font-bold text-base text-[#1F1B16] dark:text-[#F5F1EA] mt-1">
                  {item.type === 'found' && item.category === 'student_id' ? 'A student ID card was found' : item.title}
                </p>
                <p className="text-[#5C554C] dark:text-[#A8A095] text-sm mt-0.5">Found at: {item.location}</p>
              </div>

              {item.verificationQuestion && (
                <div className="bg-[#FAF6EF] dark:bg-[#141311] border border-[#C4BBAF] dark:border-[#3E3931] rounded-[10px] p-4 space-y-2.5">
                  <div className="flex items-center gap-2 text-[#0F6E6E] dark:text-[#199595] font-semibold text-sm">
                    <Lock className="w-4 h-4 shrink-0" />
                    <span>Finder's Verification Challenge</span>
                  </div>
                  <p className="text-sm text-[#1F1B16] dark:text-[#F5F1EA] font-medium leading-relaxed">
                    "{item.verificationQuestion}"
                  </p>
                  <div>
                    <label htmlFor="claim-verification-answer" className="block text-sm font-medium text-[#4A443C] dark:text-[#CEC7BB] mb-1">
                      Your Precise Answer (Only visible to the finder and campus security)
                    </label>
                    <input
                      id="claim-verification-answer"
                      type="text"
                      value={verificationAnswer}
                      onChange={(e) => setVerificationAnswer(e.target.value)}
                      placeholder="e.g. Pink sticker on back, serial ends with 402..."
                      className={INPUT_CLASS}
                      required
                    />
                  </div>
                  <p className="text-sm text-[#5C554C] dark:text-[#A8A095]">
                    Only the genuine owner knows this specific detail.
                  </p>
                </div>
              )}

              <div className="space-y-3 pt-1">
                <div>
                  <label htmlFor="claimant-full-name" className="block text-sm font-medium text-[#4A443C] dark:text-[#CEC7BB] mb-1.5">
                    Your Full Name
                  </label>
                  <input
                    id="claimant-full-name"
                    type="text"
                    value={claimantName}
                    onChange={(e) => setClaimantName(e.target.value)}
                    placeholder="e.g. Ibrahim Abubakar"
                    className={INPUT_CLASS}
                    required
                  />
                </div>

                <div>
                  <label htmlFor="claimant-email" className="block text-sm font-medium text-[#4A443C] dark:text-[#CEC7BB] mb-1.5">
                    Student Email (@nileuniversity.edu.ng)
                  </label>
                  <input
                    id="claimant-email"
                    type="email"
                    value={claimantEmail}
                    onChange={(e) => setClaimantEmail(e.target.value)}
                    placeholder="student.name@nileuniversity.edu.ng"
                    className={INPUT_CLASS}
                    required
                  />
                  <p className="text-sm text-[#5C554C] dark:text-[#A8A095] mt-1">
                    Contact details are never displayed on the public feed.
                  </p>
                </div>
              </div>

              {errorMsg && (
                <div role="alert" className="flex items-center gap-2 text-sm text-[#9B1C1C] dark:text-[#F87171] bg-[#FDF2F2] dark:bg-[#2B0E0E] p-3 rounded-[10px] border border-[#F87171]/50">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-1/2 py-2.5 text-sm font-medium text-[#4A443C] dark:text-[#CEC7BB] hover:text-[#1F1B16] dark:hover:text-[#F5F1EA] bg-white dark:bg-[#28241F] rounded-[10px] border border-[#A39A8C] dark:border-[#5A5349] transition-colors min-h-[44px] cursor-pointer btn-campus"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-1/2 py-2.5 text-sm font-semibold text-white bg-[#0F6E6E] hover:bg-[#0C5656] rounded-[10px] shadow-xs transition-colors flex items-center justify-center gap-1.5 min-h-[44px] cursor-pointer btn-campus active:scale-98"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Claim'}
                </button>
              </div>
            </form>
          ) : (
            <div className="text-center py-5 space-y-5">
              <div className="w-14 h-14 bg-[#EDF7F1] dark:bg-[#0E2417] border border-[#2F7D4F]/30 text-[#2F7D4F] dark:text-[#75CE9A] rounded-[10px] flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h4 className="font-serif font-bold text-[#1F1B16] dark:text-[#F5F1EA] text-lg tracking-tight">
                  Claim Logged
                </h4>
                <p className="text-sm text-[#4A443C] dark:text-[#CEC7BB] leading-relaxed">
                  Your verification answer was sent to the finder and campus security ({item.holdingLocation.replace(/_/g, ' ')}).
                </p>
              </div>

              <div className="bg-[#FAF6EF] dark:bg-[#141311] border border-[#C4BBAF] dark:border-[#3E3931] rounded-[10px] p-4 text-sm text-[#4A443C] dark:text-[#CEC7BB] space-y-2 text-left">
                <div className="flex items-center gap-2 font-medium text-[#0F6E6E] dark:text-[#199595]">
                  <MessageCircle className="w-4 h-4 shrink-0" />
                  <span>Next Step: Handover Verification</span>
                </div>
                <p className="text-sm text-[#5C554C] dark:text-[#A8A095] leading-relaxed">
                  Once your answer is approved by the finder or campus security, you will receive an alert and unlock handover contact details.
                </p>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 bg-[#0F6E6E] hover:bg-[#0C5656] text-white rounded-[10px] text-sm font-semibold min-h-[44px] cursor-pointer btn-campus shadow-xs"
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
