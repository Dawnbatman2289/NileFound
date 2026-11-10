import test from 'node:test';
import assert from 'node:assert/strict';
import { validateFullName, validateNileEmail, validatePassword } from './authValidation.ts';

test('accepts only Nile University email addresses', () => {
  assert.equal(validateNileEmail('student@nileuniversity.edu.ng'), true);
  assert.equal(validateNileEmail('user@gmail.example.com'), false);
});

test('requires a strong registration password', () => {
  assert.equal(validatePassword('campus123'), true);
  assert.equal(validatePassword('short1'), false);
  assert.equal(validatePassword('onlyletters'), false);
});

test('validates full names', () => {
  assert.equal(validateFullName('Ada Lovelace'), true);
  assert.equal(validateFullName('Ada123'), false);
});
