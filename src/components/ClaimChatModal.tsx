/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * NileFound Claim Handover Chat Modal
 * Layout: Accessible real-time thread scoped to one claim (finder, claimant, and authorized staff).
 * Main Action: Coordinate campus item verification or handover time and desk location.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { X, Send, MessageSquare, Lock, AlertTriangle } from 'lucide-react';
import { CampusItem, ClaimMessage, ClaimRecord, User } from '../types/index.ts';
import { detectPii } from '../utils/piiDetector.ts';
import { shouldCloseBackdropClick, trapFocusOnTab } from '../utils/modalFocus.ts';
import { reportError } from './ErrorBoundary.tsx';
import {
  isClaimChatWritable,
  MAX_CHAT_MESSAGE_LENGTH,
  QUICK_HANDOVER_PROMPTS,
  resolveChatSenderRole,
  validateChatMessageInput,
} from '../utils/chat.ts';
import {
  fetchOlderClaimMessages,
  sendClaimMessageToFirestore,
  subscribeToClaimMessages,
} from '../services/firestoreService.ts';

interface ClaimChatModalProps {
  claim: ClaimRecord | null;
  item?: CampusItem;
  currentUser: User | null;
  isDemoMode?: boolean;
  onMessageSent?: (claim: ClaimRecord, item?: CampusItem) => void;
  onClose: () => void;
}

const demoMessageThreads = new Map<string, ClaimMessage[]>();

export function resetDemoChatThreads() {
  demoMessageThreads.clear();
}

