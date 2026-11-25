/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Lazy modal portals and live notification toast rendering.
 */

import React, { lazy, Suspense } from 'react';
import { NotificationToast } from '../components/NotificationToast.tsx';
import { useAppContext } from '../providers/AppContext.tsx';

const PrivacyModal = lazy(() => import('../components/PrivacyModal.tsx').then((m) => ({ default: m.PrivacyModal })));
const ReportModal = lazy(() => import('../components/ReportModal.tsx').then((m) => ({ default: m.ReportModal })));
const ClaimModal = lazy(() => import('../components/ClaimModal.tsx').then((m) => ({ default: m.ClaimModal })));
const ClaimChatModal = lazy(() => import('../components/ClaimChatModal.tsx').then((m) => ({ default: m.ClaimChatModal })));

export const AppModals: React.FC = () => {
  const {
    setActiveTab,
    isReportModalOpen,
    reportPrefill,
    closeReportModal,
    markDraftSaved,
    markDraftCleared,
    isPrivacyModalOpen,
    setIsPrivacyModalOpen,
    selectedItemForClaim,
    setSelectedItemForClaim,
    activeChatTarget,
    closeChatModal,
    authSession,
    notifState,
    itemsFeed,
    claimsState,
    handleChatMessageSent,
    handleSelectNotificationItem,
  } = useAppContext();

  return (
    <>
      {isReportModalOpen && (
        <Suspense fallback={null}>
          <ReportModal
            isOpen={isReportModalOpen}
            onClose={closeReportModal}
            onSubmitItem={itemsFeed.handleAddItem}
            onDraftSaved={markDraftSaved}
            onDraftCleared={markDraftCleared}
            currentUser={authSession.currentUser}
            initialPrefill={reportPrefill}
            onOpenLogin={() => {
              closeReportModal();
              setActiveTab('login');
            }}
          />
        </Suspense>
      )}

      {selectedItemForClaim && (
        <Suspense fallback={null}>
          <ClaimModal
            item={selectedItemForClaim}
            currentUser={authSession.currentUser}
            existingClaim={claimsState.claims.find(
              (c) => c.itemId === selectedItemForClaim.id && c.claimantId === authSession.currentUser?.id
            )}
            onClose={() => setSelectedItemForClaim(null)}
            onSuccessClaim={claimsState.handleClaimSuccess}
            onResubmitClaim={claimsState.handleResubmitClaim}
          />
        </Suspense>
      )}

      {activeChatTarget && (
        <Suspense fallback={null}>
          <ClaimChatModal
            claim={claimsState.claims.find((c) => c.id === activeChatTarget.claim.id) || activeChatTarget.claim}
            item={itemsFeed.mergedItems.find((i) => i.id === activeChatTarget.claim.itemId) || activeChatTarget.item}
            currentUser={authSession.currentUser}
            isDemoMode={authSession.isDemoMode}
            onMessageSent={handleChatMessageSent}
            onClose={closeChatModal}
          />
        </Suspense>
      )}

      <NotificationToast
        notification={notifState.activeToast}
        onDismiss={notifState.dismissToast}
        onView={(notif) => {
          if (notif.type === 'chat_message' && notif.claimId) {
            handleSelectNotificationItem(notif.itemId, notif.type, notif.claimId);
            return;
          }
          if (notif.linkTab === 'admin' && authSession.isPrivileged) {
            setActiveTab('admin');
            return;
          }
          handleSelectNotificationItem(notif.itemId, notif.type, notif.claimId);
        }}
      />

      {isPrivacyModalOpen && (
        <Suspense fallback={null}>
          <PrivacyModal isOpen={isPrivacyModalOpen} onClose={() => setIsPrivacyModalOpen(false)} />
        </Suspense>
      )}
    </>
  );
};
