/**
 * Admin Push Notification Scheduler Panel — injects into #admin-extensions
 * Behind enable_quick_composer (reused) — also standalone.
 */
(function () {
  'use strict';

  const ALLOWED_PAGES = [
    { label: 'Home',        value: '/' },
    { label: 'Schedule',    value: '/schedule.html' },
    { label: 'Race Day Hub',value: '/live.html' },
    { label: 'Leaderboard', value: '/leaderboard.html' },
    { label: 'Predictions', value: '/predictions.html' },
    { label: 'Recaps',      value: '/recaps.html' },
    { label: 'Gallery',     value: '/driver.html#gallery' },
    { label: 'Fan Wall',    value: '/fan-wall.html' }
  ];

  const AUDIENCE_TOPICS = {
    'all':    'all',
    'auth':   'auth',
    'fan-8':  'fan-8',
    'fan-88': 'fan-88'
  };

  function init() {
    const mount = document.getElementById('admin-extensions');
    if (!mount) return;

    const pageOpts = ALLOWED_PAGES.map(function (p) {
      return `<option value="${p.value}">${p.label}</option>`;
    }).join('');

    const card = document.createElement('div');
    card.className = 'admin-card';
    card.id = 'panel-push-scheduler';
    card.innerHTML = `
      <div class="admin-card-header">
        <h3 class="admin-card-title"><i class="fas fa-bell" style="color:#fbbf24"></i> Push Notification Scheduler</h3>
      </div>
      <div class="admin-card-body">
        <label style="font-size:.82rem;color:#cbd5e1;display:block;margin-bottom:.2rem;">Title</label>
        <input id="ps-title" type="text" placeholder="Notification title…"
          style="width:100%;background:#0d1a35;border:1px solid rgba(251,191,36,.3);color:#fff;padding:.4rem .7rem;border-radius:6px;font-size:.85rem;box-sizing:border-box;margin-bottom:.5rem;" />

        <label style="font-size:.82rem;color:#cbd5e1;display:block;margin-bottom:.2rem;">Body</label>
        <textarea id="ps-body" rows="2" placeholder="Notification body…"
          style="width:100%;background:#0d1a35;border:1px solid rgba(251,191,36,.3);color:#fff;padding:.4rem .7rem;border-radius:6px;font-size:.85rem;box-sizing:border-box;resize:vertical;margin-bottom:.5rem;"></textarea>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem;margin-bottom:.5rem;">
          <div>
            <label style="font-size:.82rem;color:#cbd5e1;display:block;margin-bottom:.2rem;">Deeplink Page</label>
            <select id="ps-page" style="width:100%;background:#0d1a35;border:1px solid rgba(251,191,36,.3);color:#fff;padding:.4rem .7rem;border-radius:6px;font-size:.85rem;">
              ${pageOpts}
            </select>
          </div>
          <div>
            <label style="font-size:.82rem;color:#cbd5e1;display:block;margin-bottom:.2rem;">Audience</label>
            <select id="ps-audience" style="width:100%;background:#0d1a35;border:1px solid rgba(251,191,36,.3);color:#fff;padding:.4rem .7rem;border-radius:6px;font-size:.85rem;">
              <option value="all">All users</option>
              <option value="auth">Signed-in</option>
              <option value="fan-8">#8 Fans</option>
              <option value="fan-88">#88 Fans</option>
            </select>
          </div>
        </div>

        <label style="font-size:.82rem;color:#cbd5e1;display:block;margin-bottom:.2rem;">Schedule (leave blank = send now)</label>
        <input id="ps-time" type="datetime-local"
          style="width:100%;background:#0d1a35;border:1px solid rgba(251,191,36,.3);color:#fff;padding:.4rem .7rem;border-radius:6px;font-size:.85rem;box-sizing:border-box;margin-bottom:.5rem;" />

        <button id="ps-send-btn" class="btn btn-sm btn-primary" style="width:100%;">Schedule / Send Now</button>
        <div id="ps-status" style="margin-top:.5rem;font-size:.8rem;min-height:1.2em;"></div>

        <div style="border-top:1px solid rgba(251,191,36,.12);margin:.75rem 0;"></div>
        <div style="font-size:.78rem;color:#64748b;margin-bottom:.3rem;">Pending pushes:</div>
        <div id="ps-pending-list" style="font-size:.78rem;max-height:120px;overflow-y:auto;"></div>
      </div>`;
    mount.appendChild(card);

    document.getElementById('ps-send-btn').addEventListener('click', schedulePush);
    loadPending();
  }

  function schedulePush() {
    const db     = window.firebase && window.firebase.firestore && window.firebase.firestore();
    const title  = document.getElementById('ps-title').value.trim();
    const body   = document.getElementById('ps-body').value.trim();
    const page   = document.getElementById('ps-page').value;
    const aud    = document.getElementById('ps-audience').value;
    const timeEl = document.getElementById('ps-time').value;
    const st     = document.getElementById('ps-status');
    if (!db)    { st.textContent = '✗ Firestore not ready'; return; }
    if (!title) { st.textContent = '✗ Title is required'; return; }
    if (!body)  { st.textContent = '✗ Body is required'; return; }

    const doc = {
      title:        title,
      body:         body,
      deeplink:     page,
      topic:        AUDIENCE_TOPICS[aud] || 'all',
      audience:     aud,
      status:       'pending',
      createdAt:    window.firebase.firestore.FieldValue.serverTimestamp(),
      scheduledFor: timeEl ? new Date(timeEl) : null,
    };

    const btn = document.getElementById('ps-send-btn');
    btn.disabled = true;
    db.collection('scheduled_pushes').add(doc).then(function () {
      if (window.logAdminAction) logAdminAction('push.schedule', title, { audience: aud });
      st.style.color = '#4ade80';
      st.textContent = timeEl ? '✓ Scheduled' : '✓ Queued for immediate dispatch';
      document.getElementById('ps-title').value = '';
      document.getElementById('ps-body').value  = '';
      document.getElementById('ps-time').value  = '';
      btn.disabled = false;
      loadPending();
    }).catch(function (e) {
      st.style.color = '#f87171'; st.textContent = '✗ ' + e.message;
      btn.disabled = false;
    });
  }

  function loadPending() {
    const db   = window.firebase && window.firebase.firestore && window.firebase.firestore();
    const list = document.getElementById('ps-pending-list');
    if (!db || !list) return;
    db.collection('scheduled_pushes').where('status', '==', 'pending')
      .orderBy('createdAt', 'desc').limit(10)
      .get().then(function (snap) {
        if (snap.empty) { list.innerHTML = '<div style="color:#64748b;">No pending pushes.</div>'; return; }
        const rows = [];
        snap.forEach(function (doc) {
          const d = doc.data();
          rows.push(`<div style="background:rgba(255,255,255,.04);padding:.3rem .5rem;border-radius:4px;display:flex;justify-content:space-between;">
            <span style="color:#e2e8f0;">${escHtml(d.title)}</span>
            <span style="color:#64748b;">${escHtml(d.audience || 'all')}</span>
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
