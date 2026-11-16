import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  authSessionReducer,
  claimsReducer,
  itemsFeedReducer,
  type AuthSessionState,
  type ClaimsState,
  type ItemsFeedState,
} from '../src/hooks/reducers.ts';
import type { CampusItem, ClaimRecord, User } from '../src/types/index.ts';

const sampleUser: User = {
  id: 'stu-1',
  name: 'Chidera',
  email: 'chidera@nileuniversity.edu.ng',
  role: 'student',
  isAdmin: false,
  department: 'Computer Science',
};

const sampleItem = (id: string): CampusItem => ({
  id,
  type: 'found',
  title: `Item ${id}`,
  category: 'calculator',
  description: 'Found near library',
  location: 'Central Library',
  dateLostOrFound: '2026-11-16',
  status: 'open',
  holdingLocation: 'library_desk',
  reportedByEmailDomain: 'nileuniversity.edu.ng',
  createdAt: '2026-11-16T08:00:00.000Z',
});

const sampleClaim = (id: string, privateLoaded = false): ClaimRecord => ({
  id,
  itemId: 'item-1',
  itemTitle: 'Casio Calculator',
  claimantName: privateLoaded ? 'Aisha' : 'Verified Student',
  claimantEmail: privateLoaded ? 'aisha@nileuniversity.edu.ng' : '',
  submittedAnswer: privateLoaded ? 'Red sticker' : '',
  privateLoaded,
  status: 'pending',
  createdAt: '2026-11-16T08:30:00.000Z',
});

test('authSessionReducer handles verified sign-in, rejection error, simulation toggle, and logout atomically', () => {
  const initial: AuthSessionState = {
    isSimulating: false,
    isDemoMode: false,
    devPersonas: [],
    realUser: null,
    currentUser: null,
    initializing: true,
    roleError: 'previous error',
    authError: null,
    logoutNotice: null,
    roleRetryNonce: 0,
  };

  const rejected = authSessionReducer(initial, {
    type: 'AUTH_SIGNED_OUT',
    keepSimulation: false,
    authError: 'Access restricted. Sign in with your @nileuniversity.edu.ng email address.',
  });
  assert.equal(rejected.initializing, false);
  assert.equal(rejected.currentUser, null);
  assert.equal(rejected.authError, 'Access restricted. Sign in with your @nileuniversity.edu.ng email address.');

  const signedIn = authSessionReducer(rejected, {
    type: 'VERIFIED_SIGN_IN',
    user: sampleUser,
    roleError: null,
  });
  assert.equal(signedIn.initializing, false);
  assert.equal(signedIn.currentUser?.id, 'stu-1');
  assert.equal(signedIn.roleError, null);
  assert.equal(signedIn.authError, null);

  const demoUser: User = { ...sampleUser, id: 'demo-security', role: 'security' };
  const simulating = authSessionReducer(signedIn, { type: 'ENTER_SIMULATION', user: demoUser });
  assert.equal(simulating.isSimulating, true);
  assert.equal(simulating.isDemoMode, true);
  assert.equal(simulating.currentUser?.id, 'demo-security');

  const exited = authSessionReducer(simulating, { type: 'EXIT_SIMULATION', realUser: sampleUser });
  assert.equal(exited.isSimulating, false);
  assert.equal(exited.currentUser?.id, 'stu-1');

  const loggedOut = authSessionReducer(exited, { type: 'PREPARE_LOGOUT' });
  assert.equal(loggedOut.currentUser, null);
  assert.equal(loggedOut.realUser, null);
});

test('itemsFeedReducer deduplicates older paginated pages and preserves pagination on live updates', () => {
  const initial: ItemsFeedState = {
    items: [],
    olderItems: [],
    hasMoreItems: false,
    isLoadingMoreItems: false,
    itemsError: null,
    itemsRetryNonce: 0,
  };

  const live = itemsFeedReducer(initial, {
    type: 'LIVE_ITEMS_RECEIVED',
    items: [sampleItem('item-1')],
    hasMore: true,
    preservePagination: false,
  });
  assert.equal(live.hasMoreItems, true);

  const loading = itemsFeedReducer(live, { type: 'START_LOAD_MORE' });
  assert.equal(loading.isLoadingMoreItems, true);

  const appended = itemsFeedReducer(loading, {
    type: 'APPEND_OLDER_ITEMS',
    items: [sampleItem('item-2'), sampleItem('item-2')],
    hasMore: false,
  });
  assert.equal(appended.olderItems.length, 1);
  assert.equal(appended.isLoadingMoreItems, false);
  assert.equal(appended.hasMoreItems, false);
});

test('claimsReducer preserves previously loaded private claim fields across live updates', () => {
  const initial: ClaimsState = {
    claims: [sampleClaim('c-1', true)],
    hasMoreClaims: false,
    isLoadingMoreClaims: false,
    claimsError: 'timeout',
    claimsRetryNonce: 0,
  };

  const next = claimsReducer(initial, {
    type: 'LIVE_CLAIMS_RECEIVED',
    claims: [sampleClaim('c-1', false), sampleClaim('c-2', false)],
    hasMore: true,
  });

  assert.equal(next.claimsError, null);
  assert.equal(next.hasMoreClaims, true);
  assert.equal(next.claims[0].privateLoaded, true);
  assert.equal(next.claims[0].submittedAnswer, 'Red sticker');
  assert.equal(next.claims[1].privateLoaded, false);
});
