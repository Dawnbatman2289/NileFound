/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * NileFound Campus Notification Service
 * Manages in-app notifications, Admin notifications for ayomide2289@gmail.com,
 * HTML5 browser push alerts, Web Audio chimes, and email dispatch formatting.
 */

import type { CampusNotification } from '../types/index.ts';

export const MASTER_ADMIN_EMAIL = 'ayomide2289@gmail.com';
const LOCAL_NOTIFICATIONS_KEY = 'nilefound_notifications_v1';
const EMAIL_DISPATCH_LOG_KEY = 'nilefound_email_dispatches_v1';

export interface EmailDispatchRecord {
  id: string;
  recipient: string;
  subject: string;
  bodyText: string;
  sentAt: string;
  type: string;
  status: 'sent' | 'drafted';
}

/**
 * Play a short, subtle, pleasant campus notification chime via Web Audio API.
 * No external audio files or bandwidth required.
 */
export function playNotificationChime(): void {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    
    // Smooth double-tone (520Hz then 660Hz)
    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(523.25, now); // C5
    osc1.frequency.exponentialRampToValueAtTime(659.25, now + 0.12); // E5

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(659.25, now);
    osc2.frequency.exponentialRampToValueAtTime(783.99, now + 0.18); // G5

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.08, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now + 0.04);
    osc1.stop(now + 0.28);
    osc2.stop(now + 0.28);
  } catch (err) {
    // AudioContext might be blocked until user gesture, ignore safely
  }
}

/**
 * Request HTML5 Desktop/Mobile Browser Notification Permission
 */
export async function requestBrowserNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    return 'denied';
  }
  if (Notification.permission === 'granted') {
    return 'granted';
  }
  try {
    return await Notification.requestPermission();
  } catch {
    return 'denied';
  }
}

/**
 * Fire an OS/Browser Notification if permission granted
 */
export function sendBrowserPushNotification(title: string, options?: NotificationOptions): void {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return;
  }
  try {
    new Notification(title, {
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      ...options,
    });
  } catch (err) {
    console.debug('Browser push notification could not be shown:', err);
  }
}

/**
 * Compose and launch email dispatch to ayomide2289@gmail.com
 */
export function createAdminEmailDispatch(notification: CampusNotification): EmailDispatchRecord {
  const subject = encodeURIComponent(`[NileFound Alert] ${notification.title}`);
  const formattedBody = `Dear Ayomide (NileFound Administrator),

A new event occurred on NileFound - Nile University Campus Lost & Found:

--------------------------------------------------
EVENT: ${notification.title}
TIME: ${new Date(notification.createdAt).toLocaleString('en-GB', { timeZone: 'Africa/Lagos' })} (WAT)
PRIORITY: NORMAL
DETAILS:
${notification.message}

ITEM: ${notification.itemTitle || notification.itemId || 'Campus item'}
--------------------------------------------------

ACTIONS REQUIRED:
1. Review item in the NileFound Admin Control Center:
   https://ais-dev-l4hiudbt6tanpmxheftbso-935165259220.europe-west2.run.app
2. Check physical custody status (Student Affairs / Main Gate Post).
3. Verify anti-theft claimant responses before releasing property.

--
NileFound Campus Lost & Found
Nile University of Nigeria, Abuja
Contact: Student Affairs / Campus Security`;

  const mailtoUrl = `mailto:${MASTER_ADMIN_EMAIL}?subject=${subject}&body=${encodeURIComponent(formattedBody)}`;
  
  const record: EmailDispatchRecord = {
    id: `email-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    recipient: MASTER_ADMIN_EMAIL,
    subject: `[NileFound Alert] ${notification.title}`,
    bodyText: formattedBody,
    sentAt: new Date().toISOString(),
    type: notification.type,
    status: 'sent',
  };

  // Log dispatch in localStorage
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(EMAIL_DISPATCH_LOG_KEY);
      const existing: EmailDispatchRecord[] = raw ? JSON.parse(raw) : [];
      localStorage.setItem(EMAIL_DISPATCH_LOG_KEY, JSON.stringify([record, ...existing.slice(0, 49)]));
    }
  } catch (e) {
    console.warn('Could not store email dispatch log:', e);
  }

  // Open mail client
  if (typeof window !== 'undefined' && typeof window.open === 'function') {
    window.open(mailtoUrl, '_blank');
  }
  return record;
}

/**
 * Retrieve recent email dispatch records
 */
export function getEmailDispatchHistory(): EmailDispatchRecord[] {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(EMAIL_DISPATCH_LOG_KEY);
      return raw ? JSON.parse(raw) : [];
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * Generate default seed notifications for realistic Nile campus activity
 */
export function getInitialCampusNotifications(): CampusNotification[] {
  return [];
}
