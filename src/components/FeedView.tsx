/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * NileFound Campus Feed
 * Displays searchable campus lost & found listings with privacy protections
 * for student ID cards and dates formatted in DD/MM/YYYY.
 */

import React, { useState, useMemo } from 'react';
import { 
  Search, 
  MapPin, 
  Calendar, 
  ShieldCheck, 
  AlertCircle, 
  Lock, 
  Sparkles, 
  Building2, 
  Filter,
  CheckCircle2,
  Shield
} from 'lucide-react';
import { CampusItem, ItemType } from '../types/index.ts';
import { CATEGORIES } from '../data/mockItems.ts';
import { NILE_CAMPUS_LOCATIONS } from '../config/locations.ts';
import { calculateMatchScore } from '../utils/matching.ts';
import { formatDateDDMMYYYY } from '../utils/dateFormatter.ts';

interface FeedViewProps {
  items: CampusItem[];
  lowDataMode: boolean;
  onClaimItem: (item: CampusItem) => void;
  onOpenReportModal: () => void;
}

export const FeedView: React.FC<FeedViewProps> = ({
  items,
  lowDataMode,
  onClaimItem,
  onOpenReportModal
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<'all' | ItemType>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedLocation, setSelectedLocation] = useState<string>('all');
  const [selectedLostItemForMatch, setSelectedLostItemForMatch] = useState<CampusItem | null>(null);

  // Filter items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (selectedType !== 'all' && item.type !== selectedType) return false;
      if (selectedCategory !== 'all' && item.category !== selectedCategory) return false;
      if (selectedLocation !== 'all' && item.location !== selectedLocation) return false;
      
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const isFoundIdCard = item.type === 'found' && item.category === 'student_id';
        const displayTitle = isFoundIdCard ? 'A student ID card was found' : item.title;
        const matchTitle = displayTitle.toLowerCase().includes(query);
        const matchDesc = item.description.toLowerCase().includes(query);
        const matchLoc = item.location.toLowerCase().includes(query);
        if (!matchTitle && !matchDesc && !matchLoc) return false;
      }
      return true;
    });
  }, [items, selectedType, selectedCategory, selectedLocation, searchTerm]);

  // Separate lost vs found
  const lostItems = useMemo(() => items.filter(i => i.type === 'lost'), [items]);
  const foundItems = useMemo(() => items.filter(i => i.type === 'found'), [items]);

  // Matches for the selected lost item
  const matchResults = useMemo(() => {
    if (!selectedLostItemForMatch) return [];
    return foundItems
      .map(found => ({
        foundItem: found,
        result: calculateMatchScore(selectedLostItemForMatch, found)
      }))
      .filter(m => m.result.score >= 30)
      .sort((a, b) => b.result.score - a.result.score);
  }, [selectedLostItemForMatch, foundItems]);

  return (
    <div className="space-y-6">
      {/* Search & Filter Header */}
      <div className="bg-white rounded-xl shadow-xs border border-stone-200 p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-2.5">
          {/* Search Bar */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by keyword, item name, or building..."
              className="w-full text-xs pl-9 pr-3 py-2.5 rounded-lg border border-stone-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-600 bg-stone-50/50"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 text-xs font-bold"
              >
                ✕
              </button>
            )}
          </div>

          {/* Type Filter Buttons */}
          <div className="flex bg-stone-100 p-1 rounded-lg shrink-0">
            <button
              onClick={() => setSelectedType('all')}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                selectedType === 'all'
                  ? 'bg-white text-stone-900 shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              All ({items.length})
            </button>
            <button
              onClick={() => setSelectedType('found')}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                selectedType === 'found'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Found ({foundItems.length})
            </button>
            <button
              onClick={() => setSelectedType('lost')}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                selectedType === 'lost'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              Lost ({lostItems.length})
            </button>
          </div>
        </div>

        {/* Dropdown Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-stone-100">
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-stone-400 shrink-0" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full text-xs py-1.5 px-2 rounded-md border border-stone-200 bg-white focus:ring-1 focus:ring-emerald-600"
            >
              <option value="all">All Categories</option>
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-stone-400 shrink-0" />
            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="w-full text-xs py-1.5 px-2 rounded-md border border-stone-200 bg-white focus:ring-1 focus:ring-emerald-600"
            >
              <option value="all">All Nile Campus Locations</option>
              {NILE_CAMPUS_LOCATIONS.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Match Suggestion Panel: only when lost items exist */}
      {lostItems.length > 0 && (
        <div className="bg-emerald-950 text-white rounded-xl p-4 shadow-xs border border-emerald-900">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-amber-300 font-bold text-xs uppercase tracking-wide">
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>Deterministic Campus Match Suggestions</span>
              </div>
              <p className="text-xs text-emerald-100/90 leading-relaxed max-w-xl">
                Rule-based algorithm compares category, campus zone, and date window with zero API overhead.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={selectedLostItemForMatch?.id || ''}
                onChange={(e) => {
                  const itm = lostItems.find((l) => l.id === e.target.value);
                  setSelectedLostItemForMatch(itm || null);
                }}
                className="text-xs py-1.5 px-2 rounded-lg bg-emerald-900 text-white border border-emerald-700 focus:outline-hidden"
              >
                <option value="">Select a Lost Report to match...</option>
                {lostItems.map((l) => (
                  <option key={l.id} value={l.id}>
                    Match: {l.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Render match results if selected */}
          {selectedLostItemForMatch && (
            <div className="mt-4 pt-3 border-t border-emerald-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-200">
                  Matches found for: <strong className="text-white">{selectedLostItemForMatch.title}</strong>
                </span>
                <button
                  onClick={() => setSelectedLostItemForMatch(null)}
                  className="text-[11px] text-emerald-400 hover:text-white"
                >
                  Clear Match View
                </button>
              </div>

              {matchResults.length === 0 ? (
                <p className="text-xs text-emerald-300/80 italic py-1">
                  No matching found items currently score above 30%. As reports are logged, matches will appear here.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                  {matchResults.map(({ foundItem, result }) => {
                    const isFoundId = foundItem.type === 'found' && foundItem.category === 'student_id';
                    const titleText = isFoundId ? 'A student ID card was found' : foundItem.title;
                    return (
                      <div
                        key={foundItem.id}
                        className="bg-emerald-900/80 border border-emerald-700 rounded-lg p-3 text-xs space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-amber-300 font-bold text-[11px]">
                              {result.score}% Match Confidence
                            </span>
                            <h4 className="font-semibold text-white text-xs mt-0.5">{titleText}</h4>
                          </div>
                          <button
                            onClick={() => onClaimItem(foundItem)}
                            className="bg-amber-400 hover:bg-amber-300 text-stone-900 text-[10px] font-bold px-2 py-1 rounded"
                          >
                            Verify Claim
                          </button>
                        </div>

                        <ul className="text-[11px] text-emerald-200/90 list-disc list-inside space-y-0.5">
                          {result.reasons.map((r, idx) => (
                            <li key={idx}>{r}</li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Main Items Feed */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs text-stone-600 px-1">
          <span>Showing <strong>{filteredItems.length}</strong> items</span>
          {lowDataMode && (
            <span className="text-amber-800 bg-amber-50 px-2 py-0.5 rounded text-[11px] font-medium border border-amber-200">
              Low-Data Mode active: Photos hidden
            </span>
          )}
        </div>

        {filteredItems.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-stone-200 space-y-3 p-6">
            <AlertCircle className="w-8 h-8 text-stone-400 mx-auto" />
            <h3 className="font-semibold text-stone-800 text-sm">No items found</h3>
            <p className="text-xs text-stone-500 max-w-sm mx-auto">
              {items.length === 0
                ? 'No items have been reported yet in this pilot.'
                : 'No items match your active filters or search keyword.'}
            </p>
            <button
              onClick={onOpenReportModal}
              className="bg-emerald-800 text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-emerald-900 transition-colors"
            >
              Report an Item
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {filteredItems.map((item) => {
              const isFound = item.type === 'found';
              const isReturned = item.status === 'returned';
              const isFoundIdCard = isFound && item.category === 'student_id';
              
              // Privacy rule: For found student ID cards, show only "A student ID card was found" and location
              const displayTitle = isFoundIdCard ? 'A student ID card was found' : item.title;

              return (
                <div
                  key={item.id}
                  className={`bg-white rounded-xl border shadow-xs transition-all hover:shadow-md flex flex-col justify-between overflow-hidden ${
                    isReturned
                      ? 'border-stone-200 opacity-75'
                      : isFound
                      ? 'border-emerald-200/90'
                      : 'border-rose-200/90'
                  }`}
                >
                  <div className="p-4 space-y-3">
                    {/* Top status bar */}
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                          isFound
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : 'bg-rose-100 text-rose-800 border border-rose-200'
                        }`}
                      >
                        {isFound ? 'Found Item' : 'Lost Report'}
                      </span>

                      {/* Status indicator */}
                      <span className="text-[11px] font-semibold text-stone-600 flex items-center gap-1">
                        {isReturned ? (
                          <span className="text-emerald-700 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Returned
                          </span>
                        ) : item.status === 'claim_requested' ? (
                          <span className="text-amber-700 flex items-center gap-1">
                            <Lock className="w-3.5 h-3.5" /> Claim Pending
                          </span>
                        ) : (
                          <span className="text-stone-500">Open</span>
                        )}
                      </span>
                    </div>

                    {/* Sensitive ID Card notice or Image */}
                    {isFoundIdCard ? (
                      <div className="bg-stone-50 border border-stone-200 rounded-lg p-2.5 flex items-center gap-2 text-xs text-stone-700">
                        <Shield className="w-4 h-4 text-emerald-700 shrink-0" />
                        <div>
                          <p className="font-semibold text-[11px] text-stone-900">Protected Student ID Record</p>
                          <p className="text-[10px] text-stone-500">
                            Deposited at Main Gate Security. Name & matric number withheld from feed.
                          </p>
                        </div>
                      </div>
                    ) : item.imageUrl && !lowDataMode ? (
                      <div className="h-32 w-full rounded-lg overflow-hidden bg-stone-100 relative">
                        <img
                          src={item.imageUrl}
                          alt={item.title}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </div>
                    ) : null}

                    {/* Title & Description */}
                    <div>
                      <h3 className="font-bold text-stone-900 text-sm leading-snug">{displayTitle}</h3>
                      <p className="text-xs text-stone-600 mt-1 line-clamp-3 leading-relaxed">
                        {isFoundIdCard
                          ? `Found in the vicinity of ${item.location}. Handed over to security desk for safekeeping.`
                          : item.description}
                      </p>
                    </div>

                    {/* Campus Location & Date in DD/MM/YYYY */}
                    <div className="space-y-1 text-xs text-stone-600 pt-1">
                      <div className="flex items-center gap-1.5 text-stone-700">
                        <MapPin className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                        <span className="font-medium text-[11px] truncate">{item.location}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-stone-500 text-[11px]">
                        <Calendar className="w-3.5 h-3.5 shrink-0" />
                        <span>{isFound ? 'Found on:' : 'Lost on:'} {formatDateDDMMYYYY(item.dateLostOrFound)}</span>
                      </div>
                    </div>

                    {/* Holding Custody Badge for Found items */}
                    {isFound && (
                      <div className="bg-stone-50 border border-stone-200 rounded p-2 text-[11px] text-stone-700 flex items-center justify-between">
                        <span className="text-stone-500">Held at:</span>
                        <span className="font-semibold text-stone-800">
                          {isFoundIdCard || item.holdingLocation === 'security_main_gate'
                            ? 'Main Gate Security Post'
                            : item.holdingLocation === 'library_desk'
                            ? 'Library Front Desk'
                            : item.holdingLocation === 'student_affairs_office'
                            ? 'Student Affairs Office'
                            : 'With Finder'}
                        </span>
                      </div>
                    )}

                    {/* Hidden question badge */}
                    {isFound && item.verificationQuestion && (
                      <div className="text-[10px] text-emerald-800 bg-emerald-50/80 border border-emerald-200 p-1.5 rounded flex items-center gap-1">
                        <Lock className="w-3 h-3 text-emerald-700 shrink-0" />
                        <span>Anti-theft verification question active</span>
                      </div>
                    )}
                  </div>

                  {/* Card Footer Actions */}
                  <div className="p-3 bg-stone-50 border-t border-stone-100 flex items-center justify-between gap-2">
                    {isFound ? (
                      <button
                        onClick={() => onClaimItem(item)}
                        disabled={isReturned}
                        className={`w-full py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                          isReturned
                            ? 'bg-stone-200 text-stone-500 cursor-not-allowed'
                            : 'bg-emerald-700 hover:bg-emerald-800 text-white shadow-xs'
                        }`}
                      >
                        <ShieldCheck className="w-3.5 h-3.5 text-amber-300" />
                        <span>{isReturned ? 'Item Reunited' : 'This is Mine (Claim)'}</span>
                      </button>
                    ) : (
                      <div className="w-full text-center py-1 text-[11px] text-rose-700 font-semibold bg-rose-50 rounded border border-rose-100">
                        Owner searching • Report found if seen
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
