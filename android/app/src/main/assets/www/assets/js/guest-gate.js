(function () {
  try {
    var path = (window.location.pathname || '').split('/').pop().toLowerCase();
    var protectedPages = {
      'admin-console.html': true,
      'admin.html': true,
      'dashboard.html': true,
      'follower-dashboard.html': true,
      'profile.html': true,
      'redsracing-dashboard.html': true,
      'settings.html': true,
      'team-settings.html': true
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

    if (!hasGuest && !hasUid) {
      var returnTo = encodeURIComponent(window.location.pathname + window.location.search + window.location.hash);
      window.location.replace('login.html?returnTo=' + returnTo);
    }
  } catch (e) {
    // Non-fatal; if something goes wrong, do nothing
  }
})();
