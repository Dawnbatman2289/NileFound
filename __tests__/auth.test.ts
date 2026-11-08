import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateOtpCode,
  isOtpCurrent,
  normalizeNileEmail,
  validateAuthEmail,
  validateNileEmail,
  validateOtpCode,
  validatePassword,
} from '../src/utils/authValidation.ts';

test('accepts and normalizes verified Nile addresses', () => {
  assert.equal(normalizeNileEmail(' USER@NILEUNIVERSITY.EDU.NG '), 'user@nileuniversity.edu.ng');
  assert.equal(validateNileEmail('user@nileuniversity.edu.ng'), true);
  assert.equal(validateAuthEmail(' ayomide2289@gmail.com '), true);
});

test('rejects lookalike or external domains', () => {
  for (const email of [
    'user@gmail.com',
    'user@nile.edu',
    'user@nileuniversity.com',
    'user@nileuniversity.edu.ng.attacker.com',
  ]) {
    assert.equal(validateNileEmail(email), false, email);
  }
});

test('enforces password and OTP boundaries', () => {
  assert.equal(validatePassword('abc12345'), true);
  assert.equal(validatePassword('short1'), false);
  assert.equal(validatePassword('abcdefgh'), false);
  assert.equal(validatePassword('12345678'), false);
  assert.equal(validatePassword('        '), false);
  assert.equal(validateOtpCode('123456'), true);
  assert.equal(validateOtpCode('12345'), false);
  assert.equal(validateOtpCode('12a456'), false);
  assert.equal(validateOtpCode('1234567'), false);
});

test('OTP lifecycle is six digits, time limited, and boundary-safe', () => {
  assert.match(generateOtpCode(() => 0.123456), /^\d{6}$/);
  const createdAt = 1_000_000;
  assert.equal(isOtpCurrent(createdAt, createdAt + 599_999), true);
  assert.equal(isOtpCurrent(createdAt, createdAt + 600_000), false);
  assert.equal(isOtpCurrent(createdAt, createdAt - 1), false);
});
