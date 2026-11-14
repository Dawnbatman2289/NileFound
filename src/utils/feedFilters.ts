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

const STATUS_LABELS = new Map<FeedStatusFilter, ReadonlyArray<CampusItem['status']>>([
  ['active', ['open']],
  ['claimed', ['claim_requested', 'verified']],
  ['resolved', ['returned']],
  ['expired', ['expired']],
]);

function matchesStatusFilter(
  itemStatus: CampusItem['status'],
  statusFilter: FeedStatusFilter | undefined,
  hasSearch: boolean
): boolean {
  if (!statusFilter || statusFilter === 'all') {
    return hasSearch || itemStatus !== 'expired';
  }
  const allowed = STATUS_LABELS.get(statusFilter);
  return allowed ? allowed.includes(itemStatus) : true;
}

function getDateLimitMs(dateRange: FeedDateFilter | undefined): number | null {
  if (dateRange === '24h') return 24 * 60 * 60 * 1000;
  if (dateRange === '7d') return 7 * 24 * 60 * 60 * 1000;
  return null;
}

function matchesSearchTerm(item: CampusItem, search: string): boolean {
  if (!search) return true;
  const title = item.type === 'found' && item.category === 'student_id'
    ? 'a student id card was found'
    : item.title.toLowerCase();
  const searchable = `${title} ${item.description} ${item.location} ${item.locationDetails ?? ''}`.toLowerCase();
  return searchable.includes(search);
}

export function filterCampusItems(items: CampusItem[], options: FeedFilterOptions = {}): CampusItem[] {
  const search = options.searchTerm?.trim().toLowerCase() ?? '';
  const now = options.now ?? Date.now();
  const dateLimit = getDateLimitMs(options.dateRange);

  return items.filter((item) => {
    if (options.type && options.type !== 'all' && item.type !== options.type) return false;
    if (options.category && options.category !== 'all' && item.category !== options.category) return false;
    if (options.location && options.location !== 'all' && item.location !== options.location) return false;
    if (!matchesStatusFilter(item.status, options.status, Boolean(search))) return false;
    if (dateLimit !== null) {
      const age = now - new Date(item.createdAt).getTime();
      if (age < 0 || age > dateLimit) return false;
    }
    return matchesSearchTerm(item, search);
  });
}
