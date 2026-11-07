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
  'Red Volta Hostel',
  'White Volta Hostel',
  'Blue Nile Hostel',
  'Faculty of Engineering',
  'Faculty of Law',
  'Faculty of Natural & Applied Sciences',
  'University Library',
  'Central Cafeteria',
  'Student Center',
  'Sports Complex',
  'Administrative Block',
  'Other Campus Location',
] as const;

export const NILE_LOCATIONS = NILE_CAMPUS_LOCATIONS;

export type NileCampusLocation = (typeof NILE_CAMPUS_LOCATIONS)[number];
