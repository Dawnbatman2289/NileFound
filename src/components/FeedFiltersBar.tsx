import React from 'react';
import { Search, X } from 'lucide-react';
import { CampusItem, ItemType } from '../types/index.ts';
import { CATEGORIES, ITEM_EXPIRY_DAYS } from '../config/catalog.ts';
import { NILE_CAMPUS_LOCATIONS } from '../config/locations.ts';
import type { FeedStatusFilter } from '../utils/feedFilters.ts';

interface FeedFiltersBarProps {
  displayableItems: CampusItem[];
  foundCount: number;
  lostCount: number;
  searchTerm: string;
  selectedType: 'all' | ItemType;
  selectedCategory: string;
  selectedStatus: FeedStatusFilter;
  selectedDateRange: 'all' | '24h' | '7d';
  selectedLocation: string;
  onSearchChange: (val: string) => void;
  onTypeChange: (val: 'all' | ItemType) => void;
  onCategoryChange: (val: string) => void;
  onStatusChange: (val: FeedStatusFilter) => void;
  onDateRangeChange: (val: 'all' | '24h' | '7d') => void;
  onLocationChange: (val: string) => void;
}

const FILTER_SELECT =
  'w-full text-base sm:text-sm px-3 py-2 rounded-[10px] border border-[#857C70] dark:border-[#787065] focus:border-[#0F6E6E] bg-white dark:bg-[#141311] text-[#1F1B16] dark:text-[#F5F1EA] min-h-[44px] cursor-pointer';

export const FeedFiltersBar: React.FC<FeedFiltersBarProps> = ({
  displayableItems,
  foundCount,
  lostCount,
  searchTerm,
  selectedType,
  selectedCategory,
  selectedStatus,
  selectedDateRange,
  selectedLocation,
  onSearchChange,
  onTypeChange,
  onCategoryChange,
  onStatusChange,
  onDateRangeChange,
  onLocationChange,
}) => (
  <div className="bg-white dark:bg-[#1E1C18] rounded-[12px] border border-[#C4BBAF] dark:border-[#3E3931] p-4 sm:p-5 space-y-4 shadow-[0_1px_2px_rgba(31,27,22,0.03),0_8px_24px_rgba(31,27,22,0.035)]">
    <div className="flex flex-col sm:flex-row gap-3">
      <div className="relative flex-1">
        <label htmlFor="feed-search-input" className="sr-only">Search notices</label>
        <Search className="w-4 h-4 text-[#5C554C] dark:text-[#A8A095] absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          id="feed-search-input"
          type="text"
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search by keyword, item name, or campus building..."
          className="w-full text-base sm:text-sm pl-10 pr-10 py-2.5 rounded-[10px] border border-[#857C70] dark:border-[#787065] focus:border-[#0F6E6E] bg-[#FAF6EF]/60 dark:bg-[#141311] text-[#1F1B16] dark:text-[#F5F1EA] placeholder:text-[#5C554C] dark:placeholder:text-[#A8A095] transition-colors min-h-[44px]"
        />
        {searchTerm && (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[#5C554C] dark:text-[#A8A095] hover:text-[#1F1B16] dark:hover:text-[#F5F1EA] p-2 min-h-[40px] min-w-[40px] flex items-center justify-center cursor-pointer"
            aria-label="Clear search"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="flex bg-[#FAF6EF] dark:bg-[#141311] p-1 rounded-[10px] border border-[#857C70] dark:border-[#787065] shrink-0 gap-1">
        <button
          type="button"
          onClick={() => onTypeChange('all')}
          className={`px-3 py-1.5 text-sm font-medium rounded-[10px] transition-colors min-h-[40px] cursor-pointer ${
            selectedType === 'all' ? 'bg-white dark:bg-[#1E1C18] text-[#1F1B16] dark:text-[#F5F1EA] border border-[#857C70] dark:border-[#787065] shadow-xs' : 'text-[#4A443C] dark:text-[#CEC7BB] hover:text-[#1F1B16] dark:hover:text-[#F5F1EA]'
          }`}
        >
          All ({displayableItems.length})
        </button>
        <button
          type="button"
          onClick={() => onTypeChange('found')}
          className={`px-3 py-1.5 text-sm font-medium rounded-[10px] transition-colors min-h-[40px] cursor-pointer ${
            selectedType === 'found' ? 'bg-[#2F7D4F] text-white shadow-xs' : 'text-[#4A443C] dark:text-[#CEC7BB] hover:text-[#1F1B16] dark:hover:text-[#F5F1EA]'
          }`}
        >
          Found ({foundCount})
        </button>
        <button
          type="button"
          onClick={() => onTypeChange('lost')}
          className={`px-3 py-1.5 text-sm font-medium rounded-[10px] transition-colors min-h-[40px] cursor-pointer ${
            selectedType === 'lost' ? 'bg-[#E8A317] text-[#1F1B16] font-semibold shadow-xs' : 'text-[#4A443C] dark:text-[#CEC7BB] hover:text-[#1F1B16] dark:hover:text-[#F5F1EA]'
          }`}
        >
          Lost ({lostCount})
        </button>
      </div>
    </div>

    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-[#C4BBAF] dark:border-[#3E3931]">
      <div>
        <label htmlFor="filter-category" className="block text-sm font-medium text-[#4A443C] dark:text-[#CEC7BB] mb-1">Category</label>
        <select id="filter-category" value={selectedCategory} onChange={(e) => onCategoryChange(e.target.value)} className={FILTER_SELECT}>
          <option value="all">All Categories ({displayableItems.length})</option>
          {CATEGORIES.map((cat) => (
            <option key={cat.id} value={cat.id}>{cat.label} ({displayableItems.filter((i) => i.category === cat.id).length})</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="filter-status" className="block text-sm font-medium text-[#4A443C] dark:text-[#CEC7BB] mb-1">Status</label>
        <select id="filter-status" value={selectedStatus} onChange={(e) => onStatusChange(e.target.value as FeedStatusFilter)} className={FILTER_SELECT}>
          <option value="all">All Statuses</option>
          <option value="active">Open</option>
          <option value="claimed">Claim Pending</option>
          <option value="resolved">Returned</option>
          <option value="expired">Expired (&gt;{ITEM_EXPIRY_DAYS} days)</option>
        </select>
      </div>
      <div>
        <label htmlFor="filter-date" className="block text-sm font-medium text-[#4A443C] dark:text-[#CEC7BB] mb-1">Date Range</label>
        <select id="filter-date" value={selectedDateRange} onChange={(e) => onDateRangeChange(e.target.value as 'all' | '24h' | '7d')} className={FILTER_SELECT}>
          <option value="all">All Time</option>
          <option value="24h">Last 24 Hours</option>
          <option value="7d">Last 7 Days</option>
        </select>
      </div>
      <div>
        <label htmlFor="filter-location" className="block text-sm font-medium text-[#4A443C] dark:text-[#CEC7BB] mb-1">Campus Location</label>
        <select id="filter-location" value={selectedLocation} onChange={(e) => onLocationChange(e.target.value)} className={FILTER_SELECT}>
          <option value="all">All Campus Locations</option>
          {NILE_CAMPUS_LOCATIONS.map((loc) => <option key={loc} value={loc}>{loc}</option>)}
        </select>
      </div>
    </div>
  </div>
);
