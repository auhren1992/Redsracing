/**
 * Site-wide user preferences (localStorage `rr_settings`).
 * Applied on every page that loads this script; settings.html writes through it.
 */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'rr_settings';
  var THEME_PREF_KEY = 'rr_theme_pref';
  var THEME_KEY = 'rr_theme';

  var DEFAULTS = {
    notifRace: true,
    notifNewsletter: true,
    notifSocial: false,
    notifAdmin: true,
    theme: 'auto',
    reduceMotion: false,
    favoriteDriver: '',
    defaultLanding: 'countdown',
    compactSchedule: false,
    showStartTimes: true,
    largerTapTargets: false,
    updatedAt: null
  };

  function safeParse(raw) {
    try {
      return raw ? JSON.parse(raw) : {};
    } catch (_) {
      return {};
    }
  }

  function read() {
    var stored = safeParse(localStorage.getItem(STORAGE_KEY));
    return Object.assign({}, DEFAULTS, stored);
  }

  function write(partial) {
    var next = Object.assign({}, read(), partial || {}, {
      updatedAt: new Date().toISOString()
    });
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (_) {}
    apply(next);
    try {
      global.dispatchEvent(new CustomEvent('rr-settings-changed', { detail: next }));
    } catch (_) {}
    return next;
  }

  function resolveTheme(pref) {
    if (pref === 'light' || pref === 'dark') return pref;
    try {
      if (global.matchMedia && global.matchMedia('(prefers-color-scheme: light)').matches) {
        return 'light';
      }
    } catch (_) {}
    return 'dark';
  }

  function applyTheme(pref) {
    var choice = pref === 'light' || pref === 'dark' || pref === 'auto' ? pref : 'auto';
    var resolved = resolveTheme(choice);
    try {
      localStorage.setItem(THEME_PREF_KEY, choice);
    } catch (_) {}
    try {
      if (global.__rrTheme && typeof global.__rrTheme.set === 'function') {
        global.__rrTheme.set(resolved);
      } else {
        document.documentElement.dataset.theme = resolved;
        localStorage.setItem(THEME_KEY, resolved);
      }
    } catch (_) {
      document.documentElement.dataset.theme = resolved;
    }
    // Keep legacy class for a few pages that still check .dark
    try {
      document.documentElement.classList.toggle('dark', resolved === 'dark');
    } catch (_) {}
  }

  function applyReduceMotion(on) {
    try {
      if (on) {
        document.documentElement.setAttribute('data-reduce-motion', '1');
      } else {
        document.documentElement.removeAttribute('data-reduce-motion');
      }
    } catch (_) {}
  }

  function applyFavoriteDriver(driver) {
    try {
      if (driver) {
        document.documentElement.setAttribute('data-favorite-driver', driver);
      } else {
        document.documentElement.removeAttribute('data-favorite-driver');
      }
    } catch (_) {}
  }

  function applyCompactSchedule(on) {
    try {
      document.documentElement.classList.toggle('rr-compact-schedule', !!on);
    } catch (_) {}
  }

  function applyLargerTapTargets(on) {
    try {
      document.documentElement.classList.toggle('rr-large-tap', !!on);
    } catch (_) {}
  }

  function applyShowStartTimes(on) {
    try {
      document.documentElement.classList.toggle('rr-hide-start-times', on === false);
    } catch (_) {}
  }

  function apply(settings) {
    var s = settings || read();
    applyTheme(s.theme || 'auto');
    applyReduceMotion(!!s.reduceMotion);
    applyFavoriteDriver(s.favoriteDriver || '');
    applyCompactSchedule(!!s.compactSchedule);
    applyLargerTapTargets(!!s.largerTapTargets);
    applyShowStartTimes(s.showStartTimes !== false);
  }

  function getDefaultLandingHref() {
    var s = read();
    switch (s.defaultLanding) {
      case 'team':
        return 'team.html';
      case 'next-race':
        return 'next-race.html';
      case 'schedule':
        return 'schedule.html';
      case 'countdown':
      default:
        return 'index.html';
    }
  }

  // Listen for system theme changes when pref is auto
  try {
    if (global.matchMedia) {
      global.matchMedia('(prefers-color-scheme: light)').addEventListener('change', function () {
        var s = read();
        if ((s.theme || 'auto') === 'auto') applyTheme('auto');
      });
    }
  } catch (_) {}

  global.RRUserSettings = {
    DEFAULTS: DEFAULTS,
    read: read,
    write: write,
    apply: apply,
    applyTheme: applyTheme,
    getDefaultLandingHref: getDefaultLandingHref
  };

  // Apply as early as possible so first paint matches prefs
  try {
    apply(read());
  } catch (_) {}
})(typeof window !== 'undefined' ? window : globalThis);
