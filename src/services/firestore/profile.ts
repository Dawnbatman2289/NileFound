/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Firestore user profile synchronization helper.
 */

import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../../lib/firebase.ts';
import { User } from '../../types/index.ts';
import { normalizeNileEmail, resolveDisplayName } from '../../utils/authValidation.ts';
import { USERS } from './helpers.ts';

export async function syncUserProfile(user: User): Promise<void> {
  if (!user?.id) return;
  const userRef = doc(db, USERS, user.id);
  const authEmail = normalizeNileEmail(auth.currentUser?.email || user.email).slice(0, 100);
  const displayName = resolveDisplayName(user.name, authEmail);

  try {
    const existingSnap = await getDoc(userRef);
    if (!existingSnap.exists()) {
      await setDoc(userRef, {
        name: displayName,
        email: authEmail,
        role: 'student',
        department: user.department?.slice(0, 100) || '',
        matricNumber: user.matricNumber?.slice(0, 20) || '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      const existingData = existingSnap.data();
      const preservedDept = (user.department?.trim() || existingData.department || '').slice(0, 100);
      const preservedMatric = (user.matricNumber?.trim() || existingData.matricNumber || '').slice(0, 20);
      if (
        existingData.name === displayName &&
        existingData.email === authEmail &&
        (existingData.department || '') === preservedDept &&
        (existingData.matricNumber || '') === preservedMatric
      ) {
        return;
      }
      await updateDoc(userRef, {
        name: displayName,
        email: authEmail,
        department: preservedDept,
        matricNumber: preservedMatric,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${USERS}/${user.id}`);
  }
}
