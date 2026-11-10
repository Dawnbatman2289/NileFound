/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Floating Real-Time Campus Notification Toast
 * Displays a non-intrusive popup alert when a new item is reported lost or found,
 * or when an admin event occurs.
 */

import React, { useEffect } from 'react';
import { X, ExternalLink } from 'lucide-react';
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

  return (
    <div className="fixed top-4 left-3 right-3 sm:left-auto sm:right-4 z-50 sm:max-w-sm">
      <div className="bg-white dark:bg-[#1E1C18] text-[#1F1B16] dark:text-[#F5F1EA] rounded-[12px] border border-[#E6DFD2] dark:border-[#2E2A24] shadow-lg p-4 flex gap-3 relative overflow-hidden">
        <div className="flex-1 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span
              className="text-xs font-sans font-medium px-2 py-0.5 rounded-[10px] border bg-[#E7F3F3] dark:bg-[#0D2D2D] text-[#0F6E6E] dark:text-[#199595] border-[#0F6E6E]/20"
            >
              {notification.type === 'admin_review' ? 'Admin Notice' : 'Campus Update'}
            </span>
            <button
              onClick={onDismiss}
              className="text-[#7A7266] hover:text-[#1F1B16] dark:hover:text-[#F5F1EA] p-1 rounded-[10px] cursor-pointer"
              aria-label="Dismiss toast"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <h5 className="font-serif font-bold text-xs text-[#1F1B16] dark:text-[#F5F1EA] leading-snug">
            {notification.title}
          </h5>

          <p className="text-xs text-[#544E45] dark:text-[#B8B0A2] line-clamp-2 leading-relaxed">
            {notification.message}
          </p>

          <div className="pt-1 flex items-center justify-between">
            <button
              onClick={() => {
                onView(notification);
                onDismiss();
              }}
              className="text-xs font-medium text-[#0F6E6E] dark:text-[#199595] hover:underline inline-flex items-center gap-1 cursor-pointer"
            >
              <ExternalLink className="w-3 h-3" />
              <span>View details</span>
            </button>
            <span className="text-xs text-[#7A7266] dark:text-[#857D71]">Just now</span>
          </div>
        </div>
      </div>
    </div>
  );
};
