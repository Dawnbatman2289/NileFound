/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * NileFound Campus Feed
 * Layout: Search filters, category selectors, and responsive card grid in Deep Navy (#0B1020), Muted Cards (#141B33), and Electric Lime (#C6FF3D).
 * Main Action: Browse campus listings, check match scores, and initiate claims.
 */

import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
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
import { CATEGORIES, DEMO_ITEMS } from '../data/mockItems.ts';
import { NILE_CAMPUS_LOCATIONS } from '../config/locations.ts';
import { calculateMatchScore } from '../utils/matching.ts';
import { formatDateDDMMYYYY } from '../utils/dateFormatter.ts';
import { filterCampusItems } from '../utils/feedFilters.ts';

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
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'active' | 'claimed' | 'resolved'>('all');
  const [selectedDateRange, setSelectedDateRange] = useState<'all' | '24h' | '7d'>('all');
  const [selectedLostItemForMatch, setSelectedLostItemForMatch] = useState<CampusItem | null>(null);
  const [includeDemoSeed, setIncludeDemoSeed] = useState(false);

  const isOwnerEmail = currentUser?.email?.trim().toLowerCase() === 'ayomide2289@gmail.com';
  const isAdmin = currentUser?.role === 'admin' || currentUser?.isAdmin || isOwnerEmail;

  // Combine real items from Firestore with verified sample items so feed is never bare
  const displayableItems = useMemo(() => {
    if (!includeDemoSeed || !isAdmin) return items;
    const existingIds = new Set(items.map((it) => it.id));
    const supplemental = DEMO_ITEMS.filter((demo) => !existingIds.has(demo.id));
    return [...items, ...supplemental];
  }, [items, includeDemoSeed]);

  // Filter items
  const filteredItems = useMemo(() => filterCampusItems(displayableItems, {
    searchTerm,
    type: selectedType,
    category: selectedCategory,
    location: selectedLocation,
    status: selectedStatus,
    dateRange: selectedDateRange,
  }), [displayableItems, selectedType, selectedCategory, selectedLocation, selectedStatus, selectedDateRange, searchTerm]);

  // Separate lost vs found
  const lostItems = useMemo(() => displayableItems.filter(i => i.type === 'lost'), [displayableItems]);
  const foundItems = useMemo(() => displayableItems.filter(i => i.type === 'found'), [displayableItems]);

  return (
    <div className="space-y-7">
      {/* Friendly Campus Community Prompt */}
      <div className="bg-white dark:bg-[#1E1C18] border border-[#E6DFD2] dark:border-[#2E2A24] rounded-[14px] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-[0_1px_2px_rgba(31,27,22,0.03),0_8px_24px_rgba(31,27,22,0.035)]">
        <div className="space-y-1">
          <p className="font-serif font-bold text-sm sm:text-base text-[#1F1B16] dark:text-[#F5F1EA]">
            Lost your calculator? Someone may have handed it in.
          </p>
          <p className="text-xs text-[#544E45] dark:text-[#B8B0A2] leading-relaxed">
            Found something? Hand it to Student Affairs, then post it here.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {!currentUser && onNavigateToLogin && (
            <button
              onClick={onNavigateToLogin}
              className="inline-flex items-center gap-1.5 bg-white dark:bg-[#28241F] hover:bg-[#F5EFE4] dark:hover:bg-[#332E27] text-[#1F1B16] dark:text-[#F5F1EA] text-xs font-medium px-3.5 py-2 rounded-[10px] border border-[#E6DFD2] dark:border-[#2E2A24] transition-colors min-h-[44px] cursor-pointer btn-campus"
            >
              <LogIn className="w-3.5 h-3.5 text-[#544E45] dark:text-[#B8B0A2]" />
              <span>Sign In</span>
            </button>
          )}

          <button
            onClick={onOpenReportModal}
            className="inline-flex items-center gap-1.5 bg-[#0F6E6E] hover:bg-[#0C5656] text-white text-xs font-medium px-4 py-2 rounded-[10px] transition-colors min-h-[44px] cursor-pointer btn-campus shadow-xs"
          >
            <span>Post a Notice</span>
          </button>
        </div>
      </div>

      {/* Search & Filter Notice Board Section */}
      <div className="bg-white dark:bg-[#1E1C18] rounded-[14px] border border-[#E6DFD2] dark:border-[#2E2A24] p-4 sm:p-5 space-y-4 shadow-[0_1px_2px_rgba(31,27,22,0.03),0_8px_24px_rgba(31,27,22,0.035)]">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search Bar */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#7A7266] dark:text-[#857D71] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by keyword, item name, or campus building..."
              className="w-full text-xs sm:text-sm pl-10 pr-9 py-2.5 rounded-[10px] border border-[#E6DFD2] dark:border-[#2E2A24] focus:border-[#0F6E6E] bg-[#FAF6EF]/60 dark:bg-[#141311] text-[#1F1B16] dark:text-[#F5F1EA] placeholder:text-[#7A7266] dark:placeholder:text-[#857D71] focus:outline-hidden transition-colors min-h-[44px]"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7A7266] hover:text-[#1F1B16] text-xs font-bold p-1 cursor-pointer"
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          {/* Type Filter Segmented Control */}
          <div className="flex bg-[#FAF6EF] dark:bg-[#141311] p-1 rounded-[10px] border border-[#E6DFD2] dark:border-[#2E2A24] shrink-0 gap-1">
            <button
              onClick={() => setSelectedType('all')}
              className={`px-3 py-1.5 text-xs font-medium rounded-[8px] transition-colors min-h-[38px] cursor-pointer ${
                selectedType === 'all'
                  ? 'bg-white dark:bg-[#1E1C18] text-[#1F1B16] dark:text-[#F5F1EA] border border-[#E6DFD2] dark:border-[#2E2A24] shadow-xs'
                  : 'text-[#544E45] dark:text-[#B8B0A2] hover:text-[#1F1B16]'
              }`}
            >
              All ({displayableItems.length})
            </button>
            <button
              onClick={() => setSelectedType('found')}
              className={`px-3 py-1.5 text-xs font-medium rounded-[8px] transition-colors min-h-[38px] cursor-pointer ${
                selectedType === 'found'
                  ? 'bg-[#2F7D4F] text-white shadow-xs'
                  : 'text-[#544E45] dark:text-[#B8B0A2] hover:text-[#1F1B16]'
              }`}
            >
              Found ({foundItems.length})
            </button>
            <button
              onClick={() => setSelectedType('lost')}
              className={`px-3 py-1.5 text-xs font-medium rounded-[8px] transition-colors min-h-[38px] cursor-pointer ${
                selectedType === 'lost'
                  ? 'bg-[#E8A317] text-[#1F1B16] font-semibold shadow-xs'
                  : 'text-[#544E45] dark:text-[#B8B0A2] hover:text-[#1F1B16]'
              }`}
            >
              Lost ({lostItems.length})
            </button>
          </div>
        </div>

        {/* Category & Location Dropdowns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[#E6DFD2] dark:border-[#2E2A24]">
          <div>
            <label className="block text-[11px] font-medium text-[#544E45] dark:text-[#B8B0A2] mb-1">
              Category:
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-[10px] border border-[#E6DFD2] dark:border-[#2E2A24] focus:border-[#0F6E6E] bg-white dark:bg-[#141311] text-[#1F1B16] dark:text-[#F5F1EA] focus:outline-hidden min-h-[44px] cursor-pointer"
            >
              <option value="all">All Categories ({displayableItems.length})</option>
              {CATEGORIES.map((cat) => {
                const count = displayableItems.filter((i) => i.category === cat.id).length;
                return (
                  <option key={cat.id} value={cat.id}>
                    {cat.label} {count > 0 ? `(${count})` : '(0)'}
                  </option>
                );
              })}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-[#544E45] dark:text-[#B8B0A2] mb-1">
              Status:
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as typeof selectedStatus)}
              className="w-full text-xs px-3 py-2 rounded-[10px] border border-[#E6DFD2] dark:border-[#2E2A24] focus:border-[#0F6E6E] bg-white dark:bg-[#141311] text-[#1F1B16] dark:text-[#F5F1EA] focus:outline-hidden min-h-[44px] cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="claimed">Claimed</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-[#544E45] dark:text-[#B8B0A2] mb-1">
              Date:
            </label>
            <select
              value={selectedDateRange}
              onChange={(e) => setSelectedDateRange(e.target.value as typeof selectedDateRange)}
              className="w-full text-xs px-3 py-2 rounded-[10px] border border-[#E6DFD2] dark:border-[#2E2A24] focus:border-[#0F6E6E] bg-white dark:bg-[#141311] text-[#1F1B16] dark:text-[#F5F1EA] focus:outline-hidden min-h-[44px] cursor-pointer"
            >
              <option value="all">All Time</option>
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-[#544E45] dark:text-[#B8B0A2] mb-1">
              Campus Location:
            </label>
            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-[10px] border border-[#E6DFD2] dark:border-[#2E2A24] focus:border-[#0F6E6E] bg-white dark:bg-[#141311] text-[#1F1B16] dark:text-[#F5F1EA] focus:outline-hidden min-h-[44px] cursor-pointer"
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

      {/* Main Feed Section */}
      <div className="space-y-4">
        {/* Count, Sample Toggle and Filter Reset */}
        <div className="flex flex-wrap items-center justify-between text-xs text-[#7A7266] dark:text-[#857D71] px-1 gap-2">
          <div className="flex items-center gap-3">
            <span>
              Showing <strong className="text-[#1F1B16] dark:text-[#F5F1EA]">{filteredItems.length}</strong> items
            </span>
            {isAdmin && (
              <button
                onClick={() => setIncludeDemoSeed(!includeDemoSeed)}
                className={`text-[11px] px-2.5 py-1 rounded-[8px] border transition-colors cursor-pointer btn-campus ${
                  includeDemoSeed
                    ? 'bg-white dark:bg-[#1E1C18] text-[#1F1B16] dark:text-[#F5F1EA] border-[#D1C7B7] dark:border-[#3F3A32]'
                    : 'bg-[#FAF6EF] dark:bg-[#141311] text-[#7A7266] border-[#E6DFD2] dark:border-[#2E2A24]'
                }`}
                title="Toggle verified sample records alongside live reports"
              >
                {includeDemoSeed ? '✓ Sample Data Included' : '+ Show Sample Data'}
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            {(searchTerm || selectedCategory !== 'all' || selectedLocation !== 'all' || selectedType !== 'all' || selectedStatus !== 'all' || selectedDateRange !== 'all') && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setSelectedCategory('all');
                  setSelectedLocation('all');
                  setSelectedType('all');
                  setSelectedStatus('all');
                  setSelectedDateRange('all');
                  setSelectedStatus('all');
                  setSelectedDateRange('all');
                }}
                className="text-[11px] font-medium text-[#0F6E6E] dark:text-[#199595] hover:underline cursor-pointer"
              >
                Reset All Filters
              </button>
            )}

            {lowDataMode && (
              <span className="text-[#0F6E6E] dark:text-[#199595] bg-[#E7F3F3] dark:bg-[#0D2D2D] px-2.5 py-0.5 rounded-[6px] text-[11px] font-medium border border-[#0F6E6E]/20">
                Low-Data: Photos hidden
              </span>
            )}
          </div>
        </div>

        {/* Designed Friendly Empty State */}
        {filteredItems.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-[#1E1C18] rounded-[12px] border border-[#E6DFD2] dark:border-[#2E2A24] space-y-4 p-6 sm:p-8 max-w-md mx-auto shadow-xs">
            <div className="w-14 h-14 bg-[#FAF6EF] dark:bg-[#141311] border border-[#E6DFD2] dark:border-[#2E2A24] text-[#0F6E6E] dark:text-[#199595] rounded-[10px] flex items-center justify-center mx-auto">
              <PackageSearch className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h3 className="font-serif font-bold text-[#1F1B16] dark:text-[#F5F1EA] text-base">
                Nothing here yet. Lost something? Report it.
              </h3>
              <p className="text-xs text-[#544E45] dark:text-[#B8B0A2] max-w-sm mx-auto leading-relaxed">
                {selectedType === 'found'
                  ? "Found someone's calculator, student ID, keys, or phone on campus? Hand it to Student Affairs, then post it here."
                  : 'Try adjusting your search terms or filters to find what was lost.'}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
              <button
                onClick={() => {
                  setSearchTerm('');
                  setSelectedCategory('all');
                  setSelectedLocation('all');
                  setSelectedType('all');
                  setIncludeDemoSeed(true);
                }}
                className="bg-white dark:bg-[#28241F] hover:bg-[#F5EFE4] dark:hover:bg-[#332E27] text-[#1F1B16] dark:text-[#F5F1EA] text-xs font-medium px-4 py-2.5 rounded-[10px] border border-[#E6DFD2] dark:border-[#2E2A24] transition-colors min-h-[44px] cursor-pointer btn-campus"
              >
                Reset Filters
              </button>
              <button
                onClick={onOpenReportModal}
                className="bg-[#0F6E6E] hover:bg-[#0C5656] text-white text-xs font-medium px-5 py-2.5 rounded-[10px] transition-colors min-h-[44px] cursor-pointer btn-campus shadow-xs"
              >
                Report an Item
              </button>
            </div>
          </div>
        ) : (
          /* Notice Board Grid: 12px radius, Photo first and large, tilted stamp label, title, location, date */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredItems.map((item) => {
              const isFound = item.type === 'found';
              const isReturned = item.status === 'returned';
              const isFoundIdCard = isFound && item.category === 'student_id';
              const displayTitle = isFoundIdCard ? 'A student ID card was found' : item.title;

              return (
                <motion.article
                  key={item.id}
                  id={`item-${item.id}`}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileHover={{ y: -3 }}
                  whileTap={{ scale: 0.995 }}
                  transition={{ duration: 0.2, delay: Math.min(filteredItems.indexOf(item) * 0.03, 0.24) }}
                  className={`notice-card flex flex-col justify-between overflow-hidden ${
                    isReturned ? 'opacity-65' : ''
                  }`}
                >
                  {/* Card Header & Content */}
                  <div>
                    {/* PHOTO FIRST AND LARGE */}
                    {isFoundIdCard ? (
                      <div className="p-4 bg-[#FAF6EF] dark:bg-[#141311] border-b border-[#E6DFD2] dark:border-[#2E2A24] flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-xs text-[#544E45] dark:text-[#B8B0A2]">
                          <Shield className="w-4 h-4 text-[#0F6E6E] dark:text-[#199595]" />
                          <span className="font-medium">Student ID Record</span>
                        </div>
                        <span className="stamp-found">Found</span>
                      </div>
                    ) : item.imageUrl && !lowDataMode ? (
                      <div className="h-48 sm:h-52 w-full overflow-hidden bg-[#FAF6EF] dark:bg-[#141311] border-b border-[#E6DFD2] dark:border-[#2E2A24] relative">
                        <img
                          src={item.imageUrl}
                          alt={item.title}
                          className="w-full h-full object-cover transition-transform duration-200 hover:scale-[1.01]"
                          loading="lazy"
                        />
                        <div className="absolute top-3 left-3">
                          <span className={isFound ? 'stamp-found' : 'stamp-lost'}>
                            {isFound ? 'Found' : 'Lost'}
                          </span>
                        </div>
                      </div>
                    ) : (
                      /* Header when photo is absent or Low-Data mode */
                      <div className="p-3.5 bg-[#FAF6EF]/60 dark:bg-[#141311] border-b border-[#E6DFD2] dark:border-[#2E2A24] flex items-center justify-between">
                        <span className={isFound ? 'stamp-found' : 'stamp-lost'}>
                          {isFound ? 'Found' : 'Lost'}
                        </span>
                        <span className="text-[11px] text-[#7A7266] dark:text-[#857D71]">
                          {isReturned ? 'Returned' : item.status === 'claim_requested' ? 'Claim pending' : 'Open'}
                        </span>
                      </div>
                    )}

                    {/* Card Body */}
                    <div className="p-4 space-y-3">
                      {/* Title & Description */}
                      <div>
                        <h3 className="font-serif font-bold text-base text-[#1F1B16] dark:text-[#F5F1EA] leading-snug">
                          {displayTitle}
                        </h3>
                        <p className="text-xs text-[#544E45] dark:text-[#B8B0A2] line-clamp-2 mt-1 leading-relaxed">
                          {isFoundIdCard
                            ? `Found in the vicinity of ${item.location}. Handed to campus security for safekeeping.`
                            : item.description}
                        </p>
                      </div>

                      {/* Location & Date */}
                      <div className="space-y-1.5 text-xs text-[#7A7266] dark:text-[#857D71] pt-2 border-t border-[#E6DFD2] dark:border-[#2E2A24]">
                        <div className="flex items-center gap-1.5 text-[#544E45] dark:text-[#B8B0A2]">
                          <MapPin className="w-3.5 h-3.5 text-[#0F6E6E] dark:text-[#199595] shrink-0" />
                          <span className="font-medium truncate">
                            {item.location}{item.locationDetails ? ` · ${item.locationDetails}` : ''}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 shrink-0" />
                          <span>{isFound ? 'Found' : 'Reported'}: {formatDateDDMMYYYY(item.dateLostOrFound)}</span>
                        </div>
                      </div>

                      {/* Physical Custody Location for Found Items */}
                      {isFound && (
                        <div className="bg-[#FAF6EF] dark:bg-[#141311] border border-[#E6DFD2] dark:border-[#2E2A24] rounded-[8px] px-3 py-2 text-[11px] flex items-center justify-between text-[#544E45] dark:text-[#B8B0A2]">
                          <span className="text-[#7A7266] dark:text-[#857D71]">Held at:</span>
                          <span className="font-medium text-[#1F1B16] dark:text-[#F5F1EA]">
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

                      {/* Anti-Theft Verification Flag */}
                      {isFound && item.verificationQuestion && (
                        <div className="text-[10px] text-[#0F6E6E] dark:text-[#199595] bg-[#E7F3F3] dark:bg-[#0D2D2D] border border-[#0F6E6E]/20 px-2.5 py-1.5 rounded-[8px] flex items-center gap-1.5">
                          <Lock className="w-3 h-3 shrink-0" />
                          <span>Ownership verification required to claim</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card Action Footer */}
                  <div className="p-3.5 bg-[#FAF6EF]/50 dark:bg-[#141311]/50 border-t border-[#E6DFD2] dark:border-[#2E2A24]">
                    {isFound ? (
                      <button
                        onClick={() => onClaimItem(item)}
                        disabled={isReturned}
                        className={`w-full py-2.5 px-4 rounded-[10px] text-xs font-medium transition-colors flex items-center justify-center gap-2 min-h-[44px] cursor-pointer btn-campus ${
                          isReturned
                            ? 'bg-[#E6DFD2]/60 dark:bg-[#2E2A24] text-[#7A7266] dark:text-[#857D71] cursor-not-allowed'
                            : 'bg-[#0F6E6E] hover:bg-[#0C5656] text-white active:scale-98 shadow-xs'
                        }`}
                      >
                        <ShieldCheck className="w-4 h-4" />
                        <span>{isReturned ? 'Item Reunited' : 'This is Mine (Claim)'}</span>
                      </button>
                    ) : (
                      <div className="w-full text-center py-2 px-3 text-xs text-[#7A5000] dark:text-[#F9CF7C] bg-[#FEF7E9] dark:bg-[#2B210A] rounded-[8px] border border-[#E8A317]/30 min-h-[44px] flex items-center justify-center font-medium">
                        Looking for this item • Report if seen
                      </div>
                    )}
                  </div>
                </motion.article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
