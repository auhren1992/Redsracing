/**
 * RedsRacing Analytics Events Utility
 * Centralized analytics tracking for key user actions
 */

// Track any custom event
window.trackEvent = function(eventName, params = {}) {
  try {
    // Google Analytics 4 tracking
    if (window.gtag) {
      gtag('event', eventName, params);
    }
    
    // Log to console in development
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      console.log('[Analytics Event]', eventName, params);
    }
    
    // Custom Firestore analytics tracking (if firebase is loaded)
    if (window.firebase && window.firebase.firestore) {
      const db = window.firebase.firestore();
      db.collection('analytics_events').add({
        event: eventName,
        params: params,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        page: window.location.pathname,
        url: window.location.href,
        userAgent: navigator.userAgent,
        screen: `${window.screen.width}x${window.screen.height}`,
        viewport: `${window.innerWidth}x${window.innerHeight}`
      }).catch(err => console.error('Firestore analytics error:', err));
    }
  } catch (error) {
    console.error('Analytics tracking error:', error);
  }
};

// Track page engagement time
(function() {
  let startTime = Date.now();
  let isEngaged = true;
  
  // Track when user leaves/returns to page
  document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
      const engagementTime = Math.floor((Date.now() - startTime) / 1000);
      trackEvent('page_engagement', { 
        duration_seconds: engagementTime,
        page: window.location.pathname 
      });
      isEngaged = false;
    } else {
      startTime = Date.now();
      isEngaged = true;
    }
  });
  
  // Track on page unload
  window.addEventListener('beforeunload', function() {
    if (isEngaged) {
      const engagementTime = Math.floor((Date.now() - startTime) / 1000);
      trackEvent('page_engagement', { 
        duration_seconds: engagementTime,
        page: window.location.pathname 
      });
    }
  });
})();

// Preset tracking functions for common actions
window.trackCTA = function(ctaName, source = 'unknown') {
  trackEvent('cta_click', { cta_name: ctaName, source: source });
};

window.trackNavigation = function(destination, source = 'nav') {
  trackEvent('navigation', { destination: destination, source: source });
};

window.trackSocialClick = function(platform, source = 'unknown') {
  trackEvent('social_click', { platform: platform, source: source });
};

window.trackVideoPlay = function(videoId, videoTitle = '') {
  trackEvent('video_play', { video_id: videoId, video_title: videoTitle });
};

window.trackSponsorInquiry = function(source = 'unknown') {
  trackEvent('sponsor_inquiry', { source: source });
};

window.trackDriverFollow = function(driverName, driverNumber) {
  trackEvent('driver_follow', { driver_name: driverName, driver_number: driverNumber });
};

window.trackFormSubmit = function(formType, formName = '') {
  trackEvent('form_submit', { form_type: formType, form_name: formName });
};

window.trackDownload = function(fileName, fileType = 'unknown') {
  trackEvent('file_download', { file_name: fileName, file_type: fileType });
};

window.trackSearch = function(searchQuery, resultsCount = 0) {
  trackEvent('search', { query: searchQuery, results_count: resultsCount });
};

window.trackFilter = function(filterType, filterValue) {
  trackEvent('filter_applied', { filter_type: filterType, filter_value: filterValue });
};

// Track scroll depth
(function() {
  let maxScroll = 0;
  let scrollCheckpoints = [25, 50, 75, 90, 100];
  let reachedCheckpoints = new Set();
  
  window.addEventListener('scroll', function() {
    const scrollPercent = Math.floor(
      (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100
    );
    
    if (scrollPercent > maxScroll) {
      maxScroll = scrollPercent;
    }
    
    scrollCheckpoints.forEach(checkpoint => {
      if (scrollPercent >= checkpoint && !reachedCheckpoints.has(checkpoint)) {
        reachedCheckpoints.add(checkpoint);
        trackEvent('scroll_depth', { 
          depth_percent: checkpoint,
          page: window.location.pathname 
        });
      }
    });
  });
})();

console.log('[Analytics] Event tracking initialized');
