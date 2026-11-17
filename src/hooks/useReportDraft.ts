import React, { useState, useEffect, useCallback, useRef } from 'react';
import { HoldingLocation, ItemCategory, ItemType, ReportPrefill, UserRole } from '../types/index.ts';
import { detectPii } from '../utils/piiDetector.ts';
import { compressImageFile, CompressionResult, isSupportedImageFile } from '../utils/imageCompressor.ts';
import { getTodayWatIsoDate } from '../utils/dateFormatter.ts';
import { buildInitialReportFields, OfficerIntakePreset, resolveDefaultHoldingLocation } from '../utils/reportPresets.ts';
import { reportError } from '../components/ErrorBoundary.tsx';
import { isListedLocation, MIN_CUSTOM_LOCATION_LENGTH, normalizeCustomLocation } from '../config/locations.ts';

const DRAFT_STORAGE_KEY = 'nilefound_report_draft_v1';

interface UseReportDraftOptions {
  isOpen: boolean;
  initialPrefill?: ReportPrefill | null;
  userRole?: UserRole | null;
  onDraftSaved: () => void;
  onDraftCleared?: () => void;
}

export interface ReportFormError {
  heading: string;
  detail: string;
}

export function validateReportInputs(fields: {
  category: ItemCategory | '';
  location: string;
  title: string;
  locationDetails: string;
  description: string;
  verificationQuestion: string;
  /** True when the reporter chose "Other place" and typed the location. */
  locationIsOther?: boolean;
}): ReportFormError | null {
  if (!fields.category) {
    return { heading: 'Missing item category', detail: 'Select an item category before continuing.' };
  }
  const customLocation = normalizeCustomLocation(fields.location);
  const isCustom = Boolean(fields.locationIsOther) || (customLocation.length > 0 && !isListedLocation(fields.location));
  if (!fields.location.trim() && !isCustom) {
    return { heading: 'Missing campus location', detail: 'Select where the item was lost or found.' };
  }
  if (isCustom && customLocation.length < MIN_CUSTOM_LOCATION_LENGTH) {
    return {
      heading: 'Tell us where it was',
      detail: 'Type the building or place (at least 2 characters), or pick one from the list.',
    };
  }
  const piiChecks: Array<{ text: string; fallback: string }> = [
    ...(isCustom ? [{ text: customLocation, fallback: 'Remove personal details from the place name.' }] : []),
    { text: fields.title, fallback: 'Remove personal details before submitting.' },
    { text: fields.locationDetails, fallback: 'Remove personal details from Specific Spot.' },
    { text: fields.description, fallback: 'Remove personal details before submitting.' },
    { text: fields.verificationQuestion, fallback: 'Remove personal details before submitting.' },
  ];
  for (const check of piiChecks) {
    if (!check.text.trim()) continue;
    const result = detectPii(check.text);
    if (result.hasPii) {
      return { heading: 'Personal details detected', detail: result.errorMessage || check.fallback };
    }
  }
  return null;
}

