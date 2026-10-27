import "@testing-library/jest-dom/vitest"

// Radix 的浮层在 jsdom 中需要浏览器布局观察器。
globalThis.ResizeObserver = class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
} as typeof ResizeObserver

// Vaul/Radix 使用 Pointer Capture，jsdom 仅提供事件模型。
HTMLElement.prototype.setPointerCapture = () => undefined
HTMLElement.prototype.releasePointerCapture = () => undefined
HTMLElement.prototype.hasPointerCapture = () => false
HTMLElement.prototype.scrollIntoView = () => undefined
