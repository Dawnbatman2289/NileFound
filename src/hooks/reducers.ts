/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Pure state reducers for auth session, items feed pagination, and claims lifecycle.
 */

import type React from 'react';
import type { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import type { CampusItem, ClaimRecord, DemoPersonaOption, User } from '../types/index.ts';
import type { ClaimsCursor } from '../services/firestore/helpers.ts';

export interface AuthSessionState {
  isSimulating: boolean;
  isDemoMode: boolean;
  devPersonas: DemoPersonaOption[];
  realUser: User | null;
  currentUser: User | null;
  initializing: boolean;
  roleError: string | null;
  authError: string | null;
  logoutNotice: string | null;
  roleRetryNonce: number;
}

export type AuthSessionAction =
  | { type: 'SET_DEV_PERSONAS'; personas: DemoPersonaOption[] }
  | { type: 'SET_REAL_USER'; user: User | null }
  | { type: 'SET_CURRENT_USER'; user: User | null }
  | { type: 'SET_INITIALIZING'; value: boolean }
  | { type: 'SET_ROLE_ERROR'; error: string | null }
  | { type: 'SET_AUTH_ERROR'; error: string | null }
  | { type: 'SET_LOGOUT_NOTICE'; notice: string | null }
  | { type: 'RETRY_ROLE_CHECK' }
  | { type: 'VERIFIED_SIGN_IN'; user: User; roleError: string | null }
  | { type: 'AUTH_SIGNED_OUT'; keepSimulation: boolean; authError?: string | null }
  | { type: 'ENTER_SIMULATION'; user: User }
  | { type: 'EXIT_SIMULATION'; realUser: User | null }
  | { type: 'SET_DEMO_MODE'; enabled: boolean }
  | { type: 'PREPARE_LOGOUT' };

export function authSessionReducer(
  state: AuthSessionState,
  action: AuthSessionAction
): AuthSessionState {
  switch (action.type) {
    case 'SET_DEV_PERSONAS':
      return { ...state, devPersonas: action.personas };
    case 'SET_REAL_USER':
      return { ...state, realUser: action.user };
    case 'SET_CURRENT_USER':
      return { ...state, currentUser: action.user };
    case 'SET_INITIALIZING':
      return { ...state, initializing: action.value };
    case 'SET_ROLE_ERROR':
      return { ...state, roleError: action.error };
    case 'SET_AUTH_ERROR':
      return { ...state, authError: action.error };
    case 'SET_LOGOUT_NOTICE':
      return { ...state, logoutNotice: action.notice };
    case 'RETRY_ROLE_CHECK':
      return { ...state, roleRetryNonce: state.roleRetryNonce + 1 };
    case 'VERIFIED_SIGN_IN':
      return {
        ...state,
        realUser: action.user,
        currentUser: state.isSimulating ? state.currentUser : action.user,
        roleError: action.roleError,
        authError: null,
        initializing: false,
      };
    case 'AUTH_SIGNED_OUT':
      if (action.keepSimulation) {
        return {
          ...state,
          realUser: null,
          roleError: null,
          authError: action.authError !== undefined ? action.authError : state.authError,
          initializing: false,
        };
      }
      return {
        ...state,
        realUser: null,
        currentUser: null,
        roleError: null,
        authError: action.authError !== undefined ? action.authError : state.authError,
        isSimulating: false,
        isDemoMode: false,
        initializing: false,
      };
    case 'ENTER_SIMULATION':
      return {
        ...state,
        isSimulating: true,
        isDemoMode: true,
        authError: null,
        currentUser: action.user,
      };
    case 'EXIT_SIMULATION':
      return {
        ...state,
        isSimulating: false,
        isDemoMode: false,
        currentUser: action.realUser,
      };
    case 'SET_DEMO_MODE':
      return { ...state, isDemoMode: action.enabled };
    case 'PREPARE_LOGOUT':
      return {
        ...state,
        realUser: null,
        currentUser: null,
        roleError: null,
        authError: null,
        isSimulating: false,
        isDemoMode: false,
      };
  }
}

export interface ItemsFeedState {
  items: CampusItem[];
  olderItems: CampusItem[];
  itemsCursor?: QueryDocumentSnapshot<DocumentData>;
  hasMoreItems: boolean;
  isLoadingMoreItems: boolean;
  itemsError: string | null;
  itemsRetryNonce: number;
}

export type ItemsFeedAction =
  | { type: 'RESET_LISTENER' }
  | {
      type: 'LIVE_ITEMS_RECEIVED';
      items: CampusItem[];
      hasMore: boolean;
      cursor?: QueryDocumentSnapshot<DocumentData>;
      preservePagination: boolean;
    }
  | { type: 'START_LOAD_MORE' }
  | {
      type: 'APPEND_OLDER_ITEMS';
      items: CampusItem[];
      hasMore: boolean;
      cursor?: QueryDocumentSnapshot<DocumentData>;
    }
  | { type: 'SET_ERROR'; error: string | null }
  | { type: 'RETRY_ITEMS' }
  | { type: 'SET_ITEMS'; updater: React.SetStateAction<CampusItem[]> }
  | { type: 'SET_OLDER_ITEMS'; updater: React.SetStateAction<CampusItem[]> }
  | { type: 'CLEAR_ITEMS' };

export function itemsFeedReducer(state: ItemsFeedState, action: ItemsFeedAction): ItemsFeedState {
  switch (action.type) {
    case 'RESET_LISTENER':
      return {
        ...state,
        olderItems: [],
        itemsCursor: undefined,
        itemsError: null,
      };
    case 'LIVE_ITEMS_RECEIVED':
      return {
        ...state,
        items: action.items,
        itemsCursor: action.preservePagination ? state.itemsCursor : action.cursor,
        hasMoreItems: action.preservePagination ? state.hasMoreItems : action.hasMore,
        isLoadingMoreItems: false,
        itemsError: null,
      };
    case 'START_LOAD_MORE':
      return { ...state, isLoadingMoreItems: true, itemsError: null };
    case 'APPEND_OLDER_ITEMS': {
      const seen = new Set(state.olderItems.map((it) => it.id));
      const uniqueIncoming = action.items.filter((it) => {
        if (seen.has(it.id)) return false;
        seen.add(it.id);
        return true;
      });
      return {
        ...state,
        olderItems: [...state.olderItems, ...uniqueIncoming],
        itemsCursor: action.cursor,
        hasMoreItems: action.hasMore,
        isLoadingMoreItems: false,
      };
    }
    case 'SET_ERROR':
      return { ...state, isLoadingMoreItems: false, itemsError: action.error };
    case 'RETRY_ITEMS':
      return { ...state, itemsRetryNonce: state.itemsRetryNonce + 1 };
    case 'SET_ITEMS': {
      const next = typeof action.updater === 'function' ? action.updater(state.items) : action.updater;
      return { ...state, items: next };
    }
    case 'SET_OLDER_ITEMS': {
      const next =
        typeof action.updater === 'function' ? action.updater(state.olderItems) : action.updater;
      return { ...state, olderItems: next };
    }
    case 'CLEAR_ITEMS':
      return {
        ...state,
        items: [],
        olderItems: [],
        itemsCursor: undefined,
        hasMoreItems: false,
        isLoadingMoreItems: false,
      };
  }
}

export interface ClaimsState {
  claims: ClaimRecord[];
  olderClaims?: ClaimRecord[];
  claimsCursor?: ClaimsCursor;
  hasMoreClaims: boolean;
  isLoadingMoreClaims: boolean;
  claimsError: string | null;
  claimsRetryNonce: number;
}

export type ClaimsAction =
  | { type: 'RESET_LISTENER' }
  | {
      type: 'LIVE_CLAIMS_RECEIVED';
      claims: ClaimRecord[];
      hasMore: boolean;
      cursor?: ClaimsCursor;
      preservePagination?: boolean;
    }
  | { type: 'START_LOAD_MORE' }
  | {
      type: 'APPEND_CLAIMS_PAGE';
      claims: ClaimRecord[];
      hasMore: boolean;
      cursor?: ClaimsCursor;
    }
  | { type: 'SET_ERROR'; error: string | null }
  | { type: 'RETRY_CLAIMS' }
  | { type: 'SET_CLAIMS'; updater: React.SetStateAction<ClaimRecord[]> }
  | { type: 'CLEAR_CLAIMS' };

export function claimsReducer(state: ClaimsState, action: ClaimsAction): ClaimsState {
  switch (action.type) {
    case 'RESET_LISTENER':
      return { ...state, olderClaims: [], claimsError: null };
    case 'LIVE_CLAIMS_RECEIVED': {
      const prevPrivate = new Map<string, ClaimRecord>();
      for (const c of state.olderClaims ?? []) {
        if (c.privateLoaded) prevPrivate.set(c.id, c);
      }
      for (const c of state.claims) {
        if (c.privateLoaded) prevPrivate.set(c.id, c);
      }
      const mergedLive = action.claims.map((claim) => {
        const prev = prevPrivate.get(claim.id);
        if (!prev) return claim;
        return {
          ...claim,
          claimantName: prev.claimantName,
          claimantEmail: prev.claimantEmail,
          submittedAnswer: prev.submittedAnswer,
          privateLoaded: true,
        };
      });
      const existingOlder = state.olderClaims ?? [];
      if (action.preservePagination && existingOlder.length > 0) {
        const liveIds = new Set(mergedLive.map((c) => c.id));
        const survivingOlder = existingOlder.filter((c) => !liveIds.has(c.id));
        return {
          ...state,
          claims: [...mergedLive, ...survivingOlder],
          olderClaims: existingOlder,
          hasMoreClaims: state.hasMoreClaims,
          claimsCursor: state.claimsCursor,
          claimsError: null,
        };
      }
      return {
        ...state,
        claims: mergedLive,
        olderClaims: [],
        hasMoreClaims: action.hasMore,
        claimsCursor: action.cursor,
        claimsError: null,
      };
    }
    case 'START_LOAD_MORE':
      return { ...state, isLoadingMoreClaims: true, claimsError: null };
    case 'APPEND_CLAIMS_PAGE': {
      const seen = new Set(state.claims.map((c) => c.id));
      const uniqueIncoming = action.claims.filter((c) => {
        if (seen.has(c.id)) return false;
        seen.add(c.id);
        return true;
      });
      return {
        ...state,
        claims: [...state.claims, ...uniqueIncoming],
        olderClaims: [...(state.olderClaims ?? []), ...uniqueIncoming],
        hasMoreClaims: action.hasMore,
        claimsCursor: action.cursor,
        isLoadingMoreClaims: false,
      };
    }
    case 'SET_ERROR':
      return { ...state, isLoadingMoreClaims: false, claimsError: action.error };
    case 'RETRY_CLAIMS':
      return { ...state, claimsRetryNonce: state.claimsRetryNonce + 1 };
    case 'SET_CLAIMS': {
      const next =
        typeof action.updater === 'function' ? action.updater(state.claims) : action.updater;
      const nextById = new Map(next.map((c) => [c.id, c]));
      const nextOlder = (state.olderClaims ?? [])
        .filter((c) => nextById.has(c.id))
        .map((c) => nextById.get(c.id)!);
      return { ...state, claims: next, olderClaims: nextOlder };
    }
    case 'CLEAR_CLAIMS':
      return {
        ...state,
        claims: [],
        olderClaims: [],
        claimsCursor: undefined,
        hasMoreClaims: false,
        isLoadingMoreClaims: false,
      };
  }
}
