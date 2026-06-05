/**
 * Admin Sponsor Mini-CRM Panel — injects into #admin-extensions
 * CRUD for sponsors/{slug} + renewal dashboard widget.
 */
(function () {
  'use strict';

  const TIERS      = ['title', 'gold', 'silver', 'bronze', 'partner'];
  const RENEWALS   = ['pending', 'renewed', 'at-risk', 'lapsed'];

  function init() {
    const mount = document.getElementById('admin-extensions');
    if (!mount) return;

    const card = document.createElement('div');
    card.className = 'admin-card';
    card.id = 'panel-sponsor-crm';
    card.innerHTML = `
      <div class="admin-card-header" style="display:flex;align-items:center;justify-content:space-between;">
        <h3 class="admin-card-title"><i class="fas fa-handshake" style="color:#fbbf24"></i> Sponsor CRM</h3>
        <button id="spn-new-btn" class="btn btn-sm btn-primary" style="font-size:.75rem;">+ New</button>
      </div>
      <div class="admin-card-body">

        <!-- Renewal Alerts widget -->
        <div id="spn-renewal-alerts" style="margin-bottom:.75rem;"></div>

        <!-- Sponsor list -->
        <div id="spn-list" style="max-height:220px;overflow-y:auto;display:flex;flex-direction:column;gap:.3rem;margin-bottom:.75rem;"></div>

        <!-- Edit / New form -->
        <div id="spn-form-wrap" style="display:none;border-top:1px solid rgba(251,191,36,.15);padding-top:.75rem;">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem;margin-bottom:.5rem;">
            <div>
              <label style="font-size:.78rem;color:#94a3b8;">Slug (unique ID)</label>
              <input id="spn-slug" type="text" placeholder="acme-racing"
                style="width:100%;background:#0d1a35;border:1px solid rgba(251,191,36,.3);color:#fff;padding:.35rem .6rem;border-radius:5px;font-size:.82rem;box-sizing:border-box;" />
            </div>
            <div>
              <label style="font-size:.78rem;color:#94a3b8;">Name</label>
              <input id="spn-name" type="text" placeholder="ACME Racing"
                style="width:100%;background:#0d1a35;border:1px solid rgba(251,191,36,.3);color:#fff;padding:.35rem .6rem;border-radius:5px;font-size:.82rem;box-sizing:border-box;" />
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem;margin-bottom:.5rem;">
            <div>
              <label style="font-size:.78rem;color:#94a3b8;">Tier</label>
              <select id="spn-tier"
                style="width:100%;background:#0d1a35;border:1px solid rgba(251,191,36,.3);color:#fff;padding:.35rem .6rem;border-radius:5px;font-size:.82rem;">
                ${TIERS.map(t => `<option value="${t}">${t}</option>`).join('')}
              </select>
            </div>
            <div>
              <label style="font-size:.78rem;color:#94a3b8;">Renewal Status</label>
              <select id="spn-renewal"
                style="width:100%;background:#0d1a35;border:1px solid rgba(251,191,36,.3);color:#fff;padding:.35rem .6rem;border-radius:5px;font-size:.82rem;">
                ${RENEWALS.map(r => `<option value="${r}">${r}</option>`).join('')}
              </select>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem;margin-bottom:.5rem;">
            <div>
              <label style="font-size:.78rem;color:#94a3b8;">Contract Start</label>
              <input id="spn-start" type="date"
                style="width:100%;background:#0d1a35;border:1px solid rgba(251,191,36,.3);color:#fff;padding:.35rem .6rem;border-radius:5px;font-size:.82rem;box-sizing:border-box;" />
            </div>
            <div>
              <label style="font-size:.78rem;color:#94a3b8;">Contract End</label>
              <input id="spn-end" type="date"
                style="width:100%;background:#0d1a35;border:1px solid rgba(251,191,36,.3);color:#fff;padding:.35rem .6rem;border-radius:5px;font-size:.82rem;box-sizing:border-box;" />
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem;margin-bottom:.5rem;">
            <div>
              <label style="font-size:.78rem;color:#94a3b8;">Contact Name</label>
              <input id="spn-contact-name" type="text"
                style="width:100%;background:#0d1a35;border:1px solid rgba(251,191,36,.3);color:#fff;padding:.35rem .6rem;border-radius:5px;font-size:.82rem;box-sizing:border-box;" />
            </div>
            <div>
              <label style="font-size:.78rem;color:#94a3b8;">Contact Email</label>
              <input id="spn-contact-email" type="email"
                style="width:100%;background:#0d1a35;border:1px solid rgba(251,191,36,.3);color:#fff;padding:.35rem .6rem;border-radius:5px;font-size:.82rem;box-sizing:border-box;" />
            </div>
          </div>
          <div style="margin-bottom:.5rem;">
            <label style="font-size:.78rem;color:#94a3b8;">Notes</label>
            <textarea id="spn-notes" rows="2"
              style="width:100%;background:#0d1a35;border:1px solid rgba(251,191,36,.3);color:#fff;padding:.35rem .6rem;border-radius:5px;font-size:.82rem;box-sizing:border-box;resize:vertical;"></textarea>
          </div>
          <div style="display:flex;gap:.5rem;">
            <button id="spn-save-btn" class="btn btn-sm btn-primary" style="flex:1;">Save</button>
            <button id="spn-cancel-btn" class="btn btn-sm btn-secondary" style="flex:1;">Cancel</button>
          </div>
          <div id="spn-status" style="margin-top:.4rem;font-size:.8rem;min-height:1.2em;"></div>
        </div>
      </div>`;
    mount.appendChild(card);

    document.getElementById('spn-new-btn').addEventListener('click', function () { openForm(null); });
    document.getElementById('spn-cancel-btn').addEventListener('click', function () {
      document.getElementById('spn-form-wrap').style.display = 'none';
    });
    document.getElementById('spn-save-btn').addEventListener('click', savesponsor);

    loadSponsors();
  }

  function loadSponsors() {
    const db = window.firebase && window.firebase.firestore && window.firebase.firestore();
    if (!db) return setTimeout(loadSponsors, 600);

    db.collection('sponsors').orderBy('name').get().then(function (snap) {
      renderRenewalAlerts(snap.docs);
      const list = document.getElementById('spn-list');
      if (!list) return;
      if (snap.empty) { list.innerHTML = '<div style="color:#64748b;font-size:.82rem;">No sponsors yet.</div>'; return; }
      list.innerHTML = '';
      snap.forEach(function (doc) {
        const d = doc.data();
        const row = document.createElement('div');
        row.style.cssText = 'background:rgba(255,255,255,.04);padding:.35rem .6rem;border-radius:5px;display:flex;align-items:center;gap:.5rem;font-size:.82rem;cursor:pointer;';
        row.innerHTML = `<span style="color:#fbbf24;font-weight:600;">${escHtml(d.name||doc.id)}</span>
          <span style="color:#64748b;">${escHtml(d.tier||'')} · ${escHtml(d.renewalStatus||'')}</span>
          <span style="margin-left:auto;color:#94a3b8;">${escHtml(d.contractEnd||'')}</span>`;
        row.addEventListener('click', function () { openForm(doc); });
        list.appendChild(row);
      });
    }).catch(function (e) { console.warn('[SponsorCRM] load error', e); });
  }

  function renderRenewalAlerts(docs) {
    const alerts = document.getElementById('spn-renewal-alerts');
    if (!alerts) return;
    const now  = Date.now();
    const soon = [];
    docs.forEach(function (doc) {
      const d = doc.data();
      if (!d.contractEnd) return;
      const end = new Date(d.contractEnd + 'T00:00:00').getTime();
      const days = Math.floor((end - now) / (1000 * 60 * 60 * 24));
      if (days >= 0 && days <= 60) {
        soon.push({ name: d.name || doc.id, days: days, slug: doc.id });
      }
    });
    if (!soon.length) { alerts.innerHTML = ''; return; }
    alerts.innerHTML = '<div style="background:rgba(239,68,68,.12);border:1px solid rgba(239,68,68,.3);border-radius:6px;padding:.5rem .75rem;font-size:.8rem;color:#fca5a5;margin-bottom:.5rem;">' +
      '<strong>⚠ Renewals due within 60 days:</strong> ' +
      soon.map(function (s) { return escHtml(s.name) + ' (' + s.days + 'd)'; }).join(' · ') + '</div>';
  }

  function openForm(doc) {
    const wrap = document.getElementById('spn-form-wrap');
    if (!wrap) return;
    wrap.style.display = 'block';
    const d = doc ? doc.data() : {};
    document.getElementById('spn-slug').value         = doc ? doc.id         : '';
    document.getElementById('spn-slug').readOnly      = !!doc;
    document.getElementById('spn-name').value         = d.name              || '';
    document.getElementById('spn-tier').value         = d.tier              || 'bronze';
    document.getElementById('spn-renewal').value      = d.renewalStatus     || 'pending';
    document.getElementById('spn-start').value        = d.contractStart     || '';
    document.getElementById('spn-end').value          = d.contractEnd       || '';
    document.getElementById('spn-contact-name').value = d.contactName       || '';
    document.getElementById('spn-contact-email').value= d.contactEmail      || '';
    document.getElementById('spn-notes').value        = d.notes             || '';
    document.getElementById('spn-status').textContent = '';
  }

  function savesponsor() {
    const db   = window.firebase && window.firebase.firestore && window.firebase.firestore();
    const slug = document.getElementById('spn-slug').value.trim().replace(/\s+/g, '-').toLowerCase();
    const st   = document.getElementById('spn-status');
    if (!db)   { st.textContent = '✗ Firestore not ready'; return; }
    if (!slug) { st.textContent = '✗ Slug is required';   return; }

    const doc = {
      name:          document.getElementById('spn-name').value.trim(),
      tier:          document.getElementById('spn-tier').value,
      renewalStatus: document.getElementById('spn-renewal').value,
      contractStart: document.getElementById('spn-start').value,
      contractEnd:   document.getElementById('spn-end').value,
      contactName:   document.getElementById('spn-contact-name').value.trim(),
      contactEmail:  document.getElementById('spn-contact-email').value.trim(),
      notes:         document.getElementById('spn-notes').value.trim(),
      updatedAt:     window.firebase.firestore.FieldValue.serverTimestamp(),
    };

    const btn = document.getElementById('spn-save-btn');
    btn.disabled = true;
    db.doc('sponsors/' + slug).set(doc, { merge: true }).then(function () {
      if (window.logAdminAction) logAdminAction('sponsor.save', slug, { name: doc.name });
      st.style.color = '#4ade80'; st.textContent = '✓ Saved';
      btn.disabled = false;
      loadSponsors();
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
