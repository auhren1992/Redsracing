/**
 * Shared native-app / WebView environment detection.
 * Prefer this over per-file UA heuristics.
 */

function hasNativeFlag() {
  return typeof window !== "undefined" && !!window.__RR_NATIVE_APP__;
}

function hasNativeDomClass() {
  if (typeof document === "undefined") return false;
  const html = document.documentElement;
  if (html?.classList?.contains("rr-native-app")) return true;
  return !!document.body?.classList?.contains("mobile-app");
}

function hasNativeUserAgent() {
  const ua = (typeof navigator !== "undefined" && navigator.userAgent) || "";
  return /RedsRacingApp\//i.test(ua);
}

function hasNativeBridge() {
  if (typeof window === "undefined") return false;
  if (window.AndroidNotifications || window.FirebaseAuthBridge) return true;
  const handlers = window.webkit?.messageHandlers;
  return !!(handlers?.redsRacingNotifications || handlers?.redsRacingAuth);
}

export function isNativeApp() {
  try {
    return (
      hasNativeFlag() ||
      hasNativeDomClass() ||
      hasNativeUserAgent() ||
      hasNativeBridge()
    );
  } catch (_) {
    return false;
  }
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
