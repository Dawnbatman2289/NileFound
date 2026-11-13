/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * NileFound Campus Feed
 * Layout: Search filters, category selectors, responsive notice card grid, and Load More pagination.
 * Main Action: Browse campus listings, initiate claims, or report matches.
 */

import React, { useState, useMemo, useEffect } from 'react';
import { motion } from 'motion/react';
import { Search, MapPin, Calendar, ShieldCheck, Lock, Shield, LogIn, PackageSearch, Mail, X, AlertTriangle, RotateCcw } from 'lucide-react';
import { CampusItem, ClaimRecord, ItemType, User } from '../types/index.ts';
import { CATEGORIES } from '../config/catalog.ts';
import { NILE_CAMPUS_LOCATIONS } from '../config/locations.ts';
import { formatDateDDMMYYYY } from '../utils/dateFormatter.ts';
import { filterCampusItems, FeedStatusFilter } from '../utils/feedFilters.ts';

interface FeedViewProps {
  items: CampusItem[];
  claims?: ClaimRecord[];
  lowDataMode: boolean;
  itemsError?: string | null;
  onRetryLoadItems?: () => void;
  onClaimItem: (item: CampusItem) => void;
  onOpenReportModal: () => void;
  onFoundMatch?: (lostItem: CampusItem) => void;
  onFetchHandoverContact?: (itemId: string) => Promise<{ authorName?: string; authorEmail?: string } | null>;
  onApproveClaim?: (claimId: string, itemId: string) => Promise<boolean> | void;
  onRejectClaim?: (claimId: string) => Promise<boolean> | void;
  onUpdateItemStatus?: (itemId: string, status: CampusItem['status']) => Promise<boolean> | void;
  currentUser?: User | null;
  isDemoMode?: boolean;
  onNavigateToLogin?: () => void;
  onLoadMore?: () => void;
  onLoadAll?: () => void;
  hasMoreItems?: boolean;
  isLoadingMoreItems?: boolean;
}

const FILTER_SELECT =
  'w-full text-base sm:text-sm px-3 py-2 rounded-[10px] border border-[#A39A8C] dark:border-[#5A5349] focus:border-[#0F6E6E] bg-white dark:bg-[#141311] text-[#1F1B16] dark:text-[#F5F1EA] min-h-[44px] cursor-pointer';

