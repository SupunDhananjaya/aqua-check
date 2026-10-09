const { contextBridge, ipcRenderer } = require('electron');

// Preload scripts finish before any page script runs, so by the time the React
// bundle reads its configuration at module level this global is already set.
// `sendSync` is what makes that ordering guarantee hold — an async handshake
// would force the whole config pipeline to become asynchronous and drag a
// loading state into the browser build too.
//
// In a plain browser this file never runs, the global is absent, and the app
// falls back to the configuration bundled at build time.
const config = ipcRenderer.sendSync('aqua-check:config');

if (config !== null && config !== undefined) {
  contextBridge.exposeInMainWorld('__AQUA_CHECK_CONFIG__', config);
}
