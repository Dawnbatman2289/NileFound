/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * NileFound Campus Feed
 * Layout: Search filters, category selectors, and responsive card grid in Nile Blue & White.
 * Main Action: Browse campus listings, check match scores, and initiate claims.
 */

import React, { useState, useMemo } from 'react';
import { 
  Search, 
  MapPin, 
  Calendar, 
  ShieldCheck, 
  AlertCircle, 
  Lock, 
  CheckCircle2,
  Shield,
  LogIn
} from 'lucide-react';
import { CampusItem, ItemType, User } from '../types/index.ts';
import { CATEGORIES } from '../data/mockItems.ts';
import { NILE_CAMPUS_LOCATIONS } from '../config/locations.ts';
import { calculateMatchScore } from '../utils/matching.ts';
import { formatDateDDMMYYYY } from '../utils/dateFormatter.ts';

interface FeedViewProps {
  items: CampusItem[];
  lowDataMode: boolean;
  onClaimItem: (item: CampusItem) => void;
  onOpenReportModal: () => void;
  currentUser?: User | null;
  isDemoMode?: boolean;
  onNavigateToLogin?: () => void;
}

export const FeedView: React.FC<FeedViewProps> = ({
  items,
  lowDataMode,
  onClaimItem,
  onOpenReportModal,
  currentUser,
  isDemoMode,
  onNavigateToLogin
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<'all' | ItemType>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedLocation, setSelectedLocation] = useState<string>('all');
  const [selectedLostItemForMatch, setSelectedLostItemForMatch] = useState<CampusItem | null>(null);

  // If user is not authenticated in real mode, display sign-in gate
  const isAccessRestricted = !currentUser && !isDemoMode;

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

  if (isAccessRestricted) {
    return (
      <div className="max-w-xl mx-auto py-12 px-4 text-center space-y-5">
        <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-xs space-y-4">
          <div className="w-12 h-12 bg-blue-50 border border-blue-200 text-blue-900 rounded-full flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6 text-blue-900" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-base font-bold text-slate-900">Sign in to view campus items</h2>
            <p className="text-xs text-slate-600 leading-relaxed max-w-md mx-auto">
              To protect student privacy and prevent unauthorized scraping, only verified Nile University accounts (@nileuniversity.edu.ng) can view listings or file claims.
            </p>
          </div>

          <button
            onClick={onNavigateToLogin}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-blue-900 hover:bg-blue-800 text-white px-5 py-2.5 rounded-lg text-xs font-bold shadow-xs transition-colors"
          >
            <LogIn className="w-4 h-4" />
            <span>Sign in with Nile Email</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search & Filter Header */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-2.5">
          {/* Search Bar */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by keyword, item name, or campus building..."
              className="w-full text-xs pl-9 pr-3 py-2.5 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-800 bg-slate-50/50"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ✕
              </button>
            )}
          </div>

          {/* Type Filter Buttons */}
          <div className="flex bg-slate-100 p-1 rounded-lg shrink-0">
            <button
              onClick={() => setSelectedType('all')}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                selectedType === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All ({items.length})
            </button>
            <button
              onClick={() => setSelectedType('found')}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                selectedType === 'found'
                  ? 'bg-blue-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Found ({foundItems.length})
            </button>
            <button
              onClick={() => setSelectedType('lost')}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                selectedType === 'lost'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Lost ({lostItems.length})
            </button>
          </div>
        </div>

        {/* Category & Location Selectors */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">Filter Category:</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-800 bg-white"
            >
              <option value="all">All Categories</option>
              {CATEGORIES.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">Campus Location:</label>
            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-800 bg-white"
            >
              <option value="all">All Campus Locations</option>
              {NILE_CAMPUS_LOCATIONS.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Item Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs text-slate-600 px-1">
          <span>Showing <strong>{filteredItems.length}</strong> items</span>
          {lowDataMode && (
            <span className="text-blue-900 bg-blue-50 px-2 py-0.5 rounded text-[11px] font-medium border border-blue-200">
              Low-Data Mode active: Photos hidden
            </span>
          )}
        </div>

        {filteredItems.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-slate-200 space-y-3 p-6">
            <AlertCircle className="w-8 h-8 text-slate-400 mx-auto" />
            <h3 className="font-semibold text-slate-800 text-sm">No items found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {items.length === 0
                ? 'No items have been reported yet in this pilot.'
                : 'No items match your active filters or search keyword.'}
            </p>
            <button
              onClick={onOpenReportModal}
              className="bg-blue-900 text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-blue-800 transition-colors"
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
                      ? 'border-slate-200 opacity-75'
                      : isFound
                      ? 'border-blue-200'
                      : 'border-rose-200'
                  }`}
                >
                  <div className="p-4 space-y-3">
                    {/* Top status bar */}
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                          isFound
                            ? 'bg-blue-50 text-blue-900 border border-blue-200'
                            : 'bg-rose-50 text-rose-800 border border-rose-200'
                        }`}
                      >
                        {isFound ? 'Found Item' : 'Lost Report'}
                      </span>

                      {/* Status indicator */}
                      <span className="text-[11px] font-semibold text-slate-600 flex items-center gap-1">
                        {isReturned ? (
                          <span className="text-emerald-700 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Returned
                          </span>
                        ) : item.status === 'claim_requested' ? (
                          <span className="text-amber-700 flex items-center gap-1">
                            <Lock className="w-3.5 h-3.5" /> Claim Pending
                          </span>
                        ) : (
                          <span className="text-slate-500">Open</span>
                        )}
                      </span>
                    </div>

                    {/* Sensitive ID Card notice or Image */}
                    {isFoundIdCard ? (
                      <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 flex items-center gap-2 text-xs text-slate-700">
                        <Shield className="w-4 h-4 text-blue-900 shrink-0" />
                        <div>
                          <p className="font-semibold text-[11px] text-slate-900">Protected Student ID Record</p>
                          <p className="text-[10px] text-slate-500">
                            Deposited at Main Gate Security. Name & matric number withheld from feed.
                          </p>
                        </div>
                      </div>
                    ) : item.imageUrl && !lowDataMode ? (
                      <div className="h-32 w-full rounded-lg overflow-hidden bg-slate-100 relative">
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
                      <h3 className="font-bold text-slate-900 text-sm leading-snug">{displayTitle}</h3>
                      <p className="text-xs text-slate-600 mt-1 line-clamp-3 leading-relaxed">
                        {isFoundIdCard
                          ? `Found in the vicinity of ${item.location}. Handed over to security desk for safekeeping.`
                          : item.description}
                      </p>
                    </div>

                    {/* Campus Location & Date in DD/MM/YYYY */}
                    <div className="space-y-1 text-xs text-slate-600 pt-1">
                      <div className="flex items-center gap-1.5 text-slate-700">
                        <MapPin className="w-3.5 h-3.5 text-blue-900 shrink-0" />
                        <span className="font-medium text-[11px] truncate">{item.location}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
                        <Calendar className="w-3.5 h-3.5 shrink-0" />
                        <span>{isFound ? 'Found on:' : 'Lost on:'} {formatDateDDMMYYYY(item.dateLostOrFound)}</span>
                      </div>
                    </div>

                    {/* Holding Custody Badge for Found items */}
                    {isFound && (
                      <div className="bg-slate-50 border border-slate-200 rounded p-2 text-[11px] text-slate-700 flex items-center justify-between">
                        <span className="text-slate-500">Held at:</span>
                        <span className="font-semibold text-slate-800">
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
                      <div className="text-[10px] text-blue-900 bg-blue-50 border border-blue-200 p-1.5 rounded flex items-center gap-1">
                        <Lock className="w-3 h-3 text-blue-800 shrink-0" />
                        <span>Anti-theft verification question active</span>
                      </div>
                    )}
                  </div>

                  {/* Card Footer Actions */}
                  <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
                    {isFound ? (
                      <button
                        onClick={() => onClaimItem(item)}
                        disabled={isReturned}
                        className={`w-full py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                          isReturned
                            ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                            : 'bg-blue-900 hover:bg-blue-800 text-white shadow-xs'
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
