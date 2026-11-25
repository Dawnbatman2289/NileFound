import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeNileEmail,
  validateNileEmail,
  validateEmailFormat,
  validatePassword,
  validateFullName,
  isCampusAccountAllowed,
  resolveDisplayName,
  ensureFreshVerifiedIdToken,
} from '../src/utils/authValidation.ts';

test('accepts and normalizes verified Nile addresses including alphanumeric and mixed-case formats', () => {
  assert.equal(normalizeNileEmail(' \tUSER@NILEUNIVERSITY.EDU.NG\n '), 'user@nileuniversity.edu.ng');
  assert.equal(validateNileEmail('  user@nileuniversity.edu.ng  '), true);
  assert.equal(validateNileEmail('student2025@nileuniversity.edu.ng'), true);
  assert.equal(validateNileEmail('201203014@nileuniversity.edu.ng'), true);
  assert.equal(validateNileEmail('  A.Bello99@NileUniversity.edu.ng '), true);
  assert.equal(
    isCampusAccountAllowed({ email: '  STUDENT99@NileUniversity.EDU.NG  ', emailVerified: true }),
    true
  );
  assert.equal(resolveDisplayName('', '  201203014@NileUniversity.EDU.NG '), '201203014');
});

test('validates general email syntax without embedding personal emails', () => {
  assert.equal(validateEmailFormat('student@nileuniversity.edu.ng'), true);
  assert.equal(validateEmailFormat('201203014@nileuniversity.edu.ng'), true);
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
    isCampusAccountAllowed({ email: '201203014@NileUniversity.edu.ng', emailVerified: true }),
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

test('resolveDisplayName safely handles alphanumeric prefixes, short names, and empty fallbacks', () => {
  assert.equal(resolveDisplayName('Amina Bello', '201203014@nileuniversity.edu.ng'), 'Amina');
  assert.equal(resolveDisplayName('', '201203014@nileuniversity.edu.ng'), '201203014');
  assert.equal(resolveDisplayName('', 'a@nileuniversity.edu.ng'), 'Campus User');
  assert.equal(resolveDisplayName('   ', ''), 'Campus User');
});

test('ensureFreshVerifiedIdToken force-refreshes stale JWT tokens when emailVerified just became true', async () => {
  const calls: boolean[] = [];
  const staleTokenUser = {
    emailVerified: true,
    getIdTokenResult: async () => ({ claims: { email_verified: false } }),
    getIdToken: async (force = false) => {
      calls.push(force);
      return force ? 'fresh-verified-jwt' : 'stale-jwt';
    },
  };
  assert.equal(await ensureFreshVerifiedIdToken(staleTokenUser), 'fresh-verified-jwt');
  assert.deepEqual(calls, [true]);

  const freshCalls: boolean[] = [];
  const alreadyFreshUser = {
    emailVerified: true,
    getIdTokenResult: async () => ({ claims: { email_verified: true } }),
    getIdToken: async (force = false) => {
      freshCalls.push(force);
      return 'cached-verified-jwt';
    },
  };
  assert.equal(await ensureFreshVerifiedIdToken(alreadyFreshUser), 'cached-verified-jwt');
  assert.deepEqual(freshCalls, [false]);
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
