import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const firestoreRules = readFileSync(resolve('firestore.rules'), 'utf8');
const storageRules = readFileSync(resolve('storage.rules'), 'utf8');
const firebaseJson = JSON.parse(readFileSync(resolve('firebase.json'), 'utf8'));

test('firebase.json targets the named Firestore database as an array', () => {
  assert.ok(Array.isArray(firebaseJson.firestore));
  assert.equal(
    firebaseJson.firestore[0]?.database,
    'ai-studio-nilefoundnileuni-e363e16a-01ee-4569-ac1d-fd0a6b4eefbd'
  );
});

test('Firestore rules default deny and require verified Nile users or verified master admin', () => {
  assert.match(firestoreRules, /allow read, write: if false/);
  assert.match(firestoreRules, /email_verified == true/);
  assert.match(firestoreRules, /nFdIhTjOOqMqMG4y1KIT550Qf5m1/);
  assert.ok(firestoreRules.includes("request.auth.token.email.matches('^[^@]+@nileuniversity\\\\.edu\\\\.ng$')"));
  assert.match(firestoreRules, /incoming\(\)\.authorId == request\.auth\.uid/);
  assert.match(firestoreRules, /incoming\(\)\.createdAt == existing\(\)\.createdAt/);
  assert.match(firestoreRules, /affectedKeys\(\)\.hasOnly\(\['read'\]\)/);
});

test('Firestore rules protect student ID photos, enforce server timestamps, and wire Security role', () => {
  assert.match(firestoreRules, /!\(data\.category == 'student_id' && 'imageUrl' in data\)/);
  assert.match(firestoreRules, /incoming\(\)\.createdAt == request\.time/);
  assert.match(firestoreRules, /incoming\(\)\.updatedAt == request\.time/);
  assert.match(firestoreRules, /isStaffOrAdmin\(\)/);
  assert.match(firestoreRules, /resource\.data\.finderId == request\.auth\.uid/);
  assert.match(firestoreRules, /claimId == incoming\(\)\.itemId \+ '_' \+ request\.auth\.uid/);
});

test('Firestore notification creation and subcollections are relationship constrained', () => {
  assert.match(firestoreRules, /function canCreateNotification/);
  assert.match(firestoreRules, /data\.recipientUid == request\.auth\.uid/);
  assert.match(firestoreRules, /data\.type == 'admin_review'/);
  assert.match(firestoreRules, /'itemTitle'/);
  assert.match(firestoreRules, /existsAfter\(/);
  assert.match(firestoreRules, /getAfter\(/);
  assert.match(firestoreRules, /claim\.finderId == request\.auth\.uid|finderId == request\.auth\.uid/);
});

test('Storage rules restrict MIME, size, UID paths, verified email, and split create/update', () => {
  assert.match(storageRules, /email_verified == true/);
  assert.ok(storageRules.includes("request.auth.token.email.matches('^[^@]+@nileuniversity\\\\.edu\\\\.ng$')"));
  assert.match(storageRules, /allow create, update:/);
  assert.match(storageRules, /request\.resource != null/);
  assert.match(storageRules, /request\.auth\.uid == userId/);
  assert.match(storageRules, /request\.resource\.size <= 5 \* 1024 \* 1024/);
  assert.match(storageRules, /image\/\(jpeg\|png\|webp\)/);
});

test('Admin configuration uses valid 2-segment /admins/{uid} document path without master admin escalation', () => {
  assert.ok(!firestoreRules.includes('/config/admins/'));
  assert.match(firestoreRules, /match \/admins\/\{adminUid\}/);
  assert.doesNotMatch(firestoreRules, /function isMasterAdmin\(\)\s*\{[^}]*isConfiguredAdmin\(/);
});

test('Staff invites support email-based role lookup gated by verified Nile email and master admin', () => {
  const indexesJson = JSON.parse(readFileSync(resolve('firestore.indexes.json'), 'utf8'));
  assert.match(firestoreRules, /match \/staffInvites\/\{inviteEmail\}/);
  assert.match(firestoreRules, /allow create, update: if isMasterAdmin\(\)/);
  assert.match(firestoreRules, /request\.auth\.token\.email == inviteEmail/);
  assert.match(firestoreRules, /exists\(\/databases\/\$\(database\)\/documents\/roles\/\$\(request\.auth\.uid\)\)\s*\?\s*get/);
  assert.match(firestoreRules, /status in \['open', 'claim_requested'\]/);
  assert.ok(Array.isArray(indexesJson.indexes) && indexesJson.indexes.length >= 3);
});
