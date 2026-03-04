/**
 * Google Analytics Initialization
 * Loads Google Analytics and tracks page views
 */

(function() {
  'use strict';
  
  // Only track on production, not during development
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    console.log('[GA] Skipping Google Analytics on localhost');
    return;
  }
  
  // Load Google Analytics
  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://www.googletagmanager.com/gtag/js?id=G-YD3ZWC13SR';
  document.head.appendChild(script);
  
  // Initialize dataLayer
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  window.gtag = gtag;
  
  gtag('js', new Date());
  gtag('config', 'G-YD3ZWC13SR', {
    'send_page_view': true
  });
  
  console.log('[GA] Google Analytics initialized');
})();
