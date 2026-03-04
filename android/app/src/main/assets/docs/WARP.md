# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

Project overview

- Static frontend built with Tailwind CSS and bundled via Webpack into dist/ for Firebase Hosting
- Two Firebase Functions codebases:
  - Node (functions/) for callable and storage-triggered functions
  - Python (functions_python/) for HTTP endpoints used via Hosting rewrites
- Firebase Hosting serves dist/ and rewrites specific paths to Python HTTP functions

Common commands

- Install dependencies (root)
  - npm ci
- Install dependencies (Node functions)
  - In functions/: npm ci
- Build CSS
  - Dev (watch): npm run build-css
  - Prod: npm run build-css-prod
- Build site (Webpack to dist/)
  - npm run build
  - Note: Ensure styles/tailwind.css is up to date (run a CSS build first) so Webpack copies the latest to dist/.
- Local static preview of tests (serves the repo root so tests/_.html can import ../assets/_ modules)
  - npx http-server . -p 3000
    - Then open http://localhost:3000/tests/test_login.html (example single test)
- Firebase emulators
  - Hosting only (serves dist/): firebase emulators:start --only hosting
  - Node Functions emulator (from functions/): npm run serve
    - Note: Hosting rewrites point to Python Functions; local emulator behavior for the Python runtime may differ from deployed behavior.
- Deploy (be mindful of which codebase)
  - Hosting (build runs automatically via predeploy): firebase deploy --only hosting
  - Node Functions: firebase deploy --only functions
  - Python Functions: firebase deploy --only functions:python-api
- Linting
  - No linter is configured in this repo (no eslint/prettier configs present at the root or in functions/).

High-level architecture

- Frontend (root)
  - Tooling
    - Tailwind CSS CLI scans "./\*.html" (tailwind.config.js) and outputs styles/tailwind.css
    - Webpack bundles multiple entry points from assets/js/\*.js into dist/ and copies static assets and HTML via copy-webpack-plugin
  - Notable entry points (webpack.config.js)
    - main, router, redsracing-dashboard, follower-dashboard, follower-login, auth-guard, feedback, gallery, jonny, leaderboard, login-page, navigation, profile, qna, schedule, signup-page, sponsorship, videos
  - Firebase client usage
    - Configuration in assets/js/firebase-config.js
    - Centralized initialization/singletons in assets/js/firebase-core.js
    - Authentication utilities and role claim checks in assets/js/auth-utils.js
    - Router and auth-guard modules drive role-based page routing (e.g., team-member vs TeamRedFollower)
    - Invitation code capture and processing via Cloud Functions callable (processInvitationCode)
    - Network guards for safeFetch/URL validation in assets/js/network-guards.js
  - HTML
    - Static pages at repo root (e.g., index.html, profile.html, ...). During build, HTML is copied into dist/ and expects the matching JS bundle names.
    - Tests are HTML scenarios under tests/ that import modules from ../assets; they are not copied into dist/ by Webpack and should be served from the repo root when running locally.
- Firebase Hosting (firebase.json)
  - public: dist
  - headers: long cache-control for js/css; Document-Policy: js-profiling
  - rewrites: routes like /leaderboard, /profile/\*\*, /add_subscriber, etc. map to functions in the python-api codebase
  - predeploy: npm install && npm run build at repository root
- Cloud Functions (Node, functions/)
  - Runtime: nodejs20 (engines.node: "20")
  - index.js exports
    - processInvitationCode (onCall): validates an invitation code, assigns custom claims (role), marks code used, writes a default achievement, and updates users/<uid>
    - generateTags (onObjectFinalized): for images in gallery/; uses @google-cloud/vision to label images; writes tags and compact visionLabels to gallery_images doc; robust matching for both googleapis and firebasestorage.app download URLs
    - getProfile (onCall): fetches users/<uid>
    - updateProfile (onCall): merge-writes profile fields to users/<uid> for the authenticated user
    - getInvitationCodes (onCall): team-member-only; lists invitation_codes
  - Scripts (functions/package.json): serve (emulators), shell, start, deploy, logs
- Cloud Functions (Python, functions_python/)
  - Exposed via Hosting rewrites (firebase.json) under codebase "python-api"
  - Requirements: firebase-functions, firebase-admin, flask, sendgrid, google-cloud-firestore
  - Endpoints (from rewrites): e.g., /add_subscriber, /send_feedback_email, /send_sponsorship_email, /auth_action, /password_reset, /profile/**, /update_profile/**, /achievements, /leaderboard, /auto_award_achievement, /achievement_progress/\*\*, /assign_achievement

Notes specific to this repo

- Build order: when changing Tailwind styles, run a CSS build (e.g., npm run build-css-prod) before npm run build so dist/ contains the latest CSS copied by Webpack.
- Tests are manual HTML scenarios under tests/. Serve the repo root (not just dist/) so module imports like ../assets/js/\* resolve; then open a specific test page to run a single test.
- Functions codebases: Node functions can be emulated via npm run serve in functions/. The Python functions are invoked via Hosting rewrites; emulator behavior may not fully match deployed behavior depending on local tooling.
- Node versions: the frontend README mentions Node 14+, but the Cloud Functions codebase requires Node 20. Use Node 20 for any functions-related development.
