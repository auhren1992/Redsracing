/**
 * Simple Analytics Tracker for RedsRacing
 * Tracks page views and saves them to Firestore
 */

// Track page view
async function trackPageView() {
  try {
    // Only track on production, not during development
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      console.log('[Analytics] Skipping tracking on localhost');
      return;
    }

    // Import Firebase
    const { initializeApp, getApps } = await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js');
    const { getFirestore, collection, addDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js');
    
    // Initialize Firebase if not already initialized
    const firebaseConfig = {
      apiKey: "AIzaSyARFiFCadGKFUc_s6x3qNX8F4jsVawkzVg",
      authDomain: "redsracing-a7f8b.firebaseapp.com",
      projectId: "redsracing-a7f8b",
      storageBucket: "redsracing-a7f8b.firebasestorage.app",
      messagingSenderId: "517034606151",
      appId: "1:517034606151:web:24cae262e1d98832757b62"
    };
    
    if (getApps().length === 0) {
      initializeApp(firebaseConfig);
    }
    
    const db = getFirestore();
    
    // Get or create visitor ID (stored in localStorage)
    let visitorId = localStorage.getItem('redsracing_visitor_id');
    if (!visitorId) {
      visitorId = 'visitor_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('redsracing_visitor_id', visitorId);
    }
    
    // Get session ID (stored in sessionStorage)
    let sessionId = sessionStorage.getItem('redsracing_session_id');
    if (!sessionId) {
      sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      sessionStorage.setItem('redsracing_session_id', sessionId);
    }
    
    // Collect page view data
    const pageViewData = {
      visitorId: visitorId,
      sessionId: sessionId,
      page: window.location.pathname,
      title: document.title,
      referrer: document.referrer || 'Direct',
      userAgent: navigator.userAgent,
      screenResolution: `${window.screen.width}x${window.screen.height}`,
      timestamp: serverTimestamp(),
      url: window.location.href
    };
    
    // Save to Firestore
    await addDoc(collection(db, 'page_views'), pageViewData);
    
    console.log('[Analytics] Page view tracked:', pageViewData.page);
    
  } catch (error) {
    // Silently fail - don't disrupt user experience
    console.error('[Analytics] Tracking error:', error);
  }
}

// Track when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', trackPageView);
} else {
  trackPageView();
}
