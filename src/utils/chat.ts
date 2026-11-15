/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * NileFound Chat & Screen Transition Utilities
 * Pure, testable helpers for handover chat validation, role labelling, and directional screen motion.
 */

import { CampusItem, ChatSenderRole, ClaimRecord, User } from '../types/index.ts';

export const MAX_CHAT_MESSAGE_LENGTH = 500;

export const QUICK_HANDOVER_PROMPTS: Record<'Finder' | 'Claimant' | 'Staff', string[]> = {
  Claimant: [
    'Are you free for handover today?',
    'Can we meet at Main Gate Security Post?',
    'I am on campus now and ready to collect.',
  ],
  Finder: [
    'Please confirm a detail on the item before we meet.',
    'Meet me at Main Gate Security Post today.',
    'The item is with Student Affairs Office.',
  ],
  Staff: [
    'Your item is ready for collection at the desk.',
    'Please bring your Nile student ID card for handover.',
    'Desk hours today are 08:00 to 16:00 WAT.',
  ],
};

const APP_TAB_ORDER = ['feed', 'admin', 'login'] as const;
const DESK_TAB_ORDER = ['claims', 'custody', 'all_items', 'roles', 'personas'] as const;

export function getDirectionalTabClass(
  prevTab: string,
  nextTab: string,
  order: readonly string[]
): 'tab-fade-in' | 'tab-enter-forward' | 'tab-enter-backward' {
  const prevIdx = order.indexOf(prevTab);
  const nextIdx = order.indexOf(nextTab);
  if (prevIdx === -1 || nextIdx === -1 || prevIdx === nextIdx) return 'tab-fade-in';
  return nextIdx > prevIdx ? 'tab-enter-forward' : 'tab-enter-backward';
}

export function getAppTabTransitionClass(prevTab: string, nextTab: string) {
  return getDirectionalTabClass(prevTab, nextTab, APP_TAB_ORDER);
}

export function getDeskTabTransitionClass(prevTab: string, nextTab: string) {
  return getDirectionalTabClass(prevTab, nextTab, DESK_TAB_ORDER);
}

export function validateChatMessageInput(rawText: string): {
  valid: boolean;
  trimmed: string;
  error?: string;
} {
  const trimmed = rawText.trim();
  if (!trimmed) {
    return { valid: false, trimmed: '', error: 'Type a short message before sending.' };
  }
  if (trimmed.length > MAX_CHAT_MESSAGE_LENGTH) {
    return {
      valid: false,
      trimmed: trimmed.slice(0, MAX_CHAT_MESSAGE_LENGTH),
      error: `Keep messages under ${MAX_CHAT_MESSAGE_LENGTH} characters.`,
    };
  }
  return { valid: true, trimmed };
}

export function isClaimChatWritable(
  claimStatus: ClaimRecord['status'],
  itemStatus?: CampusItem['status']
): boolean {
  if (claimStatus === 'rejected') return false;
  if (itemStatus === 'returned' || itemStatus === 'expired') return false;
  return claimStatus === 'pending' || claimStatus === 'approved';
}

export function resolveChatSenderRole(
  claim: Pick<ClaimRecord, 'claimantId' | 'finderId'>,
  currentUser: Pick<User, 'id' | 'role' | 'isAdmin'>
): ChatSenderRole {
  if (claim.claimantId === currentUser.id) return 'Claimant';
  if (claim.finderId === currentUser.id) return 'Finder';
  if (currentUser.role === 'admin' || currentUser.isAdmin) return 'Admin';
  if (currentUser.role === 'security') return 'Campus Security';
  return 'Claimant';
}

export function canOpenClaimChat(
  claim: Pick<ClaimRecord, 'claimantId' | 'finderId' | 'status'>,
  currentUser?: Pick<User, 'id' | 'role' | 'isAdmin'> | null,
  holdingLocation?: CampusItem['holdingLocation']
): boolean {
  if (!currentUser) return false;
  if (claim.claimantId === currentUser.id || claim.finderId === currentUser.id) return true;
  if (currentUser.role === 'admin' || currentUser.isAdmin) return true;
  if (currentUser.role === 'security' && holdingLocation !== 'finder_holding') return true;
  return false;
}

export function resolveChatNotificationRecipient(
  claim: Pick<ClaimRecord, 'claimantId' | 'finderId'>,
  senderId: string,
  holdingLocation?: CampusItem['holdingLocation']
): string | null {
  if (!senderId) return null;
  if (claim.claimantId === senderId) {
    if (claim.finderId && claim.finderId !== senderId) return claim.finderId;
    if (holdingLocation && holdingLocation !== 'finder_holding') return 'admin';
    return null;
  }
  if (claim.claimantId && claim.claimantId !== senderId) {
    return claim.claimantId;
  }
  return null;
}

export function shouldSendChatNotification(
  lastSentAtMs: number | undefined,
  nowMs: number,
  cooldownMs = 30_000
): boolean {
  if (lastSentAtMs === undefined) return true;
  return nowMs - lastSentAtMs >= cooldownMs;
}

export function getUnreadChatClaimIds(
  notifications: Array<{ type: string; read: boolean; claimId?: string; recipientUid?: string }>,
  currentUserId?: string,
  canModerate = false
): Set<string> {
  const unread = new Set<string>();
  if (!currentUserId) return unread;
  for (const n of notifications) {
    if (n.read || n.type !== 'chat_message' || !n.claimId) continue;
    const isRecipient = n.recipientUid === currentUserId || (n.recipientUid === 'admin' && canModerate);
    if (isRecipient) unread.add(n.claimId);
  }
  return unread;
}

