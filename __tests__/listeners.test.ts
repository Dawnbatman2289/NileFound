import test from 'node:test';
import assert from 'node:assert/strict';
import { attachAsyncSubscription } from '../src/utils/subscriptionLifecycle.ts';

test('attachAsyncSubscription invokes unsubscribe on normal cleanup', async () => {
  let unsubCalls = 0;
  const cleanup = attachAsyncSubscription(async () => {
    return () => {
      unsubCalls += 1;
    };
  });

  await Promise.resolve();
  await Promise.resolve();
  cleanup();
  cleanup();

  assert.equal(unsubCalls, 1);
});

test('attachAsyncSubscription immediately unsubscribes if unmounted before promise resolves', async () => {
  let unsubCalls = 0;
  let resolveFactory!: (fn: () => void) => void;
  const cleanup = attachAsyncSubscription(
    () =>
      new Promise((resolve) => {
        resolveFactory = resolve;
      })
  );

  cleanup();
  resolveFactory(() => {
    unsubCalls += 1;
  });

  await Promise.resolve();
  await Promise.resolve();
  assert.equal(unsubCalls, 1);
});

test('attachAsyncSubscription ignores errors after unmount and forwards active errors', async () => {
  let capturedActiveErr: unknown = null;
  const cleanupActive = attachAsyncSubscription(
    async () => {
      throw new Error('listener failed');
    },
    (err) => {
      capturedActiveErr = err;
    }
  );
  await Promise.resolve();
  await Promise.resolve();
  cleanupActive();
  assert.ok(capturedActiveErr instanceof Error);

  let capturedAfterUnmount: unknown = null;
  let rejectFactory!: (err: Error) => void;
  const cleanupEarly = attachAsyncSubscription(
    () =>
      new Promise((_, reject) => {
        rejectFactory = reject;
      }),
    (err) => {
      capturedAfterUnmount = err;
    }
  );
  cleanupEarly();
  rejectFactory(new Error('late error'));
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(capturedAfterUnmount, null);
});
