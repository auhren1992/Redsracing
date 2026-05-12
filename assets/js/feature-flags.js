/**
 * Feature Flags — window.RR.flags
 * Lazy-loads config/flags from Firestore once per page, cached in
 * sessionStorage for 60 s.  Falls back to empty {} on error.
 * Usage: window.RR.flags.get('enable_race_day_hub', false)
 */
(function () {
  'use strict';

  const CACHE_KEY = 'rr_feature_flags';
  const CACHE_TTL = 60 * 1000; // 60 s

  window.RR = window.RR || {};

  let _resolved = null; // Promise<object> once in-flight

  function _loadFromCache() {
    try {
      const raw = sessionStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const { ts, data } = JSON.parse(raw);
      if (Date.now() - ts < CACHE_TTL) return data;
    } catch (_) {}
    return null;
  }

  function _saveToCache(data) {
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
    } catch (_) {}
  }

  function _fetchFromFirestore() {
    if (_resolved) return _resolved;
    _resolved = new Promise(function (resolve) {
      const cached = _loadFromCache();
      if (cached) return resolve(cached);

      // Wait for Firebase to be initialised (firebase-core.js sets window._firebaseReady)
      function tryLoad() {
        try {
          const firebase = window.firebase || (window._firebaseApp && { firestore: window._firebaseFirestore });
          // Prefer modular v9 compat Firestore available globally
          const db = window._rrFirestore || (window.firebase && window.firebase.firestore && window.firebase.firestore());
          if (!db) throw new Error('Firestore not ready');

          db.doc('config/flags').get().then(function (snap) {
            const data = snap.exists ? (snap.data() || {}) : {};
            _saveToCache(data);
            resolve(data);
          }).catch(function (err) {
            console.warn('[RR.flags] Firestore read failed:', err);
            resolve({});
          });
        } catch (e) {
          // Retry once Firestore is bootstrapped
          setTimeout(tryLoad, 300);
        }
      }

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', tryLoad);
      } else {
        tryLoad();
      }
    });
    return _resolved;
  }

  window.RR.flags = {
    /**
     * @param {string} name - flag key
     * @param {*} defaultValue - returned when flag is absent or not yet loaded
     * @returns {Promise<boolean|*>}
     */
    get: function (name, defaultValue) {
      return _fetchFromFirestore().then(function (data) {
        return name in data ? data[name] : defaultValue;
      });
    },

    /**
     * Synchronous read — only safe after flags have loaded.
     * Returns defaultValue until load completes.
     */
    getSync: function (name, defaultValue) {
      const cached = _loadFromCache();
      if (!cached) return defaultValue;
      return name in cached ? cached[name] : defaultValue;
    },

    /** Invalidate the local cache (admin use) */
    bust: function () {
      try { sessionStorage.removeItem(CACHE_KEY); } catch (_) {}
      _resolved = null;
    },

    /** Pre-load without waiting for a get() call */
    preload: function () {
      return _fetchFromFirestore();
    }
  };
})();
