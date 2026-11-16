/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Lightweight, zero-dependency Sentry envelope reporter loaded lazily only when VITE_SENTRY_DSN is configured.
 */

interface ParsedDsn {
  endpoint: string;
  publicKey: string;
}

function parseDsn(dsn: string): ParsedDsn | null {
  try {
    const url = new URL(dsn);
    const projectId = url.pathname.replace(/^\/+/, '');
    if (!url.username || !projectId) return null;
    return {
      endpoint: `${url.protocol}//${url.host}/api/${projectId}/envelope/`,
      publicKey: url.username,
    };
  } catch {
    return null;
  }
}

function scrubEmails(text: string): string {
  return text.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[redacted-email]');
}

export async function sendToSentry(dsn: string, context: string, error: unknown): Promise<void> {
  const parsed = parseDsn(dsn);
  if (!parsed || typeof fetch !== 'function') return;

  const errObj = error instanceof Error ? error : new Error(typeof error === 'string' ? error : String(error));
  const message = scrubEmails(`${context}: ${errObj.message || 'Unknown error'}`).slice(0, 500);
  const eventId = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  const sentAt = new Date().toISOString();

  const header = JSON.stringify({ event_id: eventId, sent_at: sentAt, dsn });
  const itemHeader = JSON.stringify({ type: 'event' });
  const eventPayload = JSON.stringify({
    event_id: eventId,
    timestamp: Math.floor(Date.now() / 1000),
    platform: 'javascript',
    level: 'error',
    environment: import.meta.env?.MODE || 'production',
    message,
    tags: { context },
    exception: {
      values: [
        {
          type: errObj.name || 'Error',
          value: scrubEmails(errObj.message || 'Error'),
          stacktrace: errObj.stack
            ? { frames: [{ filename: scrubEmails(errObj.stack.slice(0, 1200)) }] }
            : undefined,
        },
      ],
    },
  });

  await fetch(`${parsed.endpoint}?sentry_key=${encodeURIComponent(parsed.publicKey)}&sentry_version=7`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-sentry-envelope' },
    body: `${header}\n${itemHeader}\n${eventPayload}`,
    keepalive: true,
  });
}
