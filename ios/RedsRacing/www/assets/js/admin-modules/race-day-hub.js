/**
 * Admin Race-Day Hub Panel — injects into #admin-extensions
 * Manages per-race "What to watch for" notes and live fan updates feed.
 */
(function () {
  'use strict';

  function init() {
    const mount = document.getElementById('admin-extensions');
    if (!mount) return;

    const card = document.createElement('div');
    card.className = 'admin-card';
    card.id = 'panel-race-day-hub';
    card.innerHTML = `
      <div class="admin-card-header">
        <h3 class="admin-card-title"><i class="fas fa-flag-checkered" style="color:#fbbf24"></i> Race-Day Hub</h3>
      </div>
      <div class="admin-card-body">
        <label style="font-size:.82rem;color:#cbd5e1;display:block;margin-bottom:.3rem;">Race ID (e.g. 2026-05-25-golden-sands)</label>
        <input id="rdh-race-id" type="text" placeholder="YYYY-MM-DD-track-slug"
          style="width:100%;background:#0d1a35;border:1px solid rgba(251,191,36,.3);color:#fff;padding:.4rem .7rem;border-radius:6px;font-size:.85rem;box-sizing:border-box;margin-bottom:.5rem;" />

        <label style="font-size:.82rem;color:#cbd5e1;display:block;margin-bottom:.3rem;">"What to Watch For" notes (markdown-lite)</label>
        <textarea id="rdh-notes" rows="4" placeholder="• Watch for Jon's #8 in traffic on restarts…"
          style="width:100%;background:#0d1a35;border:1px solid rgba(251,191,36,.3);color:#fff;padding:.5rem .7rem;border-radius:6px;font-size:.85rem;box-sizing:border-box;resize:vertical;"></textarea>
        <button id="rdh-save-notes-btn" class="btn btn-sm btn-primary" style="margin-top:.5rem;width:100%;">Save Notes</button>

        <div style="border-top:1px solid rgba(251,191,36,.12);margin:.75rem 0;"></div>

        <label style="font-size:.82rem;color:#cbd5e1;display:block;margin-bottom:.3rem;">Post a Live Update</label>
        <input id="rdh-update-text" type="text" placeholder="Short update from the track…"
          style="width:100%;background:#0d1a35;border:1px solid rgba(251,191,36,.3);color:#fff;padding:.4rem .7rem;border-radius:6px;font-size:.85rem;box-sizing:border-box;margin-bottom:.5rem;" />
        <button id="rdh-post-btn" class="btn btn-sm btn-secondary" style="width:100%;">Post Update</button>

        <div id="rdh-status" style="margin-top:.5rem;font-size:.8rem;min-height:1.2em;"></div>

        <div style="border-top:1px solid rgba(251,191,36,.12);margin:.75rem 0;"></div>
        <div style="font-size:.78rem;color:#64748b;margin-bottom:.3rem;">Recent updates for this race ID:</div>
        <div id="rdh-updates-list" style="font-size:.78rem;max-height:160px;overflow-y:auto;display:flex;flex-direction:column;gap:.25rem;"></div>
      </div>`;
    mount.appendChild(card);

    document.getElementById('rdh-save-notes-btn').addEventListener('click', saveNotes);
    document.getElementById('rdh-post-btn').addEventListener('click', postUpdate);
    document.getElementById('rdh-race-id').addEventListener('change', loadUpdates);
  }

  function saveNotes() {
    const db     = window.firebase && window.firebase.firestore && window.firebase.firestore();
    const raceId = document.getElementById('rdh-race-id').value.trim();
    const notes  = document.getElementById('rdh-notes').value;
    const st     = document.getElementById('rdh-status');
    if (!db)     { st.textContent = '✗ Firestore not ready'; return; }
    if (!raceId) { st.textContent = '✗ Enter a race ID'; return; }
    db.doc('race_notes/' + raceId).set({ notes: notes, updatedAt: window.firebase.firestore.FieldValue.serverTimestamp() }, { merge: true })
      .then(function () {
        if (window.logAdminAction) logAdminAction('race_day.notes', raceId, {});
        st.style.color = '#4ade80'; st.textContent = '✓ Notes saved';
      })
      .catch(function (e) { st.style.color = '#f87171'; st.textContent = '✗ ' + e.message; });
  }

  function postUpdate() {
    const db     = window.firebase && window.firebase.firestore && window.firebase.firestore();
    const raceId = document.getElementById('rdh-race-id').value.trim();
    const text   = document.getElementById('rdh-update-text').value.trim();
    const st     = document.getElementById('rdh-status');
    if (!db)     { st.textContent = '✗ Firestore not ready'; return; }
    if (!raceId) { st.textContent = '✗ Enter a race ID'; return; }
    if (!text)   { st.textContent = '✗ Enter update text'; return; }
    const auth = window.firebase && window.firebase.auth && window.firebase.auth();
    const user = auth ? auth.currentUser : null;
    db.collection('race_updates').doc(raceId).collection('posts').add({
      text:      text,
      author:    user ? (user.displayName || user.email || 'Admin') : 'Admin',
      createdAt: window.firebase.firestore.FieldValue.serverTimestamp()
    }).then(function () {
      if (window.logAdminAction) logAdminAction('race_day.update', raceId, { text: text });
      document.getElementById('rdh-update-text').value = '';
      st.style.color = '#4ade80'; st.textContent = '✓ Update posted';
      loadUpdates();
    }).catch(function (e) { st.style.color = '#f87171'; st.textContent = '✗ ' + e.message; });
  }

  function loadUpdates() {
    const db     = window.firebase && window.firebase.firestore && window.firebase.firestore();
    const raceId = document.getElementById('rdh-race-id').value.trim();
    const list   = document.getElementById('rdh-updates-list');
    if (!db || !raceId || !list) return;
    db.collection('race_updates').doc(raceId).collection('posts')
      .orderBy('createdAt', 'desc').limit(20)
      .get().then(function (snap) {
        if (snap.empty) { list.innerHTML = '<div style="color:#64748b;">No updates yet.</div>'; return; }
        const rows = [];
        snap.forEach(function (doc) {
          const d  = doc.data();
          const ts = d.createdAt ? new Date(d.createdAt.toMillis()).toLocaleTimeString() : '—';
          rows.push(`<div style="background:rgba(255,255,255,.04);padding:.3rem .5rem;border-radius:4px;">
            <span style="color:#e2e8f0;">${escHtml(d.text)}</span>
            <span style="color:#475569;float:right;font-size:.72rem;">${escHtml(ts)}</span>
          </div>`);
        });
        list.innerHTML = rows.join('');
      }).catch(function () {});
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
