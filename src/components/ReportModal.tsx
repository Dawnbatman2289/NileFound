/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * NileFound Item Reporting Modal
 * Layout: Single-scroll report dialog with safe non-secret offline draft persistence and image compression.
 * Main Action: Report a lost or found item on the Nile University campus.
 */

import React, { useState, useEffect, useRef } from 'react';
import { X, Upload, Save, AlertTriangle, Lock, CheckCircle, ShieldAlert } from 'lucide-react';
import { CampusItem, ItemType, ItemCategory, HoldingLocation, User } from '../types/index.ts';
import { CATEGORIES } from '../config/catalog.ts';
import { NILE_CAMPUS_LOCATIONS } from '../config/locations.ts';
import { detectPii } from '../utils/piiDetector.ts';
import { compressImageFile, CompressionResult, isSupportedImageFile } from '../utils/imageCompressor.ts';
import { getTodayWatIsoDate } from '../utils/dateFormatter.ts';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitItem: (item: CampusItem) => Promise<boolean> | void;
  onDraftSaved: () => void;
  currentUser?: User | null;
  onLogin?: (user: User) => void;
  onOpenLogin?: () => void;
  initialPrefill?: Partial<Pick<CampusItem, 'type' | 'title' | 'category' | 'location'>> | null;
}

const DRAFT_STORAGE_KEY = 'nilefound_report_draft_v1';
const FIELD_INPUT =
  'w-full text-base sm:text-sm px-3.5 py-2.5 rounded-[10px] border border-[#A39A8C] dark:border-[#5A5349] bg-white dark:bg-[#141311] text-[#1F1B16] dark:text-[#F5F1EA] placeholder:text-[#5C554C] dark:placeholder:text-[#A8A095] focus:border-[#0F6E6E] min-h-[44px]';

