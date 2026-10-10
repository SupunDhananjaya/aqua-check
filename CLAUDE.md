# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Vite dev server on http://localhost:5173
npm run build        # tsc -b && vite build  → dist/
npm run build:pages  # same, with the GitHub Pages base path
npm run preview      # serve the built dist/ locally
npm run preview:pages  # serve it on the GitHub Pages base path
npm run lint         # eslint .
npm run format       # prettier --write .
npm test             # vitest run (single pass, no watch)
npm run typecheck    # tsc -b --noEmit
```

Narrower test runs (no npm script — invoke Vitest directly):

```bash
npx vitest run src/lib/evaluateSample.test.ts    # one file
npx vitest run -t "treats both bounds as inclusive"  # one test by name
npx vitest                                       # watch mode
npx vitest run --coverage                        # v8 coverage → coverage/
```

Desktop build (Electron):

```bash
npm run electron:dev     # Vite + an Electron window on it, hot reload
npm run electron:start   # build, then run the packaged code path without producing an .exe
npm run electron:build   # → release/aqua-check-<version>-portable.exe
npm run make-icon        # regenerate build/icon.ico
```

## Toolchain constraints

**Do not upgrade TypeScript past 5.x.** It is deliberately pinned to `~5.9` while the rest of
the stack is latest. `typescript-eslint@8` declares `peer typescript@">=4.8.4 <6.1.0"`, and no
stable release supports TS 7 yet, so `npm i -D typescript@latest` makes `npm install` fail with
`ERESOLVE`. Installing TS 7 over it with `--legacy-peer-deps` is worse: `lint` then runs against
an unsupported compiler. Revisit only once typescript-eslint ships TS 7 support.

**`npm run typecheck` can report success from cache.** `tsc -b` is build mode and skips work when
`*.tsbuildinfo` is current. After changing compiler options (as opposed to source), delete
`tsconfig.app.tsbuildinfo` / `tsconfig.node.tsbuildinfo` before trusting a clean run.

## Architecture

Standard Vite SPA: `index.html` → `src/main.tsx` (mounts `#root` under `StrictMode`) → `src/App.tsx`.
Components live in `src/components/`, each with a colocated `*.test.tsx`; pure logic lives in
`src/lib/`. There is no state manager and no data layer beyond the config file below — pick those
when the need appears rather than assuming one is already in place.

The app checks a waste-water sample against configured limits. `LandingPage` renders one required
input per configured measure; on submit it hands the **raw entered strings** to `/report` via
`navigate(..., { state: { values } })`, and `ReportPage` re-derives the verdict with
`evaluateSample`. Passing values rather than a computed report keeps the history entry small and
serialisable, and means a report can never show stale bounds after a config edit.

**Routing uses `react-router` v8 — the package is `react-router`, not `react-router-dom`**, which
was never published for v8. `BrowserRouter` lives in `src/main.tsx`, deliberately _not_ in `App.tsx`,
so tests can wrap `<App />` in a `MemoryRouter` without nesting two routers. Note that v8 requires
Node >= 22.22, and that a static host needs an SPA rewrite to `index.html` or a hard refresh of
`/report` will 404.

**`src/config/configuration.json` is the rule set, and adding a measure must stay a pure JSON edit.**
Each entry needs `name` (stable key), `label`, `description`, `unit`, `approved_lower_bound`,
`approved_upper_bound`, and a treatment string for each bound it sets. A `null` bound means
unbounded on that side and lets its treatment be `null` too. **Bounds are inclusive** — a value
exactly on a bound passes. The file is under `src/` on purpose: `tsconfig.app.json` includes only
`src`, so a root-level config would be invisible to `lint` and `typecheck`. `resolveJsonModule` is
already implied by `moduleResolution: "bundler"`, so importing it needs no compiler-option change.

Two fields are optional and **default rather than error**, so an older config still loads:
`required` on a measure (absent means `true`) and the top-level `app_name` (absent means
`aqua-check`). The top-level `standard` is displayed in the header. `app_name` drives the header,
the document title and the desktop window title — nothing should hard-code the product name in
`src/` again.

`parseConfiguration` in `src/config/measures.ts` validates that file at startup and _returns_
problems instead of throwing, so a bad hand-edit renders a readable panel rather than a blank
screen. It must keep producing an `appName` even when the file is unusable, or a broken config
leaves the header blank. Tests read `measures` from the real config and derive their values from it,
so they stay green when the config grows — keep new tests data-driven the same way rather than
hard-coding six measures, and derive required-field counts from `measure.required` rather than from
`measures.length`.

