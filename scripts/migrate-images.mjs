/**
 * One-off Firebase Admin SDK migration script to move legacy inline `items.imageUrl`
 * into `items/{id}/media/full` and clear `items.imageUrl` (or strip photos from `student_id`).
 *
 * Requires GOOGLE_APPLICATION_CREDENTIALS pointing to a service account JSON key.
 * Defaults to --dry-run; pass --apply to write changes to Firestore.
 *
 * Usage:
 *   node scripts/migrate-images.mjs --dry-run
 *   node scripts/migrate-images.mjs --apply
 */

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import config from '../firebase-applet-config.json' with { type: 'json' };

const args = new Set(process.argv.slice(2));
const applyChanges = args.has('--apply');

const app = initializeApp({ credential: applicationDefault(), projectId: config.projectId });
const db = getFirestore(app, config.firestoreDatabaseId);

const BATCH_SIZE = 200;
let lastDoc = null;
let scanned = 0;
let migrated = 0;
let strippedStudentId = 0;

while (true) {
  let q = db.collection('items').orderBy('__name__').limit(BATCH_SIZE);
  if (lastDoc) q = q.startAfter(lastDoc);
  const snap = await q.get();
  if (snap.empty) break;

  for (const itemDoc of snap.docs) {
    scanned += 1;
    const data = itemDoc.data();
    const hasLegacyImage = typeof data.imageUrl === 'string' && data.imageUrl.length > 0;
    const isStudentId = data.category === 'student_id';

    if (!hasLegacyImage && !(isStudentId && data.thumbUrl)) continue;

    if (isStudentId) {
      strippedStudentId += 1;
      if (applyChanges) {
        const batch = db.batch();
        batch.update(itemDoc.ref, {
          imageUrl: FieldValue.delete(),
          thumbUrl: FieldValue.delete(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        batch.delete(itemDoc.ref.collection('media').doc('full'));
        await batch.commit();
      }
      continue;
    }

    migrated += 1;
    if (applyChanges) {
      const batch = db.batch();
      const mediaRef = itemDoc.ref.collection('media').doc('full');
      const existingMedia = await mediaRef.get();
      if (!existingMedia.exists) {
        batch.set(mediaRef, {
          itemId: itemDoc.id,
          authorId: data.authorId || 'migration',
          dataUrl: data.imageUrl,
          createdAt: FieldValue.serverTimestamp(),
        });
      }
      batch.update(itemDoc.ref, {
        imageUrl: FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      await batch.commit();
    }
  }

  lastDoc = snap.docs.at(-1);
  if (snap.size < BATCH_SIZE) break;
}

console.log(
  JSON.stringify(
    {
      mode: applyChanges ? 'apply' : 'dry-run',
      scanned,
      migratedLegacyPhotos: migrated,
      strippedStudentIdPhotos: strippedStudentId,
    },
    null,
    2
  )
);
