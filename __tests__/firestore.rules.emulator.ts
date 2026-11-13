/**
 * Emulator-backed Firestore security rules test suite.
 * Run locally with Java installed via: npm run test:emulator
 */

import test, { before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';

let testEnv: RulesTestEnvironment;

const MASTER_UID = 'nFdIhTjOOqMqMG4y1KIT550Qf5m1';
const MASTER_EMAIL = 'ayomide2289@gmail.com';
const FINDER_UID = 'studentFinder01';
const FINDER_EMAIL = 'finder@nileuniversity.edu.ng';
const CLAIMANT_UID = 'studentClaimant02';
const CLAIMANT_EMAIL = 'claimant@nileuniversity.edu.ng';
const INTRUDER_UID = 'studentIntruder03';
const INTRUDER_EMAIL = 'intruder@nileuniversity.edu.ng';

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'kempt-coyote-nc70r',
    firestore: {
      rules: readFileSync(resolve('firestore.rules'), 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

after(async () => {
  await testEnv?.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

const verifiedToken = (email: string) => ({
  email,
  email_verified: true,
});

test('unauthenticated users and unverified or non-Nile accounts are denied', async () => {
  const unauth = testEnv.unauthenticatedContext().firestore();
  const unverified = testEnv.authenticatedContext('u1', { email: FINDER_EMAIL, email_verified: false }).firestore();
  const externalGmail = testEnv.authenticatedContext('u2', verifiedToken('outsider@example.com')).firestore();

  await assertFails(getDoc(doc(unauth, 'items/item1')));
  await assertFails(getDoc(doc(unverified, 'items/item1')));
  await assertFails(getDoc(doc(externalGmail, 'items/item1')));
});

test('master admin unverified token is rejected', async () => {
  const unverifiedMaster = testEnv.authenticatedContext(MASTER_UID, {
    email: MASTER_EMAIL,
    email_verified: false,
  }).firestore();
  await assertFails(getDoc(doc(unverifiedMaster, 'items/item1')));
});

test('student_id item with imageUrl is rejected by Firestore rules', async () => {
  const db = testEnv.authenticatedContext(FINDER_UID, verifiedToken(FINDER_EMAIL)).firestore();
  await assertFails(
    setDoc(doc(db, 'items/idCard1'), {
      title: 'Found ID Card',
      type: 'found',
      category: 'student_id',
      description: 'Found near Nile House.',
      location: 'Nile House',
      status: 'open',
      holdingLocation: 'security_main_gate',
      authorId: FINDER_UID,
      isSensitiveId: true,
      imageUrl: 'data:image/png;base64,AAAA',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  );
});

test('client cannot spoof createdAt or inject extra fields on items', async () => {
  const db = testEnv.authenticatedContext(FINDER_UID, verifiedToken(FINDER_EMAIL)).firestore();
  await assertFails(
    setDoc(doc(db, 'items/itemFuture'), {
      title: 'Casio Calculator',
      type: 'found',
      category: 'calculator',
      description: 'Found in Block C.',
      location: 'Block C',
      status: 'open',
      holdingLocation: 'finder_holding',
      authorId: FINDER_UID,
      createdAt: '9999-01-01T00:00:00Z',
      updatedAt: serverTimestamp(),
    })
  );
  await assertFails(
    setDoc(doc(db, 'items/itemPii'), {
      title: 'Casio Calculator',
      type: 'found',
      category: 'calculator',
      description: 'Found in Block C.',
      location: 'Block C',
      status: 'open',
      holdingLocation: 'finder_holding',
      authorId: FINDER_UID,
      authorEmail: FINDER_EMAIL,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  );
});

test('batched item + private + secret write succeeds, and intruder cannot squat private subcollections', async () => {
  const finderDb = testEnv.authenticatedContext(FINDER_UID, verifiedToken(FINDER_EMAIL)).firestore();
  const batch = writeBatch(finderDb);
  batch.set(doc(finderDb, 'items/calc1'), {
    title: 'Casio Calculator',
    type: 'found',
    category: 'calculator',
    description: 'Found in Block C.',
    location: 'Block C',
    status: 'open',
    holdingLocation: 'finder_holding',
    authorId: FINDER_UID,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  batch.set(doc(finderDb, 'items/calc1/private/details'), {
    itemId: 'calc1',
    authorId: FINDER_UID,
    authorName: 'Chidera',
    authorEmail: FINDER_EMAIL,
    createdAt: serverTimestamp(),
  });
  batch.set(doc(finderDb, 'items/calc1/secrets/verification'), {
    itemId: 'calc1',
    authorId: FINDER_UID,
    expectedAnswer: 'Red sticker on back',
    createdAt: serverTimestamp(),
  });
  await assertSucceeds(batch.commit());

  const intruderDb = testEnv.authenticatedContext(INTRUDER_UID, verifiedToken(INTRUDER_EMAIL)).firestore();
  await assertFails(
    setDoc(doc(intruderDb, 'items/calc1/private/spoof'), {
      itemId: 'calc1',
      authorId: INTRUDER_UID,
      authorName: 'Intruder',
      authorEmail: INTRUDER_EMAIL,
      createdAt: serverTimestamp(),
    })
  );
});

test('claim creation requires deterministic ID, blocks self-claims, lets finder read, and gates handover details', async () => {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const adminDb = ctx.firestore();
    await setDoc(doc(adminDb, 'items/foundPhone1'), {
      title: 'Black Android Phone',
      type: 'found',
      category: 'phone_tech',
      description: 'Found near Library.',
      location: 'Library',
      status: 'open',
      holdingLocation: 'finder_holding',
      authorId: FINDER_UID,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await setDoc(doc(adminDb, 'items/foundPhone1/private/details'), {
      itemId: 'foundPhone1',
      authorId: FINDER_UID,
      authorName: 'Chidera',
      authorEmail: FINDER_EMAIL,
      createdAt: new Date(),
    });
  });

  const finderDb = testEnv.authenticatedContext(FINDER_UID, verifiedToken(FINDER_EMAIL)).firestore();
  const claimantDb = testEnv.authenticatedContext(CLAIMANT_UID, verifiedToken(CLAIMANT_EMAIL)).firestore();
  const intruderDb = testEnv.authenticatedContext(INTRUDER_UID, verifiedToken(INTRUDER_EMAIL)).firestore();

  // Random non-deterministic claim ID rejected
  await assertFails(
    setDoc(doc(claimantDb, 'claims/randomId'), {
      itemId: 'foundPhone1',
      itemTitle: 'Black Android Phone',
      claimantId: CLAIMANT_UID,
      finderId: FINDER_UID,
      status: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  );

  // Self-claim rejected
  await assertFails(
    setDoc(doc(finderDb, `claims/foundPhone1_${FINDER_UID}`), {
      itemId: 'foundPhone1',
      itemTitle: 'Black Android Phone',
      claimantId: FINDER_UID,
      finderId: FINDER_UID,
      status: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  );

  // Flipping item to claim_requested without a claim doc fails
  await assertFails(
    updateDoc(doc(intruderDb, 'items/foundPhone1'), {
      status: 'claim_requested',
      updatedAt: serverTimestamp(),
    })
  );

  // Valid batched claim + privateClaim + item transition succeeds
  const claimId = `foundPhone1_${CLAIMANT_UID}`;
  const claimBatch = writeBatch(claimantDb);
  claimBatch.set(doc(claimantDb, `claims/${claimId}`), {
    itemId: 'foundPhone1',
    itemTitle: 'Black Android Phone',
    claimantId: CLAIMANT_UID,
    finderId: FINDER_UID,
    status: 'pending',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  claimBatch.set(doc(claimantDb, `items/foundPhone1/privateClaims/${claimId}`), {
    itemId: 'foundPhone1',
    claimId,
    claimantId: CLAIMANT_UID,
    claimantName: 'Aisha',
    claimantEmail: CLAIMANT_EMAIL,
    submittedAnswer: 'Abuja mosque lockscreen',
    createdAt: serverTimestamp(),
  });
  claimBatch.update(doc(claimantDb, 'items/foundPhone1'), {
    status: 'claim_requested',
    updatedAt: serverTimestamp(),
  });
  await assertSucceeds(claimBatch.commit());

  // Finder can read the claim, and claimant cannot read private/details before approval
  await assertSucceeds(getDoc(doc(finderDb, `claims/${claimId}`)));
  await assertFails(getDoc(doc(claimantDb, 'items/foundPhone1/private/details')));

  // Intruder cannot spoof claim_approved notification
  await assertFails(
    setDoc(doc(intruderDb, 'notifications/spoof1'), {
      recipientUid: CLAIMANT_UID,
      fromUid: INTRUDER_UID,
      type: 'claim_approved',
      title: 'Claim approved',
      message: 'Your ownership claim was approved.',
      read: false,
      itemId: 'foundPhone1',
      claimId,
      createdAt: serverTimestamp(),
    })
  );

  // Finder approves claim and sends valid claim_approved notification
  await assertSucceeds(
    updateDoc(doc(finderDb, `claims/${claimId}`), {
      status: 'approved',
      updatedAt: serverTimestamp(),
    })
  );
  await assertSucceeds(
    setDoc(doc(finderDb, 'notifications/real1'), {
      recipientUid: CLAIMANT_UID,
      fromUid: FINDER_UID,
      type: 'claim_approved',
      title: 'Claim approved',
      message: 'Your ownership claim was approved.',
      read: false,
      itemId: 'foundPhone1',
      claimId,
      createdAt: serverTimestamp(),
    })
  );

  // Approved claimant can now read finder's handover contact details
  await assertSucceeds(getDoc(doc(claimantDb, 'items/foundPhone1/private/details')));
  // Cleanup by author
  await assertSucceeds(deleteDoc(doc(finderDb, 'items/foundPhone1')));
});
