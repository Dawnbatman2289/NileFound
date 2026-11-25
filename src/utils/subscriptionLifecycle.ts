/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Mount-safe async subscription lifecycle helper ensuring late-resolving
 * listeners are immediately unsubscribed if the consumer has unmounted.
 */

export type UnsubscribeFn = () => void;

export function attachAsyncSubscription(
  subscribeAsync: (isActive: () => boolean) => Promise<UnsubscribeFn>,
  onError?: (error: unknown) => void
): UnsubscribeFn {
  let active = true;
  let unsubscribe: UnsubscribeFn | undefined;

  subscribeAsync(() => active)
    .then((unsub) => {
      if (!active) {
        unsub();
        return;
      }
      unsubscribe = unsub;
    })
    .catch((err) => {
      if (active) {
        onError?.(err);
      }
    });

  return () => {
    active = false;
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = undefined;
    }
  };
}