export function useReportDraft({ isOpen, initialPrefill, userRole, onDraftSaved, onDraftCleared }: UseReportDraftOptions) {
  const [reportType, setReportType] = useState<ItemType>('lost');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<ItemCategory | ''>('');
  const [location, setLocation] = useState<string>('');
  // True after the reporter picks "Other place". The text typed in `location` is the place name.
  const [otherLocationChosen, setOtherLocationChosen] = useState(false);
  const [locationDetails, setLocationDetails] = useState('');
  const [description, setDescription] = useState('');
  const [dateLostOrFound, setDateLostOrFound] = useState(() => getTodayWatIsoDate());
  const [holdingLocation, setHoldingLocation] = useState<HoldingLocation>('finder_holding');
  const [verificationQuestion, setVerificationQuestion] = useState('');
  const [verificationAnswer, setVerificationAnswer] = useState('');
  const [compressionResult, setCompressionResult] = useState<CompressionResult | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [compressionProgress, setCompressionProgress] = useState(0);
  const [hasRestoredDraft, setHasRestoredDraft] = useState(false);
  const [formError, setFormError] = useState<ReportFormError | null>(null);

  const wasOpenRef = useRef(false);
  const onDraftSavedRef = useRef(onDraftSaved);
  const onDraftClearedRef = useRef(onDraftCleared);
  const userRoleRef = useRef(userRole);
  useEffect(() => {
    onDraftSavedRef.current = onDraftSaved;
    onDraftClearedRef.current = onDraftCleared;
    userRoleRef.current = userRole;
  }, [onDraftSaved, onDraftCleared, userRole]);

  const isFoundStudentId = reportType === 'found' && category === 'student_id';

  const resetEmptyFields = useCallback((prefill?: ReportPrefill | null) => {
    const defaults = buildInitialReportFields(prefill, userRoleRef.current);
    setReportType(defaults.type);
    setCategory(defaults.category);
    setLocation(defaults.location);
    setOtherLocationChosen(Boolean(defaults.location) && !isListedLocation(defaults.location));
    setTitle(defaults.title);
    setLocationDetails('');
    setDescription('');
    setDateLostOrFound(getTodayWatIsoDate());
    setHoldingLocation(defaults.holdingLocation);
    setVerificationQuestion('');
    setVerificationAnswer('');
    setCompressionResult(null);
  }, []);

  useEffect(() => {
    if (isFoundStudentId) {
      setHoldingLocation('security_main_gate');
      setCompressionResult(null);
    }
  }, [isFoundStudentId]);

  useEffect(() => {
    if (!isOpen) {
      wasOpenRef.current = false;
      return;
    }
    if (wasOpenRef.current) return;
    wasOpenRef.current = true;

    setFormError(null);
    if (initialPrefill) {
      resetEmptyFields(initialPrefill);
      setHasRestoredDraft(false);
      return;
    }
    try {
      const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.title || parsed.description || parsed.category || parsed.location) {
          setReportType(parsed.reportType || (userRoleRef.current === 'security' ? 'found' : 'lost'));
          setTitle(parsed.title || '');
          setCategory(parsed.category || '');
          setLocation(parsed.location || '');
          setOtherLocationChosen(Boolean(parsed.location) && !isListedLocation(parsed.location));
          setLocationDetails(parsed.locationDetails || '');
          setDescription(parsed.description || '');
          setDateLostOrFound(parsed.dateLostOrFound || getTodayWatIsoDate());
          setHoldingLocation(parsed.holdingLocation || resolveDefaultHoldingLocation(parsed.reportType || 'lost', parsed.category || '', userRoleRef.current));
          setVerificationQuestion(parsed.verificationQuestion || '');
          // Security rule: never persist or restore secret verification answers from localStorage.
          setVerificationAnswer('');
          setCompressionResult(null);
          setHasRestoredDraft(true);
          return;
        }
      }
    } catch (err) {
      reportError('Restore report draft failed', err);
    }
    resetEmptyFields(null);
    setHasRestoredDraft(false);
  }, [isOpen, initialPrefill, resetEmptyFields]);

  const saveDraftLocally = useCallback(
    (overrides?: Partial<{
      reportType: ItemType;
      title: string;
      category: ItemCategory | '';
      location: string;
      locationDetails: string;
      description: string;
      dateLostOrFound: string;
      holdingLocation: HoldingLocation;
      verificationQuestion: string;
    }>) => {
      const draftData = {
        reportType: overrides?.reportType ?? reportType,
        title: overrides?.title ?? title,
        category: overrides?.category ?? category,
        location: overrides?.location ?? location,
        locationDetails: overrides?.locationDetails ?? locationDetails,
        description: overrides?.description ?? description,
        dateLostOrFound: overrides?.dateLostOrFound ?? dateLostOrFound,
        holdingLocation: overrides?.holdingLocation ?? holdingLocation,
        verificationQuestion: overrides?.verificationQuestion ?? verificationQuestion,
      };
      try {
        localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draftData));
        onDraftSavedRef.current();
      } catch (err) {
        reportError('Save report draft failed', err);
      }
    },
    [reportType, title, category, location, locationDetails, description, dateLostOrFound, holdingLocation, verificationQuestion]
  );

  const clearDraft = useCallback((resetFields = false) => {
    try {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch (err) {
      reportError('Clear draft storage failed', err);
    }
    setHasRestoredDraft(false);
    onDraftClearedRef.current?.();
    if (resetFields) resetEmptyFields();
  }, [resetEmptyFields]);

  const handleImageChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file || isFoundStudentId) return;
      if (!isSupportedImageFile(file)) {
        setFormError({ heading: 'Unsupported image file', detail: 'Choose a JPEG, PNG, or WebP image no larger than 5MB.' });
        return;
      }
      try {
        setIsCompressing(true);
        setCompressionProgress(0);
        setFormError(null);
        setCompressionResult(await compressImageFile(file, 800, 0.72, setCompressionProgress));
      } catch (err: unknown) {
        setCompressionResult(null);
        setFormError({
          heading: 'Photo could not be attached',
          detail: err instanceof Error ? err.message : 'Photo too large. Try a smaller JPEG, PNG, or WebP file.',
        });
      } finally {
        setIsCompressing(false);
        setCompressionProgress(0);
      }
    },
    [isFoundStudentId]
  );

  const selectListedLocation = useCallback((value: string) => {
    setOtherLocationChosen(false);
    setLocation(value);
  }, []);

  const selectOtherLocation = useCallback(() => {
    setOtherLocationChosen(true);
    // Start empty so the reporter types the place; a listed value must not linger in the text box.
    setLocation((prev) => (isListedLocation(prev) ? '' : prev));
  }, []);

  // Typing a listed place name by hand snaps back to the normal list entry.
  const locationIsOther = otherLocationChosen && !isListedLocation(location);

  const applyOfficerPreset = useCallback((preset: OfficerIntakePreset) => {
    const defaultLoc = preset.holdingLocation === 'student_affairs_office' ? 'Nile House (Admin)' : 'Main Campus Gate';
    setReportType(preset.type);
    setCategory(preset.category);
    setTitle(preset.title);
    setLocation((prev) => {
      const next = prev || defaultLoc;
      if (!prev) setOtherLocationChosen(false);
      return next;
    });
    setDescription((prev) => prev.trim() || preset.descriptionHint);
    setHoldingLocation(preset.holdingLocation);
    if (preset.verificationQuestion) {
      setVerificationQuestion(preset.verificationQuestion);
    }
    if (preset.category === 'student_id') {
      setCompressionResult(null);
    }
    setFormError(null);
  }, []);

  const isDirty = Boolean(
    title.trim() ||
    description.trim() ||
    locationDetails.trim() ||
    verificationQuestion.trim() ||
    verificationAnswer.trim() ||
    compressionResult !== null ||
    category !== '' ||
    location !== '' ||
    locationIsOther
  );

  return {
    reportType, setReportType,
    title, setTitle,
    category, setCategory,
    location, setLocation,
    locationIsOther, selectListedLocation, selectOtherLocation,
    locationDetails, setLocationDetails,
    description, setDescription,
    dateLostOrFound, setDateLostOrFound,
    holdingLocation, setHoldingLocation,
    verificationQuestion, setVerificationQuestion,
    verificationAnswer, setVerificationAnswer,
    compressionResult, setCompressionResult,
    isCompressing,
    compressionProgress,
    hasRestoredDraft,
    formError, setFormError,
    isFoundStudentId,
    isDirty,
    saveDraftLocally,
    clearDraft,
    handleImageChange,
    applyOfficerPreset,
  };
}
