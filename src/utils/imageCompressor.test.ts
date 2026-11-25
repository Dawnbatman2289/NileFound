import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateScaledDimensions,
  isSupportedImageFile,
  isValidDisplayImageUrl,
  isValidImageDataUrl,
  isValidStorageImageUrl,
  MAX_CANVAS_BOUND,
  MAX_STORAGE_PHOTO_BYTES,
  MAX_STORAGE_THUMB_BYTES,
} from './imageCompressor.ts';

test('imageCompressor validates allowed image formats and size bounds', () => {
  assert.equal(isSupportedImageFile({ type: 'image/jpeg', size: 1024 }), true);
  assert.equal(isSupportedImageFile({ type: 'image/png', size: 1024 }), true);
  assert.equal(isSupportedImageFile({ type: 'image/webp', size: 1024 }), true);
  assert.equal(isSupportedImageFile({ type: 'image/gif', size: 1024 }), false);
  assert.equal(isSupportedImageFile({ type: 'image/jpeg', size: 0 }), false);
  assert.equal(isSupportedImageFile({ type: 'image/jpeg', size: 6 * 1024 * 1024 }), false);
});

test('image URL validators accept Storage HTTPS URLs, blob previews, and valid legacy data URLs while rejecting unsafe URIs', () => {
  assert.equal(
    isValidStorageImageUrl('https://firebasestorage.googleapis.com/v0/b/kempt-coyote-nc70r.firebasestorage.app/o/items%2F1%2Fphoto.jpg?alt=media'),
    true
  );
  assert.equal(isValidStorageImageUrl('http://insecure.example.com/photo.jpg'), false);
  assert.equal(isValidStorageImageUrl('data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/'), false);

  assert.equal(isValidDisplayImageUrl('blob:https://nilefound.example.com/1234-5678'), true);
  assert.equal(isValidDisplayImageUrl('javascript:alert(1)'), false);

  assert.equal(isValidImageDataUrl('data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/'), true);
  assert.equal(isValidImageDataUrl('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA'), true);
  assert.equal(isValidImageDataUrl('data:,'), false);
  assert.equal(isValidImageDataUrl(''), false);
  assert.equal(isValidImageDataUrl(null), false);
  assert.equal(isValidImageDataUrl('data:image/svg+xml;base64,PHN2Zz4='), false);
  assert.equal(isValidImageDataUrl('data:image/jpeg;base64,AAAA'), false);
});

test('calculateScaledDimensions clamps large photos to <= 1024px before canvas allocation', () => {
  assert.equal(MAX_CANVAS_BOUND, 1024);
  assert.deepEqual(calculateScaledDimensions(4000, 3000), { width: 1024, height: 768 });
  assert.deepEqual(calculateScaledDimensions(3000, 4000), { width: 768, height: 1024 });
  assert.deepEqual(calculateScaledDimensions(4000, 3000, 800), { width: 800, height: 600 });
  assert.deepEqual(calculateScaledDimensions(800, 600, 2000), { width: 800, height: 600 });
});

test('Storage URL references keep Firestore feed item documents lightweight', () => {
  assert.ok(MAX_STORAGE_PHOTO_BYTES <= 100 * 1024);
  assert.ok(MAX_STORAGE_THUMB_BYTES <= 24 * 1024);

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
    thumbUrl: 'https://firebasestorage.googleapis.com/v0/b/kempt-coyote-nc70r.firebasestorage.app/o/items%2Fitem-1234567890%2Fthumb.jpg?alt=media&token=123',
    imageUrl: 'https://firebasestorage.googleapis.com/v0/b/kempt-coyote-nc70r.firebasestorage.app/o/items%2Fitem-1234567890%2Fphoto.jpg?alt=media&token=123',
    createdAt: '2026-11-10T10:00:00.000Z',
  });

  const twentyFiveItemsBytes = Buffer.byteLength(
    JSON.stringify(Array.from({ length: 25 }, () => JSON.parse(sampleItemPayload))),
    'utf8'
  );
  assert.ok(
    twentyFiveItemsBytes < 25 * 1024,
    `Expected 25 Storage-backed photo items feed payload to be under 25 KB, got ${twentyFiveItemsBytes} bytes`
  );
});
