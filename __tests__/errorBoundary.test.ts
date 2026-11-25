/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { ErrorBoundary } from '../src/components/ErrorBoundary.tsx';

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

  constructor(tagName: string, doc: MockDocument) {
    this.tagName = tagName.toUpperCase();
    this.ownerDocument = doc;
  }

  get nodeName(): string {
    return this.tagName;
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
    return this.childNodes.map((c) => c.textContent).join(' ');
  }
  set textContent(val: string) {
    this.childNodes = val ? [new MockTextNode(val)] : [];
  }
  setAttribute(name: string, value: string): void {
    this.attributes.set(name, String(value));
  }
  removeAttribute(name: string): void {
    this.attributes.delete(name);
  }
  appendChild<T extends MockElement | MockTextNode>(child: T): T {
    child.parentNode = this;
    this.childNodes.push(child);
    return child;
  }
  insertBefore<T extends MockElement | MockTextNode>(
    newNode: T,
    refNode: MockElement | MockTextNode | null
  ): T {
    newNode.parentNode = this;
    const idx = refNode ? this.childNodes.indexOf(refNode) : -1;
    if (idx >= 0) this.childNodes.splice(idx, 0, newNode);
    else this.childNodes.push(newNode);
    return newNode;
  }
  removeChild<T extends MockElement | MockTextNode>(child: T): T {
    const idx = this.childNodes.indexOf(child);
    if (idx >= 0) this.childNodes.splice(idx, 1);
    child.parentNode = null;
    return child;
  }
  addEventListener(): void {}
  removeEventListener(): void {}
}

class MockDocument {
  nodeType = 9;
  defaultView: unknown;
  activeElement: MockElement | null = null;
  body: MockElement;
  documentElement: MockElement;

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
  addEventListener(): void {}
  removeEventListener(): void {}
}

test('ErrorBoundary renders fallback UI on unhandledrejection window events', async () => {
  const g = globalThis as unknown as Record<string, unknown>;
  const prevWindow = g.window;
  const prevDocument = g.document;
  const prevNode = g.Node;
  const prevHTMLElement = g.HTMLElement;
  const prevHTMLIFrameElement = g.HTMLIFrameElement;
  const prevActEnv = g.IS_REACT_ACT_ENVIRONMENT;

  const doc = new MockDocument();
  const listeners = new Map<string, Set<(e: unknown) => void>>();
  const mockWin = {
    document: doc,
    HTMLIFrameElement: class {},
    setTimeout: globalThis.setTimeout.bind(globalThis),
    clearTimeout: globalThis.clearTimeout.bind(globalThis),
    addEventListener(type: string, cb: (e: unknown) => void) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(cb);
    },
    removeEventListener(type: string, cb: (e: unknown) => void) {
      listeners.get(type)?.delete(cb);
    },
    dispatchEvent(event: { type: string; [key: string]: unknown }) {
      for (const cb of listeners.get(event.type) ?? []) {
        cb(event);
      }
    },
  };
  doc.defaultView = mockWin;
  g.window = mockWin;
  g.document = doc;
  g.Node = MockElement;
  g.HTMLElement = MockElement;
  g.HTMLIFrameElement = mockWin.HTMLIFrameElement;
  g.IS_REACT_ACT_ENVIRONMENT = true;

  const origConsoleError = console.error;
  console.error = () => {};

  const container = doc.createElement('div');
  doc.body.appendChild(container);
  const root = createRoot(container as unknown as Element);

  try {
    await React.act(async () => {
      root.render(React.createElement(ErrorBoundary, null, React.createElement('p', null, 'Healthy screen')));
    });
    assert.ok(container.textContent.includes('Healthy screen'));

    let prevented = false;
    await React.act(async () => {
      mockWin.dispatchEvent({
        type: 'unhandledrejection',
        reason: new Error('Background Firestore listener failed'),
        preventDefault() {
          prevented = true;
        },
      });
    });

    assert.equal(prevented, true);
    assert.ok(container.textContent.includes('Something went wrong'));
    assert.ok(container.textContent.includes('Reload page'));
  } finally {
    await React.act(async () => {
      root.unmount();
    });
    console.error = origConsoleError;
    g.window = prevWindow;
    g.document = prevDocument;
    g.Node = prevNode;
    g.HTMLElement = prevHTMLElement;
    g.HTMLIFrameElement = prevHTMLIFrameElement;
    g.IS_REACT_ACT_ENVIRONMENT = prevActEnv;
  }
});
