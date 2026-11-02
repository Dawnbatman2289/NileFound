/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * NileFound Campus Feed
 * Layout: Search filters, category selectors, and responsive card grid in Deep Navy (#0B1020), Muted Cards (#141B33), and Electric Lime (#C6FF3D).
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
  LogIn,
  SlidersHorizontal,
  PackageSearch
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

  if (isAccessRestricted) {
    return (
      <div className="max-w-xl mx-auto py-12 px-4 text-center space-y-6">
        <div className="bg-[#141B33] rounded-[20px] border border-[#1E294B] p-8 sm:p-10 shadow-2xl space-y-5 text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-[#C6FF3D]/5 rounded-full blur-3xl pointer-events-none" />
          
          <div className="w-14 h-14 bg-[#1E294B] border border-[#2A3B66] text-[#C6FF3D] rounded-2xl flex items-center justify-center mx-auto shadow-inner">
            <Lock className="w-7 h-7 text-[#C6FF3D]" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-bold text-[#F4F6FF] tracking-tight">
              Sign in to view campus items
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed max-w-md mx-auto">
              To protect student privacy and prevent unauthorized scraping, only verified Nile University accounts (@nileuniversity.edu.ng) can view listings or file claims.
            </p>
          </div>

          <button
            onClick={onNavigateToLogin}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[#C6FF3D] hover:bg-[#b8f52f] text-[#0B1020] px-6 py-3 rounded-full text-xs sm:text-sm font-extrabold shadow-[0_0_20px_rgba(198,255,61,0.2)] transition-all min-h-[44px] cursor-pointer"
          >
            <LogIn className="w-4 h-4" />
            <span>Sign in with Google</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search & Filter Header Card */}
      <div className="bg-[#141B33] rounded-[20px] border border-[#1E294B] p-4 sm:p-5 shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search Bar */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by keyword, item name, or campus building..."
              className="w-full text-xs sm:text-sm pl-10 pr-9 py-3 rounded-xl border border-[#1E294B] focus:border-[#C6FF3D] focus:ring-1 focus:ring-[#C6FF3D] bg-[#0B1020] text-[#F4F6FF] placeholder:text-slate-500 focus:outline-hidden transition-all min-h-[44px]"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#F4F6FF] text-xs font-bold p-1 cursor-pointer"
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          {/* Type Filter Segmented Control */}
          <div className="flex bg-[#0B1020] p-1 rounded-xl border border-[#1E294B] shrink-0 gap-1">
            <button
              onClick={() => setSelectedType('all')}
              className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-all min-h-[38px] cursor-pointer ${
                selectedType === 'all'
                  ? 'bg-[#141B33] text-[#F4F6FF] border border-[#1E294B] shadow-xs'
                  : 'text-slate-400 hover:text-[#F4F6FF]'
              }`}
            >
              All ({items.length})
            </button>
            <button
              onClick={() => setSelectedType('found')}
              className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-all min-h-[38px] cursor-pointer ${
                selectedType === 'found'
                  ? 'bg-[#C6FF3D] text-[#0B1020] shadow-[0_0_12px_rgba(198,255,61,0.25)]'
                  : 'text-slate-400 hover:text-[#F4F6FF]'
              }`}
            >
              Found ({foundItems.length})
            </button>
            <button
              onClick={() => setSelectedType('lost')}
              className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-all min-h-[38px] cursor-pointer ${
                selectedType === 'lost'
                  ? 'bg-amber-400 text-[#0B1020] shadow-[0_0_12px_rgba(251,191,36,0.25)]'
                  : 'text-slate-400 hover:text-[#F4F6FF]'
              }`}
            >
              Lost ({lostItems.length})
            </button>
          </div>
        </div>

        {/* Category & Location Dropdowns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-[#1E294B]/60">
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1.5 flex items-center gap-1.5">
              <span>Filter Category:</span>
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full text-xs px-3 py-2.5 rounded-xl border border-[#1E294B] focus:border-[#C6FF3D] focus:ring-1 focus:ring-[#C6FF3D] bg-[#0B1020] text-[#F4F6FF] focus:outline-hidden min-h-[44px] cursor-pointer"
            >
              <option value="all">All Categories</option>
              {CATEGORIES.map((cat) => (
                <option key={cat.id} value={cat.id} className="bg-[#0B1020] text-[#F4F6FF]">
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1.5 flex items-center gap-1.5">
              <span>Campus Location:</span>
            </label>
            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="w-full text-xs px-3 py-2.5 rounded-xl border border-[#1E294B] focus:border-[#C6FF3D] focus:ring-1 focus:ring-[#C6FF3D] bg-[#0B1020] text-[#F4F6FF] focus:outline-hidden min-h-[44px] cursor-pointer"
            >
              <option value="all">All Campus Locations</option>
              {NILE_CAMPUS_LOCATIONS.map((loc) => (
                <option key={loc} value={loc} className="bg-[#0B1020] text-[#F4F6FF]">
                  {loc}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Feed Section */}
      <div className="space-y-4">
        {/* Count and Low-Data Status */}
        <div className="flex items-center justify-between text-xs text-slate-400 px-1">
          <span>
            Showing <strong className="text-[#F4F6FF]">{filteredItems.length}</strong> items
          </span>
          {lowDataMode && (
            <span className="text-[#C6FF3D] bg-[#C6FF3D]/10 px-2.5 py-0.5 rounded-full text-[11px] font-medium border border-[#C6FF3D]/30 font-mono">
              Low-Data Mode active: Photos hidden
            </span>
          )}
        </div>

        {/* Designed Empty State */}
        {filteredItems.length === 0 ? (
          <div className="text-center py-16 bg-[#141B33] rounded-[20px] border border-[#1E294B] space-y-4 p-8 max-w-lg mx-auto shadow-xl relative overflow-hidden">
            <div className="w-16 h-16 bg-[#0B1020] border border-[#1E294B] text-slate-400 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
              <PackageSearch className="w-8 h-8 text-[#C6FF3D]/80" />
            </div>
            <div className="space-y-1">
              <h3 className="font-extrabold text-[#F4F6FF] text-base">No items found</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                {items.length === 0
                  ? 'No items have been reported yet in this pilot.'
                  : 'No items match your active filters or search keyword.'}
              </p>
            </div>
            <button
              onClick={onOpenReportModal}
              className="bg-[#C6FF3D] text-[#0B1020] text-xs font-extrabold px-5 py-2.5 rounded-full hover:bg-[#b8f52f] transition-all shadow-[0_0_15px_rgba(198,255,61,0.2)] min-h-[44px] cursor-pointer inline-flex items-center gap-2"
            >
              Report an Item
            </button>
          </div>
        ) : (
          /* Cards Grid with Large 20px corners, thin 1px border, hover lime glow, and staggered fade-up */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredItems.map((item, idx) => {
              const isFound = item.type === 'found';
              const isReturned = item.status === 'returned';
              const isFoundIdCard = isFound && item.category === 'student_id';
              const displayTitle = isFoundIdCard ? 'A student ID card was found' : item.title;

              return (
                <article
                  key={item.id}
                  style={{ animationDelay: `${Math.min(idx * 40, 360)}ms` }}
                  className={`animate-fade-up bg-[#141B33] rounded-[20px] border border-[#1E294B] hover:border-[#C6FF3D]/40 hover:shadow-[0_0_24px_rgba(198,255,61,0.08)] transition-all duration-200 flex flex-col justify-between overflow-hidden group ${
                    isReturned ? 'opacity-65' : ''
                  }`}
                >
                  <div className="p-5 space-y-4">
                    {/* Top Status & Badge Bar */}
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`text-[10px] font-mono font-bold px-2.5 py-1 rounded-md uppercase tracking-wider ${
                          isFound
                            ? 'bg-[#C6FF3D]/10 text-[#C6FF3D] border border-[#C6FF3D]/30'
                            : 'bg-amber-400/10 text-amber-300 border border-amber-400/30'
                        }`}
                      >
                        {isFound ? 'Found Item' : 'Lost Report'}
                      </span>

                      {/* Item Status Indicator */}
                      <span className="text-[11px] font-semibold flex items-center gap-1.5">
                        {isReturned ? (
                          <span className="text-emerald-400 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Returned
                          </span>
                        ) : item.status === 'claim_requested' ? (
                          <span className="text-amber-400 flex items-center gap-1">
                            <Lock className="w-3.5 h-3.5" /> Claim Pending
                          </span>
                        ) : (
                          <span className="text-slate-400 font-mono text-[10px] uppercase tracking-wide">
                            Open
                          </span>
                        )}
                      </span>
                    </div>

                    {/* Big Photos or Protected Sensitive ID Notice */}
                    {isFoundIdCard ? (
                      <div className="bg-[#0B1020] border border-[#1E294B] rounded-xl p-3.5 flex items-center gap-3 text-xs text-slate-300">
                        <div className="p-2 rounded-lg bg-[#141B33] text-[#C6FF3D] shrink-0 border border-[#1E294B]">
                          <Shield className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="font-bold text-[11px] text-[#F4F6FF]">Protected Student ID Record</p>
                          <p className="text-[10px] text-slate-400 leading-tight mt-0.5">
                            Deposited at Main Gate Security. Name & matric number withheld from feed.
                          </p>
                        </div>
                      </div>
                    ) : item.imageUrl && !lowDataMode ? (
                      <div className="h-48 sm:h-56 w-full rounded-[14px] overflow-hidden bg-[#0B1020] border border-[#1E294B] relative">
                        <img
                          src={item.imageUrl}
                          alt={item.title}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                          loading="lazy"
                        />
                      </div>
                    ) : null}

                    {/* Title & Description */}
                    <div className="space-y-1.5">
                      <h3 className="font-extrabold text-[#F4F6FF] text-base leading-snug tracking-tight">
                        {displayTitle}
                      </h3>
                      <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed">
                        {isFoundIdCard
                          ? `Found in the vicinity of ${item.location}. Handed over to security desk for safekeeping.`
                          : item.description}
                      </p>
                    </div>

                    {/* Metadata: Campus Location & Date */}
                    <div className="space-y-1.5 text-xs text-slate-400 pt-1 border-t border-[#1E294B]/60">
                      <div className="flex items-center gap-2 text-slate-300">
                        <MapPin className="w-3.5 h-3.5 text-[#C6FF3D] shrink-0" />
                        <span className="font-medium text-[11px] truncate">{item.location}</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-400 text-[11px]">
                        <Calendar className="w-3.5 h-3.5 shrink-0 text-slate-500" />
                        <span>{isFound ? 'Found on:' : 'Lost on:'} {formatDateDDMMYYYY(item.dateLostOrFound)}</span>
                      </div>
                    </div>

                    {/* Physical Custody Info for Found Items */}
                    {isFound && (
                      <div className="bg-[#0B1020] border border-[#1E294B] rounded-xl px-3 py-2 text-[11px] flex items-center justify-between text-slate-300">
                        <span className="text-slate-400">Held at:</span>
                        <span className="font-bold text-[#F4F6FF]">
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

                    {/* Anti-Theft Verification Question Badge */}
                    {isFound && item.verificationQuestion && (
                      <div className="text-[10px] text-[#C6FF3D] bg-[#C6FF3D]/5 border border-[#C6FF3D]/25 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5">
                        <Lock className="w-3 h-3 text-[#C6FF3D] shrink-0" />
                        <span>Anti-theft verification question active</span>
                      </div>
                    )}
                  </div>

                  {/* Card Footer Actions */}
                  <div className="p-4 bg-[#0B1020]/60 border-t border-[#1E294B]">
                    {isFound ? (
                      <button
                        onClick={() => onClaimItem(item)}
                        disabled={isReturned}
                        className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 min-h-[44px] cursor-pointer ${
                          isReturned
                            ? 'bg-[#1E294B] text-slate-500 border border-[#1E294B] cursor-not-allowed'
                            : 'bg-[#1E294B] hover:bg-[#C6FF3D] text-[#F4F6FF] hover:text-[#0B1020] border border-[#2A3B66] hover:border-[#C6FF3D] hover:shadow-[0_0_15px_rgba(198,255,61,0.2)] active:scale-95'
                        }`}
                      >
                        <ShieldCheck className="w-4 h-4" />
                        <span>{isReturned ? 'Item Reunited' : 'This is Mine (Claim)'}</span>
                      </button>
                    ) : (
                      <div className="w-full text-center py-2 text-[11px] text-amber-300 font-semibold bg-amber-400/10 rounded-xl border border-amber-400/25 min-h-[38px] flex items-center justify-center">
                        Owner searching • Report found if seen
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
