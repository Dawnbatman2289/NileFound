/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Nile University Campus Locations Config
 * Single source of truth for all campus location dropdowns.
 * Do not invent specific room numbers ("Room 101") without official confirmation.
 */

export const NILE_CAMPUS_LOCATIONS = [
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
] as const;

export const NILE_LOCATIONS = NILE_CAMPUS_LOCATIONS;

export type NileCampusLocation = (typeof NILE_CAMPUS_LOCATIONS)[number];
