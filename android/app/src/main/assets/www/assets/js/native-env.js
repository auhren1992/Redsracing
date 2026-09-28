/**
 * Shared native-app / WebView environment detection.
 * Prefer this over per-file UA heuristics.
 */

export function isNativeApp() {
  try {
    if (typeof window !== "undefined" && window.__RR_NATIVE_APP__) return true;
    if (typeof document !== "undefined") {
      const html = document.documentElement;
      if (html?.classList?.contains("rr-native-app")) return true;
      if (document.body?.classList?.contains("mobile-app")) return true;
    }
    const ua = (typeof navigator !== "undefined" && navigator.userAgent) || "";
    if (/RedsRacingApp\//i.test(ua)) return true;
    if (
      typeof window !== "undefined" &&
      (window.AndroidNotifications ||
        window.FirebaseAuthBridge ||
        window.webkit?.messageHandlers?.redsRacingNotifications ||
        window.webkit?.messageHandlers?.redsRacingAuth)
    ) {
      return true;
    }
  } catch (_) {}
  return false;
}

export function isAndroidNative() {
  try {
    if (typeof window !== "undefined" && window.__RR_NATIVE_APP__ === "android") {
      return true;
    }
    const ua = (typeof navigator !== "undefined" && navigator.userAgent) || "";
    return isNativeApp() && /Android/i.test(ua);
  } catch (_) {
    return false;
  }
}

export function isIOSNative() {
  try {
    if (typeof window !== "undefined" && window.__RR_NATIVE_APP__ === "ios") {
      return true;
    }
    const ua = (typeof navigator !== "undefined" && navigator.userAgent) || "";
    return isNativeApp() && /iPhone|iPad|iPod/i.test(ua);
  } catch (_) {
    return false;
  }
}

/** True for embedded WebViews (not ordinary mobile Chrome). */
export function isLikelyEmbeddedWebView() {
  try {
    if (isNativeApp()) return true;
    if (typeof location !== "undefined" && location.protocol === "file:") return true;
    const ua = (typeof navigator !== "undefined" && navigator.userAgent) || "";
    // Chrome WebView marker is "; wv)" — never match bare "Android".
    return /; wv\)/i.test(ua) || /\bwv\b/i.test(ua);
  } catch (_) {
    return false;
  }
}

// Also expose for classic scripts
try {
  if (typeof window !== "undefined") {
    window.__rrNativeEnv = {
      isNativeApp,
      isAndroidNative,
      isIOSNative,
      isLikelyEmbeddedWebView,
    };
  }
} catch (_) {}
