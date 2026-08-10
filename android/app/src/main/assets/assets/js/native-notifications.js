/**
 * Native + web notification opt-in for RedsRacing homepage (and elsewhere).
 * In Android/iOS WebViews the browser Notification API is unavailable — use the
 * native bridge so race reminders / schedule updates can be delivered via FCM.
 */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'rr_notifications_enabled';
  var TOPICS_NOTE = 'race reminders and schedule updates';

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

  function markEnabledLocally() {
    try { localStorage.setItem(STORAGE_KEY, '1'); } catch (_) {}
  }

  function isMarkedEnabled() {
    try { return localStorage.getItem(STORAGE_KEY) === '1'; } catch (_) { return false; }
  }

  function waitForNativeResult(timeoutMs) {
    return new Promise(function (resolve) {
      var done = false;
      var timer = setTimeout(function () {
        if (done) return;
        done = true;
        resolve({ status: 'timeout', message: 'Native notification bridge timed out' });
      }, timeoutMs || 20000);

      global.__rrNativeNotifResult = function (payload) {
        if (done) return;
        done = true;
        clearTimeout(timer);
        try {
          if (typeof payload === 'string') payload = JSON.parse(payload);
        } catch (_) {}
        resolve(payload || { status: 'error' });
      };
    });
  }

  function enableViaAndroid() {
    var bridge = global.AndroidNotifications;
    if (!bridge || typeof bridge.enable !== 'function') {
      return Promise.resolve({ status: 'unsupported', message: 'Android notifications bridge missing' });
    }
    var pending = waitForNativeResult(25000);
    try {
      bridge.enable();
    } catch (e) {
      return Promise.resolve({ status: 'error', message: String(e && e.message || e) });
    }
    return pending;
  }

  function enableViaIos() {
    var handler = global.webkit && global.webkit.messageHandlers && global.webkit.messageHandlers.redsRacingNotifications;
    if (!handler || typeof handler.postMessage !== 'function') {
      return Promise.resolve({ status: 'unsupported', message: 'iOS notifications bridge missing' });
    }
    var pending = waitForNativeResult(25000);
    try {
      handler.postMessage({ action: 'enable' });
    } catch (e) {
      return Promise.resolve({ status: 'error', message: String(e && e.message || e) });
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
    if (!('Notification' in global)) {
      return Promise.resolve({
        status: 'unsupported',
        message: 'This browser does not support notifications.'
      });
    }
    var current = Notification.permission;
    if (current === 'granted') {
      markEnabledLocally();
      try {
        new Notification('RedsRacing', {
          body: 'You are following race reminders and schedule updates.',
          icon: 'favicon.ico',
          badge: 'favicon.ico'
        });
      } catch (_) {}
      return Promise.resolve({ status: 'granted', platform: 'web', already: true });
    }
    if (current === 'denied') {
      return Promise.resolve({
        status: 'denied',
        message: 'Notifications are blocked in browser settings.'
      });
    }
    return Notification.requestPermission().then(function (permission) {
      if (permission === 'granted') {
        markEnabledLocally();
        try {
          new Notification('RedsRacing', {
            body: 'You\'ll get race reminders and schedule updates.',
            icon: 'favicon.ico',
            badge: 'favicon.ico'
          });
        } catch (_) {}
      }
      return { status: permission, platform: 'web' };
    });
  }

  function enableNotifications() {
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
