/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type ItemType = 'lost' | 'found';

export type ItemCategory =
  | 'student_id'
  | 'phone_tech'
  | 'power_bank'
  | 'calculator'
  | 'flash_drive'
  | 'keys'
  | 'bag_backpack'
  | 'lab_coat_clothing'
  | 'books_notes'
  | 'other';

export type ItemStatus =
  | 'open'
  | 'claim_requested'
  | 'verified'
  | 'returned'
  | 'expired';

export type HoldingLocation =
  | 'finder_holding'
  | 'security_main_gate'
  | 'student_affairs_office'
  | 'faculty_officer'
  | 'library_desk';

export interface CampusItem {
  id: string;
  type: ItemType;
  title: string;
  category: ItemCategory;
  description: string;
  location: string;
  dateLostOrFound: string; // ISO date string
  status: ItemStatus;
  holdingLocation: HoldingLocation;
  authorId?: string;
  imageUrl?: string;
  isSensitiveId?: boolean; // If true, photos are blurred/partial
  // Hidden verification question set by finder
  verificationQuestion?: string;
  verificationAnswerHash?: string; // or hidden hint
  // Contact & privacy
  anonymousContactChannel?: 'whatsapp_relay' | 'security_desk';
  reportedByEmailDomain?: string; // e.g. "nileuniversity.edu.ng"
  createdAt: string;
}

export interface MatchScoreResult {
  score: number; // 0 - 100
  reasons: string[];
  isLikelyMatch: boolean;
}

export interface FieldInterviewQuestion {
  id: string;
  target: 'student' | 'security' | 'finder' | 'student_affairs';
  question: string;
  objective: string;
  sampleResponses?: string[];
}

export type UserRole = 'student' | 'security' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  matricNumber?: string;
  department?: string;
  isAdmin?: boolean;
}

export interface ClaimRecord {
  id: string;
  itemId: string;
  itemTitle: string;
  claimantName: string;
  claimantEmail: string;
  claimantId?: string;
  submittedAnswer: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

export type NotificationType =
  | 'claim_received'
  | 'claim_approved'
  | 'claim_rejected'
  | 'match_alert'
  | 'item_returned'
  | 'admin_review'
  | 'claim_submitted'
  | 'item_reported_lost'
  | 'item_reported_found'
  | 'admin_alert';

export interface CampusNotification {
  id: string;
  recipientUid: string; // user UID or 'admin'
  fromUid: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  itemId?: string;
  // UI and display helpers
  itemTitle?: string;
  itemType?: ItemType;
  location?: string;
  category?: ItemCategory;
  recipientEmail?: string;
  forAdminOnly?: boolean;
  priority?: 'normal' | 'high' | 'urgent';
  linkTab?: 'feed' | 'admin';
  reporterName?: string;
  reporterEmail?: string;
}

