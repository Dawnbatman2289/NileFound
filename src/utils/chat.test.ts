import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getAppTabTransitionClass,
  getDeskTabTransitionClass,
  validateChatMessageInput,
  isClaimChatWritable,
  resolveChatSenderRole,
  canOpenClaimChat,
  resolveChatNotificationRecipient,
  shouldSendChatNotification,
  getUnreadChatClaimIds,
  MAX_CHAT_MESSAGE_LENGTH,
} from './chat.ts';

test('directional screen transition returns forward, backward, and neutral classes', () => {
  assert.equal(getAppTabTransitionClass('feed', 'admin'), 'tab-enter-forward');
  assert.equal(getAppTabTransitionClass('feed', 'login'), 'tab-enter-forward');
  assert.equal(getAppTabTransitionClass('login', 'feed'), 'tab-enter-backward');
  assert.equal(getAppTabTransitionClass('admin', 'feed'), 'tab-enter-backward');
  assert.equal(getAppTabTransitionClass('feed', 'feed'), 'tab-fade-in');

  assert.equal(getDeskTabTransitionClass('claims', 'custody'), 'tab-enter-forward');
  assert.equal(getDeskTabTransitionClass('roles', 'claims'), 'tab-enter-backward');
});

test('validateChatMessageInput enforces non-empty and max character bounds', () => {
  assert.equal(validateChatMessageInput('   ').valid, false);
  const ok = validateChatMessageInput('  Meet at Main Gate at 2pm  ');
  assert.equal(ok.valid, true);
  assert.equal(ok.trimmed, 'Meet at Main Gate at 2pm');

  const tooLong = 'x'.repeat(MAX_CHAT_MESSAGE_LENGTH + 1);
  assert.equal(validateChatMessageInput(tooLong).valid, false);
});

test('isClaimChatWritable closes chat on rejected claims or returned/expired items', () => {
  assert.equal(isClaimChatWritable('pending', 'claim_requested'), true);
  assert.equal(isClaimChatWritable('approved', 'verified'), true);
  assert.equal(isClaimChatWritable('rejected', 'open'), false);
  assert.equal(isClaimChatWritable('approved', 'returned'), false);
  assert.equal(isClaimChatWritable('pending', 'expired'), false);
});

test('resolveChatSenderRole and canOpenClaimChat follow claim relationship rules', () => {
  const claim = { claimantId: 'u-claimant', finderId: 'u-finder', status: 'pending' as const };
  assert.equal(resolveChatSenderRole(claim, { id: 'u-claimant', role: 'student' }), 'Claimant');
  assert.equal(resolveChatSenderRole(claim, { id: 'u-finder', role: 'student' }), 'Finder');
  assert.equal(resolveChatSenderRole(claim, { id: 'u-sec', role: 'security' }), 'Campus Security');
  assert.equal(resolveChatSenderRole(claim, { id: 'u-admin', role: 'admin', isAdmin: true }), 'Admin');

  assert.equal(canOpenClaimChat(claim, { id: 'u-other', role: 'student' }, 'finder_holding'), false);
  assert.equal(canOpenClaimChat(claim, { id: 'u-sec', role: 'security' }, 'finder_holding'), false);
  assert.equal(canOpenClaimChat(claim, { id: 'u-sec', role: 'security' }, 'security_main_gate'), true);
  assert.equal(canOpenClaimChat(claim, { id: 'u-finder', role: 'student' }, 'finder_holding'), true);
});

test('resolveChatNotificationRecipient and shouldSendChatNotification prevent self-notify and spam', () => {
  const claim = { claimantId: 'u-claimant', finderId: 'u-finder' };
  assert.equal(resolveChatNotificationRecipient(claim, 'u-claimant', 'finder_holding'), 'u-finder');
  assert.equal(resolveChatNotificationRecipient(claim, 'u-finder', 'finder_holding'), 'u-claimant');
  assert.equal(resolveChatNotificationRecipient(claim, 'u-sec', 'security_main_gate'), 'u-claimant');
  assert.equal(resolveChatNotificationRecipient({ claimantId: 'u-claimant' }, 'u-claimant', 'security_main_gate'), 'admin');

  assert.equal(shouldSendChatNotification(undefined, 100_000), true);
  assert.equal(shouldSendChatNotification(90_000, 100_000), false);
  assert.equal(shouldSendChatNotification(60_000, 100_000), true);
});

test('getUnreadChatClaimIds returns only unread chat notifications for the active recipient', () => {
  const unread = getUnreadChatClaimIds(
    [
      { type: 'chat_message', read: false, claimId: 'c1', recipientUid: 'u1' },
      { type: 'chat_message', read: true, claimId: 'c2', recipientUid: 'u1' },
      { type: 'claim_approved', read: false, claimId: 'c3', recipientUid: 'u1' },
      { type: 'chat_message', read: false, claimId: 'c4', recipientUid: 'admin' },
    ],
    'u1',
    false
  );
  assert.deepEqual([...unread], ['c1']);

  const modUnread = getUnreadChatClaimIds(
    [{ type: 'chat_message', read: false, claimId: 'c4', recipientUid: 'admin' }],
    'u-sec',
    true
  );
  assert.deepEqual([...modUnread], ['c4']);
});

