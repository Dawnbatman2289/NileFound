/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * NileFound Campus Notification Dropdown
 * Lightweight notification list with relative timestamps, unread count, and item links.
 */

import React, { useEffect, useRef } from 'react';
import { Bell, CheckCheck, X } from 'lucide-react';
import { CampusNotification } from '../types/index.ts';
import { formatRelativeTime } from '../utils/dateFormatter.ts';

interface NotificationDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: CampusNotification[];
  onMarkAllAsRead: () => void;
  onMarkAsRead: (id: string) => void;
  onSelectItem?: (itemId?: string, type?: string) => void;
  triggerRef?: React.RefObject<HTMLButtonElement | null>;
}

export const NotificationDropdown: React.FC<NotificationDropdownProps> = ({
  isOpen,
  onClose,
  notifications,
  onMarkAllAsRead,
  onMarkAsRead,
  onSelectItem,
  triggerRef,
}) => {
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (triggerRef?.current && triggerRef.current.contains(target)) {
        return;
      }
      if (dropdownRef.current && !dropdownRef.current.contains(target)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose, triggerRef]);

  if (!isOpen) return null;

  const unreadCount = notifications.filter((n) => !n.read).length;

  const getTypeLabel = (type: CampusNotification['type']) => {
    switch (type) {
      case 'claim_received':
        return 'Claim Filed';
      case 'claim_approved':
        return 'Claim Approved';
      case 'claim_rejected':
        return 'Claim Rejected';
      case 'match_alert':
        return 'Match Found';
      case 'item_returned':
        return 'Returned';
      case 'admin_review':
        return 'Staff Review';
      default:
        return 'Campus Alert';
    }
  };

  const getTypeBadgeStyle = (type: CampusNotification['type']) => {
    switch (type) {
      case 'claim_approved':
      case 'item_returned':
        return 'bg-[#EDF7F1] dark:bg-[#0E2417] text-[#1B5633] dark:text-[#75CE9A] border-[#2F7D4F]/30';
      case 'claim_rejected':
        return 'bg-[#FDF2F2] dark:bg-[#2B0E0E] text-[#9B1C1C] dark:text-[#F87171] border-[#F87171]/40';
      case 'match_alert':
        return 'bg-[#FEF7E9] dark:bg-[#2B210A] text-[#7A5000] dark:text-[#F9CF7C] border-[#E8A317]/40';
      case 'admin_review':
        return 'bg-[#E7F3F3] dark:bg-[#0D2D2D] text-[#0F6E6E] dark:text-[#199595] border-[#0F6E6E]/30';
      default:
        return 'bg-[#FAF6EF] dark:bg-[#1E1C18] text-[#4A443C] dark:text-[#CEC7BB] border-[#C4BBAF] dark:border-[#3E3931]';
    }
  };

  return (
    <div
      ref={dropdownRef}
      className="fixed left-3 right-3 top-16 sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-96 sm:max-w-sm bg-white dark:bg-[#1E1C18] text-[#1F1B16] dark:text-[#F5F1EA] rounded-[12px] shadow-lg border border-[#C4BBAF] dark:border-[#3E3931] z-50 overflow-hidden flex flex-col min-w-0"
      style={{ maxHeight: '70dvh' }}
      role="region"
      aria-label="Campus Notifications"
    >
      <div className="bg-[#FAF6EF] dark:bg-[#141311] px-4 py-3 border-b border-[#C4BBAF] dark:border-[#3E3931] flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="font-serif font-bold text-sm text-[#1F1B16] dark:text-[#F5F1EA]">Notifications</h3>
          {unreadCount > 0 ? (
            <span className="bg-[#E8A317] text-[#1F1B16] text-xs font-bold font-sans px-2 py-0.5 rounded-full">
              {unreadCount} unread
            </span>
          ) : (
            <span className="text-xs text-[#5C554C] dark:text-[#A8A095]">All caught up</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={onMarkAllAsRead}
              className="text-xs text-[#0F6E6E] dark:text-[#199595] hover:underline font-medium flex items-center gap-1 min-h-[44px] px-1 cursor-pointer"
              title="Mark all as read"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Mark all read</span>
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="text-[#5C554C] dark:text-[#A8A095] hover:text-[#1F1B16] dark:hover:text-[#F5F1EA] p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-[10px] cursor-pointer"
            aria-label="Close notifications"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-[#C4BBAF] dark:divide-[#3E3931]">
        {notifications.length === 0 ? (
          <div className="py-12 px-6 text-center space-y-3">
            <div className="w-10 h-10 rounded-full bg-[#FAF6EF] dark:bg-[#141311] border border-[#C4BBAF] dark:border-[#3E3931] flex items-center justify-center mx-auto text-[#0F6E6E] dark:text-[#199595]">
              <Bell className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-bold text-[#1F1B16] dark:text-[#F5F1EA]">Nothing here yet</p>
              <p className="text-sm text-[#4A443C] dark:text-[#CEC7BB] max-w-xs mx-auto leading-relaxed">
                Lost something? Report it. When someone claims your item or a match is found, updates appear here.
              </p>
            </div>
          </div>
        ) : (
          notifications.map((notif) => {
            const isUnread = !notif.read;
            return (
              <button
                key={notif.id}
                type="button"
                onClick={() => {
                  if (isUnread) onMarkAsRead(notif.id);
                  onSelectItem?.(notif.itemId, notif.type);
                  onClose();
                }}
                className={`w-full text-left p-3.5 transition-colors cursor-pointer flex items-start gap-3 hover:bg-[#FAF6EF] dark:hover:bg-[#28241F] ${
                  isUnread ? 'bg-[#FAF6EF]/60 dark:bg-[#141311]/50' : 'bg-transparent'
                }`}
              >
                <div className="pt-1.5 shrink-0">
                  <span
                    className={`block w-2 h-2 rounded-full ${
                      isUnread ? 'bg-[#0F6E6E] dark:bg-[#199595]' : 'bg-transparent'
                    }`}
                  />
                </div>

                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`text-xs font-sans font-bold uppercase px-1.5 py-0.5 rounded-[10px] border ${getTypeBadgeStyle(notif.type)}`}
                    >
                      {getTypeLabel(notif.type)}
                    </span>
                    <span className="text-xs text-[#5C554C] dark:text-[#A8A095] font-sans shrink-0">
                      {formatRelativeTime(notif.createdAt)}
                    </span>
                  </div>

                  <h4
                    className={`text-sm leading-snug truncate ${
                      isUnread ? 'font-bold text-[#1F1B16] dark:text-[#F5F1EA]' : 'font-medium text-[#4A443C] dark:text-[#CEC7BB]'
                    }`}
                  >
                    {notif.title}
                  </h4>

                  <p className="text-sm text-[#5C554C] dark:text-[#A8A095] line-clamp-2 leading-relaxed [overflow-wrap:anywhere]">
                    {notif.message}
                  </p>
                </div>
              </button>
            );
          })
        )}
      </div>

      <div className="bg-[#FAF6EF] dark:bg-[#141311] px-4 py-2 text-center text-xs text-[#5C554C] dark:text-[#A8A095] border-t border-[#C4BBAF] dark:border-[#3E3931]">
        Nile University Campus Lost &amp; Found
      </div>
    </div>
  );
};
