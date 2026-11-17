/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Nile University Campus Locations Config
 * Single source of truth for all campus location dropdowns.
 *
 * Rules for editing this list:
 * - Never rename or delete an existing entry: old reports store the exact text.
 * - Only add places confirmed by the university or by students who use them.
 *   Do not invent room numbers ("Room 101") without official confirmation.
 * - Places students type under "Other place" are counted in the admin panel
 *   (see getUnlistedLocationCounts). Promote the popular ones into a group below.
 *
 * Sources for the entries added in the 2026-11 update:
 * - Nile University hostel portal (dining hall, study rooms, common rooms)
 * - Guardian Nigeria / Honoris (male and female hostel multipurpose halls)
 * - Daily Trust (football, volleyball, basketball and tennis pitches/courts;
 *   engineering workshop; hostel gyms and indoor game rooms)
 * - Wikipedia (Faculty of Law library; fountain and mini market beside Blocks A and B;
 *   secondary entrance with car park and security post)
 * - Nile University prospectus (library ICT centre; private food vendors)
 */

export interface NileLocationGroup {
  readonly label: string;
  readonly locations: readonly string[];
}

export const NILE_LOCATION_GROUPS: readonly NileLocationGroup[] = [
  {
    label: 'Lecture halls & academic buildings',
    locations: [
      'Congo House (Engineering & Computing)',
      'Volta Building (Health Sciences)',
      'Limpopo Bay (Law & Postgrad)',
      'Niger House',
      'Ubangi House (STEM Labs)',
      'Block A',
      'Block B',
      'Block C',
      'Engineering Workshop',
      'Law Library (Faculty of Law)',
    ],
  },
  {
    label: 'Library, admin & services',
    locations: [
      'Nile House (Admin)',
      'Nile Main Library',
      'Library ICT Centre',
      'University Clinic',
      'Student Centre',
      'Central Cafeteria',
      'Food Vendors / Canteens',
      'Mini Marts',
      'Fountain (near Block A & B)',
      'Picnic Arena & Love Garden',
    ],
  },
  {
    label: 'Hostels & residences',
    locations: [
      'Red Volta Hostel',
      'Blue Nile Hostel',
      'Orange Hostel',
      'Zambezi Hostel',
      'Lake Chad Hostel',
      'Asokoro Hostel',
      'Victoria Estate Hostels',
      'Moat Haven Estate',
      'Male Hostel Multipurpose Hall',
      'Female Hostel Multipurpose Hall',
      'Hostel Dining Hall',
      'Hostel Study & Common Room',
      'Hostel Gym & Game Room',
    ],
  },
  {
    label: 'Sports & recreation',
    locations: [
      'Sports Complex',
      'Football Pitch',
      'Basketball Court',
      'Volleyball Court',
      'Tennis Court',
    ],
  },
  {
    label: 'Gates & parking',
    locations: ['Main Campus Gate', 'Secondary Gate & Car Park'],
  },
];

/** Flat list of every listed place, in dropdown order. */
export const NILE_CAMPUS_LOCATIONS: readonly string[] = NILE_LOCATION_GROUPS.flatMap((group) => group.locations);

export const NILE_LOCATIONS = NILE_CAMPUS_LOCATIONS;

/** Dropdown value for "Other place". It is a UI sentinel and is never stored on a report. */
export const OTHER_LOCATION_VALUE = '__other_location__';
export const OTHER_LOCATION_LABEL = 'Other place (not on this list)';

/** Filter value that matches reports whose place was typed in by the reporter. */
export const OTHER_LOCATION_FILTER_VALUE = '__other_places__';

export const MIN_CUSTOM_LOCATION_LENGTH = 2;
/** Must match the Firestore rule: location.size() <= 100. */
export const MAX_CUSTOM_LOCATION_LENGTH = 100;

const LISTED_LOCATION_SET: ReadonlySet<string> = new Set(NILE_CAMPUS_LOCATIONS);

export function isListedLocation(value: string | undefined | null): boolean {
  return Boolean(value) && LISTED_LOCATION_SET.has(value as string);
}

/** True when a report's place was typed by the reporter instead of picked from the list. */
export function isCustomLocation(value: string | undefined | null): boolean {
  const trimmed = (value ?? '').trim();
  return trimmed.length > 0 && !LISTED_LOCATION_SET.has(trimmed);
}

/** Trims, strips control characters, collapses spaces and caps the length. */
export function normalizeCustomLocation(raw: string): string {
  return raw
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_CUSTOM_LOCATION_LENGTH);
}

export interface UnlistedLocationCount {
  readonly location: string;
  readonly count: number;
}

/**
 * Counts places typed under "Other place", grouped case-insensitively.
 * Admins use this to decide which places to add to the dropdown next.
 */
export function getUnlistedLocationCounts(items: ReadonlyArray<{ location?: string }>): UnlistedLocationCount[] {
  const counts = new Map<string, { location: string; count: number }>();
  for (const item of items) {
    const cleaned = normalizeCustomLocation(item.location ?? '');
    if (!isCustomLocation(cleaned)) continue;
    const key = cleaned.toLowerCase();
    const existing = counts.get(key);
    if (existing) existing.count += 1;
    else counts.set(key, { location: cleaned, count: 1 });
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.location.localeCompare(b.location));
}

export type NileCampusLocation = string;
