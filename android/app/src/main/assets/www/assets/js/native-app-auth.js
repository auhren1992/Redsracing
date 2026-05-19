/**
 * Native Android / iOS app authentication helpers (standalone from browser PasswordCredential).
 */

function hasAndroidNativeBridge() {
  try {
    return !!(
      window.__RR_NATIVE_APP__ === "android" ||
      /RedsRacingApp\/1\.0 Android/i.test(navigator.userAgent || "") ||
      (typeof window.FirebaseAuthBridge !== "undefined" &&
        window.FirebaseAuthBridge != null) ||
      (typeof window.AppLockBridge !== "undefined" && window.AppLockBridge != null) ||
      (typeof window.AndroidAuth !== "undefined" && window.AndroidAuth != null) ||
      (typeof window.AndroidNotifications !== "undefined" &&
        window.AndroidNotifications != null)
    );
  } catch (_) {
    return false;
  }
}

function hasIOSNativeBridge() {
  try {
    return !!(
      window.__RR_NATIVE_APP__ === "ios" ||
      /RedsRacingApp\/1\.0 iOS/i.test(navigator.userAgent || "") ||
      (typeof window.webkit !== "undefined" &&
        (window.webkit?.messageHandlers?.redsRacingAppLock != null ||
          window.webkit?.messageHandlers?.redsRacingAuth != null ||
          window.webkit?.messageHandlers?.redsRacingAppUnlock != null))
    );
  } catch (_) {
    return false;
  }
}

export function isNativeAppWebView() {
  return hasAndroidNativeBridge() || hasIOSNativeBridge();
}

/** Login UI is bundled in the APK/IPA (not loaded from Firebase Hosting). */
export function isStandaloneAppLogin() {
  try {
    return window.__RR_STANDALONE_APP_LOGIN__ === true;
  } catch (_) {
    return false;
  }
}

/** Tell native shell to open the main app WebView after auth (standalone login activity). */
export function finishStandaloneAppLogin() {
  if (!isStandaloneAppLogin() && !isNativeAppWebView()) return false;
  try {
    if (typeof window.AndroidAuth !== "undefined" && window.AndroidAuth?.onLoginSuccess) {
      window.AndroidAuth.onLoginSuccess();
      return true;
    }
  } catch (_) {}
  try {
    const h = window.webkit?.messageHandlers?.redsRacingAuth;
    if (h && typeof h.postMessage === "function") {
      h.postMessage({ action: "loginComplete" });
      return true;
    }
  } catch (_) {}
  return false;
}

export function nativeAppLockAvailable() {
  try {
    return !!(
      (typeof AppLockBridge !== "undefined" &&
        AppLockBridge != null &&
        typeof AppLockBridge.setBiometricUnlockEnabled === "function") ||
      window.webkit?.messageHandlers?.redsRacingAppLock != null
    );
  } catch (_) {
    return false;
  }
}

/** @returns {Promise<{uid:string,email:string,biometricEnabled:boolean,hasSession:boolean}>} */
export function getNativeSession() {
  try {
    if (
      typeof AppLockBridge !== "undefined" &&
      typeof AppLockBridge.getNativeSessionJson === "function"
    ) {
      const raw = AppLockBridge.getNativeSessionJson();
      if (raw) return Promise.resolve(JSON.parse(raw));
    }
  } catch (_) {}

  if (window.webkit?.messageHandlers?.redsRacingAuth) {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        delete window.__rrAuthSessionCallback;
        resolve({
          uid: "",
          email: "",
          biometricEnabled: false,
          hasSession: false,
        });
      }, 2500);
      window.__rrAuthSessionCallback = (payload) => {
        clearTimeout(timeout);
        delete window.__rrAuthSessionCallback;
        resolve(
          payload || {
            uid: "",
            email: "",
            biometricEnabled: false,
            hasSession: false,
          },
        );
      };
      try {
        window.webkit.messageHandlers.redsRacingAuth.postMessage({
          action: "getSession",
        });
      } catch (_) {
        clearTimeout(timeout);
        resolve({
          uid: "",
          email: "",
          biometricEnabled: false,
          hasSession: false,
        });
      }
    });
  }

  return Promise.resolve({
    uid: "",
    email: "",
    biometricEnabled: false,
    hasSession: false,
  });
}

