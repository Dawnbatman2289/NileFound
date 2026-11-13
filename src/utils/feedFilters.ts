import { CampusItem, ItemType } from '../types/index.ts';

export type FeedStatusFilter = 'all' | 'active' | 'claimed' | 'resolved' | 'expired';
export type FeedDateFilter = 'all' | '24h' | '7d';

export interface FeedFilterOptions {
  searchTerm?: string;
  type?: 'all' | ItemType;
  category?: string;
  location?: string;
  status?: FeedStatusFilter;
  dateRange?: FeedDateFilter;
  now?: number;
}

export function filterCampusItems(items: CampusItem[], options: FeedFilterOptions = {}): CampusItem[] {
  const search = options.searchTerm?.trim().toLowerCase() || '';
  const now = options.now ?? Date.now();
  const dateLimit = options.dateRange === '24h'
    ? 24 * 60 * 60 * 1000
    : options.dateRange === '7d'
      ? 7 * 24 * 60 * 60 * 1000
      : null;

  return items.filter((item) => {
    if (options.type && options.type !== 'all' && item.type !== options.type) return false;
    if (options.category && options.category !== 'all' && item.category !== options.category) return false;
    if (options.location && options.location !== 'all' && item.location !== options.location) return false;
    if ((!options.status || options.status === 'all') && !search && item.status === 'expired') return false;
    if (options.status === 'active' && item.status !== 'open') return false;
    if (options.status === 'claimed' && item.status !== 'claim_requested' && item.status !== 'verified') return false;
    if (options.status === 'resolved' && item.status !== 'returned') return false;
    if (options.status === 'expired' && item.status !== 'expired') return false;

    if (dateLimit !== null) {
      const age = now - new Date(item.createdAt).getTime();
      if (age < 0 || age > dateLimit) return false;
    }

    if (search) {
      const title = item.type === 'found' && item.category === 'student_id'
        ? 'a student id card was found'
        : item.title.toLowerCase();
      const searchable = `${title} ${item.description} ${item.location} ${item.locationDetails || ''}`.toLowerCase();
      if (!searchable.includes(search)) return false;
    }

    return true;
  });
}
