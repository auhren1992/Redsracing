/**
 * Admin Fan Passport Panel — injects into #admin-extensions
 * Generates QR code for each race check-in. Behind enable_fan_passport.
 * QR code is a data URL generated client-side using a simple QR matrix library fallback
 * or just linking to qrserver.com (already in img-src: https:).
 */
(function () {
  'use strict';

  function init() {
    var mount = document.getElementById('admin-extensions');
    if (!mount) return;

    var card = document.createElement('div');
    card.className = 'admin-card';
    card.id = 'panel-fan-passport';
    card.innerHTML = `
      <div class="admin-card-header">
        <h3 class="admin-card-title"><i class="fas fa-passport" style="color:#fbbf24"></i> Fan Passport</h3>
      </div>
      <div class="admin-card-body">
        <label style="font-size:.82rem;color:#cbd5e1;display:block;margin-bottom:.2rem;">Race ID</label>
        <div style="display:flex;gap:.5rem;margin-bottom:.75rem;">
          <input id="fp-race-id" type="text" placeholder="2026-05-25-golden-sands"
            style="flex:1;background:#0d1a35;border:1px solid rgba(251,191,36,.3);color:#fff;padding:.4rem .7rem;border-radius:6px;font-size:.85rem;" />
          <button id="fp-gen-btn" class="btn btn-sm btn-primary">Generate QR</button>
        </div>

        <div id="fp-qr-wrap" style="display:none;text-align:center;margin-bottom:.75rem;">
          <img id="fp-qr-img" src="" alt="QR Code" style="width:160px;height:160px;border-radius:8px;border:2px solid rgba(251,191,36,.3);" />
          <div style="font-size:.78rem;color:#64748b;margin-top:.3rem;">Fans scan to check in</div>
          <div id="fp-qr-url" style="font-size:.7rem;color:#475569;word-break:break-all;margin-top:.2rem;"></div>
        </div>

        <div style="border-top:1px solid rgba(251,191,36,.12);padding-top:.6rem;">
          <div style="font-size:.78rem;color:#64748b;margin-bottom:.3rem;">Stamp counts:</div>
          <div id="fp-stamp-counts" style="font-size:.82rem;"></div>
        </div>

        <div id="fp-status" style="margin-top:.5rem;font-size:.8rem;min-height:1.2em;"></div>
      </div>`;
    mount.appendChild(card);

    document.getElementById('fp-gen-btn').addEventListener('click', generateQR);
  }

  function generateQR() {
    var raceId = (document.getElementById('fp-race-id').value || '').trim();
    var st     = document.getElementById('fp-status');
    if (!raceId) { st.textContent = '✗ Enter a race ID'; return; }

    // Checkin URL
    var checkInUrl = 'https://www.redsracing.org/passport/' + encodeURIComponent(raceId);

    // Use QR server API (img-src: https: allows this)
    var qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=' + encodeURIComponent(checkInUrl);

    var qrWrap = document.getElementById('fp-qr-wrap');
    var qrImg  = document.getElementById('fp-qr-img');
    var qrUrlEl= document.getElementById('fp-qr-url');
    if (!qrWrap || !qrImg) return;
    qrImg.src = qrUrl;
    qrUrlEl.textContent = checkInUrl;
    qrWrap.style.display = 'block';
    st.style.color = '#4ade80'; st.textContent = '✓ QR generated';

    // Load stamp counts for this race
    loadStampCounts(raceId);
  }

  function loadStampCounts(raceId) {
    var db = window.firebase && window.firebase.firestore && window.firebase.firestore();
    var el = document.getElementById('fp-stamp-counts');
    if (!db || !el) return;
    // Get users who have a stamp for this race — limit 20
    db.collectionGroup('passport_stamps').where('raceId', '==', raceId).get().then(function (snap) {
      el.textContent = snap.size + ' fan(s) checked in for this race.';
    }).catch(function () {
      // collectionGroup might not work without index — fallback
      el.textContent = 'Could not load counts (may need Firestore index).';
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
