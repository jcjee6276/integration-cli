import "@testing-library/jest-dom";

// crypto.randomUUID polyfill for jsdom
if (!globalThis.crypto.randomUUID) {
  (globalThis.crypto as { randomUUID?: unknown }).randomUUID = () =>
    "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = Math.floor(Math.random() * 16);
      return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
    });
}
