/**
 * Campus location list, "Other place" handling, filtering, matching and report validation.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getUnlistedLocationCounts,
  isCustomLocation,
  isListedLocation,
  MAX_CUSTOM_LOCATION_LENGTH,
  NILE_CAMPUS_LOCATIONS,
  NILE_LOCATION_GROUPS,
  normalizeCustomLocation,
  OTHER_LOCATION_FILTER_VALUE,
  OTHER_LOCATION_VALUE,
} from '../src/config/locations.ts';
import { filterCampusItems } from '../src/utils/feedFilters.ts';
import { calculateLocationProximity } from '../src/utils/matching.ts';
import { validateReportInputs } from '../src/hooks/useReportDraft.ts';
import { DEMO_ITEMS } from '../src/data/mockItems.ts';
import type { CampusItem } from '../src/types/index.ts';

// Reports already saved in Firestore store these exact strings. They must never be renamed or removed.
const LEGACY_LOCATIONS = [
  'Congo House (Engineering & Computing)',
  'Volta Building (Health Sciences)',
  'Limpopo Bay (Law & Postgrad)',
  'Niger House',
  'Ubangi House (STEM Labs)',
  'Block A',
  'Block B',
  'Block C',
  'Red Volta Hostel',
  'Blue Nile Hostel',
  'Orange Hostel',
  'Zambezi Hostel',
  'Lake Chad Hostel',
  'Asokoro Hostel',
  'Victoria Estate Hostels',
  'Moat Haven Estate',
  'Nile House (Admin)',
  'Nile Main Library',
  'University Clinic',
  'Student Centre',
  'Sports Complex',
  'Central Cafeteria',
  'Picnic Arena & Love Garden',
  'Mini Marts',
  'Main Campus Gate',
];

const item = (location: string, overrides: Partial<CampusItem> = {}): CampusItem =>
  ({
    id: `item-${location}`,
    type: 'lost',
    title: 'Black wallet',
    category: 'other',
    description: 'Lost it.',
    location,
    status: 'open',
    createdAt: new Date().toISOString(),
    ...overrides,
  }) as CampusItem;

test('every legacy location is still in the list', () => {
  for (const legacy of LEGACY_LOCATIONS) {
    assert.ok(isListedLocation(legacy), `missing legacy location: ${legacy}`);
  }
});

test('location list has no duplicates, empty groups, or blank/oversized names', () => {
  assert.equal(new Set(NILE_CAMPUS_LOCATIONS).size, NILE_CAMPUS_LOCATIONS.length);
  for (const group of NILE_LOCATION_GROUPS) {
    assert.ok(group.locations.length > 0, `empty group: ${group.label}`);
  }
  for (const loc of NILE_CAMPUS_LOCATIONS) {
    assert.equal(loc, loc.trim());
    assert.ok(loc.length >= 2 && loc.length <= MAX_CUSTOM_LOCATION_LENGTH, `bad length: ${loc}`);
    assert.notEqual(loc, OTHER_LOCATION_VALUE);
  }
});

test('listed and custom locations are told apart', () => {
  assert.equal(isListedLocation('Block A'), true);
  assert.equal(isListedLocation('Faculty of Law corridor'), false);
  assert.equal(isCustomLocation('Faculty of Law corridor'), true);
  assert.equal(isCustomLocation('Block A'), false);
  assert.equal(isCustomLocation('   '), false);
  assert.equal(isCustomLocation(undefined), false);
});

test('normalizeCustomLocation trims, collapses spaces, strips control characters and caps length', () => {
  assert.equal(normalizeCustomLocation('  Behind   Block C \n'), 'Behind Block C');
  assert.equal(normalizeCustomLocation('Gate\u0000\u0007 2'), 'Gate 2');
  assert.equal(normalizeCustomLocation('x'.repeat(300)).length, MAX_CUSTOM_LOCATION_LENGTH);
});

test('getUnlistedLocationCounts counts typed places case-insensitively and skips listed ones', () => {
  const counts = getUnlistedLocationCounts([
    item('Faculty of Law corridor'),
    item('faculty of law  corridor'),
    item('Mosque'),
    item('Block A'),
    item(''),
    item('Faculty of Law corridor'),
  ]);
  assert.deepEqual(counts, [
    { location: 'Faculty of Law corridor', count: 3 },
    { location: 'Mosque', count: 1 },
  ]);
});

test('feed filter: "other places" shows only typed places, listed filter is unchanged', () => {
  const items = [item('Block A'), item('Mosque'), item('Faculty of Law corridor')];
  const other = filterCampusItems(items, { location: OTHER_LOCATION_FILTER_VALUE });
  assert.deepEqual(other.map((i) => i.location).sort(), ['Faculty of Law corridor', 'Mosque']);
  const listed = filterCampusItems(items, { location: 'Block A' });
  assert.deepEqual(listed.map((i) => i.location), ['Block A']);
  assert.equal(filterCampusItems(items, { location: 'all' }).length, 3);
});

test('feed search finds a typed place', () => {
  const items = [item('Block A'), item('Behind the mosque')];
  const found = filterCampusItems(items, { searchTerm: 'mosque' });
  assert.deepEqual(found.map((i) => i.location), ['Behind the mosque']);
});

test('location proximity: same typed place is exact, short words never match clusters, nearby places do', () => {
  assert.equal(calculateLocationProximity('Behind Mosque', ' behind  mosque'), 1);
  assert.equal(calculateLocationProximity('hall', 'Hostel Dining Hall'), 0);
  assert.equal(calculateLocationProximity('Behind block a', 'Block B'), 0.5);
  assert.equal(calculateLocationProximity('Football Pitch', 'Tennis Court'), 0.5);
  assert.equal(calculateLocationProximity('Main Campus Gate', 'Secondary Gate & Car Park'), 0.5);
  assert.equal(calculateLocationProximity('', 'Block A'), 0);
});

const baseFields = {
  category: 'other' as const,
  title: 'Black wallet',
  locationDetails: '',
  description: 'Black leather wallet with a zip.',
  verificationQuestion: '',
};

test('report validation: listed location passes, empty location is rejected', () => {
  assert.equal(validateReportInputs({ ...baseFields, location: 'Block A' }), null);
  assert.equal(validateReportInputs({ ...baseFields, location: '' })?.heading, 'Missing campus location');
});

test('report validation: "Other place" needs a typed place of at least 2 characters', () => {
  assert.equal(validateReportInputs({ ...baseFields, location: '', locationIsOther: true })?.heading, 'Tell us where it was');
  assert.equal(validateReportInputs({ ...baseFields, location: 'a', locationIsOther: true })?.heading, 'Tell us where it was');
  assert.equal(validateReportInputs({ ...baseFields, location: '   ', locationIsOther: true })?.heading, 'Tell us where it was');
  assert.equal(validateReportInputs({ ...baseFields, location: 'Behind the mosque', locationIsOther: true }), null);
});

test('report validation: personal details typed into the place name are rejected', () => {
  const result = validateReportInputs({ ...baseFields, location: 'Call me on 08031234567', locationIsOther: true });
  assert.equal(result?.heading, 'Personal details detected');
});

test('demo items use listed campus locations so Other-places filtering is accurate', () => {
  for (const demoItem of DEMO_ITEMS) {
    assert.ok(isListedLocation(demoItem.location), `unlisted demo location: ${demoItem.location}`);
  }
});
