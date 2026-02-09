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
