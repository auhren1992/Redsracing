/**
 * Sponsor Hotspots — overlays clickable dots on the car image.
 * Reads config/car_hotspots (top-level doc) and sponsors/{slug}.
 * Behind enable_sponsor_hotspots flag.
 * Usage: include on driver.html and jonny.html, call:
 *   window.RR.hotspots.init('jon', '#the-car img')
 *   window.RR.hotspots.init('jonny', '#the-car img')
 */
(function () {
  'use strict';

  window.RR = window.RR || {};

  function init(driverKey, imgSelector) {
    var rrf = window.RR && window.RR.flags;
    var flagP = rrf ? rrf.get('enable_sponsor_hotspots', false) : Promise.resolve(false);
    flagP.then(function (enabled) {
      if (!enabled) return;
      var db = window.firebase && window.firebase.firestore && window.firebase.firestore();
      if (!db) return setTimeout(function () { init(driverKey, imgSelector); }, 500);

      // Load hotspots config
      db.doc('config/car_hotspots').get().then(function (snap) {
        if (!snap.exists) return;
        var hotspots = (snap.data()[driverKey]) || [];
        if (!hotspots.length) return;
        attachOverlays(hotspots, imgSelector, db);
      }).catch(function (e) { console.warn('[Hotspots] load error', e); });
    });
  }

  function attachOverlays(hotspots, imgSelector, db) {
    var img = document.querySelector(imgSelector);
    if (!img) return;

    // Ensure parent is position:relative
    var wrap = img.parentElement;
    var wrapPos = window.getComputedStyle(wrap).position;
    if (wrapPos === 'static') wrap.style.position = 'relative';

    // Create modal
    var modal = document.createElement('div');
    modal.id = 'hs-modal';
    modal.style.cssText = 'display:none;position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.7);align-items:center;justify-content:center;';
    modal.innerHTML = '<div id="hs-modal-inner" style="background:#0a1228;border:1px solid rgba(251,191,36,.4);border-radius:12px;padding:1.5rem;max-width:380px;width:90%;position:relative;">' +
      '<button id="hs-modal-close" style="position:absolute;top:.6rem;right:.8rem;background:none;border:none;color:#94a3b8;font-size:1.1rem;cursor:pointer;">✕</button>' +
      '<div id="hs-modal-body"></div></div>';
    document.body.appendChild(modal);
    document.getElementById('hs-modal-close').addEventListener('click', function () { modal.style.display = 'none'; });
    modal.addEventListener('click', function (e) { if (e.target === modal) modal.style.display = 'none'; });

    hotspots.forEach(function (h) {
      var dot = document.createElement('button');
      dot.style.cssText = 'position:absolute;left:' + h.x + '%;top:' + h.y + '%;width:20px;height:20px;background:#fbbf24;border:2px solid #fff;border-radius:50%;cursor:pointer;transform:translate(-50%,-50%);animation:hsPulse 2s ease-in-out infinite;z-index:10;';
      dot.title = h.sponsorSlug;
      wrap.appendChild(dot);

      dot.addEventListener('click', function () {
        db.doc('sponsors/' + h.sponsorSlug).get().then(function (snap) {
          var d = snap.exists ? snap.data() : { name: h.sponsorSlug };
          var body = document.getElementById('hs-modal-body');
          if (!body) return;
          body.innerHTML = '<div style="font-size:.75rem;color:#fbbf24;text-transform:uppercase;letter-spacing:.08em;margin-bottom:.3rem;">' + escHtml(d.tier || 'Sponsor') + '</div>' +
            '<h3 style="font-size:1.2rem;font-weight:700;color:#fff;margin-bottom:.5rem;">' + escHtml(d.name || h.sponsorSlug) + '</h3>' +
            (d.blurb ? '<p style="color:#94a3b8;font-size:.9rem;margin-bottom:.75rem;">' + escHtml(d.blurb) + '</p>' : '') +
            (d.ctaUrl ? '<a href="' + escHtml(d.ctaUrl) + '" target="_blank" rel="noopener" style="display:inline-block;background:#fbbf24;color:#000;font-weight:700;padding:.4rem .9rem;border-radius:6px;font-size:.85rem;text-decoration:none;">Learn More →</a>' : '') +
            (d.logoUrl ? '<div style="margin-top:.75rem;"><img src="' + escHtml(d.logoUrl) + '" style="max-height:48px;max-width:100%;" alt="' + escHtml(d.name || '') + '" /></div>' : '');
          modal.style.display = 'flex';
        }).catch(function (e) {
          var body = document.getElementById('hs-modal-body');
          if (body) body.innerHTML = '<p style="color:#f87171;">Could not load sponsor info.</p>';
          modal.style.display = 'flex';
        });
      });
    });

    // Pulse animation
    var style = document.createElement('style');
    style.textContent = '@keyframes hsPulse{0%,100%{box-shadow:0 0 0 0 rgba(251,191,36,.6);}50%{box-shadow:0 0 0 8px rgba(251,191,36,0);}}';
    document.head.appendChild(style);
  }

  function escHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }

  window.RR.hotspots = { init: init };
})();
