/**
 * Admin Photo of the Week Panel — injects into #admin-extensions
 */
(function () {
  'use strict';

  function init() {
    const mount = document.getElementById('admin-extensions');
    if (!mount) return;

    const card = document.createElement('div');
    card.className = 'admin-card';
    card.id = 'panel-photo-of-week';
    card.innerHTML = `
      <div class="admin-card-header">
        <h3 class="admin-card-title"><i class="fas fa-star" style="color:#fbbf24"></i> Photo of the Week</h3>
      </div>
      <div class="admin-card-body">
        <div id="potw-current" style="margin-bottom:.75rem;font-size:.85rem;color:#94a3b8;">Loading…</div>
        <label style="display:block;font-size:.82rem;color:#cbd5e1;margin-bottom:.3rem;">Pick image by ID (from gallery_images)</label>
        <div style="display:flex;gap:.5rem;margin-bottom:.5rem;position:relative;">
          <input id="potw-search" type="text" placeholder="Type to search gallery images…"
            style="flex:1;background:#0d1a35;border:1px solid rgba(251,191,36,.3);color:#fff;padding:.4rem .7rem;border-radius:6px;font-size:.85rem;" />
        </div>
        <div id="potw-suggestions" style="background:#0d1a35;border:1px solid rgba(251,191,36,.2);border-radius:6px;max-height:140px;overflow-y:auto;display:none;"></div>
        <input id="potw-image-id" type="hidden" />
        <div id="potw-preview" style="margin:.5rem 0;display:none;">
          <img id="potw-preview-img" src="" style="max-width:100%;max-height:120px;border-radius:6px;border:1px solid rgba(251,191,36,.3);" />
        </div>
        <label style="display:block;font-size:.82rem;color:#cbd5e1;margin-bottom:.3rem;margin-top:.5rem;">Caption</label>
        <input id="potw-caption" type="text" placeholder="Pinned photo caption…"
          style="width:100%;background:#0d1a35;border:1px solid rgba(251,191,36,.3);color:#fff;padding:.4rem .7rem;border-radius:6px;font-size:.85rem;box-sizing:border-box;" />
        <button id="potw-save-btn" class="btn btn-sm btn-primary" style="margin-top:.75rem;width:100%;">Pin This Photo</button>
        <div id="potw-status" style="margin-top:.5rem;font-size:.8rem;min-height:1.2em;"></div>
      </div>`;
    mount.appendChild(card);

    loadCurrent();
    setupSearch();
    document.getElementById('potw-save-btn').addEventListener('click', save);
  }

  function loadCurrent() {
    const db = window.firebase && window.firebase.firestore && window.firebase.firestore();
    if (!db) return setTimeout(loadCurrent, 500);
    db.doc('config/photo_of_the_week').get().then(function (snap) {
      const el = document.getElementById('potw-current');
      if (!el) return;
      if (!snap.exists || !snap.data().imageId) {
        el.innerHTML = '<em>No photo pinned.</em>';
      } else {
        const d = snap.data();
        el.innerHTML = `<strong>Current:</strong> ${escHtml(d.imageId)} — <em>${escHtml(d.caption || '')}</em>`;
        document.getElementById('potw-image-id').value = d.imageId || '';
        document.getElementById('potw-caption').value   = d.caption || '';
        loadImagePreview(d.imageId);
      }
    }).catch(function (e) {
      const el = document.getElementById('potw-current');
      if (el) el.textContent = 'Could not load current pin.';
    });
  }

  function loadImagePreview(imageId) {
    if (!imageId) return;
    const db = window.firebase && window.firebase.firestore && window.firebase.firestore();
    if (!db) return;
    db.doc('gallery_images/' + imageId).get().then(function (snap) {
      if (!snap.exists) return;
      const url = snap.data().url || snap.data().downloadURL || snap.data().imageUrl || '';
      if (url) showPreview(url);
    }).catch(function () {});
  }

  function showPreview(url) {
    const wrap = document.getElementById('potw-preview');
    const img  = document.getElementById('potw-preview-img');
    if (!wrap || !img) return;
    img.src = url;
    wrap.style.display = 'block';
  }

  function setupSearch() {
    const inp  = document.getElementById('potw-search');
    const list = document.getElementById('potw-suggestions');
    if (!inp || !list) return;

    inp.addEventListener('input', function () {
      const q = inp.value.trim().toLowerCase();
      if (!q) { list.style.display = 'none'; return; }
      const db = window.firebase && window.firebase.firestore && window.firebase.firestore();
      if (!db) return;
      db.collection('gallery_images').orderBy('uploadedAt', 'desc').limit(100).get().then(function (snap) {
        const results = [];
        snap.forEach(function (doc) {
          const d = doc.data();
          const label = d.caption || d.altText || d.fileName || doc.id;
          if (label.toLowerCase().includes(q) || doc.id.toLowerCase().includes(q)) {
            results.push({ id: doc.id, label: label, url: d.url || d.downloadURL || '' });
          }
        });
        if (!results.length) { list.style.display = 'none'; return; }
        list.innerHTML = '';
        list.style.display = 'block';
        results.slice(0, 8).forEach(function (r) {
          const item = document.createElement('div');
          item.style.cssText = 'padding:.4rem .7rem;cursor:pointer;color:#cbd5e1;font-size:.82rem;border-bottom:1px solid rgba(255,255,255,.05);display:flex;align-items:center;gap:.5rem;';
          item.innerHTML = r.url ? `<img src="${escHtml(r.url)}" style="width:32px;height:32px;object-fit:cover;border-radius:3px;">` : '';
          item.innerHTML += `<span>${escHtml(r.label)} <span style="color:#64748b;">(${escHtml(r.id)})</span></span>`;
          item.addEventListener('click', function () {
            document.getElementById('potw-image-id').value = r.id;
            inp.value = r.label + ' (' + r.id + ')';
            list.style.display = 'none';
            if (r.url) showPreview(r.url);
          });
          list.appendChild(item);
        });
      }).catch(function () {});
    });
  }

  function save() {
    const db      = window.firebase && window.firebase.firestore && window.firebase.firestore();
    const imageId = (document.getElementById('potw-image-id').value || '').trim();
    const caption = (document.getElementById('potw-caption').value || '').trim();
    const btn     = document.getElementById('potw-save-btn');
    const st      = document.getElementById('potw-status');
    if (!db)      { st.textContent = '✗ Firestore not ready'; return; }
    if (!imageId) { st.textContent = '✗ Select an image first'; return; }
    btn.disabled = true;
    db.doc('config/photo_of_the_week').set({
      imageId:  imageId,
      caption:  caption,
      pinnedAt: window.firebase.firestore.FieldValue.serverTimestamp()
    }).then(function () {
      if (window.logAdminAction) logAdminAction('photo_of_week.set', imageId, { caption: caption });
      st.style.color = '#4ade80';
      st.textContent = '✓ Pinned!';
      loadCurrent();
      btn.disabled = false;
    }).catch(function (e) {
      st.style.color = '#f87171';
      st.textContent = '✗ ' + e.message;
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
