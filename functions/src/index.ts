import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions';

if (getApps().length === 0) {
  initializeApp();
}

const db = getFirestore();

export const expireStaleItems = onSchedule(
  {
    schedule: 'every sunday 03:00',
    timeZone: 'Africa/Lagos',
    region: 'europe-west1',
    timeoutSeconds: 120,
    memory: '256MiB',
  },
  async () => {
    const cutoff = Timestamp.fromDate(
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    );
    const snapshot = await db
      .collection('items')
      .where('status', 'in', ['open', 'claim_requested'])
      .where('createdAt', '<', cutoff.toDate().toISOString())
      .get();

    if (snapshot.empty) {
      logger.info('No stale NileFound items to expire.');
      return;
    }

    let batch = db.batch();
    let writes = 0;
    let batches = 0;
    for (const item of snapshot.docs) {
      batch.update(item.ref, {
        status: 'expired',
        updatedAt: new Date().toISOString(),
      });
      writes += 1;
      if (writes === 450) {
        await batch.commit();
        batches += 1;
        batch = db.batch();
        writes = 0;
      }
    }
    if (writes > 0) {
      await batch.commit();
      batches += 1;
    }
    logger.info('Expired stale NileFound items.', {
      itemCount: snapshot.size,
      batchCount: batches,
    });
  },
);
