import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateScaledDimensions,
  isSupportedImageFile,
  isValidImageDataUrl,
  MAX_CANVAS_BOUND,
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

test('isValidImageDataUrl rejects empty canvas data URLs and non-image URIs', () => {
  assert.equal(isValidImageDataUrl('data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/'), true);
  assert.equal(isValidImageDataUrl('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA'), true);
  assert.equal(isValidImageDataUrl('data:,'), false);
  assert.equal(isValidImageDataUrl(''), false);
  assert.equal(isValidImageDataUrl(null), false);
  assert.equal(isValidImageDataUrl('data:image/svg+xml;base64,PHN2Zz4='), false);
  assert.equal(isValidImageDataUrl('data:image/jpeg;base64,AAAA'), false);
});

test('calculateScaledDimensions clamps large photos to <= 1280px before canvas allocation', () => {
  assert.equal(MAX_CANVAS_BOUND, 1280);
  assert.deepEqual(calculateScaledDimensions(4000, 3000), { width: 1280, height: 960 });
  assert.deepEqual(calculateScaledDimensions(3000, 4000), { width: 960, height: 1280 });
  assert.deepEqual(calculateScaledDimensions(4000, 3000, 800), { width: 800, height: 600 });
  assert.deepEqual(calculateScaledDimensions(800, 600, 2000), { width: 800, height: 600 });
});

test('inline thumbnail cap guarantees 25 photo items transfer under 150 KB', () => {
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

  const twentyFiveItemsBytes = Buffer.byteLength(
    JSON.stringify(Array.from({ length: 25 }, () => JSON.parse(sampleItemPayload))),
    'utf8'
  );
  assert.ok(
    twentyFiveItemsBytes < 150 * 1024,
    `Expected 25 photo items feed payload to be under 150 KB, got ${twentyFiveItemsBytes} bytes`
  );
});
