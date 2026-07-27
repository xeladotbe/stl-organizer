import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

// React Testing Library's automatic afterEach(cleanup) relies on detecting a global test
// framework; since this project doesn't enable vitest's `globals: true`, it must be registered
// explicitly - otherwise DOM from one test leaks into the next within the same file.
afterEach(cleanup)

// Radix UI's pointer-based interactions (Select, Dialog, etc.) call browser APIs jsdom doesn't
// implement - without these stubs, component tests exercising Radix primitives throw "not a
// function" errors that have nothing to do with the behavior actually under test.
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = (): boolean => false
}
if (!Element.prototype.setPointerCapture) {
  Element.prototype.setPointerCapture = (): void => {}
}
if (!Element.prototype.releasePointerCapture) {
  Element.prototype.releasePointerCapture = (): void => {}
}
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = (): void => {}
}

if (typeof globalThis.ResizeObserver === 'undefined') {
  // jsdom has no layout engine, so there's nothing for a real observer to report - components
  // that construct one (e.g. via a ref callback) just need it to exist and not throw.
  class ResizeObserverStub {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    observe(): void {}
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    unobserve(): void {}
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    disconnect(): void {}
  }
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver
}
