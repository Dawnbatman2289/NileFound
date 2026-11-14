import React, { useState, useEffect, useCallback } from 'react';
import { CampusItem, HoldingLocation, ItemCategory, ItemType } from '../types/index.ts';
import { detectPii } from '../utils/piiDetector.ts';
import { compressImageFile, CompressionResult, isSupportedImageFile } from '../utils/imageCompressor.ts';
import { getTodayWatIsoDate } from '../utils/dateFormatter.ts';
import { reportError } from '../components/ErrorBoundary.tsx';

const DRAFT_STORAGE_KEY = 'nilefound_report_draft_v1';

interface UseReportDraftOptions {
  isOpen: boolean;
  initialPrefill?: Partial<Pick<CampusItem, 'type' | 'title' | 'category' | 'location'>> | null;
  onDraftSaved: () => void;
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
}): ReportFormError | null {
  if (!fields.category) {
    return { heading: 'Missing item category', detail: 'Select an item category before continuing.' };
  }
  if (!fields.location) {
    return { heading: 'Missing campus location', detail: 'Select where the item was lost or found.' };
  }
  const piiChecks: Array<{ text: string; fallback: string }> = [
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

export function useReportDraft({ isOpen, initialPrefill, onDraftSaved }: UseReportDraftOptions) {
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
  const [compressionResult, setCompressionResult] = useState<CompressionResult | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [hasRestoredDraft, setHasRestoredDraft] = useState(false);
  const [formError, setFormError] = useState<ReportFormError | null>(null);

  const isFoundStudentId = reportType === 'found' && category === 'student_id';

  useEffect(() => {
    if (isFoundStudentId) {
      setHoldingLocation('security_main_gate');
      setCompressionResult(null);
    }
  }, [isFoundStudentId]);

  useEffect(() => {
    if (!isOpen) return;
    setFormError(null);
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
      if (!saved) return;
      const parsed = JSON.parse(saved);
      if (!parsed.title && !parsed.description) return;
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
    } catch {
      // Ignore corrupt draft storage
    }
  }, [isOpen, initialPrefill]);

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
        onDraftSaved();
      } catch {
        // Ignore storage quota or restricted storage
      }
    },
    [reportType, title, category, location, locationDetails, description, dateLostOrFound, holdingLocation, verificationQuestion, onDraftSaved]
  );

  const clearDraft = useCallback((resetFields = false) => {
    try {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch (err) {
      reportError('Clear draft storage failed', err);
    }
    setHasRestoredDraft(false);
    if (resetFields) {
      setTitle('');
      setDescription('');
      setVerificationQuestion('');
      setVerificationAnswer('');
    }
  }, []);

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
        setFormError(null);
        setCompressionResult(await compressImageFile(file, 800, 0.72));
      } catch (err: unknown) {
        setFormError({
          heading: 'Photo too large',
          detail: err instanceof Error ? err.message : 'Photo too large. Try a smaller JPEG, PNG, or WebP file.',
        });
      } finally {
        setIsCompressing(false);
      }
    },
    [isFoundStudentId]
  );

  return {
    reportType, setReportType,
    title, setTitle,
    category, setCategory,
    location, setLocation,
    locationDetails, setLocationDetails,
    description, setDescription,
    dateLostOrFound, setDateLostOrFound,
    holdingLocation, setHoldingLocation,
    verificationQuestion, setVerificationQuestion,
    verificationAnswer, setVerificationAnswer,
    compressionResult, setCompressionResult,
    isCompressing,
    hasRestoredDraft,
    formError, setFormError,
    isFoundStudentId,
    saveDraftLocally,
    clearDraft,
    handleImageChange,
  };
}
