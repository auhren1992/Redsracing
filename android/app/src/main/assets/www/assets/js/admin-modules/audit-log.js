/**
 * Admin Audit Log Panel — injects into #admin-extensions
 * Shows last 50 admin_audit entries, live onSnapshot.
 */
(function () {
  'use strict';

  const ACTION_TYPES = [
    'all',
    'feature_flags.save',
    'photo_of_week.set',
    'race_day.update',
    'predictions.score',
    'sponsor.save',
    'car_hotspot.save',
    'push.send',
    'recap.publish',
    'passport.checkin'
  ];

  let _unsub = null;

  function init() {
    const mount = document.getElementById('admin-extensions');
    if (!mount) return;

    const card = document.createElement('div');
    card.className = 'admin-card';
    card.id = 'panel-audit-log';
    card.innerHTML = `
      <div class="admin-card-header">
        <h3 class="admin-card-title"><i class="fas fa-clipboard-list" style="color:#fbbf24"></i> Admin Audit Log</h3>
      </div>
      <div class="admin-card-body">
        <div id="audit-filter-chips" style="display:flex;flex-wrap:wrap;gap:.4rem;margin-bottom:.75rem;"></div>
        <div id="audit-entries" style="font-size:.78rem;font-family:monospace;max-height:340px;overflow-y:auto;display:flex;flex-direction:column;gap:.3rem;"></div>
        <div id="audit-status" style="font-size:.75rem;color:#64748b;margin-top:.4rem;"></div>
      </div>`;
    mount.appendChild(card);

    buildFilterChips();
    subscribe('all');
  }

  function buildFilterChips() {
    const el = document.getElementById('audit-filter-chips');
    if (!el) return;
    ACTION_TYPES.forEach(function (type) {
      const chip = document.createElement('button');
      chip.className = 'btn btn-sm ' + (type === 'all' ? 'btn-primary' : 'btn-secondary');
      chip.style.cssText = 'font-size:.72rem;padding:.2rem .55rem;';
      chip.textContent = type === 'all' ? 'All' : type;
      chip.dataset.filter = type;
      chip.addEventListener('click', function () {
        document.querySelectorAll('#audit-filter-chips button').forEach(function (b) {
          b.className = 'btn btn-sm btn-secondary';
          b.style.cssText = 'font-size:.72rem;padding:.2rem .55rem;';
        });
        chip.className = 'btn btn-sm btn-primary';
        chip.style.cssText = 'font-size:.72rem;padding:.2rem .55rem;';
        subscribe(type);
      });
      el.appendChild(chip);
    });
  }

  function subscribe(filterAction) {
    if (_unsub) { try { _unsub(); } catch (_) {} }
    const db = window.firebase && window.firebase.firestore && window.firebase.firestore();
    if (!db) return setTimeout(function () { subscribe(filterAction); }, 600);

    const st = document.getElementById('audit-status');
    if (st) st.textContent = 'Loading…';

    let q = db.collection('admin_audit').orderBy('ts', 'desc').limit(50);
    if (filterAction && filterAction !== 'all') {
      q = q.where('action', '==', filterAction);
    }

    _unsub = q.onSnapshot(function (snap) {
      const el = document.getElementById('audit-entries');
      if (!el) return;
      if (snap.empty) {
        el.innerHTML = '<div style="color:#64748b;padding:.5rem;">No entries yet.</div>';
        if (st) st.textContent = '0 entries';
        return;
      }
      const rows = [];
      snap.forEach(function (doc) {
        const d = doc.data();
        const ts = d.ts ? new Date(d.ts.toMillis()).toLocaleString() : '—';
        rows.push(
          `<div style="background:rgba(255,255,255,.04);padding:.35rem .6rem;border-radius:5px;border-left:2px solid #fbbf24;">
            <span style="color:#fbbf24;">${escHtml(d.action)}</span>
            <span style="color:#94a3b8;"> → ${escHtml(d.target)}</span>
            <span style="color:#475569;float:right;">${escHtml(ts)}</span>
            <div style="color:#64748b;font-size:.72rem;">${escHtml(d.email)} · uid:${escHtml(d.uid)}</div>
          </div>`
        );
      });
      el.innerHTML = rows.join('');
      if (st) st.textContent = snap.size + ' entries';
    }, function (e) {
      console.warn('[AuditLog] snapshot error', e);
      if (st) st.textContent = 'Error: ' + e.message;
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
