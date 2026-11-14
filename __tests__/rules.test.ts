import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const firebaseJson = JSON.parse(readFileSync(resolve('firebase.json'), 'utf8'));
const indexesJson = JSON.parse(readFileSync(resolve('firestore.indexes.json'), 'utf8'));

test('firebase.json targets the named Firestore database as an array', () => {
  assert.ok(Array.isArray(firebaseJson.firestore));
  assert.equal(
    firebaseJson.firestore[0]?.database,
    'ai-studio-nilefoundnileuni-e363e16a-01ee-4569-ac1d-fd0a6b4eefbd'
  );
});

test('firestore.indexes.json defines composite query indexes', () => {
  assert.ok(Array.isArray(indexesJson.indexes) && indexesJson.indexes.length >= 3);
});
