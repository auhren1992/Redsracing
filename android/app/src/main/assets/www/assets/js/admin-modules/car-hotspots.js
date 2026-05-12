/**
 * Admin Car Hotspots Panel — injects into #admin-extensions
 * Manages sponsor hotspot positions on driver.html / jonny.html car images.
 * Positions stored in config/car_hotspots/{driver} as array of {x, y, sponsorSlug}.
 */
(function () {
  'use strict';

  function init() {
    const mount = document.getElementById('admin-extensions');
    if (!mount) return;

    const card = document.createElement('div');
    card.className = 'admin-card';
    card.id = 'panel-car-hotspots';
    card.innerHTML = `
      <div class="admin-card-header">
        <h3 class="admin-card-title"><i class="fas fa-map-pin" style="color:#fbbf24"></i> Sponsor Hotspots</h3>
      </div>
      <div class="admin-card-body">
        <label style="font-size:.82rem;color:#cbd5e1;display:block;margin-bottom:.3rem;">Driver page</label>
        <div style="display:flex;gap:.5rem;margin-bottom:.75rem;">
          <select id="hs-driver" style="flex:1;background:#0d1a35;border:1px solid rgba(251,191,36,.3);color:#fff;padding:.4rem .7rem;border-radius:6px;font-size:.85rem;">
            <option value="jon">Jon (#8) — driver.html</option>
            <option value="jonny">Jonny (#88) — jonny.html</option>
          </select>
          <button id="hs-load-btn" class="btn btn-sm btn-secondary">Load</button>
        </div>

        <div id="hs-hotspot-list" style="display:flex;flex-direction:column;gap:.4rem;margin-bottom:.75rem;max-height:180px;overflow-y:auto;"></div>

        <div style="border-top:1px solid rgba(251,191,36,.12);padding-top:.6rem;margin-bottom:.5rem;">
          <div style="font-size:.78rem;color:#94a3b8;margin-bottom:.35rem;">Add hotspot</div>
          <div style="display:grid;grid-template-columns:1fr 1fr 2fr;gap:.4rem;">
            <input id="hs-x" type="number" min="0" max="100" placeholder="X%"
              style="background:#0d1a35;border:1px solid rgba(251,191,36,.3);color:#fff;padding:.35rem .5rem;border-radius:5px;font-size:.82rem;" />
            <input id="hs-y" type="number" min="0" max="100" placeholder="Y%"
              style="background:#0d1a35;border:1px solid rgba(251,191,36,.3);color:#fff;padding:.35rem .5rem;border-radius:5px;font-size:.82rem;" />
            <input id="hs-slug" type="text" placeholder="sponsor-slug"
              style="background:#0d1a35;border:1px solid rgba(251,191,36,.3);color:#fff;padding:.35rem .5rem;border-radius:5px;font-size:.82rem;" />
          </div>
          <button id="hs-add-btn" class="btn btn-sm btn-secondary" style="margin-top:.4rem;width:100%;">Add Hotspot</button>
        </div>

        <button id="hs-save-btn" class="btn btn-sm btn-primary" style="width:100%;">Save Hotspots</button>
        <div id="hs-status" style="margin-top:.4rem;font-size:.8rem;min-height:1.2em;"></div>
      </div>`;
    mount.appendChild(card);

    document.getElementById('hs-load-btn').addEventListener('click', loadHotspots);
    document.getElementById('hs-add-btn').addEventListener('click', addRow);
    document.getElementById('hs-save-btn').addEventListener('click', saveHotspots);
  }

  var _hotspots = [];

  function loadHotspots() {
    const db     = window.firebase && window.firebase.firestore && window.firebase.firestore();
    const driver = document.getElementById('hs-driver').value;
    const st     = document.getElementById('hs-status');
    if (!db) { st.textContent = '✗ Firestore not ready'; return; }
    st.style.color = '#fbbf24'; st.textContent = 'Loading…';
    db.doc('config/car_hotspots').get().then(function (snap) {
      _hotspots = [];
      if (snap.exists && snap.data()[driver]) {
        _hotspots = snap.data()[driver] || [];
      }
      renderList();
      st.textContent = '';
    }).catch(function (e) { st.style.color = '#f87171'; st.textContent = '✗ ' + e.message; });
  }

  function renderList() {
    const list = document.getElementById('hs-hotspot-list');
    if (!list) return;
    if (!_hotspots.length) { list.innerHTML = '<div style="color:#64748b;font-size:.82rem;">No hotspots.</div>'; return; }
    list.innerHTML = '';
    _hotspots.forEach(function (h, i) {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:.4rem;background:rgba(255,255,255,.04);padding:.35rem .5rem;border-radius:5px;font-size:.82rem;';
      row.innerHTML = `<span style="color:#fbbf24;min-width:2.5rem;">x:${h.x}%</span>
        <span style="color:#94a3b8;min-width:2.5rem;">y:${h.y}%</span>
        <span style="color:#e2e8f0;flex:1;">${escHtml(h.sponsorSlug)}</span>
        <button data-idx="${i}" class="hs-del-btn" style="background:rgba(239,68,68,.2);border:none;color:#f87171;padding:.2rem .45rem;border-radius:4px;cursor:pointer;font-size:.75rem;">✕</button>`;
      list.appendChild(row);
    });
    list.querySelectorAll('.hs-del-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        _hotspots.splice(parseInt(btn.dataset.idx), 1);
        renderList();
      });
    });
  }

  function addRow() {
    const x    = parseInt(document.getElementById('hs-x').value);
    const y    = parseInt(document.getElementById('hs-y').value);
    const slug = document.getElementById('hs-slug').value.trim();
    if (isNaN(x) || isNaN(y) || !slug) {
      document.getElementById('hs-status').textContent = '✗ Fill in X, Y, and sponsor slug';
      return;
    }
    _hotspots.push({ x: x, y: y, sponsorSlug: slug });
    renderList();
    document.getElementById('hs-x').value = '';
    document.getElementById('hs-y').value = '';
    document.getElementById('hs-slug').value = '';
  }

  function saveHotspots() {
    const db     = window.firebase && window.firebase.firestore && window.firebase.firestore();
    const driver = document.getElementById('hs-driver').value;
    const st     = document.getElementById('hs-status');
    const btn    = document.getElementById('hs-save-btn');
    if (!db) { st.textContent = '✗ Firestore not ready'; return; }
    btn.disabled = true;
    const update = {};
    update[driver] = _hotspots;
    db.doc('config/car_hotspots').set(update, { merge: true }).then(function () {
      if (window.logAdminAction) logAdminAction('car_hotspot.save', driver, { count: _hotspots.length });
      st.style.color = '#4ade80'; st.textContent = '✓ Saved ' + _hotspots.length + ' hotspot(s)';
      btn.disabled = false;
    }).catch(function (e) {
      st.style.color = '#f87171'; st.textContent = '✗ ' + e.message;
      btn.disabled = false;
    });
  }

  function escHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