/** @returns {Promise<boolean>} */
export function requestNativeBiometricUnlock() {
  return new Promise((resolve) => {
    const finish = (ok) => {
      try {
        delete window.__rrNativeUnlockResult;
      } catch (_) {}
      resolve(!!ok);
    };

    window.__rrNativeUnlockResult = finish;

    try {
      if (
        typeof AppLockBridge !== "undefined" &&
        typeof AppLockBridge.requestNativeUnlock === "function"
      ) {
        AppLockBridge.requestNativeUnlock();
        return;
      }
    } catch (_) {}

    try {
      const unlock = window.webkit?.messageHandlers?.redsRacingAppUnlock;
      if (unlock && typeof unlock.postMessage === "function") {
        unlock.postMessage({ action: "unlock" });
        return;
      }
    } catch (_) {}

    finish(false);
  });
}

export function restoreNativeAuthMarkers(session) {
  const uid = session?.uid || "";
  if (!uid) return;
  try {
    localStorage.setItem("rr_auth_uid", uid);
  } catch (_) {}
  try {
    if (window.FirebaseAuthBridge?.getAuthUid && !uid) {
      const nativeUid = window.FirebaseAuthBridge.getAuthUid();
      if (nativeUid) localStorage.setItem("rr_auth_uid", nativeUid);
    }
  } catch (_) {}
}

export async function persistNativeAuth(user) {
  if (!user?.uid) return;
  const uid = user.uid;
  const email = user.email || "";
  let token = "";
  try {
    token = await user.getIdToken();
  } catch (_) {}

  try {
    localStorage.setItem("rr_auth_uid", uid);
  } catch (_) {}

  try {
    if (window.FirebaseAuthBridge) {
      window.FirebaseAuthBridge.storeAuthUid(uid);
      if (email) window.FirebaseAuthBridge.storeAuthEmail(email);
      if (token) window.FirebaseAuthBridge.storeAuthToken(token);
    }
  } catch (_) {}

  try {
    if (window.webkit?.messageHandlers?.redsRacingAuth) {
      window.webkit.messageHandlers.redsRacingAuth.postMessage({
        action: "storeSession",
        uid,
        email,
        token,
      });
    }
  } catch (_) {}
}

export function applyNativeAppLock(user, enabled) {
  if (!nativeAppLockAvailable() || !enabled) return;
  const uid = user?.uid || "";
  if (!uid) return;

  try {
    if (typeof AppLockBridge !== "undefined") {
      if (typeof AppLockBridge.setBiometricUnlockEnabledWithUid === "function") {
        AppLockBridge.setBiometricUnlockEnabledWithUid(true, uid);
      } else if (typeof AppLockBridge.setBiometricUnlockEnabled === "function") {
        AppLockBridge.setBiometricUnlockEnabled(true);
      }
    }
  } catch (_) {}

  try {
    const h = window.webkit?.messageHandlers?.redsRacingAppLock;
    if (h && typeof h.postMessage === "function") {
      h.postMessage({ enabled: true, authUid: uid });
    }
  } catch (_) {}
}

export function clearNativeAppLock() {
  try {
    if (typeof AppLockBridge !== "undefined" && AppLockBridge?.setBiometricUnlockEnabled) {
      AppLockBridge.setBiometricUnlockEnabled(false);
    }
  } catch (_) {}
  try {
    const h = window.webkit?.messageHandlers?.redsRacingAppLock;
    if (h && typeof h.postMessage === "function") {
      h.postMessage({ enabled: false });
    }
  } catch (_) {}
}
