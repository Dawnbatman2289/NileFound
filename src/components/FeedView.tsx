/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * NileFound Campus Feed
 */

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { LogIn, PackageSearch, AlertTriangle, RotateCcw } from 'lucide-react';
import { CampusItem, ClaimRecord, ItemType, User } from '../types/index.ts';
import { filterCampusItems, FeedStatusFilter } from '../utils/feedFilters.ts';
import { reportError } from './ErrorBoundary.tsx';
import { ItemCard } from './ItemCard.tsx';
import { FeedFiltersBar } from './FeedFiltersBar.tsx';
import { FeedDetailModal } from './FeedDetailModal.tsx';

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
  onFetchFullPhoto?: (itemId: string) => Promise<string | null>;
  onFetchClaimPrivateDetails?: (itemId: string, claimId: string) => Promise<void>;
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

const FeedEmptyState: React.FC<{
  selectedType: 'all' | ItemType;
  onResetFilters: () => void;
  onOpenReportModal: () => void;
}> = ({ selectedType, onResetFilters, onOpenReportModal }) => (
  <div className="text-center py-12 bg-white dark:bg-[#1E1C18] rounded-[12px] border border-[#C4BBAF] dark:border-[#3E3931] space-y-4 p-6 sm:p-8 max-w-md mx-auto shadow-xs">
    <div className="w-14 h-14 bg-[#FAF6EF] dark:bg-[#141311] border border-[#C4BBAF] dark:border-[#3E3931] text-[#0F6E6E] dark:text-[#199595] rounded-[10px] flex items-center justify-center mx-auto">
      <PackageSearch className="w-7 h-7" />
    </div>
    <div className="space-y-1">
      <h3 className="font-serif font-bold text-[#1F1B16] dark:text-[#F5F1EA] text-base">No matching notices on this page</h3>
      <p className="text-sm text-[#4A443C] dark:text-[#CEC7BB] max-w-sm mx-auto leading-relaxed">
        {selectedType === 'found'
          ? "Found someone's calculator, student ID, keys, or phone on campus? Hand it to Student Affairs, then post it here."
          : 'Try resetting your filters, loading more notices below, or reporting a new item.'}
      </p>
    </div>
    <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
      <button type="button" onClick={onResetFilters} className="bg-white dark:bg-[#28241F] hover:bg-[#F5EFE4] dark:hover:bg-[#332E27] text-[#1F1B16] dark:text-[#F5F1EA] text-sm font-medium px-4 py-2.5 rounded-[10px] border border-[#857C70] dark:border-[#787065] transition-colors min-h-[44px] cursor-pointer btn-campus">Reset Filters</button>
      <button type="button" onClick={onOpenReportModal} className="bg-[#0F6E6E] hover:bg-[#0C5656] text-white text-sm font-medium px-5 py-2.5 rounded-[10px] transition-colors min-h-[44px] cursor-pointer btn-campus shadow-xs">Report an Item</button>
    </div>
  </div>
);

function getItemClaimContext(claims: ClaimRecord[], item: CampusItem, currentUserId?: string) {
  if (!currentUserId) return { myApprovedClaim: undefined, myPendingClaim: undefined, pendingFinderClaims: [] };
  return {
    myApprovedClaim: claims.find((c) => c.itemId === item.id && c.claimantId === currentUserId && c.status === 'approved'),
    myPendingClaim: claims.find((c) => c.itemId === item.id && c.claimantId === currentUserId && c.status === 'pending'),
    pendingFinderClaims: item.authorId === currentUserId ? claims.filter((c) => c.itemId === item.id && c.status === 'pending') : [],
  };
}

