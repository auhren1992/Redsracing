/**
 * Mobile App Detector
 * Automatically loads mobile-optimized styles when app is detected
 */

(function() {
  'use strict';
  
  // Detect if running in Android WebView
  function isAndroidApp() {
    const ua = navigator.userAgent.toLowerCase();
    return (
      ua.indexOf('wv') > -1 || // WebView
      (window.location.protocol === 'https:' && window.location.host === 'appassets.androidplatform.net') ||
      typeof window.AndroidNotifications !== 'undefined' ||
      typeof window.AndroidAuth !== 'undefined' ||
      window.__RR_NATIVE_APP__ === 'android'
    );
  }

  /** iOS WKWebView sets a custom UA in ContentView.swift (e.g. RedsRacingApp/1.0 iOS). */
  function isIOSBundledApp() {
    return /RedsRacingApp\/.*iOS/i.test(navigator.userAgent || '') ||
      window.__RR_NATIVE_APP__ === 'ios';
  }

  /** Both platforms append RedsRacingApp/ to the WebView user agent. */
  function isBundledNativeApp() {
    return !!(window.__RR_NATIVE_APP__) ||
      /RedsRacingApp\//i.test(navigator.userAgent || '') ||
      isAndroidApp() ||
      isIOSBundledApp();
  }
  
  // Load mobile CSS if in app
  if (isBundledNativeApp()) {
    console.log('📱 Native app WebView detected - loading mobile styles');
    
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'styles/mobile-app.css';
    link.id = 'mobile-app-styles';
    document.head.appendChild(link);
    
    function isAuthenticated() {
      try {
        return !!(localStorage.getItem('rr_auth_uid') || localStorage.getItem('authToken'));
      } catch (_) {
        return false;
      }
    }

    function isLoginLikePage() {
      const p = (window.location && window.location.pathname) ? window.location.pathname.toLowerCase() : '';
      return p.endsWith('/login.html') || p.endsWith('/signup.html') || p.endsWith('/reset-password.html');
    }

    function ensureAppAuthFab() {
      try {
        if (!document.body) return;

        // Don't show a floating login button on the login/signup pages.
        if (isLoginLikePage()) {
          const existing = document.getElementById('rr-app-auth-fab');
          if (existing) existing.remove();
          return;
        }

        let fab = document.getElementById('rr-app-auth-fab');
        if (!fab) {
          fab = document.createElement('div');
          fab.id = 'rr-app-auth-fab';
          fab.className = 'rr-app-auth-fab';
          fab.innerHTML = `
            <a href="login.html" class="rr-app-auth-fab__btn" aria-label="Member Login">
              <i class="fas fa-user-lock" aria-hidden="true"></i>
              <span>Login</span>
            </a>
          `;
          document.body.appendChild(fab);
        }

        const authed = isAuthenticated();
        fab.style.display = authed ? 'none' : 'block';
      } catch (e) {
        // Fail silently: never block page rendering
      }
    }

    // Wait for body to exist before adding class
    function addBodyClass() {
      if (document.body) {
        try {
          document.body.classList.add('mobile-app');
          try { document.documentElement.classList.add('rr-native-app'); } catch (_) {}
        } catch (e) {
          console.warn('Failed to add mobile-app class:', e);
        }
        ensureAppAuthFab();
        // Keep it up-to-date if auth state changes inside the WebView
        setInterval(ensureAppAuthFab, 2000);
      } else {
        setTimeout(addBodyClass, 10);
      }
    }
    
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', addBodyClass);
    } else {
      addBodyClass();
    }
    
    // Add meta tag for proper viewport scaling
    if (!document.querySelector('meta[name="viewport"]')) {
      const viewport = document.createElement('meta');
      viewport.name = 'viewport';
      viewport.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
      document.head.appendChild(viewport);
    }
  }
})();
