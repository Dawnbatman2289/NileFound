/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * NileFound Campus Locations & Initial Seed Data
 * Mapped to the official Nile Learning City masterplan (Cadastral Zone C-00, Abuja).
 */

import { CampusItem, ClaimRecord } from '../types/index.ts';

export const NILE_LOCATIONS = [
  'Ubangi House (STEM Laboratories & Environmental Sciences)',
  'Limpopo Bay (Faculty of Law & Postgraduate Studies)',
  'Niger House (Faculty of Arts & Social Sciences)',
  'Nile House (Registry, Bursary, ICT & Security Admin)',
  'Volta Academic Building',
  'Congo House',
  'Central Nile Library (Ground & 1st Floor)',
  'Nile Student Centre & Student Services Centre (Room 101)',
  'Male Hostel Block A (Undergraduate)',
  'Male Hostel Block B',
  'Female Hostel Block A',
  'Female Hostel Block B',
  'Picnic Arena & Food Court',
  'Sports Complex & Football Pitch',
  'Main Campus Gate Security Post',
  'Campus Shuttle Bus Stop / Car Park',
  'Other Campus Area'
];

export const CAMPUS_CLUSTERS: Record<string, string[]> = {
  'stem_cluster': [
    'Ubangi House (STEM Laboratories & Environmental Sciences)',
    'Volta Academic Building',
    'Congo House'
  ],
  'admin_law_cluster': [
    'Nile House (Registry, Bursary, ICT & Security Admin)',
    'Limpopo Bay (Faculty of Law & Postgraduate Studies)',
    'Niger House (Faculty of Arts & Social Sciences)',
    'Nile Student Centre & Student Services Centre (Room 101)'
  ],
  'residential_cluster': [
    'Male Hostel Block A (Undergraduate)',
    'Male Hostel Block B',
    'Female Hostel Block A',
    'Female Hostel Block B',
    'Sports Complex & Football Pitch'
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

export const INITIAL_ITEMS: CampusItem[] = [
  {
    id: 'item-1',
    type: 'found',
    title: 'Nile University Student ID Card',
    category: 'student_id',
    description: 'Found near Lab 3 entrance in Ubangi House. Attached to a green and gold Nile lanyard. Matric number starts with 23/.... Surname starts with O.',
    location: 'Ubangi House (STEM Laboratories & Environmental Sciences)',
    dateLostOrFound: '2026-10-23',
    status: 'open',
    holdingLocation: 'library_desk',
    isSensitiveId: true,
    verificationQuestion: 'What is the full matriculation number and department shown on the front?',
    reportedByEmailDomain: 'nileuniversity.edu.ng',
    createdAt: '2026-10-23T11:30:00Z'
  },
  {
    id: 'item-2',
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
    id: 'item-3',
    type: 'lost',
    title: 'Casio FX-991EX ClassWiz Calculator',
    category: 'calculator',
    description: 'Silver and black casing scientific calculator with masking tape on back. Left behind after MTH 101 tutorial in Ubangi House. Has initials "AO" inscribed inside battery cover.',
    location: 'Ubangi House (STEM Laboratories & Environmental Sciences)',
    dateLostOrFound: '2026-10-22',
    status: 'open',
    holdingLocation: 'finder_holding',
    isSensitiveId: false,
    reportedByEmailDomain: 'nileuniversity.edu.ng',
    createdAt: '2026-10-22T18:00:00Z'
  },
  {
    id: 'item-4',
    type: 'found',
    title: 'Room 214 Brass Key with Green Lanyard',
    category: 'keys',
    description: 'Single brass room door key with green fabric lanyard. Found on the concrete walkway towards Male Hostel Block A.',
    location: 'Male Hostel Block A (Undergraduate)',
    dateLostOrFound: '2026-10-24',
    status: 'claim_requested',
    holdingLocation: 'security_main_gate',
    isSensitiveId: false,
    verificationQuestion: 'What text or logo is printed on the green lanyard?',
    reportedByEmailDomain: 'nileuniversity.edu.ng',
    createdAt: '2026-10-24T08:00:00Z'
  },
  {
    id: 'item-5',
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

export const INITIAL_CLAIMS: ClaimRecord[] = [
  {
    id: 'claim-1',
    itemId: 'item-4',
    itemTitle: 'Room 214 Brass Key with Green Lanyard',
    claimantName: 'Tunde Bakare',
    claimantEmail: 'tunde.b@nileuniversity.edu.ng',
    submittedAnswer: "The green lanyard has 'Nile Faculty of Engineering 2027' printed in white letters on one side.",
    status: 'pending',
    createdAt: '2026-10-24T09:15:00Z'
  },
  {
    id: 'claim-2',
    itemId: 'item-1',
    itemTitle: 'Nile University Student ID Card',
    claimantName: 'Oluwaseun Okeke',
    claimantEmail: 'o.okeke@nileuniversity.edu.ng',
    submittedAnswer: 'Matriculation number is 23/0481, Computer Engineering Department, level 100.',
    status: 'pending',
    createdAt: '2026-10-23T15:00:00Z'
  }
];
