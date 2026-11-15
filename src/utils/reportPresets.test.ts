/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  OFFICER_INTAKE_PRESETS,
  buildInitialReportFields,
  resolveDefaultHoldingLocation,
} from './reportPresets.ts';
import { detectPii } from './piiDetector.ts';

test('buildInitialReportFields defaults security officers to found gate custody and staff to safe defaults', () => {
  const officerDefaults = buildInitialReportFields(null, 'security');
  assert.equal(officerDefaults.type, 'found');
  assert.equal(officerDefaults.location, 'Main Campus Gate');
  assert.equal(officerDefaults.holdingLocation, 'security_main_gate');

  const staffLostDefaults = buildInitialReportFields(null, 'staff');
  assert.equal(staffLostDefaults.type, 'lost');
  assert.equal(staffLostDefaults.holdingLocation, 'finder_holding');

  const prefilled = buildInitialReportFields({ type: 'found', holdingLocation: 'library_desk' }, 'admin');
  assert.equal(prefilled.type, 'found');
  assert.equal(prefilled.holdingLocation, 'library_desk');
});

test('resolveDefaultHoldingLocation enforces main gate custody for found student IDs', () => {
  assert.equal(resolveDefaultHoldingLocation('found', 'student_id', 'student', 'finder_holding'), 'security_main_gate');
  assert.equal(resolveDefaultHoldingLocation('found', 'phone_tech', 'staff'), 'faculty_officer');
  assert.equal(resolveDefaultHoldingLocation('found', 'keys', 'security'), 'security_main_gate');
});

test('all officer intake presets are free of PII patterns', () => {
  for (const preset of OFFICER_INTAKE_PRESETS) {
    assert.equal(detectPii(preset.title).hasPii, false, `Preset title flagged: ${preset.id}`);
    assert.equal(detectPii(preset.descriptionHint).hasPii, false, `Preset description flagged: ${preset.id}`);
    if (preset.verificationQuestion) {
      assert.equal(detectPii(preset.verificationQuestion).hasPii, false, `Preset question flagged: ${preset.id}`);
    }
  }
});
