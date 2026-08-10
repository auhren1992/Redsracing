# AGENTS.md

## Cursor Cloud specific instructions


### Codacy

- Project grade is weighted (issues + complexity + duplication + coverage). Large mirrored `android/**` / `ios/**` www bundles amplify finding counts.
- After opening or updating a PR, inspect **Codacy Static Code Analysis** check-run annotations. Prefer fixing canonical sources then `npm run sync:mobile` — do not hand-edit mirrored copies.
- Keep cyclomatic complexity of helpers under Codacy’s threshold (~8); split large HTML/JS handlers instead of growing them.

### Homepage Pulse + Next Race Hub

- Site Editor CMS was removed. Admin **Content → Homepage Pulse** (`#pulse`) writes `config/homepage_pulse` (banner, ticker, spotlight, race mode, gate/parking notes).
- Public consumers: `assets/js/homepage-pulse.js` (home), `next-race.html` + `assets/js/next-race-hub.js` (hub), schedule weather via `assets/js/race-weather.js` (Open-Meteo, no API key).
- After changing those files: `npm run sync:mobile` then `npm run deploy:hosting`.

### Native app WebView nav (Android / iOS)

- Hosted pages load inside the app WebView (`https://www.redsracing.org/...`). Native bottom nav owns destinations — **do not** install browser hamburger / `#mobile-menu-tabs` in that shell.
- Homepage `.home-mobile-bar` (Next Race / Schedule / Gallery / Login pills) is **web-only**. `styles/mobile-app.css` and Android `hideNavJS` must keep it hidden in-app.
- `mobile-menu-tabs.js` must short-circuit when `__RR_NATIVE_APP__`, `html.rr-native-app`, `body.mobile-app`, `RedsRacingApp/` UA, or Android bridges are present.
- Android `MainActivity` sets `__RR_NATIVE_APP__='android'` via document-start JS (same idea as LoginActivity / iOS).
- Admin console keeps its own UI (`#admin-menu-bar` + Command Center drawer) inside the app.


### Mobile web nav (browser, not native app)

- Many pages load **both** classic `#mobile-menu` (accordion) and tabbed `#mobile-menu-tabs` (`assets/js/mobile-menu-tabs.js`). Only one must own the hamburger.
- When tabs script is present, `window.__rrMobileTabsMenu` / `html.rr-has-mobile-tabs` is set and classic drawer stays `display:none`. Do not re-bind `#mobile-menu-button` to open classic.
- **Hamburger stays on the LEFT** of the sticky header on mobile/tablet web (`styles/mobile-web.css` applies through **1023.98px**, plus `normalizeMobileHeader()` in `navigation.js`). Do not put auth pills / clocks before it or use `justify-between` with 3 visible children (that centers the button).
- Through tablet widths, desktop `md:flex` / `lg:flex` nav clusters stay forced hidden so the header does not overflow horizontally.
- Desktop `.dropdown-menu` panels are forced hidden under `styles/mobile-web.css` at mobile widths; do not “fix” by toggling inline `display:block` on phones.
- Auth debug toast `#auth-debug-status` is opt-in only (`?rr_debug=1` or `localStorage.rr_debug=1`). It overlaps the tab row if re-enabled unconditionally.
- Open menu sets `html.rr-mobile-menu-open` so cookie/lang/ad overlays stay hidden while the drawer is open.

### Admin console (mobile web)

- Do **not** show a pill/chip section strip on the main admin page. Section access on phones is via the header hamburger (left) → `#admin-sidebar` Command Center drawer (`toggleAdminDrawer`).
- `#admin-top-auth` is desktop-only (`hidden md:flex`); never remove `hidden` without keeping `md:flex` or the hamburger shifts to the middle.
- Mobile exit to the public site: header `#admin-mobile-home`, drawer “Back to home” (`#admin-drawer-home` + Site nav), and brand link → `index.html`. Keep at least one of these on phones (desktop already has the header “Home” link).
- Native app uses `#admin-menu-bar` (+ `#admin-menu-bar-home`) and the same `#admin-sidebar` drawer.
- After admin-console / nav CSS/JS changes: `npm run sync:mobile`, then typically `npm run deploy:hosting`.
- Standard commands: see root `package.json` scripts (`sync:mobile`, `deploy:hosting`).