**An optional measure left blank is `'skipped'`, not a failure.** `evaluateSample` splits the
no-value case on `measure.required`: optional gives `'skipped'`, required keeps `'missing'` (which
the form should never allow through). `failures` therefore excludes **both** `'pass'` and
`'skipped'` explicitly — it used to be the negative filter `!== 'pass'`, which would silently count
a skipped measure as a failure. `OUTCOME_LABEL` in `ReportPage` is a `Record<Outcome, string>`, so
adding an outcome is a compile error until it is labelled.

`MeasureField` shows the `Optional` marker inside the **range span**, never the `<label>`: the
label's text is the input's accessible name and every test queries
`getByRole('spinbutton', { name: measure.label })`.

## Sample details

Every check records a **sample ID, a sample name and a sampling date**, all three required, and all
three shown on the report above the verdict. They travel in the router state beside the
measurements — `{ values, sample }` — which `readValues` ignores, so the two are independent.

**The date is ISO `YYYY-MM-DD` everywhere except the moment it is rendered.** `src/lib/sampleDetails.ts`
owns the whole of it:

- `todayIso` builds from `getFullYear`/`getMonth`/`getDate`, **never `toISOString()`** — the ISO
  form is UTC, so west of Greenwich it reports yesterday for much of the day, which would default
  the form wrongly and reject a same-day sample as being in the future. `now` is injectable so the
  tests need no fake timers.
- Future dates are rejected; the past is unbounded. The check is the plain string comparison
  `date > today`, which is exact for `YYYY-MM-DD` and avoids `Date` arithmetic entirely.
- `formatSampleDate` renders `9 October 2026` from a fixed month table, not the system locale, so a
  report reads the same on every machine and the tests stay deterministic. It returns `null` for a
  day that does not exist, so the report can never print `31 February`.
- `LandingPage` re-reads `todayIso()` at submit rather than reusing the mount-time value, so a
  window left open across midnight does not start rejecting the current day.

Two testing constraints, both verified against the installed `aria-query` map:

- **`<input type="date">` has no implicit ARIA role**, so the date field is the one query that uses
  `getByLabelText('Sampled on')` rather than a role. `type="number"` → `spinbutton` and
  `text` → `textbox` as usual.
- **Never drive a date input with `user.type`.** jsdom runs the value-sanitisation algorithm on
  every keystroke, so a partial value is discarded and typing character-by-character ends up empty.
  Date-range behaviour is covered in `sampleDetails.test.ts`; the component tests only assert the
  default value and the `max` attribute. If a DOM test ever must change it, use `fireEvent.change`.

The report's detail strip is a plain `<dl>` — `dt` → `term`, `dd` → `definition`, while `listitem`
stays `li`-only, so it is role-queryable without an ARIA override and cannot disturb the
`listitem` assertions that guard the treatment list.

## Desktop target

`electron/` wraps the same `dist/` the web app ships. **Nothing in `src/` may be made
Electron-specific** — the browser build is a first-class target, so both of the tricks below exist
precisely to avoid changing it.

**The app is served over a custom `app://` scheme, never `file://`.** `electron/main.js` registers
the scheme as `standard` before `app.whenReady()` and serves `dist/` from `protocol.handle`, with a
fallback to `index.html` for any extension-less path. That is what lets the absolute `/assets/...`
paths Vite emits resolve, and gives the page a real origin so `BrowserRouter` can push `/report`.
It is also why `vite.config.ts` needs no `base` and `src/main.tsx` needs no `HashRouter`. The CSP
is attached as a response header there rather than as a `<meta>` tag in `index.html`.

**The packaged app reads `configuration.json` from beside the `.exe`.** `electron/preload.cjs` is a
sandboxed CommonJS preload that fetches it over `ipcRenderer.sendSync` and exposes it as
`window.__AQUA_CHECK_CONFIG__`. Preloads finish before any page script, so `measures.ts` can prefer
it over the bundled import and stay synchronous — keep `exposeInMainWorld` at the top level with no
`await` before it, or that guarantee is lost. `selectConfigSource` falls back to the bundled config
whenever the global is missing (every browser) or the host reports a read error. Main re-reads the
file on every load, so reloading the window is the whole edit loop. The seeded copy goes next to the
executable via `PORTABLE_EXECUTABLE_DIR`, falling back to `userData` if that folder is read-only.

The Electron files are plain `.js`/`.cjs` on purpose: `eslint.config.js` already gives
`**/*.{js,cjs,mjs}` Node globals, so they lint with no new config, and no `tsconfig.electron.json`
project reference or `@types/node` is needed. They are **not** covered by `npm run typecheck`.

