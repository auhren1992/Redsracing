/**
 * Public site banner — reads config/site_banner and shows a top strip.
 * Fields: enabled, message, level (info|warn|urgent), maintenanceMode, linkUrl, linkLabel
 */
(function () {
  'use strict';

  var STYLE_ID = 'rr-site-banner-style';
  var BAR_ID = 'rr-site-banner';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent =
      '#' + BAR_ID + '{position:relative;z-index:9998;width:100%;padding:.7rem 1rem;text-align:center;font:600 .9rem/1.35 system-ui,sans-serif;}' +
      '#' + BAR_ID + '[data-level="info"]{background:linear-gradient(90deg,#0f766e,#115e59);color:#ecfeff;}' +
      '#' + BAR_ID + '[data-level="warn"]{background:linear-gradient(90deg,#b45309,#92400e);color:#fffbeb;}' +
      '#' + BAR_ID + '[data-level="urgent"]{background:linear-gradient(90deg,#b91c1c,#7f1d1d);color:#fef2f2;}' +
      '#' + BAR_ID + ' a{color:inherit;text-decoration:underline;margin-left:.5rem;}' +
      '#' + BAR_ID + ' .rr-banner-close{position:absolute;right:.75rem;top:50%;transform:translateY(-50%);background:transparent;border:0;color:inherit;font-size:1.1rem;cursor:pointer;opacity:.8;}' +
      'body.rr-maintenance #' + BAR_ID + '{position:sticky;top:0;}';
    document.head.appendChild(style);
  }

  function dismissKey(message) {
    return 'rr_banner_dismiss_' + String(message || '').slice(0, 80);
  }

  function render(data) {
    if (!data || !data.enabled || !data.message) return;
    try {
      if (!data.maintenanceMode && sessionStorage.getItem(dismissKey(data.message)) === '1') return;
    } catch (_) {}

    ensureStyle();
    var existing = document.getElementById(BAR_ID);
    if (existing) existing.remove();

    var level = data.level === 'urgent' || data.level === 'warn' ? data.level : 'info';
    var bar = document.createElement('div');
    bar.id = BAR_ID;
    bar.setAttribute('data-level', level);
    bar.setAttribute('role', 'status');

    var html = '<span>' + esc(data.message) + '</span>';
    if (data.linkUrl) {
      html += ' <a href="' + esc(data.linkUrl) + '">' + esc(data.linkLabel || 'Learn more') + '</a>';
    }
    if (!data.maintenanceMode) {
      html += '<button type="button" class="rr-banner-close" aria-label="Dismiss">×</button>';
    }
    bar.innerHTML = html;

    var closeBtn = bar.querySelector('.rr-banner-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', function () {
        try { sessionStorage.setItem(dismissKey(data.message), '1'); } catch (_) {}
        bar.remove();
      });
    }

    document.body.insertBefore(bar, document.body.firstChild);
    if (data.maintenanceMode) {
      document.body.classList.add('rr-maintenance');
    }
  }

  function tryLoad(attempt) {
    attempt = attempt || 0;
    try {
      var path = (window.location.pathname || '').toLowerCase();
      if (path.indexOf('admin-console') !== -1 || path.indexOf('setup-admin') !== -1) return;
      var db = window._rrFirestore || (window.firebase && window.firebase.firestore && window.firebase.firestore());
      if (!db) throw new Error('no db');
      db.doc('config/site_banner').get().then(function (snap) {
        if (snap && snap.exists) render(snap.data() || {});
      }).catch(function () {});
    } catch (_) {
      if (attempt < 40) setTimeout(function () { tryLoad(attempt + 1); }, 250);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { tryLoad(0); });
  } else {
    tryLoad(0);
  }
})();
