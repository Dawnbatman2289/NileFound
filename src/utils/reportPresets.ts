/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Pure presets and initial-state builders for the NileFound item report form.
 * Supports fast Security Officer custody logging and Staff defaults without PII.
 */

import { HoldingLocation, ItemCategory, ItemType, ReportPrefill, UserRole } from '../types/index.ts';

export interface OfficerIntakePreset {
  id: string;
  label: string;
  type: ItemType;
  category: ItemCategory;
  title: string;
  holdingLocation: HoldingLocation;
  descriptionHint: string;
  verificationQuestion?: string;
}

export const OFFICER_INTAKE_PRESETS: OfficerIntakePreset[] = [
  {
    id: 'gate_student_id',
    label: 'Student ID at Gate',
    type: 'found',
    category: 'student_id',
    title: 'A student ID card was found',
    holdingLocation: 'security_main_gate',
    descriptionHint: 'Student ID card handed in to Main Gate Security Post for collection.',
    verificationQuestion: 'What faculty and level are printed on the ID card?',
  },
  {
    id: 'gate_phone_tech',
    label: 'Phone / Tech Held',
    type: 'found',
    category: 'phone_tech',
    title: 'Phone or gadget held at Main Gate',
    holdingLocation: 'security_main_gate',
    descriptionHint: 'Electronic device handed in to campus security. Owner verification required.',
    verificationQuestion: 'What lock screen image or phone case detail identifies this device?',
  },
  {
    id: 'gate_keys',
    label: 'Keys at Security',
    type: 'found',
    category: 'keys',
    title: 'Set of keys held at Main Gate',
    holdingLocation: 'security_main_gate',
    descriptionHint: 'Key bunch logged at Main Gate Security Post.',
    verificationQuestion: 'What keyring tag or number of keys is on the bunch?',
  },
  {
    id: 'affairs_bag',
    label: 'Item at Student Affairs',
    type: 'found',
    category: 'bag_backpack',
    title: 'Backpack or personal bag in desk custody',
    holdingLocation: 'student_affairs_office',
    descriptionHint: 'Bag handed in for safekeeping at the Student Affairs desk.',
    verificationQuestion: 'Name one notebook, book, or item inside the bag.',
  },
];

export function resolveDefaultHoldingLocation(
  type: ItemType,
  category: ItemCategory | '',
  userRole?: UserRole | null,
  explicitHolding?: HoldingLocation
): HoldingLocation {
  if (type === 'found' && category === 'student_id') return 'security_main_gate';
  if (explicitHolding) return explicitHolding;
  if (type === 'found' && userRole === 'security') return 'security_main_gate';
  if (type === 'found' && userRole === 'staff') return 'faculty_officer';
  return 'finder_holding';
}

export function buildInitialReportFields(
  initialPrefill?: ReportPrefill | null,
  userRole?: UserRole | null
): {
  type: ItemType;
  category: ItemCategory | '';
  location: string;
  title: string;
  holdingLocation: HoldingLocation;
} {
  const defaultType: ItemType = initialPrefill?.type ?? (userRole === 'security' ? 'found' : 'lost');
  const category = initialPrefill?.category ?? '';
  const defaultLocation = initialPrefill?.location
    ?? (userRole === 'security' && !initialPrefill ? 'Main Campus Gate' : '');

  return {
    type: defaultType,
    category,
    location: defaultLocation,
    title: initialPrefill?.title ?? '',
    holdingLocation: resolveDefaultHoldingLocation(
      defaultType,
      category,
      userRole,
      initialPrefill?.holdingLocation
    ),
  };
}
