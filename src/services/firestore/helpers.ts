/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Shared Firestore collection constants, domain mappers, and retry helpers.
 */

import { Timestamp, QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { db } from '../../lib/firebase.ts';
import { CampusItem, ClaimRecord, UserRole, CampusNotification } from '../../types/index.ts';
import { ITEM_EXPIRY_DAYS } from '../../config/catalog.ts';

export const ITEMS = 'items';
export const CLAIMS = 'claims';
export const USERS = 'users';
export const ROLES = 'roles';
export const ADMINS = 'admins';
export const STAFF_INVITES = 'staffInvites';
export const NOTIFICATIONS = 'notifications';

export const EXPIRY_MS = ITEM_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
export const ITEMS_PAGE_SIZE = 25;
export const CLAIMS_PAGE_SIZE = 20;
export const ROLES_PAGE_SIZE = 25;

export interface UserRoleRecord {
  uid: string;
  email: string;
  role: UserRole;
  assignedAt?: string;
  assignedBy?: string;
  pending?: boolean;
  source?: 'admins' | 'roles' | 'invites';
}

export interface ItemPrivateDetails {
  authorName?: string;
  authorEmail?: string;
  expectedAnswer?: string;
}

export interface ClaimPrivateDetails {
  claimantName: string;
  claimantEmail: string;
  submittedAnswer: string;
}

export interface ItemPage {
  items: CampusItem[];
  nextCursor?: QueryDocumentSnapshot<DocumentData>;
  hasMore: boolean;
}

export interface ClaimsCursor {
  main?: QueryDocumentSnapshot<DocumentData>;
  claimant?: QueryDocumentSnapshot<DocumentData>;
  finder?: QueryDocumentSnapshot<DocumentData>;
}

export interface ClaimsPage {
  claims: ClaimRecord[];
  hasMore: boolean;
  cursor?: ClaimsCursor;
}

export interface ClaimMessagesPage {
  messages: import('../../types/index.ts').ClaimMessage[];
  hasMore: boolean;
  nextCursor?: QueryDocumentSnapshot<DocumentData>;
}

export interface RolesPage {
  records: UserRoleRecord[];
  nextAdminsCursor?: QueryDocumentSnapshot<DocumentData>;
  nextRolesCursor?: QueryDocumentSnapshot<DocumentData>;
  nextInvitesCursor?: QueryDocumentSnapshot<DocumentData>;
  hasMore: boolean;
}

export interface CampusAuditCounts {
  totalItems: number;
  totalFound: number;
  foundReturned: number;
  totalReturned: number;
  custodyCount: number;
  awaitingCustodyCount: number;
  pendingClaimsCount: number;
}

export const NOTIF_TEMPLATES: Record<CampusNotification['type'], { title: string; message: string }> = {
  claim_received: { title: 'New claim on your item', message: 'A new ownership claim was filed for your item.' },
  claim_approved: { title: 'Claim approved', message: 'Your ownership claim was approved.' },
  claim_rejected: { title: 'Claim rejected', message: 'Your ownership claim was rejected.' },
  chat_message: { title: 'New handover message', message: 'You have a new message in your item handover chat.' },
  match_alert: { title: 'Possible item match', message: 'A possible match was found for your report.' },
  item_returned: { title: 'Item returned', message: 'Your reported item was marked returned.' },
  custody_confirmed: { title: 'Drop-off confirmed', message: 'Campus desk confirmed physical custody of your found item.' },
};

export function assertFirestoreReady(): void {
  if (!db) {
    throw new Error('Firestore service is not initialized yet. Reload and try again.');
  }
}

export function isTransientOfflineError(error: unknown): boolean {
  const msg = (error instanceof Error ? error.message : String(error)).toLowerCase();
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code || '').toLowerCase()
      : '';
  return (
    code.includes('unavailable') ||
    code.includes('deadline-exceeded') ||
    msg.includes('client is offline') ||
    msg.includes('failed to get document because the client is offline') ||
    msg.includes('network-request-failed')
  );
}

export async function withOfflineRetry<T>(operation: () => Promise<T>, maxRetries = 1): Promise<T> {
  assertFirestoreReady();
  let attempt = 0;
  while (true) {
    try {
      return await operation();
    } catch (error) {
      if (attempt >= maxRetries || !isTransientOfflineError(error)) {
        throw error;
      }
      attempt += 1;
      await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
    }
  }
}

export function toIsoString(value: unknown): string {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value && typeof value === 'object' && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  if (typeof value === 'string' && value.trim()) return value;
  return new Date().toISOString();
}

export function applyReadTimeExpiry(item: CampusItem): CampusItem {
  if (item.status === 'returned' || item.status === 'expired') return item;
  const createdMs = new Date(item.createdAt).getTime();
  if (!Number.isNaN(createdMs) && Date.now() - createdMs > EXPIRY_MS) {
    return { ...item, status: 'expired' };
  }
  return item;
}

export function mapDocToCampusItem(docSnap: QueryDocumentSnapshot<DocumentData>): CampusItem {
  const d = docSnap.data();
  const createdAt = toIsoString(d.createdAt);
  const isStudentId = d.category === 'student_id';
  const raw: CampusItem = {
    id: docSnap.id,
    type: d.type || 'lost',
    title: d.title || '',
    category: d.category || 'other',
    description: d.description || '',
    location: d.location || '',
    locationDetails: d.locationDetails || undefined,
    dateLostOrFound: d.dateLostOrFound || createdAt,
    status: d.status || 'open',
    holdingLocation: d.holdingLocation || 'finder_holding',
    custodyStatus: d.custodyStatus === 'awaiting_dropoff' || d.custodyStatus === 'confirmed' ? d.custodyStatus : undefined,
    thumbUrl: isStudentId ? undefined : (d.thumbUrl || undefined),
    imageUrl: isStudentId ? undefined : (d.imageUrl || undefined),
    isSensitiveId: d.isSensitiveId || isStudentId,
    verificationQuestion: d.verificationQuestion || undefined,
    reportedByEmailDomain: 'nileuniversity.edu.ng',
    authorId: d.authorId || undefined,
    createdAt,
  };
  return applyReadTimeExpiry(raw);
}

export function mapDocToClaimRecord(docSnap: QueryDocumentSnapshot<DocumentData>): ClaimRecord {
  const d = docSnap.data();
  return {
    id: docSnap.id,
    itemId: d.itemId,
    itemTitle: d.itemTitle || 'Item',
    claimantName: 'Verified Student',
    claimantEmail: '',
    submittedAnswer: '',
    privateLoaded: false,
    status: (d.status || 'pending') as ClaimRecord['status'],
    resubmitted: Boolean(d.resubmitted),
    claimantId: d.claimantId || undefined,
    finderId: d.finderId || undefined,
    createdAt: toIsoString(d.createdAt),
  };
}