export const ReportModal: React.FC<ReportModalProps> = ({
  isOpen,
  onClose,
  onSubmitItem,
  onDraftSaved,
  currentUser,
  onOpenLogin,
  initialPrefill,
}) => {
  const todayWat = getTodayWatIsoDate();
  const [reportType, setReportType] = useState<ItemType>('lost');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<ItemCategory | ''>('');
  const [location, setLocation] = useState<string>('');
  const [locationDetails, setLocationDetails] = useState('');
  const [description, setDescription] = useState('');
  const [dateLostOrFound, setDateLostOrFound] = useState(() => getTodayWatIsoDate());
  const [holdingLocation, setHoldingLocation] = useState<HoldingLocation>('finder_holding');
  const [verificationQuestion, setVerificationQuestion] = useState('');
  const [verificationAnswer, setVerificationAnswer] = useState('');
  const [formError, setFormError] = useState<{ heading: string; detail: string } | null>(null);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  const [compressionResult, setCompressionResult] = useState<CompressionResult | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [hasRestoredDraft, setHasRestoredDraft] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);

  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const isFoundStudentId = reportType === 'found' && category === 'student_id';

  useEffect(() => {
    if (isFoundStudentId) {
      setHoldingLocation('security_main_gate');
      setCompressionResult(null);
    }
  }, [isFoundStudentId]);

  // Accessible modal keyboard Escape + focus restoration
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

  useEffect(() => {
    if (!isOpen) return;
    setFormError(null);
    setSaveNotice(null);
    if (initialPrefill) {
      setReportType(initialPrefill.type || 'found');
      setCategory(initialPrefill.category || '');
      setLocation(initialPrefill.location || '');
      setTitle(initialPrefill.title || '');
      setHasRestoredDraft(false);
      return;
    }
    try {
      const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.title || parsed.description) {
          setReportType(parsed.reportType || 'lost');
          setTitle(parsed.title || '');
          setCategory(parsed.category || '');
          setLocation(parsed.location || '');
          setLocationDetails(parsed.locationDetails || '');
          setDescription(parsed.description || '');
          setDateLostOrFound(parsed.dateLostOrFound || getTodayWatIsoDate());
          setHoldingLocation(parsed.holdingLocation || 'finder_holding');
          setVerificationQuestion(parsed.verificationQuestion || '');
          // Security rule: never persist or restore secret verification answers from localStorage.
          setVerificationAnswer('');
          setHasRestoredDraft(true);
        }
      }
    } catch {
      // Ignore corrupt draft storage
    }
  }, [isOpen, initialPrefill]);

  const saveDraftLocally = () => {
    const draftData = {
      reportType,
      title,
      category,
      location,
      locationDetails,
      description,
      dateLostOrFound,
      holdingLocation,
      verificationQuestion,
    };
    try {
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draftData));
      onDraftSaved();
    } catch {
      // Ignore storage quota or restricted storage
    }
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || isFoundStudentId) return;

    if (!isSupportedImageFile(file)) {
      setFormError({ heading: 'Unsupported image file', detail: 'Choose a JPEG, PNG, or WebP image no larger than 5MB.' });
      return;
    }

    try {
      setIsCompressing(true);
      setFormError(null);
      const result = await compressImageFile(file, 800, 0.72);
      setCompressionResult(result);
    } catch (err: unknown) {
      setFormError({
        heading: 'Photo too large',
        detail: err instanceof Error ? err.message : 'Photo too large. Try a smaller JPEG, PNG, or WebP file.',
      });
    } finally {
      setIsCompressing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!category) {
      setFormError({ heading: 'Missing item category', detail: 'Select an item category before continuing.' });
      return;
    }
    if (!location) {
      setFormError({ heading: 'Missing campus location', detail: 'Select where the item was lost or found.' });
      return;
    }

    const titlePii = detectPii(title);
    if (titlePii.hasPii) {
      setFormError({ heading: 'Personal details detected', detail: titlePii.errorMessage || 'Remove personal details before submitting.' });
      return;
    }

    if (locationDetails.trim()) {
      const locPii = detectPii(locationDetails);
      if (locPii.hasPii) {
        setFormError({ heading: 'Personal details detected', detail: locPii.errorMessage || 'Remove personal details from Specific Spot.' });
        return;
      }
    }

    const descPii = detectPii(description);
    if (descPii.hasPii) {
      setFormError({ heading: 'Personal details detected', detail: descPii.errorMessage || 'Remove personal details before submitting.' });
      return;
    }

    if (verificationQuestion.trim()) {
      const qPii = detectPii(verificationQuestion);
      if (qPii.hasPii) {
        setFormError({ heading: 'Personal details detected', detail: qPii.errorMessage || 'Remove personal details before submitting.' });
        return;
      }
    }

    const effectiveHoldingLocation: HoldingLocation = isFoundStudentId
      ? 'security_main_gate'
      : reportType === 'found'
      ? holdingLocation
      : 'finder_holding';

    const newItem: CampusItem = {
      id: `item-${Date.now()}`,
      type: reportType,
      title: title.trim(),
      category,
      description: description.trim(),
      location,
      locationDetails: locationDetails.trim() || undefined,
      dateLostOrFound,
      status: 'open',
      holdingLocation: effectiveHoldingLocation,
      imageUrl: isFoundStudentId ? undefined : (compressionResult ? compressionResult.dataUrl : undefined),
      isSensitiveId: category === 'student_id',
      verificationQuestion: reportType === 'found' && verificationQuestion.trim() ? verificationQuestion.trim() : undefined,
      verificationAnswer: reportType === 'found' && verificationAnswer.trim() ? verificationAnswer.trim() : undefined,
      reportedByEmailDomain: 'nileuniversity.edu.ng',
      createdAt: new Date().toISOString(),
    };

    if (!currentUser) {
      saveDraftLocally();
      onOpenLogin?.();
      return;
    }

    setIsSubmitting(true);
    try {
      const saved = await onSubmitItem(newItem);
      if (saved === false) {
        setFormError({ heading: 'Could not publish notice', detail: 'Could not save report to campus database. Your draft is preserved.' });
        return;
      }
      try {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
      } catch {
        // Ignore
      }
      onClose();
    } catch (err: unknown) {
      setFormError({
        heading: 'Could not publish notice',
        detail: err instanceof Error ? err.message : 'Could not save report to campus database. Your draft is saved.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

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
        aria-labelledby="report-modal-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[480px] bg-white dark:bg-[#1E1C18] text-[#1F1B16] dark:text-[#F5F1EA] rounded-[12px] shadow-xl max-h-[90dvh] overflow-hidden border border-[#C4BBAF] dark:border-[#3E3931] flex flex-col min-w-0 outline-none"
      >
        <div className="bg-[#FAF6EF] dark:bg-[#141311] px-5 sm:px-6 py-4 border-b border-[#C4BBAF] dark:border-[#3E3931] flex items-center justify-between">
          <h3 id="report-modal-title" className="font-serif font-bold text-base tracking-tight text-[#1F1B16] dark:text-[#F5F1EA]">
            Report an Item on Campus
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-[#5C554C] dark:text-[#A8A095] hover:text-[#1F1B16] dark:hover:text-[#F5F1EA] transition-colors p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-[10px] cursor-pointer"
            aria-label="Close report dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 min-h-0 flex-1 overflow-y-auto">
          {currentUser ? (
            <div className="bg-[#FAF6EF] dark:bg-[#141311] border border-[#C4BBAF] dark:border-[#3E3931] px-3.5 py-2.5 rounded-[10px] text-sm flex items-center justify-between">
              <span className="text-[#4A443C] dark:text-[#CEC7BB]">Reporting as:</span>
              <span className="font-medium text-[#0F6E6E] dark:text-[#199595] flex items-center gap-1.5 truncate">
                <CheckCircle className="w-4 h-4 shrink-0" />
                <span className="truncate">{currentUser.name}</span>
              </span>
            </div>
          ) : (
            <div className="bg-[#FAF6EF] dark:bg-[#141311] border border-[#C4BBAF] dark:border-[#3E3931] p-3.5 rounded-[10px] text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-[#0F6E6E] dark:text-[#199595] shrink-0" />
                <span className="text-[#4A443C] dark:text-[#CEC7BB]">
                  Sign in required to publish notices and get updates.
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsSigningIn(true);
                  try {
                    onOpenLogin?.();
                  } finally {
                    setIsSigningIn(false);
                  }
                }}
                disabled={isSigningIn}
                className="bg-[#0F6E6E] hover:bg-[#0C5656] disabled:opacity-50 text-white px-3.5 py-2 rounded-[10px] font-medium text-sm min-h-[44px] shrink-0 cursor-pointer shadow-xs transition-colors text-center btn-campus"
              >
                Open sign-in
              </button>
            </div>
          )}

          {hasRestoredDraft && (
            <div className="flex items-center justify-between text-sm bg-[#FEF7E9] dark:bg-[#2B210A] text-[#7A5000] dark:text-[#F9CF7C] border border-[#E8A317]/40 p-3 rounded-[10px]">
              <span className="flex items-center gap-2">
                <Save className="w-4 h-4 shrink-0" />
                Restored unfinished draft
              </span>
              <button
                type="button"
                onClick={() => {
                  try { localStorage.removeItem(DRAFT_STORAGE_KEY); } catch {}
                  setHasRestoredDraft(false);
                  setTitle('');
                  setDescription('');
                  setVerificationQuestion('');
                  setVerificationAnswer('');
                }}
                className="font-bold underline hover:opacity-80 cursor-pointer shrink-0 ml-2"
              >
                Clear
              </button>
            </div>
          )}

          {saveNotice && (
            <div role="status" className="text-sm bg-[#E7F3F3] dark:bg-[#0D2D2D] text-[#0F6E6E] dark:text-[#199595] border border-[#0F6E6E]/30 p-3 rounded-[10px] flex items-center gap-2">
              <CheckCircle className="w-4 h-4 shrink-0" />
              <span>{saveNotice}</span>
            </div>
          )}

          {formError && (
            <div role="alert" className="bg-[#FDF2F2] dark:bg-[#2B0E0E] border border-[#F87171]/50 text-[#9B1C1C] dark:text-[#F87171] text-sm p-3.5 rounded-[10px] flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">{formError.heading}</p>
                <p className="mt-0.5">{formError.detail}</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 bg-[#FAF6EF] dark:bg-[#141311] p-1.5 rounded-[10px] border border-[#C4BBAF] dark:border-[#3E3931]">
            <button
              type="button"
              onClick={() => {
                setReportType('lost');
                saveDraftLocally();
              }}
              className={`py-2 text-sm font-semibold rounded-[10px] transition-colors min-h-[44px] cursor-pointer btn-campus ${
                reportType === 'lost'
                  ? 'bg-[#E8A317] text-[#1F1B16] shadow-xs'
                  : 'text-[#4A443C] dark:text-[#CEC7BB] hover:text-[#1F1B16] dark:hover:text-[#F5F1EA]'
              }`}
            >
              I Lost Something
            </button>
            <button
              type="button"
              onClick={() => {
                setReportType('found');
                saveDraftLocally();
              }}
              className={`py-2 text-sm font-semibold rounded-[10px] transition-colors min-h-[44px] cursor-pointer btn-campus ${
                reportType === 'found'
                  ? 'bg-[#2F7D4F] text-white shadow-xs'
                  : 'text-[#4A443C] dark:text-[#CEC7BB] hover:text-[#1F1B16] dark:hover:text-[#F5F1EA]'
              }`}
            >
              I Found Something
            </button>
          </div>

          <div>
            <label htmlFor="report-category" className="block text-sm font-medium text-[#4A443C] dark:text-[#CEC7BB] mb-1.5">
              Item Category <span className="text-[#0F6E6E]">*</span>
            </label>
            <select
              id="report-category"
              required
              value={category}
              onChange={(e) => {
                setCategory(e.target.value as ItemCategory);
                saveDraftLocally();
              }}
              className={`${FIELD_INPUT} cursor-pointer`}
            >
              <option value="" disabled>Select an item category...</option>
              {CATEGORIES.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          {isFoundStudentId && (
            <div className="bg-[#FEF7E9] dark:bg-[#2B210A] border border-[#E8A317]/40 p-3.5 rounded-[10px] space-y-1">
              <div className="flex items-center gap-2 text-[#7A5000] dark:text-[#F9CF7C] font-semibold text-sm">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Found Student ID Card Protocol</span>
              </div>
              <p className="text-sm text-[#7A5000] dark:text-[#F9CF7C] leading-relaxed">
                Do not type the student's name or matric number into any field. Hand the physical card to the Main Gate Security Post immediately.
              </p>
            </div>
          )}

          <div>
            <label htmlFor="report-title" className="block text-sm font-medium text-[#4A443C] dark:text-[#CEC7BB] mb-1.5">
              Item Title <span className="text-[#0F6E6E]">*</span>
            </label>
            <input
              id="report-title"
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setFormError(null);
                saveDraftLocally();
              }}
              placeholder={
                isFoundStudentId
                  ? 'A student ID card was found'
                  : reportType === 'lost'
                  ? 'e.g. Casio fx-991EX Calculator with red sticker'
                  : 'e.g. Black Anker 20,000mAh Power Bank'
              }
              className={FIELD_INPUT}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="report-location" className="block text-sm font-medium text-[#4A443C] dark:text-[#CEC7BB] mb-1.5">
                Campus Location <span className="text-[#0F6E6E]">*</span>
              </label>
              <select
                id="report-location"
                required
                value={location}
                onChange={(e) => {
                  setLocation(e.target.value);
                  saveDraftLocally();
                }}
                className={`${FIELD_INPUT} cursor-pointer`}
              >
                <option value="" disabled>Select campus location...</option>
                {NILE_CAMPUS_LOCATIONS.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="report-date" className="block text-sm font-medium text-[#4A443C] dark:text-[#CEC7BB] mb-1.5">
                Date {reportType === 'lost' ? 'Lost' : 'Found'}
              </label>
              <input
                id="report-date"
                type="date"
                max={todayWat}
                value={dateLostOrFound}
                onChange={(e) => {
                  setDateLostOrFound(e.target.value);
                  saveDraftLocally();
                }}
                className={FIELD_INPUT}
                required
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="report-location-details" className="block text-sm font-medium text-[#4A443C] dark:text-[#CEC7BB] mb-1.5">
                Specific Spot <span className="text-sm font-normal text-[#5C554C] dark:text-[#A8A095]">(optional)</span>
              </label>
              <input
                id="report-location-details"
                type="text"
                value={locationDetails}
                onChange={(e) => {
                  setLocationDetails(e.target.value.slice(0, 160));
                  saveDraftLocally();
                }}
                placeholder="e.g. Room 205, Ground Floor Corridor"
                maxLength={160}
                className={FIELD_INPUT}
              />
            </div>
          </div>

          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
              <label htmlFor="report-description" className="block text-sm font-medium text-[#4A443C] dark:text-[#CEC7BB]">
                Detailed Description <span className="text-[#0F6E6E]">*</span>
              </label>
              <span className="text-sm text-[#5C554C] dark:text-[#A8A095]">No phone or matric numbers</span>
            </div>
            <textarea
              id="report-description"
              rows={3}
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                setFormError(null);
                saveDraftLocally();
              }}
              placeholder={
                reportType === 'lost'
                  ? 'Describe physical condition, stickers, case color, where you last had it...'
                  : isFoundStudentId
                  ? 'Describe where on campus it was found. Do not type names or matric numbers.'
                  : 'Describe general color, model, and location found without revealing private marks.'
              }
              className="w-full text-base sm:text-sm px-3.5 py-2.5 rounded-[10px] border border-[#A39A8C] dark:border-[#5A5349] bg-white dark:bg-[#141311] text-[#1F1B16] dark:text-[#F5F1EA] placeholder:text-[#5C554C] dark:placeholder:text-[#A8A095] focus:border-[#0F6E6E]"
              required
            />
          </div>

          {reportType === 'found' && (
            <div className="space-y-3.5 bg-[#FAF6EF] dark:bg-[#141311] border border-[#C4BBAF] dark:border-[#3E3931] rounded-[10px] p-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-[#0F6E6E] dark:text-[#199595] font-semibold text-sm">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span>Ask the owner one thing only they would know</span>
                </div>
                <p className="text-sm text-[#4A443C] dark:text-[#CEC7BB] leading-relaxed">
                  Pick a private detail not visible in any photo. Claimants must answer this before handover details are released.
                </p>

                <div className="space-y-1.5 pt-1">
                  <span className="text-sm font-medium text-[#5C554C] dark:text-[#A8A095] block">
                    Quick suggestions:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { label: 'Phone wallpaper', text: 'What image is set as the lock screen wallpaper?' },
                      { label: 'Cover mark', text: 'What scratch or sticker is on the back or inside cover?' },
                      { label: 'Inside pocket', text: 'What small specific item is inside the front compartment?' },
                      { label: 'Keychain text', text: 'What text or initials are on the key ring?' },
                    ].map((sug) => (
                      <button
                        key={sug.label}
                        type="button"
                        onClick={() => {
                          setVerificationQuestion(sug.text);
                          saveDraftLocally();
                        }}
                        className="text-sm bg-white dark:bg-[#1E1C18] text-[#4A443C] dark:text-[#CEC7BB] border border-[#A39A8C] dark:border-[#5A5349] hover:border-[#0F6E6E] hover:text-[#0F6E6E] px-3 py-1.5 min-h-[44px] rounded-[10px] font-medium transition-colors cursor-pointer btn-campus"
                      >
                        + {sug.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-2 space-y-3">
                  <div>
                    <label htmlFor="report-question" className="block text-sm font-medium text-[#4A443C] dark:text-[#CEC7BB] mb-1">
                      Verification Question (Shown to claimants)
                    </label>
                    <input
                      id="report-question"
                      type="text"
                      value={verificationQuestion}
                      onChange={(e) => {
                        setVerificationQuestion(e.target.value);
                        saveDraftLocally();
                      }}
                      placeholder="e.g. What image is on the lock screen?"
                      className={FIELD_INPUT}
                    />
                  </div>

                  <div>
                    <label htmlFor="report-answer" className="block text-sm font-medium text-[#4A443C] dark:text-[#CEC7BB] mb-1">
                      Correct Answer (Private — only you and security/admin see this)
                    </label>
                    <input
                      id="report-answer"
                      type="text"
                      value={verificationAnswer}
                      onChange={(e) => setVerificationAnswer(e.target.value)}
                      placeholder="e.g. A photo of a black car with Abuja plate"
                      className={FIELD_INPUT}
                    />
                    <span className="text-sm text-[#5C554C] dark:text-[#A8A095] mt-1 block">
                      Stored in a private Firestore subcollection and never written to browser draft storage.
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-[#C4BBAF] dark:border-[#3E3931]">
                <label htmlFor="report-holding" className="block text-sm font-medium text-[#4A443C] dark:text-[#CEC7BB] mb-1.5">
                  Item Physical Custody
                </label>
                {isFoundStudentId ? (
                  <div className="bg-white dark:bg-[#1E1C18] border border-[#C4BBAF] dark:border-[#3E3931] text-[#0F6E6E] dark:text-[#199595] rounded-[10px] p-3 text-sm font-medium">
                    Dropped at Main Gate Security Post (Mandatory for student IDs)
                  </div>
                ) : (
                  <select
                    id="report-holding"
                    value={holdingLocation}
                    onChange={(e) => {
                      setHoldingLocation(e.target.value as HoldingLocation);
                      saveDraftLocally();
                    }}
                    className={`${FIELD_INPUT} cursor-pointer`}
                  >
                    <option value="finder_holding">I am keeping it safe myself</option>
                    <option value="security_main_gate">Dropped at Main Campus Gate Security Post</option>
                    <option value="library_desk">Handed to Central Library Front Desk</option>
                    <option value="student_affairs_office">Deposited at Student Affairs Office</option>
                    <option value="faculty_officer">Given to Faculty Officer</option>
                  </select>
                )}
              </div>
            </div>
          )}

          {isFoundStudentId ? (
            <div className="border border-[#C4BBAF] dark:border-[#3E3931] bg-[#FAF6EF] dark:bg-[#141311] rounded-[10px] p-4 text-center text-sm text-[#4A443C] dark:text-[#CEC7BB]">
              <Lock className="w-5 h-5 text-[#5C554C] dark:text-[#A8A095] mx-auto mb-1.5" />
              <p className="font-medium text-[#1F1B16] dark:text-[#F5F1EA]">
                Photos of student ID cards are prohibited.
              </p>
              <p className="text-sm text-[#5C554C] dark:text-[#A8A095] mt-0.5">
                Hand the physical ID card to the Main Gate Security Post.
              </p>
            </div>
          ) : (
            <div className="border border-dashed border-[#A39A8C] dark:border-[#5A5349] hover:border-[#0F6E6E] rounded-[10px] p-4 text-center bg-[#FAF6EF]/40 dark:bg-[#141311]/40 transition-colors">
              <label htmlFor="report-photo-upload" className="cursor-pointer block">
                <input
                  id="report-photo-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="sr-only"
                />
                <div className="flex flex-col items-center gap-1.5">
                  <Upload className="w-6 h-6 text-[#0F6E6E] dark:text-[#199595]" />
                  <span className="text-sm font-medium text-[#1F1B16] dark:text-[#F5F1EA]">
                    {compressionResult ? 'Change Photo' : 'Attach Photo (Optional)'}
                  </span>
                  <span className="text-sm text-[#5C554C] dark:text-[#A8A095]">
                    Compressed on your device under 90KB to save mobile data
                  </span>
                </div>
              </label>

              {isCompressing && (
                <p className="text-sm text-[#0F6E6E] dark:text-[#199595] font-medium mt-2">
                  Compressing photo in device memory...
                </p>
              )}

              {compressionResult && (
                <div className="mt-3 flex items-center justify-between bg-white dark:bg-[#1E1C18] border border-[#C4BBAF] dark:border-[#3E3931] rounded-[10px] p-3 text-sm text-[#1F1B16] dark:text-[#F5F1EA] text-left">
                  <div className="flex items-center gap-3">
                    <img
                      src={compressionResult.dataUrl}
                      alt="Uploaded item preview"
                      className="w-12 h-12 object-cover rounded-[10px] border border-[#C4BBAF] dark:border-[#3E3931]"
                      loading="lazy"
                      decoding="async"
                      width={48}
                      height={48}
                    />
                    <div>
                      <span className="font-semibold block text-sm">
                        Compressed: {compressionResult.compressedSizeKb} KB
                      </span>
                      <span className="text-sm text-[#5C554C] dark:text-[#A8A095]">
                        Reduced from {compressionResult.originalSizeKb} KB (-{compressionResult.reductionPercentage}%)
                      </span>
                    </div>
                  </div>
                  <CheckCircle className="w-5 h-5 text-[#2F7D4F] shrink-0" />
                </div>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-[#C4BBAF] dark:border-[#3E3931]">
            <button
              type="button"
              onClick={() => {
                saveDraftLocally();
                setSaveNotice('Draft saved locally (without private verification answer).');
                setTimeout(() => setSaveNotice(null), 3000);
              }}
              className="text-sm font-medium text-[#5C554C] dark:text-[#A8A095] hover:text-[#0F6E6E] dark:hover:text-[#199595] flex items-center gap-1.5 cursor-pointer min-h-[44px] py-2"
            >
              <Save className="w-4 h-4" />
              <span>Save Offline Draft</span>
            </button>

            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-[#4A443C] dark:text-[#CEC7BB] hover:text-[#1F1B16] dark:hover:text-[#F5F1EA] bg-white dark:bg-[#28241F] rounded-[10px] border border-[#A39A8C] dark:border-[#5A5349] transition-colors min-h-[44px] cursor-pointer btn-campus"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || isCompressing || isSigningIn}
                className={`px-5 py-2 text-sm font-semibold rounded-[10px] transition-colors min-h-[44px] cursor-pointer shadow-xs disabled:opacity-50 btn-campus ${
                  reportType === 'lost'
                    ? 'bg-[#E8A317] hover:bg-[#d69310] text-[#1F1B16]'
                    : 'bg-[#0F6E6E] hover:bg-[#0C5656] text-white'
                }`}
              >
                {isSigningIn
                  ? 'Signing in...'
                  : isSubmitting
                  ? 'Publishing...'
                  : !currentUser
                  ? `Sign in & Post ${reportType === 'lost' ? 'Lost' : 'Found'}`
                  : `Post ${reportType === 'lost' ? 'Lost Notice' : 'Found Notice'}`}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
