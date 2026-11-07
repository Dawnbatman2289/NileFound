/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * NileFound Item Reporting Modal
 * Layout: Multi-step-in-one form modal with offline draft auto-save and image compression in Deep Navy (#0B1020) and Electric Lime (#C6FF3D).
 * Main Action: Report a lost or found item on the Nile University campus.
 */

import React, { useState, useEffect } from 'react';
import { 
  X, 
  Upload, 
  MapPin, 
  Calendar, 
  Save, 
  AlertTriangle, 
  Lock, 
  CheckCircle,
  HelpCircle,
  ShieldAlert
} from 'lucide-react';
import { CampusItem, ItemType, ItemCategory, HoldingLocation, User, UserRole } from '../types/index.ts';
import { CATEGORIES } from '../data/mockItems.ts';
import { NILE_CAMPUS_LOCATIONS } from '../config/locations.ts';
import { detectPii } from '../utils/piiDetector.ts';
import { compressImageFile, CompressionResult } from '../utils/imageCompressor.ts';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitItem: (item: CampusItem) => Promise<boolean> | void;
  onDraftSaved: () => void;
  currentUser?: User | null;
  onLogin?: (user: User) => void;
  onOpenLogin?: () => void;
}

const DRAFT_STORAGE_KEY = 'nilefound_report_draft_v1';

