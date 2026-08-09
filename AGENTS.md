# AGENTS.md

## Cursor Cloud specific instructions

### Mobile web nav (browser, not native app)

- Many pages load **both** classic `#mobile-menu` (accordion) and tabbed `#mobile-menu-tabs` (`assets/js/mobile-menu-tabs.js`). Only one must own the hamburger.
- When tabs script is present, `window.__rrMobileTabsMenu` / `html.rr-has-mobile-tabs` is set and classic drawer stays `display:none`. Do not re-bind `#mobile-menu-button` to open classic.
- Desktop `.dropdown-menu` panels are forced hidden under `styles/mobile-web.css` at mobile widths; do not “fix” by toggling inline `display:block` on phones.
- Auth debug toast `#auth-debug-status` is opt-in only (`?rr_debug=1` or `localStorage.rr_debug=1`). It overlaps the tab row if re-enabled unconditionally.
- Open menu sets `html.rr-mobile-menu-open` so cookie/lang/ad overlays stay hidden while the drawer is open.

### Admin console (mobile web)

- Section chips live in `#admin-mobile-section-nav` (md:hidden). Native app hides that strip and uses `#admin-menu-bar` + `#admin-sidebar` drawer instead.
- On phone browsers, `#mobile-menu-button` opens the Command Center `#admin-sidebar` drawer (`toggleAdminDrawer`), not a site nav menu.
- After admin-console / nav CSS/JS changes: `npm run sync:mobile`, then typically `npm run deploy:hosting`.
- Standard commands: see root `package.json` scripts (`sync:mobile`, `deploy:hosting`).
