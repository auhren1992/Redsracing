/**
 * RedsRacing Global Error Tracker
 * Captures JS errors and logs to Firestore `client_logs`.
 * Supports Firebase compat (global `firebase`) OR modular v9 (default for most pages).
 */
(function () {
  'use strict';

  const ERROR_TRACKING_ENABLED = true;
  const MAX_ERRORS_PER_SESSION = 50;
  const BATCH_SEND_DELAY = 2000;
  const DEBUG = false;

  const FIREBASE_CFG = {
    apiKey: 'AIzaSyARFiFCadGKFUc_s6x3qNX8F4jsVawkzVg',
    authDomain: 'redsracing-a7f8b.firebaseapp.com',
    projectId: 'redsracing-a7f8b',
    storageBucket: 'redsracing-a7f8b.firebasestorage.app',
    messagingSenderId: '517034606151',
    appId: '1:517034606151:web:24cae262e1d98832757b62'
  };

  let errorQueue = [];
  let errorCount = 0;
  let sessionId = null;
  let firestoreReady = false;
  /** @type {null | ((data: object) => Promise<void>)} */
  let writeClientLog = null;
  let initStarted = false;
  let initAttempts = 0;
  const MAX_INIT_ATTEMPTS = 10;

  function logDebug() {
    if (!DEBUG) return;
    const a = Array.prototype.slice.call(arguments);
    a.unshift('[Error Tracker]');
    console.log.apply(console, a);
  }

  function generateSessionId() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  function getSessionId() {
    if (!sessionId) {
      sessionId = sessionStorage.getItem('error_tracking_session');
      if (!sessionId) {
        sessionId = generateSessionId();
        sessionStorage.setItem('error_tracking_session', sessionId);
      }
    }
    return sessionId;
  }

  async function initFirebase() {
    if (firestoreReady || initStarted) return;
    initStarted = true;
    initAttempts++;

    try {
      // Always prefer modular SDK. Pages that load firebase-*-compat.js for legacy reasons would
      // otherwise call firebase.firestore() here and spin up a second Firestore runtime, which breaks
      // modular APIs (collection() / query() rejecting the shared app’s db instance — invalid-argument).
      const { initializeApp, getApps } = await import(
        'https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js'
      );
      const {
        getFirestore,
        initializeFirestore,
        collection,
        addDoc,
        serverTimestamp,
      } = await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js');

      const apps = getApps();
      const defaultApp = apps.find(function (a) {
        return a.name === '[DEFAULT]';
      });
      const app = defaultApp || initializeApp(FIREBASE_CFG);

      let fsdb = null;
      const isLikelyWebView =
        (typeof navigator !== 'undefined' && /wv|Android/i.test(navigator.userAgent || '')) ||
        (typeof location !== 'undefined' && location.protocol === 'file:');
      try {
        fsdb = isLikelyWebView
          ? initializeFirestore(app, {
              experimentalForceLongPolling: true,
              experimentalAutoDetectLongPolling: true,
              useFetchStreams: false,
            })
          : getFirestore(app);
      } catch (_) {
        fsdb = getFirestore(app);
      }

      writeClientLog = function (errorData) {
        return addDoc(collection(fsdb, 'client_logs'), {
          ...errorData,
          serverTimestamp: serverTimestamp()
        });
      };
      firestoreReady = true;
      logDebug('Using modular Firestore (error tracker)');
      setTimeout(processErrorQueue, 0);
    } catch (error) {
      writeClientLog = null;
      firestoreReady = false;
      if (initAttempts < MAX_INIT_ATTEMPTS) {
        initStarted = false;
        setTimeout(initFirebase, 300 * initAttempts);
      } else if (DEBUG) {
        console.error('[Error Tracker] Failed to initialize Firebase after retries:', error);
      }
      return;
    }
    initStarted = false;
  }

  function getDeviceInfo() {
    const ua = navigator.userAgent;
    let deviceType = 'desktop';

    if (/Mobile|Android|iPhone|iPad|iPod/i.test(ua)) {
      deviceType = 'mobile';
    } else if (/Tablet|iPad/i.test(ua)) {
      deviceType = 'tablet';
    }

    const isAndroidApp = /RedsRacingApp/i.test(ua) || typeof Android !== 'undefined';

    return {
      userAgent: ua,
      deviceType: deviceType,
      isAndroidApp: isAndroidApp,
      platform: navigator.platform,
      language: navigator.language,
      screenResolution: window.screen.width + 'x' + window.screen.height,
      viewport: window.innerWidth + 'x' + window.innerHeight,
      online: navigator.onLine,
      cookiesEnabled: navigator.cookieEnabled
    };
  }

  function getPageName() {
    const path = window.location.pathname;
    let name = path.replace(/^\//, '').replace(/\.html$/i, '');
    if (!name || name === '/' || name === 'index') return 'Homepage (index)';
    return name
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, function (c) {
        return c.toUpperCase();
      });
  }

  function formatError(error, source, lineno, colno, errorObj) {
    const deviceInfo = getDeviceInfo();

    return {
      message: error || 'Unknown error',
      source: source || window.location.href,
      lineno: lineno || 0,
      colno: colno || 0,
      stack: errorObj && errorObj.stack ? errorObj.stack : 'No stack trace available',
      errorType: errorObj && errorObj.name ? errorObj.name : 'Error',
      page: window.location.pathname,
      pageName: getPageName(),
      fullUrl: window.location.href,
      timestamp: new Date().toISOString(),
      sessionId: getSessionId(),
      device: deviceInfo,
      userId: localStorage.getItem('rr_auth_uid') || 'anonymous',
      documentTitle: document.title,
      referrer: document.referrer || 'direct'
    };
  }

  async function logErrorToFirestore(errorData) {
    if (!firestoreReady || !writeClientLog) {
      return;
    }

    try {
      await writeClientLog(errorData);
      logDebug('Error logged to Firestore:', errorData.message);
    } catch (error) {
      if (DEBUG) console.error('[Error Tracker] Failed to log error to Firestore:', error);
      try {
        const backup = JSON.parse(localStorage.getItem('error_backup') || '[]');
        backup.push(errorData);
        if (backup.length > 20) backup.shift();
        localStorage.setItem('error_backup', JSON.stringify(backup));
      } catch (e) {
        if (DEBUG) console.error('[Error Tracker] Failed to backup error:', e);
      }
    }
  }

  async function processErrorQueue() {
    if (errorQueue.length === 0 || !firestoreReady || !writeClientLog) return;

    const errors = errorQueue.splice(0, 10);

    for (let i = 0; i < errors.length; i++) {
      await logErrorToFirestore(errors[i]);
    }

    if (errorQueue.length > 0) {
      setTimeout(processErrorQueue, 1000);
    }
  }

  window.addEventListener(
    'error',
    function (event) {
      if (!ERROR_TRACKING_ENABLED) return;
      if (errorCount >= MAX_ERRORS_PER_SESSION) return;

      errorCount++;

      const errorData = formatError(
        event.message,
        event.filename,
        event.lineno,
        event.colno,
        event.error
      );

      if (DEBUG) console.error('[Error Tracker] Caught error:', errorData);

      errorQueue.push(errorData);

      clearTimeout(window.errorQueueTimer);
      window.errorQueueTimer = setTimeout(processErrorQueue, BATCH_SEND_DELAY);
    },
    true
  );

  window.addEventListener('unhandledrejection', function (event) {
    if (!ERROR_TRACKING_ENABLED) return;
    if (errorCount >= MAX_ERRORS_PER_SESSION) return;

    errorCount++;

    const errorData = formatError(
      'Unhandled Promise Rejection: ' + event.reason,
      window.location.href,
      0,
      0,
      event.reason instanceof Error ? event.reason : null
    );

    if (DEBUG) console.error('[Error Tracker] Caught unhandled promise rejection:', errorData);

    errorQueue.push(errorData);

    clearTimeout(window.errorQueueTimer);
    window.errorQueueTimer = setTimeout(processErrorQueue, BATCH_SEND_DELAY);
  });

  const originalConsoleError = console.error;
  console.error = function () {
    originalConsoleError.apply(console, arguments);

    if (!ERROR_TRACKING_ENABLED) return;
    if (errorCount >= MAX_ERRORS_PER_SESSION) return;

    const message = Array.prototype.map
      .call(arguments, function (arg) {
        return typeof arg === 'object' ? JSON.stringify(arg) : String(arg);
      })
      .join(' ');

    const lower = message.toLowerCase();
    if (lower.includes('error') || lower.includes('failed')) {
      errorCount++;

      const errorData = formatError('Console Error: ' + message, window.location.href, 0, 0, null);

      errorQueue.push(errorData);

      clearTimeout(window.errorQueueTimer);
      window.errorQueueTimer = setTimeout(processErrorQueue, BATCH_SEND_DELAY);
    }
  };

  function sendBackupErrors() {
    try {
      const backup = JSON.parse(localStorage.getItem('error_backup') || '[]');
      if (backup.length > 0) {
        logDebug('Found backup errors, sending:', backup.length);
        errorQueue.push.apply(errorQueue, backup);
        localStorage.removeItem('error_backup');
        processErrorQueue();
      }
    } catch (e) {
      if (DEBUG) console.error('[Error Tracker] Failed to send backup errors:', e);
    }
  }

  function boot() {
    initFirebase();
    setTimeout(sendBackupErrors, 2000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  window.addEventListener('beforeunload', function () {
    if (errorQueue.length > 0) {
      processErrorQueue();
    }
  });

  window.logError = function (message, details) {
    details = details || {};
    const errorData = formatError(message, window.location.href, 0, 0, null);
    errorData.manualLog = true;
    errorData.details = details;

    errorQueue.push(errorData);
    processErrorQueue();
  };

  logDebug('Global error tracking initialized; session:', getSessionId());
})();
