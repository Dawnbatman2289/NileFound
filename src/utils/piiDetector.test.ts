import test from 'node:test';
import assert from 'node:assert/strict';
import { detectPii } from './piiDetector.ts';
import { formatDateDDMMYYYY } from './dateFormatter.ts';

test('detectPii catches matric numbers in various formats', () => {
  assert.equal(detectPii('My matric is 23/0481 please return').hasPii, true);
  assert.equal(detectPii('24/ENG/0192 is on the ID').hasPii, true);
  assert.equal(detectPii('Matric starts with 23/1234').hasPii, true);
  assert.equal(detectPii('Casio FX-991EX calculator').hasPii, false);
});

test('detectPii catches Nigerian phone numbers', () => {
  assert.equal(detectPii('Call me at 08012345678 if found').hasPii, true);
  assert.equal(detectPii('Reach me on +2348031234567').hasPii, true);
  assert.equal(detectPii('09098765432 or WhatsApp me').hasPii, true);
  assert.equal(detectPii('Found at gate around 2:30pm').hasPii, false);
});

test('detectPii catches email addresses', () => {
  assert.equal(detectPii('Email me at student@nileuniversity.edu.ng').hasPii, true);
  assert.equal(detectPii('Contact john@gmail.example.com').hasPii, true);
  assert.equal(detectPii('Blue backpack found in Ubangi').hasPii, false);
});

test('formatDateDDMMYYYY formats dates in DD/MM/YYYY format', () => {
  assert.equal(formatDateDDMMYYYY('2026-10-24'), '24/10/2026');
  assert.equal(formatDateDDMMYYYY('2026-10-24T08:00:00Z'), '24/10/2026');
});
