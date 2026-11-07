/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Floating Real-Time Campus Notification Toast
 * Displays a non-intrusive popup alert when a new item is reported lost or found,
 * or when an admin event occurs.
 */

import React, { useEffect } from 'react';
import { Bell, X, ExternalLink, ShieldAlert, Sparkles, MapPin } from 'lucide-react';
import { CampusNotification } from '../types/index.ts';

interface NotificationToastProps {
  notification: CampusNotification | null;
  onDismiss: () => void;
  onView: (notification: CampusNotification) => void;
}

export const NotificationToast: React.FC<NotificationToastProps> = ({
  notification,
  onDismiss,
  onView,
}) => {
  useEffect(() => {
    if (!notification) return;
    const timer = setTimeout(() => {
      onDismiss();
    }, 7000);
    return () => clearTimeout(timer);
  }, [notification, onDismiss]);

  if (!notification) return null;

  const isLost = notification.itemType === 'lost' || notification.type === 'item_reported_lost';
  const isFound = notification.itemType === 'found' || notification.type === 'item_reported_found';
  const isUrgent = notification.priority === 'urgent' || notification.priority === 'high';

  return (
    <div className="fixed top-4 right-4 z-50 max-w-sm w-full">
      <div className="bg-white dark:bg-[#1E1C18] text-[#1F1B16] dark:text-[#F5F1EA] rounded-[12px] border border-[#E6DFD2] dark:border-[#2E2A24] shadow-lg p-4 flex gap-3 relative overflow-hidden">
        <div className="flex-1 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span
              className={`text-[10px] font-sans font-medium px-2 py-0.5 rounded-[4px] border ${
                isLost
                  ? 'bg-[#FEF7E9] dark:bg-[#2B210A] text-[#7A5000] dark:text-[#F9CF7C] border-[#E8A317]/30'
                  : isFound
                  ? 'bg-[#EDF7F1] dark:bg-[#0E2417] text-[#1B5633] dark:text-[#75CE9A] border-[#2F7D4F]/30'
                  : 'bg-[#E7F3F3] dark:bg-[#0D2D2D] text-[#0F6E6E] dark:text-[#199595] border-[#0F6E6E]/20'
              }`}
            >
              {notification.forAdminOnly ? 'Admin Notice' : isLost ? 'Lost Notice' : isFound ? 'Found Notice' : 'Campus Update'}
            </span>
            <button
              onClick={onDismiss}
              className="text-[#7A7266] hover:text-[#1F1B16] dark:hover:text-[#F5F1EA] p-1 rounded-[6px] cursor-pointer"
              aria-label="Dismiss toast"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <h5 className="font-serif font-bold text-xs text-[#1F1B16] dark:text-[#F5F1EA] leading-snug">
            {notification.title}
          </h5>

          <p className="text-[11px] text-[#544E45] dark:text-[#B8B0A2] line-clamp-2 leading-relaxed">
            {notification.message}
          </p>

          {notification.location && (
            <div className="flex items-center gap-1 text-[10px] text-[#7A7266] dark:text-[#857D71]">
              <MapPin className="w-3 h-3 text-[#0F6E6E] dark:text-[#199595]" />
              <span className="truncate">{notification.location}</span>
            </div>
          )}

          <div className="pt-1 flex items-center justify-between">
            <button
              onClick={() => {
                onView(notification);
                onDismiss();
              }}
              className="text-[11px] font-medium text-[#0F6E6E] dark:text-[#199595] hover:underline inline-flex items-center gap-1 cursor-pointer"
            >
              <ExternalLink className="w-3 h-3" />
              <span>View details</span>
            </button>
            <span className="text-[10px] text-[#7A7266] dark:text-[#857D71]">Just now</span>
          </div>
        </div>
      </div>
    </div>
  );
};