Two packaging constraints that are easy to undo: `electron-builder.json` must keep
`directories.output` pointed at `release/` (its default is `dist/`, which would collide with Vite's
output), and `"!node_modules/**/*"` in `files` is what keeps react and react-router — already
bundled into `dist/assets` — out of the `.exe`. The archive should stay well under 1 MB; the `.exe`
is ~95 MB, nearly all Electron runtime.

`npm run electron:dev` waits on `http://localhost:5173`, not `tcp:127.0.0.1:5173` — Vite binds
`localhost` as IPv6 here, so a TCP probe against the v4 address never resolves and Electron never
starts.

## Web deployment

The browser build is published to GitHub Pages at `https://supundhananjaya.github.io/aqua-check/`
by `.github/workflows/deploy.yml` on every push to `main` (Pages **Source** must stay set to
_GitHub Actions_ in the repository settings; there is no `gh-pages` branch and no `gh-pages`
dependency, which also sidesteps `dist` being gitignored).

**The Pages sub-path lives in the `build:pages` script and nowhere else.** That script is
`build` plus `vite build --base=/aqua-check/`, and `src/main.tsx` reads the value back as
`basename={import.meta.env.BASE_URL}`. One knob therefore serves both targets and nothing in `src/`
becomes deployment-specific. Two reasons not to "tidy" this into `vite.config.ts`:

- An unconditional `base` breaks the desktop app. `handleAppRequest` in `electron/main.js` maps the
  request pathname straight onto `dist/` with no prefix stripping, so `/aqua-check/assets/...`
  resolves to `dist/aqua-check/assets/...`, 404s, and the window comes up blank.
- A conditional `base` keyed off `process.env` does not typecheck. `vite.config.ts` is covered by
  `tsconfig.node.json` and there is deliberately no `@types/node`, so `process` is not declared.

The workflow copies `dist/index.html` to `dist/404.html` after the build, because Pages has no SPA
rewrite and a hard refresh of `/report` would otherwise 404. It has to be a post-build copy rather
than a `public/404.html`, since the file needs the build's hashed asset tags. A cold deep link to
`/report` then loads the app and bounces to `/` via `ReportPage`, which is already how an
unreachable report behaves. No `.nojekyll` is needed: Jekyll never runs when Pages is sourced from
Actions.

The workflow pins Node 24 — react-router v8 needs `>= 22.22`, so the runner default is not safe to
assume — and runs `lint` and `test` before the build, so a broken commit never publishes.

On Pages the rule set is **frozen at build time**: `measures.ts` imports `configuration.json`, and
`window.__AQUA_CHECK_CONFIG__` is only ever set by the Electron preload, so a limits change needs a
push and a redeploy. Only the packaged `.exe` reads the file from beside itself.

Four pieces of config carry decisions that are easy to undo by accident:

**`vite.config.ts`** holds both the Vite and the Vitest config in one file. `defineConfig` is
imported from `vitest/config`, not `vite` — the `vite` export does not type the `test` key, so
switching that import breaks typecheck. Tests run in `jsdom` with `globals: true`.

**Tailwind v4 is CSS-first. There is no `tailwind.config.js` and you should not create one.**
Tailwind is wired as the `@tailwindcss/vite` plugin, and the whole stylesheet is
`@import 'tailwindcss';` in `src/index.css`. Theme extensions belong in that CSS file via `@theme`,
not in a JS config.

**`tsconfig.json` is a solution file** holding only references to `tsconfig.app.json` (covers `src`,
DOM libs, Vitest + jest-dom globals) and `tsconfig.node.json` (covers `vite.config.ts` and
`eslint.config.js`). A new root-level config file is invisible to `lint` and `typecheck` until it is
added to `tsconfig.node.json`'s `include`.

`allowImportingTsExtensions` is on and imports carry explicit extensions (`./App.tsx`) — match that.
`verbatimModuleSyntax` and `erasableSyntaxOnly` are also on, so use `import type` for type-only
imports and avoid enums and parameter properties.

**`eslint.config.js`** is ESLint 10 flat config. `eslint-config-prettier` is last in every `extends`
so formatting is Prettier's job alone; don't add stylistic ESLint rules. Note the react-hooks config
path: `reactHooks.configs.flat['recommended-latest']`. The plugin also exports
`configs['recommended-latest']` at the top level, but that one is legacy eslintrc format and crashes
flat config with a `"plugins" key defined as an array of strings` error.

Prettier runs with `prettier-plugin-tailwindcss`, so `npm run format` reorders `className` strings.
