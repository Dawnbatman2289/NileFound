/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Firebase Cloud Storage upload and cleanup helpers for campus item photos.
 */

import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { app } from '../../lib/firebaseAuth.ts';

export interface UploadedItemPhotos {
  imageUrl?: string;
  thumbUrl?: string;
  uploadedPaths: string[];
}

function isObjectNotFoundError(error: unknown): boolean {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code || '')
      : '';
  return code === 'storage/object-not-found';
}

export async function uploadItemPhotosToStorage(params: {
  itemId: string;
  authorId: string;
  photoFile?: File;
  thumbFile?: File;
}): Promise<UploadedItemPhotos> {
  const { itemId, authorId, photoFile, thumbFile } = params;
  if (!photoFile && !thumbFile) {
    return { uploadedPaths: [] };
  }

  const storage = getStorage(app);
  const metadata = {
    contentType: 'image/jpeg',
    cacheControl: 'public, max-age=31536000',
    customMetadata: { authorId },
  };
  const uploadedPaths: string[] = [];

  try {
    let imageUrl: string | undefined;
    let thumbUrl: string | undefined;

    if (photoFile) {
      const photoPath = `items/${itemId}/photo.jpg`;
      const photoRef = ref(storage, photoPath);
      await uploadBytes(photoRef, photoFile, metadata);
      uploadedPaths.push(photoPath);
      imageUrl = await getDownloadURL(photoRef);
    }

    if (thumbFile) {
      const thumbPath = `items/${itemId}/thumb.jpg`;
      const thumbRef = ref(storage, thumbPath);
      await uploadBytes(thumbRef, thumbFile, metadata);
      uploadedPaths.push(thumbPath);
      thumbUrl = await getDownloadURL(thumbRef);
    } else if (imageUrl) {
      thumbUrl = imageUrl;
    }

    return { imageUrl, thumbUrl, uploadedPaths };
  } catch (error) {
    if (uploadedPaths.length > 0) {
      await cleanupStoragePaths(uploadedPaths);
    }
    throw new Error(
      error instanceof Error && error.message
        ? `Could not upload item photo: ${error.message}`
        : 'Could not upload item photo to campus storage. Check your connection and try again.'
    );
  }
}

export async function cleanupStoragePaths(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  const storage = getStorage(app);
  await Promise.allSettled(
    paths.map(async (path) => {
      try {
        await deleteObject(ref(storage, path));
      } catch (err) {
        if (!isObjectNotFoundError(err)) {
          console.warn(`[NileFound] Storage cleanup skipped for ${path}:`, err);
        }
      }
    })
  );
}

export async function deleteItemPhotosFromStorage(itemId: string): Promise<void> {
  await cleanupStoragePaths([`items/${itemId}/photo.jpg`, `items/${itemId}/thumb.jpg`]);
}
