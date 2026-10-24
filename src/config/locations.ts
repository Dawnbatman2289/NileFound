// UNVERIFIED – confirm each name with the university
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Nile University Campus Locations Config
 * Single source of truth for all campus location dropdowns.
 * Do not invent specific room numbers ("Room 101") without official confirmation.
 */

export const NILE_CAMPUS_LOCATIONS = [
  'Ubangi House (STEM Laboratories & Environmental Sciences)',
  'Limpopo Bay (Faculty of Law & Postgraduate Studies)',
  'Niger House (Faculty of Arts & Social Sciences)',
  'Nile House (Administration & Security Office)',
  'Volta Academic Building',
  'Congo House',
  'Central Nile Library',
  'Nile Student Centre',
  'Male Hostel Block A',
  'Male Hostel Block B',
  'Female Hostel Block A',
  'Female Hostel Block B',
  'Picnic Arena & Food Court',
  'Sports Complex',
  'Main Campus Gate Security Post',
  'Campus Car Park & Bus Stop',
  'Other Campus Location'
] as const;

export const NILE_LOCATIONS = NILE_CAMPUS_LOCATIONS;

export type NileCampusLocation = (typeof NILE_CAMPUS_LOCATIONS)[number];
