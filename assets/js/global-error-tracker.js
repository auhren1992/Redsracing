/**
 * RedsRacing Global Error Tracker
 * Automatically captures all JavaScript errors from any device and logs to Firestore
 */

(function() {
  'use strict';
  
  // Configuration
  const ERROR_TRACKING_ENABLED = true;
  const MAX_ERRORS_PER_SESSION = 50;
  const BATCH_SEND_DELAY = 2000; // Send errors in batches every 2 seconds
  
  let errorQueue = [];
  let errorCount = 0;
  let db = null;
  let sessionId = null;
  
  // Generate unique session ID
  function generateSessionId() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }
  
  // Get or create session ID
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
  
  // Initialize Firebase connection
  async function initFirebase() {
    try {
      // Wait for Firebase to be available
      if (typeof firebase === 'undefined') {
        console.warn('[Error Tracker] Firebase not loaded yet, will retry...');
        setTimeout(initFirebase, 1000);
        return;
      }
      
      // Check if already initialized
      if (firebase.apps.length > 0) {
        db = firebase.firestore();
        console.log('[Error Tracker] Connected to existing Firebase instance');
        return;
      }
      
      // Initialize new instance if needed
      const config = {
        apiKey: "AIzaSyARFiFCadGKFUc_s6x3qNX8F4jsVawkzVg",
        authDomain: "redsracing-a7f8b.firebaseapp.com",
        projectId: "redsracing-a7f8b"
      };
      
      firebase.initializeApp(config);
      db = firebase.firestore();
      console.log('[Error Tracker] Firebase initialized for error tracking');
    } catch (error) {
      console.error('[Error Tracker] Failed to initialize Firebase:', error);
    }
  }
  
  // Get device and browser information
  function getDeviceInfo() {
    const ua = navigator.userAgent;
    let deviceType = 'desktop';
    
    if (/Mobile|Android|iPhone|iPad|iPod/i.test(ua)) {
      deviceType = 'mobile';
    } else if (/Tablet|iPad/i.test(ua)) {
      deviceType = 'tablet';
    }
    
    // Detect if running in Android WebView
    const isAndroidApp = /RedsRacingApp/i.test(ua) || (typeof Android !== 'undefined');
    
    return {
      userAgent: ua,
      deviceType: deviceType,
      isAndroidApp: isAndroidApp,
      platform: navigator.platform,
      language: navigator.language,
      screenResolution: `${window.screen.width}x${window.screen.height}`,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      online: navigator.onLine,
      cookiesEnabled: navigator.cookieEnabled
    };
  }
  
  // Format error for logging
  function formatError(error, source, lineno, colno, errorObj) {
    const deviceInfo = getDeviceInfo();
    
    return {
      // Error details
      message: error || 'Unknown error',
      source: source || window.location.href,
      lineno: lineno || 0,
      colno: colno || 0,
      stack: errorObj?.stack || 'No stack trace available',
      errorType: errorObj?.name || 'Error',
      
      // Context
      page: window.location.pathname,
      fullUrl: window.location.href,
      timestamp: new Date().toISOString(),
      sessionId: getSessionId(),
      
      // Device information
      device: deviceInfo,
      
      // User information (if available)
      userId: localStorage.getItem('rr_auth_uid') || 'anonymous',
      
      // Additional context
      documentTitle: document.title,
      referrer: document.referrer || 'direct'
    };
  }
  
  // Log error to Firestore
  async function logErrorToFirestore(errorData) {
    if (!db) {
      console.warn('[Error Tracker] Firestore not initialized, queuing error');
      errorQueue.push(errorData);
      return;
    }
    
    try {
      await db.collection('client_logs').add({
        ...errorData,
        serverTimestamp: firebase.firestore.FieldValue.serverTimestamp()
      });
      
      console.log('[Error Tracker] Error logged to Firestore:', errorData.message);
    } catch (error) {
      console.error('[Error Tracker] Failed to log error to Firestore:', error);
      // Store in localStorage as backup
      try {
        const backup = JSON.parse(localStorage.getItem('error_backup') || '[]');
        backup.push(errorData);
        if (backup.length > 20) backup.shift(); // Keep only last 20
        localStorage.setItem('error_backup', JSON.stringify(backup));
      } catch (e) {
        console.error('[Error Tracker] Failed to backup error:', e);
      }
    }
  }
  
  // Process error queue
  async function processErrorQueue() {
    if (errorQueue.length === 0 || !db) return;
    
    const errors = errorQueue.splice(0, 10); // Process up to 10 at a time
    
    for (const error of errors) {
      await logErrorToFirestore(error);
    }
    
    if (errorQueue.length > 0) {
      setTimeout(processErrorQueue, 1000);
    }
  }
  
  // Global error handler
  window.addEventListener('error', function(event) {
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
    
    console.error('[Error Tracker] Caught error:', errorData);
    
    errorQueue.push(errorData);
    
    // Process queue after delay
    clearTimeout(window.errorQueueTimer);
    window.errorQueueTimer = setTimeout(processErrorQueue, BATCH_SEND_DELAY);
  }, true);
  
  // Unhandled promise rejection handler
  window.addEventListener('unhandledrejection', function(event) {
    if (!ERROR_TRACKING_ENABLED) return;
    if (errorCount >= MAX_ERRORS_PER_SESSION) return;
    
    errorCount++;
    
    const errorData = formatError(
      `Unhandled Promise Rejection: ${event.reason}`,
      window.location.href,
      0,
      0,
      event.reason instanceof Error ? event.reason : null
    );
    
    console.error('[Error Tracker] Caught unhandled promise rejection:', errorData);
    
    errorQueue.push(errorData);
    
    // Process queue after delay
    clearTimeout(window.errorQueueTimer);
    window.errorQueueTimer = setTimeout(processErrorQueue, BATCH_SEND_DELAY);
  });
  
  // Console error override to catch manual console.error calls
  const originalConsoleError = console.error;
  console.error = function(...args) {
    originalConsoleError.apply(console, args);
    
    if (!ERROR_TRACKING_ENABLED) return;
    if (errorCount >= MAX_ERRORS_PER_SESSION) return;
    
    // Only log if it looks like an actual error, not just debug messages
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join(' ');
    
    if (message.toLowerCase().includes('error') || message.toLowerCase().includes('failed')) {
      errorCount++;
      
      const errorData = formatError(
        `Console Error: ${message}`,
        window.location.href,
        0,
        0,
        null
      );
      
      errorQueue.push(errorData);
      
      clearTimeout(window.errorQueueTimer);
      window.errorQueueTimer = setTimeout(processErrorQueue, BATCH_SEND_DELAY);
    }
  };
  
  // Send any backup errors on page load
  function sendBackupErrors() {
    try {
      const backup = JSON.parse(localStorage.getItem('error_backup') || '[]');
      if (backup.length > 0) {
        console.log(`[Error Tracker] Found ${backup.length} backup errors, sending...`);
        errorQueue.push(...backup);
        localStorage.removeItem('error_backup');
        processErrorQueue();
      }
    } catch (e) {
      console.error('[Error Tracker] Failed to send backup errors:', e);
    }
  }
  
  // Initialize on page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      initFirebase();
      setTimeout(sendBackupErrors, 2000);
    });
  } else {
    initFirebase();
    setTimeout(sendBackupErrors, 2000);
  }
  
  // Process any remaining errors before page unload
  window.addEventListener('beforeunload', function() {
    if (errorQueue.length > 0) {
      // Try to send immediately
      processErrorQueue();
    }
  });
  
  // Expose for manual error logging
  window.logError = function(message, details = {}) {
    const errorData = formatError(
      message,
      window.location.href,
      0,
      0,
      null
    );
    errorData.manualLog = true;
    errorData.details = details;
    
    errorQueue.push(errorData);
    processErrorQueue();
  };
  
  console.log('[Error Tracker] Global error tracking initialized');
  console.log('[Error Tracker] Session ID:', getSessionId());
})();
