import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeNileEmail,
  validateNileEmail,
  validateEmailFormat,
  validatePassword,
  validateFullName,
  isCampusAccountAllowed,
} from '../src/utils/authValidation.ts';

test('accepts and normalizes verified Nile addresses', () => {
  assert.equal(normalizeNileEmail(' USER@NILEUNIVERSITY.EDU.NG '), 'user@nileuniversity.edu.ng');
  assert.equal(validateNileEmail('user@nileuniversity.edu.ng'), true);
});

test('validates general email syntax without embedding personal emails', () => {
  assert.equal(validateEmailFormat('student@nileuniversity.edu.ng'), true);
  assert.equal(validateEmailFormat('not-an-email'), false);
  assert.equal(validateEmailFormat(''), false);
});

test('rejects lookalike or external domains for campus accounts', () => {
  for (const email of [
    'user@gmail.example.com',
    'user@nile.edu.test.invalid',
    'user@nileuniversity.com.test.invalid',
    'user@nileuniversity.edu.ng.attacker.test.invalid',
  ]) {
    assert.equal(validateNileEmail(email), false, email);
  }
});

test('isCampusAccountAllowed rejects verified external Google accounts and unverified accounts', () => {
  assert.equal(
    isCampusAccountAllowed({ email: 'student@nileuniversity.edu.ng', emailVerified: true }),
    true
  );
  assert.equal(
    isCampusAccountAllowed({ email: 'STUDENT@NILEUNIVERSITY.EDU.NG', emailVerified: true }),
    true
  );
  assert.equal(
    isCampusAccountAllowed({ email: 'student@nileuniversity.edu.ng', emailVerified: false }),
    false
  );
  assert.equal(
    isCampusAccountAllowed({ email: 'outsider@gmail.example.com', emailVerified: true }),
    false
  );
  assert.equal(
    isCampusAccountAllowed({ email: 'user@nileuniversity.edu.ng.attacker.test.invalid', emailVerified: true }),
    false
  );
  assert.equal(
    isCampusAccountAllowed({ email: '', emailVerified: true, isMasterAdmin: true }),
    false
  );
  assert.equal(
    isCampusAccountAllowed({ email: 'owner@owner.test.invalid', emailVerified: true, isMasterAdmin: true }),
    true
  );
  assert.equal(
    isCampusAccountAllowed({ email: 'delegated@example.com', emailVerified: true, isDelegatedAdmin: true }),
    true
  );
});

test('enforces password boundaries and full-name validation', () => {
  assert.equal(validatePassword('abc12345'), true);
  assert.equal(validatePassword('short1'), false);
  assert.equal(validatePassword('abcdefgh'), false);
  assert.equal(validatePassword('12345678'), false);
  assert.equal(validatePassword('        '), false);
  assert.equal(validateFullName('Ada Lovelace'), true);
  assert.equal(validateFullName("A'B"), true);
  assert.equal(validateFullName('A'), false);
  assert.equal(validateFullName('Ada123'), false);
});
