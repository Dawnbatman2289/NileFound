/**
 * One-off Firebase Admin SDK bootstrap script for provisioning the initial owner account.
 * Requires GOOGLE_APPLICATION_CREDENTIALS pointing to a service account JSON key.
 * Usage: node scripts/bootstrap-admin.mjs <uid> <email>
 */

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import config from '../firebase-applet-config.json' with { type: 'json' };

const [uid, email] = process.argv.slice(2);
if (!uid || !email) {
  console.error('Usage: node scripts/bootstrap-admin.mjs <uid> <email>');
  process.exit(1);
}

const app = initializeApp({ credential: applicationDefault(), projectId: config.projectId });
const db = getFirestore(app, config.firestoreDatabaseId);
const normalizedEmail = email.trim().toLowerCase();

await db.collection('admins').doc(uid).set({
  enabled: true,
  email: normalizedEmail,
  updatedAt: FieldValue.serverTimestamp(),
}, { merge: true });

await db.collection('roles').doc(uid).set({
  role: 'admin',
  email: normalizedEmail,
  assignedAt: FieldValue.serverTimestamp(),
  assignedBy: 'CLI Bootstrap',
  updatedAt: FieldValue.serverTimestamp(),
}, { merge: true });

console.log(`Bootstrapped master admin role for UID ${uid}`);
