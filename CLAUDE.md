# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Vite dev server on http://localhost:5173
npm run build        # tsc -b && vite build  → dist/
npm run preview      # serve the built dist/ locally
npm run lint         # eslint .
npm run format       # prettier --write .
npm test             # vitest run (single pass, no watch)
npm run typecheck    # tsc -b --noEmit
```

Narrower test runs (no npm script — invoke Vitest directly):

```bash
npx vitest run src/components/Counter.test.tsx   # one file
npx vitest run -t "increments on click"          # one test by name
npx vitest                                       # watch mode
npx vitest run --coverage                        # v8 coverage → coverage/
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
Components live in `src/components/`, each with a colocated `*.test.tsx`. There is no router, state
manager, or data layer yet — this is a fresh scaffold, so pick those when the need appears rather
than assuming one is already in place.

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