export const ClaimChatModal: React.FC<ClaimChatModalProps> = ({
  claim,
  item,
  currentUser,
  isDemoMode = false,
  onMessageSent,
  onClose,
}) => {
  const [latestMessages, setLatestMessages] = useState<ClaimMessage[]>([]);
  const [olderMessages, setOlderMessages] = useState<ClaimMessage[]>([]);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [olderCursor, setOlderCursor] = useState<QueryDocumentSnapshot<DocumentData> | undefined>(undefined);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [draftText, setDraftText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  const dialogRef = useRef<HTMLDivElement>(null);
  const threadEndRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const pointerDownOnBackdropRef = useRef(false);
  const onCloseRef = useRef(onClose);
  const lastLatestIdRef = useRef<string | null>(null);
  const hasLoadedEarlierRef = useRef(false);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const claimId = claim?.id ?? null;
  const currentUserId = currentUser?.id ?? null;

  useEffect(() => {
    if (!claimId) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const focusTimer = window.setTimeout(() => dialogRef.current?.focus(), 0);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      trapFocusOnTab(e, dialogRef.current);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', onKeyDown);
      previousFocusRef.current?.focus?.();
    };
  }, [claimId]);

  useEffect(() => {
    if (!claimId || !currentUserId) return;
    setChatError(null);
    setOlderMessages([]);
    setOlderCursor(undefined);
    setHasMoreMessages(false);
    hasLoadedEarlierRef.current = false;
    lastLatestIdRef.current = null;

    if (import.meta.env?.DEV && isDemoMode) {
      const existing = demoMessageThreads.get(claimId);
      if (existing) {
        setLatestMessages(existing);
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      let cancelled = false;
      import('../data/mockItems.ts')
        .then((m) => {
          if (cancelled) return;
          const seeded = m.DEMO_CHAT_MESSAGES[claimId] || [];
          demoMessageThreads.set(claimId, seeded);
          setLatestMessages(seeded);
          setIsLoading(false);
        })
        .catch((err) => {
          reportError('Load demo chat messages failed', err);
          if (!cancelled) {
            setLatestMessages([]);
            setIsLoading(false);
          }
        });
      return () => { cancelled = true; };
    }

    setIsLoading(true);
    const unsub = subscribeToClaimMessages(
      claimId,
      (nextMessages, hasMore, nextCursor) => {
        setLatestMessages(nextMessages);
        if (!hasLoadedEarlierRef.current) {
          setHasMoreMessages(hasMore);
          setOlderCursor(nextCursor);
        }
        setIsLoading(false);
      },
      (err) => {
        reportError('subscribeToClaimMessages failed', err);
        setIsLoading(false);
        setChatError(err.message || 'Could not connect to handover chat. Check your network and try again.');
      }
    );
    return () => unsub();
  }, [claimId, currentUserId, isDemoMode]);

  const messages = useMemo(() => {
    if (olderMessages.length === 0) return latestMessages;
    const latestIds = new Set(latestMessages.map((m) => m.id));
    return [...olderMessages.filter((m) => !latestIds.has(m.id)), ...latestMessages];
  }, [olderMessages, latestMessages]);

  useEffect(() => {
    const newestId = latestMessages.at(-1)?.id ?? null;
    if (newestId && newestId !== lastLatestIdRef.current) {
      lastLatestIdRef.current = newestId;
      threadEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [latestMessages]);

  const handleLoadEarlier = async () => {
    if (!claimId || !olderCursor || isLoadingOlder || isDemoMode) return;
    setIsLoadingOlder(true);
    setChatError(null);
    try {
      const page = await fetchOlderClaimMessages(claimId, olderCursor);
      hasLoadedEarlierRef.current = true;
      setOlderMessages((prev) => {
        const seen = new Set(prev.map((m) => m.id));
        return [...page.messages.filter((m) => !seen.has(m.id)), ...prev];
      });
      setHasMoreMessages(page.hasMore);
      setOlderCursor(page.nextCursor);
    } catch (err) {
      reportError('fetchOlderClaimMessages failed', err);
      setChatError('Could not load earlier messages. Check your connection and try again.');
    } finally {
      setIsLoadingOlder(false);
    }
  };

  const piiWarning = useMemo(() => {
    if (!draftText.trim() || claim?.status === 'approved') return null;
    const check = detectPii(draftText);
    return check.hasPii ? check.errorMessage || 'Avoid sharing phone, email, or matric details before approval.' : null;
  }, [draftText, claim?.status]);

  if (!claim || !currentUser) return null;

  const senderRole = resolveChatSenderRole(claim, currentUser);
  const canWrite = isClaimChatWritable(claim.status, item?.status);
  const promptSet = senderRole === 'Finder'
    ? QUICK_HANDOVER_PROMPTS.Finder
    : senderRole === 'Claimant'
      ? QUICK_HANDOVER_PROMPTS.Claimant
      : QUICK_HANDOVER_PROMPTS.Staff;

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!canWrite || isSending) return;
    const validation = validateChatMessageInput(draftText);
    if (!validation.valid) {
      setChatError(validation.error || 'Message is invalid.');
      return;
    }

    setIsSending(true);
    setChatError(null);
    try {
      if (isDemoMode) {
        const nextMsg: ClaimMessage = {
          id: `demo-msg-${Date.now()}`,
          claimId: claim.id,
          senderId: currentUser.id,
          senderRole,
          text: validation.trimmed,
          createdAt: new Date().toISOString(),
        };
        const updated = [...(demoMessageThreads.get(claim.id) || []), nextMsg];
        demoMessageThreads.set(claim.id, updated);
        setLatestMessages(updated);
      } else {
        await sendClaimMessageToFirestore(claim.id, validation.trimmed, senderRole);
      }
      setDraftText('');
      onMessageSent?.(claim, item);
    } catch (err: unknown) {
      reportError('sendClaimMessage failed', err);
      setChatError(err instanceof Error ? err.message : 'Message failed to send. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/55 overflow-y-auto modal-backdrop-enter"
      onPointerDown={(e) => {
        pointerDownOnBackdropRef.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        const shouldClose = shouldCloseBackdropClick(e, pointerDownOnBackdropRef.current);
        pointerDownOnBackdropRef.current = false;
        if (shouldClose) onCloseRef.current();
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="claim-chat-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[520px] bg-white dark:bg-[#1E1C18] text-[#1F1B16] dark:text-[#F5F1EA] rounded-[12px] shadow-xl max-h-[90dvh] h-[min(600px,90dvh)] overflow-hidden border border-[#C4BBAF] dark:border-[#3E3931] flex flex-col min-w-0 outline-none modal-panel-enter"
      >
        <div className="bg-[#FAF6EF] dark:bg-[#141311] px-5 py-4 border-b border-[#C4BBAF] dark:border-[#3E3931] flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-[#0F6E6E] dark:text-[#199595] shrink-0" />
              <h3 id="claim-chat-title" className="font-serif font-bold text-base truncate">
                Handover Chat
              </h3>
              <span className="text-xs font-medium px-2 py-0.5 rounded-[10px] bg-[#E7F3F3] dark:bg-[#0D2D2D] text-[#0F6E6E] dark:text-[#199595] border border-[#0F6E6E]/25 capitalize">
                {claim.status}
              </span>
            </div>
            <p className="text-xs text-[#5C554C] dark:text-[#A8A095] truncate mt-0.5">
              {item?.category === 'student_id' && item.type === 'found' ? 'Found Student ID Card' : claim.itemTitle} • Posting as {senderRole}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onCloseRef.current()}
            className="text-[#5C554C] dark:text-[#A8A095] hover:text-[#1F1B16] dark:hover:text-[#F5F1EA] p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-[10px] cursor-pointer"
            aria-label="Close handover chat"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-4 py-2.5 bg-[#FAF6EF]/60 dark:bg-[#141311]/60 border-b border-[#C4BBAF] dark:border-[#3E3931] text-xs text-[#4A443C] dark:text-[#CEC7BB] flex items-center gap-2">
          <Lock className="w-3.5 h-3.5 text-[#0F6E6E] dark:text-[#199595] shrink-0" />
          <span>Visible only to the claimant, finder, and authorised campus desk staff.</span>
        </div>

        <div
          className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3 bg-[#FAF6EF]/35 dark:bg-[#141311]/35"
          aria-live="polite"
        >
          {hasMoreMessages && !isDemoMode && (
            <div className="flex justify-center pb-1">
              <button
                type="button"
                onClick={handleLoadEarlier}
                disabled={isLoadingOlder}
                className="min-h-[44px] px-4 py-2 rounded-[10px] border border-[#857C70] dark:border-[#787065] bg-white dark:bg-[#1E1C18] hover:bg-[#FAF6EF] dark:hover:bg-[#28241F] text-xs font-medium text-[#1F1B16] dark:text-[#F5F1EA] disabled:opacity-60 cursor-pointer"
              >
                {isLoadingOlder ? 'Loading earlier messages…' : 'Load earlier messages'}
              </button>
            </div>
          )}

          {isLoading ? (
            <div className="space-y-2.5 animate-pulse">
              <div className="h-12 w-3/4 rounded-[10px] bg-[#EDE7DC] dark:bg-[#28241F]" />
              <div className="h-12 w-2/3 ml-auto rounded-[10px] bg-[#E7F3F3] dark:bg-[#0D2D2D]" />
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-8 px-4 space-y-1.5">
              <p className="font-serif font-bold text-sm text-[#1F1B16] dark:text-[#F5F1EA]">
                No messages yet
              </p>
              <p className="text-xs text-[#5C554C] dark:text-[#A8A095] max-w-xs mx-auto leading-relaxed">
                Use a quick prompt below or type a note to agree on a safe campus desk and time for handover.
              </p>
            </div>
          ) : (
            messages.map((msg) => {
              const isMine = msg.senderId === currentUser.id;
              const timeLabel = new Date(msg.createdAt).toLocaleTimeString('en-GB', {
                hour: '2-digit',
                minute: '2-digit',
              });
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-[10px] px-3.5 py-2.5 text-sm leading-relaxed border ${
                      isMine
                        ? 'bg-[#0F6E6E] text-white border-[#0F6E6E]'
                        : 'bg-white dark:bg-[#1E1C18] text-[#1F1B16] dark:text-[#F5F1EA] border-[#C4BBAF] dark:border-[#3E3931]'
                    }`}
                  >
                    <div className={`text-xs font-semibold mb-0.5 ${isMine ? 'text-white/90' : 'text-[#0F6E6E] dark:text-[#199595]'}`}>
                      {isMine ? 'You' : msg.senderRole} • {timeLabel}
                    </div>
                    <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={threadEndRef} />
        </div>

        {chatError && (
          <div role="alert" className="mx-4 my-2 bg-[#FDF2F2] dark:bg-[#2B0E0E] border border-[#F87171]/50 text-[#9B1C1C] dark:text-[#F87171] px-3 py-2 rounded-[10px] text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{chatError}</span>
          </div>
        )}

        {piiWarning && (
          <div role="status" className="mx-4 mb-2 bg-[#FEF7E9] dark:bg-[#2B210A] border border-[#E8A317]/40 text-[#7A5000] dark:text-[#F9CF7C] px-3 py-2 rounded-[10px] text-xs">
            Reminder: {piiWarning} Meet at Main Gate Security or Student Affairs.
          </div>
        )}

        {canWrite ? (
          <div className="p-3.5 sm:p-4 border-t border-[#C4BBAF] dark:border-[#3E3931] bg-white dark:bg-[#1E1C18] space-y-2.5">
            <div className="flex gap-1.5 overflow-x-auto pb-0.5">
              {promptSet.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => setDraftText(prompt)}
                  className="shrink-0 text-xs font-medium px-2.5 py-1.5 min-h-[36px] rounded-[10px] border border-[#C4BBAF] dark:border-[#3E3931] bg-[#FAF6EF] dark:bg-[#141311] text-[#4A443C] dark:text-[#CEC7BB] hover:border-[#0F6E6E] hover:text-[#0F6E6E] dark:hover:text-[#199595] transition-colors cursor-pointer"
                >
                  {prompt}
                </button>
              ))}
            </div>
            <form onSubmit={handleSend} className="flex items-end gap-2">
              <div className="flex-1 min-w-0">
                <label htmlFor="claim-chat-input" className="sr-only">Message</label>
                <textarea
                  id="claim-chat-input"
                  rows={2}
                  maxLength={MAX_CHAT_MESSAGE_LENGTH}
                  value={draftText}
                  onChange={(e) => {
                    setDraftText(e.target.value);
                    if (chatError) setChatError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Write a short handover message..."
                  className="w-full text-base sm:text-sm px-3.5 py-2.5 rounded-[10px] border border-[#857C70] dark:border-[#787065] bg-white dark:bg-[#141311] text-[#1F1B16] dark:text-[#F5F1EA] placeholder:text-[#5C554C] dark:placeholder:text-[#A8A095] min-h-[44px] resize-none"
                />
              </div>
              <button
                type="submit"
                disabled={isSending || !draftText.trim()}
                className="min-h-[44px] min-w-[44px] px-4 rounded-[10px] bg-[#0F6E6E] hover:bg-[#0C5656] disabled:opacity-50 text-white text-sm font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer btn-campus shrink-0"
                aria-label="Send message"
              >
                <Send className="w-4 h-4" />
                <span className="hidden sm:inline">{isSending ? 'Sending…' : 'Send'}</span>
              </button>
            </form>
          </div>
        ) : (
          <div className="p-3.5 border-t border-[#C4BBAF] dark:border-[#3E3931] bg-[#FAF6EF] dark:bg-[#141311] text-center text-xs text-[#5C554C] dark:text-[#A8A095]">
            This handover chat is read-only because the claim or item is closed.
          </div>
        )}
      </div>
    </div>
  );
};
