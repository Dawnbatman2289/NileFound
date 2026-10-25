/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * NileFound Item Reporting Modal
 * Layout: Multi-step-in-one form modal with offline draft auto-save and image compression.
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
import { CampusItem, ItemType, ItemCategory, HoldingLocation } from '../types/index.ts';
import { CATEGORIES } from '../data/mockItems.ts';
import { NILE_CAMPUS_LOCATIONS } from '../config/locations.ts';
import { detectPii } from '../utils/piiDetector.ts';
import { compressImageFile, CompressionResult } from '../utils/imageCompressor.ts';

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
  const [verificationAnswer, setVerificationAnswer] = useState('');
  const [piiError, setPiiError] = useState<string | null>(null);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  
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
    const draft = {
      reportType,
      title,
      category,
      location,
      description,
      dateLostOrFound,
      holdingLocation: isFoundStudentId ? 'security_main_gate' : holdingLocation,
      verificationQuestion,
      verificationAnswer,
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
    } catch (err) {
      console.error('Error compressing image:', err);
    } finally {
      setIsCompressing(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
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

    onSubmitItem(newItem);
    localStorage.removeItem(DRAFT_STORAGE_KEY);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 my-6">
        {/* Header */}
        <div className="bg-blue-900 text-white px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-base">Report an Item on Campus</h3>
          </div>
          <button
            onClick={onClose}
            className="text-blue-200 hover:text-white transition-colors p-1 rounded-lg"
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
                  setVerificationQuestion('');
                  setVerificationAnswer('');
                }}
                className="text-amber-700 font-bold underline hover:text-amber-900"
              >
                Clear
              </button>
            </div>
          )}

          {saveNotice && (
            <div className="text-xs bg-blue-50 text-blue-900 border border-blue-200 p-2 rounded-lg flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-blue-700" />
              <span>{saveNotice}</span>
            </div>
          )}

          {piiError && (
            <div className="bg-rose-50 border border-rose-300 text-rose-900 text-xs p-3 rounded-lg flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-rose-950">Personal details detected</p>
                <p className="mt-0.5 text-rose-800">{piiError}</p>
              </div>
            </div>
          )}

          {/* Type Switcher: Lost vs Found */}
          <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-lg">
            <button
              type="button"
              onClick={() => {
                setReportType('lost');
                saveDraftLocally();
              }}
              className={`py-2 text-xs font-bold rounded-md transition-all ${
                reportType === 'lost'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-slate-700 hover:text-slate-900'
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
                  ? 'bg-blue-900 text-white shadow-xs'
                  : 'text-slate-700 hover:text-slate-900'
              }`}
            >
              I Found Something
            </button>
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Item Category: <span className="text-rose-500">*</span>
            </label>
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value as ItemCategory);
                saveDraftLocally();
              }}
              className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-800 bg-white"
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
            <div className="bg-amber-50 border-l-4 border-amber-500 p-3 rounded-r-lg space-y-1">
              <div className="flex items-center gap-1.5 text-amber-900 font-bold text-xs">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Found Student ID Card Protocol</span>
              </div>
              <p className="text-xs text-amber-800 leading-relaxed">
                Do not type the student's name or matric number into any field. Hand the physical card to the Main Gate Security Post immediately.
              </p>
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
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
                isFoundStudentId
                  ? 'A student ID card was found'
                  : reportType === 'lost'
                  ? 'e.g. Casio fx-991EX Calculator with red sticker'
                  : 'e.g. Black Anker 20,000mAh Power Bank'
              }
              className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-800"
              required
            />
          </div>

          {/* Location and Date Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Campus Location: <span className="text-rose-500">*</span>
              </label>
              <select
                value={location}
                onChange={(e) => {
                  setLocation(e.target.value);
                  saveDraftLocally();
                }}
                className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-800 bg-white"
              >
                {NILE_CAMPUS_LOCATIONS.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Date {reportType === 'lost' ? 'Lost' : 'Found'}:
              </label>
              <input
                type="date"
                value={dateLostOrFound}
                onChange={(e) => {
                  setDateLostOrFound(e.target.value);
                  saveDraftLocally();
                }}
                className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-800"
                required
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-slate-700">
                Detailed Description: <span className="text-rose-500">*</span>
              </label>
              <span className="text-[10px] text-slate-500">No phone numbers or matric numbers</span>
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
              className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-800"
              required
            />
          </div>

          {/* Found Items: Anti-fraud verification question & custody */}
          {reportType === 'found' && (
            <div className="space-y-3 bg-blue-50/70 border border-blue-200 rounded-lg p-3.5">
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-blue-950 font-bold text-xs">
                  <ShieldAlert className="w-3.5 h-3.5 text-blue-800" />
                  <span>Ask the owner one thing only they would know</span>
                </div>
                <p className="text-[11px] text-blue-900 leading-relaxed">
                  Pick a private detail not visible in any photo. Claimants must answer this correctly before contact details are released.
                </p>

                {/* Suggestions */}
                <div className="space-y-1 pt-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
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
                        className="text-[10px] bg-white text-blue-950 border border-blue-300 hover:border-blue-700 px-2 py-1 rounded-md font-medium transition-colors"
                      >
                        + {sug.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-1 space-y-2">
                  <div>
                    <label className="block text-[11px] font-bold text-blue-950 mb-0.5">
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
                      className="w-full text-xs px-3 py-2 rounded-lg border border-blue-300 focus:outline-hidden focus:ring-2 focus:ring-blue-800 bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-blue-950 mb-0.5">
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
                      className="w-full text-xs px-3 py-2 rounded-lg border border-blue-300 focus:outline-hidden focus:ring-2 focus:ring-blue-800 bg-white"
                    />
                    <span className="text-[10px] text-blue-800 mt-0.5 block">
                      Protected in a private subcollection. Never sent to other students browsing the feed.
                    </span>
                  </div>
                </div>
              </div>

              {/* Custody location */}
              <div>
                <label className="block text-xs font-bold text-blue-950 mb-1">
                  Item Physical Custody:
                </label>
                {isFoundStudentId ? (
                  <div className="bg-white border border-blue-300 text-blue-950 rounded-lg p-2.5 text-xs font-semibold">
                    Dropped at Main Gate Security Post (Mandatory for student IDs)
                  </div>
                ) : (
                  <select
                    value={holdingLocation}
                    onChange={(e) => {
                      setHoldingLocation(e.target.value as HoldingLocation);
                      saveDraftLocally();
                    }}
                    className="w-full text-xs px-2.5 py-2 rounded-lg border border-blue-300 focus:outline-hidden focus:ring-2 focus:ring-blue-800 bg-white"
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
            <div className="border border-slate-200 bg-slate-50 rounded-lg p-3 text-center text-xs text-slate-600">
              <Lock className="w-4 h-4 text-slate-400 mx-auto mb-1" />
              <p className="font-semibold text-slate-800">
                Photos of student ID cards are prohibited.
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Hand the physical ID card to the Main Gate Security Post.
              </p>
            </div>
          ) : (
            <div className="border border-dashed border-slate-300 rounded-lg p-3 text-center bg-slate-50/50">
              <label className="cursor-pointer block">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                />
                <div className="flex flex-col items-center gap-1">
                  <Upload className="w-5 h-5 text-slate-500" />
                  <span className="text-xs font-semibold text-slate-700">
                    {compressionResult ? 'Change Photo' : 'Attach Photo (Optional)'}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    Client-side compressed under 100KB to conserve mobile data
                  </span>
                </div>
              </label>

              {isCompressing && (
                <p className="text-xs text-blue-700 font-medium mt-2 animate-pulse">
                  Compressing photo in device memory...
                </p>
              )}

              {compressionResult && (
                <div className="mt-3 flex items-center justify-between bg-blue-50 border border-blue-200 rounded p-2 text-xs text-blue-900 text-left">
                  <div className="flex items-center gap-2">
                    <img
                      src={compressionResult.dataUrl}
                      alt="Preview"
                      className="w-10 h-10 object-cover rounded border border-blue-300"
                    />
                    <div>
                      <span className="font-bold block text-[11px] text-blue-950">
                        Compressed: {compressionResult.compressedSizeKb} KB
                      </span>
                      <span className="text-[10px] text-blue-700">
                        Reduced from {compressionResult.originalSizeKb} KB (-{compressionResult.reductionPercentage}%)
                      </span>
                    </div>
                  </div>
                  <CheckCircle className="w-4 h-4 text-blue-600 shrink-0" />
                </div>
              )}
            </div>
          )}

          {/* Submission and Draft Action */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => {
                saveDraftLocally();
                setSaveNotice('Draft saved to browser storage.');
                setTimeout(() => setSaveNotice(null), 3000);
              }}
              className="text-xs font-medium text-slate-600 hover:text-slate-900 flex items-center gap-1"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Offline Draft</span>
            </button>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className={`px-4 py-2 text-xs font-bold rounded-lg text-white shadow-xs transition-colors ${
                  reportType === 'lost' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-blue-900 hover:bg-blue-800'
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
