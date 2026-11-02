/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Firebase SDK and Firestore initialization for NileFound
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signOut } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// CRITICAL: Must pass custom firestoreDatabaseId if configured
export const db =
  firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId.length > 0
    ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
    : getFirestore(app);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

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
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testConnection(): Promise<boolean> {
  try {
    if (auth.currentUser) {
      try {
        await auth.currentUser.getIdToken(false);
      } catch (tokenError: any) {
        if (
          tokenError?.message?.includes('token-service-api-has-not-been-used') ||
          tokenError?.code === 'auth/token-service-api-has-not-been-used'
        ) {
          console.warn(
            'Token Service API disabled on Google Cloud project 399482156784. Enable at: https://console.developers.google.com/apis/api/securetoken.googleapis.com/overview?project=399482156784'
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
        'Token Service API disabled on Google Cloud project 399482156784. Enable at: https://console.developers.google.com/apis/api/securetoken.googleapis.com/overview?project=399482156784'
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
