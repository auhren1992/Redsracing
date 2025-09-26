# Development Guidelines

This document summarizes the architectural issues that accumulated in the project and outlines the development workflow we should follow to avoid repeating those mistakes.

## What Went Wrong

### Inconsistent build outputs
- Some HTML files load scripts with `<script type="module" src="dist/main.js"></script>` while others use `<script type="module" src="main.js"></script>`.
- Because Firebase Hosting serves the `dist/` directory, `dist/main.js` becomes `dist/dist/main.js`, which results in missing files when the wrong path is used.
- The mismatch started when we introduced Webpack without updating every HTML page to use the built asset paths.

### Mixed development approaches
- Legacy scripts import local modules directly (for example `import './app.js';`).
- Newer code expects Webpack to rewrite imports (for example `import { getFirebaseAuth } from '/assets/js/firebase-core.js';`).
- Without a single source of truth, developers copied whichever style already worked in the file they were editing, amplifying the inconsistency.

### Incomplete Webpack configuration
- Only the `main` entry is defined in `webpack.config.js`; additional pages (signup, leaderboard, team-members, etc.) never received their own entries.
- When HTML pages reference `dist/<page>.js`, Webpack does not actually produce those files, leading to runtime errors that were patched locally with inline scripts.

### Hosting configuration mismatch
- Firebase is configured to serve the built `dist/` directory.
- Pages that load scripts from `dist/` end up requesting `dist/dist/*.js`; pages that try to load source files bypass the build step entirely.

### Technical debt pattern
1. **Phase 1 – Static site:** Everything lived next to the HTML files and worked.
2. **Phase 2 – Build pipeline:** Webpack was added, but HTML references were not updated.
3. **Phase 3 – Feature additions:** New JavaScript files bypassed the build process and were referenced directly from HTML.
4. **Phase 4 – Band-aids:** Inline fallback scripts and defensive imports masked the underlying inconsistency without fixing it.

## The Path Forward

### Directory conventions
- Keep source JavaScript in `assets/js/`.
- Produce bundled files into `dist/` via Webpack.
- HTML pages must only reference the bundled files **without** a `dist/` prefix (Firebase already serves from `dist/`).

### Development workflow
1. Edit source files in `assets/js/`.
2. Add a new Webpack entry when introducing a new page bundle.
3. Run `npm run build` to emit bundles into `dist/`.
4. Test locally using the built files in `dist/`.
5. Deploy the contents of `dist/` to Firebase.

### Team practices
- Document new modules and update this guide whenever the directory structure changes.
- Avoid editing files directly in `dist/`; treat them as build outputs only.
- Remove temporary fallback scripts after proper bundles exist.
- Review pull requests for consistent import paths and Webpack entries.

Following these guidelines will prevent the "double dist" problem, keep the build pipeline reliable, and reduce the chance of quick fixes accumulating into technical debt again.
