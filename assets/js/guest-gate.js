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

    // localStorage alone is forgeable — do not treat rr_guest_ok / rr_auth_uid as auth.
    // Soft redirect when no signals are present; auth-guard.js enforces real Firebase auth
    // on admin/staff pages. Guest flag never unlocks protected hubs.
    var hasUid = !!localStorage.getItem("rr_auth_uid");
    var hasNative = false;
    try {
      if (window.FirebaseAuthBridge) {
        var nativeUid = window.FirebaseAuthBridge.getAuthUid();
        hasNative = !!(nativeUid && nativeUid.length > 0);
      }
    } catch (_) {}

    if (!hasUid && !hasNative) {
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
