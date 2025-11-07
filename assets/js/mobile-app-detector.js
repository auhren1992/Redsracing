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
      window.location.protocol === 'https:' && window.location.host === 'appassets.androidplatform.net' ||
      typeof window.AndroidNotifications !== 'undefined' ||
      typeof window.AndroidAuth !== 'undefined'
    );
  }
  
  // Load mobile CSS if in app
  if (isAndroidApp()) {
    console.log('📱 Android app detected - loading mobile styles');
    
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'styles/mobile-app.css';
    link.id = 'mobile-app-styles';
    document.head.appendChild(link);
    
    // Add app class to body
    document.body.classList.add('mobile-app');
    
    // Add meta tag for proper viewport scaling
    if (!document.querySelector('meta[name="viewport"]')) {
      const viewport = document.createElement('meta');
      viewport.name = 'viewport';
      viewport.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
      document.head.appendChild(viewport);
    }
  }
})();
