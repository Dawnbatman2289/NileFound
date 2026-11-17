/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * NileFound Item Reporting Modal
 * Layout: Single-scroll report dialog with safe non-secret offline draft persistence and image compression.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Save, AlertTriangle, Lock, CheckCircle } from 'lucide-react';
import { CampusItem, HoldingLocation, ItemCategory, ReportPrefill, User } from '../types/index.ts';
import { CATEGORIES } from '../config/catalog.ts';
import {
  isListedLocation,
  MAX_CUSTOM_LOCATION_LENGTH,
  NILE_LOCATION_GROUPS,
  normalizeCustomLocation,
  OTHER_LOCATION_LABEL,
  OTHER_LOCATION_VALUE,
} from '../config/locations.ts';
import { getTodayWatIsoDate } from '../utils/dateFormatter.ts';
import { getRoleDisplayLabel } from '../utils/admin.ts';
import { OFFICER_INTAKE_PRESETS, resolveDefaultHoldingLocation } from '../utils/reportPresets.ts';
import { shouldCloseBackdropClick, trapFocusOnTab } from '../utils/modalFocus.ts';
import { useReportDraft, validateReportInputs } from '../hooks/useReportDraft.ts';
import { FoundVerificationSection } from './report/FoundVerificationSection.tsx';
import { PhotoUploadSection } from './report/PhotoUploadSection.tsx';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitItem: (item: CampusItem) => Promise<boolean> | void;
  onDraftSaved: () => void;
  onDraftCleared?: () => void;
  currentUser?: User | null;
  onOpenLogin?: () => void;
  initialPrefill?: ReportPrefill | null;
}

const FIELD_INPUT =
  'w-full text-base sm:text-sm px-3.5 py-2.5 rounded-[10px] border border-[#857C70] dark:border-[#787065] bg-white dark:bg-[#141311] text-[#1F1B16] dark:text-[#F5F1EA] placeholder:text-[#5C554C] dark:placeholder:text-[#A8A095] focus:border-[#0F6E6E] min-h-[44px]';

const PICKER_RETURN_GUARD_MS = 700;

