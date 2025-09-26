# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

Project summary
- Static frontend built with Tailwind CSS and bundled via Webpack into dist/ for Firebase Hosting.
- Backend is Firebase Cloud Functions split across two codebases:
  - default (Node.js 20) in functions/ with callable functions and a Cloud Storage trigger.
  - python-api (Python 3.12) in functions_python/ exposed via Hosting rewrites for REST-like endpoints.
- Hosting configuration lives in firebase.json and serves dist/ with long-lived caching for JS/CSS.

Core commands
- Frontend (run from repository root)
  - Install deps
    ```powershell path=null start=null
    npm install
    ```
  - Build Tailwind CSS (watch, for local development)
    ```powershell path=null start=null
    npm run build-css
    ```
  - Build Tailwind CSS (production)
    ```powershell path=null start=null
    npm run build-css-prod
    ```
  - Bundle JS and assemble dist/ via Webpack
    ```powershell path=null start=null
    npm run build
    ```
  - Note: The Hosting predeploy runs npm install && npm run build. It does not build Tailwind. Run npm run build-css-prod before deploying so styles/tailwind.css is up to date.

- Firebase Hosting (from repository root)
  - Deploy hosting to the configured target (see .firebaserc)
    ```powershell path=null start=null
    firebase deploy --only hosting:production
    ```
  - Deploy everything (Hosting + both Functions codebases)
    ```powershell path=null start=null
    firebase deploy
    ```

- Cloud Functions: Node (default codebase in functions/)
  - Emulate locally (Functions emulator only)
    ```powershell path=null start=null
    npm --prefix functions run serve
    ```
  - Interactive functions shell
    ```powershell path=null start=null
    npm --prefix functions run shell
    ```
  - Deploy Node functions only
    ```powershell path=null start=null
    firebase deploy --only functions:default
    ```

- Cloud Functions: Python (python-api in functions_python/)
  - Dependencies are declared in functions_python/requirements.txt. Deployment is handled by Firebase CLI via firebase.json codebase configuration.
  - Deploy Python functions only
    ```powershell path=null start=null
    firebase deploy --only functions:python-api
    ```

- Logs (Node functions)
  ```powershell path=null start=null
  npm --prefix functions run logs
  ```

Testing and linting
- Automated tests: No test runner or npm test script is configured.
- Manual HTML test pages exist under tests/ for exercising flows in a browser. These are not included in dist/ by Webpack.
- Linting: No linter configuration is present.

High-level architecture
- Frontend
  - Webpack multi-entry bundles defined in webpack.config.js produce page-specific JS files in dist/ (e.g., main.js, router.js, redsracing-dashboard.js, etc.). CopyWebpackPlugin copies root HTML, styles/, and static assets into dist/.
  - Tailwind configuration (tailwind.config.js) scans ./*.html for class usage. Source CSS lives at src/input.css; build outputs to styles/tailwind.css. Additional custom styles are in styles/main.css.
  - HTML pages at the repo root (e.g., index.html, dashboard.html, profile.html) reference the corresponding bundles produced by Webpack.

- Firebase Hosting (firebase.json)
  - public: dist/ (static site output). Predeploy step installs deps and runs the Webpack build.
  - rewrites map selected paths to Python functions in the python-api codebase (e.g., /add_subscriber, /profile/**, /leaderboard, etc.). Long-lived cache headers are applied to JS/CSS.

- Cloud Functions (functions/ - Node.js 20; default codebase)
  - Callable HTTPS functions for auth-protected operations, including:
    - processInvitationCode: validates invitation codes, assigns custom claims, marks usage, updates user profile, and awards a default achievement.
    - getProfile: returns public profile data for a given userId (auth required).
    - updateProfile: updates the caller’s own profile (auth and ownership enforced).
  - Storage-triggered function generateTags: on image finalize under gallery/, runs Vision label detection and updates the associated Firestore document with tags and compact visionLabels.
  - Uses firebase-admin (Auth, Firestore, Storage) and @google-cloud/vision; bucket and project settings are tied to the configured Firebase project.

- Cloud Functions (functions_python/ - Python 3.12; python-api codebase)
  - Requirements in requirements.txt include firebase-functions, firebase-admin, flask, sendgrid, and google-cloud-firestore.
  - Exposed via Hosting rewrites for endpoints like /add_subscriber, /send_feedback_email, /profile/**, /leaderboard, and others.

Repository cues and conventions
- Root package.json contains only build-related scripts (Tailwind watch/prod and Webpack). There’s no dev server script; previewing dist/ requires your own static server if desired.
- .firebaserc defines the default project (redsracing-a7f8b) and the hosting target alias production.
- Ensure CSS is built before packaging or deployment; Webpack copies styles/ as-is into dist/.
