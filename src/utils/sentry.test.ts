/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { beforeSend, type SentryEventPayload } from '../lib/sentry.ts';

test('beforeSend scrubs emails, authorization headers, bearer tokens, and verification answers', () => {
  const event: SentryEventPayload = {
    event_id: 'abc123',
    timestamp: 1700000000,
    platform: 'javascript',
    level: 'error',
    environment: 'production',
    message: 'Submit failed for chidera@nileuniversity.edu.ng with Authorization: Bearer secret.jwt.token verificationAnswer="my blue key"',
    tags: {
      context: 'submit-claim',
      verificationAnswer: 'secret answer',
    },
    request: {
      headers: {
        Authorization: 'Bearer top-secret-token',
        'Content-Type': 'application/json',
      },
    },
    extra: {
      submittedAnswer: 'Blue sticker on back',
      expectedAnswer: 'Blue sticker on back',
      note: 'User tunde@nileuniversity.edu.ng retried',
    },
    user: {
      id: 'uid-1',
      email: 'chidera@nileuniversity.edu.ng',
    },
    exception: {
      values: [
        {
          type: 'Error',
          value: 'Failed with Bearer mytoken123 for aisha@nileuniversity.edu.ng',
        },
      ],
    },
  };

  const result = beforeSend(event);
  assert.ok(result);
  assert.ok(!result.message.includes('chidera@nileuniversity.edu.ng'));
  assert.ok(!result.message.includes('secret.jwt.token'));
  assert.ok(!result.message.includes('my blue key'));
  assert.equal(result.request?.headers?.Authorization, '[redacted]');
  assert.equal(result.request?.headers?.['Content-Type'], 'application/json');
  assert.equal(result.tags?.verificationAnswer, '[redacted]');
  assert.equal(result.extra?.submittedAnswer, '[redacted]');
  assert.equal(result.extra?.expectedAnswer, '[redacted]');
  assert.equal(result.extra?.note, 'User [redacted-email] retried');
  assert.equal(result.user?.email, '[redacted-email]');
  assert.ok(!result.exception?.values[0].value.includes('mytoken123'));
  assert.ok(!result.exception?.values[0].value.includes('aisha@nileuniversity.edu.ng'));
});
