/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * NileFound Item Reporting Modal
 * Layout: Modular single-scroll report dialog with safe non-secret offline draft persistence and image compression.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X } from 'lucide-react';
import { CampusItem, HoldingLocation, ItemCategory, ReportPrefill, User } from '../types/index.ts';
import { isListedLocation, normalizeCustomLocation } from '../config/locations.ts';
import { getTodayWatIsoDate } from '../utils/dateFormatter.ts';
import { resolveDefaultHoldingLocation } from '../utils/reportPresets.ts';
import { shouldCloseBackdropClick, trapFocusOnTab } from '../utils/modalFocus.ts';
import { useReportDraft, validateReportInputs } from '../hooks/useReportDraft.ts';
import { FoundVerificationSection } from './report/FoundVerificationSection.tsx';
import { PhotoUploadSection } from './report/PhotoUploadSection.tsx';
import { ReportDiscardConfirm } from './report/ReportDiscardConfirm.tsx';
import { ReportIdentityBanner } from './report/ReportIdentityBanner.tsx';
import { ReportDetailsFields } from './report/ReportDetailsFields.tsx';
import { ReportLocationFields } from './report/ReportLocationFields.tsx';
import { ReportModalFooter } from './report/ReportModalFooter.tsx';

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
      photoFile: draft.category === 'student_id' ? undefined : draft.compressionResult?.file,
      thumbFile: draft.category === 'student_id' ? undefined : draft.compressionResult?.thumbFile,
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
          <ReportDiscardConfirm
            onKeepEditing={() => setShowDiscardConfirm(false)}
            onConfirmClose={() => {
              setShowDiscardConfirm(false);
              onCloseRef.current();
            }}
          />
        )}

        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 min-h-0 flex-1 overflow-y-auto">
          <ReportIdentityBanner
            currentUser={currentUser}
            isOfficer={isOfficer}
            isSigningIn={isSigningIn}
            hasRestoredDraft={draft.hasRestoredDraft}
            saveNotice={saveNotice}
            formError={draft.formError}
            onStartSignIn={() => {
              setIsSigningIn(true);
              try {
                draft.saveDraftLocally();
                onOpenLogin?.();
              } finally {
                setIsSigningIn(false);
              }
            }}
            onClearDraft={() => draft.clearDraft(true)}
            onApplyPreset={draft.applyOfficerPreset}
          />

          <ReportDetailsFields
            reportType={draft.reportType}
            category={draft.category}
            title={draft.title}
            description={draft.description}
            isFoundStudentId={draft.isFoundStudentId}
            fieldClass={FIELD_INPUT}
            onSelectLost={() => {
              draft.setReportType('lost');
              draft.saveDraftLocally({ reportType: 'lost' });
            }}
            onSelectFound={() => {
              const nextHolding = resolveDefaultHoldingLocation(
                'found',
                draft.category,
                currentUser?.role,
                draft.holdingLocation === 'finder_holding' ? undefined : draft.holdingLocation
              );
              draft.setReportType('found');
              draft.setHoldingLocation(nextHolding);
              draft.saveDraftLocally({ reportType: 'found', holdingLocation: nextHolding });
            }}
            onChangeCategory={(v) => {
              draft.setCategory(v);
              draft.saveDraftLocally({ category: v });
            }}
            onChangeTitle={(v) => {
              draft.setTitle(v);
              draft.setFormError(null);
              draft.saveDraftLocally({ title: v });
            }}
            onChangeDescription={(v) => {
              draft.setDescription(v);
              draft.setFormError(null);
              draft.saveDraftLocally({ description: v });
            }}
          />

          <ReportLocationFields
            reportType={draft.reportType}
            location={draft.location}
            locationIsOther={draft.locationIsOther}
            locationDetails={draft.locationDetails}
            dateLostOrFound={draft.dateLostOrFound}
            todayWat={todayWat}
            fieldClass={FIELD_INPUT}
            customLocationRef={customLocationRef}
            onSelectOtherLocation={(clearSaved) => {
              draft.selectOtherLocation();
              if (clearSaved) draft.saveDraftLocally({ location: '' });
            }}
            onSelectListedLocation={(value) => {
              draft.selectListedLocation(value);
              draft.saveDraftLocally({ location: value });
            }}
            onChangeCustomLocation={(value) => {
              draft.setLocation(value);
              draft.setFormError(null);
              draft.saveDraftLocally({ location: value });
            }}
            onChangeDate={(value) => {
              draft.setDateLostOrFound(value);
              draft.saveDraftLocally({ dateLostOrFound: value });
            }}
            onChangeLocationDetails={(value) => {
              draft.setLocationDetails(value);
              draft.saveDraftLocally({ locationDetails: value });
            }}
          />

          {draft.reportType === 'found' && (
            <FoundVerificationSection
              isFoundStudentId={draft.isFoundStudentId}
              verificationQuestion={draft.verificationQuestion}
              verificationAnswer={draft.verificationAnswer}
              holdingLocation={draft.holdingLocation}
              fieldClass={FIELD_INPUT}
              onChangeQuestion={(v) => {
                draft.setVerificationQuestion(v);
                draft.saveDraftLocally({ verificationQuestion: v });
              }}
              onChangeAnswer={draft.setVerificationAnswer}
              onChangeHoldingLocation={(v) => {
                draft.setHoldingLocation(v);
                draft.saveDraftLocally({ holdingLocation: v });
              }}
            />
          )}

          <PhotoUploadSection
            isFoundStudentId={draft.isFoundStudentId}
            isStudentId={draft.category === 'student_id'}
            isCompressing={draft.isCompressing}
            compressionProgress={draft.compressionProgress}
            compressionResult={draft.compressionResult}
            fileInputRef={fileInputRef}
            onImageChange={draft.handleImageChange}
            onRemoveImage={() => {
              draft.setCompressionResult(null);
              if (fileInputRef.current) fileInputRef.current.value = '';
            }}
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

          <ReportModalFooter
            reportType={draft.reportType}
            currentUser={currentUser}
            isSubmitting={isSubmitting}
            isCompressing={draft.isCompressing}
            isSigningIn={isSigningIn}
            onSaveDraft={() => {
              draft.saveDraftLocally();
              setSaveNotice('Draft saved locally (without private verification answer).');
              if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
              saveTimerRef.current = window.setTimeout(() => setSaveNotice(null), 3000);
            }}
            onCancel={() => requestClose('button')}
          />
        </form>
      </div>
    </div>
  );
};
