/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Floating Real-Time Campus Notification Toast
 * Displays a concise popup alert when a new report, claim, or match event occurs.
 */

import React, { useEffect, useRef } from 'react';
import { X, ExternalLink } from 'lucide-react';
import { CampusNotification } from '../types/index.ts';
import { formatRelativeTime } from '../utils/dateFormatter.ts';

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
  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    if (!notification) return;
    const timer = window.setTimeout(() => {
      onDismissRef.current();
    }, 7000);
    return () => window.clearTimeout(timer);
  }, [notification?.id]);

  if (!notification) return null;

  return (
    <div className="fixed top-4 left-3 right-3 sm:left-auto sm:right-4 z-50 sm:max-w-sm" role="status" aria-live="polite">
      <div className="bg-white dark:bg-[#1E1C18] text-[#1F1B16] dark:text-[#F5F1EA] rounded-[12px] border border-[#C4BBAF] dark:border-[#3E3931] shadow-lg p-4 flex gap-3 relative overflow-hidden">
        <div className="flex-1 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-sans font-medium px-2 py-0.5 rounded-[10px] border bg-[#E7F3F3] dark:bg-[#0D2D2D] text-[#0F6E6E] dark:text-[#199595] border-[#0F6E6E]/25">
              {notification.type === 'admin_review' ? 'Staff Notice' : 'Campus Update'}
            </span>
            <button
              type="button"
              onClick={onDismiss}
              className="text-[#5C554C] dark:text-[#A8A095] hover:text-[#1F1B16] dark:hover:text-[#F5F1EA] p-2 -mr-1 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-[10px] cursor-pointer"
              aria-label="Dismiss notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <h5 className="font-serif font-bold text-sm text-[#1F1B16] dark:text-[#F5F1EA] leading-snug">
            {notification.title}
          </h5>

          <p className="text-sm text-[#4A443C] dark:text-[#CEC7BB] line-clamp-2 leading-relaxed">
            {notification.message}
          </p>

          <div className="pt-1 flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                onView(notification);
                onDismiss();
              }}
              className="text-sm font-medium text-[#0F6E6E] dark:text-[#199595] hover:underline inline-flex items-center gap-1 min-h-[44px] cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>View details</span>
            </button>
            <span className="text-xs text-[#5C554C] dark:text-[#A8A095]">
              {formatRelativeTime(notification.createdAt) || 'Just now'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
