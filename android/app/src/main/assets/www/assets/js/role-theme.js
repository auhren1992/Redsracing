/**
 * RedsRacing Role Theme System
 * Loads on every page. Detects user role and applies theme colors + role-specific nav.
 * Caches role in localStorage for instant theme on page load.
 */
(function() {
  'use strict';

  const THEMES = {
    fan: {
      label: 'Racing Fan',
      icon: '🏁',
      faIcon: 'fa-flag-checkered',
      accent: '#fbbf24',
      accentLight: '#fde047',
      accentDark: '#f59e0b',
      gradient1: '#fbbf24',
      gradient2: '#3b82f6',
      bodyClass: 'theme-fan',
    },
    racer: {
      label: 'Racer',
      icon: '🏎️',
      faIcon: 'fa-car-side',
      accent: '#f97316',
      accentLight: '#fb923c',
      accentDark: '#ea580c',
      gradient1: '#ef4444',
      gradient2: '#f97316',
      bodyClass: 'theme-racer',
    },
    crew: {
      label: 'Crew Member',
      icon: '🔧',
      faIcon: 'fa-wrench',
      accent: '#06b6d4',
      accentLight: '#22d3ee',
      accentDark: '#0891b2',
      gradient1: '#0ea5e9',
      gradient2: '#06b6d4',
      bodyClass: 'theme-crew',
    }
  };

  function getStoredRole() {
    try { return localStorage.getItem('rr_signup_role') || 'fan'; } catch(_) { return 'fan'; }
  }

  function applyTheme(role) {
    const t = THEMES[role] || THEMES.fan;
    const root = document.documentElement;
    root.style.setProperty('--rr-accent', t.accent);
    root.style.setProperty('--rr-accent-light', t.accentLight);
    root.style.setProperty('--rr-accent-dark', t.accentDark);
    root.style.setProperty('--rr-accent-dim', t.accent + '26'); // ~15% opacity
    root.style.setProperty('--rr-accent-mid', t.accent + '66'); // ~40% opacity
    root.style.setProperty('--rr-accent-bg', t.accent + '0d'); // ~5% opacity
    document.body.classList.remove('theme-fan', 'theme-racer', 'theme-crew');
    document.body.classList.add(t.bodyClass);
    // Update any role badge on the page
    document.querySelectorAll('.rr-role-badge').forEach(function(el) {
      el.innerHTML = '<i class="fas ' + t.faIcon + '"></i> ' + t.label;
    });
  }

  // Apply immediately from cache for no-flash
  applyTheme(getStoredRole());

  // After Firebase loads, verify from Firestore and update if needed
  window._rrApplyRoleTheme = function(signupRole) {
    try { localStorage.setItem('rr_signup_role', signupRole); } catch(_) {}
    applyTheme(signupRole);
  };

  // Expose for other scripts
  window._rrGetTheme = function() { return THEMES[getStoredRole()] || THEMES.fan; };
  window._rrThemes = THEMES;
})();
