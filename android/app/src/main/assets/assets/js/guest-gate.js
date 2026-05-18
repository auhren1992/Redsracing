(function () {
  try {
    var raw = (window.location.pathname || "").replace(/^\/+|\/+$/g, "").toLowerCase();
    var pathKey = raw || "index.html";

    var skipPages = {
      "login.html": true,
      "signup.html": true,
      "qna.html": true,
    };
    if (skipPages[pathKey]) return;

    var protectedPages = {
      "dashboard.html": true,
      "follower-dashboard.html": true,
      "redsracing-dashboard.html": true,
      "follower/index.html": true,
      "admin/index.html": true,
      "profile.html": true,
      "settings.html": true,
      "fan-settings.html": true,
      "team-settings.html": true,
      "admin-console.html": true,
      "admin.html": true,
      "fan/dashboard.html": true,
      "crew/dashboard.html": true,
      "racer/dashboard.html": true,
    };
    if (!protectedPages[pathKey]) return;

    try {
      if (window.FirebaseAuthBridge) {
        var nativeUid = window.FirebaseAuthBridge.getAuthUid();
        if (nativeUid && nativeUid.length > 0) {
          localStorage.setItem("rr_auth_uid", nativeUid);
        }
      }
    } catch (_) {}

    var hasGuest = localStorage.getItem("rr_guest_ok") === "1";
    var hasUid = !!localStorage.getItem("rr_auth_uid");

    if (!hasGuest && !hasUid) {
      var returnTo = encodeURIComponent(
        window.location.pathname + window.location.search + window.location.hash,
      );
      var signupPage = "signup.html";
      if (/^(fan|crew|racer)\//.test(pathKey)) {
        signupPage = "../signup.html";
      }
      window.location.replace(signupPage + "?returnTo=" + returnTo);
    }
  } catch (e) {}
})();
