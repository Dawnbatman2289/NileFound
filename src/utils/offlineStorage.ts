/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * NileFound IndexedDB Offline Draft Storage
 * 
 * Why IndexedDB instead of localStorage?
 * As Ayomide identified: localStorage is synchronous and capped at ~5MB of UTF-16 text.
 * A single compressed photo (even at 80KB) in base64 can easily bloat localStorage.
 * IndexedDB provides asynchronous, structured, transactional storage capable of
 * holding hundreds of megabytes of drafts and binary image blobs directly on the
 * student's phone without freezing the UI thread.
 */

export interface OfflineDraft {
  id: string;
  reportType: 'lost' | 'found';
  title: string;
  category: string;
  location: string;
  description: string;
  dateLostOrFound: string;
  holdingLocation: string;
  verificationQuestion?: string;
  imageDataUrl?: string;
  imageBlob?: Blob;
  updatedAt: string;
}

const DB_NAME = 'nilefound_offline_db';
const DB_VERSION = 1;
const STORE_NAME = 'report_drafts';

export function openDraftDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported in this environment'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Saves a draft asynchronously to IndexedDB.
 */
export async function saveDraftToIndexedDB(draft: OfflineDraft): Promise<void> {
  const db = await openDraftDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(draft);

    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Loads the active draft from IndexedDB.
 */
export async function getDraftFromIndexedDB(id = 'current_active_draft'): Promise<OfflineDraft | null> {
  try {
    const db = await openDraftDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);

      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

/**
 * Deletes the draft once successfully submitted.
 */
export async function deleteDraftFromIndexedDB(id = 'current_active_draft'): Promise<void> {
  try {
    const db = await openDraftDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // Ignore error on deletion
  }
}
