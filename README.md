# aqua-check

Check a waste-water sample against configurable discharge limits.

Enter a sample ID, a sample name and a sampling date, then one reading per configured measure.
The report states whether the sample passes, and for every measure outside its approved bounds it
shows the treatment required. The rule set lives in `src/config/configuration.json` — adding or
changing a measure is a plain JSON edit.

The same code ships as a web app and as a portable Windows desktop app.

## Development

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # vitest, single pass
npm run lint
```

## Deployment (GitHub Pages)

The live site is **https://supundhananjaya.github.io/aqua-check/**.

`.github/workflows/deploy.yml` lints, tests, builds and publishes on every push to `main`, so a
redeploy is just a merge. It can also be run by hand from the **Actions** tab
(**Deploy to GitHub Pages** → **Run workflow**).

One-time setup, needed once per repository:

1. Go to **Settings → Pages**.
2. Under **Build and deployment**, set **Source** to **GitHub Actions**. There is no branch or
   folder to pick.
3. Push to `main` — or trigger the workflow manually — and watch the run under **Actions**. The
   deploy job prints the live URL when it finishes.

Because Pages serves the site from the `/aqua-check/` sub-path, the deployed build uses
`npm run build:pages`, which sets the Vite `base`. Use that script, not `npm run build`, for any
manual Pages build; to preview it locally:

```bash
npm run build:pages
npm run preview:pages    # http://localhost:4173/aqua-check/
```

The limits are bundled at build time on the web, so changing `configuration.json` means a push and
a redeploy. The desktop build instead reads `configuration.json` from beside the executable.

## Desktop build

```bash
npm run electron:dev     # dev server in an Electron window
npm run electron:build   # → release/aqua-check-<version>-portable.exe
```
