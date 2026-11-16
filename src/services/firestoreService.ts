/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Barrel re-export for NileFound Firestore domain modules.
 */

export type {
  UserRoleRecord,
  ItemPrivateDetails,
  ClaimPrivateDetails,
  ItemPage,
  ClaimsCursor,
  ClaimsPage,
  ClaimMessagesPage,
  RolesPage,
  CampusAuditCounts,
} from './firestore/helpers.ts';

export {
  isConfiguredAdmin,
  fetchUserRole,
  assignUserRoleByEmail,
  revokeStaffRole,
  fetchRolesPage,
} from './firestore/roles.ts';

export {
  subscribeToRealtimeItems,
  fetchItemsPage,
  fetchMatchCandidatesFromFirestore,
  fetchItemFullPhoto,
  saveItemToFirestore,
  fetchItemPrivateDetails,
  fetchApprovedHandoverContact,
  updateItemStatusInFirestore,
  confirmItemCustodyInFirestore,
  expireItemsInFirestore,
  fetchCampusAuditCounts,
  deleteItemFromFirestore,
} from './firestore/items.ts';

export {
  fetchClaimPrivateDetails,
  subscribeToRealtimeClaims,
  fetchMoreClaimsPage,
  saveClaimToFirestore,
  resubmitClaimInFirestore,
  updateClaimStatusInFirestore,
} from './firestore/claims.ts';

export { syncUserProfile } from './firestore/profile.ts';

export {
  subscribeToRealtimeNotifications,
  saveNotificationToFirestore,
  markNotificationAsReadInFirestore,
  markNotificationsReadInFirestore,
} from './firestore/notifications.ts';

export {
  subscribeToClaimMessages,
  fetchOlderClaimMessages,
  sendClaimMessageToFirestore,
} from './firestore/chat.ts';
