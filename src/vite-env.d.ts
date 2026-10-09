/// <reference types="vite/client" />

declare global {
  interface Window {
    /**
     * The configuration envelope injected by the Electron preload. Absent in a
     * browser, where the configuration bundled at build time is used instead.
     */
    __AQUA_CHECK_CONFIG__?: unknown;
  }
}

export {};