export const FeedView: React.FC<FeedViewProps> = ({
  items,
  claims = [],
  lowDataMode,
  itemsError,
  onRetryLoadItems,
  onClaimItem,
  onOpenReportModal,
  onFoundMatch,
  onFetchHandoverContact,
  onApproveClaim,
  onRejectClaim,
  onUpdateItemStatus,
  currentUser,
  isDemoMode,
  onNavigateToLogin,
  onLoadMore,
  onLoadAll,
  hasMoreItems = false,
  isLoadingMoreItems = false,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<'all' | ItemType>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedLocation, setSelectedLocation] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<FeedStatusFilter>('all');
  const [selectedDateRange, setSelectedDateRange] = useState<'all' | '24h' | '7d'>('all');
  const [includeDemoSeed, setIncludeDemoSeed] = useState(false);
  const [demoSeedItems, setDemoSeedItems] = useState<CampusItem[]>([]);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [handoverContacts, setHandoverContacts] = useState<Record<string, { authorName?: string; authorEmail?: string } | null>>({});
  const [loadingHandoverId, setLoadingHandoverId] = useState<string | null>(null);
  const [cardActionError, setCardActionError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(searchTerm), 250);
    return () => window.clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    if (debouncedSearch.trim() && hasMoreItems && onLoadAll && !isDemoMode) {
      onLoadAll();
    }
  }, [debouncedSearch, hasMoreItems, onLoadAll, isDemoMode]);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem('nilefound_feed_filters');
      if (!saved) return;
      const state = JSON.parse(saved);
      setSelectedCategory(state.category || 'all');
      setSelectedLocation(state.location || 'all');
      setSelectedType(state.type || 'all');
    } catch {
      try { sessionStorage.removeItem('nilefound_feed_filters'); } catch {}
    }
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(
        'nilefound_feed_filters',
        JSON.stringify({ category: selectedCategory, location: selectedLocation, type: selectedType })
      );
    } catch {
      // Ignore storage quota errors
    }
  }, [selectedCategory, selectedLocation, selectedType]);

  const isAdmin = currentUser?.role === 'admin' || currentUser?.isAdmin;
  const canShowSampleToggle = Boolean(import.meta.env.DEV && isAdmin);

  useEffect(() => {
    if (!import.meta.env.DEV || !includeDemoSeed || !canShowSampleToggle) {
      setDemoSeedItems([]);
      return;
    }
    import('../data/mockItems.ts')
      .then((m) => setDemoSeedItems(m.DEMO_ITEMS))
      .catch(() => setDemoSeedItems([]));
  }, [includeDemoSeed, canShowSampleToggle]);

  const displayableItems = useMemo(() => {
    if (!includeDemoSeed || !canShowSampleToggle || demoSeedItems.length === 0) return items;
    const existingIds = new Set(items.map((it) => it.id));
    const supplemental = demoSeedItems.filter((demo) => !existingIds.has(demo.id));
    return [...items, ...supplemental];
  }, [items, includeDemoSeed, canShowSampleToggle, demoSeedItems]);

  const filteredItems = useMemo(
    () =>
      filterCampusItems(displayableItems, {
        searchTerm: debouncedSearch,
        type: selectedType,
        category: selectedCategory,
        location: selectedLocation,
        status: selectedStatus,
        dateRange: selectedDateRange,
      }),
    [displayableItems, selectedType, selectedCategory, selectedLocation, selectedStatus, selectedDateRange, debouncedSearch]
  );

  const lostItems = useMemo(() => displayableItems.filter((i) => i.type === 'lost'), [displayableItems]);
  const foundItems = useMemo(() => displayableItems.filter((i) => i.type === 'found'), [displayableItems]);

  return (
    <div className="space-y-7">
      <div className="bg-white dark:bg-[#1E1C18] border border-[#C4BBAF] dark:border-[#3E3931] rounded-[12px] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-[0_1px_2px_rgba(31,27,22,0.03),0_8px_24px_rgba(31,27,22,0.035)]">
        <div className="space-y-1">
          <p className="font-serif font-bold text-base text-[#1F1B16] dark:text-[#F5F1EA]">
            Lost your calculator? Someone may have handed it in.
          </p>
          <p className="text-sm text-[#4A443C] dark:text-[#CEC7BB] leading-relaxed">
            Found something? Hand it to Student Affairs or Main Gate Security, then post it here.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {!currentUser && onNavigateToLogin && (
            <button
              type="button"
              onClick={onNavigateToLogin}
              className="inline-flex items-center gap-1.5 bg-white dark:bg-[#28241F] hover:bg-[#F5EFE4] dark:hover:bg-[#332E27] text-[#1F1B16] dark:text-[#F5F1EA] text-sm font-medium px-3.5 py-2 rounded-[10px] border border-[#A39A8C] dark:border-[#5A5349] transition-colors min-h-[44px] cursor-pointer btn-campus"
            >
              <LogIn className="w-4 h-4 text-[#4A443C] dark:text-[#CEC7BB]" />
              <span>Sign In</span>
            </button>
          )}

          <button
            type="button"
            onClick={onOpenReportModal}
            className="inline-flex items-center gap-1.5 bg-[#0F6E6E] hover:bg-[#0C5656] text-white text-sm font-medium px-4 py-2 rounded-[10px] transition-colors min-h-[44px] cursor-pointer btn-campus shadow-xs"
          >
            <span>Post a Notice</span>
          </button>
        </div>
      </div>

      {itemsError && (
        <div role="alert" className="bg-[#FDF2F2] dark:bg-[#2B0E0E] border border-[#F87171]/50 text-[#9B1C1C] dark:text-[#F87171] p-4 rounded-[12px] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-sm">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{itemsError}</span>
          </div>
          {onRetryLoadItems && (
            <button
              type="button"
              onClick={onRetryLoadItems}
              className="min-h-[44px] px-4 bg-white dark:bg-[#1E1C18] text-[#9B1C1C] dark:text-[#F87171] border border-[#F87171]/50 rounded-[10px] text-sm font-medium inline-flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Retry</span>
            </button>
          )}
        </div>
      )}

      <div className="bg-white dark:bg-[#1E1C18] rounded-[12px] border border-[#C4BBAF] dark:border-[#3E3931] p-4 sm:p-5 space-y-4 shadow-[0_1px_2px_rgba(31,27,22,0.03),0_8px_24px_rgba(31,27,22,0.035)]">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <label htmlFor="feed-search-input" className="sr-only">
              Search notices
            </label>
            <Search className="w-4 h-4 text-[#5C554C] dark:text-[#A8A095] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              id="feed-search-input"
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by keyword, item name, or campus building..."
              className="w-full text-base sm:text-sm pl-10 pr-10 py-2.5 rounded-[10px] border border-[#A39A8C] dark:border-[#5A5349] focus:border-[#0F6E6E] bg-[#FAF6EF]/60 dark:bg-[#141311] text-[#1F1B16] dark:text-[#F5F1EA] placeholder:text-[#5C554C] dark:placeholder:text-[#A8A095] transition-colors min-h-[44px]"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[#5C554C] dark:text-[#A8A095] hover:text-[#1F1B16] dark:hover:text-[#F5F1EA] p-2 min-h-[40px] min-w-[40px] flex items-center justify-center cursor-pointer"
                aria-label="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex bg-[#FAF6EF] dark:bg-[#141311] p-1 rounded-[10px] border border-[#A39A8C] dark:border-[#5A5349] shrink-0 gap-1">
            <button
              type="button"
              onClick={() => setSelectedType('all')}
              className={`px-3 py-1.5 text-sm font-medium rounded-[10px] transition-colors min-h-[40px] cursor-pointer ${
                selectedType === 'all'
                  ? 'bg-white dark:bg-[#1E1C18] text-[#1F1B16] dark:text-[#F5F1EA] border border-[#A39A8C] dark:border-[#5A5349] shadow-xs'
                  : 'text-[#4A443C] dark:text-[#CEC7BB] hover:text-[#1F1B16] dark:hover:text-[#F5F1EA]'
              }`}
            >
              All ({displayableItems.length})
            </button>
            <button
              type="button"
              onClick={() => setSelectedType('found')}
              className={`px-3 py-1.5 text-sm font-medium rounded-[10px] transition-colors min-h-[40px] cursor-pointer ${
                selectedType === 'found'
                  ? 'bg-[#2F7D4F] text-white shadow-xs'
                  : 'text-[#4A443C] dark:text-[#CEC7BB] hover:text-[#1F1B16] dark:hover:text-[#F5F1EA]'
              }`}
            >
              Found ({foundItems.length})
            </button>
            <button
              type="button"
              onClick={() => setSelectedType('lost')}
              className={`px-3 py-1.5 text-sm font-medium rounded-[10px] transition-colors min-h-[40px] cursor-pointer ${
                selectedType === 'lost'
                  ? 'bg-[#E8A317] text-[#1F1B16] font-semibold shadow-xs'
                  : 'text-[#4A443C] dark:text-[#CEC7BB] hover:text-[#1F1B16] dark:hover:text-[#F5F1EA]'
              }`}
            >
              Lost ({lostItems.length})
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-[#C4BBAF] dark:border-[#3E3931]">
          <div>
            <label htmlFor="filter-category" className="block text-sm font-medium text-[#4A443C] dark:text-[#CEC7BB] mb-1">
              Category
            </label>
            <select
              id="filter-category"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className={FILTER_SELECT}
            >
              <option value="all">All Categories ({displayableItems.length})</option>
              {CATEGORIES.map((cat) => {
                const count = displayableItems.filter((i) => i.category === cat.id).length;
                return (
                  <option key={cat.id} value={cat.id}>
                    {cat.label} ({count})
                  </option>
                );
              })}
            </select>
          </div>

          <div>
            <label htmlFor="filter-status" className="block text-sm font-medium text-[#4A443C] dark:text-[#CEC7BB] mb-1">
              Status
            </label>
            <select
              id="filter-status"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as FeedStatusFilter)}
              className={FILTER_SELECT}
            >
              <option value="all">All Statuses</option>
              <option value="active">Open</option>
              <option value="claimed">Claim Pending</option>
              <option value="resolved">Returned</option>
              <option value="expired">Expired (&gt;60 days)</option>
            </select>
          </div>

          <div>
            <label htmlFor="filter-date" className="block text-sm font-medium text-[#4A443C] dark:text-[#CEC7BB] mb-1">
              Date Range
            </label>
            <select
              id="filter-date"
              value={selectedDateRange}
              onChange={(e) => setSelectedDateRange(e.target.value as typeof selectedDateRange)}
              className={FILTER_SELECT}
            >
              <option value="all">All Time</option>
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
            </select>
          </div>

          <div>
            <label htmlFor="filter-location" className="block text-sm font-medium text-[#4A443C] dark:text-[#CEC7BB] mb-1">
              Campus Location
            </label>
            <select
              id="filter-location"
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className={FILTER_SELECT}
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

      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between text-sm text-[#5C554C] dark:text-[#A8A095] px-1 gap-2">
          <div className="flex items-center gap-3">
            <span>
              Showing <strong className="text-[#1F1B16] dark:text-[#F5F1EA]">{filteredItems.length}</strong> items
            </span>
            {canShowSampleToggle && (
              <button
                type="button"
                onClick={() => setIncludeDemoSeed(!includeDemoSeed)}
                className={`text-sm px-3 py-1 min-h-[44px] rounded-[10px] border transition-colors cursor-pointer btn-campus ${
                  includeDemoSeed
                    ? 'bg-white dark:bg-[#1E1C18] text-[#1F1B16] dark:text-[#F5F1EA] border-[#8E8579] dark:border-[#5A5349]'
                    : 'bg-[#FAF6EF] dark:bg-[#141311] text-[#5C554C] dark:text-[#A8A095] border-[#C4BBAF] dark:border-[#3E3931]'
                }`}
              >
                {includeDemoSeed ? 'Sample Data Included' : '+ Show Sample Data'}
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            {(searchTerm || selectedCategory !== 'all' || selectedLocation !== 'all' || selectedType !== 'all' || selectedStatus !== 'all' || selectedDateRange !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setSelectedCategory('all');
                  setSelectedLocation('all');
                  setSelectedType('all');
                  setSelectedStatus('all');
                  setSelectedDateRange('all');
                }}
                className="text-sm font-medium text-[#0F6E6E] dark:text-[#199595] hover:underline min-h-[44px] cursor-pointer"
              >
                Reset All Filters
              </button>
            )}

            {lowDataMode && (
              <span className="text-[#0F6E6E] dark:text-[#199595] bg-[#E7F3F3] dark:bg-[#0D2D2D] px-2.5 py-1 rounded-[10px] text-xs font-medium border border-[#0F6E6E]/25">
                Low-Data: Photos hidden
              </span>
            )}
          </div>
        </div>

        {filteredItems.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-[#1E1C18] rounded-[12px] border border-[#C4BBAF] dark:border-[#3E3931] space-y-4 p-6 sm:p-8 max-w-md mx-auto shadow-xs">
            <div className="w-14 h-14 bg-[#FAF6EF] dark:bg-[#141311] border border-[#C4BBAF] dark:border-[#3E3931] text-[#0F6E6E] dark:text-[#199595] rounded-[10px] flex items-center justify-center mx-auto">
              <PackageSearch className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h3 className="font-serif font-bold text-[#1F1B16] dark:text-[#F5F1EA] text-base">
                No matching notices on this page
              </h3>
              <p className="text-sm text-[#4A443C] dark:text-[#CEC7BB] max-w-sm mx-auto leading-relaxed">
                {selectedType === 'found'
                  ? "Found someone's calculator, student ID, keys, or phone on campus? Hand it to Student Affairs, then post it here."
                  : 'Try resetting your filters, loading more notices below, or reporting a new item.'}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setSelectedCategory('all');
                  setSelectedLocation('all');
                  setSelectedType('all');
                  setSelectedStatus('all');
                  setSelectedDateRange('all');
                }}
                className="bg-white dark:bg-[#28241F] hover:bg-[#F5EFE4] dark:hover:bg-[#332E27] text-[#1F1B16] dark:text-[#F5F1EA] text-sm font-medium px-4 py-2.5 rounded-[10px] border border-[#A39A8C] dark:border-[#5A5349] transition-colors min-h-[44px] cursor-pointer btn-campus"
              >
                Reset Filters
              </button>
              <button
                type="button"
                onClick={onOpenReportModal}
                className="bg-[#0F6E6E] hover:bg-[#0C5656] text-white text-sm font-medium px-5 py-2.5 rounded-[10px] transition-colors min-h-[44px] cursor-pointer btn-campus shadow-xs"
              >
                Report an Item
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredItems.map((item, idx) => {
              const isFound = item.type === 'found';
              const isReturned = item.status === 'returned';
              const isVerified = item.status === 'verified';
              const isFoundIdCard = isFound && item.category === 'student_id';
              const displayTitle = isFoundIdCard ? 'A student ID card was found' : item.title;

              const statusLabel = isReturned
                ? 'Returned'
                : isVerified
                ? 'Verified (Handover pending)'
                : item.status === 'claim_requested'
                ? 'Claim pending'
                : item.status === 'expired'
                ? 'Expired'
                : 'Open';

              return (
                <motion.article
                  key={item.id}
                  id={`item-${item.id}`}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileHover={{ y: -3 }}
                  whileTap={{ scale: 0.995 }}
                  transition={{ duration: 0.18, delay: Math.min(idx * 0.03, 0.24) }}
                  className={`notice-card flex flex-col justify-between overflow-hidden ${isReturned ? 'opacity-70' : ''}`}
                >
                  <div>
                    {isFoundIdCard ? (
                      <div className="p-4 bg-[#FAF6EF] dark:bg-[#141311] border-b border-[#C4BBAF] dark:border-[#3E3931] flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-sm text-[#4A443C] dark:text-[#CEC7BB]">
                          <Shield className="w-4 h-4 text-[#0F6E6E] dark:text-[#199595]" />
                          <span className="font-medium">Student ID Record</span>
                        </div>
                        <span className="stamp-found">Found</span>
                      </div>
                    ) : item.imageUrl && !lowDataMode ? (
                      <div className="h-48 sm:h-52 w-full overflow-hidden bg-[#FAF6EF] dark:bg-[#141311] border-b border-[#C4BBAF] dark:border-[#3E3931] relative">
                        <img
                          src={item.imageUrl}
                          alt={item.title}
                          className="w-full h-full object-cover transition-transform duration-200 hover:scale-[1.01]"
                          loading="lazy"
                          decoding="async"
                          width={640}
                          height={360}
                        />
                        <div className="absolute top-3 left-3">
                          <span className={isFound ? 'stamp-found' : 'stamp-lost'}>
                            {isFound ? 'Found' : 'Lost'}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3.5 bg-[#FAF6EF]/60 dark:bg-[#141311] border-b border-[#C4BBAF] dark:border-[#3E3931] flex items-center justify-between">
                        <span className={isFound ? 'stamp-found' : 'stamp-lost'}>
                          {isFound ? 'Found' : 'Lost'}
                        </span>
                        <span className="text-xs font-medium text-[#5C554C] dark:text-[#A8A095]">
                          {statusLabel}
                        </span>
                      </div>
                    )}

                    <div className="p-4 space-y-3">
                      <div>
                        <h3 className="font-serif font-bold text-base text-[#1F1B16] dark:text-[#F5F1EA] leading-snug">
                          {displayTitle}
                        </h3>
                        <p className="text-sm text-[#4A443C] dark:text-[#CEC7BB] line-clamp-2 mt-1 leading-relaxed">
                          {isFoundIdCard
                            ? `Found in the vicinity of ${item.location}. Handed to campus security for safekeeping.`
                            : item.description}
                        </p>
                      </div>

                      <div className="space-y-1.5 text-sm text-[#5C554C] dark:text-[#A8A095] pt-2 border-t border-[#C4BBAF] dark:border-[#3E3931]">
                        <div className="flex items-center gap-1.5 text-[#4A443C] dark:text-[#CEC7BB]">
                          <MapPin className="w-4 h-4 text-[#0F6E6E] dark:text-[#199595] shrink-0" />
                          <span className="font-medium truncate">
                            {item.location}{item.locationDetails ? ` - ${item.locationDetails}` : ''}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-4 h-4 shrink-0" />
                          <span>{isFound ? 'Found' : 'Reported'}: {formatDateDDMMYYYY(item.dateLostOrFound)}</span>
                        </div>
                      </div>

                      {isFound && (
                        <div className="bg-[#FAF6EF] dark:bg-[#141311] border border-[#C4BBAF] dark:border-[#3E3931] rounded-[10px] px-3 py-2 text-sm flex items-center justify-between text-[#4A443C] dark:text-[#CEC7BB]">
                          <span className="text-[#5C554C] dark:text-[#A8A095]">Held at:</span>
                          <span className="font-medium text-[#1F1B16] dark:text-[#F5F1EA]">
                            {isFoundIdCard || item.holdingLocation === 'security_main_gate'
                              ? 'Main Gate Security Post'
                              : item.holdingLocation === 'library_desk'
                              ? 'Library Front Desk'
                              : item.holdingLocation === 'student_affairs_office'
                              ? 'Student Affairs Office'
                              : item.holdingLocation === 'faculty_officer'
                              ? 'Faculty Officer'
                              : 'With Finder'}
                          </span>
                        </div>
                      )}

                      {isFound && item.verificationQuestion && (
                        <div className="text-xs text-[#0F6E6E] dark:text-[#199595] bg-[#E7F3F3] dark:bg-[#0D2D2D] border border-[#0F6E6E]/25 px-2.5 py-1.5 rounded-[10px] flex items-center gap-1.5">
                          <Lock className="w-3.5 h-3.5 shrink-0" />
                          <span>Ownership verification required to claim</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="p-3.5 bg-[#FAF6EF]/50 dark:bg-[#141311]/50 border-t border-[#C4BBAF] dark:border-[#3E3931] space-y-2.5">
                    {(() => {
                      const myApprovedClaim = currentUser
                        ? claims.find((c) => c.itemId === item.id && c.claimantId === currentUser.id && c.status === 'approved')
                        : undefined;
                      const myPendingClaim = currentUser
                        ? claims.find((c) => c.itemId === item.id && c.claimantId === currentUser.id && c.status === 'pending')
                        : undefined;
                      const pendingFinderClaims =
                        currentUser && item.authorId === currentUser.id
                          ? claims.filter((c) => c.itemId === item.id && c.status === 'pending')
                          : [];
                      const handoverInfo = handoverContacts[item.id];

                      return (
                        <>
                          {myApprovedClaim && (
                            <div className="bg-[#EDF7F1] dark:bg-[#0E2417] border border-[#2F7D4F]/30 rounded-[10px] p-3 text-sm space-y-2">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-semibold text-[#1B5633] dark:text-[#75CE9A]">Claim Approved</span>
                                {!handoverInfo && onFetchHandoverContact && (
                                  <button
                                    type="button"
                                    disabled={loadingHandoverId === item.id}
                                    onClick={async () => {
                                      setLoadingHandoverId(item.id);
                                      try {
                                        const info = await onFetchHandoverContact(item.id);
                                        setHandoverContacts((prev) => ({ ...prev, [item.id]: info }));
                                      } catch {
                                        setHandoverContacts((prev) => ({ ...prev, [item.id]: null }));
                                      } finally {
                                        setLoadingHandoverId(null);
                                      }
                                    }}
                                    className="text-sm font-semibold text-[#0F6E6E] dark:text-[#199595] underline cursor-pointer min-h-[44px]"
                                  >
                                    {loadingHandoverId === item.id ? 'Loading…' : 'View handover contact'}
                                  </button>
                                )}
                              </div>
                              {handoverInfo && (
                                <div className="text-[#1F1B16] dark:text-[#F5F1EA] flex items-center gap-1.5 flex-wrap">
                                  <Mail className="w-4 h-4 text-[#0F6E6E] dark:text-[#199595] shrink-0" />
                                  <span>{handoverInfo.authorName || 'Finder'}:</span>
                                  {handoverInfo.authorEmail ? (
                                    <a href={`mailto:${handoverInfo.authorEmail}`} className="font-mono underline text-[#0F6E6E] dark:text-[#199595] break-all">
                                      {handoverInfo.authorEmail}
                                    </a>
                                  ) : (
                                    <span>Collect from {item.holdingLocation.replace(/_/g, ' ')}</span>
                                  )}
                                </div>
                              )}
                            </div>
                          )}

                          {pendingFinderClaims.map((fc) => (
                            <div key={fc.id} className="bg-[#FEF7E9] dark:bg-[#2B210A] border border-[#E8A317]/40 rounded-[10px] p-3 text-sm space-y-2">
                              <p className="font-semibold text-[#7A5000] dark:text-[#F9CF7C]">
                                Claim from {fc.claimantName}
                              </p>
                              <p className="text-[#4A443C] dark:text-[#CEC7BB]">
                                Answer: {fc.submittedAnswer || 'None provided'}
                              </p>
                              {onApproveClaim && onRejectClaim && (
                                <div className="flex gap-2 pt-1">
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      setCardActionError(null);
                                      const ok = await onApproveClaim(fc.id, item.id);
                                      if (ok === false) setCardActionError('Could not approve claim. Check your connection and try again.');
                                    }}
                                    className="flex-1 min-h-[44px] bg-[#0F6E6E] hover:bg-[#0C5656] text-white rounded-[10px] font-medium cursor-pointer"
                                  >
                                    Approve
                                  </button>
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      setCardActionError(null);
                                      const ok = await onRejectClaim(fc.id);
                                      if (ok === false) setCardActionError('Could not reject claim. Check your connection and try again.');
                                    }}
                                    className="flex-1 min-h-[44px] bg-white dark:bg-[#1E1C18] text-[#9B1C1C] dark:text-[#F87171] border border-[#F87171]/50 rounded-[10px] font-medium cursor-pointer"
                                  >
                                    Reject
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}

                          {cardActionError && item.authorId === currentUser?.id && (
                            <p role="alert" className="text-xs text-[#9B1C1C] dark:text-[#F87171]">
                              {cardActionError}
                            </p>
                          )}

                          {isFound ? (
                            <button
                              type="button"
                              onClick={() => onClaimItem(item)}
                              disabled={isReturned || isVerified || item.status === 'expired' || Boolean(myPendingClaim) || Boolean(myApprovedClaim) || item.authorId === currentUser?.id}
                              className={`w-full py-2.5 px-4 rounded-[10px] text-sm font-medium transition-colors flex items-center justify-center gap-2 min-h-[44px] cursor-pointer btn-campus ${
                                isReturned || isVerified || item.status === 'expired' || myPendingClaim || myApprovedClaim || item.authorId === currentUser?.id
                                  ? 'bg-[#E6DFD2]/70 dark:bg-[#2E2A24] text-[#5C554C] dark:text-[#A8A095] cursor-not-allowed'
                                  : 'bg-[#0F6E6E] hover:bg-[#0C5656] text-white active:scale-98 shadow-xs'
                              }`}
                            >
                              <ShieldCheck className="w-4 h-4" />
                              <span>
                                {isReturned
                                  ? 'Item Reunited'
                                  : isVerified
                                  ? 'Verified — Awaiting Handover'
                                  : item.status === 'expired'
                                  ? 'Notice Expired'
                                  : myApprovedClaim
                                  ? 'Claim Approved'
                                  : myPendingClaim
                                  ? 'Claim Submitted'
                                  : item.authorId === currentUser?.id
                                  ? 'Your Found Post'
                                  : 'This is Mine (Claim)'}
                              </span>
                            </button>
                          ) : currentUser && item.authorId === currentUser.id && onUpdateItemStatus ? (
                            <button
                              type="button"
                              disabled={isReturned}
                              onClick={() => onUpdateItemStatus(item.id, item.status === 'expired' ? 'open' : 'returned')}
                              className="w-full text-center py-2 px-3 text-sm text-[#0F6E6E] dark:text-[#199595] bg-[#E7F3F3] dark:bg-[#0D2D2D] hover:bg-[#D5EBEB] rounded-[10px] border border-[#0F6E6E]/30 min-h-[44px] flex items-center justify-center font-semibold cursor-pointer disabled:opacity-60 transition-colors"
                            >
                              {isReturned
                                ? 'Item Marked Found'
                                : item.status === 'expired'
                                ? 'Renew Lost Notice'
                                : 'Mark as Found / Returned'}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => (onFoundMatch ? onFoundMatch(item) : onOpenReportModal())}
                              disabled={isReturned || item.status === 'expired'}
                              className="w-full text-center py-2 px-3 text-sm text-[#7A5000] dark:text-[#F9CF7C] bg-[#FEF7E9] dark:bg-[#2B210A] hover:bg-[#FCEEC9] dark:hover:bg-[#3A2B0D] rounded-[10px] border border-[#E8A317]/40 min-h-[44px] flex items-center justify-center font-semibold cursor-pointer disabled:opacity-60 transition-colors"
                            >
                              {isReturned ? 'Item Returned' : 'I Found This — Post Match'}
                            </button>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </motion.article>
              );
            })}
          </div>
        )}

        {onLoadMore && hasMoreItems && (
          <div className="flex justify-center pt-5">
            <button
              type="button"
              onClick={onLoadMore}
              disabled={isLoadingMoreItems}
              className="min-h-[44px] rounded-[10px] border border-[#A39A8C] dark:border-[#5A5349] bg-white dark:bg-[#1E1C18] hover:bg-[#FAF6EF] dark:hover:bg-[#28241F] px-5 text-sm font-medium text-[#1F1B16] dark:text-[#F5F1EA] disabled:opacity-60 cursor-pointer btn-campus"
            >
              {isLoadingMoreItems ? 'Loading more…' : 'Load more notices'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
