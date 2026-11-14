/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Firebase SDK and Firestore initialization for NileFound
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signOut } from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  terminate,
  clearIndexedDbPersistence,
  doc,
  getDocFromServer,
} from 'firebase/firestore';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

const appCheckSiteKey = import.meta.env.VITE_FIREBASE_APPCHECK_SITE_KEY;
if (appCheckSiteKey) {
  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(appCheckSiteKey),
    isTokenAutoRefreshEnabled: true,
  });
}

let firestore: ReturnType<typeof getFirestore>;
try {
  const localCache = persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  });
  firestore = firebaseConfig.firestoreDatabaseId
    ? initializeFirestore(app, { localCache, experimentalAutoDetectLongPolling: true }, firebaseConfig.firestoreDatabaseId)
    : initializeFirestore(app, { localCache, experimentalAutoDetectLongPolling: true });
} catch (initError: unknown) {
  console.warn('[NileFound] Persistent Firestore cache unavailable, falling back:', initError);
  firestore = firebaseConfig.firestoreDatabaseId
    ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
    : getFirestore(app);
}

export const db = firestore;

export const auth = getAuth(app);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errMsg = error instanceof Error ? error.message : String(error);
  console.warn(`[NileFound] Firestore ${operationType} failed at ${path || 'unknown'}:`, error);
  if (errMsg.includes('token-service-api-has-not-been-used') || errMsg.includes('securetoken.googleapis.com')) {
    signOut(auth).catch((signOutErr) => {
      console.warn('[NileFound] Sign out after token error failed:', signOutErr);
    });
  }

  let userFacingMessage = 'Action could not be completed. Please check your connection and try again.';
  if (errMsg.toLowerCase().includes('missing or insufficient permissions') || errMsg.toLowerCase().includes('permission-denied')) {
    userFacingMessage = 'Access denied. You do not have permission for this campus record.';
  } else if (errMsg.toLowerCase().includes('not-found')) {
    userFacingMessage = 'The requested campus item or record could not be found.';
  }

  throw new Error(userFacingMessage);
}

export async function clearOfflinePersistence(): Promise<void> {
  try {
    await terminate(db);
    await clearIndexedDbPersistence(db);
  } catch (persistenceErr: unknown) {
    console.warn('[NileFound] Could not clear offline persistence:', persistenceErr);
  }
}

export async function testConnection(): Promise<boolean> {
  try {
    if (typeof auth.authStateReady === 'function') {
      await auth.authStateReady();
    }

    if (!auth.currentUser) {
      return navigator.onLine;
    }

    try {
      await auth.currentUser.getIdToken(false);
    } catch (tokenError: unknown) {
      const errObj = tokenError as { code?: string; message?: string };
      if (
        errObj?.message?.includes('token-service-api-has-not-been-used') ||
        errObj?.code === 'auth/token-service-api-has-not-been-used'
      ) {
        await signOut(auth);
        return false;
      }
    }

    await getDocFromServer(doc(db, 'users', auth.currentUser.uid));
    return true;
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    if (errMsg.includes('the client is offline')) {
      return false;
    }
    if (
      errMsg.includes('token-service-api-has-not-been-used') ||
      errMsg.includes('securetoken.googleapis.com')
    ) {
      if (auth.currentUser) {
        await signOut(auth);
      }
      return false;
    }
    return true;
  }
}
