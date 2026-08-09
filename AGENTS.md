# AGENTS.md

## Cursor Cloud specific instructions

This repo is a monorepo for **RedsRacing #8** (Firebase project `redsracing-a7f8b`). The core
product is a static, multi-page PWA website (root `*.html` + `assets/js/*.js` + `styles/*.css`)
served by Firebase Hosting, plus two Cloud Functions backends: Node 20 (`functions/`) and
Python 3.12 (`functions_python/`). Mobile apps (`android/`, `ios/`), the Go stub
(`services/speedhive-go-service/`) and the PHP `cms/` are auxiliary/optional. Ignore
`android/app/src/main/assets/**` — it is a bundled duplicate of the whole repo.

The startup update script already installs deps: root `npm install`, `functions/` `npm install`,
and a Python venv at `functions_python/venv` with `functions_python/requirements.txt`.
Prefer `npm install` over `npm ci` — the root lockfile can disagree with the `uuid` override in
`package.json`, so `npm ci` may fail. Python tests need `python3.12-venv` on the base image
(`sudo apt-get install -y python3.12-venv` once if `python3 -m venv` fails with ensurepip missing).
Create the venv with `--copies` (`python3 -m venv functions_python/venv --copies`) so
`venv/bin/python` survives environment snapshots (symlink-only venvs often lose `bin/` after boot).
If `functions_python/venv/bin/python` is missing, delete `functions_python/venv` and recreate it.

### Node version gotcha (Cloud Agent VMs)
- Cloud Functions declare Node **20** (`functions/package.json` engines). Prefer Node 20 via nvm.
- On Cloud Agent VMs, `/exec-daemon/node` (often Node 22) can shadow nvm on `PATH`. Before
  functions work or version-sensitive installs, run:
  `export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 20; export PATH="$(dirname "$(nvm which 20)"):$PATH"`.

### Running the website (the core product)
- `npx firebase emulators:start --only hosting` serves the site at `http://127.0.0.1:5000`.
  `firebase-tools` is a root devDependency, so no global install is needed.
- Expected/harmless on startup: `You are not currently authenticated`, a `MetadataLookupWarning`
  (GCE metadata probe), and `Could not fetch web app configuration`. Hosting-only serving does
  not need `firebase login` or Java.
- The browser client uses hardcoded config in `assets/js/firebase-config.js`, so **Auth/Firestore
  against the live project work from localhost** when the user signs in (no Hosting emulator
  auth mock required). Admin deploy / Admin SDK scripts still need a valid service-account JSON.

### Build caveat (important, non-obvious)
- `npm run build` (webpack) and `npm run build-css` / `build-css-prod` (Tailwind) CANNOT complete
  in a fresh clone: `src/` and `dist/` are gitignored, so the Tailwind source `src/input.css` and
  the webpack entry `assets/js/follower-dashboard.js` are absent. This is expected repo state.
- You do NOT need to build to run the site: HTML loads JS directly from `assets/js/*.js` and CSS
  from the committed `styles/tailwind.css` (the webpack `dist/` output is not referenced by pages,
  except `live.html`). Do not try to "fix" the build by adding these missing source files.

### Cloud Functions
- Node: `cd functions && npm run serve` (`firebase emulators:start --only functions`). The full
  functions emulator needs Java (OpenJDK is present on the VM).
- Python: functions live in `functions_python/` (codebase `python-api`) and use the venv above.

### Tests
- Canonical suite (mocked, no network):
  `functions_python/venv/bin/python -m unittest tests.test_profile_endpoints -v` (13 tests, all pass).
- `test_new_features.py` is a standalone self-check that passes.
- `test_404_fix.py` FAILS on a pre-existing stale reference (`main.get_mailgun_client` was removed);
  this is not an environment problem. `test_sentry.py` actually emits events to Sentry — avoid unless intended.

### Lint
- `npm run lint:firebase-imports` runs `scripts/validate_firebase_imports.js`. It prints a
  "Bare Firebase imports detected" warning for `assets/js/main.js` but exits 0 (non-blocking).
- ESLint/Stylelint configs exist (`.eslintrc.json`, `.stylelintrc.json`) but no lint script/binary
  is wired up in `package.json`.