export const FeedView: React.FC<FeedViewProps> = ({
  items, claims = [], lowDataMode, itemsError, onRetryLoadItems, onClaimItem, onOpenReportModal, onFoundMatch,
  onFetchHandoverContact, onFetchFullPhoto, onFetchClaimPrivateDetails, onApproveClaim, onRejectClaim, onUpdateItemStatus,
  currentUser, isDemoMode, onNavigateToLogin, onLoadMore, onLoadAll, hasMoreItems = false, isLoadingMoreItems = false,
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
  const [detailItem, setDetailItem] = useState<CampusItem | null>(null);
  const [detailPhotoUrl, setDetailPhotoUrl] = useState<string | null>(null);
  const [isLoadingDetailPhoto, setIsLoadingDetailPhoto] = useState(false);
  const [detailPhotoError, setDetailPhotoError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(searchTerm), 250);
    return () => window.clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    if (debouncedSearch.trim() && hasMoreItems && onLoadAll && !isDemoMode) onLoadAll();
  }, [debouncedSearch, hasMoreItems, onLoadAll, isDemoMode]);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem('nilefound_feed_filters');
      if (!saved) return;
      const state = JSON.parse(saved);
      setSelectedCategory(state.category || 'all');
      setSelectedLocation(state.location || 'all');
      setSelectedType(state.type || 'all');
    } catch (err) {
      reportError('Restore feed filters failed', err);
      try { sessionStorage.removeItem('nilefound_feed_filters'); } catch (rmErr) { reportError('Clear corrupt feed filters failed', rmErr); }
    }
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem('nilefound_feed_filters', JSON.stringify({ category: selectedCategory, location: selectedLocation, type: selectedType }));
    } catch {
      // Ignore storage quota errors
    }
  }, [selectedCategory, selectedLocation, selectedType]);

  const isAdmin = currentUser?.role === 'admin' || currentUser?.isAdmin;
  const canShowSampleToggle = Boolean(import.meta.env.DEV && isAdmin);

  useEffect(() => {
    if (!import.meta.env.DEV || !includeDemoSeed || !canShowSampleToggle) return setDemoSeedItems([]);
    import('../data/mockItems.ts')
      .then((m) => setDemoSeedItems(m.DEMO_ITEMS))
      .catch((err) => { reportError('Load sample feed items failed', err); setDemoSeedItems([]); });
  }, [includeDemoSeed, canShowSampleToggle]);

  useEffect(() => {
    if (!detailItem || lowDataMode || detailItem.category === 'student_id') {
      setDetailPhotoUrl(null);
      setDetailPhotoError(null);
      setIsLoadingDetailPhoto(false);
      return;
    }
    if (detailItem.imageUrl) return setDetailPhotoUrl(detailItem.imageUrl);
    if (!detailItem.thumbUrl || !onFetchFullPhoto || isDemoMode) return setDetailPhotoUrl(detailItem.thumbUrl || null);

    let cancelled = false;
    setIsLoadingDetailPhoto(true);
    setDetailPhotoError(null);
    onFetchFullPhoto(detailItem.id)
      .then((fullUrl) => { if (!cancelled) setDetailPhotoUrl(fullUrl || detailItem.thumbUrl || null); })
      .catch((err) => {
        if (!cancelled) {
          reportError('Fetch detail full photo failed', err);
          setDetailPhotoError('Could not load full-resolution photo. Showing thumbnail.');
          setDetailPhotoUrl(detailItem.thumbUrl || null);
        }
      })
      .finally(() => { if (!cancelled) setIsLoadingDetailPhoto(false); });
    return () => { cancelled = true; };
  }, [detailItem, lowDataMode, onFetchFullPhoto, isDemoMode]);

  const handleRequestHandoverContact = useCallback(async (itemId: string) => {
    if (!onFetchHandoverContact) return;
    setLoadingHandoverId(itemId);
    try {
      const info = await onFetchHandoverContact(itemId);
      setHandoverContacts((prev) => ({ ...prev, [itemId]: info }));
    } catch {
      setHandoverContacts((prev) => ({ ...prev, [itemId]: null }));
    } finally {
      setLoadingHandoverId(null);
    }
  }, [onFetchHandoverContact]);

  const resetFilters = () => {
    setSearchTerm('');
    setSelectedCategory('all');
    setSelectedLocation('all');
    setSelectedType('all');
    setSelectedStatus('all');
    setSelectedDateRange('all');
  };

  const displayableItems = useMemo(() => {
    if (!includeDemoSeed || !canShowSampleToggle || demoSeedItems.length === 0) return items;
    const existingIds = new Set(items.map((it) => it.id));
    return [...items, ...demoSeedItems.filter((demo) => !existingIds.has(demo.id))];
  }, [items, includeDemoSeed, canShowSampleToggle, demoSeedItems]);

  const filteredItems = useMemo(
    () => filterCampusItems(displayableItems, { searchTerm: debouncedSearch, type: selectedType, category: selectedCategory, location: selectedLocation, status: selectedStatus, dateRange: selectedDateRange }),
    [displayableItems, selectedType, selectedCategory, selectedLocation, selectedStatus, selectedDateRange, debouncedSearch]
  );

  const lostCount = useMemo(() => displayableItems.filter((i) => i.type === 'lost').length, [displayableItems]);
  const foundCount = useMemo(() => displayableItems.filter((i) => i.type === 'found').length, [displayableItems]);
  const hasActiveFilters = [searchTerm, selectedCategory !== 'all', selectedLocation !== 'all', selectedType !== 'all', selectedStatus !== 'all', selectedDateRange !== 'all'].some(Boolean);

  return (
    <div className="space-y-7">
      <div className="bg-white dark:bg-[#1E1C18] border border-[#C4BBAF] dark:border-[#3E3931] rounded-[12px] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-[0_1px_2px_rgba(31,27,22,0.03),0_8px_24px_rgba(31,27,22,0.035)]">
        <div className="space-y-1">
          <p className="font-serif font-bold text-base text-[#1F1B16] dark:text-[#F5F1EA]">Lost your calculator? Someone may have handed it in.</p>
          <p className="text-sm text-[#4A443C] dark:text-[#CEC7BB] leading-relaxed">Found something? Hand it to Student Affairs or Main Gate Security, then post it here.</p>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          {!currentUser && onNavigateToLogin && (
            <button type="button" onClick={onNavigateToLogin} className="inline-flex items-center gap-1.5 bg-white dark:bg-[#28241F] hover:bg-[#F5EFE4] dark:hover:bg-[#332E27] text-[#1F1B16] dark:text-[#F5F1EA] text-sm font-medium px-3.5 py-2 rounded-[10px] border border-[#857C70] dark:border-[#787065] transition-colors min-h-[44px] cursor-pointer btn-campus">
              <LogIn className="w-4 h-4 text-[#4A443C] dark:text-[#CEC7BB]" />
              <span>Sign In</span>
            </button>
          )}
          <button type="button" onClick={onOpenReportModal} className="inline-flex items-center gap-1.5 bg-[#0F6E6E] hover:bg-[#0C5656] text-white text-sm font-medium px-4 py-2 rounded-[10px] transition-colors min-h-[44px] cursor-pointer btn-campus shadow-xs">
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
            <button type="button" onClick={onRetryLoadItems} className="min-h-[44px] px-4 bg-white dark:bg-[#1E1C18] text-[#9B1C1C] dark:text-[#F87171] border border-[#F87171]/50 rounded-[10px] text-sm font-medium inline-flex items-center gap-1.5 cursor-pointer">
              <RotateCcw className="w-4 h-4" />
              <span>Retry</span>
            </button>
          )}
        </div>
      )}

      <FeedFiltersBar
        displayableItems={displayableItems}
        foundCount={foundCount}
        lostCount={lostCount}
        searchTerm={searchTerm}
        selectedType={selectedType}
        selectedCategory={selectedCategory}
        selectedStatus={selectedStatus}
        selectedDateRange={selectedDateRange}
        selectedLocation={selectedLocation}
        onSearchChange={setSearchTerm}
        onTypeChange={setSelectedType}
        onCategoryChange={setSelectedCategory}
        onStatusChange={setSelectedStatus}
        onDateRangeChange={setSelectedDateRange}
        onLocationChange={setSelectedLocation}
      />

      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between text-sm text-[#5C554C] dark:text-[#A8A095] px-1 gap-2">
          <div className="flex items-center gap-3">
            <span>Showing <strong className="text-[#1F1B16] dark:text-[#F5F1EA]">{filteredItems.length}</strong> items</span>
            {canShowSampleToggle && (
              <button type="button" onClick={() => setIncludeDemoSeed(!includeDemoSeed)} className={`text-sm px-3 py-1 min-h-[44px] rounded-[10px] border transition-colors cursor-pointer btn-campus ${includeDemoSeed ? 'bg-white dark:bg-[#1E1C18] text-[#1F1B16] dark:text-[#F5F1EA] border-[#857C70] dark:border-[#787065]' : 'bg-[#FAF6EF] dark:bg-[#141311] text-[#5C554C] dark:text-[#A8A095] border-[#C4BBAF] dark:border-[#3E3931]'}`}>
                {includeDemoSeed ? 'Sample Data Included' : '+ Show Sample Data'}
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            {hasActiveFilters && <button type="button" onClick={resetFilters} className="text-sm font-medium text-[#0F6E6E] dark:text-[#199595] hover:underline min-h-[44px] cursor-pointer">Reset All Filters</button>}
            {lowDataMode && <span className="text-[#0F6E6E] dark:text-[#199595] bg-[#E7F3F3] dark:bg-[#0D2D2D] px-2.5 py-1 rounded-[10px] text-xs font-medium border border-[#0F6E6E]/25">Low-Data: Photos hidden</span>}
          </div>
        </div>

        {filteredItems.length === 0 ? (
          <FeedEmptyState selectedType={selectedType} onResetFilters={resetFilters} onOpenReportModal={onOpenReportModal} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredItems.map((item, idx) => {
              const claimCtx = getItemClaimContext(claims, item, currentUser?.id);
              return (
                <ItemCard
                  key={item.id}
                  item={item}
                  index={idx}
                  lowDataMode={lowDataMode}
                  currentUser={currentUser}
                  isDemoMode={isDemoMode}
                  myApprovedClaim={claimCtx.myApprovedClaim}
                  myPendingClaim={claimCtx.myPendingClaim}
                  pendingFinderClaims={claimCtx.pendingFinderClaims}
                  handoverInfo={handoverContacts[item.id]}
                  isLoadingHandover={loadingHandoverId === item.id}
                  onSelectDetail={setDetailItem}
                  onClaimItem={onClaimItem}
                  onOpenReportModal={onOpenReportModal}
                  onFoundMatch={onFoundMatch}
                  onRequestHandoverContact={onFetchHandoverContact ? handleRequestHandoverContact : undefined}
                  onFetchClaimPrivateDetails={onFetchClaimPrivateDetails}
                  onApproveClaim={onApproveClaim}
                  onRejectClaim={onRejectClaim}
                  onUpdateItemStatus={onUpdateItemStatus}
                />
              );
            })}
          </div>
        )}

        {onLoadMore && hasMoreItems && (
          <div className="flex justify-center pt-5">
            <button type="button" onClick={onLoadMore} disabled={isLoadingMoreItems} className="min-h-[44px] rounded-[10px] border border-[#857C70] dark:border-[#787065] bg-white dark:bg-[#1E1C18] hover:bg-[#FAF6EF] dark:hover:bg-[#28241F] px-5 text-sm font-medium text-[#1F1B16] dark:text-[#F5F1EA] disabled:opacity-60 cursor-pointer btn-campus">
              {isLoadingMoreItems ? 'Loading more…' : 'Load more notices'}
            </button>
          </div>
        )}
      </div>

      {detailItem && (
        <FeedDetailModal detailItem={detailItem} lowDataMode={lowDataMode} detailPhotoUrl={detailPhotoUrl} isLoadingDetailPhoto={isLoadingDetailPhoto} detailPhotoError={detailPhotoError} onClose={() => setDetailItem(null)} />
      )}
    </div>
  );
};
