import test from 'node:test';
import assert from 'node:assert/strict';
import { NILE_CAMPUS_LOCATIONS } from '../src/config/locations.ts';
import { filterCampusItems } from '../src/utils/feedFilters.ts';
import { sanitizeCsvCell } from '../src/utils/csv.ts';
import { getTodayWatIsoDate } from '../src/utils/dateFormatter.ts';
import { isSupportedImageFile } from '../src/utils/imageCompressor.ts';
import type { CampusItem } from '../src/types/index.ts';

const now = Date.parse('2026-11-07T12:00:00.000Z');
const item = (overrides: Partial<CampusItem> = {}): CampusItem => ({
  id: 'item-1',
  type: 'found',
  title: 'Calculator',
  category: 'calculator',
  description: 'Black calculator',
  location: 'Nile Main Library',
  locationDetails: 'Room 205',
  dateLostOrFound: '2026-11-07',
  status: 'open',
  holdingLocation: 'finder_holding',
  authorId: 'owner-1',
  createdAt: new Date(now - 60 * 60 * 1000).toISOString(),
  ...overrides,
});

test('official campus locations include required academic, hostel, and service points', () => {
  for (const location of ['Red Volta Hostel', 'Congo House (Engineering & Computing)', 'Central Cafeteria']) {
    assert.ok(NILE_CAMPUS_LOCATIONS.includes(location as (typeof NILE_CAMPUS_LOCATIONS)[number]));
  }
});

test('combined feed filters require every selected criterion to match', () => {
  const matching = item();
  const nonMatching = item({
    id: 'item-2',
    category: 'keys',
    location: 'Red Volta Hostel',
    status: 'returned',
  });
  assert.deepEqual(
    filterCampusItems([matching, nonMatching], {
      searchTerm: 'room 205',
      category: 'calculator',
      location: 'Nile Main Library',
      status: 'active',
      dateRange: '24h',
      now,
    }).map((entry) => entry.id),
    ['item-1'],
  );
});

test('empty filter results are deterministic', () => {
  assert.equal(filterCampusItems([item()], { searchTerm: 'does-not-exist', now }).length, 0);
});

test('image guard accepts jpg/jpeg and rejects unsafe or oversized uploads', () => {
  assert.equal(isSupportedImageFile({ type: 'image/jpeg', size: 1024 }), true);
  assert.equal(isSupportedImageFile({ type: 'image/jpg', size: 1024 }), true);
  assert.equal(isSupportedImageFile({ type: 'application/pdf', size: 1024 }), false);
  assert.equal(isSupportedImageFile({ type: 'image/jpeg', size: 5 * 1024 * 1024 + 1 }), false);
});

test('claimed status filter includes both claim_requested and verified items', () => {
  const openItem = item({ id: 'open-1', status: 'open' });
  const requestedItem = item({ id: 'req-1', status: 'claim_requested' });
  const verifiedItem = item({ id: 'ver-1', status: 'verified' });
  const returnedItem = item({ id: 'ret-1', status: 'returned' });
  assert.deepEqual(
    filterCampusItems([openItem, requestedItem, verifiedItem, returnedItem], {
      status: 'claimed',
      now,
    }).map((entry) => entry.id),
    ['req-1', 'ver-1'],
  );
});

test('CSV export neutralizes formula injection and quotes fields', () => {
  assert.equal(sanitizeCsvCell('=HYPERLINK("https://attacker")'), '"\'=HYPERLINK(""https://attacker"")"');
  assert.equal(sanitizeCsvCell('\t=SUM(A1:A2)'), '"\'\t=SUM(A1:A2)"');
  assert.equal(sanitizeCsvCell('\r=SUM(A1:A2)'), '"\'\r=SUM(A1:A2)"');
  assert.equal(sanitizeCsvCell('Nile Main Library'), '"Nile Main Library"');
});

test('WAT calendar date helper uses Africa/Lagos timezone across UTC midnight', () => {
  // 23:30 UTC on 2026-11-12 is 00:30 WAT on 2026-11-13
  const watDate = getTodayWatIsoDate(new Date('2026-11-12T23:30:00.000Z'));
  assert.equal(watDate, '2026-11-13');
});
