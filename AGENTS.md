# AGENTS.md

## Cursor Cloud specific instructions

### Codacy

- After opening or updating a PR, always inspect **Codacy Static Code Analysis** check-run annotations (`gh api repos/<owner>/<repo>/check-runs/<id>/annotations`). Mobile sync duplicates files under `android/**` and `ios/**`, so one root fix often maps to many mirrored Codacy findings.
- Prefer fixing canonical sources (`navigation.js`, `styles/mobile-web.css`, `admin-console.html`, …) then `npm run sync:mobile` — do not hand-edit mirrored copies.

### Mobile web nav (browser, not native app)

- Many pages load **both** classic `#mobile-menu` (accordion) and tabbed `#mobile-menu-tabs` (`assets/js/mobile-menu-tabs.js`). Only one must own the hamburger.
- When tabs script is present, `window.__rrMobileTabsMenu` / `html.rr-has-mobile-tabs` is set and classic drawer stays `display:none`. Do not re-bind `#mobile-menu-button` to open classic.
- **Hamburger stays on the LEFT** of the sticky header on mobile web (`styles/mobile-web.css` + `normalizeMobileHeader()` in `navigation.js`). Do not put auth pills / clocks before it or use `justify-between` with 3 visible children (that centers the button).
- Desktop `.dropdown-menu` panels are forced hidden under `styles/mobile-web.css` at mobile widths; do not “fix” by toggling inline `display:block` on phones.
- Auth debug toast `#auth-debug-status` is opt-in only (`?rr_debug=1` or `localStorage.rr_debug=1`). It overlaps the tab row if re-enabled unconditionally.
- Open menu sets `html.rr-mobile-menu-open` so cookie/lang/ad overlays stay hidden while the drawer is open.

### Admin console (mobile web)

- Do **not** show a pill/chip section strip on the main admin page. Section access on phones is via the header hamburger (left) → `#admin-sidebar` Command Center drawer (`toggleAdminDrawer`).
- `#admin-top-auth` is desktop-only (`hidden md:flex`); never remove `hidden` without keeping `md:flex` or the hamburger shifts to the middle.
- Native app uses `#admin-menu-bar` + the same `#admin-sidebar` drawer.
- After admin-console / nav CSS/JS changes: `npm run sync:mobile`, then typically `npm run deploy:hosting`.
- Standard commands: see root `package.json` scripts (`sync:mobile`, `deploy:hosting`).
