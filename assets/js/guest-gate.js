(function () {
  try {
    var path = (window.location.pathname || '').split('/').pop().toLowerCase();

    // Pages that never redirect (login/signup themselves or always-public content)
    var skipPages = {
      'login.html': true,
      'signup.html': true,
      // Public community pages should never be gated (SEO/AdSense + public visitors)
      'qna.html': true
    };
    if (skipPages[path]) return;

    // Only gate pages that actually require authentication.
    // Public content pages (home/team/schedule/etc) must remain accessible for SEO and AdSense review.
    var protectedPages = {
      'dashboard.html': true,
      'follower-dashboard.html': true,
      'redsracing-dashboard.html': true,
      'profile.html': true,
      'settings.html': true,
      'fan-settings.html': true,
      'team-settings.html': true,
      'admin-console.html': true,
      'admin.html': true
    };
    if (!protectedPages[path]) return;

    // Restore auth from Android native bridge (SharedPreferences) if localStorage lost it
    try {
      if (window.FirebaseAuthBridge) {
        var nativeUid = window.FirebaseAuthBridge.getAuthUid();
        if (nativeUid && nativeUid.length > 0 && !localStorage.getItem('rr_auth_uid')) {
          localStorage.setItem('rr_auth_uid', nativeUid);
        }
      }
    } catch (_) {}

    var hasGuest = localStorage.getItem('rr_guest_ok') === '1';
    var hasUid = !!localStorage.getItem('rr_auth_uid');

    // If not logged in and not a guest, redirect to login
    if (!hasGuest && !hasUid) {
      var returnTo = encodeURIComponent(window.location.pathname + window.location.search + window.location.hash);
      window.location.replace('signup.html?returnTo=' + returnTo);
    }
  } catch (e) {
    // Non-fatal; if something goes wrong, do nothing
  }
})();
