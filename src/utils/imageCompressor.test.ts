import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isSupportedImageFile,
  MAX_FIRESTORE_DATA_URL_CHARS,
  MAX_THUMB_DATA_URL_CHARS,
} from './imageCompressor.ts';

test('imageCompressor validates allowed image formats and size bounds', () => {
  assert.equal(isSupportedImageFile({ type: 'image/jpeg', size: 1024 }), true);
  assert.equal(isSupportedImageFile({ type: 'image/png', size: 1024 }), true);
  assert.equal(isSupportedImageFile({ type: 'image/webp', size: 1024 }), true);
  assert.equal(isSupportedImageFile({ type: 'image/gif', size: 1024 }), false);
  assert.equal(isSupportedImageFile({ type: 'image/jpeg', size: 0 }), false);
  assert.equal(isSupportedImageFile({ type: 'image/jpeg', size: 6 * 1024 * 1024 }), false);
});

test('inline thumbnail cap guarantees 20 photo items transfer well under 150 KB', () => {
  assert.ok(MAX_THUMB_DATA_URL_CHARS <= 4096);
  assert.ok(MAX_FIRESTORE_DATA_URL_CHARS <= 135000);

  const sampleItemPayload = JSON.stringify({
    id: 'item-1234567890',
    type: 'found',
    title: 'Casio fx-991EX Scientific Calculator',
    category: 'calculator',
    description: 'Found on the second floor desk near the window.',
    location: 'Engineering Block (Block C)',
    locationDetails: 'Room 204',
    dateLostOrFound: '2026-11-10',
    status: 'open',
    holdingLocation: 'finder_holding',
    authorId: 'student1234567890',
    thumbUrl: 'data:image/jpeg;base64,' + 'A'.repeat(MAX_THUMB_DATA_URL_CHARS - 23),
    createdAt: '2026-11-10T10:00:00.000Z',
  });

  const twentyItemsBytes = Buffer.byteLength(JSON.stringify(Array.from({ length: 20 }, () => JSON.parse(sampleItemPayload))), 'utf8');
  assert.ok(
    twentyItemsBytes < 150 * 1024,
    `Expected 20 photo items feed payload to be under 150 KB, got ${twentyItemsBytes} bytes`
  );
});
