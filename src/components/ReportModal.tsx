/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * NileFound Report Modal
 * Allows students to report lost or found items on campus.
 * Enforces strict PII blocking (matric numbers, phone numbers, emails)
 * and privacy safeguards for student ID cards.
 */

import React, { useState, useEffect } from 'react';
import { 
  X, 
  Upload, 
  CheckCircle, 
  AlertTriangle, 
  Save, 
  ShieldAlert,
  Lock
} from 'lucide-react';
import { CampusItem, ItemCategory, ItemType, HoldingLocation } from '../types/index.ts';
import { NILE_CAMPUS_LOCATIONS } from '../config/locations.ts';
import { CATEGORIES } from '../data/mockItems.ts';
import { compressImageFile, CompressionResult } from '../utils/imageCompressor.ts';
import { detectPii } from '../utils/piiDetector.ts';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitItem: (item: CampusItem) => void;
  onDraftSaved: () => void;
}

const DRAFT_STORAGE_KEY = 'nilefound_report_draft_v1';

export const ReportModal: React.FC<ReportModalProps> = ({
  isOpen,
  onClose,
  onSubmitItem,
  onDraftSaved
}) => {
  const [reportType, setReportType] = useState<ItemType>('lost');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<ItemCategory>('calculator');
  const [location, setLocation] = useState<string>(NILE_CAMPUS_LOCATIONS[0]);
  const [description, setDescription] = useState('');
  const [dateLostOrFound, setDateLostOrFound] = useState(() => new Date().toISOString().split('T')[0]);
  const [holdingLocation, setHoldingLocation] = useState<HoldingLocation>('finder_holding');
  const [verificationQuestion, setVerificationQuestion] = useState('');
  const [piiError, setPiiError] = useState<string | null>(null);
  
  // Image compression states
  const [compressionResult, setCompressionResult] = useState<CompressionResult | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [hasRestoredDraft, setHasRestoredDraft] = useState(false);

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
    const draft = {
      reportType,
      title,
      category,
      location,
      description,
      dateLostOrFound,
      holdingLocation: isFoundStudentId ? 'security_main_gate' : holdingLocation,
      verificationQuestion,
      savedAt: new Date().toISOString()
    };
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
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
    } catch {
      alert('Could not compress image. Please select a standard JPEG or PNG image.');
    } finally {
      setIsCompressing(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPiiError(null);

    if (!title.trim() || !description.trim()) return;

    // Check for PII (matric numbers, phone numbers, emails)
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
      verificationQuestion: reportType === 'found' ? verificationQuestion.trim() : undefined,
      reportedByEmailDomain: 'nileuniversity.edu.ng',
      createdAt: new Date().toISOString()
    };

    onSubmitItem(newItem);
    localStorage.removeItem(DRAFT_STORAGE_KEY);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden border border-emerald-950/10 my-6">
        {/* Header */}
        <div className="bg-emerald-900 text-white px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-base">Report an Item on Campus</h3>
          </div>
          <button
            onClick={onClose}
            className="text-emerald-200 hover:text-white transition-colors p-1 rounded-lg"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {hasRestoredDraft && (
            <div className="flex items-center justify-between text-xs bg-amber-50 text-amber-900 border border-amber-200 p-2.5 rounded-lg">
              <span className="flex items-center gap-1.5">
                <Save className="w-3.5 h-3.5 text-amber-600" />
                Restored unfinished draft from local storage
              </span>
              <button
                type="button"
                onClick={() => {
                  localStorage.removeItem(DRAFT_STORAGE_KEY);
                  setHasRestoredDraft(false);
                  setTitle('');
                  setDescription('');
                }}
                className="text-amber-700 font-bold underline hover:text-amber-900"
              >
                Clear
              </button>
            </div>
          )}

          {piiError && (
            <div className="bg-rose-50 border border-rose-300 text-rose-900 text-xs p-3 rounded-lg flex items-start gap-2 animate-shake">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-rose-950">Personal details detected</p>
                <p className="mt-0.5 text-rose-800">{piiError}</p>
              </div>
            </div>
          )}

          {/* Type Switcher: Lost vs Found */}
          <div className="grid grid-cols-2 gap-2 bg-stone-100 p-1 rounded-lg">
            <button
              type="button"
              onClick={() => {
                setReportType('lost');
                saveDraftLocally();
              }}
              className={`py-2 text-xs font-bold rounded-md transition-all ${
                reportType === 'lost'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-stone-700 hover:text-stone-900'
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
              className={`py-2 text-xs font-bold rounded-md transition-all ${
                reportType === 'found'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'text-stone-700 hover:text-stone-900'
              }`}
            >
              I Found Something
            </button>
          </div>

          {/* Found Student ID Card Warning */}
          {isFoundStudentId && (
            <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 text-xs text-amber-900 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-amber-950">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Student ID Protection Notice</span>
              </div>
              <p className="font-medium text-amber-900 leading-relaxed">
                Don't type the name or matric number. Hand the card to security.
              </p>
              <p className="text-[11px] text-amber-800">
                Custody will be set to Main Gate Security Post. Photos of ID cards are disabled.
              </p>
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1">
              Item Title: <span className="text-rose-500">*</span>
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
                reportType === 'lost'
                  ? "e.g. Casio fx-991EX with silver buttons"
                  : isFoundStudentId
                  ? "e.g. Student ID Card found near Ubangi House"
                  : "e.g. Black Oraimo 20000mAh Power Bank"
              }
              className="w-full text-xs px-3 py-2 rounded-lg border border-stone-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-600"
              required
            />
          </div>

          {/* Category & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                Category:
              </label>
              <select
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value as ItemCategory);
                  setPiiError(null);
                  saveDraftLocally();
                }}
                className="w-full text-xs px-2.5 py-2 rounded-lg border border-stone-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-600 bg-white"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                Date {reportType === 'lost' ? 'Lost' : 'Found'}:
              </label>
              <input
                type="date"
                value={dateLostOrFound}
                onChange={(e) => {
                  setDateLostOrFound(e.target.value);
                  saveDraftLocally();
                }}
                className="w-full text-xs px-3 py-2 rounded-lg border border-stone-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-600 bg-white"
                required
              />
            </div>
          </div>

          {/* Nile Campus Location - from single config src/config/locations.ts */}
          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1">
              Campus Location:
            </label>
            <select
              value={location}
              onChange={(e) => {
                setLocation(e.target.value);
                saveDraftLocally();
              }}
              className="w-full text-xs px-2.5 py-2 rounded-lg border border-stone-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-600 bg-white"
            >
              {NILE_CAMPUS_LOCATIONS.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1">
              Description & Identifying Marks: <span className="text-rose-500">*</span>
            </label>
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
                  ? "Describe where it was found (e.g. walkway, bench). Do NOT type names or matric numbers!"
                  : "Describe general color, model, and where you found it (DO NOT reveal secret details here!)"
              }
              className="w-full text-xs px-3 py-2 rounded-lg border border-stone-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-600"
              required
            />
          </div>

          {/* Found Items Specific Controls: Secret Verification Question & Holding Option */}
          {reportType === 'found' && (
            <div className="space-y-3 bg-emerald-50/70 border border-emerald-200/90 rounded-lg p-3.5">
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-emerald-950 font-bold text-xs">
                  <ShieldAlert className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Ask the owner one thing only they'd know</span>
                </div>
                <p className="text-[11px] text-emerald-800 leading-relaxed">
                  Pick a private detail not visible in any photo. Claimants must answer this correctly before contact details are unlocked.
                </p>

                {/* Tappable suggestion pills */}
                <div className="space-y-1 pt-1">
                  <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block">
                    Quick suggestions (tap to use):
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { label: "Phone wallpaper", text: "What image is set as the lock screen wallpaper?" },
                      { label: "Battery cover mark", text: "What scratch or sticker is inside the battery cover?" },
                      { label: "Inside pocket", text: "What small specific item is inside the front pocket?" },
                      { label: "Lanyard / key tag", text: "What text or color is on the lanyard or key ring?" }
                    ].map((sug, sIdx) => (
                      <button
                        key={sIdx}
                        type="button"
                        onClick={() => {
                          setVerificationQuestion(sug.text);
                          saveDraftLocally();
                        }}
                        className="text-[10px] bg-white text-emerald-900 border border-emerald-300 hover:border-emerald-600 px-2 py-1 rounded-md font-medium transition-colors"
                      >
                        + {sug.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-1 space-y-2">
                  <div>
                    <label className="block text-[11px] font-bold text-emerald-950 mb-0.5">
                      Your Question (Shown publicly to claimants):
                    </label>
                    <input
                      type="text"
                      value={verificationQuestion}
                      onChange={(e) => {
                        setVerificationQuestion(e.target.value);
                        saveDraftLocally();
                      }}
                      placeholder="e.g. What photo is on the lock screen? What initials are scratched on the back?"
                      className="w-full text-xs px-3 py-2 rounded-lg border border-emerald-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-600 bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-emerald-950 mb-0.5">
                      Expected Correct Answer (Private - only you & admin see this):
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. A black Mercedes logo / Initials AO"
                      className="w-full text-xs px-3 py-2 rounded-lg border border-emerald-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-600 bg-white"
                    />
                    <span className="text-[10px] text-emerald-700 mt-0.5 block">
                      🔒 Kept private. Claimant's answer will be compared against this.
                    </span>
                  </div>
                </div>
              </div>

              {/* Custody location */}
              <div>
                <label className="block text-xs font-bold text-emerald-950 mb-1">
                  Item Custody / Where is it now?
                </label>
                {isFoundStudentId ? (
                  <div className="bg-white border border-emerald-300 text-emerald-950 rounded-lg p-2.5 text-xs font-semibold">
                    Dropped at security desk (Enforced for Student ID cards)
                  </div>
                ) : (
                  <select
                    value={holdingLocation}
                    onChange={(e) => {
                      setHoldingLocation(e.target.value as HoldingLocation);
                      saveDraftLocally();
                    }}
                    className="w-full text-xs px-2.5 py-2 rounded-lg border border-emerald-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-600 bg-white"
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
            <div className="border border-stone-200 bg-stone-50 rounded-lg p-3 text-center text-xs text-stone-600">
              <Lock className="w-4 h-4 text-stone-400 mx-auto mb-1" />
              <p className="font-semibold text-stone-800">
                Photos of ID cards are not allowed to protect student privacy.
              </p>
              <p className="text-[11px] text-stone-500 mt-0.5">
                Hand the physical ID card to the Main Gate Security Post.
              </p>
            </div>
          ) : (
            <div className="border border-dashed border-stone-300 rounded-lg p-3 text-center bg-stone-50/50">
              <label className="cursor-pointer block">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                />
                <div className="flex flex-col items-center gap-1">
                  <Upload className="w-5 h-5 text-stone-500" />
                  <span className="text-xs font-semibold text-stone-700">
                    {compressionResult ? 'Change Photo' : 'Attach Photo (Optional)'}
                  </span>
                  <span className="text-[10px] text-stone-500">
                    ⚡ Client-side compressed to &lt; 100KB to save mobile data on 3G/4G
                  </span>
                </div>
              </label>

              {isCompressing && (
                <p className="text-xs text-emerald-700 font-medium mt-2 animate-pulse">
                  Compressing photo in browser RAM...
                </p>
              )}

              {compressionResult && (
                <div className="mt-3 flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded p-2 text-xs text-emerald-900 text-left">
                  <div className="flex items-center gap-2">
                    <img
                      src={compressionResult.dataUrl}
                      alt="Preview"
                      className="w-10 h-10 object-cover rounded border border-emerald-300"
                    />
                    <div>
                      <span className="font-bold block text-[11px] text-emerald-950">
                        Compressed: {compressionResult.compressedSizeKb} KB
                      </span>
                      <span className="text-[10px] text-emerald-700">
                        Down from {compressionResult.originalSizeKb} KB (-{compressionResult.reductionPercentage}%)
                      </span>
                    </div>
                  </div>
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                </div>
              )}
            </div>
          )}

          {/* Submission and Draft Action */}
          <div className="flex items-center justify-between pt-2 border-t border-stone-200">
            <button
              type="button"
              onClick={() => {
                saveDraftLocally();
                alert('Draft saved locally! If your network drops, your work is safe in browser storage.');
              }}
              className="text-xs font-medium text-stone-600 hover:text-stone-900 flex items-center gap-1"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Offline Draft</span>
            </button>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-2 text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className={`px-4 py-2 text-xs font-bold rounded-lg text-white shadow-xs transition-colors ${
                  reportType === 'lost' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-700 hover:bg-emerald-800'
                }`}
              >
                Publish {reportType === 'lost' ? 'Lost Report' : 'Found Item'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
