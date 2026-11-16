/**
 * Phase 1 & Phase 2 unit and component regression tests.
 * Covers Item 3 (ClaimChatModal focus retention), Item 4 (fresh pending claim resolution),
 * Item 5 (single rejected-claim retry), and Item 6 (global error handlers & reportError).
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { computeClaimDecisionBatchPlan, decideClaimWithFreshPending } from '../src/utils/claimDecision.ts';
import { getClaimButtonState } from '../src/components/ItemCardSections.tsx';
import { reportError, installGlobalErrorHandlers } from '../src/components/ErrorBoundary.tsx';
import type { CampusItem, ClaimRecord, User } from '../src/types/index.ts';

class MockTextNode {
  nodeType = 3;
  nodeValue: string;
  parentNode: MockElement | null = null;
  constructor(text: string) {
    this.nodeValue = text;
  }
  get textContent(): string {
    return this.nodeValue;
  }
  set textContent(v: string) {
    this.nodeValue = v;
  }
}

class MockElement {
  nodeType = 1;
  tagName: string;
  namespaceURI = 'http://www.w3.org/1999/xhtml';
  ownerDocument: MockDocument;
  parentNode: MockElement | null = null;
  childNodes: Array<MockElement | MockTextNode> = [];
  attributes = new Map<string, string>();
  style: Record<string, string> = {};
  value = '';
  disabled = false;
  tabIndex = 0;
  focusCount = 0;
  private listeners = new Map<string, Array<(e: unknown) => void>>();

  constructor(tagName: string, doc: MockDocument) {
    this.tagName = tagName.toUpperCase();
    this.ownerDocument = doc;
  }

  get id(): string {
    return this.attributes.get('id') || '';
  }
  get nodeName(): string {
    return this.tagName;
  }
  set id(val: string) {
    this.attributes.set('id', val);
  }
  get className(): string {
    return this.attributes.get('class') || '';
  }
  set className(val: string) {
    this.attributes.set('class', val);
  }
  get firstChild(): MockElement | MockTextNode | null {
    return this.childNodes[0] ?? null;
  }
  get nextSibling(): MockElement | MockTextNode | null {
    if (!this.parentNode) return null;
    const idx = this.parentNode.childNodes.indexOf(this);
    return idx >= 0 ? this.parentNode.childNodes[idx + 1] ?? null : null;
  }
  get textContent(): string {
    return this.childNodes.map((c) => c.textContent).join('');
  }
  set textContent(val: string) {
    this.childNodes = val ? [new MockTextNode(val)] : [];
  }

  setAttribute(name: string, val: string): void {
    this.attributes.set(name, String(val));
  }
  removeAttribute(name: string): void {
    this.attributes.delete(name);
  }
  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }
  hasAttribute(name: string): boolean {
    return this.attributes.has(name);
  }
  appendChild<T extends MockElement | MockTextNode>(child: T): T {
    if (child.parentNode) {
      const prevIdx = child.parentNode.childNodes.indexOf(child);
      if (prevIdx >= 0) child.parentNode.childNodes.splice(prevIdx, 1);
    }
    child.parentNode = this;
    this.childNodes.push(child);
    return child;
  }
  insertBefore<T extends MockElement | MockTextNode>(
    newNode: T,
    refNode: MockElement | MockTextNode | null
  ): T {
    if (!refNode) return this.appendChild(newNode);
    if (newNode.parentNode) {
      const prevIdx = newNode.parentNode.childNodes.indexOf(newNode);
      if (prevIdx >= 0) newNode.parentNode.childNodes.splice(prevIdx, 1);
    }
    newNode.parentNode = this;
    const idx = this.childNodes.indexOf(refNode);
    if (idx >= 0) {
      this.childNodes.splice(idx, 0, newNode);
    } else {
      this.childNodes.push(newNode);
    }
    return newNode;
  }
  removeChild<T extends MockElement | MockTextNode>(child: T): T {
    const idx = this.childNodes.indexOf(child);
    if (idx >= 0) this.childNodes.splice(idx, 1);
    child.parentNode = null;
    return child;
  }
  addEventListener(type: string, cb: (e: unknown) => void): void {
    const list = this.listeners.get(type) ?? [];
    list.push(cb);
    this.listeners.set(type, list);
  }
  removeEventListener(type: string, cb: (e: unknown) => void): void {
    const list = this.listeners.get(type);
    if (!list) return;
    this.listeners.set(
      type,
      list.filter((fn) => fn !== cb)
    );
  }
  focus(): void {
    this.focusCount += 1;
    this.ownerDocument.activeElement = this;
  }
  scrollIntoView(): void {
    // no-op for Node DOM test
  }
  querySelectorById(targetId: string): MockElement | null {
    if (this.id === targetId) return this;
    for (const child of this.childNodes) {
      if (child instanceof MockElement) {
        const found = child.querySelectorById(targetId);
        if (found) return found;
      }
    }
    return null;
  }
}

class MockDocument {
  nodeType = 9;
  defaultView: unknown;
  activeElement: MockElement | null = null;
  body: MockElement;
  documentElement: MockElement;
  private listeners = new Map<string, Array<(e: unknown) => void>>();

  constructor() {
    this.documentElement = new MockElement('html', this);
    this.body = new MockElement('body', this);
    this.documentElement.appendChild(this.body);
  }
  createElement(tag: string): MockElement {
    return new MockElement(tag, this);
  }
  createElementNS(_ns: string, tag: string): MockElement {
    return new MockElement(tag, this);
  }
  createTextNode(text: string): MockTextNode {
    return new MockTextNode(text);
  }
  getElementById(id: string): MockElement | null {
    return this.body.querySelectorById(id);
  }
  addEventListener(type: string, cb: (e: unknown) => void): void {
    const list = this.listeners.get(type) ?? [];
    list.push(cb);
    this.listeners.set(type, list);
  }
  removeEventListener(type: string, cb: (e: unknown) => void): void {
    const list = this.listeners.get(type);
    if (!list) return;
    this.listeners.set(
      type,
      list.filter((fn) => fn !== cb)
    );
  }
}

function makeItem(overrides: Partial<CampusItem> = {}): CampusItem {
  return {
    id: 'item-1',
    type: 'found',
    title: 'Black Casio Calculator',
    category: 'calculator',
    description: 'Found near Nile Main Library.',
    location: 'Nile Main Library',
    locationDetails: 'Second floor study desk',
    dateLostOrFound: '2026-11-12',
    status: 'open',
    holdingLocation: 'finder_holding',
    authorId: 'finder-1',
    createdAt: '2026-11-12T10:00:00.000Z',
    ...overrides,
  };
}

function makeClaim(overrides: Partial<ClaimRecord> = {}): ClaimRecord {
  return {
    id: 'claim-1',
    itemId: 'item-1',
    itemTitle: 'Black Casio Calculator',
    finderId: 'finder-1',
    claimantId: 'claimant-1',
    claimantName: 'Aisha Bello',
    claimantEmail: 'aisha@nileuniversity.edu.ng',
    submittedAnswer: 'Has a small scratch on the battery cover',
    status: 'pending',
    resubmitted: false,
    createdAt: '2026-11-12T11:00:00.000Z',
    ...overrides,
  };
}

test('Item 3: ClaimChatModal keeps focus in textarea across parent re-renders with inline onClose', async () => {
  const g = globalThis as unknown as Record<string, unknown>;
  const prevWindow = g.window;
  const prevDocument = g.document;
  const prevNode = g.Node;
  const prevHTMLElement = g.HTMLElement;
  const prevActEnv = g.IS_REACT_ACT_ENVIRONMENT;

  const doc = new MockDocument();
  const winListeners = new Map<string, Array<(e: unknown) => void>>();
  const mockWin = {
    document: doc,
    HTMLIFrameElement: class {},
    setTimeout: globalThis.setTimeout.bind(globalThis),
    clearTimeout: globalThis.clearTimeout.bind(globalThis),
    addEventListener: (type: string, cb: (e: unknown) => void) => {
      const list = winListeners.get(type) ?? [];
      list.push(cb);
      winListeners.set(type, list);
    },
    removeEventListener: (type: string, cb: (e: unknown) => void) => {
      const list = winListeners.get(type);
      if (!list) return;
      winListeners.set(
        type,
        list.filter((fn) => fn !== cb)
      );
    },
  };
  doc.defaultView = mockWin;
  g.window = mockWin;
  g.document = doc;
  g.Node = MockElement;
  g.HTMLElement = MockElement;
  g.IS_REACT_ACT_ENVIRONMENT = true;

  try {
    const { ClaimChatModal } = await import('../src/components/ClaimChatModal.tsx');
    const container = doc.createElement('div');
    doc.body.appendChild(container);
    const root = createRoot(container as unknown as Element);

    const user: User = {
      id: 'claimant-1',
      name: 'Aisha Bello',
      email: 'aisha@nileuniversity.edu.ng',
      role: 'student',
    };
    const item = makeItem({ status: 'claim_requested' });
    let setParentCount: ((n: number) => void) | null = null;

    const Host: React.FC = () => {
      const [renderTick, setRenderTick] = React.useState(0);
      setParentCount = setRenderTick;
      return React.createElement(ClaimChatModal, {
        claim: makeClaim({ itemTitle: `Black Casio Calculator` }),
        item,
        currentUser: user,
        isDemoMode: true,
        onClose: () => {
          void renderTick;
        },
      });
    };

    await React.act(async () => {
      root.render(React.createElement(Host));
    });
    await new Promise((r) => setTimeout(r, 20));

    const textarea = doc.getElementById('claim-chat-input');
    assert.ok(textarea, 'claim-chat-input textarea should render');
    assert.equal(textarea.tagName, 'TEXTAREA');

    textarea.focus();
    assert.equal(doc.activeElement, textarea);

    for (let tick = 1; tick <= 4; tick += 1) {
      await React.act(async () => {
        setParentCount?.(tick);
      });
      await new Promise((r) => setTimeout(r, 15));
    }

    assert.equal(
      doc.activeElement,
      textarea,
      'Textarea focus must not be stolen back to dialog container on parent re-renders'
    );

    await React.act(async () => {
      root.unmount();
    });
  } finally {
    g.window = prevWindow;
    g.document = prevDocument;
    g.Node = prevNode;
    g.HTMLElement = prevHTMLElement;
    g.IS_REACT_ACT_ENVIRONMENT = prevActEnv;
  }
});

test('Item 4: fresh pending query handles pending claims outside the loaded UI page', async () => {
  const approvePlan = computeClaimDecisionBatchPlan('claim-1', 'approved', [
    'claim-1',
    'claim-offpage-42',
    'claim-offpage-99',
  ]);
  assert.equal(approvePlan.nextItemStatus, 'verified');
  assert.deepEqual(approvePlan.autoRejectedIds, ['claim-offpage-42', 'claim-offpage-99']);

  const rejectWithOffPageRemaining = computeClaimDecisionBatchPlan('claim-1', 'rejected', [
    'claim-1',
    'claim-offpage-42',
  ]);
  assert.equal(rejectWithOffPageRemaining.nextItemStatus, 'claim_requested');
  assert.deepEqual(rejectWithOffPageRemaining.autoRejectedIds, []);

  const rejectLastPending = computeClaimDecisionBatchPlan('claim-1', 'rejected', ['claim-1']);
  assert.equal(rejectLastPending.nextItemStatus, 'open');

  let committedPlan: ReturnType<typeof computeClaimDecisionBatchPlan> | null = null;
  await decideClaimWithFreshPending({
    claimId: 'claim-1',
    itemId: 'item-1',
    decision: 'approved',
    queryPendingClaimIds: async () => ['claim-1', 'offpage-claim-77'],
    commitDecisionBatch: async (plan) => {
      committedPlan = plan;
    },
  });
  assert.deepEqual(committedPlan, {
    nextItemStatus: 'verified',
    autoRejectedIds: ['offpage-claim-77'],
  });
});

test('Item 5: rejected claimants get exactly one retry while item stays open or claim_requested', () => {
  const openItem = makeItem({ status: 'open' });
  const requestedItem = makeItem({ status: 'claim_requested' });
  const returnedItem = makeItem({ status: 'returned' });

  const firstRejection = makeClaim({ status: 'rejected', resubmitted: false });
  assert.deepEqual(
    getClaimButtonState(openItem, 'claimant-1', undefined, undefined, firstRejection),
    { disabled: false, label: 'Retry Claim (1 left)' }
  );
  assert.deepEqual(
    getClaimButtonState(requestedItem, 'claimant-1', undefined, undefined, firstRejection),
    { disabled: false, label: 'Retry Claim (1 left)' }
  );

  const secondRejection = makeClaim({ status: 'rejected', resubmitted: true });
  assert.deepEqual(
    getClaimButtonState(openItem, 'claimant-1', undefined, undefined, secondRejection),
    { disabled: true, label: 'Claim Rejected (Final)' }
  );

  assert.deepEqual(
    getClaimButtonState(returnedItem, 'claimant-1', undefined, undefined, firstRejection),
    { disabled: true, label: 'Item Reunited' }
  );
});

test('Item 6: global error handlers and reportError log in non-DEV without throwing', () => {
  const g = globalThis as unknown as Record<string, unknown>;
  const prevWindow = g.window;
  const prevConsoleError = console.error;

  const logged: unknown[][] = [];
  const listeners = new Map<string, Array<(ev: unknown) => void>>();

  console.error = (...args: unknown[]) => {
    logged.push(args);
  };
  g.window = {
    addEventListener: (type: string, cb: (ev: unknown) => void) => {
      const list = listeners.get(type) ?? [];
      list.push(cb);
      listeners.set(type, list);
    },
  };

  try {
    reportError('Direct failure check', new Error('Network dropped'));
    assert.equal(logged.length, 1);
    assert.match(String(logged[0][0]), /Direct failure check/);

    installGlobalErrorHandlers();
    const errorHandlers = listeners.get('error') ?? [];
    const rejectionHandlers = listeners.get('unhandledrejection') ?? [];
    assert.equal(errorHandlers.length, 1);
    assert.equal(rejectionHandlers.length, 1);

    errorHandlers[0]({ error: new Error('Boom'), message: 'Boom' });
    rejectionHandlers[0]({ reason: new Error('Rejected promise') });
    assert.equal(logged.length, 3);
  } finally {
    console.error = prevConsoleError;
    g.window = prevWindow;
  }
});
