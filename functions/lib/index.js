"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.expireStaleItems = void 0;
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const firebase_functions_1 = require("firebase-functions");
if ((0, app_1.getApps)().length === 0) {
    (0, app_1.initializeApp)();
}
const db = (0, firestore_1.getFirestore)();
exports.expireStaleItems = (0, scheduler_1.onSchedule)({
    schedule: 'every sunday 03:00',
    timeZone: 'Africa/Lagos',
    region: 'europe-west1',
    timeoutSeconds: 120,
    memory: '256MiB',
}, async () => {
    const cutoff = firestore_1.Timestamp.fromDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
    const snapshot = await db
        .collection('items')
        .where('status', 'in', ['open', 'claim_requested'])
        .where('createdAt', '<', cutoff.toDate().toISOString())
        .get();
    if (snapshot.empty) {
        firebase_functions_1.logger.info('No stale NileFound items to expire.');
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
    firebase_functions_1.logger.info('Expired stale NileFound items.', {
        itemCount: snapshot.size,
        batchCount: batches,
    });
});
