(function () {
  try {
    var path = (window.location.pathname || '').split('/').pop().toLowerCase();

    // Pages that never redirect (login/signup themselves)
    var skipPages = {
      'login.html': true,
      'signup.html': true
    };
    if (skipPages[path]) return;

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
