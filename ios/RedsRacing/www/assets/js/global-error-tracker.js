/**
 * RedsRacing Global Error Tracker
 * Captures JS errors and logs to Firestore `client_logs` with physical file/line/col.
 * Supports Firebase modular v9 (default for most pages).
 */
(function () {
  'use strict';

  const ERROR_TRACKING_ENABLED = true;
  const MAX_ERRORS_PER_SESSION = 50;
  const BATCH_SEND_DELAY = 2000;
  const DEBUG = false;
  const TRACKER_VERSION = '2026080913';

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

  function fileShortName(url) {
    if (!url) return '—';
    try {
      const clean = String(url).split('?')[0].split('#')[0];
      const parts = clean.split('/');
      return parts[parts.length - 1] || clean;
    } catch (_) {
      return String(url);
    }
  }

  /**
   * Parse a stack string into frame objects with file/line/column.
   * Supports V8/Chrome, Firefox, and Safari formats.
   */
  function parseStackFrames(stack) {
    if (!stack || typeof stack !== 'string') return [];
    const frames = [];
    const lines = stack.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || /^error\b/i.test(line)) continue;

      let fn = '';
      let file = '';
      let lineNo = 0;
      let colNo = 0;
      let m = null;

      // Chrome: at fn (https://host/path/file.js:12:34) OR at https://...:12:34
      m = line.match(/at\s+(?:(.+?)\s+\()?((?:https?:|file:|blob:|\/)[^)\s]+):(\d+):(\d+)\)?$/i);
      if (m) {
        fn = (m[1] || '').trim();
        file = m[2];
        lineNo = parseInt(m[3], 10) || 0;
        colNo = parseInt(m[4], 10) || 0;
      }

      // Anonymous / eval: at foo (<anonymous>:1:13)
      if (!m) {
        m = line.match(/at\s+(?:(.+?)\s+\()?<?anonymous>?[^:]*:(\d+):(\d+)\)?$/i);
        if (m) {
          fn = (m[1] || 'anonymous').trim();
          file = (typeof location !== 'undefined' ? location.href : 'anonymous');
          lineNo = parseInt(m[2], 10) || 0;
          colNo = parseInt(m[3], 10) || 0;
        }
      }

      // Relative: at assets/js/foo.js:12:34
      if (!m) {
        m = line.match(/at\s+(?:(.+?)\s+\()?((?:[\w./-]+\.(?:js|mjs|ts|html))):(\d+):(\d+)\)?$/i);
        if (m) {
          fn = (m[1] || '').trim();
          file = m[2];
          lineNo = parseInt(m[3], 10) || 0;
          colNo = parseInt(m[4], 10) || 0;
        }
      }

      // Firefox: fn@url:12:34
      if (!m) {
        m = line.match(/^(?:(.*?)@)?((?:https?:|file:|\/)[^\s]+):(\d+):(\d+)$/i);
        if (m) {
          fn = (m[1] || '').trim();
          file = m[2];
          lineNo = parseInt(m[3], 10) || 0;
          colNo = parseInt(m[4], 10) || 0;
        }
      }

      if (!file || !lineNo) continue;

      const isApp =
        (/redsracing\.(org|web\.app)|localhost|127\.0\.0\.1|\/assets\/|\/styles\//i.test(file) ||
          /\.(js|html)$/i.test(file) ||
          (typeof location !== 'undefined' && file.indexOf(location.origin) === 0)) &&
        !/gstatic\.com|googletagmanager|google-analytics|doubleclick|sentry\.io|devtools:\/\//i.test(file);

      frames.push({
        functionName: fn || '(anonymous)',
        file: file,
        fileShort: fileShortName(file),
        line: lineNo,
        column: colNo,
        isApp: isApp,
        raw: line,
        display: fileShortName(file) + ':' + lineNo + (colNo ? ':' + colNo : '')
      });
    }
    return frames;
  }

  /**
   * Resolve the best physical location for an error.
   */
  function resolvePhysicalLocation(source, lineno, colno, stack) {
    const frames = parseStackFrames(stack);
    const appFrame = frames.find(function (f) { return f.isApp && f.line > 0; }) || frames.find(function (f) { return f.line > 0; });

    const src = source || '';
    const isUsefulSource =
      !!src &&
      lineno > 0 &&
      !/^(https?:)?\/\/[^/]+\/?$/i.test(src) &&
      src !== (typeof location !== 'undefined' ? location.href : '');

    if (isUsefulSource) {
      return {
        file: src,
        fileShort: fileShortName(src),
        line: lineno || 0,
        column: colno || 0,
        functionName: appFrame ? appFrame.functionName : '',
        display: fileShortName(src) + ':' + (lineno || 0) + (colno ? ':' + colno : ''),
        frames: frames,
        resolvedFrom: 'error-event'
      };
    }

    if (appFrame) {
      return {
        file: appFrame.file,
        fileShort: appFrame.fileShort,
        line: appFrame.line,
        column: appFrame.column,
        functionName: appFrame.functionName,
        display: appFrame.display,
        frames: frames,
        resolvedFrom: 'stack'
      };
    }

    const fallbackFile = src || (typeof location !== 'undefined' ? location.href : '');
    return {
      file: fallbackFile,
      fileShort: fileShortName(fallbackFile) || 'unknown',
      line: lineno || 0,
      column: colno || 0,
      functionName: '',
      display: lineno > 0
        ? fileShortName(fallbackFile || 'page') + ':' + lineno + (colno ? ':' + colno : '')
        : (frames[0] ? frames[0].display : 'Location unknown'),
      frames: frames,
      resolvedFrom: 'fallback'
    };
  }

  // Expose for admin console to re-parse legacy logs
  window.__rrParseErrorLocation = resolvePhysicalLocation;
  window.__rrParseStackFrames = parseStackFrames;

  async function initFirebase() {
    if (firestoreReady || initStarted) return;
    initStarted = true;
    initAttempts++;

    try {
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
          createdAt: serverTimestamp(),
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
    const isIosApp = /RedsRacingApp\/1\.0 iOS/i.test(ua);

    return {
      userAgent: ua,
      deviceType: deviceType,
      isAndroidApp: isAndroidApp,
      isIosApp: isIosApp,
      isNativeApp: isAndroidApp || isIosApp,
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
    const stack =
      errorObj && errorObj.stack
        ? String(errorObj.stack)
        : typeof error === 'string' && error.includes('\n')
          ? error
          : '';

    let message = error;
    if (!message || (typeof message === 'string' && !message.trim())) {
      if (errorObj && (errorObj.message || errorObj.stack || errorObj.name)) {
        message =
          (errorObj.name ? errorObj.name + ': ' : '') +
          (errorObj.message || errorObj.stack || 'thrown value');
      } else if (source || lineno || colno) {
        message =
          'ErrorEvent: ' +
          (source || window.location.href) +
          ':' +
          (lineno || 0) +
          ':' +
          (colno || 0);
      } else {
        message = 'Unknown error';
      }
    }

    const physical = resolvePhysicalLocation(source, lineno || 0, colno || 0, stack || (errorObj && errorObj.stack) || '');

    return {
      message: String(message),
      source: physical.file || source || window.location.href,
      lineno: physical.line || lineno || 0,
      colno: physical.column || colno || 0,
      location: physical.display,
      physicalLocation: physical,
      stack: stack || (errorObj && errorObj.stack) || 'No stack trace available',
      stackFrames: physical.frames || [],
      errorType: errorObj && errorObj.name ? errorObj.name : 'Error',
      page: window.location.pathname,
      pageName: getPageName(),
      fullUrl: window.location.href,
      timestamp: new Date().toISOString(),
      sessionId: getSessionId(),
      device: deviceInfo,
      userId: localStorage.getItem('rr_auth_uid') || 'anonymous',
      documentTitle: document.title,
      referrer: document.referrer || 'direct',
      trackerVersion: TRACKER_VERSION
    };
  }

  async function logErrorToFirestore(errorData) {
    if (!firestoreReady || !writeClientLog) {
      return;
    }

    try {
      await writeClientLog(errorData);
      logDebug('Error logged to Firestore:', errorData.message, errorData.location);
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

      const isCorsStripped =
        (event && typeof event.message === 'string' &&
          event.message.trim() === 'Script error.') &&
        !event.filename &&
        !event.lineno &&
        !event.error;
      if (isCorsStripped) return;

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

    const reason = event && event.reason;
    let reasonMessage;
    if (reason && typeof reason === 'object') {
      reasonMessage =
        (reason.name ? reason.name + ': ' : '') +
        (reason.message || reason.stack || JSON.stringify(reason));
    } else {
      reasonMessage = String(reason);
    }

    const errorData = formatError(
      'Unhandled Promise Rejection: ' + reasonMessage,
      window.location.href,
      0,
      0,
      reason instanceof Error ? reason : null
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

    // Prefer first Error argument for real stack/location
    let errObj = null;
    for (let i = 0; i < arguments.length; i++) {
      if (arguments[i] instanceof Error) {
        errObj = arguments[i];
        break;
      }
    }

    const message = Array.prototype.map
      .call(arguments, function (arg) {
        if (arg instanceof Error) return arg.message || String(arg);
        return typeof arg === 'object' ? JSON.stringify(arg) : String(arg);
      })
      .join(' ');

    const lower = message.toLowerCase();
    if (lower.includes('error') || lower.includes('failed') || errObj) {
      errorCount++;

      // Build synthetic stack if we only have console call site
      let stack = errObj && errObj.stack ? errObj.stack : '';
      if (!stack) {
        try {
          throw new Error('Console Error marker');
        } catch (e) {
          stack = e.stack || '';
        }
      }

      const errorData = formatError(
        'Console Error: ' + message,
        window.location.href,
        0,
        0,
        errObj || { name: 'ConsoleError', message: message, stack: stack }
      );

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
    let stack = '';
    try {
      throw new Error(String(message));
    } catch (e) {
      stack = e.stack || '';
    }
    const errorData = formatError(message, details.source || window.location.href, details.lineno || 0, details.colno || 0, {
      name: 'ManualLog',
      message: String(message),
      stack: details.stack || stack
    });
    errorData.manualLog = true;
    errorData.details = details;

    errorQueue.push(errorData);
    processErrorQueue();
  };

  // Mark so navigation.js skips the thin duplicate writer
  window.__rrErrorTrackerActive = true;

  logDebug('Global error tracking initialized; session:', getSessionId());
})();
