/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * NileFound Demo Items & Seed Data
 * Sample records for testing the platform in Demo Data Mode.
 * Real production/pilot mode starts with an empty item list.
 */

import { CampusItem, ClaimRecord } from '../types/index.ts';
import { NILE_CAMPUS_LOCATIONS } from '../config/locations.ts';

export const NILE_LOCATIONS = NILE_CAMPUS_LOCATIONS;

export const CAMPUS_CLUSTERS: Record<string, string[]> = {
  'stem_cluster': [
    'Ubangi House (STEM Laboratories & Environmental Sciences)',
    'Volta Academic Building',
    'Congo House'
  ],
  'admin_law_cluster': [
    'Nile House (Administration & Security Office)',
    'Limpopo Bay (Faculty of Law & Postgraduate Studies)',
    'Niger House (Faculty of Arts & Social Sciences)',
    'Nile Student Centre'
  ],
  'residential_cluster': [
    'Male Hostel Block A',
    'Male Hostel Block B',
    'Female Hostel Block A',
    'Female Hostel Block B',
    'Sports Complex'
  ]
};

export const CATEGORIES = [
  { id: 'student_id', label: 'Student ID Card', icon: 'CreditCard', sensitive: true },
  { id: 'phone_tech', label: 'Phone / Laptop / Charger / Earbuds', icon: 'Smartphone', sensitive: false },
  { id: 'power_bank', label: 'Power Bank', icon: 'BatteryCharging', sensitive: false },
  { id: 'calculator', label: 'Scientific Calculator (Casio)', icon: 'Calculator', sensitive: false },
  { id: 'flash_drive', label: 'Flash Drive / Hard Drive', icon: 'HardDrive', sensitive: false },
  { id: 'keys', label: 'Hostel / Padlock Keys', icon: 'Key', sensitive: false },
  { id: 'bag_backpack', label: 'Bag / Backpack', icon: 'Briefcase', sensitive: false },
  { id: 'lab_coat_clothing', label: 'Lab Coat / Jacket', icon: 'Shirt', sensitive: false },
  { id: 'books_notes', label: 'Textbook / Lecture Notes', icon: 'BookOpen', sensitive: false },
  { id: 'other', label: 'Other Item', icon: 'Package', sensitive: false }
];

export const DEMO_ITEMS: CampusItem[] = [
  {
    id: 'demo-item-1',
    type: 'found',
    title: 'Student ID Card',
    category: 'student_id',
    description: 'Found near Lab 3 entrance in Ubangi House. Attached to a green and gold Nile lanyard. Handed over to Main Gate security post.',
    location: 'Ubangi House (STEM Laboratories & Environmental Sciences)',
    dateLostOrFound: '2026-10-23',
    status: 'open',
    holdingLocation: 'security_main_gate',
    isSensitiveId: true,
    verificationQuestion: 'What department and level is on the ID card?',
    reportedByEmailDomain: 'nileuniversity.edu.ng',
    createdAt: '2026-10-23T11:30:00Z'
  },
  {
    id: 'demo-item-2',
    type: 'found',
    title: 'Oraimo 20000mAh Power Bank (Black)',
    category: 'power_bank',
    description: 'Black textured power bank with dual USB ports. Picked up from socket charging station outside Law Lecture Hall 2 in Limpopo Bay.',
    location: 'Limpopo Bay (Faculty of Law & Postgraduate Studies)',
    dateLostOrFound: '2026-10-22',
    status: 'open',
    holdingLocation: 'finder_holding',
    isSensitiveId: false,
    verificationQuestion: 'What color is the charging cable plugged into it and what sticker is on the back?',
    reportedByEmailDomain: 'nileuniversity.edu.ng',
    createdAt: '2026-10-22T16:15:00Z'
  },
  {
    id: 'demo-item-3',
    type: 'lost',
    title: 'Casio FX-991EX ClassWiz Calculator',
    category: 'calculator',
    description: 'Silver and black casing scientific calculator with masking tape on back. Left behind after MTH 101 tutorial in Ubangi House. Has initials inscribed inside battery cover.',
    location: 'Ubangi House (STEM Laboratories & Environmental Sciences)',
    dateLostOrFound: '2026-10-22',
    status: 'open',
    holdingLocation: 'finder_holding',
    isSensitiveId: false,
    reportedByEmailDomain: 'nileuniversity.edu.ng',
    createdAt: '2026-10-22T18:00:00Z'
  },
  {
    id: 'demo-item-4',
    type: 'found',
    title: 'Room 214 Brass Key with Green Lanyard',
    category: 'keys',
    description: 'Single brass room door key with green fabric lanyard. Found on the concrete walkway towards Male Hostel Block A.',
    location: 'Male Hostel Block A',
    dateLostOrFound: '2026-10-24',
    status: 'claim_requested',
    holdingLocation: 'security_main_gate',
    isSensitiveId: false,
    verificationQuestion: 'What text or logo is printed on the green lanyard?',
    reportedByEmailDomain: 'nileuniversity.edu.ng',
    createdAt: '2026-10-24T08:00:00Z'
  },
  {
    id: 'demo-item-5',
    type: 'found',
    title: 'Blue STEM Lab Coat (Size L)',
    category: 'lab_coat_clothing',
    description: 'Navy blue lab coat with Nile University crest patch on left chest pocket. Found draped over stool in Chemistry Lab 1.',
    location: 'Ubangi House (STEM Laboratories & Environmental Sciences)',
    dateLostOrFound: '2026-10-21',
    status: 'returned',
    holdingLocation: 'student_affairs_office',
    isSensitiveId: false,
    verificationQuestion: 'What item was left inside the right lower pocket?',
    reportedByEmailDomain: 'nileuniversity.edu.ng',
    createdAt: '2026-10-21T14:20:00Z'
  }
];

export const DEMO_CLAIMS: ClaimRecord[] = [
  {
    id: 'demo-claim-1',
    itemId: 'demo-item-4',
    itemTitle: 'Room 214 Brass Key with Green Lanyard',
    claimantName: 'Tunde Bakare',
    claimantEmail: 'tunde.b@nileuniversity.edu.ng',
    submittedAnswer: "The green lanyard has 'Nile Faculty of Engineering 2027' printed in white letters on one side.",
    status: 'pending',
    createdAt: '2026-10-24T09:15:00Z'
  }
];

// Seed campus records for realistic Nile University lost and found feed
export const INITIAL_ITEMS: CampusItem[] = [];
export const INITIAL_CLAIMS: ClaimRecord[] = [];
