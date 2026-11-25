/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Lightweight, zero-dependency Sentry envelope reporter loaded lazily only when VITE_SENTRY_DSN is configured.
 * Includes beforeSend scrubbing for user emails, authorization headers, and verification answers.
 */

interface ParsedDsn {
  endpoint: string;
  publicKey: string;
}

export interface SentryExceptionValue {
  type: string;
  value: string;
  stacktrace?: { frames: Array<{ filename: string }> };
}

export interface SentryEventPayload {
  event_id: string;
  timestamp: number;
  platform: string;
  level: string;
  environment: string;
  message: string;
  tags?: Record<string, string>;
  request?: {
    headers?: Record<string, string>;
    url?: string;
  };
  extra?: Record<string, unknown>;
  user?: {
    id?: string;
    email?: string;
  };
  exception?: {
    values: SentryExceptionValue[];
  };
}

const SENSITIVE_KEY_PATTERN = /^(authorization|cookie|set-cookie|x-api-key|token|password|verificationanswer|submittedanswer|expectedanswer)$/i;

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

export function scrubSensitiveText(text: string): string {
  return text
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[redacted-email]')
    .replace(
      /((?:verificationAnswer|submittedAnswer|expectedAnswer)\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s\n,;]+)/gi,
      '$1[redacted-answer]'
    )
    .replace(/\bBearer\s+[A-Za-z0-9\-._~+/]+=*/gi, 'Bearer [redacted-token]')
    .replace(/(authorization\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s\n,;]+)/gi, '$1[redacted-auth]');
}

function scrubRecord(record: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(record)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      sanitized[key] = '[redacted]';
    } else if (typeof val === 'string') {
      sanitized[key] = scrubSensitiveText(val);
    } else if (val && typeof val === 'object' && !Array.isArray(val)) {
      sanitized[key] = scrubRecord(val as Record<string, unknown>);
    } else {
      sanitized[key] = val;
    }
  }
  return sanitized;
}

export function beforeSend(event: SentryEventPayload): SentryEventPayload | null {
  const scrubbedTags = event.tags
    ? Object.fromEntries(
        Object.entries(event.tags).map(([k, v]) => [
          k,
          SENSITIVE_KEY_PATTERN.test(k) ? '[redacted]' : scrubSensitiveText(v),
        ])
      )
    : undefined;

  const scrubbedHeaders = event.request?.headers
    ? Object.fromEntries(
        Object.entries(event.request.headers).map(([k, v]) => [
          k,
          SENSITIVE_KEY_PATTERN.test(k) ? '[redacted]' : scrubSensitiveText(v),
        ])
      )
    : undefined;

  return {
    ...event,
    message: scrubSensitiveText(event.message),
    tags: scrubbedTags,
    request: event.request
      ? {
          ...event.request,
          url: event.request.url ? scrubSensitiveText(event.request.url) : undefined,
          headers: scrubbedHeaders,
        }
      : undefined,
    extra: event.extra ? scrubRecord(event.extra) : undefined,
    user: event.user
      ? {
          ...event.user,
          email: event.user.email ? '[redacted-email]' : undefined,
        }
      : undefined,
    exception: event.exception
      ? {
          values: event.exception.values.map((ex) => ({
            ...ex,
            value: scrubSensitiveText(ex.value),
            stacktrace: ex.stacktrace
              ? {
                  frames: ex.stacktrace.frames.map((frame) => ({
                    ...frame,
                    filename: scrubSensitiveText(frame.filename),
                  })),
                }
              : undefined,
          })),
        }
      : undefined,
  };
}

export async function sendToSentry(dsn: string, context: string, error: unknown): Promise<void> {
  const parsed = parseDsn(dsn);
  if (!parsed || typeof fetch !== 'function') return;

  const errObj = error instanceof Error ? error : new Error(typeof error === 'string' ? error : String(error));
  const eventId = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  const sentAt = new Date().toISOString();

  const rawEvent: SentryEventPayload = {
    event_id: eventId,
    timestamp: Math.floor(Date.now() / 1000),
    platform: 'javascript',
    level: 'error',
    environment: import.meta.env?.MODE || 'production',
    message: `${context}: ${errObj.message || 'Unknown error'}`.slice(0, 500),
    tags: { context },
    exception: {
      values: [
        {
          type: errObj.name || 'Error',
          value: errObj.message || 'Error',
          stacktrace: errObj.stack
            ? { frames: [{ filename: errObj.stack.slice(0, 1200) }] }
            : undefined,
        },
      ],
    },
  };

  const scrubbedEvent = beforeSend(rawEvent);
  if (!scrubbedEvent) return;

  const header = JSON.stringify({ event_id: eventId, sent_at: sentAt, dsn });
  const itemHeader = JSON.stringify({ type: 'event' });
  const eventPayload = JSON.stringify(scrubbedEvent);

  await fetch(`${parsed.endpoint}?sentry_key=${encodeURIComponent(parsed.publicKey)}&sentry_version=7`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-sentry-envelope' },
    body: `${header}\n${itemHeader}\n${eventPayload}`,
    keepalive: true,
  });
}
