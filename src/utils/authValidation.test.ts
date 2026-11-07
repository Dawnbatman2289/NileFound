import test from 'node:test';
import assert from 'node:assert/strict';
import { generateOtpCode, isOtpCurrent, validateNileEmail, validatePassword } from './authValidation.ts';

test('accepts only Nile University email addresses', () => {
  assert.equal(validateNileEmail('student@nileuniversity.edu.ng'), true);
  assert.equal(validateNileEmail('user@gmail.com'), false);
});

test('requires a strong registration password', () => {
  assert.equal(validatePassword('campus123'), true);
  assert.equal(validatePassword('short1'), false);
  assert.equal(validatePassword('onlyletters'), false);
});

test('generates six-digit OTP codes and rejects expired codes', () => {
  assert.equal(generateOtpCode(() => 0), '000000');
  assert.equal(generateOtpCode(() => 0.999999), '999999');
  assert.equal(isOtpCurrent(Date.now() - 9 * 60 * 1000), true);
  assert.equal(isOtpCurrent(Date.now() - 10 * 60 * 1000), false);
});
