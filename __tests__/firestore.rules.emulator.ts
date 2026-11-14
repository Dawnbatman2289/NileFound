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

test('notification rules allow valid claim_received/match_alert/item_returned/admin_review and block spoofing', async () => {
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

  // Finder can send valid match_alert backed by sourceItemId + item_returned + admin_review
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
  await assertSucceeds(
    setDoc(doc(finderDb, 'notifications/nAdminOk'), {
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

