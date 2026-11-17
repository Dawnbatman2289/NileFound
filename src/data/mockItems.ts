/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * NileFound Demo Items & Seed Data
 * Sample records for testing the platform in Demo Data Mode.
 * Real production/pilot mode starts with an empty item list.
 */

import { CampusItem, ClaimMessage, ClaimRecord } from '../types/index.ts';
import { NILE_CAMPUS_LOCATIONS } from '../config/locations.ts';
export { CAMPUS_CLUSTERS, CATEGORIES } from '../config/catalog.ts';

export const NILE_LOCATIONS = NILE_CAMPUS_LOCATIONS;

export const DEMO_ITEMS: CampusItem[] = [
  {
    id: 'demo-item-1',
    type: 'found',
    title: 'Student ID Card',
    category: 'student_id',
    description: 'Found near Lab 3 entrance in Ubangi House. Attached to a green and gold Nile lanyard. Handed over to Main Gate security post.',
    location: 'Ubangi House (STEM Labs)',
    dateLostOrFound: '2026-11-12',
    status: 'open',
    holdingLocation: 'security_main_gate',
    authorId: 'demo-student-tunde',
    isSensitiveId: true,
    verificationQuestion: 'What department and level is on the ID card?',
    reportedByEmailDomain: 'nileuniversity.edu.ng',
    createdAt: '2026-11-12T11:30:00Z'
  },
  {
    id: 'demo-item-2',
    type: 'found',
    title: 'Oraimo 20000mAh Power Bank (Black)',
    category: 'power_bank',
    description: 'Black textured power bank with dual USB ports. Picked up from socket charging station outside Law Lecture Hall 2 in Limpopo Bay.',
    location: 'Limpopo Bay (Law & Postgrad)',
    dateLostOrFound: '2026-11-13',
    status: 'verified',
    holdingLocation: 'finder_holding',
    authorId: 'demo-student-tunde',
    isSensitiveId: false,
    verificationQuestion: 'What color is the charging cable plugged into it and what sticker is on the back?',
    reportedByEmailDomain: 'nileuniversity.edu.ng',
    createdAt: '2026-11-13T15:15:00Z'
  },
  {
    id: 'demo-item-3',
    type: 'lost',
    title: 'Casio FX-991EX ClassWiz Calculator',
    category: 'calculator',
    description: 'Silver and black casing scientific calculator with masking tape on back. Left behind after MTH 101 tutorial in Ubangi House. Has initials inscribed inside battery cover.',
    location: 'Ubangi House (STEM Labs)',
    dateLostOrFound: '2026-11-13',
    status: 'open',
    holdingLocation: 'finder_holding',
    authorId: 'demo-student-chidera',
    isSensitiveId: false,
    reportedByEmailDomain: 'nileuniversity.edu.ng',
    createdAt: '2026-11-13T17:00:00Z'
  },
  {
    id: 'demo-item-4',
    type: 'found',
    title: 'Room 214 Brass Key with Green Lanyard',
    category: 'keys',
    description: 'Single brass room door key with green fabric lanyard. Found on the concrete walkway towards Red Volta Hostel.',
    location: 'Red Volta Hostel',
    dateLostOrFound: '2026-11-14',
    status: 'claim_requested',
    holdingLocation: 'security_main_gate',
    authorId: 'demo-student-tunde',
    isSensitiveId: false,
    verificationQuestion: 'What text or logo is printed on the green lanyard?',
    reportedByEmailDomain: 'nileuniversity.edu.ng',
    createdAt: '2026-11-14T08:00:00Z'
  },
  {
    id: 'demo-item-5',
    type: 'found',
    title: 'Blue STEM Lab Coat (Size L)',
    category: 'lab_coat_clothing',
    description: 'Navy blue lab coat with Nile University crest patch on left chest pocket. Found draped over stool in Chemistry Lab 1.',
    location: 'Ubangi House (STEM Labs)',
    dateLostOrFound: '2026-11-10',
    status: 'returned',
    holdingLocation: 'student_affairs_office',
    authorId: 'demo-security-musa',
    isSensitiveId: false,
    verificationQuestion: 'What item was left inside the right lower pocket?',
    reportedByEmailDomain: 'nileuniversity.edu.ng',
    createdAt: '2026-11-10T14:20:00Z'
  }
];

export const DEMO_CLAIMS: ClaimRecord[] = [
  {
    id: 'demo-claim-1',
    itemId: 'demo-item-4',
    itemTitle: 'Room 214 Brass Key with Green Lanyard',
    claimantId: 'demo-student-chidera',
    finderId: 'demo-student-tunde',
    claimantName: 'Chidera Eze',
    claimantEmail: 'chidera@nileuniversity.edu.ng',
    submittedAnswer: "The green lanyard has 'Nile Faculty of Engineering 2027' printed in white letters on one side.",
    privateLoaded: true,
    status: 'pending',
    createdAt: '2026-11-14T09:15:00Z'
  },
  {
    id: 'demo-claim-2',
    itemId: 'demo-item-2',
    itemTitle: 'Oraimo 20000mAh Power Bank (Black)',
    claimantId: 'demo-student-chidera',
    finderId: 'demo-student-tunde',
    claimantName: 'Chidera Eze',
    claimantEmail: 'chidera@nileuniversity.edu.ng',
    submittedAnswer: 'Black braided USB-C cable plugged in with a tiny green Engineering sticker on the back.',
    privateLoaded: true,
    status: 'approved',
    createdAt: '2026-11-14T10:00:00Z'
  }
];

export const DEMO_CHAT_MESSAGES: Record<string, ClaimMessage[]> = {
  'demo-claim-2': [
    {
      id: 'demo-msg-1',
      claimId: 'demo-claim-2',
      senderId: 'demo-student-tunde',
      senderRole: 'Finder',
      text: 'I verified your answer. I will be around Nile Student Centre by 2:00 PM WAT.',
      createdAt: '2026-11-14T10:05:00Z'
    },
    {
      id: 'demo-msg-2',
      claimId: 'demo-claim-2',
      senderId: 'demo-student-chidera',
      senderRole: 'Claimant',
      text: 'Thank you Tunde. Can we meet near the Main Gate Security desk at 2:15 PM?',
      createdAt: '2026-11-14T10:08:00Z'
    }
  ]
};

// Seed campus records for realistic Nile University lost and found feed
export const INITIAL_ITEMS: CampusItem[] = [];
export const INITIAL_CLAIMS: ClaimRecord[] = [];
