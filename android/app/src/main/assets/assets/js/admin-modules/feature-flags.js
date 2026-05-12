/**
 * Admin Feature Flags Panel — injects into #admin-extensions
 */
(function () {
  'use strict';

  const KNOWN_FLAGS = [
    'enable_predictions_league',
    'enable_driver_of_day',
    'enable_photo_of_week',
    'enable_sponsor_hotspots',
    'enable_fan_passport',
    'enable_audit_log_panel',
    'enable_quick_composer',
    'enable_race_day_hub',
    'enable_bulk_importer'
  ];

  function init() {
    const mount = document.getElementById('admin-extensions');
    if (!mount) return;

    const card = document.createElement('div');
    card.className = 'admin-card';
    card.id = 'panel-feature-flags';
    card.innerHTML = `
      <div class="admin-card-header">
        <h3 class="admin-card-title"><i class="fas fa-toggle-on" style="color:#fbbf24"></i> Feature Flags</h3>
      </div>
      <div class="admin-card-body">
        <div id="ff-flags-list" style="display:flex;flex-direction:column;gap:0.5rem;margin-bottom:1rem;"></div>
        <div style="display:flex;gap:0.5rem;align-items:center;border-top:1px solid rgba(251,191,36,.15);padding-top:.75rem;">
          <input id="ff-new-key" type="text" placeholder="new-flag-key" style="flex:1;background:#0d1a35;border:1px solid rgba(251,191,36,.3);color:#fff;padding:.4rem .7rem;border-radius:6px;font-size:.85rem;" />
          <button id="ff-add-btn" class="btn btn-sm btn-secondary">Add Flag</button>
        </div>
        <button id="ff-save-btn" class="btn btn-sm btn-primary" style="margin-top:.75rem;width:100%;">Save All</button>
        <div id="ff-status" style="margin-top:.5rem;font-size:.8rem;min-height:1.2em;"></div>
      </div>`;
    mount.appendChild(card);

    loadFlags();

    document.getElementById('ff-add-btn').addEventListener('click', function () {
      const key = document.getElementById('ff-new-key').value.trim().replace(/\s+/g,'_');
      if (!key) return;
      if (!document.getElementById('ff-row-' + key)) addFlagRow(key, false);
      document.getElementById('ff-new-key').value = '';
    });

    document.getElementById('ff-save-btn').addEventListener('click', saveFlags);
  }

  function loadFlags() {
    const db = window.firebase && window.firebase.firestore && window.firebase.firestore();
    if (!db) return setTimeout(loadFlags, 500);

    db.doc('config/flags').get().then(function (snap) {
      const data = snap.exists ? snap.data() || {} : {};
      const list  = document.getElementById('ff-flags-list');
      if (!list) return;
      list.innerHTML = '';
      const merged = {};
      KNOWN_FLAGS.forEach(function (k) { merged[k] = false; });
      Object.assign(merged, data);
      Object.entries(merged).forEach(function ([k, v]) { addFlagRow(k, !!v); });
    }).catch(function (e) { console.warn('[FeatureFlags] load error', e); });
  }

  function addFlagRow(key, value) {
    const list = document.getElementById('ff-flags-list');
    if (!list) return;
    if (document.getElementById('ff-row-' + key)) return;
    const row = document.createElement('div');
    row.id = 'ff-row-' + key;
    row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;background:rgba(255,255,255,.04);padding:.4rem .7rem;border-radius:6px;';
    row.innerHTML = `<span style="font-size:.85rem;color:#cbd5e1;font-family:monospace;">${escHtml(key)}</span>
      <label class="rr-toggle" style="cursor:pointer;display:flex;align-items:center;gap:.4rem;">
        <input type="checkbox" data-flag="${escHtml(key)}" ${value ? 'checked' : ''} style="display:none;" />
        <span class="rr-toggle-track" style="width:36px;height:20px;border-radius:10px;background:${value?'#fbbf24':'#334155'};transition:background .2s;display:inline-block;position:relative;">
          <span class="rr-toggle-thumb" style="position:absolute;top:3px;left:${value?'17px':'3px'};width:14px;height:14px;border-radius:50%;background:#fff;transition:left .2s;"></span>
        </span>
      </label>`;
    const chk   = row.querySelector('input');
    const track = row.querySelector('.rr-toggle-track');
    const thumb = row.querySelector('.rr-toggle-thumb');
    chk.addEventListener('change', function () {
      track.style.background = chk.checked ? '#fbbf24' : '#334155';
      thumb.style.left       = chk.checked ? '17px'    : '3px';
    });
    list.appendChild(row);
  }

  function saveFlags() {
    const db  = window.firebase && window.firebase.firestore && window.firebase.firestore();
    const btn = document.getElementById('ff-save-btn');
    const st  = document.getElementById('ff-status');
    if (!db) { st.textContent = '✗ Firestore not ready'; return; }
    btn.disabled = true;
    const updates = {};
    document.querySelectorAll('#ff-flags-list input[data-flag]').forEach(function (c) {
      updates[c.dataset.flag] = c.checked;
    });
    db.doc('config/flags').set(updates, { merge: true }).then(function () {
      if (window.RR && window.RR.flags) window.RR.flags.bust();
      if (window.logAdminAction) logAdminAction('feature_flags.save', 'config/flags', updates);
      st.style.color = '#4ade80';
      st.textContent = '✓ Saved';
      btn.disabled = false;
    }).catch(function (e) {
      st.style.color = '#f87171';
      st.textContent = '✗ ' + e.message;
      btn.disabled = false;
    });
  }

  function escHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
