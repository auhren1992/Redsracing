(function () {
  try {
    var path = (window.location.pathname || '').split('/').pop().toLowerCase();
    var exempt = {
      'login.html': true,
      'signup.html': true,
      'follower-login.html': true,
      'debug-auth.html': true,
      'modern-auth-test.html': true,
      'test.html': true
    };
    if (exempt[path]) return;

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
