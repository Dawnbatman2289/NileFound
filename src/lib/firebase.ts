/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Firebase SDK and Firestore initialization for NileFound
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signOut } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// CRITICAL: Must pass custom firestoreDatabaseId if configured
export const db =
  firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId.length > 0
    ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
    : getFirestore(app);

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
  if (errMsg.includes('token-service-api-has-not-been-used') || errMsg.includes('securetoken.googleapis.com')) {
    signOut(auth).catch(() => {});
  }

  // Sanitize message: do not expose internal paths, user identifiers, or stack traces
  let userFacingMessage = 'Action could not be completed. Please check your connection and try again.';
  if (errMsg.toLowerCase().includes('missing or insufficient permissions') || errMsg.toLowerCase().includes('permission-denied')) {
    userFacingMessage = 'Access denied. You do not have permission for this campus record.';
  } else if (errMsg.toLowerCase().includes('not-found')) {
    userFacingMessage = 'The requested campus item or record could not be found.';
  }

  // Internal debug log only containing sanitized operation code, never auth tokens or user email
  console.warn(`[Data Service] Operation ${operationType} on ${path?.split('/')[0] || 'resource'} failed:`, errMsg);
  throw new Error(userFacingMessage);
}

export async function testConnection(): Promise<boolean> {
  try {
    // Wait for initial auth state from IndexedDB to be ready
    if (typeof auth.authStateReady === 'function') {
      await auth.authStateReady();
    }

    if (auth.currentUser) {
      try {
        await auth.currentUser.getIdToken(false);
      } catch (tokenError: any) {
        if (
          tokenError?.message?.includes('token-service-api-has-not-been-used') ||
          tokenError?.code === 'auth/token-service-api-has-not-been-used'
        ) {
          console.warn(
            'Token Service API disabled on Google Cloud project 399482156784. Signing out stale session.'
          );
          await signOut(auth);
          return false;
        }
      }
    }
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error: any) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase connection: client appears offline.');
      return false;
    }
    if (
      error?.message?.includes('token-service-api-has-not-been-used') ||
      error?.message?.includes('securetoken.googleapis.com')
    ) {
      console.warn(
        'Token Service API disabled on Google Cloud project 399482156784. Signing out stale session.'
      );
      if (auth.currentUser) {
        await signOut(auth);
      }
      return false;
    }
    // A permission-denied or not-found error from server actually proves we reached Firestore server
    return true;
  }
}