export const ReportModal: React.FC<ReportModalProps> = ({
  isOpen,
  onClose,
  onSubmitItem,
  onDraftSaved,
  currentUser,
  onOpenLogin,
}) => {
  const [reportType, setReportType] = useState<ItemType>('lost');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<ItemCategory>('calculator');
  const [location, setLocation] = useState<string>(NILE_CAMPUS_LOCATIONS[0]);
  const [description, setDescription] = useState('');
  const [dateLostOrFound, setDateLostOrFound] = useState(() => new Date().toISOString().split('T')[0]);
  const [holdingLocation, setHoldingLocation] = useState<HoldingLocation>('finder_holding');
  const [verificationQuestion, setVerificationQuestion] = useState('');
  const [verificationAnswer, setVerificationAnswer] = useState('');
  const [piiError, setPiiError] = useState<string | null>(null);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  
  // Image compression states
  const [compressionResult, setCompressionResult] = useState<CompressionResult | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [hasRestoredDraft, setHasRestoredDraft] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);

  // If found student ID card is chosen, enforce security gate holding
  const isFoundStudentId = reportType === 'found' && category === 'student_id';

  useEffect(() => {
    if (isFoundStudentId) {
      setHoldingLocation('security_main_gate');
      setCompressionResult(null);
    }
  }, [isFoundStudentId]);

  // Load draft on mount
  useEffect(() => {
    if (isOpen) {
      setPiiError(null);
      setSaveNotice(null);
      const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed.title || parsed.description) {
            setReportType(parsed.reportType || 'lost');
            setTitle(parsed.title || '');
            setCategory(parsed.category || 'calculator');
            setLocation(parsed.location || NILE_CAMPUS_LOCATIONS[0]);
            setDescription(parsed.description || '');
            setDateLostOrFound(parsed.dateLostOrFound || new Date().toISOString().split('T')[0]);
            setHoldingLocation(parsed.holdingLocation || 'finder_holding');
            setVerificationQuestion(parsed.verificationQuestion || '');
            setVerificationAnswer(parsed.verificationAnswer || '');
            setHasRestoredDraft(true);
          }
        } catch {
          // Ignore json parse error
        }
      }
    }
  }, [isOpen]);

  // Auto-save draft
  const saveDraftLocally = () => {
    const draftData = {
      reportType,
      title,
      category,
      location,
      description,
      dateLostOrFound,
      holdingLocation,
      verificationQuestion,
      verificationAnswer
    };
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draftData));
    onDraftSaved();
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (isFoundStudentId) {
      return;
    }

    try {
      setIsCompressing(true);
      // Client-side compression target < 100KB
      const result = await compressImageFile(file, 800, 0.7);
      setCompressionResult(result);
    } catch (err) {
      console.error('Error compressing image:', err);
    } finally {
      setIsCompressing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPiiError(null);

    // Rule 1: Check PII in title, description, and verification question
    const titlePii = detectPii(title);
    if (titlePii.hasPii) {
      setPiiError(titlePii.errorMessage || 'Remove personal details before submitting.');
      return;
    }

    const descPii = detectPii(description);
    if (descPii.hasPii) {
      setPiiError(descPii.errorMessage || 'Remove personal details before submitting.');
      return;
    }

    if (verificationQuestion.trim()) {
      const qPii = detectPii(verificationQuestion);
      if (qPii.hasPii) {
        setPiiError(qPii.errorMessage || 'Remove personal details before submitting.');
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
      dateLostOrFound,
      status: 'open',
      holdingLocation: effectiveHoldingLocation,
      imageUrl: isFoundStudentId ? undefined : (compressionResult ? compressionResult.dataUrl : undefined),
      isSensitiveId: category === 'student_id',
      verificationQuestion: reportType === 'found' && verificationQuestion.trim() ? verificationQuestion.trim() : undefined,
      verificationAnswerHash: reportType === 'found' && verificationAnswer.trim() ? verificationAnswer.trim() : undefined,
      reportedByEmailDomain: 'nileuniversity.edu.ng',
      createdAt: new Date().toISOString()
    };

    if (!currentUser) {
      onOpenLogin?.();
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmitItem(newItem);
      localStorage.removeItem(DRAFT_STORAGE_KEY);
      onClose();
    } catch (err: any) {
      console.error('Error submitting item:', err);
      setPiiError(err?.message || 'Could not save report to campus database. Your draft is saved.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-[480px] bg-white dark:bg-[#1E1C18] text-[#1F1B16] dark:text-[#F5F1EA] rounded-[12px] shadow-xl max-h-[100dvh] overflow-hidden border border-[#E6DFD2] dark:border-[#2E2A24] my-3 sm:my-6 flex flex-col min-w-0">
        {/* Header */}
        <div className="bg-[#FAF6EF] dark:bg-[#141311] px-5 sm:px-6 py-4 border-b border-[#E6DFD2] dark:border-[#2E2A24] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="font-serif font-bold text-base tracking-tight text-[#1F1B16] dark:text-[#F5F1EA]">
              Report an Item on Campus
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-[#7A7266] hover:text-[#1F1B16] dark:hover:text-[#F5F1EA] transition-colors p-1 rounded-[6px] cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 min-h-0 flex-1 overflow-y-auto">
          {/* Sign In Awareness Banner */}
          {currentUser ? (
            <div className="bg-[#FAF6EF] dark:bg-[#141311] border border-[#E6DFD2] dark:border-[#2E2A24] px-3.5 py-2.5 rounded-[10px] text-xs flex items-center justify-between">
              <span className="text-[#544E45] dark:text-[#B8B0A2]">Reporting as:</span>
              <span className="font-medium text-[#0F6E6E] dark:text-[#199595] flex items-center gap-1.5 truncate">
                <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{currentUser.name}</span>
              </span>
            </div>
          ) : (
            <div className="bg-[#FAF6EF] dark:bg-[#141311] border border-[#E6DFD2] dark:border-[#2E2A24] p-3.5 rounded-[10px] text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-[#0F6E6E] dark:text-[#199595] shrink-0" />
                <span className="text-[#544E45] dark:text-[#B8B0A2]">
                  Sign in required to publish notices and get notification updates.
                </span>
              </div>
              <button
                type="button"
                onClick={async () => {
                  setIsSigningIn(true);
                  try {
                    onOpenLogin?.();
                  } catch (err: any) {
                    console.warn('Sign-in cancelled or failed:', err);
                  } finally {
                    setIsSigningIn(false);
                  }
                }}
                disabled={isSigningIn}
                className="bg-[#0F6E6E] hover:bg-[#0C5656] disabled:opacity-50 text-white px-3.5 py-1.5 rounded-[10px] font-medium text-xs shrink-0 cursor-pointer shadow-xs active:scale-98 transition-colors text-center btn-campus"
              >
                Open sign-in
              </button>
            </div>
          )}
          {hasRestoredDraft && (
            <div className="flex items-center justify-between text-xs bg-amber-400/10 text-amber-300 border border-amber-400/30 p-3 rounded-xl">
              <span className="flex items-center gap-2">
                <Save className="w-3.5 h-3.5 text-amber-400" />
                Restored unfinished draft from local storage
              </span>
              <button
                type="button"
                onClick={() => {
                  localStorage.removeItem(DRAFT_STORAGE_KEY);
                  setHasRestoredDraft(false);
                  setTitle('');
                  setDescription('');
                  setVerificationQuestion('');
                  setVerificationAnswer('');
                }}
                className="text-amber-300 font-bold underline hover:text-white cursor-pointer"
              >
                Clear
              </button>
            </div>
          )}

          {saveNotice && (
            <div className="text-xs bg-[#C6FF3D]/10 text-[#C6FF3D] border border-[#C6FF3D]/30 p-3 rounded-xl flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-[#C6FF3D]" />
              <span>{saveNotice}</span>
            </div>
          )}

          {piiError && (
            <div className="bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs p-3.5 rounded-xl flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-rose-200">Personal details detected</p>
                <p className="mt-0.5 text-rose-300">{piiError}</p>
              </div>
            </div>
          )}

          {/* Type Switcher: Lost vs Found */}
          <div className="grid grid-cols-2 gap-2 bg-[#FAF6EF] dark:bg-[#141311] p-1.5 rounded-[10px] border border-[#E6DFD2] dark:border-[#2E2A24]">
            <button
              type="button"
              onClick={() => {
                setReportType('lost');
                saveDraftLocally();
              }}
              className={`py-2 text-xs font-semibold rounded-[8px] transition-colors min-h-[44px] cursor-pointer btn-campus ${
                reportType === 'lost'
                  ? 'bg-[#E8A317] text-[#1F1B16] shadow-xs'
                  : 'text-[#544E45] dark:text-[#B8B0A2] hover:text-[#1F1B16]'
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
              className={`py-2 text-xs font-semibold rounded-[8px] transition-colors min-h-[44px] cursor-pointer btn-campus ${
                reportType === 'found'
                  ? 'bg-[#2F7D4F] text-white shadow-xs'
                  : 'text-[#544E45] dark:text-[#B8B0A2] hover:text-[#1F1B16]'
              }`}
            >
              I Found Something
            </button>
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-medium text-[#544E45] dark:text-[#B8B0A2] mb-1.5">
              Item Category: <span className="text-[#0F6E6E]">*</span>
            </label>
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value as ItemCategory);
                saveDraftLocally();
              }}
              className="w-full text-xs px-3.5 py-2.5 rounded-[10px] border border-[#E6DFD2] dark:border-[#2E2A24] bg-white dark:bg-[#141311] text-[#1F1B16] dark:text-[#F5F1EA] focus:border-[#0F6E6E] focus:outline-hidden min-h-[44px] cursor-pointer"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          {/* Special Warning for ID Cards */}
          {isFoundStudentId && (
            <div className="bg-[#FEF7E9] dark:bg-[#2B210A] border border-[#E8A317]/40 p-3.5 rounded-[10px] space-y-1">
              <div className="flex items-center gap-2 text-[#7A5000] dark:text-[#F9CF7C] font-semibold text-xs">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Found Student ID Card Protocol</span>
              </div>
              <p className="text-xs text-[#7A5000] dark:text-[#F9CF7C] leading-relaxed">
                Do not type the student's name or matric number into any field. Hand the physical card to the Main Gate Security Post immediately.
              </p>
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-[#544E45] dark:text-[#B8B0A2] mb-1.5">
              Item Title: <span className="text-[#0F6E6E]">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setPiiError(null);
                saveDraftLocally();
              }}
              placeholder={
                isFoundStudentId
                  ? 'A student ID card was found'
                  : reportType === 'lost'
                  ? 'e.g. Casio fx-991EX Calculator with red sticker'
                  : 'e.g. Black Anker 20,000mAh Power Bank'
              }
              className="w-full text-xs px-3.5 py-2.5 rounded-[10px] border border-[#E6DFD2] dark:border-[#2E2A24] bg-white dark:bg-[#141311] text-[#1F1B16] dark:text-[#F5F1EA] focus:border-[#0F6E6E] focus:outline-hidden min-h-[44px]"
              required
            />
          </div>

          {/* Location and Date Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#544E45] dark:text-[#B8B0A2] mb-1.5">
                Campus Location: <span className="text-[#0F6E6E]">*</span>
              </label>
              <select
                value={location}
                onChange={(e) => {
                  setLocation(e.target.value);
                  saveDraftLocally();
                }}
                className="w-full text-xs px-3.5 py-2.5 rounded-[10px] border border-[#E6DFD2] dark:border-[#2E2A24] bg-white dark:bg-[#141311] text-[#1F1B16] dark:text-[#F5F1EA] focus:border-[#0F6E6E] focus:outline-hidden min-h-[44px] cursor-pointer"
              >
                {NILE_CAMPUS_LOCATIONS.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#544E45] dark:text-[#B8B0A2] mb-1.5">
                Date {reportType === 'lost' ? 'Lost' : 'Found'}:
              </label>
              <input
                type="date"
                value={dateLostOrFound}
                onChange={(e) => {
                  setDateLostOrFound(e.target.value);
                  saveDraftLocally();
                }}
                className="w-full text-xs px-3.5 py-2.5 rounded-[10px] border border-[#E6DFD2] dark:border-[#2E2A24] bg-white dark:bg-[#141311] text-[#1F1B16] dark:text-[#F5F1EA] focus:border-[#0F6E6E] focus:outline-hidden min-h-[44px]"
                required
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-medium text-[#544E45] dark:text-[#B8B0A2]">
                Detailed Description: <span className="text-[#0F6E6E]">*</span>
              </label>
              <span className="text-[10px] text-[#7A7266] dark:text-[#857D71]">No phone numbers or matric numbers</span>
            </div>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                setPiiError(null);
                saveDraftLocally();
              }}
              placeholder={
                reportType === 'lost'
                  ? "Describe physical condition, stickers, case color, where you last had it..."
                  : isFoundStudentId
                  ? "Describe where on campus it was found. Do NOT type names or matric numbers!"
                  : "Describe general color, model, and location found (do not reveal private hidden marks here)."
              }
              className="w-full text-xs px-3.5 py-2.5 rounded-[10px] border border-[#E6DFD2] dark:border-[#2E2A24] bg-white dark:bg-[#141311] text-[#1F1B16] dark:text-[#F5F1EA] focus:border-[#0F6E6E] focus:outline-hidden"
              required
            />
          </div>

          {/* Found Items: Anti-fraud verification question & custody */}
          {reportType === 'found' && (
            <div className="space-y-3.5 bg-[#FAF6EF] dark:bg-[#141311] border border-[#E6DFD2] dark:border-[#2E2A24] rounded-[10px] p-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-[#0F6E6E] dark:text-[#199595] font-semibold text-xs">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span>Ask the owner one thing only they would know</span>
                </div>
                <p className="text-[11px] text-[#544E45] dark:text-[#B8B0A2] leading-relaxed">
                  Pick a private detail not visible in any photo. Claimants must answer this correctly before contact details are released.
                </p>

                {/* Suggestions */}
                <div className="space-y-1.5 pt-1">
                  <span className="text-[10px] font-medium text-[#7A7266] dark:text-[#857D71] block">
                    Quick suggestions:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { label: "Phone wallpaper", text: "What image is set as the lock screen wallpaper?" },
                      { label: "Cover mark", text: "What scratch or sticker is on the back or inside cover?" },
                      { label: "Inside pocket", text: "What small specific item is inside the front compartment?" },
                      { label: "Keychain text", text: "What text or initials are on the key ring?" }
                    ].map((sug, sIdx) => (
                      <button
                        key={sIdx}
                        type="button"
                        onClick={() => {
                          setVerificationQuestion(sug.text);
                          saveDraftLocally();
                        }}
                        className="text-[10px] bg-white dark:bg-[#1E1C18] text-[#544E45] dark:text-[#B8B0A2] border border-[#E6DFD2] dark:border-[#2E2A24] hover:border-[#0F6E6E] hover:text-[#0F6E6E] px-2.5 py-1 rounded-[6px] font-medium transition-colors cursor-pointer btn-campus"
                      >
                        + {sug.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-2 space-y-3">
                  <div>
                    <label className="block text-[11px] font-medium text-[#544E45] dark:text-[#B8B0A2] mb-1">
                      Your Question (Shown to claimants):
                    </label>
                    <input
                      type="text"
                      value={verificationQuestion}
                      onChange={(e) => {
                        setVerificationQuestion(e.target.value);
                        saveDraftLocally();
                      }}
                      placeholder="e.g. What image is on the lock screen?"
                      className="w-full text-xs px-3.5 py-2.5 rounded-[10px] border border-[#E6DFD2] dark:border-[#2E2A24] bg-white dark:bg-[#1E1C18] text-[#1F1B16] dark:text-[#F5F1EA] focus:border-[#0F6E6E] focus:outline-hidden min-h-[44px]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-[#544E45] dark:text-[#B8B0A2] mb-1">
                      Correct Answer (Private - only you and security/admin can see this):
                    </label>
                    <input
                      type="text"
                      value={verificationAnswer}
                      onChange={(e) => {
                        setVerificationAnswer(e.target.value);
                        saveDraftLocally();
                      }}
                      placeholder="e.g. A photo of a black car with Abuja plate"
                      className="w-full text-xs px-3.5 py-2.5 rounded-[10px] border border-[#E6DFD2] dark:border-[#2E2A24] bg-white dark:bg-[#1E1C18] text-[#1F1B16] dark:text-[#F5F1EA] focus:border-[#0F6E6E] focus:outline-hidden min-h-[44px]"
                    />
                    <span className="text-[10px] text-[#7A7266] dark:text-[#857D71] mt-1 block">
                      Protected in a private subcollection. Never sent to other students browsing the feed.
                    </span>
                  </div>
                </div>
              </div>

              {/* Custody location */}
              <div className="pt-2 border-t border-[#E6DFD2] dark:border-[#2E2A24]">
                <label className="block text-xs font-medium text-[#544E45] dark:text-[#B8B0A2] mb-1.5">
                  Item Physical Custody:
                </label>
                {isFoundStudentId ? (
                  <div className="bg-white dark:bg-[#1E1C18] border border-[#E6DFD2] dark:border-[#2E2A24] text-[#0F6E6E] dark:text-[#199595] rounded-[10px] p-3 text-xs font-medium">
                    Dropped at Main Gate Security Post (Mandatory for student IDs)
                  </div>
                ) : (
                  <select
                    value={holdingLocation}
                    onChange={(e) => {
                      setHoldingLocation(e.target.value as HoldingLocation);
                      saveDraftLocally();
                    }}
                    className="w-full text-xs px-3.5 py-2.5 rounded-[10px] border border-[#E6DFD2] dark:border-[#2E2A24] bg-white dark:bg-[#1E1C18] text-[#1F1B16] dark:text-[#F5F1EA] focus:border-[#0F6E6E] focus:outline-hidden min-h-[44px] cursor-pointer"
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

          {/* Photo Upload: Disabled for Found ID cards */}
          {isFoundStudentId ? (
            <div className="border border-[#E6DFD2] dark:border-[#2E2A24] bg-[#FAF6EF] dark:bg-[#141311] rounded-[10px] p-4 text-center text-xs text-[#7A7266] dark:text-[#857D71]">
              <Lock className="w-5 h-5 text-[#7A7266] mx-auto mb-1.5" />
              <p className="font-medium text-[#1F1B16] dark:text-[#F5F1EA]">
                Photos of student ID cards are prohibited.
              </p>
              <p className="text-[11px] text-[#7A7266] dark:text-[#857D71] mt-0.5">
                Hand the physical ID card to the Main Gate Security Post.
              </p>
            </div>
          ) : (
            <div className="border border-dashed border-[#E6DFD2] dark:border-[#2E2A24] hover:border-[#0F6E6E] rounded-[10px] p-4 text-center bg-[#FAF6EF]/40 dark:bg-[#141311]/40 transition-colors">
              <label className="cursor-pointer block">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                />
                <div className="flex flex-col items-center gap-1.5">
                  <Upload className="w-6 h-6 text-[#0F6E6E] dark:text-[#199595]" />
                  <span className="text-xs font-medium text-[#1F1B16] dark:text-[#F5F1EA]">
                    {compressionResult ? 'Change Photo' : 'Attach Photo (Optional)'}
                  </span>
                  <span className="text-[10px] text-[#7A7266] dark:text-[#857D71]">
                    Client-side compressed under 100KB to conserve mobile data
                  </span>
                </div>
              </label>

              {isCompressing && (
                <p className="text-xs text-[#0F6E6E] dark:text-[#199595] font-medium mt-2">
                  Compressing photo in device memory...
                </p>
              )}

              {compressionResult && (
                <div className="mt-3 flex items-center justify-between bg-white dark:bg-[#1E1C18] border border-[#E6DFD2] dark:border-[#2E2A24] rounded-[10px] p-3 text-xs text-[#1F1B16] dark:text-[#F5F1EA] text-left">
                  <div className="flex items-center gap-3">
                    <img
                      src={compressionResult.dataUrl}
                      alt="Preview"
                      className="w-12 h-12 object-cover rounded-[8px] border border-[#E6DFD2] dark:border-[#2E2A24]"
                    />
                    <div>
                      <span className="font-semibold block text-xs">
                        Compressed: {compressionResult.compressedSizeKb} KB
                      </span>
                      <span className="text-[10px] text-[#7A7266] dark:text-[#857D71]">
                        Reduced from {compressionResult.originalSizeKb} KB (-{compressionResult.reductionPercentage}%)
                      </span>
                    </div>
                  </div>
                  <CheckCircle className="w-5 h-5 text-[#2F7D4F] shrink-0" />
                </div>
              )}
            </div>
          )}

          {/* Submission and Draft Action */}
          <div className="flex items-center justify-between pt-3 border-t border-[#E6DFD2] dark:border-[#2E2A24]">
            <button
              type="button"
              onClick={() => {
                saveDraftLocally();
                setSaveNotice('Draft saved to browser storage.');
                setTimeout(() => setSaveNotice(null), 3000);
              }}
              className="text-xs font-medium text-[#7A7266] hover:text-[#0F6E6E] dark:hover:text-[#199595] flex items-center gap-1.5 cursor-pointer min-h-[44px] py-2"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Offline Draft</span>
            </button>

            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-[#544E45] dark:text-[#B8B0A2] hover:text-[#1F1B16] dark:hover:text-[#F5F1EA] bg-white dark:bg-[#28241F] rounded-[10px] border border-[#E6DFD2] dark:border-[#2E2A24] transition-colors min-h-[44px] cursor-pointer btn-campus"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || isCompressing || isSigningIn}
                className={`px-5 py-2 text-xs font-semibold rounded-[10px] transition-colors min-h-[44px] cursor-pointer shadow-xs disabled:opacity-50 btn-campus ${
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
                  ? `Sign in & Post ${reportType === 'lost' ? 'Lost Notice' : 'Found Notice'}`
                  : `Post ${reportType === 'lost' ? 'Lost Notice' : 'Found Notice'}`}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
