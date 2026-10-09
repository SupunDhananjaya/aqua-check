import { copyFileSync, existsSync, readFileSync } from 'node:fs';
import { dirname, extname, join, normalize, sep } from 'node:path';
import { app, BrowserWindow, ipcMain, Menu, protocol, shell } from 'electron';

const DEV = process.argv.includes('--dev');
const DEV_SERVER_URL = 'http://localhost:5173';

/**
 * The app is served over a custom scheme rather than `file://` so that the web
 * build needs no changes: absolute `/assets/...` paths resolve, and because the
 * scheme is registered as `standard` the page gets a real origin, which is what
 * lets BrowserRouter's pushState to /report work.
 */
const APP_SCHEME = 'app';
const APP_ORIGIN = `${APP_SCHEME}://aqua-check`;

const DIST_DIR = join(import.meta.dirname, '..', 'dist');
const CONFIG_FILENAME = 'configuration.json';

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'self'",
].join('; ');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

protocol.registerSchemesAsPrivileged([
  {
    scheme: APP_SCHEME,
    privileges: { standard: true, secure: true, supportFetchAPI: true },
  },
]);

// ---------------------------------------------------------------------------
// Configuration file, kept next to the executable so measures can be edited
// without a rebuild.
// ---------------------------------------------------------------------------

/** `--config-dir <path>` exists so the packaged behaviour can be exercised in dev. */
function configDirectoryOverride() {
  const index = process.argv.indexOf('--config-dir');
  return index !== -1 ? process.argv[index + 1] : undefined;
}

/** Whether to hand the renderer an external file at all. In plain dev it uses the bundled import. */
function usesExternalConfig() {
  return app.isPackaged || configDirectoryOverride() !== undefined;
}

function bundledDefaultPath() {
  return app.isPackaged
    ? join(process.resourcesPath, 'configuration.default.json')
    : join(import.meta.dirname, '..', 'src', 'config', CONFIG_FILENAME);
}

/**
 * Finds the external configuration file, creating it from the bundled default on
 * first run. `PORTABLE_EXECUTABLE_DIR` is set by electron-builder's portable
 * target to the folder the .exe was launched from — that is where an operator
 * expects to find a file they can edit.
 */
function ensureConfigFile() {
  const preferred =
    configDirectoryOverride() ?? process.env.PORTABLE_EXECUTABLE_DIR ?? dirname(app.getPath('exe'));

  // A read-only folder (Program Files, a locked USB stick) must not stop the app
  // starting, so fall back to the per-user data directory.
  for (const directory of [preferred, app.getPath('userData')]) {
    const file = join(directory, CONFIG_FILENAME);
    if (existsSync(file)) return { file, error: null };

    try {
      copyFileSync(bundledDefaultPath(), file);
      return { file, error: null };
    } catch (cause) {
      if (directory === app.getPath('userData')) {
        return { file, error: `Could not create ${file}: ${cause.message}` };
      }
    }
  }

  return { file: null, error: 'Could not resolve a configuration file.' };
}

/**
 * Reads the configuration fresh every time, so reloading the window is all it
 * takes to pick up an edit. Returns the envelope the renderer expects.
 */
function readConfig() {
  if (!usesExternalConfig()) return null;

  const { file, error } = ensureConfigFile();
  if (error !== null) return { raw: null, error, path: file };

  try {
    return { raw: JSON.parse(readFileSync(file, 'utf8')), error: null, path: file };
  } catch (cause) {
    return { raw: null, error: `${file} could not be read: ${cause.message}`, path: file };
  }
}

// ---------------------------------------------------------------------------
// Serving the built app
// ---------------------------------------------------------------------------

/**
 * Maps a request onto `dist/`. A path with no extension is a client-side route,
 * so it falls back to index.html — the SPA rewrite that makes a deep link to
 * /report work the same way it does on a web server.
 */
function handleAppRequest(request) {
  const requested = normalize(join(DIST_DIR, decodeURIComponent(new URL(request.url).pathname)));

  if (requested !== DIST_DIR && !requested.startsWith(DIST_DIR + sep)) {
    return new Response('Forbidden', { status: 403 });
  }

  const extension = extname(requested);
  if (extension !== '' && !existsSync(requested)) {
    return new Response('Not found', { status: 404 });
  }

  const file = extension === '' ? join(DIST_DIR, 'index.html') : requested;

  return new Response(readFileSync(file), {
    headers: {
      'Content-Type': MIME_TYPES[extname(file)] ?? 'application/octet-stream',
      'Content-Security-Policy': CONTENT_SECURITY_POLICY,
    },
  });
}

// ---------------------------------------------------------------------------
// Window and menu
// ---------------------------------------------------------------------------

function createWindow() {
  const window = new BrowserWindow({
    width: 1100,
    height: 860,
    minWidth: 420,
    minHeight: 480,
    backgroundColor: '#f8fafc',
    show: false,
    webPreferences: {
      preload: join(import.meta.dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  window.once('ready-to-show', () => window.show());

  // Keep the window on its own origin; anything else belongs in the real browser.
  window.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
  window.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(DEV ? DEV_SERVER_URL : APP_ORIGIN)) event.preventDefault();
  });

  if (DEV) {
    window.loadURL(DEV_SERVER_URL);
    window.webContents.openDevTools({ mode: 'detach' });
  } else {
    window.loadURL(`${APP_ORIGIN}/`);
  }

  return window;
}

function buildMenu(window) {
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: 'File',
        submenu: [
          {
            label: 'Open configuration file',
            accelerator: 'CmdOrCtrl+O',
            enabled: usesExternalConfig(),
            click: () => {
              const { file } = ensureConfigFile();
              if (file !== null) shell.openPath(file);
            },
          },
          {
            // The config is re-read on every load, so a reload is the whole edit loop.
            label: 'Reload configuration',
            accelerator: 'CmdOrCtrl+R',
            click: () => window.reload(),
          },
          { type: 'separator' },
          { role: 'quit' },
        ],
      },
      {
        label: 'View',
        submenu: [
          { role: 'resetZoom' },
          { role: 'zoomIn' },
          { role: 'zoomOut' },
          { type: 'separator' },
          { role: 'toggleDevTools' },
        ],
      },
    ]),
  );
}

app.whenReady().then(() => {
  ipcMain.on('aqua-check:config', (event) => {
    event.returnValue = readConfig();
  });

  protocol.handle(APP_SCHEME, handleAppRequest);

  buildMenu(createWindow());

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) buildMenu(createWindow());
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
