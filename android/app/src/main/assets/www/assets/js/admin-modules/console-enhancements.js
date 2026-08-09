/**
 * Admin console enhancements — Overview tools:
 *  - Attention digest (pending work counts)
 *  - Public site banner / maintenance mode
 *  - Staff notes pad
 */
(function () {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function db() {
    return window.firebase && window.firebase.firestore && window.firebase.firestore();
  }

  function toast(msg, type) {
    if (typeof window.showToast === 'function') window.showToast(msg, type);
  }

  function init() {
    var mount = document.getElementById('overview-tools');
    if (!mount || mount.dataset.rrEnhanced === '1') return;
    mount.dataset.rrEnhanced = '1';

    mount.innerHTML =
      '<div class="admin-card rounded-xl p-6">' +
        '<div class="flex items-center justify-between mb-4">' +
          '<h2 class="text-xl font-bold text-white"><i class="fas fa-clipboard-list text-cyan-400 mr-2"></i>Needs Attention</h2>' +
          '<button type="button" id="ce-attn-refresh" class="modern-btn text-white px-3 py-1.5 rounded text-xs"><i class="fas fa-sync mr-1"></i>Refresh</button>' +
        '</div>' +
        '<div id="ce-attn-list" class="space-y-2 text-sm"><div class="text-slate-500">Loading…</div></div>' +
        '<a href="#inbox" class="inline-block mt-4 text-xs text-cyan-400 hover:text-cyan-300">Open full inbox →</a>' +
      '</div>' +

      '<div class="admin-card rounded-xl p-6">' +
        '<h2 class="text-xl font-bold text-white mb-1"><i class="fas fa-bullhorn text-amber-400 mr-2"></i>Site Banner</h2>' +
        '<p class="text-slate-400 text-xs mb-4">Show a public notice across the site. Use maintenance mode for race-night downtime.</p>' +
        '<label class="flex items-center gap-2 text-sm text-slate-300 mb-3 cursor-pointer">' +
          '<input type="checkbox" id="ce-banner-enabled" class="rounded" /> Enable banner' +
        '</label>' +
        '<label class="flex items-center gap-2 text-sm text-slate-300 mb-3 cursor-pointer">' +
          '<input type="checkbox" id="ce-banner-maintenance" class="rounded" /> Maintenance mode (non-dismissible)' +
        '</label>' +
        '<label class="block text-xs text-slate-400 mb-1">Level</label>' +
        '<select id="ce-banner-level" class="modern-input w-full p-2 text-white text-sm mb-3">' +
          '<option value="info">Info</option>' +
          '<option value="warn">Warning</option>' +
          '<option value="urgent">Urgent</option>' +
        '</select>' +
        '<label class="block text-xs text-slate-400 mb-1">Message</label>' +
        '<textarea id="ce-banner-message" rows="2" class="modern-input w-full p-2 text-white text-sm mb-3 resize-none" placeholder="Track day cancelled — new date TBA"></textarea>' +
        '<div class="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">' +
          '<div><label class="block text-xs text-slate-400 mb-1">Optional link URL</label>' +
          '<input id="ce-banner-link" type="url" class="modern-input w-full p-2 text-white text-sm" placeholder="https://…" /></div>' +
          '<div><label class="block text-xs text-slate-400 mb-1">Link label</label>' +
          '<input id="ce-banner-link-label" type="text" class="modern-input w-full p-2 text-white text-sm" placeholder="Details" /></div>' +
        '</div>' +
        '<button type="button" id="ce-banner-save" class="success-btn text-white px-4 py-2 rounded text-sm w-full">' +
          '<i class="fas fa-save mr-2"></i>Save banner' +
        '</button>' +
        '<div id="ce-banner-status" class="text-xs text-slate-400 mt-2 min-h-[1.2em]"></div>' +
      '</div>' +

      '<div class="admin-card rounded-xl p-6" style="grid-column:1/-1;">' +
        '<div class="flex items-center justify-between mb-3">' +
          '<h2 class="text-xl font-bold text-white"><i class="fas fa-sticky-note text-yellow-400 mr-2"></i>Staff Notes</h2>' +
          '<span id="ce-notes-meta" class="text-xs text-slate-500"></span>' +
        '</div>' +
        '<p class="text-slate-400 text-xs mb-3">Shared scratchpad for the team — race-day reminders, passwords to rotate, open tasks.</p>' +
        '<textarea id="ce-staff-notes" rows="5" class="modern-input w-full p-3 text-white text-sm mb-3 resize-y" placeholder="Write notes for other admins…"></textarea>' +
        '<button type="button" id="ce-notes-save" class="modern-btn text-white px-4 py-2 rounded text-sm">' +
          '<i class="fas fa-save mr-2"></i>Save notes' +
        '</button>' +
        '<div id="ce-notes-status" class="text-xs text-slate-400 mt-2 min-h-[1.2em]"></div>' +
      '</div>';

    // Make the overview-tools grid span banner+attention on row 1, notes full width
    mount.style.display = 'grid';
    mount.style.gridTemplateColumns = 'repeat(auto-fit, minmax(300px, 1fr))';
    mount.style.gap = '1.5rem';

    document.getElementById('ce-attn-refresh').addEventListener('click', loadAttention);
    document.getElementById('ce-banner-save').addEventListener('click', saveBanner);
    document.getElementById('ce-notes-save').addEventListener('click', saveNotes);

    loadAttention();
    loadBanner();
    loadNotes();
  }

  function loadAttention() {
    var list = document.getElementById('ce-attn-list');
    var firestore = db();
    if (!list) return;
    if (!firestore) {
      list.innerHTML = '<div class="text-slate-500">Waiting for Firebase…</div>';
      return setTimeout(loadAttention, 400);
    }
    list.innerHTML = '<div class="text-slate-500"><i class="fas fa-spinner fa-spin mr-2"></i>Checking queues…</div>';

    var checks = [
      { label: 'gallery photo(s)', href: '#media', icon: 'fa-images', color: 'text-purple-400',
        run: function () { return firestore.collection('gallery_images').where('approved', '==', false).get(); } },
      { label: 'fan wall post(s)', href: '#fanwall', icon: 'fa-bullhorn', color: 'text-orange-400',
        run: function () { return firestore.collection('fan_wall').where('approved', '==', false).get(); } },
      { label: 'Q&A item(s)', href: '#qna', icon: 'fa-comments', color: 'text-cyan-400',
        run: function () { return firestore.collection('qna_submissions').where('status', '==', 'pending').get(); } },
      { label: 'video(s)', href: '#videos', icon: 'fa-video', color: 'text-pink-400',
        run: function () { return firestore.collection('jonny_videos').where('approved', '==', false).get(); } },
      { label: 'failed push(es)', href: 'push-notifications.html', icon: 'fa-exclamation-circle', color: 'text-red-400',
        run: function () { return firestore.collection('push_notifications').where('status', '==', 'failed').get(); } }
    ];

    Promise.all(checks.map(function (c) {
      return c.run().then(function (snap) {
        return { label: c.label, href: c.href, icon: c.icon, color: c.color, count: snap.size };
      }).catch(function () {
        return { label: c.label, href: c.href, icon: c.icon, color: c.color, count: null };
      });
    })).then(function (rows) {
      var active = rows.filter(function (r) { return r.count && r.count > 0; });
      if (!active.length) {
        list.innerHTML = '<div class="text-green-400 flex items-center gap-2"><i class="fas fa-check-circle"></i> All clear — no pending queues</div>';
        return;
      }
      list.innerHTML = active.map(function (r) {
        return '<a href="' + esc(r.href) + '" class="flex items-center justify-between bg-slate-800/50 border border-slate-700/40 rounded-lg px-3 py-2 hover:border-slate-500/60 transition">' +
          '<span class="text-slate-200"><i class="fas ' + r.icon + ' ' + r.color + ' mr-2"></i>' + esc(r.count + ' ' + r.label) + '</span>' +
          '<i class="fas fa-chevron-right text-slate-500 text-xs"></i></a>';
      }).join('');
    });
  }

  function loadBanner() {
    var firestore = db();
    if (!firestore) return setTimeout(loadBanner, 400);
    firestore.doc('config/site_banner').get().then(function (snap) {
      var d = snap.exists ? (snap.data() || {}) : {};
      var en = document.getElementById('ce-banner-enabled');
      var mt = document.getElementById('ce-banner-maintenance');
      var lv = document.getElementById('ce-banner-level');
      var msg = document.getElementById('ce-banner-message');
      var link = document.getElementById('ce-banner-link');
      var lab = document.getElementById('ce-banner-link-label');
      if (en) en.checked = !!d.enabled;
      if (mt) mt.checked = !!d.maintenanceMode;
      if (lv) lv.value = d.level === 'urgent' || d.level === 'warn' ? d.level : 'info';
      if (msg) msg.value = d.message || '';
      if (link) link.value = d.linkUrl || '';
      if (lab) lab.value = d.linkLabel || '';
    }).catch(function (e) {
      console.warn('[console-enhancements] banner load', e);
    });
  }

  function saveBanner() {
    var firestore = db();
    var status = document.getElementById('ce-banner-status');
    if (!firestore) {
      if (status) status.textContent = 'Firestore not ready';
      return;
    }
    var payload = {
      enabled: !!(document.getElementById('ce-banner-enabled') || {}).checked,
      maintenanceMode: !!(document.getElementById('ce-banner-maintenance') || {}).checked,
      level: (document.getElementById('ce-banner-level') || {}).value || 'info',
      message: ((document.getElementById('ce-banner-message') || {}).value || '').trim(),
      linkUrl: ((document.getElementById('ce-banner-link') || {}).value || '').trim(),
      linkLabel: ((document.getElementById('ce-banner-link-label') || {}).value || '').trim(),
      updatedAt: window.firebase.firestore.FieldValue.serverTimestamp(),
      updatedBy: (window.firebase.auth && window.firebase.auth().currentUser && window.firebase.auth().currentUser.uid) || null
    };
    if (payload.enabled && !payload.message) {
      if (status) { status.style.color = '#f87171'; status.textContent = 'Add a message before enabling.'; }
      return;
    }
    if (status) { status.style.color = '#94a3b8'; status.textContent = 'Saving…'; }
    firestore.doc('config/site_banner').set(payload, { merge: true }).then(function () {
      if (status) { status.style.color = '#4ade80'; status.textContent = 'Banner saved. Public pages pick it up within a few seconds.'; }
      toast('Site banner saved');
      if (window.logAdminAction) {
        try { window.logAdminAction('site_banner.save', 'config/site_banner', { enabled: payload.enabled, maintenanceMode: payload.maintenanceMode }); } catch (_) {}
      }
      var hs = document.getElementById('health-banner-status');
      var hp = document.getElementById('health-banner-preview');
      if (hs) hs.textContent = payload.enabled ? (payload.maintenanceMode ? 'Maintenance ON' : 'Banner ON') : 'Off';
      if (hp) hp.textContent = payload.message ? payload.message.slice(0, 80) : 'No message set';
    }).catch(function (e) {
      if (status) { status.style.color = '#f87171'; status.textContent = 'Save failed: ' + (e.message || e); }
      toast('Failed to save banner', 'error');
    });
  }

  function loadNotes() {
    var firestore = db();
    if (!firestore) return setTimeout(loadNotes, 400);
    firestore.doc('config/staff_notes').get().then(function (snap) {
      var d = snap.exists ? (snap.data() || {}) : {};
      var ta = document.getElementById('ce-staff-notes');
      var meta = document.getElementById('ce-notes-meta');
      if (ta) ta.value = d.notes || '';
      if (meta) {
        var when = d.updatedAt && d.updatedAt.toDate ? d.updatedAt.toDate().toLocaleString() : '';
        meta.textContent = when ? ('Updated ' + when) : '';
      }
    }).catch(function (e) {
      console.warn('[console-enhancements] notes load', e);
    });
  }

  function saveNotes() {
    var firestore = db();
    var status = document.getElementById('ce-notes-status');
    if (!firestore) {
      if (status) status.textContent = 'Firestore not ready';
      return;
    }
    var notes = ((document.getElementById('ce-staff-notes') || {}).value || '');
    if (status) { status.style.color = '#94a3b8'; status.textContent = 'Saving…'; }
    firestore.doc('config/staff_notes').set({
      notes: notes,
      updatedAt: window.firebase.firestore.FieldValue.serverTimestamp(),
      updatedBy: (window.firebase.auth && window.firebase.auth().currentUser && window.firebase.auth().currentUser.uid) || null
    }, { merge: true }).then(function () {
      if (status) { status.style.color = '#4ade80'; status.textContent = 'Notes saved.'; }
      var meta = document.getElementById('ce-notes-meta');
      if (meta) meta.textContent = 'Updated just now';
      toast('Staff notes saved');
      if (window.logAdminAction) {
        try { window.logAdminAction('staff_notes.save', 'config/staff_notes', { length: notes.length }); } catch (_) {}
      }
    }).catch(function (e) {
      if (status) { status.style.color = '#f87171'; status.textContent = 'Save failed: ' + (e.message || e); }
      toast('Failed to save notes', 'error');
    });
  }

  // Prefer auth gate used by other admin modules; fall back to DOM ready.
  function boot() {
    if (window.RR && window.RR.adminAuthReady && typeof window.RR.adminAuthReady.then === 'function') {
      window.RR.adminAuthReady.then(init);
    } else if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  }
  boot();
})();
