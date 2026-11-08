import test from 'node:test';
import assert from 'node:assert/strict';
import { NILE_CAMPUS_LOCATIONS } from '../src/config/locations.ts';
import { filterCampusItems } from '../src/utils/feedFilters.ts';
import { sanitizeCsvCell } from '../src/utils/csv.ts';
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

test('image guard rejects unsafe or oversized uploads', () => {
  assert.equal(isSupportedImageFile({ type: 'image/jpeg', size: 1024 }), true);
  assert.equal(isSupportedImageFile({ type: 'application/pdf', size: 1024 }), false);
  assert.equal(isSupportedImageFile({ type: 'image/jpeg', size: 5 * 1024 * 1024 + 1 }), false);
});

test('CSV export neutralizes formula injection and quotes fields', () => {
  assert.equal(sanitizeCsvCell('=HYPERLINK("https://attacker")'), '"\'=HYPERLINK(""https://attacker"")"');
  assert.equal(sanitizeCsvCell('Nile Main Library'), '"Nile Main Library"');
});
