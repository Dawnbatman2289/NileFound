import test from 'node:test';
import assert from 'node:assert/strict';
import type React from 'react';
import { shouldCloseBackdropClick } from './modalFocus.ts';

test('shouldCloseBackdropClick closes only when pointer-down and click both target backdrop', () => {
  const backdropEl = {} as HTMLElement;
  const childEl = {} as HTMLElement;

  const validBackdropClick = {
    target: backdropEl,
    currentTarget: backdropEl,
  } as unknown as React.MouseEvent<HTMLElement>;

  const dragOutClick = {
    target: backdropEl,
    currentTarget: backdropEl,
  } as unknown as React.MouseEvent<HTMLElement>;

  const innerContentClick = {
    target: childEl,
    currentTarget: backdropEl,
  } as unknown as React.MouseEvent<HTMLElement>;

  assert.equal(shouldCloseBackdropClick(validBackdropClick, true), true);
  assert.equal(shouldCloseBackdropClick(dragOutClick, false), false);
  assert.equal(shouldCloseBackdropClick(innerContentClick, true), false);
});
