/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Lightweight Firebase App & Auth bootstrap (excludes Firestore to keep initial bundle small).
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signOut } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
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
