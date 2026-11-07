/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * NileFound Campus Notification Dropdown
 * Minimal, lightweight notification dropdown with relative timestamps,
 * accurate unread badge, "Mark all read" trigger, and item navigation.
 */

import React, { useEffect, useRef } from 'react';
import { 
  Bell, 
  CheckCheck, 
  ShieldCheck, 
  Sparkles, 
  Tag, 
  X,
  AlertCircle
} from 'lucide-react';
import { CampusNotification } from '../types/index.ts';
import { formatRelativeTime } from '../utils/dateFormatter.ts';

interface NotificationDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: CampusNotification[];
  onMarkAllAsRead: () => void;
  onMarkAsRead: (id: string) => void;
  onSelectItem?: (itemId?: string, type?: string) => void;
}

export const NotificationDropdown: React.FC<NotificationDropdownProps> = ({
  isOpen,
  onClose,
  notifications,
  onMarkAllAsRead,
  onMarkAsRead,
  onSelectItem,
}) => {
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside click or Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
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
  }, [isOpen, onClose]);

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
        return 'Admin Review';
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
        return 'bg-[#FDF2F2] dark:bg-[#2B0E0E] text-[#9B1C1C] dark:text-[#F87171] border-[#F87171]/30';
      case 'match_alert':
        return 'bg-[#FEF7E9] dark:bg-[#2B210A] text-[#7A5000] dark:text-[#F9CF7C] border-[#E8A317]/40';
      case 'admin_review':
        return 'bg-[#E7F3F3] dark:bg-[#0D2D2D] text-[#0F6E6E] dark:text-[#199595] border-[#0F6E6E]/30';
      default:
        return 'bg-[#FAF6EF] dark:bg-[#1E1C18] text-[#544E45] dark:text-[#B8B0A2] border-[#E6DFD2] dark:border-[#2E2A24]';
    }
  };

  return (
    <div
      ref={dropdownRef}
      className="fixed left-3 right-3 top-16 sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-96 sm:max-w-sm bg-white dark:bg-[#1E1C18] text-[#1F1B16] dark:text-[#F5F1EA] rounded-[12px] shadow-lg border border-[#E6DFD2] dark:border-[#2E2A24] z-50 overflow-hidden flex flex-col min-w-0"
      style={{ maxHeight: '70dvh' }}
      role="region"
      aria-label="Campus Notifications Dropdown"
    >
      {/* Header */}
      <div className="bg-[#FAF6EF] dark:bg-[#141311] px-4 py-3 border-b border-[#E6DFD2] dark:border-[#2E2A24] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-serif font-bold text-sm text-[#1F1B16] dark:text-[#F5F1EA]">Notifications</h3>
          {unreadCount > 0 ? (
            <span className="bg-[#E8A317] text-[#1F1B16] text-[10px] font-bold font-sans px-2 py-0.5 rounded-full">
              {unreadCount} unread
            </span>
          ) : (
            <span className="text-[11px] text-[#7A7266] dark:text-[#857D71]">All caught up</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={onMarkAllAsRead}
              className="text-[11px] text-[#0F6E6E] dark:text-[#199595] hover:underline font-medium flex items-center gap-1 cursor-pointer"
              title="Mark all as read"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Mark all read</span>
            </button>
          )}
          <button
            onClick={onClose}
            className="text-[#7A7266] hover:text-[#1F1B16] dark:hover:text-[#F5F1EA] p-1 rounded-[6px] cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Notifications List */}
      <div className="flex-1 overflow-y-auto divide-y divide-[#E6DFD2] dark:divide-[#2E2A24]">
        {notifications.length === 0 ? (
          /* Warm empty state */
          <div className="py-12 px-6 text-center space-y-3">
            <div className="w-10 h-10 rounded-full bg-[#FAF6EF] dark:bg-[#141311] border border-[#E6DFD2] dark:border-[#2E2A24] flex items-center justify-center mx-auto text-[#0F6E6E] dark:text-[#199595]">
              <Bell className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-bold text-[#1F1B16] dark:text-[#F5F1EA]">Nothing here yet</p>
              <p className="text-[11px] text-[#544E45] dark:text-[#B8B0A2] max-w-xs mx-auto leading-relaxed">
                Lost something? Report it. When someone claims your item or a match is found, it will appear here.
              </p>
            </div>
          </div>
        ) : (
          notifications.map((notif) => {
            const isUnread = !notif.read;
            return (
              <button
                key={notif.id}
                onClick={() => {
                  if (isUnread) {
                    onMarkAsRead(notif.id);
                  }
                  if (onSelectItem) {
                    onSelectItem(notif.itemId, notif.type);
                  }
                  onClose();
                }}
                className={`w-full text-left p-3.5 transition-colors cursor-pointer flex items-start gap-3 hover:bg-[#FAF6EF] dark:hover:bg-[#28241F] ${
                  isUnread ? 'bg-[#FAF6EF]/60 dark:bg-[#141311]/50' : 'bg-transparent'
                }`}
              >
                {/* Unread indicator dot */}
                <div className="pt-1.5 shrink-0">
                  <span
                    className={`block w-2 h-2 rounded-full ${
                      isUnread ? 'bg-[#0F6E6E] dark:bg-[#199595]' : 'bg-transparent'
                    }`}
                  />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`text-[9px] font-sans font-bold uppercase px-1.5 py-0.5 rounded-[4px] border ${getTypeBadgeStyle(
                        notif.type
                      )}`}
                    >
                      {getTypeLabel(notif.type)}
                    </span>
                    <span className="text-[10px] text-[#7A7266] dark:text-[#857D71] font-sans shrink-0">
                      {formatRelativeTime(notif.createdAt)}
                    </span>
                  </div>

                  <h4
                    className={`text-xs leading-snug truncate ${
                      isUnread ? 'font-bold text-[#1F1B16] dark:text-[#F5F1EA]' : 'font-medium text-[#544E45] dark:text-[#B8B0A2]'
                    }`}
                  >
                    {notif.title}
                  </h4>

                  <p className="text-[11px] text-[#7A7266] dark:text-[#857D71] line-clamp-2 leading-relaxed [overflow-wrap:anywhere]">
                    {notif.message}
                  </p>
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="bg-[#FAF6EF] dark:bg-[#141311] px-4 py-2 text-center text-[10px] text-[#7A7266] dark:text-[#857D71] border-t border-[#E6DFD2] dark:border-[#2E2A24]">
        Nile University Campus Lost & Found System
      </div>
    </div>
  );
};
