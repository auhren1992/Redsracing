/**
 * RedsRacing — site-wide AdSense auto-injection
 *
 * Why this file exists:
 *   AdSense Auto Ads is intentionally conservative and pulls ads on narrow or
 *   visually crowded layouts (the "shows at 90% zoom, gone at 100%" symptom).
 *   This module guarantees manual responsive ad units on content pages, so
 *   the site has consistent inventory regardless of Auto Ads heuristics.
 *
 * Behavior:
 *   - Runs only on public, content-heavy pages (deny-list below).
 *   - Loads the AdSense loader if a page doesn't already include it.
 *   - Injects up to 3 placements:
 *       top     -> immediately after the first <main> or first <section>
 *       mid     -> between two content sections roughly mid-page
 *       bottom  -> just before </main> (or appended to body)
 *   - Uses the 3 existing slot IDs and rotates them by position.
 *   - Skips pages where ads would violate AdSense policy (auth, settings,
 *     admin, dashboards, debug/test pages).
 */
(function () {
  'use strict';

  var CLIENT_ID = 'ca-pub-8879853783053353';

  // Map slot positions -> AdSense ad unit slot IDs.
  // Reusing the same slot across pages is allowed by AdSense; reporting is
  // aggregated per slot. Split into per-page slots later if you want
  // page-level revenue reporting.
  var SLOTS = {
    top:    '5606437088', // home-top
    mid:    '5582001910', // gallery-mid
    bottom: '5559775012'  // schedule-sidebar
  };

  // Pages we must NEVER place ads on (policy + UX).
  var DENY_PATHS = [
    'login.html',
    'signup.html',
    'profile.html',
    'settings.html',
    'fan-settings.html',
    'team-settings.html',
    'admin-console.html',
    'admin.html',
    'admin-setup.html',
    'admin-debug.html',
    'admin-role-test.html',
    'setup-admin.html',
    'simple-admin.html',
    'follower-dashboard.html',
    'redsracing-dashboard.html',
    'force-dashboard.html',
    'fan/dashboard.html',
    'crew/dashboard.html',
    'push-notifications.html',
    'live-race-admin.html',
    'migrate-schedule.html',
    'modern-auth-test.html',
    'test_auth_improvements.html',
    '404.html',
    'HEADER_TEMPLATE.html',
    'temp_nav.html',
    'mobile-test.html',
    'mobile-debug.html',
    'test.html'
  ];

  function isDeniedPath(pathname) {
    var p = (pathname || '').toLowerCase();
    // Strip query/hash and normalize trailing slash to home.
    p = p.split('?')[0].split('#')[0];
    if (p === '/' || p === '') return false;
    // Match against deny list
    for (var i = 0; i < DENY_PATHS.length; i++) {
      var d = DENY_PATHS[i].toLowerCase();
      // either ends with the file name or a sub-path that matches
      if (p === '/' + d) return true;
      if (p.lastIndexOf('/' + d) === p.length - d.length - 1) return true;
      if (p.indexOf('/' + d) !== -1) return true;
      // anything under /tests/ is a debug/test page
      if (p.indexOf('/tests/') !== -1) return true;
    }
    return false;
  }

  function ensureAdSenseLoader() {
    var existing = document.querySelector(
      'script[src*="pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"]'
    );
    if (existing) return;
    var s = document.createElement('script');
    s.async = true;
    s.src =
      'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' +
      CLIENT_ID;
    s.crossOrigin = 'anonymous';
    document.head.appendChild(s);
  }

  function createAdBlock(slotId, opts) {
    opts = opts || {};
    var wrapper = document.createElement('div');
    wrapper.className = 'rr-ad-slot';
    wrapper.setAttribute('data-rr-ad-slot', slotId);
    wrapper.style.cssText = [
      'position:relative',
      'z-index:10',
      'max-width:' + (opts.maxWidth || '970px'),
      'margin:' + (opts.margin || '1.5rem auto'),
      'padding:0 1rem',
      'min-height:' + (opts.minHeight || '120px'),
      'width:100%'
    ].join(';');

    var ins = document.createElement('ins');
    ins.className = 'adsbygoogle';
    ins.style.display = 'block';
    ins.setAttribute('data-ad-client', CLIENT_ID);
    ins.setAttribute('data-ad-slot', slotId);
    ins.setAttribute('data-ad-format', 'auto');
    ins.setAttribute('data-full-width-responsive', 'true');
    wrapper.appendChild(ins);

    return wrapper;
  }

  function pushAd(wrapper) {
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (e) {
      // AdSense will retry on next push. Failures are non-fatal.
    }
  }

  // Insert a wrapper into the DOM at the requested position and trigger the
  // adsbygoogle push so AdSense fills it.
  function inject(position, slotId) {
    if (!slotId) return false;

    // Don't add duplicate slots in the same position on this page.
    if (document.querySelector('[data-rr-ad-slot="' + slotId + '"]')) {
      return false;
    }

    var main = document.querySelector('main');
    var firstSection = main
      ? main.querySelector('section, article, div.container, div.section')
      : document.querySelector('section, article');
    var lastSection = main
      ? main.querySelectorAll('section, article, div.container, div.section')
      : document.querySelectorAll('section, article');
    var wrapper;

    if (position === 'top') {
      // Insert after the first major section (so ad is below the hero).
      var anchor = firstSection || main || document.body;
      wrapper = createAdBlock(slotId);
      if (anchor.parentNode) {
        anchor.parentNode.insertBefore(wrapper, anchor.nextSibling);
      } else {
        anchor.appendChild(wrapper);
      }
    } else if (position === 'mid') {
      // Place roughly in the middle of the content sections.
      var sections = main
        ? main.querySelectorAll('section, article')
        : document.querySelectorAll('section, article');
      if (!sections.length || sections.length < 3) return false;
      var midIdx = Math.floor(sections.length / 2);
      var midAnchor = sections[midIdx];
      wrapper = createAdBlock(slotId);
      if (midAnchor && midAnchor.parentNode) {
        midAnchor.parentNode.insertBefore(wrapper, midAnchor);
      }
    } else if (position === 'bottom') {
      // Insert before the closing </main> or append to body.
      wrapper = createAdBlock(slotId);
      if (main) {
        main.appendChild(wrapper);
      } else {
        document.body.appendChild(wrapper);
      }
    }

    if (wrapper) {
      pushAd(wrapper);
      return true;
    }
    return false;
  }

  function shouldInjectMidAd() {
    var main = document.querySelector('main');
    var sections = main
      ? main.querySelectorAll('section, article')
      : document.querySelectorAll('section, article');
    // Only inject mid ad if page has lots of content (3+ sections).
    return sections.length >= 3;
  }

  function init() {
    if (isDeniedPath(location.pathname)) return;

    ensureAdSenseLoader();

    // Defer slightly so DOM is ready and AdSense loader has time to register.
    var run = function () {
      try {
        inject('top', SLOTS.top);
        if (shouldInjectMidAd()) {
          inject('mid', SLOTS.mid);
        }
        inject('bottom', SLOTS.bottom);
      } catch (e) {
        // Don't let ad injection break the page.
        if (window.console && console.warn) {
          console.warn('[ads-inject] failed:', e && e.message);
        }
      }
    };

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      // Run on next tick so any late layout adjustments settle first.
      setTimeout(run, 0);
    } else {
      document.addEventListener('DOMContentLoaded', run, { once: true });
    }
  }

  init();
})();
