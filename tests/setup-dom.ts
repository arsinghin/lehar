import '@testing-library/jest-dom/vitest';

import { cleanup, configure } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Workspace panels are lazy chunks. On a slow machine under coverage their first import can take longer
// than Testing Library's default 1 s wait, so findBy* queries wait up to 10 s instead.
configure({ asyncUtilTimeout: 10_000 });

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
});

// jsdom does not implement modal dialogs or matchMedia; provide faithful minimal versions.
if (
  !('showModal' in HTMLDialogElement.prototype) ||
  typeof HTMLDialogElement.prototype.showModal !== 'function'
) {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
}

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

window.requestAnimationFrame = (callback: FrameRequestCallback) =>
  window.setTimeout(() => {
    callback(performance.now());
  }, 0);

// axe-core probes canvas for icon-font detection; jsdom has no canvas, so report "unsupported" quietly.
HTMLCanvasElement.prototype.getContext = vi.fn(
  () => null,
) as typeof HTMLCanvasElement.prototype.getContext;

// File downloads click a temporary <a download>. jsdom cannot navigate, so stop the default action.
document.addEventListener(
  'click',
  (event) => {
    if (event.target instanceof HTMLAnchorElement && event.target.hasAttribute('download')) {
      event.preventDefault();
    }
  },
  true,
);

window.print = vi.fn();
URL.createObjectURL = vi.fn(() => 'blob:lehar');
URL.revokeObjectURL = vi.fn();
