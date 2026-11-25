/**
 * One-off Firebase Admin SDK bootstrap script for provisioning the initial owner account.
 * Credentials are consumed strictly from process.env:
 *   - GOOGLE_APPLICATION_CREDENTIALS (path to service account JSON file), or
 *   - FIREBASE_SERVICE_ACCOUNT_JSON (inline JSON string)
 * Usage: node scripts/bootstrap-admin.mjs <uid> <email>
 */

import { initializeApp, applicationDefault, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import config from '../firebase-applet-config.json' with { type: 'json' };

const UID_PATTERN = /^[a-zA-Z0-9_-]{1,128}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const [uid, email] = process.argv.slice(2);
if (!uid || !email || !UID_PATTERN.test(uid)) {
  console.error('Usage: node scripts/bootstrap-admin.mjs <uid> <email>');
  process.exit(1);
}

const normalizedEmail = email.trim().toLowerCase();
if (!EMAIL_PATTERN.test(normalizedEmail) || normalizedEmail.length > 100) {
  console.error('Invalid email address provided.');
  process.exit(1);
}

function resolveEnvCredential() {
  const inlineJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (inlineJson) {
    let parsed;
    try {
      parsed = JSON.parse(inlineJson);
    } catch {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON.');
    }
    if (!parsed || typeof parsed.project_id !== 'string' || typeof parsed.client_email !== 'string' || typeof parsed.private_key !== 'string') {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is missing required service account fields.');
    }
    return cert(parsed);
  }
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim()) {
    return applicationDefault();
  }
  throw new Error('Set GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_SERVICE_ACCOUNT_JSON in process.env.');
}

try {
  const credential = resolveEnvCredential();
  const app = initializeApp({ credential, projectId: config.projectId });
  const db = getFirestore(app, config.firestoreDatabaseId);

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
} catch (error) {
  const safeMessage = error instanceof Error ? error.message : 'Admin bootstrap failed.';
  console.error(safeMessage);
  process.exit(1);
}
