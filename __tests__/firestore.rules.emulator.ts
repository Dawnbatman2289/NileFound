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
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  where,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';

let testEnv: RulesTestEnvironment;

const MASTER_UID = 'nFdIhTjOOqMqMG4y1KIT550Qf5m1';
const MASTER_EMAIL = 'root-admin@owner.test.invalid';
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
  if (testEnv) await testEnv.cleanup();
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
  const mixedCaseNile = testEnv.authenticatedContext('u3', verifiedToken('Student@NileUniversity.edu.ng')).firestore();

  await assertFails(getDoc(doc(unauth, 'items/item1')));
  await assertFails(getDoc(doc(unverified, 'items/item1')));
  await assertFails(getDoc(doc(externalGmail, 'items/item1')));
  await assertFails(
    setDoc(doc(externalGmail, 'users/u2'), {
      name: 'Outsider',
      email: 'outsider@example.com',
      role: 'student',
      createdAt: serverTimestamp(),
    })
  );
  await assertFails(
    setDoc(doc(externalGmail, 'items/extItem1'), {
      title: 'External Lost Item',
      type: 'lost',
      category: 'other',
      description: 'Should be blocked.',
      location: 'Main Gate',
      status: 'open',
      holdingLocation: 'finder_holding',
      authorId: 'u2',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  );
  await assertSucceeds(
    setDoc(doc(mixedCaseNile, 'users/u3'), {
      name: 'Verified Student',
      email: 'Student@NileUniversity.edu.ng',
      role: 'student',
      createdAt: serverTimestamp(),
    })
  );
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

  // Finder approves claim atomically with item status -> verified and sends valid notification
  const approveBatch = writeBatch(finderDb);
  approveBatch.update(doc(finderDb, `claims/${claimId}`), {
    status: 'approved',
    updatedAt: serverTimestamp(),
  });
  approveBatch.update(doc(finderDb, 'items/foundPhone1'), {
    status: 'verified',
    updatedAt: serverTimestamp(),
  });
  await assertSucceeds(approveBatch.commit());

  // Terminal claim cannot be reverted back to pending or rejected after approval
  await assertFails(
    updateDoc(doc(finderDb, `claims/${claimId}`), {
      status: 'rejected',
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

  // Second student can still submit a competing claim while item is claim_requested
  const intruderClaimId = `foundPhone1_${INTRUDER_UID}`;
  const competingBatch = writeBatch(intruderDb);
  competingBatch.set(doc(intruderDb, `claims/${intruderClaimId}`), {
    itemId: 'foundPhone1',
    itemTitle: 'Black Android Phone',
    claimantId: INTRUDER_UID,
    finderId: FINDER_UID,
    status: 'pending',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  competingBatch.set(doc(intruderDb, `items/foundPhone1/privateClaims/${intruderClaimId}`), {
    itemId: 'foundPhone1',
    claimId: intruderClaimId,
    claimantId: INTRUDER_UID,
    claimantName: 'Bello',
    claimantEmail: INTRUDER_EMAIL,
    submittedAnswer: 'Dark grey case',
    createdAt: serverTimestamp(),
  });
  competingBatch.update(doc(intruderDb, 'items/foundPhone1'), {
    status: 'claim_requested',
    updatedAt: serverTimestamp(),
  });
  await assertSucceeds(competingBatch.commit());

  // Re-opening item to claim_requested or submitting another competing claim is tested on a fresh open item:
  // Cleanup by author
  await assertSucceeds(deleteDoc(doc(finderDb, 'items/foundPhone1')));
});

test('media/full and thumbUrl allowed for regular items and denied for student_id', async () => {
  const finderDb = testEnv.authenticatedContext(FINDER_UID, verifiedToken(FINDER_EMAIL)).firestore();
  const validBatch = writeBatch(finderDb);
  validBatch.set(doc(finderDb, 'items/bag1'), {
    title: 'Black Backpack',
    type: 'found',
    category: 'bag_backpack',
    description: 'Found near Nile House.',
    location: 'Nile House',
    status: 'open',
    holdingLocation: 'finder_holding',
    authorId: FINDER_UID,
    thumbUrl: 'data:image/jpeg;base64,AAAA',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  validBatch.set(doc(finderDb, 'items/bag1/media/full'), {
    itemId: 'bag1',
    authorId: FINDER_UID,
    dataUrl: 'data:image/jpeg;base64,AAAA',
    createdAt: serverTimestamp(),
  });
  await assertSucceeds(validBatch.commit());
  await assertSucceeds(getDoc(doc(finderDb, 'items/bag1/media/full')));

  // Direct media/full write under a student_id item is denied
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'items/id2'), {
      title: 'A student ID card was found',
      type: 'found',
      category: 'student_id',
      description: 'Handed to security.',
      location: 'Gate',
      status: 'open',
      holdingLocation: 'security_main_gate',
      authorId: FINDER_UID,
      isSensitiveId: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });
  await assertFails(
    setDoc(doc(finderDb, 'items/id2/media/full'), {
      itemId: 'id2',
      authorId: FINDER_UID,
      dataUrl: 'data:image/jpeg;base64,AAAA',
      createdAt: serverTimestamp(),
    })
  );
  await assertFails(getDoc(doc(finderDb, 'items/id2/media/full')));
});

test('list queries enforce limit <= 50 and block unpaginated reads', async () => {
  const db = testEnv.authenticatedContext(FINDER_UID, verifiedToken(FINDER_EMAIL)).firestore();
  await assertSucceeds(getDocs(query(collection(db, 'items'), limit(50))));
  await assertFails(getDocs(query(collection(db, 'items'), limit(51))));
  await assertFails(getDocs(collection(db, 'items')));
});

test('atomic batch approval rejects competing pending claim and blocks approving when item is returned', async () => {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const adminDb = ctx.firestore();
    await setDoc(doc(adminDb, 'items/calc2'), {
      title: 'Scientific Calculator',
      type: 'found',
      category: 'calculator',
      description: 'Blue case.',
      location: 'Congo House',
      status: 'claim_requested',
      holdingLocation: 'finder_holding',
      authorId: FINDER_UID,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await setDoc(doc(adminDb, `claims/calc2_${CLAIMANT_UID}`), {
      itemId: 'calc2',
      itemTitle: 'Scientific Calculator',
      claimantId: CLAIMANT_UID,
      finderId: FINDER_UID,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await setDoc(doc(adminDb, `claims/calc2_${INTRUDER_UID}`), {
      itemId: 'calc2',
      itemTitle: 'Scientific Calculator',
      claimantId: INTRUDER_UID,
      finderId: FINDER_UID,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  const finderDb = testEnv.authenticatedContext(FINDER_UID, verifiedToken(FINDER_EMAIL)).firestore();
  const batch = writeBatch(finderDb);
  batch.update(doc(finderDb, `claims/calc2_${CLAIMANT_UID}`), { status: 'approved', updatedAt: serverTimestamp() });
  batch.update(doc(finderDb, 'items/calc2'), { status: 'verified', updatedAt: serverTimestamp() });
  batch.update(doc(finderDb, `claims/calc2_${INTRUDER_UID}`), { status: 'rejected', updatedAt: serverTimestamp() });
  await assertSucceeds(batch.commit());

  // Once item is returned, approving any claim on it must fail
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'items/returnedItem'), {
      title: 'Keys',
      type: 'found',
      category: 'keys',
      description: '3 keys',
      location: 'Gate',
      status: 'returned',
      holdingLocation: 'security_main_gate',
      authorId: FINDER_UID,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await setDoc(doc(ctx.firestore(), `claims/returnedItem_${CLAIMANT_UID}`), {
      itemId: 'returnedItem',
      itemTitle: 'Keys',
      claimantId: CLAIMANT_UID,
      finderId: FINDER_UID,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });
  const badApprove = writeBatch(finderDb);
  badApprove.update(doc(finderDb, `claims/returnedItem_${CLAIMANT_UID}`), { status: 'approved', updatedAt: serverTimestamp() });
  badApprove.update(doc(finderDb, 'items/returnedItem'), { status: 'verified', updatedAt: serverTimestamp() });
  await assertFails(badApprove.commit());
});

test('security role follows least privilege: allowed on desk items, denied deletes, roles, users, and finder secrets', async () => {
  const SEC_UID = 'securityOfficer01';
  const SEC_EMAIL = 'security.officer@nileuniversity.edu.ng';

  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const adminDb = ctx.firestore();
    await setDoc(doc(adminDb, `roles/${SEC_UID}`), {
      email: SEC_EMAIL,
      role: 'security',
      assignedAt: new Date(),
    });
    await setDoc(doc(adminDb, 'items/gateItem'), {
      title: 'Student Wallet',
      type: 'found',
      category: 'other',
      description: 'Black wallet',
      location: 'Main Gate',
      status: 'claim_requested',
      holdingLocation: 'security_main_gate',
      authorId: FINDER_UID,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await setDoc(doc(adminDb, 'items/gateItem/secrets/verification'), {
      itemId: 'gateItem',
      authorId: FINDER_UID,
      expectedAnswer: 'Green bank card',
      createdAt: new Date(),
    });
    await setDoc(doc(adminDb, `claims/gateItem_${CLAIMANT_UID}`), {
      itemId: 'gateItem',
      itemTitle: 'Student Wallet',
      claimantId: CLAIMANT_UID,
      finderId: FINDER_UID,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await setDoc(doc(adminDb, 'items/finderItem'), {
      title: 'Laptop Charger',
      type: 'found',
      category: 'phone_tech',
      description: 'USB-C',
      location: 'Library',
      status: 'claim_requested',
      holdingLocation: 'finder_holding',
      authorId: FINDER_UID,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await setDoc(doc(adminDb, 'items/finderItem/secrets/verification'), {
      itemId: 'finderItem',
      authorId: FINDER_UID,
      expectedAnswer: '65W Dell',
      createdAt: new Date(),
    });
  });

  const secDb = testEnv.authenticatedContext(SEC_UID, verifiedToken(SEC_EMAIL)).firestore();
  // Allowed: read desk secret and approve desk claim in batch
  await assertSucceeds(getDoc(doc(secDb, 'items/gateItem/secrets/verification')));
  const secApprove = writeBatch(secDb);
  secApprove.update(doc(secDb, `claims/gateItem_${CLAIMANT_UID}`), { status: 'approved', updatedAt: serverTimestamp() });
  secApprove.update(doc(secDb, 'items/gateItem'), { status: 'verified', updatedAt: serverTimestamp() });
  await assertSucceeds(secApprove.commit());

  // Denied: read finder_holding secret, edit non-status item fields, delete items, list users/roles, write roles
  await assertFails(getDoc(doc(secDb, 'items/finderItem/secrets/verification')));
  await assertFails(updateDoc(doc(secDb, 'items/gateItem'), { title: 'Tampered', updatedAt: serverTimestamp() }));
  await assertFails(deleteDoc(doc(secDb, 'items/gateItem')));
  await assertFails(getDocs(query(collection(secDb, 'users'), limit(10))));
  await assertFails(getDocs(query(collection(secDb, 'roles'), limit(10))));
  await assertFails(setDoc(doc(secDb, `roles/${INTRUDER_UID}`), {
    role: 'security',
    email: INTRUDER_EMAIL,
    assignedAt: serverTimestamp(),
  }));
});

test('users profile email must match verified auth token and only master admin writes roles/invites/admins', async () => {
  const DELEGATED_UID = 'delegatedAdmin01';
  const DELEGATED_EMAIL = 'delegated@nileuniversity.edu.ng';
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `admins/${DELEGATED_UID}`), {
      enabled: true,
      email: DELEGATED_EMAIL,
      updatedAt: new Date(),
    });
  });

  const intruderDb = testEnv.authenticatedContext(INTRUDER_UID, verifiedToken(INTRUDER_EMAIL)).firestore();
  await assertSucceeds(
    setDoc(doc(intruderDb, `users/${INTRUDER_UID}`), {
      name: 'Intruder',
      email: INTRUDER_EMAIL,
      role: 'student',
      createdAt: serverTimestamp(),
    })
  );
  await assertFails(
    setDoc(doc(intruderDb, `users/${INTRUDER_UID}`), {
      name: 'Intruder',
      email: FINDER_EMAIL,
      role: 'student',
      createdAt: serverTimestamp(),
    })
  );

  const delegatedDb = testEnv.authenticatedContext(DELEGATED_UID, verifiedToken(DELEGATED_EMAIL)).firestore();
  await assertFails(
    setDoc(doc(delegatedDb, `staffInvites/${INTRUDER_EMAIL}`), {
      email: INTRUDER_EMAIL,
      role: 'security',
      assignedAt: serverTimestamp(),
    })
  );

  const masterDb = testEnv.authenticatedContext(MASTER_UID, verifiedToken(MASTER_EMAIL)).firestore();
  await assertSucceeds(
    setDoc(doc(masterDb, `staffInvites/${INTRUDER_EMAIL}`), {
      email: INTRUDER_EMAIL,
      role: 'security',
      assignedAt: serverTimestamp(),
    })
  );
});

test('explicit /roles/{uid} student override blocks access even if a stale /staffInvites doc exists', async () => {
  const STAFF_UID = 'staffUser04';
  const STAFF_EMAIL = 'officer@nileuniversity.edu.ng';

  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const adminDb = ctx.firestore();
    await setDoc(doc(adminDb, `staffInvites/${STAFF_EMAIL}`), {
      email: STAFF_EMAIL,
      role: 'security',
      assignedAt: new Date(),
    });
    await setDoc(doc(adminDb, `roles/${STAFF_UID}`), {
      email: STAFF_EMAIL,
      role: 'student',
      assignedAt: new Date(),
    });
    await setDoc(doc(adminDb, 'items/lockedItem'), {
      title: 'Keys',
      type: 'found',
      category: 'keys',
      description: 'Bunch of 3 keys.',
      location: 'Gate',
      status: 'open',
      holdingLocation: 'security_main_gate',
      authorId: FINDER_UID,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await setDoc(doc(adminDb, 'items/lockedItem/private/details'), {
      itemId: 'lockedItem',
      authorId: FINDER_UID,
      authorName: 'Chidera',
      authorEmail: FINDER_EMAIL,
      createdAt: new Date(),
    });
  });

  const revokedDb = testEnv.authenticatedContext(STAFF_UID, verifiedToken(STAFF_EMAIL)).firestore();
  await assertFails(getDoc(doc(revokedDb, 'items/lockedItem/private/details')));
});

test('student_id blocks thumbUrl, users block self-role escalation, and UID-mismatched master email is denied', async () => {
  const finderDb = testEnv.authenticatedContext(FINDER_UID, verifiedToken(FINDER_EMAIL)).firestore();
  await assertFails(
    setDoc(doc(finderDb, 'items/idWithThumb'), {
      title: 'A student ID card was found',
      type: 'found',
      category: 'student_id',
      description: 'Found near Library.',
      location: 'Library',
      status: 'open',
      holdingLocation: 'security_main_gate',
      authorId: FINDER_UID,
      isSensitiveId: true,
      thumbUrl: 'data:image/jpeg;base64,AAAA',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  );

  // Student cannot self-assign admin/security role on /users/{uid}
  await assertFails(
    setDoc(doc(finderDb, `users/${FINDER_UID}`), {
      name: 'Finder',
      email: FINDER_EMAIL,
      role: 'admin',
      createdAt: serverTimestamp(),
    })
  );

  // UID mismatch even with master email cannot access or write /admins
  const spoofMasterDb = testEnv.authenticatedContext(INTRUDER_UID, verifiedToken(MASTER_EMAIL)).firestore();
  await assertFails(
    setDoc(doc(spoofMasterDb, `admins/${INTRUDER_UID}`), {
      enabled: true,
      email: MASTER_EMAIL,
      updatedAt: serverTimestamp(),
    })
  );

  // Verified master admin can grant delegated admin, and delegated admin can read private/details
  const masterDb = testEnv.authenticatedContext(MASTER_UID, verifiedToken(MASTER_EMAIL)).firestore();
  await assertSucceeds(
    setDoc(doc(masterDb, `admins/${CLAIMANT_UID}`), {
      enabled: true,
      email: CLAIMANT_EMAIL,
      updatedAt: serverTimestamp(),
    })
  );
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'items/deskCheck'), {
      title: 'Bottle',
      type: 'found',
      category: 'other',
      description: 'Steel bottle',
      location: 'Main Gate',
      status: 'open',
      holdingLocation: 'security_main_gate',
      authorId: FINDER_UID,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await setDoc(doc(ctx.firestore(), 'items/deskCheck/private/details'), {
      itemId: 'deskCheck',
      authorId: FINDER_UID,
      authorName: 'Finder',
      authorEmail: FINDER_EMAIL,
      createdAt: new Date(),
    });
  });
  const delegatedDb = testEnv.authenticatedContext(CLAIMANT_UID, verifiedToken(CLAIMANT_EMAIL)).firestore();
  await assertSucceeds(getDoc(doc(delegatedDb, 'items/deskCheck/private/details')));
});

test('notification rules allow valid claim_received/match_alert/item_returned and block spoofing or deprecated admin_review', async () => {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const adminDb = ctx.firestore();
    await setDoc(doc(adminDb, 'items/foundBag'), {
      title: 'Blue Bag',
      type: 'found',
      category: 'bag_backpack',
      description: 'Found in Block B.',
      location: 'Block B',
      status: 'claim_requested',
      holdingLocation: 'finder_holding',
      authorId: FINDER_UID,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await setDoc(doc(adminDb, 'items/lostBag'), {
      title: 'Blue Bag',
      type: 'lost',
      category: 'bag_backpack',
      description: 'Lost in Block B.',
      location: 'Block B',
      status: 'open',
      holdingLocation: 'finder_holding',
      authorId: CLAIMANT_UID,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await setDoc(doc(adminDb, `claims/foundBag_${CLAIMANT_UID}`), {
      itemId: 'foundBag',
      itemTitle: 'Blue Bag',
      claimantId: CLAIMANT_UID,
      finderId: FINDER_UID,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  const finderDb = testEnv.authenticatedContext(FINDER_UID, verifiedToken(FINDER_EMAIL)).firestore();
  const claimantDb = testEnv.authenticatedContext(CLAIMANT_UID, verifiedToken(CLAIMANT_EMAIL)).firestore();
  const intruderDb = testEnv.authenticatedContext(INTRUDER_UID, verifiedToken(INTRUDER_EMAIL)).firestore();

  // Valid claim_received from claimant to finder
  await assertSucceeds(
    setDoc(doc(claimantDb, 'notifications/nClaim1'), {
      recipientUid: FINDER_UID,
      fromUid: CLAIMANT_UID,
      type: 'claim_received',
      title: 'New claim on your item',
      message: 'A new ownership claim was filed for your item.',
      read: false,
      itemId: 'foundBag',
      claimId: `foundBag_${CLAIMANT_UID}`,
      createdAt: serverTimestamp(),
    })
  );

  // Intruder cannot spoof item_returned or match_alert without an owned source item
  await assertFails(
    setDoc(doc(intruderDb, 'notifications/nSpoofRet'), {
      recipientUid: FINDER_UID,
      fromUid: INTRUDER_UID,
      type: 'item_returned',
      title: 'Item returned',
      message: 'Your reported item was marked returned.',
      read: false,
      itemId: 'foundBag',
      createdAt: serverTimestamp(),
    })
  );
  await assertFails(
    setDoc(doc(intruderDb, 'notifications/nSpoofMatch'), {
      recipientUid: CLAIMANT_UID,
      fromUid: INTRUDER_UID,
      type: 'match_alert',
      title: 'Possible item match',
      message: 'A possible match was found for your report.',
      read: false,
      itemId: 'lostBag',
      sourceItemId: 'foundBag',
      createdAt: serverTimestamp(),
    })
  );

  // Finder can send valid match_alert backed by sourceItemId + item_returned, but deprecated admin_review is denied
  await assertSucceeds(
    setDoc(doc(finderDb, 'notifications/nMatchOk'), {
      recipientUid: CLAIMANT_UID,
      fromUid: FINDER_UID,
      type: 'match_alert',
      title: 'Possible item match',
      message: 'A possible match was found for your report.',
      read: false,
      itemId: 'lostBag',
      sourceItemId: 'foundBag',
      createdAt: serverTimestamp(),
    })
  );
  await assertSucceeds(
    setDoc(doc(finderDb, 'notifications/nRetOk'), {
      recipientUid: FINDER_UID,
      fromUid: FINDER_UID,
      type: 'item_returned',
      title: 'Item returned',
      message: 'Your reported item was marked returned.',
      read: false,
      itemId: 'foundBag',
      createdAt: serverTimestamp(),
    })
  );
  await assertFails(
    setDoc(doc(finderDb, 'notifications/nAdminDenied'), {
      recipientUid: 'admin',
      fromUid: FINDER_UID,
      type: 'admin_review',
      title: 'Review needed',
      message: 'A campus record needs administrator review.',
      read: false,
      itemId: 'foundBag',
      createdAt: serverTimestamp(),
    })
  );
});

test('claim chat allows finder/claimant messages on active claims and blocks intruders, role spoofing, and closed claims', async () => {
  const claimId = `chatItem_${CLAIMANT_UID}`;
  const rejectedClaimId = `chatItem_${INTRUDER_UID}`;
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const adminDb = ctx.firestore();
    await setDoc(doc(adminDb, 'items/chatItem'), {
      title: 'Black HP Charger',
      type: 'found',
      category: 'phone_tech',
      description: 'Found in Engineering Block.',
      location: 'Engineering Block',
      status: 'verified',
      holdingLocation: 'finder_holding',
      authorId: FINDER_UID,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await setDoc(doc(adminDb, `claims/${claimId}`), {
      itemId: 'chatItem',
      itemTitle: 'Black HP Charger',
      claimantId: CLAIMANT_UID,
      finderId: FINDER_UID,
      status: 'approved',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await setDoc(doc(adminDb, `claims/${rejectedClaimId}`), {
      itemId: 'chatItem',
      itemTitle: 'Black HP Charger',
      claimantId: INTRUDER_UID,
      finderId: FINDER_UID,
      status: 'rejected',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  const finderDb = testEnv.authenticatedContext(FINDER_UID, verifiedToken(FINDER_EMAIL)).firestore();
  const claimantDb = testEnv.authenticatedContext(CLAIMANT_UID, verifiedToken(CLAIMANT_EMAIL)).firestore();
  const intruderDb = testEnv.authenticatedContext(INTRUDER_UID, verifiedToken(INTRUDER_EMAIL)).firestore();

  // Allowed: claimant and finder message each other and read the thread
  await assertSucceeds(
    setDoc(doc(claimantDb, `claims/${claimId}/messages/m1`), {
      senderId: CLAIMANT_UID,
      senderRole: 'Claimant',
      text: 'Hello, I can pick it up at the Main Gate at 2pm.',
      createdAt: serverTimestamp(),
    })
  );
  await assertSucceeds(
    setDoc(doc(finderDb, `claims/${claimId}/messages/m2`), {
      senderId: FINDER_UID,
      senderRole: 'Finder',
      text: 'Works for me, see you by 2pm.',
      createdAt: serverTimestamp(),
    })
  );
  await assertSucceeds(getDocs(query(collection(claimantDb, `claims/${claimId}/messages`), limit(20))));

  // Denied: third-party student cannot read or write chat messages
  await assertFails(getDocs(query(collection(intruderDb, `claims/${claimId}/messages`), limit(20))));
  await assertFails(
    setDoc(doc(intruderDb, `claims/${claimId}/messages/mIntruder`), {
      senderId: INTRUDER_UID,
      senderRole: 'Claimant',
      text: 'Let me in too.',
      createdAt: serverTimestamp(),
    })
  );

  // Denied: claimant cannot spoof Admin role label
  await assertFails(
    setDoc(doc(claimantDb, `claims/${claimId}/messages/mSpoofRole`), {
      senderId: CLAIMANT_UID,
      senderRole: 'Admin',
      text: 'Impersonating admin',
      createdAt: serverTimestamp(),
    })
  );

  // Denied: rejected claim cannot receive new messages
  await assertFails(
    setDoc(doc(intruderDb, `claims/${rejectedClaimId}/messages/mClosed`), {
      senderId: INTRUDER_UID,
      senderRole: 'Claimant',
      text: 'Still trying after rejection.',
      createdAt: serverTimestamp(),
    })
  );

  // Allowed: claimant and finder can send scoped chat_message notifications using deterministic chat_{claimId}_{recipientUid} IDs
  const finderChatNotifId = `chat_${claimId}_${FINDER_UID}`;
  const claimantChatNotifId = `chat_${claimId}_${CLAIMANT_UID}`;
  await assertSucceeds(
    setDoc(doc(claimantDb, `notifications/${finderChatNotifId}`), {
      recipientUid: FINDER_UID,
      fromUid: CLAIMANT_UID,
      type: 'chat_message',
      title: 'New handover message',
      message: 'You have a new message in your item handover chat.',
      read: false,
      itemId: 'chatItem',
      claimId,
      createdAt: serverTimestamp(),
    })
  );
  // Allowed: in-place overwrite keeps read:false and refreshes createdAt without spamming new docs
  await assertSucceeds(
    setDoc(doc(claimantDb, `notifications/${finderChatNotifId}`), {
      recipientUid: FINDER_UID,
      fromUid: CLAIMANT_UID,
      type: 'chat_message',
      title: 'New handover message',
      message: 'You have a new message in your item handover chat.',
      read: false,
      itemId: 'chatItem',
      claimId,
      createdAt: serverTimestamp(),
    })
  );
  await assertSucceeds(
    setDoc(doc(finderDb, `notifications/${claimantChatNotifId}`), {
      recipientUid: CLAIMANT_UID,
      fromUid: FINDER_UID,
      type: 'chat_message',
      title: 'New handover message',
      message: 'You have a new message in your item handover chat.',
      read: false,
      itemId: 'chatItem',
      claimId,
      createdAt: serverTimestamp(),
    })
  );

  // Denied: random-ID chat_message notification is blocked to prevent notification spam
  await assertFails(
    setDoc(doc(claimantDb, 'notifications/nChatRandomSpam'), {
      recipientUid: FINDER_UID,
      fromUid: CLAIMANT_UID,
      type: 'chat_message',
      title: 'New handover message',
      message: 'You have a new message in your item handover chat.',
      read: false,
      itemId: 'chatItem',
      claimId,
      createdAt: serverTimestamp(),
    })
  );

  // Denied: intruder cannot send chat_message notification, and finder cannot target unrelated user
  await assertFails(
    setDoc(doc(intruderDb, `notifications/chat_${claimId}_${FINDER_UID}`), {
      recipientUid: FINDER_UID,
      fromUid: INTRUDER_UID,
      type: 'chat_message',
      title: 'New handover message',
      message: 'You have a new message in your item handover chat.',
      read: false,
      itemId: 'chatItem',
      claimId,
      createdAt: serverTimestamp(),
    })
  );
  await assertFails(
    setDoc(doc(finderDb, `notifications/chat_${claimId}_${INTRUDER_UID}`), {
      recipientUid: INTRUDER_UID,
      fromUid: FINDER_UID,
      type: 'chat_message',
      title: 'New handover message',
      message: 'You have a new message in your item handover chat.',
      read: false,
      itemId: 'chatItem',
      claimId,
      createdAt: serverTimestamp(),
    })
  );

  // Denied: finder and intruder cannot delete claimant's chat message; Allowed: sender deletes own message or admin deletes any
  await assertFails(deleteDoc(doc(finderDb, `claims/${claimId}/messages/m1`)));
  await assertFails(deleteDoc(doc(intruderDb, `claims/${claimId}/messages/m1`)));
  await assertSucceeds(deleteDoc(doc(claimantDb, `claims/${claimId}/messages/m1`)));
  await assertSucceeds(deleteDoc(doc(finderDb, `claims/${claimId}/messages/m2`)));

  const masterDb = testEnv.authenticatedContext(MASTER_UID, verifiedToken(MASTER_EMAIL)).firestore();
  await assertSucceeds(
    setDoc(doc(claimantDb, `claims/${claimId}/messages/m3`), {
      senderId: CLAIMANT_UID,
      senderRole: 'Claimant',
      text: 'One more note before handover.',
      createdAt: serverTimestamp(),
    })
  );
  await assertSucceeds(deleteDoc(doc(masterDb, `claims/${claimId}/messages/m3`)));
});

test('rejected claimant can resubmit once atomically, second retry and unauthorized users are denied', async () => {
  const claimId = `retryItem_${CLAIMANT_UID}`;
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const adminDb = ctx.firestore();
    await setDoc(doc(adminDb, 'items/retryItem'), {
      title: 'Green Power Bank',
      type: 'found',
      category: 'power_bank',
      description: 'Found in Cafeteria.',
      location: 'Central Cafeteria',
      status: 'open',
      holdingLocation: 'finder_holding',
      authorId: FINDER_UID,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await setDoc(doc(adminDb, `claims/${claimId}`), {
      itemId: 'retryItem',
      itemTitle: 'Green Power Bank',
      claimantId: CLAIMANT_UID,
      finderId: FINDER_UID,
      status: 'rejected',
      resubmitted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await setDoc(doc(adminDb, `items/retryItem/privateClaims/${claimId}`), {
      itemId: 'retryItem',
      claimId,
      claimantId: CLAIMANT_UID,
      claimantName: 'Aisha',
      claimantEmail: CLAIMANT_EMAIL,
      submittedAnswer: 'First guess',
      createdAt: new Date(),
    });
  });

  const finderDb = testEnv.authenticatedContext(FINDER_UID, verifiedToken(FINDER_EMAIL)).firestore();
  const claimantDb = testEnv.authenticatedContext(CLAIMANT_UID, verifiedToken(CLAIMANT_EMAIL)).firestore();
  const intruderDb = testEnv.authenticatedContext(INTRUDER_UID, verifiedToken(INTRUDER_EMAIL)).firestore();

  // Allowed: finder queries fresh pending claims scoped by finderId; Denied: intruder queries pending claims
  await assertSucceeds(
    getDocs(
      query(
        collection(finderDb, 'claims'),
        where('itemId', '==', 'retryItem'),
        where('status', '==', 'pending'),
        where('finderId', '==', FINDER_UID),
        limit(50)
      )
    )
  );
  await assertFails(
    getDocs(
      query(
        collection(intruderDb, 'claims'),
        where('itemId', '==', 'retryItem'),
        where('status', '==', 'pending'),
        limit(50)
      )
    )
  );

  // Denied: another user cannot resubmit claimant's rejected claim
  const intruderRetry = writeBatch(intruderDb);
  intruderRetry.update(doc(intruderDb, `claims/${claimId}`), {
    status: 'pending',
    resubmitted: true,
    updatedAt: serverTimestamp(),
  });
  intruderRetry.update(doc(intruderDb, `items/retryItem/privateClaims/${claimId}`), {
    submittedAnswer: 'Hijacked answer',
    updatedAt: serverTimestamp(),
  });
  intruderRetry.update(doc(intruderDb, 'items/retryItem'), {
    status: 'claim_requested',
    updatedAt: serverTimestamp(),
  });
  await assertFails(intruderRetry.commit());

  // Denied: updating privateClaims answer alone without atomic claims resubmission fails
  await assertFails(
    updateDoc(doc(claimantDb, `items/retryItem/privateClaims/${claimId}`), {
      submittedAnswer: 'Unpaired edit',
      updatedAt: serverTimestamp(),
    })
  );

  // Allowed: claimant resubmits once atomically with privateClaims + item status
  const retryBatch = writeBatch(claimantDb);
  retryBatch.update(doc(claimantDb, `claims/${claimId}`), {
    status: 'pending',
    resubmitted: true,
    updatedAt: serverTimestamp(),
  });
  retryBatch.update(doc(claimantDb, `items/retryItem/privateClaims/${claimId}`), {
    submittedAnswer: '20000mAh Oraimo with scratch on corner',
    updatedAt: serverTimestamp(),
  });
  retryBatch.update(doc(claimantDb, 'items/retryItem'), {
    status: 'claim_requested',
    updatedAt: serverTimestamp(),
  });
  await assertSucceeds(retryBatch.commit());

  // Finder rejects the resubmitted claim
  const rejectSecond = writeBatch(finderDb);
  rejectSecond.update(doc(finderDb, `claims/${claimId}`), {
    status: 'rejected',
    updatedAt: serverTimestamp(),
  });
  rejectSecond.update(doc(finderDb, 'items/retryItem'), {
    status: 'open',
    updatedAt: serverTimestamp(),
  });
  await assertSucceeds(rejectSecond.commit());

  // Denied: second resubmission is blocked because resubmitted is already true
  const secondRetryBatch = writeBatch(claimantDb);
  secondRetryBatch.update(doc(claimantDb, `claims/${claimId}`), {
    status: 'pending',
    resubmitted: true,
    updatedAt: serverTimestamp(),
  });
  secondRetryBatch.update(doc(claimantDb, `items/retryItem/privateClaims/${claimId}`), {
    submittedAnswer: 'Third try',
    updatedAt: serverTimestamp(),
  });
  secondRetryBatch.update(doc(claimantDb, 'items/retryItem'), {
    status: 'claim_requested',
    updatedAt: serverTimestamp(),
  });
  await assertFails(secondRetryBatch.commit());
});

test('staff role cannot be self-assigned in /users and comes only from /roles or /staffInvites without moderation PII access', async () => {
  const STAFF_UID = 'staffFaculty01';
  const STAFF_EMAIL = 'n.okafor@nileuniversity.edu.ng';
  const INVITED_STAFF_EMAIL = 'lecturer@nileuniversity.edu.ng';

  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const adminDb = ctx.firestore();
    await setDoc(doc(adminDb, 'items/custodyItem'), {
      title: 'Black Wallet',
      type: 'found',
      category: 'other',
      description: 'Found near Engineering Block.',
      location: 'Congo House',
      status: 'open',
      holdingLocation: 'security_main_gate',
      authorId: FINDER_UID,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await setDoc(doc(adminDb, 'items/custodyItem/private/details'), {
      itemId: 'custodyItem',
      authorId: FINDER_UID,
      authorName: 'Finder',
      authorEmail: FINDER_EMAIL,
      createdAt: new Date(),
    });
  });

  const staffDb = testEnv.authenticatedContext(STAFF_UID, verifiedToken(STAFF_EMAIL)).firestore();
  const masterDb = testEnv.authenticatedContext(MASTER_UID, verifiedToken(MASTER_EMAIL)).firestore();

  // Denied: verified user cannot self-assign role 'staff' on /users/{uid}
  await assertFails(
    setDoc(doc(staffDb, `users/${STAFF_UID}`), {
      name: 'Ngozi Okafor',
      email: STAFF_EMAIL,
      role: 'staff',
      createdAt: serverTimestamp(),
    })
  );

  // Allowed: /users/{uid} must be created with role 'student'
  await assertSucceeds(
    setDoc(doc(staffDb, `users/${STAFF_UID}`), {
      name: 'Ngozi Okafor',
      email: STAFF_EMAIL,
      role: 'student',
      createdAt: serverTimestamp(),
    })
  );

  // Allowed: provisioned staff member can report items, denied reading moderation PII
  await assertSucceeds(
    setDoc(doc(masterDb, `roles/${STAFF_UID}`), {
      email: STAFF_EMAIL,
      role: 'staff',
      assignedAt: serverTimestamp(),
    })
  );
  await assertSucceeds(
    setDoc(doc(staffDb, 'items/staffLostMic'), {
      title: 'Missing Lecture Microphone',
      type: 'lost',
      category: 'phone_tech',
      description: 'Left on podium after morning lecture.',
      location: 'Congo House',
      status: 'open',
      holdingLocation: 'finder_holding',
      authorId: STAFF_UID,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  );

  // Denied: staff role cannot read other users' private reporter details
  await assertFails(getDoc(doc(staffDb, 'items/custodyItem/private/details')));

  // Denied: non-master user cannot write staffInvites; Allowed: master admin can provision 'staff'
  await assertFails(
    setDoc(doc(staffDb, `staffInvites/${INVITED_STAFF_EMAIL}`), {
      email: INVITED_STAFF_EMAIL,
      role: 'staff',
      assignedAt: serverTimestamp(),
    })
  );
  await assertSucceeds(
    setDoc(doc(masterDb, `staffInvites/${INVITED_STAFF_EMAIL}`), {
      email: INVITED_STAFF_EMAIL,
      role: 'staff',
      assignedAt: serverTimestamp(),
    })
  );
});

test('Item 9 & 10: desk drop-offs start awaiting_dropoff, block claims until security confirms, and restrict security item updates', async () => {
  const SEC_UID = 'securityGate01';
  const SEC_EMAIL = 'gate.security@nileuniversity.edu.ng';

  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `roles/${SEC_UID}`), {
      email: SEC_EMAIL,
      role: 'security',
      assignedAt: new Date(),
    });
    await setDoc(doc(ctx.firestore(), 'items/finderOnlyItem'), {
      title: 'Black Earbuds Case',
      type: 'found',
      category: 'phone_tech',
      description: 'Found in Block A.',
      location: 'Block A',
      status: 'verified',
      holdingLocation: 'finder_holding',
      custodyStatus: 'confirmed',
      authorId: FINDER_UID,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  const finderDb = testEnv.authenticatedContext(FINDER_UID, verifiedToken(FINDER_EMAIL)).firestore();
  const claimantDb = testEnv.authenticatedContext(CLAIMANT_UID, verifiedToken(CLAIMANT_EMAIL)).firestore();
  const secDb = testEnv.authenticatedContext(SEC_UID, verifiedToken(SEC_EMAIL)).firestore();

  // Denied: regular student cannot self-confirm desk custody
  await assertFails(
    setDoc(doc(finderDb, 'items/deskBottleSelf'), {
      title: 'Green Water Bottle',
      type: 'found',
      category: 'other',
      description: 'Found outside Library.',
      location: 'Nile Main Library',
      status: 'open',
      holdingLocation: 'security_main_gate',
      custodyStatus: 'confirmed',
      authorId: FINDER_UID,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  );

  // Allowed: regular student creates desk item with custodyStatus: awaiting_dropoff
  await assertSucceeds(
    setDoc(doc(finderDb, 'items/deskBottle'), {
      title: 'Green Water Bottle',
      type: 'found',
      category: 'other',
      description: 'Found outside Library.',
      location: 'Nile Main Library',
      status: 'open',
      holdingLocation: 'security_main_gate',
      custodyStatus: 'awaiting_dropoff',
      authorId: FINDER_UID,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  );

  // Denied: claims are blocked while desk item is still awaiting_dropoff
  const blockedClaimId = `deskBottle_${CLAIMANT_UID}`;
  const blockedBatch = writeBatch(claimantDb);
  blockedBatch.set(doc(claimantDb, `claims/${blockedClaimId}`), {
    itemId: 'deskBottle',
    itemTitle: 'Green Water Bottle',
    claimantId: CLAIMANT_UID,
    finderId: FINDER_UID,
    status: 'pending',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  blockedBatch.set(doc(claimantDb, `items/deskBottle/privateClaims/${blockedClaimId}`), {
    itemId: 'deskBottle',
    claimId: blockedClaimId,
    claimantId: CLAIMANT_UID,
    claimantName: 'Aisha',
    claimantEmail: CLAIMANT_EMAIL,
    submittedAnswer: 'Sticker on base',
    createdAt: serverTimestamp(),
  });
  blockedBatch.update(doc(claimantDb, 'items/deskBottle'), {
    status: 'claim_requested',
    updatedAt: serverTimestamp(),
  });
  await assertFails(blockedBatch.commit());

  // Denied: claimant cannot confirm custodyStatus; Allowed: security confirms awaiting_dropoff -> confirmed
  await assertFails(
    updateDoc(doc(claimantDb, 'items/deskBottle'), {
      custodyStatus: 'confirmed',
      updatedAt: serverTimestamp(),
    })
  );
  await assertSucceeds(
    updateDoc(doc(secDb, 'items/deskBottle'), {
      custodyStatus: 'confirmed',
      updatedAt: serverTimestamp(),
    })
  );

  // Allowed: claim succeeds after security confirms custody
  await assertSucceeds(blockedBatch.commit());

  // Denied: security cannot mark an unverified desk item directly as returned or touch finder_holding items
  await assertFails(
    updateDoc(doc(secDb, 'items/deskBottle'), {
      status: 'returned',
      updatedAt: serverTimestamp(),
    })
  );
  await assertFails(
    updateDoc(doc(secDb, 'items/finderOnlyItem'), {
      status: 'returned',
      updatedAt: serverTimestamp(),
    })
  );

  // Allowed: security approves desk claim -> verified, then marks desk item verified -> returned
  const secApprove = writeBatch(secDb);
  secApprove.update(doc(secDb, `claims/${blockedClaimId}`), { status: 'approved', updatedAt: serverTimestamp() });
  secApprove.update(doc(secDb, 'items/deskBottle'), { status: 'verified', updatedAt: serverTimestamp() });
  await assertSucceeds(secApprove.commit());

  await assertSucceeds(
    updateDoc(doc(secDb, 'items/deskBottle'), {
      status: 'returned',
      updatedAt: serverTimestamp(),
    })
  );
});

test('Item 11 & Task 8: items reject legacy imageUrl, enforce authorId/createdAt immutability, and lock nested claims reads', async () => {
  const finderDb = testEnv.authenticatedContext(FINDER_UID, verifiedToken(FINDER_EMAIL)).firestore();
  const intruderDb = testEnv.authenticatedContext(INTRUDER_UID, verifiedToken(INTRUDER_EMAIL)).firestore();

  // Denied: legacy inline base64 imageUrl on items is rejected
  await assertFails(
    setDoc(doc(finderDb, 'items/legacyPhotoItem'), {
      title: 'Leather Wallet',
      type: 'found',
      category: 'other',
      description: 'Found near Cafeteria.',
      location: 'Central Cafeteria',
      status: 'open',
      holdingLocation: 'finder_holding',
      custodyStatus: 'confirmed',
      authorId: FINDER_UID,
      imageUrl: 'data:image/jpeg;base64,AAAA',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  );

  // Denied: student_id items cannot attach Cloud Storage HTTPS URLs
  await assertFails(
    setDoc(doc(finderDb, 'items/idHttpsPhoto'), {
      title: 'Found ID Card',
      type: 'found',
      category: 'student_id',
      description: 'Found at Nile House.',
      location: 'Nile House (Admin)',
      status: 'open',
      holdingLocation: 'security_main_gate',
      authorId: FINDER_UID,
      isSensitiveId: true,
      imageUrl: 'https://firebasestorage.googleapis.com/v0/b/demo/o/items%2Fid%2Fphoto.jpg?alt=media',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  );

  // Allowed: non-sensitive items accept Firebase Storage HTTPS imageUrl and thumbUrl
  await assertSucceeds(
    setDoc(doc(finderDb, 'items/storagePhotoItem'), {
      title: 'Black Anker Power Bank',
      type: 'found',
      category: 'power_bank',
      description: 'Found near Engineering Block.',
      location: 'Engineering Block (Block C)',
      status: 'open',
      holdingLocation: 'finder_holding',
      custodyStatus: 'confirmed',
      authorId: FINDER_UID,
      imageUrl: 'https://firebasestorage.googleapis.com/v0/b/demo/o/items%2FstoragePhotoItem%2Fphoto.jpg?alt=media',
      thumbUrl: 'https://firebasestorage.googleapis.com/v0/b/demo/o/items%2FstoragePhotoItem%2Fthumb.jpg?alt=media',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  );

  await assertSucceeds(
    setDoc(doc(finderDb, 'items/immutableItem'), {
      title: 'Casio fx-991EX',
      type: 'found',
      category: 'calculator',
      description: 'Left on desk.',
      location: 'Block C',
      status: 'open',
      holdingLocation: 'finder_holding',
      custodyStatus: 'confirmed',
      authorId: FINDER_UID,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  );

  // Denied: author cannot mutate authorId or createdAt post-creation
  await assertFails(
    updateDoc(doc(finderDb, 'items/immutableItem'), {
      authorId: INTRUDER_UID,
      updatedAt: serverTimestamp(),
    })
  );
  await assertFails(
    updateDoc(doc(finderDb, 'items/immutableItem'), {
      createdAt: new Date('2025-01-01T00:00:00Z'),
      updatedAt: serverTimestamp(),
    })
  );

  // Nested /items/{itemId}/claims/{claimId} is readable only by claimer or admin (writes always denied)
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `items/immutableItem/claims/${CLAIMANT_UID}`), {
      claimantId: CLAIMANT_UID,
      status: 'pending',
    });
  });
  const claimantDb = testEnv.authenticatedContext(CLAIMANT_UID, verifiedToken(CLAIMANT_EMAIL)).firestore();
  const masterDb = testEnv.authenticatedContext(MASTER_UID, verifiedToken(MASTER_EMAIL)).firestore();
  await assertSucceeds(getDoc(doc(claimantDb, `items/immutableItem/claims/${CLAIMANT_UID}`)));
  await assertSucceeds(getDoc(doc(masterDb, `items/immutableItem/claims/${CLAIMANT_UID}`)));
  await assertFails(getDoc(doc(intruderDb, `items/immutableItem/claims/${CLAIMANT_UID}`)));
  await assertFails(
    setDoc(doc(claimantDb, `items/immutableItem/claims/${INTRUDER_UID}`), {
      claimantId: CLAIMANT_UID,
      status: 'pending',
    })
  );
});

test('mixed-case alphanumeric Nile student and invited staff emails work seamlessly in /users and /staffInvites', async () => {
  const MIXED_UID = 'alphanumStudent01';
  const MIXED_TOKEN_EMAIL = '201203014.Bello@NileUniversity.edu.ng';
  const LOWER_EMAIL = MIXED_TOKEN_EMAIL.toLowerCase();

  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `staffInvites/${LOWER_EMAIL}`), {
      email: LOWER_EMAIL,
      role: 'security',
      assignedAt: new Date(),
    });
  });

  const mixedDb = testEnv.authenticatedContext(MIXED_UID, verifiedToken(MIXED_TOKEN_EMAIL)).firestore();
  const intruderDb = testEnv.authenticatedContext(INTRUDER_UID, verifiedToken(INTRUDER_EMAIL)).firestore();

  // Allowed: lowercase email in /users doc matches mixed-case token email, and reading own lowercase staffInvite succeeds
  await assertSucceeds(
    setDoc(doc(mixedDb, `users/${MIXED_UID}`), {
      name: '201203014.Bello',
      email: LOWER_EMAIL,
      role: 'student',
      createdAt: serverTimestamp(),
    })
  );
  await assertSucceeds(getDoc(doc(mixedDb, `staffInvites/${LOWER_EMAIL}`)));

  // Denied: another student cannot read mixed-case staffer's invite, and spoofed email on /users fails
  await assertFails(getDoc(doc(intruderDb, `staffInvites/${LOWER_EMAIL}`)));
  await assertFails(
    setDoc(doc(mixedDb, `users/${MIXED_UID}`), {
      name: '201203014.Bello',
      email: 'someone.else@nileuniversity.edu.ng',
      role: 'student',
      createdAt: serverTimestamp(),
    })
  );
});
