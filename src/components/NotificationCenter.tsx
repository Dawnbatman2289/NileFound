/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * NileFound Campus Notification Center & Admin Dispatch Hub
 * Styled in Deep Navy (#0B1020), Soft White (#F4F6FF), and Electric Lime (#C6FF3D).
 * Provides in-app notifications, Admin alerts for ayomide2289@gmail.com,
 * direct email dispatching, and browser push notification permissions.
 */

import React, { useState } from 'react';
import { 
  Bell, 
  Mail, 
  CheckCheck, 
  ShieldAlert, 
  Volume2, 
  ExternalLink, 
  Clock, 
  MapPin, 
  AlertCircle, 
  X, 
  Send,
  Shield,
  Smartphone,
  Check,
  Search
} from 'lucide-react';
import { CampusNotification, User } from '../types/index.ts';
import { 
  MASTER_ADMIN_EMAIL, 
  createAdminEmailDispatch, 
  requestBrowserNotificationPermission,
  playNotificationChime,
  getEmailDispatchHistory,
  EmailDispatchRecord
} from '../services/notificationService.ts';

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: CampusNotification[];
  currentUser: User | null;
  onMarkAllAsRead: () => void;
  onMarkAsRead: (id: string) => void;
  onNavigateToItem?: (itemId?: string) => void;
  onNavigateToAdmin?: () => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  isOpen,
  onClose,
  notifications,
  currentUser,
  onMarkAllAsRead,
  onMarkAsRead,
  onNavigateToItem,
  onNavigateToAdmin,
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'my' | 'admin' | 'email_log'>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [browserPerm, setBrowserPerm] = useState<NotificationPermission>(() => {
    return 'Notification' in window ? Notification.permission : 'denied';
  });
  const [emailStatusMessage, setEmailStatusMessage] = useState<string | null>(null);
  const [emailHistory, setEmailHistory] = useState<EmailDispatchRecord[]>(() => getEmailDispatchHistory());

  const isMasterAdmin = currentUser?.email?.trim().toLowerCase() === MASTER_ADMIN_EMAIL;
  const isAdmin = isMasterAdmin || currentUser?.role === 'admin';

  if (!isOpen) return null;

  const handleEnableBrowserNotifications = async () => {
    const res = await requestBrowserNotificationPermission();
    setBrowserPerm(res);
    if (res === 'granted') {
      playNotificationChime();
    }
  };

  const handleSendEmailDispatch = (notif: CampusNotification) => {
    const record = createAdminEmailDispatch(notif);
    setEmailHistory((prev) => [record, ...prev]);
    setEmailStatusMessage(`Email dispatch prepared for ${MASTER_ADMIN_EMAIL}. Check your email client.`);
    setTimeout(() => setEmailStatusMessage(null), 5000);
  };

  // Filter notifications according to tab
  const filteredNotifications = notifications.filter((n) => {
    if (activeTab === 'admin') return n.type === 'admin_review';
    if (activeTab === 'my') {
      if (!currentUser) return false;
      return (
        n.recipientUid === currentUser.id
      );
    }
    // Tab 'all': show non-admin notifications + admin if currentUser is admin
    if (!isAdmin && n.type === 'admin_review') return false;

    if (filterType !== 'all') {
      if (filterType === 'claim' && !n.type.includes('claim')) return false;
    }
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.read).length;
  const adminAlertsCount = notifications.filter((n) => n.type === 'admin_review' && !n.read).length;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end p-2 sm:p-4 bg-[#0B1020]/80 backdrop-blur-md">
      <div 
        className="w-full max-w-[512px] max-h-[100dvh] bg-[#141B33] text-[#F4F6FF] rounded-[20px] shadow-2xl border border-[#1E294B] flex flex-col overflow-hidden my-auto sm:my-2 min-w-0"
        role="dialog"
        aria-label="Campus Notification Center"
      >
        {/* Header */}
        <div className="bg-[#0B1020] px-5 py-4 border-b border-[#1E294B] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#C6FF3D]/15 text-[#C6FF3D] border border-[#C6FF3D]/30 flex items-center justify-center">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-sm sm:text-base text-[#F4F6FF]">Campus Notifications</h3>
                {unreadCount > 0 && (
                  <span className="bg-[#C6FF3D] text-[#0B1020] text-[10px] font-bold font-mono px-2 py-0.2 rounded-full">
                    {unreadCount} new
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400">
                Real-time alerts for lost & found listings across Nile University
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-[#F4F6FF] p-1.5 rounded-lg hover:bg-[#1E294B] transition-colors cursor-pointer"
            aria-label="Close notifications"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Master Admin Banner for ayomide2289@gmail.com */}
        {isMasterAdmin && (
          <div className="bg-[#C6FF3D]/10 border-b border-[#C6FF3D]/30 px-5 py-2.5 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-[#C6FF3D]" />
              <span className="font-bold text-[#C6FF3D]">Root Admin Desk:</span>
              <span className="text-slate-300 text-[11px] font-mono">{MASTER_ADMIN_EMAIL}</span>
            </div>
            <span className="text-[10px] bg-[#0B1020] text-[#C6FF3D] px-2 py-0.5 rounded-full font-bold">
              Email Dispatch Active
            </span>
          </div>
        )}

        {/* Status feedback */}
        {emailStatusMessage && (
          <div className="bg-emerald-950/60 border-b border-emerald-500/40 text-emerald-300 text-xs px-5 py-2.5 flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{emailStatusMessage}</span>
          </div>
        )}

        {/* Browser Push Permission Bar (if not yet granted) */}
        {browserPerm !== 'granted' && (
          <div className="bg-[#1E294B]/80 px-5 py-2.5 flex items-center justify-between text-xs border-b border-[#2A3B66]">
            <div className="flex items-center gap-2">
              <Smartphone className="w-3.5 h-3.5 text-[#C6FF3D]" />
              <span className="text-slate-300 text-[11px]">Get instant desktop / phone notifications</span>
            </div>
            <button
              onClick={handleEnableBrowserNotifications}
              className="bg-[#C6FF3D] hover:bg-[#b8f52f] text-[#0B1020] text-[11px] font-extrabold px-3 py-1 rounded-full cursor-pointer transition-all"
            >
              Enable Alerts
            </button>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="bg-[#0B1020] px-4 pt-2 border-b border-[#1E294B] flex items-center justify-between gap-2 overflow-x-auto">
          <div className="flex gap-1">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-2 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
                activeTab === 'all'
                  ? 'border-[#C6FF3D] text-[#C6FF3D]'
                  : 'border-transparent text-slate-400 hover:text-[#F4F6FF]'
              }`}
            >
              All Updates ({notifications.filter(n => n.type !== 'admin_review' || isAdmin).length})
            </button>

            {currentUser && (
              <button
                onClick={() => setActiveTab('my')}
                className={`px-3 py-2 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
                  activeTab === 'my'
                    ? 'border-[#C6FF3D] text-[#C6FF3D]'
                    : 'border-transparent text-slate-400 hover:text-[#F4F6FF]'
                }`}
              >
                My Items
              </button>
            )}

            {isAdmin && (
              <button
                onClick={() => setActiveTab('admin')}
                className={`px-3 py-2 text-xs font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'admin'
                    ? 'border-[#C6FF3D] text-[#C6FF3D]'
                    : 'border-transparent text-slate-400 hover:text-[#F4F6FF]'
                }`}
              >
                <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                <span>Admin Alerts</span>
                {adminAlertsCount > 0 && (
                  <span className="bg-amber-400 text-[#0B1020] text-[9px] font-bold px-1.5 py-0.2 rounded-full">
                    {adminAlertsCount}
                  </span>
                )}
              </button>
            )}

            {isMasterAdmin && (
              <button
                onClick={() => setActiveTab('email_log')}
                className={`px-3 py-2 text-xs font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-1 ${
                  activeTab === 'email_log'
                    ? 'border-[#C6FF3D] text-[#C6FF3D]'
                    : 'border-transparent text-slate-400 hover:text-[#F4F6FF]'
                }`}
              >
                <Mail className="w-3.5 h-3.5" />
                <span>Email Log</span>
              </button>
            )}
          </div>

          {activeTab !== 'email_log' && unreadCount > 0 && (
            <button
              onClick={onMarkAllAsRead}
              className="text-[11px] text-[#C6FF3D] hover:underline font-bold flex items-center gap-1 shrink-0 pb-1 cursor-pointer"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Mark all read</span>
            </button>
          )}
        </div>

        {/* Filter sub-bar */}
        {activeTab === 'all' && (
          <div className="px-4 py-2 bg-[#141B33] border-b border-[#1E294B] flex items-center gap-1.5 text-xs">
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mr-1">Filter:</span>
            {['all', 'lost', 'found', 'claim'].map((f) => (
              <button
                key={f}
                onClick={() => setFilterType(f)}
                className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase transition-colors cursor-pointer ${
                  filterType === f
                    ? 'bg-[#C6FF3D] text-[#0B1020]'
                    : 'bg-[#0B1020] text-slate-400 border border-[#1E294B] hover:text-[#F4F6FF]'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        )}

        {/* Notification List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {activeTab === 'email_log' ? (
            /* Email Log View */
            <div className="space-y-3">
              <div className="bg-[#0B1020] border border-[#1E294B] p-3.5 rounded-xl text-xs space-y-1">
                <p className="font-extrabold text-[#C6FF3D] flex items-center gap-1.5">
                  <Mail className="w-4 h-4" /> Admin Email Dispatch Registry
                </p>
                <p className="text-[11px] text-slate-300">
                Formatted university email dispatches prepared for the campus administrator.
                </p>
              </div>

              {emailHistory.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-xs">
                  No email dispatches recorded yet in this session.
                </div>
              ) : (
                emailHistory.map((rec) => (
                  <div key={rec.id} className="bg-[#0B1020] border border-[#1E294B] p-3.5 rounded-xl text-xs space-y-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-[#F4F6FF] truncate">{rec.subject}</span>
                      <span className="text-[10px] font-mono text-slate-400">
                        {new Date(rec.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <pre className="text-[11px] text-slate-300 bg-[#141B33] p-2.5 rounded-lg font-mono whitespace-pre-wrap max-h-36 overflow-y-auto">
                      {rec.bodyText}
                    </pre>
                    <div className="flex justify-end">
                      <button
                        onClick={() => {
                          const mailto = `mailto:${rec.recipient}?subject=${encodeURIComponent(rec.subject)}&body=${encodeURIComponent(rec.bodyText)}`;
                          window.open(mailto, '_blank');
                        }}
                        className="text-[11px] text-[#C6FF3D] hover:underline font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Send className="w-3 h-3" /> Re-open Email
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : filteredNotifications.length === 0 ? (
            /* Empty State */
            <div className="text-center py-14 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-[#0B1020] border border-[#1E294B] flex items-center justify-center mx-auto text-slate-500">
                <Bell className="w-6 h-6 text-[#C6FF3D]/50" />
              </div>
              <div className="space-y-1">
                <p className="font-bold text-sm text-[#F4F6FF]">No notifications right now</p>
                <p className="text-xs text-slate-400 max-w-xs mx-auto">
                  {activeTab === 'my'
                    ? 'You have no active alerts on items you reported or claimed.'
                    : activeTab === 'admin'
                    ? 'All campus admin alerts are cleared.'
                    : 'Whenever an item is reported or claimed, campus updates will appear here.'}
                </p>
              </div>
            </div>
          ) : (
            /* Notification Cards */
            filteredNotifications.map((notif) => {
              const isClaim = notif.type.includes('claim');

              return (
                <div
                  key={notif.id}
                  onClick={() => onMarkAsRead(notif.id)}
                  className={`p-4 rounded-xl border transition-all text-left relative overflow-hidden ${
                    !notif.read
                      ? 'bg-[#1A2342] border-[#C6FF3D]/40 shadow-md'
                      : 'bg-[#0B1020] border-[#1E294B] opacity-85'
                  }`}
                >
                  {/* Left accent bar */}
                  <div
                    className={`absolute left-0 top-0 bottom-0 w-1 ${
                      notif.type === 'admin_review' ? 'bg-amber-400' : isClaim ? 'bg-[#C6FF3D]' : 'bg-blue-400'
                    }`}
                  />

                  <div className="pl-2 space-y-2">
                    {/* Top line with badges and timestamp */}
                    <div className="flex items-center justify-between gap-2 text-[10px]">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {/* Type pill */}
                        <span
                          className={`font-mono font-bold px-2 py-0.5 rounded uppercase ${
                            isClaim
                              ? 'bg-purple-500/15 text-purple-300 border border-purple-500/30'
                              : 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
                          }`}
                        >
                          {isClaim ? 'Claim Alert' : notif.type === 'admin_review' ? 'Admin Alert' : 'Campus Update'}
                        </span>

                        {!notif.read && (
                          <span className="w-2 h-2 rounded-full bg-[#C6FF3D] inline-block animate-pulse" />
                        )}
                      </div>

                      <span className="text-slate-400 font-mono text-[10px] shrink-0">
                        {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    {/* Title & Message */}
                    <div className="space-y-1">
                      <h4 className="font-extrabold text-xs sm:text-sm text-[#F4F6FF] leading-snug">
                        {notif.title}
                      </h4>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        {notif.message}
                      </p>
                    </div>

                    {/* Location & Metadata */}
                    {/* Action Bar */}
                    <div className="pt-2 border-t border-[#1E294B]/80 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {notif.itemId && onNavigateToItem && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onNavigateToItem(notif.itemId);
                              onClose();
                            }}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-[#C6FF3D] hover:underline cursor-pointer"
                          >
                            <ExternalLink className="w-3 h-3" />
                            <span>View in Feed</span>
                          </button>
                        )}

                        {isClaim && onNavigateToAdmin && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onNavigateToAdmin();
                              onClose();
                            }}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-[#C6FF3D] hover:underline cursor-pointer"
                          >
                            <Shield className="w-3 h-3" />
                            <span>Review Claim</span>
                          </button>
                        )}
                      </div>

                      {/* Special Ayomide Email Dispatch trigger */}
                      {isMasterAdmin && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSendEmailDispatch(notif);
                          }}
                          className="inline-flex items-center gap-1 text-[10px] font-bold bg-[#0B1020] hover:bg-[#1E294B] text-slate-200 hover:text-[#C6FF3D] px-2.5 py-1 rounded-full border border-[#1E294B] transition-colors cursor-pointer"
                          title="Generate pre-formatted email dispatch for ayomide2289@gmail.com"
                        >
                          <Mail className="w-3 h-3 text-[#C6FF3D]" />
                          <span>Dispatch Email</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="bg-[#0B1020] px-5 py-3 border-t border-[#1E294B] flex items-center justify-between text-xs text-slate-400">
          <span className="text-[11px]">
            Nile University Campus Lost & Found System
          </span>
          <button
            onClick={onClose}
            className="text-[#C6FF3D] font-bold hover:underline cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
