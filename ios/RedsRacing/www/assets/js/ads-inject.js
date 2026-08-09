/**
 * RedsRacing — premium AdSense inventory (revamp)
 *
 * Goals:
 *   - Fewer, better placements (not spammy stacks)
 *   - No duplicate units when pages already have manual .rr-ad-slot markup
 *   - Skip auth / legal / live / sales / native-app surfaces
 *   - Respect cookie consent (rejected => no ads)
 *   - Prefer explicit anchors: <div data-rr-ad-anchor="mid"></div>
 *   - Cap density: 1 on narrow viewports, 2 on desktop content pages
 */
(function () {
  'use strict';

  var CLIENT_ID = 'ca-pub-8879853783053353';

  var SLOTS = {
    top: '5606437088',    // home-top
    mid: '5582001910',    // gallery-mid
    bottom: '5559775012'  // schedule / footer rail
  };

  // Pages that must never show AdSense (policy + trust + UX).
  var DENY_PATHS = [
    'login.html', 'signup.html', 'follower-login.html',
    'profile.html', 'settings.html', 'fan-settings.html', 'team-settings.html',
    'admin-console.html', 'admin.html', 'admin-setup.html', 'admin-debug.html',
    'admin-role-test.html', 'setup-admin.html', 'simple-admin.html',
    'follower-dashboard.html', 'redsracing-dashboard.html', 'follower/index.html',
    'admin/index.html', 'force-dashboard.html',
    'fan/dashboard.html', 'crew/dashboard.html', 'racer/dashboard.html',
    'push-notifications.html', 'live-race-admin.html', 'migrate-schedule.html',
    'modern-auth-test.html', 'test_auth_improvements.html',
    '404.html', 'HEADER_TEMPLATE.html', 'temp_nav.html',
    'mobile-test.html', 'mobile-debug.html', 'test.html',
    // Trust / conversion / live UX
    'privacy.html', 'privacy-policy.html', 'terms.html',
    'live.html', 'passport.html',
    'sponsorship.html', 'contact.html', 'feedback.html'
  ];

  function normalizePath(pathname) {
    var p = (pathname || '').toLowerCase();
    return p.split('?')[0].split('#')[0];
  }

  function isRedsRacingNativeApp() {
    try {
      if (document.body && document.body.classList.contains('mobile-app')) return true;
    } catch (_) {}
    return /RedsRacingApp\//i.test(navigator.userAgent || '');
  }

  function pathMatchesDenied(p, denied) {
    var needle = '/' + denied;
    if (p === needle) return true;
    if (p.lastIndexOf(needle) === p.length - denied.length - 1) return true;
    return p.indexOf(needle) !== -1;
  }

  function isDeniedPath(pathname) {
    var p = normalizePath(pathname);
    if (p === '/' || p === '') return false;
    if (p.indexOf('/tests/') !== -1) return true;
    if (p.indexOf('/admin') !== -1) return true;
    for (var i = 0; i < DENY_PATHS.length; i++) {
      if (pathMatchesDenied(p, DENY_PATHS[i].toLowerCase())) return true;
    }
    return false;
  }

  function consentAllowsAds() {
    try {
      var c = localStorage.getItem('cookie_consent');
      if (c === 'rejected') return false;
      // accepted or unset: allow (banner defaults to continue-to-use consent)
      return true;
    } catch (_) {
      return true;
    }
  }

  function isNarrow() {
    try {
      return window.matchMedia && window.matchMedia('(max-width: 720px)').matches;
    } catch (_) {
      return (window.innerWidth || 0) < 720;
    }
  }

  function existingAdCount() {
    return document.querySelectorAll(
      '.rr-ad-slot, ins.adsbygoogle[data-ad-slot], [data-rr-ad-slot]'
    ).length;
  }

  function slotAlreadyPresent(slotId) {
    if (!slotId) return false;
    if (document.querySelector('[data-rr-ad-slot="' + slotId + '"]')) return true;
    if (document.querySelector('ins.adsbygoogle[data-ad-slot="' + slotId + '"]')) return true;
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

  function decorateManualSlots() {
    var nodes = document.querySelectorAll('.rr-ad-slot');
    for (var i = 0; i < nodes.length; i++) {
      polishSlot(nodes[i]);
    }
  }

  function polishSlot(wrapper) {
    if (!wrapper || wrapper.getAttribute('data-rr-ad-polished') === '1') return;
    wrapper.setAttribute('data-rr-ad-polished', '1');
    wrapper.classList.add('rr-ad-slot');

    var ins = wrapper.querySelector('ins.adsbygoogle');
    if (ins) {
      var sid = ins.getAttribute('data-ad-slot');
      if (sid && !wrapper.getAttribute('data-rr-ad-slot')) {
        wrapper.setAttribute('data-rr-ad-slot', sid);
      }
    }

    if (!wrapper.querySelector('.rr-ad-label')) {
      var label = document.createElement('div');
      label.className = 'rr-ad-label';
      label.textContent = 'Advertisement';
      wrapper.insertBefore(label, wrapper.firstChild);
    }

    // Collapse empty / unfilled units after a grace period
    setTimeout(function () {
      try {
        var unit = wrapper.querySelector('ins.adsbygoogle');
        if (!unit) return;
        var h = unit.offsetHeight || 0;
        var status = (unit.getAttribute('data-ad-status') || '').toLowerCase();
        if (status === 'unfilled' || h < 20) {
          wrapper.classList.add('rr-ad-empty');
        }
      } catch (_) {}
    }, 4500);
  }

  function createAdBlock(slotId, position) {
    var wrapper = document.createElement('div');
    wrapper.className = 'rr-ad-slot rr-ad-injected';
    wrapper.setAttribute('data-rr-ad-slot', slotId);
    wrapper.setAttribute('data-rr-ad-position', position || '');

    var label = document.createElement('div');
    label.className = 'rr-ad-label';
    label.textContent = 'Advertisement';
    wrapper.appendChild(label);

    var ins = document.createElement('ins');
    ins.className = 'adsbygoogle';
    ins.style.display = 'block';
    ins.setAttribute('data-ad-client', CLIENT_ID);
    ins.setAttribute('data-ad-slot', slotId);
    // Horizontal rail looks cleaner than unbounded auto on dark pages
    ins.setAttribute('data-ad-format', 'horizontal');
    ins.setAttribute('data-full-width-responsive', 'true');
    wrapper.appendChild(ins);

    polishSlot(wrapper);
    return wrapper;
  }

  function pushAd() {
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (_) {}
  }

  function getMain() {
    return document.querySelector('main');
  }

  function findExplicitAnchor(position) {
    return document.querySelector('[data-rr-ad-anchor="' + position + '"]');
  }

  function findTopAnchor() {
    var explicit = findExplicitAnchor('top');
    if (explicit) return explicit;
    var selectors = [
      'main > section, main > article',
      'body > section',
      'section.modern-hero, section.team-hero-min, #team-hero',
      'section, article'
    ];
    for (var i = 0; i < selectors.length; i++) {
      var el = document.querySelector(selectors[i]);
      if (el && el.parentNode) return el;
    }
    return null;
  }

  function getContentSections() {
    var main = getMain();
    var root = main || document.body;
    return root.querySelectorAll('section, article');
  }

  function injectAtAnchor(anchor, slotId, position, mode) {
    if (!anchor || !anchor.parentNode) return null;
    var wrapper = createAdBlock(slotId, position);
    if (mode === 'before') {
      anchor.parentNode.insertBefore(wrapper, anchor);
    } else if (mode === 'replace' || anchor.hasAttribute('data-rr-ad-anchor')) {
      // Empty marker anchors: replace the marker node
      if (anchor.hasAttribute('data-rr-ad-anchor') && !anchor.querySelector('ins')) {
        anchor.parentNode.replaceChild(wrapper, anchor);
      } else {
        anchor.parentNode.insertBefore(wrapper, anchor.nextSibling);
      }
    } else {
      anchor.parentNode.insertBefore(wrapper, anchor.nextSibling);
    }
    return wrapper;
  }

  function injectTop(slotId) {
    var explicit = findExplicitAnchor('top');
    if (explicit) return injectAtAnchor(explicit, slotId, 'top', 'replace');
    var anchor = findTopAnchor();
    if (!anchor) return null;
    // Never place above the first hero — insert after it
    return injectAtAnchor(anchor, slotId, 'top', 'after');
  }

  function injectMid(slotId) {
    var explicit = findExplicitAnchor('mid');
    if (explicit) return injectAtAnchor(explicit, slotId, 'mid', 'replace');
    var sections = getContentSections();
    if (!sections.length || sections.length < 3) return null;
    var midIdx = Math.min(Math.floor(sections.length / 2), sections.length - 1);
    var midAnchor = sections[midIdx];
    if (!midAnchor || !midAnchor.parentNode) return null;
    return injectAtAnchor(midAnchor, slotId, 'mid', 'before');
  }

  function injectBottom(slotId) {
    var explicit = findExplicitAnchor('bottom');
    if (explicit) return injectAtAnchor(explicit, slotId, 'bottom', 'replace');
    var footer = document.querySelector('footer');
    var wrapper = createAdBlock(slotId, 'bottom');
    if (footer && footer.parentNode) {
      footer.parentNode.insertBefore(wrapper, footer);
      return wrapper;
    }
    var main = getMain();
    if (main) {
      main.appendChild(wrapper);
      return wrapper;
    }
    document.body.appendChild(wrapper);
    return wrapper;
  }

  var INJECTORS = { top: injectTop, mid: injectMid, bottom: injectBottom };

  function inject(position, slotId) {
    if (!slotId) return false;
    if (slotAlreadyPresent(slotId)) return false;
    var injector = INJECTORS[position];
    if (!injector) return false;
    var wrapper = injector(slotId);
    if (!wrapper) return false;
    pushAd();
    return true;
  }

  function log() {
    if (window.console && console.info) {
      try { console.info.apply(console, arguments); } catch (_) {}
    }
  }

  function runPlacements() {
    decorateManualSlots();

    var already = existingAdCount();
    var maxAds = isNarrow() ? 1 : 2;
    if (already >= maxAds) {
      log('[ads-inject] manual inventory sufficient:', already);
      return { skipped: true, already: already };
    }

    var results = { top: false, mid: false, bottom: false };
    var placed = already;

    // Prefer mid (in-content) then bottom; top only if nothing else fits and page is long
    if (placed < maxAds && getContentSections().length >= 3) {
      results.mid = inject('mid', SLOTS.mid);
      if (results.mid) placed++;
    }
    if (placed < maxAds) {
      results.bottom = inject('bottom', SLOTS.bottom);
      if (results.bottom) placed++;
    }
    if (placed < maxAds && !isNarrow() && getContentSections().length >= 2) {
      results.top = inject('top', SLOTS.top);
      if (results.top) placed++;
    }

    log('[ads-inject] placements:', results, 'total~', placed);
    return results;
  }

  function init() {
    if (isRedsRacingNativeApp()) {
      log('[ads-inject] skipped (native app)');
      return;
    }
    if (isDeniedPath(location.pathname)) {
      log('[ads-inject] skipped (denied path):', location.pathname);
      return;
    }
    if (!consentAllowsAds()) {
      log('[ads-inject] skipped (cookie consent rejected)');
      return;
    }

    ensureAdSenseLoader();

    var run = function () {
      try { runPlacements(); } catch (e) {
        if (window.console && console.warn) console.warn('[ads-inject] failed:', e && e.message);
      }
    };

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      setTimeout(run, 50);
    } else {
      document.addEventListener('DOMContentLoaded', run, { once: true });
    }

    // If user accepts cookies later, reinject once
    try {
      window.addEventListener('storage', function (ev) {
        if (ev && ev.key === 'cookie_consent' && ev.newValue === 'accepted') {
          run();
        }
      });
    } catch (_) {}
  }

  // Expose tiny helper so cookie-consent can nudge a refresh after accept
  window.RR = window.RR || {};
  window.RR.refreshAds = function () {
    if (!consentAllowsAds() || isDeniedPath(location.pathname) || isRedsRacingNativeApp()) return;
    ensureAdSenseLoader();
    runPlacements();
  };

  init();
})();