export const ReportModal: React.FC<ReportModalProps> = ({
  isOpen,
  onClose,
  onSubmitItem,
  onDraftSaved,
  onDraftCleared,
  currentUser,
  onOpenLogin,
  initialPrefill,
}) => {
  const todayWat = getTodayWatIsoDate();
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const customLocationRef = useRef<HTMLInputElement>(null);
  const saveTimerRef = useRef<number | null>(null);
  const pointerDownOnBackdropRef = useRef(false);
  const pickerActiveRef = useRef(false);
  const pickerReturnedAtRef = useRef(0);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const draft = useReportDraft({ isOpen, initialPrefill, userRole: currentUser?.role, onDraftSaved, onDraftCleared });
  const isOfficer = currentUser?.role === 'security' || currentUser?.role === 'admin' || Boolean(currentUser?.isAdmin);

  const isDirtyRef = useRef(draft.isDirty);
  const isCompressingRef = useRef(draft.isCompressing);
  useEffect(() => {
    isDirtyRef.current = draft.isDirty;
    isCompressingRef.current = draft.isCompressing;
  }, [draft.isDirty, draft.isCompressing]);

  const isPickerGuardActive = () =>
    pickerActiveRef.current || Date.now() - pickerReturnedAtRef.current < PICKER_RETURN_GUARD_MS;

  const requestClose = useCallback((source: 'backdrop' | 'escape' | 'button') => {
    if (source !== 'button' && (isPickerGuardActive() || isCompressingRef.current)) {
      return;
    }
    if (isDirtyRef.current) {
      setShowDiscardConfirm(true);
      return;
    }
    onCloseRef.current();
  }, []);

  useEffect(() => {
    if (isOpen) {
      setSaveNotice(null);
      setShowDiscardConfirm(false);
      pickerActiveRef.current = false;
      pickerReturnedAtRef.current = 0;
    }
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const timer = window.setTimeout(() => dialogRef.current?.focus(), 0);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        requestClose('escape');
        return;
      }
      trapFocusOnTab(e, dialogRef.current);
    };
    const onWindowReturn = () => {
      if (pickerActiveRef.current) {
        pickerActiveRef.current = false;
        pickerReturnedAtRef.current = Date.now();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('focus', onWindowReturn);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('focus', onWindowReturn);
      previousFocusRef.current?.focus?.();
    };
  }, [isOpen, requestClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    draft.setFormError(null);

    const validationError = validateReportInputs({
      category: draft.category,
      location: draft.location,
      title: draft.title,
      locationDetails: draft.locationDetails,
      description: draft.description,
      verificationQuestion: draft.verificationQuestion,
      locationIsOther: draft.locationIsOther,
    });
    if (validationError) {
      draft.setFormError(validationError);
      return;
    }

    const effectiveHoldingLocation: HoldingLocation = draft.isFoundStudentId
      ? 'security_main_gate'
      : draft.reportType === 'found'
      ? draft.holdingLocation
      : 'finder_holding';
    const effectiveCustodyStatus: CampusItem['custodyStatus'] =
      draft.reportType === 'found' && effectiveHoldingLocation !== 'finder_holding' && !isOfficer
        ? 'awaiting_dropoff'
        : 'confirmed';

    const newItem: CampusItem = {
      id: `item-${Date.now()}`,
      type: draft.reportType,
      title: draft.title.trim(),
      category: draft.category as ItemCategory,
      description: draft.description.trim(),
      location: draft.locationIsOther || !isListedLocation(draft.location) ? normalizeCustomLocation(draft.location) : draft.location,
      locationDetails: draft.locationDetails.trim() || undefined,
      dateLostOrFound: draft.dateLostOrFound,
      status: 'open',
      holdingLocation: effectiveHoldingLocation,
      custodyStatus: effectiveCustodyStatus,
      thumbUrl: draft.isFoundStudentId ? undefined : draft.compressionResult?.thumbDataUrl,
      imageUrl: draft.isFoundStudentId ? undefined : draft.compressionResult?.dataUrl,
      isSensitiveId: draft.category === 'student_id',
      verificationQuestion: draft.reportType === 'found' && draft.verificationQuestion.trim() ? draft.verificationQuestion.trim() : undefined,
      verificationAnswer: draft.reportType === 'found' && draft.verificationAnswer.trim() ? draft.verificationAnswer.trim() : undefined,
      reportedByEmailDomain: 'nileuniversity.edu.ng',
      createdAt: new Date().toISOString(),
    };

    if (!currentUser) {
      draft.saveDraftLocally();
      onOpenLogin?.();
      return;
    }

    setIsSubmitting(true);
    try {
      const saved = await onSubmitItem(newItem);
      if (saved === false) {
        draft.setFormError({ heading: 'Could not publish notice', detail: 'Could not save report to campus database. Your draft is preserved.' });
        return;
      }
      draft.clearDraft(false);
      onCloseRef.current();
    } catch (err: unknown) {
      draft.setFormError({
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
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/55 overflow-y-auto modal-backdrop-enter"
      onPointerDown={(e) => {
        pointerDownOnBackdropRef.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        const allowBackdrop = shouldCloseBackdropClick(e, pointerDownOnBackdropRef.current);
        pointerDownOnBackdropRef.current = false;
        if (allowBackdrop) requestClose('backdrop');
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-modal-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[480px] bg-white dark:bg-[#1E1C18] text-[#1F1B16] dark:text-[#F5F1EA] rounded-[12px] shadow-xl max-h-[90dvh] overflow-hidden border border-[#C4BBAF] dark:border-[#3E3931] flex flex-col min-w-0 outline-none modal-panel-enter"
      >
        <div className="bg-[#FAF6EF] dark:bg-[#141311] px-5 sm:px-6 py-4 border-b border-[#C4BBAF] dark:border-[#3E3931] flex items-center justify-between">
          <h3 id="report-modal-title" className="font-serif font-bold text-base tracking-tight text-[#1F1B16] dark:text-[#F5F1EA]">
            Report an Item on Campus
          </h3>
          <button
            type="button"
            onClick={() => requestClose('button')}
            className="text-[#5C554C] dark:text-[#A8A095] hover:text-[#1F1B16] dark:hover:text-[#F5F1EA] transition-colors p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-[10px] cursor-pointer"
            aria-label="Close report dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {showDiscardConfirm && (
          <div role="alertdialog" aria-labelledby="discard-report-title" className="bg-[#FEF7E9] dark:bg-[#2B210A] border-b border-[#E8A317]/40 px-5 py-3.5 text-sm space-y-2.5">
            <p id="discard-report-title" className="font-semibold text-[#7A5000] dark:text-[#F9CF7C]">
              Close this report form?
            </p>
            <p className="text-xs text-[#7A5000] dark:text-[#F9CF7C]">
              Your text fields are saved offline as a draft, but attached photos and secret verification answers are not saved until submitted.
            </p>
            <div className="flex flex-wrap gap-2 justify-end">
              <button
                type="button"
                onClick={() => setShowDiscardConfirm(false)}
                className="min-h-[44px] px-3.5 rounded-[10px] bg-white dark:bg-[#1E1C18] border border-[#857C70] dark:border-[#787065] text-xs font-semibold text-[#1F1B16] dark:text-[#F5F1EA] cursor-pointer"
              >
                Keep editing
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDiscardConfirm(false);
                  onCloseRef.current();
                }}
                className="min-h-[44px] px-3.5 rounded-[10px] bg-[#9B1C1C] text-white text-xs font-semibold cursor-pointer"
              >
                Close form
              </button>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 min-h-0 flex-1 overflow-y-auto">
          {currentUser ? (
            <div className="bg-[#FAF6EF] dark:bg-[#141311] border border-[#C4BBAF] dark:border-[#3E3931] px-3.5 py-2.5 rounded-[10px] text-sm flex items-center justify-between gap-2">
              <span className="text-[#4A443C] dark:text-[#CEC7BB]">Reporting as:</span>
              <span className="font-medium text-[#0F6E6E] dark:text-[#199595] flex items-center gap-1.5 truncate">
                <CheckCircle className="w-4 h-4 shrink-0" />
                <span className="truncate">{currentUser.name}</span>
                <span className="text-xs px-1.5 py-0.5 rounded bg-white dark:bg-[#1E1C18] border border-[#C4BBAF] dark:border-[#3E3931] text-[#4A443C] dark:text-[#CEC7BB]">
                  {getRoleDisplayLabel(currentUser.role, currentUser.isAdmin)}
                </span>
              </span>
            </div>
          ) : (
            <div className="bg-[#FAF6EF] dark:bg-[#141311] border border-[#C4BBAF] dark:border-[#3E3931] p-3.5 rounded-[10px] text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-[#0F6E6E] dark:text-[#199595] shrink-0" />
                <span className="text-[#4A443C] dark:text-[#CEC7BB]">Sign in required to publish notices and get updates.</span>
              </div>
              <button type="button" onClick={() => { setIsSigningIn(true); try { draft.saveDraftLocally(); onOpenLogin?.(); } finally { setIsSigningIn(false); } }} disabled={isSigningIn} className="bg-[#0F6E6E] hover:bg-[#0C5656] disabled:opacity-50 text-white px-3.5 py-2 rounded-[10px] font-medium text-sm min-h-[44px] shrink-0 cursor-pointer shadow-xs transition-colors text-center btn-campus">
                Open sign-in
              </button>
            </div>
          )}

          {draft.hasRestoredDraft && (
            <div className="flex items-center justify-between text-sm bg-[#FEF7E9] dark:bg-[#2B210A] text-[#7A5000] dark:text-[#F9CF7C] border border-[#E8A317]/40 p-3 rounded-[10px]">
              <span className="flex items-center gap-2"><Save className="w-4 h-4 shrink-0" />Restored unfinished draft</span>
              <button type="button" onClick={() => draft.clearDraft(true)} className="font-bold underline hover:opacity-80 cursor-pointer shrink-0 ml-2 min-h-[44px] px-2">Clear</button>
            </div>
          )}

          {saveNotice && (
            <div role="status" className="text-sm bg-[#E7F3F3] dark:bg-[#0D2D2D] text-[#0F6E6E] dark:text-[#199595] border border-[#0F6E6E]/30 p-3 rounded-[10px] flex items-center gap-2">
              <CheckCircle className="w-4 h-4 shrink-0" />
              <span>{saveNotice}</span>
            </div>
          )}

          {draft.formError && (
            <div role="alert" className="bg-[#FDF2F2] dark:bg-[#2B0E0E] border border-[#F87171]/50 text-[#9B1C1C] dark:text-[#F87171] text-sm p-3.5 rounded-[10px] flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">{draft.formError.heading}</p>
                <p className="mt-0.5">{draft.formError.detail}</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 bg-[#FAF6EF] dark:bg-[#141311] p-1.5 rounded-[10px] border border-[#857C70] dark:border-[#787065]">
            <button
              type="button"
              onClick={() => {
                draft.setReportType('lost');
                draft.saveDraftLocally({ reportType: 'lost' });
              }}
              className={`py-2 text-sm font-semibold rounded-[10px] transition-colors min-h-[44px] cursor-pointer btn-campus ${draft.reportType === 'lost' ? 'bg-[#E8A317] text-[#1F1B16] shadow-xs' : 'text-[#4A443C] dark:text-[#CEC7BB] hover:text-[#1F1B16] dark:hover:text-[#F5F1EA]'}`}
            >
              I Lost Something
            </button>
            <button
              type="button"
              onClick={() => {
                const nextHolding = resolveDefaultHoldingLocation('found', draft.category, currentUser?.role, draft.holdingLocation === 'finder_holding' ? undefined : draft.holdingLocation);
                draft.setReportType('found');
                draft.setHoldingLocation(nextHolding);
                draft.saveDraftLocally({ reportType: 'found', holdingLocation: nextHolding });
              }}
              className={`py-2 text-sm font-semibold rounded-[10px] transition-colors min-h-[44px] cursor-pointer btn-campus ${draft.reportType === 'found' ? 'bg-[#2F7D4F] text-white shadow-xs' : 'text-[#4A443C] dark:text-[#CEC7BB] hover:text-[#1F1B16] dark:hover:text-[#F5F1EA]'}`}
            >
              I Found Something
            </button>
          </div>

          {isOfficer && (
            <div className="bg-[#FAF6EF] dark:bg-[#141311] border border-[#C4BBAF] dark:border-[#3E3931] rounded-[10px] p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-[#0F6E6E] dark:text-[#199595]">
                  Quick Officer Intake
                </span>
                <span className="text-xs text-[#5C554C] dark:text-[#A8A095]">1-tap gate custody fill</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {OFFICER_INTAKE_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => draft.applyOfficerPreset(preset)}
                    className="min-h-[44px] px-3 py-1.5 rounded-[10px] border border-[#857C70] dark:border-[#787065] bg-white dark:bg-[#1E1C18] hover:border-[#0F6E6E] text-xs font-medium text-[#1F1B16] dark:text-[#F5F1EA] cursor-pointer transition-colors btn-campus"
                  >
                    + {preset.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label htmlFor="report-category" className="block text-sm font-medium text-[#4A443C] dark:text-[#CEC7BB] mb-1.5">
              Item Category <span className="text-[#0F6E6E]">*</span>
            </label>
            <select id="report-category" required value={draft.category} onChange={(e) => { const v = e.target.value as ItemCategory; draft.setCategory(v); draft.saveDraftLocally({ category: v }); }} className={`${FIELD_INPUT} pr-8 cursor-pointer`}>
              <option value="" disabled>Select an item category...</option>
              {CATEGORIES.map((cat) => <option key={cat.id} value={cat.id}>{cat.label}</option>)}
            </select>
          </div>

          {draft.isFoundStudentId && (
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
            <input id="report-title" type="text" value={draft.title} onChange={(e) => { draft.setTitle(e.target.value); draft.setFormError(null); draft.saveDraftLocally({ title: e.target.value }); }} placeholder={draft.isFoundStudentId ? 'A student ID card was found' : draft.reportType === 'lost' ? 'e.g. Casio fx-991EX Calculator with red sticker' : 'e.g. Black Anker 20,000mAh Power Bank'} className={FIELD_INPUT} required />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="report-location" className="block text-sm font-medium text-[#4A443C] dark:text-[#CEC7BB] mb-1.5">
                Campus Location <span className="text-[#0F6E6E]">*</span>
              </label>
              <select
                id="report-location"
                required
                value={draft.locationIsOther ? OTHER_LOCATION_VALUE : draft.location}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === OTHER_LOCATION_VALUE) {
                    const wasListed = isListedLocation(draft.location);
                    draft.selectOtherLocation();
                    if (wasListed) {
                      draft.saveDraftLocally({ location: '' });
                    }
                    window.setTimeout(() => customLocationRef.current?.focus(), 0);
                    return;
                  }
                  draft.selectListedLocation(value);
                  draft.saveDraftLocally({ location: value });
                }}
                className={`${FIELD_INPUT} pr-8 cursor-pointer`}
              >
                <option value="" disabled>Select campus location...</option>
                {NILE_LOCATION_GROUPS.map((group) => (
                  <optgroup key={group.label} label={group.label}>
                    {group.locations.map((loc) => <option key={loc} value={loc}>{loc}</option>)}
                  </optgroup>
                ))}
                <option value={OTHER_LOCATION_VALUE}>{OTHER_LOCATION_LABEL}</option>
              </select>
              {draft.locationIsOther && (
                <div className="mt-2">
                  <label htmlFor="report-location-custom" className="block text-sm font-medium text-[#4A443C] dark:text-[#CEC7BB] mb-1.5">
                    Where was it? <span className="text-[#0F6E6E]">*</span>
                  </label>
                  <input
                    ref={customLocationRef}
                    id="report-location-custom"
                    type="text"
                    required
                    maxLength={MAX_CUSTOM_LOCATION_LENGTH}
                    value={draft.location}
                    onChange={(e) => {
                      const value = e.target.value.slice(0, MAX_CUSTOM_LOCATION_LENGTH);
                      draft.setLocation(value);
                      draft.setFormError(null);
                      draft.saveDraftLocally({ location: value });
                    }}
                    autoComplete="off"
                    placeholder="e.g. Faculty of Law corridor"
                    aria-describedby="report-location-custom-help"
                    className={FIELD_INPUT}
                  />
                  <p id="report-location-custom-help" className="mt-1 text-xs text-[#5C554C] dark:text-[#A8A095]">
                    Type the building or place. Other students search by this name.
                  </p>
                </div>
              )}
            </div>
            <div>
              <label htmlFor="report-date" className="block text-sm font-medium text-[#4A443C] dark:text-[#CEC7BB] mb-1.5">
                Date {draft.reportType === 'lost' ? 'Lost' : 'Found'}
              </label>
              <input id="report-date" type="date" max={todayWat} value={draft.dateLostOrFound} onChange={(e) => { draft.setDateLostOrFound(e.target.value); draft.saveDraftLocally({ dateLostOrFound: e.target.value }); }} className={FIELD_INPUT} required />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="report-location-details" className="block text-sm font-medium text-[#4A443C] dark:text-[#CEC7BB] mb-1.5">
                Specific Spot <span className="text-sm font-normal text-[#5C554C] dark:text-[#A8A095]">(optional)</span>
              </label>
              <input id="report-location-details" type="text" value={draft.locationDetails} onChange={(e) => { const v = e.target.value.slice(0, 160); draft.setLocationDetails(v); draft.saveDraftLocally({ locationDetails: v }); }} placeholder="e.g. Room 205, Ground Floor Corridor" maxLength={160} className={FIELD_INPUT} />
            </div>
          </div>

          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
              <label htmlFor="report-description" className="block text-sm font-medium text-[#4A443C] dark:text-[#CEC7BB]">Detailed Description <span className="text-[#0F6E6E]">*</span></label>
              <span className="text-sm text-[#5C554C] dark:text-[#A8A095]">No phone or matric numbers</span>
            </div>
            <textarea id="report-description" rows={3} value={draft.description} onChange={(e) => { draft.setDescription(e.target.value); draft.setFormError(null); draft.saveDraftLocally({ description: e.target.value }); }} placeholder={draft.reportType === 'lost' ? 'Describe physical condition, stickers, case color, where you last had it...' : draft.isFoundStudentId ? 'Describe where on campus it was found. Do not type names or matric numbers.' : 'Describe general color, model, and location found without revealing private marks.'} className="w-full text-base sm:text-sm px-3.5 py-2.5 rounded-[10px] border border-[#857C70] dark:border-[#787065] bg-white dark:bg-[#141311] text-[#1F1B16] dark:text-[#F5F1EA] placeholder:text-[#5C554C] dark:placeholder:text-[#A8A095] focus:border-[#0F6E6E]" required />
          </div>

          {draft.reportType === 'found' && (
            <FoundVerificationSection
              isFoundStudentId={draft.isFoundStudentId}
              verificationQuestion={draft.verificationQuestion}
              verificationAnswer={draft.verificationAnswer}
              holdingLocation={draft.holdingLocation}
              fieldClass={FIELD_INPUT}
              onChangeQuestion={(v) => { draft.setVerificationQuestion(v); draft.saveDraftLocally({ verificationQuestion: v }); }}
              onChangeAnswer={draft.setVerificationAnswer}
              onChangeHoldingLocation={(v) => { draft.setHoldingLocation(v); draft.saveDraftLocally({ holdingLocation: v }); }}
            />
          )}

          <PhotoUploadSection
            isFoundStudentId={draft.isFoundStudentId}
            isCompressing={draft.isCompressing}
            compressionProgress={draft.compressionProgress}
            compressionResult={draft.compressionResult}
            fileInputRef={fileInputRef}
            onImageChange={draft.handleImageChange}
            onRemoveImage={() => { draft.setCompressionResult(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
            onPickerOpen={() => {
              pickerActiveRef.current = true;
            }}
            onPickerCancel={() => {
              pickerActiveRef.current = false;
              pickerReturnedAtRef.current = Date.now();
            }}
            onInvalidPreview={(message) => {
              draft.setFormError({ heading: 'Photo could not be previewed', detail: message });
            }}
          />

          <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-[#C4BBAF] dark:border-[#3E3931]">
            <button
              type="button"
              onClick={() => {
                draft.saveDraftLocally();
                setSaveNotice('Draft saved locally (without private verification answer).');
                if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
                saveTimerRef.current = window.setTimeout(() => setSaveNotice(null), 3000);
              }}
              className="text-sm font-medium text-[#5C554C] dark:text-[#A8A095] hover:text-[#0F6E6E] dark:hover:text-[#199595] flex items-center gap-1.5 cursor-pointer min-h-[44px] py-2"
            >
              <Save className="w-4 h-4" />
              <span>Save Offline Draft</span>
            </button>
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => requestClose('button')}
                className="px-4 py-2 text-sm font-medium text-[#4A443C] dark:text-[#CEC7BB] hover:text-[#1F1B16] dark:hover:text-[#F5F1EA] bg-white dark:bg-[#28241F] rounded-[10px] border border-[#857C70] dark:border-[#787065] transition-colors min-h-[44px] cursor-pointer btn-campus"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || draft.isCompressing || isSigningIn}
                className={`px-5 py-2 text-sm font-semibold rounded-[10px] transition-colors min-h-[44px] cursor-pointer shadow-xs disabled:opacity-50 btn-campus ${draft.reportType === 'lost' ? 'bg-[#E8A317] hover:bg-[#d69310] text-[#1F1B16]' : 'bg-[#0F6E6E] hover:bg-[#0C5656] text-white'}`}
              >
                {isSigningIn ? 'Signing in...' : isSubmitting ? 'Publishing...' : !currentUser ? `Sign in & Post ${draft.reportType === 'lost' ? 'Lost' : 'Found'}` : `Post ${draft.reportType === 'lost' ? 'Lost Notice' : 'Found Notice'}`}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
