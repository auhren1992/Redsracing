/**
 * Native + web notification opt-in for RedsRacing homepage (and elsewhere).
 * In Android/iOS WebViews the browser Notification API is unavailable — use the
 * native bridge so race reminders / schedule updates can be delivered via FCM.
 */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'rr_notifications_enabled';
  var TOPICS_NOTE = 'race reminders and schedule updates';
  var pendingCallbacks = Object.create(null);
  var reqSeq = 0;

  function isNativeApp() {
    try {
      if (global.__RR_NATIVE_APP__) return true;
      if (/RedsRacingApp\//i.test(navigator.userAgent || '')) return true;
      if (typeof global.AndroidNotifications !== 'undefined') return true;
      if (global.webkit && global.webkit.messageHandlers && global.webkit.messageHandlers.redsRacingNotifications) {
        return true;
      }
    } catch (_) {}
    return false;
  }

  function isAndroidNative() {
    return global.__RR_NATIVE_APP__ === 'android' || typeof global.AndroidNotifications !== 'undefined';
  }

  function isIosNative() {
    return global.__RR_NATIVE_APP__ === 'ios' ||
      !!(global.webkit && global.webkit.messageHandlers && global.webkit.messageHandlers.redsRacingNotifications);
  }

  function isIosBrowser() {
    var ua = navigator.userAgent || '';
    if (/iPad|iPhone|iPod/i.test(ua)) return true;
    // iPadOS desktop UA
    return navigator.platform === 'MacIntel' && (navigator.maxTouchPoints || 0) > 1;
  }

  function isStandalonePwa() {
    try {
      if (navigator.standalone === true) return true;
      if (global.matchMedia && global.matchMedia('(display-mode: standalone)').matches) return true;
    } catch (_) {}
    return false;
  }

  function isMobileBrowser() {
    return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');
  }

  function markEnabledLocally() {
    try { localStorage.setItem(STORAGE_KEY, '1'); } catch (_) {}
  }

  function isMarkedEnabled() {
    try { return localStorage.getItem(STORAGE_KEY) === '1'; } catch (_) { return false; }
  }

  function nextRequestId() {
    reqSeq += 1;
    return 'rrn-' + Date.now() + '-' + reqSeq;
  }

  function waitForNativeResult(timeoutMs) {
    var id = nextRequestId();
    return new Promise(function (resolve) {
      var done = false;
      var timer = setTimeout(function () {
        if (done) return;
        done = true;
        delete pendingCallbacks[id];
        resolve({ status: 'timeout', message: 'Native notification bridge timed out. Try again.' });
      }, timeoutMs || 20000);

      pendingCallbacks[id] = function (payload) {
        if (done) return;
        done = true;
        clearTimeout(timer);
        delete pendingCallbacks[id];
        resolve(payload || { status: 'error' });
      };
    }).then(function (result) {
      result = result || {};
      result.__requestId = id;
      return result;
    });
  }

  // Single entry point used by native bridges (legacy: one global callback).
  // Newest waiter wins for unscoped replies; request-scoped replies preferred.
  global.__rrNativeNotifResult = function (payload) {
    try {
      if (typeof payload === 'string') payload = JSON.parse(payload);
    } catch (_) {}
    var scopedId = payload && payload.requestId;
    if (scopedId && pendingCallbacks[scopedId]) {
      pendingCallbacks[scopedId](payload);
      return;
    }
    var ids = Object.keys(pendingCallbacks);
    if (!ids.length) return;
    // Prefer the most recent waiter (enable) over a stale status poll.
    pendingCallbacks[ids[ids.length - 1]](payload);
  };

  function enableViaAndroid() {
    var bridge = global.AndroidNotifications;
    if (!bridge || typeof bridge.enable !== 'function') {
      return Promise.resolve({
        status: 'unsupported',
        platform: 'android',
        message: 'Update the RedsRacing app to enable notifications from this screen.'
      });
    }
    var pending = waitForNativeResult(25000);
    try {
      bridge.enable();
    } catch (e) {
      return Promise.resolve({ status: 'error', platform: 'android', message: String(e && e.message || e) });
    }
    return pending;
  }

  function enableViaIos() {
    var handler = global.webkit && global.webkit.messageHandlers && global.webkit.messageHandlers.redsRacingNotifications;
    if (!handler || typeof handler.postMessage !== 'function') {
      return Promise.resolve({
        status: 'unsupported',
        platform: 'ios',
        message: 'Update the RedsRacing app to enable notifications from this screen.'
      });
    }
    var pending = waitForNativeResult(25000);
    try {
      handler.postMessage({ action: 'enable' });
    } catch (e) {
      return Promise.resolve({ status: 'error', platform: 'ios', message: String(e && e.message || e) });
    }
    return pending;
  }

  function getNativeStatus() {
    return new Promise(function (resolve) {
      try {
        if (isAndroidNative() && global.AndroidNotifications && typeof global.AndroidNotifications.getStatus === 'function') {
          var status = String(global.AndroidNotifications.getStatus() || 'default');
          resolve({ status: status, platform: 'android' });
          return;
        }
        if (isIosNative()) {
          var handler = global.webkit.messageHandlers.redsRacingNotifications;
          if (!handler || typeof handler.postMessage !== 'function') {
            resolve({ status: 'unsupported', platform: 'ios' });
            return;
          }
          var pending = waitForNativeResult(8000);
          handler.postMessage({ action: 'getStatus' });
          pending.then(resolve);
          return;
        }
      } catch (e) {
        resolve({ status: 'error', message: String(e && e.message || e) });
        return;
      }
      resolve({ status: 'unsupported' });
    });
  }

  function enableViaWeb() {
    // iOS Safari/Chrome tabs cannot receive reliable web push for race alerts.
    if (isIosBrowser() && !isStandalonePwa()) {
      return Promise.resolve({
        status: 'unsupported',
        platform: 'ios-browser',
        message: 'On iPhone/iPad, open the RedsRacing app and tap Enable Notifications there to get race reminders.'
      });
    }

    if (!('Notification' in global)) {
      return Promise.resolve({
        status: 'unsupported',
        platform: 'web',
        message: isMobileBrowser()
          ? 'Open the RedsRacing Android or iOS app to enable race reminders on this device.'
          : 'This browser does not support notifications. Use the RedsRacing app for race alerts.'
      });
    }

    var current = Notification.permission;
    if (current === 'granted') {
      markEnabledLocally();
      try {
        new Notification('RedsRacing', {
          body: 'Browser alerts are limited — install the RedsRacing app for race & schedule push notifications.',
          icon: 'favicon.ico',
          badge: 'favicon.ico'
        });
      } catch (_) {}
      return Promise.resolve({ status: 'granted', platform: 'web', already: true });
    }
    if (current === 'denied') {
      return Promise.resolve({
        status: 'denied',
        platform: 'web',
        message: 'Notifications are blocked in browser settings. For reliable race alerts, use the RedsRacing app.'
      });
    }

    // Must stay in the user-gesture turn: callers should invoke enable() from the click handler.
    return Notification.requestPermission().then(function (permission) {
      if (permission === 'granted') {
        markEnabledLocally();
        try {
          new Notification('RedsRacing', {
            body: 'For race reminders and schedule updates, also enable notifications in the RedsRacing app.',
            icon: 'favicon.ico',
            badge: 'favicon.ico'
          });
        } catch (_) {}
      }
      return { status: permission, platform: 'web' };
    });
  }

  function enableNotifications() {
    // Never fall back to the browser Notification API inside a native WebView.
    if (isNativeApp()) {
      if (isAndroidNative()) {
        return enableViaAndroid().then(function (result) {
          if (result && (result.status === 'granted' || result.status === 'already')) {
            markEnabledLocally();
          }
          return result;
        });
      }
      if (isIosNative()) {
        return enableViaIos().then(function (result) {
          if (result && (result.status === 'granted' || result.status === 'already')) {
            markEnabledLocally();
          }
          return result;
        });
      }
      return Promise.resolve({
        status: 'unsupported',
        platform: 'native',
        message: 'Update the RedsRacing app to enable notifications from this screen.'
      });
    }
    return enableViaWeb();
  }

  function applyFollowButtonState(btn, state) {
    if (!btn) return;
    if (state === 'granted' || state === 'already') {
      btn.innerHTML = '<i class="fas fa-check"></i> <span>Notifications On</span>';
      btn.style.background = 'linear-gradient(45deg, #10b981, #059669)';
      btn.disabled = false;
      return;
    }
    if (state === 'denied') {
      btn.innerHTML = '<i class="fas fa-info-circle"></i> <span>Enable in Settings</span>';
      btn.style.background = 'linear-gradient(45deg, #ef4444, #dc2626)';
      btn.disabled = false;
      return;
    }
    if (state === 'settings') {
      btn.innerHTML = '<i class="fas fa-cog"></i> <span>Turn On in Settings</span>';
      btn.style.background = 'linear-gradient(45deg, #f59e0b, #d97706)';
      btn.disabled = false;
      return;
    }
    btn.innerHTML = '<i class="fas fa-bell"></i> <span>Enable Notifications</span>';
    btn.style.background = 'linear-gradient(45deg, #fbbf24, #f59e0b)';
    btn.disabled = false;
  }

  function refreshFollowButton() {
    var btn = document.getElementById('follow-team-btn');
    if (!btn) return Promise.resolve();
    if (isNativeApp()) {
      return getNativeStatus().then(function (res) {
        var status = (res && res.status) || 'default';
        if (status === 'granted' || isMarkedEnabled()) {
          applyFollowButtonState(btn, 'granted');
        } else if (status === 'denied') {
          applyFollowButtonState(btn, 'denied');
        }
      });
    }
    if ('Notification' in global && Notification.permission === 'granted') {
      applyFollowButtonState(btn, 'granted');
    } else if (isMarkedEnabled()) {
      applyFollowButtonState(btn, 'granted');
    }
    return Promise.resolve();
  }

  global.RRNativeNotifications = {
    isNativeApp: isNativeApp,
    isMobileBrowser: isMobileBrowser,
    enable: enableNotifications,
    getStatus: getNativeStatus,
    refreshFollowButton: refreshFollowButton,
    applyFollowButtonState: applyFollowButtonState,
    topicsNote: TOPICS_NOTE
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { refreshFollowButton(); });
  } else {
    refreshFollowButton();
  }
})(window);
