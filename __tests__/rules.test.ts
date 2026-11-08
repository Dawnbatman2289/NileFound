import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const firestoreRules = readFileSync(resolve('firestore.rules'), 'utf8');
const storageRules = readFileSync(resolve('storage.rules'), 'utf8');

test('Firestore rules default deny and require verified Nile users', () => {
  assert.match(firestoreRules, /allow read, write: if false/);
  assert.match(firestoreRules, /email_verified == true/);
  assert.ok(firestoreRules.includes("request.auth.token.email.matches('^[^@]+@nileuniversity\\\\.edu\\\\.ng$')"));
  assert.match(firestoreRules, /incoming\(\)\.authorId == request\.auth\.uid/);
  assert.match(firestoreRules, /incoming\(\)\.createdAt == existing\(\)\.createdAt/);
  assert.match(firestoreRules, /affectedKeys\(\)\.hasOnly\(\['read'\]\)/);
});

test('Firestore notification creation is relationship constrained', () => {
  assert.match(firestoreRules, /function canCreateNotification/);
  assert.match(firestoreRules, /data\.recipientUid == request\.auth\.uid/);
  assert.match(firestoreRules, /data\.type == 'admin_review'/);
  assert.match(firestoreRules, /data\.claimId/);
  assert.match(firestoreRules, /get\(\/databases\/\$\(database\)\/documents\/items\/\$\(data\.itemId\)\)/);
});

test('Storage rules restrict MIME, size, UID paths, and Nile verification', () => {
  assert.match(storageRules, /email_verified == true/);
  assert.ok(storageRules.includes("request.auth.token.email.matches('^[^@]+@nileuniversity\\\\.edu\\\\.ng$')"));
  assert.match(storageRules, /request\.auth\.uid == userId/);
  assert.match(storageRules, /request\.resource\.size <= 5 \* 1024 \* 1024/);
  assert.match(storageRules, /image\/\(jpeg\|png\|webp\)/);
});
