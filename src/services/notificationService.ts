/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Campus Notification & Push Helper Service for NileFound
 */

import { CampusNotification } from '../types/index.ts';

export const PROJECT_OWNER_CONTACT = 'owner@example.com';

const EMAIL_LOG_KEY = 'nilefound_email_dispatch_log';
const APP_ICON = '/icons/icon-192.png';

export interface EmailDispatchRecord {
  id: string;
  recipient: string;
  subject: string;
  bodyText: string;
  timestamp: string;
  notificationId: string;
}

let sharedAudioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return null;
  if (!sharedAudioContext || sharedAudioContext.state === 'closed') {
    sharedAudioContext = new AudioCtx();
  }
  return sharedAudioContext;
}

export function playNotificationChime() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;
    const playNote = (freq: number, startOffset: number, duration: number, peakGain = 0.08) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + startOffset);
      gain.gain.setValueAtTime(0.001, now + startOffset);
      gain.gain.exponentialRampToValueAtTime(peakGain, now + startOffset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + startOffset + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + startOffset);
      osc.stop(now + startOffset + duration + 0.02);
    };

    playNote(880, 0, 0.25, 0.08);
    playNote(1318.5, 0.1, 0.35, 0.09);
  } catch {
    // Audio playback blocked or unavailable.
  }
}

export function sendBrowserPushNotification(title: string, options?: NotificationOptions) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  const payload: NotificationOptions = {
    icon: APP_ICON,
    badge: APP_ICON,
    ...options,
  };

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then((reg) => {
        if (reg && typeof reg.showNotification === 'function') {
          return reg.showNotification(title, payload);
        }
        new Notification(title, payload);
      })
      .catch(() => {
        try {
          new Notification(title, payload);
        } catch {
          // Ignore environments where window.Notification constructor throws (e.g., Android Chrome)
        }
      });
    return;
  }

  try {
    new Notification(title, payload);
  } catch {
    // Safe fallback if notifications are disabled
  }
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }
  try {
    return await Notification.requestPermission();
  } catch {
    return 'denied';
  }
}

export function createAdminEmailDispatch(notification: CampusNotification): EmailDispatchRecord {
  const subject = `[NileFound Alert] ${notification.title}`;
  const bodyLines = [
    `Hello Ayomide (NileFound System Admin),`,
    '',
    `A new campus notification has been generated for Nile University:`,
    `Event: ${notification.title}`,
    `Details: ${notification.message}`,
    notification.itemTitle ? `Target Item: ${notification.itemTitle}` : '',
    `Timestamp: ${new Date(notification.createdAt).toLocaleString()}`,
    '',
    `--`,
    `NileFound Lost & Found Portal (University Security & Student Services)`,
  ].filter(Boolean);

  const bodyText = bodyLines.join('\n');

  const record: EmailDispatchRecord = {
    id: `email-${Date.now()}`,
    recipient: PROJECT_OWNER_CONTACT,
    subject,
    bodyText,
    timestamp: new Date().toISOString(),
    notificationId: notification.id,
  };

  try {
    const existing = getAdminEmailDispatchLogs();
    localStorage.setItem(EMAIL_LOG_KEY, JSON.stringify([record, ...existing].slice(0, 50)));
  } catch {
    // Ignore storage quota / restricted storage environments
  }

  return record;
}

export function getAdminEmailDispatchLogs(): EmailDispatchRecord[] {
  try {
    const raw = localStorage.getItem(EMAIL_LOG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function clearNotificationStorage(): void {
  try {
    localStorage.removeItem(EMAIL_LOG_KEY);
  } catch {
    // Ignore
  }
}

export function getInitialCampusNotifications(): CampusNotification[] {
  return [];
}
