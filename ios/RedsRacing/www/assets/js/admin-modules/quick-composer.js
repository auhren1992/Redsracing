/**
 * Admin Quick Post Composer — floating "+" FAB on admin-console.html
 * Behind enable_quick_composer flag.
 * Channels: Fan Wall post, Predictions result entry, Photo of Week pick,
 *           Push notification, Race Recap draft.
 */
(function () {
  'use strict';

  function init() {
    var rrf = window.RR && window.RR.flags;
    var flagP = rrf ? rrf.get('enable_quick_composer', false) : Promise.resolve(false);
    flagP.then(function (enabled) {
      if (!enabled) return;
      injectFAB();
    });
  }

  function injectFAB() {
    // FAB button
    var fab = document.createElement('button');
    fab.id  = 'qc-fab';
    fab.innerHTML = '<i class="fas fa-plus"></i>';
    fab.style.cssText = 'position:fixed;bottom:1.5rem;right:1.5rem;z-index:10000;width:52px;height:52px;border-radius:50%;background:#fbbf24;color:#000;font-size:1.3rem;border:none;cursor:pointer;box-shadow:0 4px 16px rgba(251,191,36,.5);display:flex;align-items:center;justify-content:center;transition:transform .2s;';
    fab.addEventListener('mouseenter', function () { fab.style.transform = 'scale(1.12)'; });
    fab.addEventListener('mouseleave', function () { fab.style.transform = ''; });
    document.body.appendChild(fab);

    // Modal overlay
    var overlay = document.createElement('div');
    overlay.id  = 'qc-overlay';
    overlay.style.cssText = 'display:none;position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.6);backdrop-filter:blur(4px);align-items:center;justify-content:center;';
    overlay.innerHTML = `
      <div id="qc-modal" style="background:#0a1228;border:1px solid rgba(251,191,36,.35);border-radius:14px;padding:1.5rem;max-width:480px;width:92%;position:relative;max-height:90vh;overflow-y:auto;">
        <button id="qc-close" style="position:absolute;top:.6rem;right:.8rem;background:none;border:none;color:#94a3b8;font-size:1.1rem;cursor:pointer;">✕</button>
        <h3 style="font-size:1rem;font-weight:700;color:#fbbf24;margin-bottom:1rem;"><i class="fas fa-bolt" style="margin-right:.4rem;"></i>Quick Composer</h3>

        <label style="font-size:.82rem;color:#94a3b8;display:block;margin-bottom:.3rem;">Channel</label>
        <select id="qc-channel" style="width:100%;background:#0d1a35;border:1px solid rgba(251,191,36,.3);color:#fff;padding:.4rem .7rem;border-radius:6px;font-size:.85rem;margin-bottom:.75rem;">
          <option value="fan-wall">Fan Wall Post</option>
          <option value="predictions">Predictions Result Entry</option>
          <option value="photo-of-week">Photo of the Week</option>
          <option value="push">Push Notification</option>
          <option value="recap">Race Recap Draft</option>
        </select>

        <div id="qc-form-body"></div>

        <div style="display:flex;gap:.5rem;margin-top:.75rem;">
          <button id="qc-submit-btn" class="btn btn-sm btn-primary" style="flex:1;">Submit</button>
          <button id="qc-cancel-btn" class="btn btn-sm btn-secondary">Cancel</button>
        </div>
        <div id="qc-status" style="margin-top:.4rem;font-size:.8rem;min-height:1em;"></div>
      </div>`;
    document.body.appendChild(overlay);

    fab.addEventListener('click', function () {
      overlay.style.display = 'flex';
      renderForm(document.getElementById('qc-channel').value);
    });
    overlay.addEventListener('click', function (e) { if (e.target === overlay) closeModal(); });
    document.getElementById('qc-close').addEventListener('click', closeModal);
    document.getElementById('qc-cancel-btn').addEventListener('click', closeModal);
    document.getElementById('qc-channel').addEventListener('change', function (e) {
      renderForm(e.target.value);
      document.getElementById('qc-status').textContent = '';
    });
    document.getElementById('qc-submit-btn').addEventListener('click', submitForm);
  }

  function closeModal() {
    var overlay = document.getElementById('qc-overlay');
    if (overlay) overlay.style.display = 'none';
  }

  var FORMS = {
    'fan-wall': {
      html: '<label style="font-size:.82rem;color:#94a3b8;display:block;margin-bottom:.2rem;">Post text</label>' +
        '<textarea id="qc-fw-text" rows="3" placeholder="Write your fan wall post…" style="width:100%;background:#0d1a35;border:1px solid rgba(251,191,36,.3);color:#fff;padding:.4rem .7rem;border-radius:6px;font-size:.85rem;resize:vertical;box-sizing:border-box;"></textarea>',
      submit: function (st) {
        var db  = window.firebase && window.firebase.firestore && window.firebase.firestore();
        var auth2 = window.firebase && window.firebase.auth && window.firebase.auth();
        var text = (document.getElementById('qc-fw-text').value || '').trim();
        if (!text) { st.textContent = '✗ Enter post text'; return; }
        var user = auth2 ? auth2.currentUser : null;
        db.collection('fan_wall').add({
          message:     text,
          author:      user ? (user.displayName || user.email || 'Admin') : 'Admin',
          authorUid:   user ? user.uid : 'admin',
          approved:    true,
          createdAt:   window.firebase.firestore.FieldValue.serverTimestamp(),
          source:      'quick_composer',
        }).then(function () {
          if (window.logAdminAction) logAdminAction('fan_wall.post', 'fan_wall', { text: text.substring(0,40) });
          st.style.color = '#4ade80'; st.textContent = '✓ Posted to Fan Wall'; closeModal();
        }).catch(function (e) { st.style.color = '#f87171'; st.textContent = '✗ ' + e.message; });
      }
    },
    'predictions': {
      html: '<label style="font-size:.82rem;color:#94a3b8;display:block;margin-bottom:.2rem;">Race ID</label>' +
        '<input id="qc-pr-race" type="text" placeholder="2026-05-25-golden-sands" style="width:100%;background:#0d1a35;border:1px solid rgba(251,191,36,.3);color:#fff;padding:.35rem .6rem;border-radius:6px;font-size:.82rem;box-sizing:border-box;margin-bottom:.5rem;" />' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:.4rem;">' +
        '<div><label style="font-size:.78rem;color:#94a3b8;">Jon #8 Finish</label><input id="qc-pr-jon" type="number" min="1" max="30" style="width:100%;background:#0d1a35;border:1px solid rgba(251,191,36,.3);color:#fff;padding:.35rem .6rem;border-radius:6px;font-size:.82rem;box-sizing:border-box;" /></div>' +
        '<div><label style="font-size:.78rem;color:#94a3b8;">Jonny #88 Finish</label><input id="qc-pr-jonny" type="number" min="1" max="30" style="width:100%;background:#0d1a35;border:1px solid rgba(251,191,36,.3);color:#fff;padding:.35rem .6rem;border-radius:6px;font-size:.82rem;box-sizing:border-box;" /></div></div>',
      submit: function (st) {
        var db    = window.firebase && window.firebase.firestore && window.firebase.firestore();
        var raceId = (document.getElementById('qc-pr-race').value || '').trim();
        var jon    = parseInt(document.getElementById('qc-pr-jon').value);
        var jonny  = parseInt(document.getElementById('qc-pr-jonny').value);
        if (!raceId) { st.textContent = '✗ Enter race ID'; return; }
        var batch = db.batch();
        if (!isNaN(jon))   batch.set(db.collection('race_results').doc(), { raceId: raceId, driverId: 'jon_kirsch',   finishPosition: jon,   createdAt: window.firebase.firestore.FieldValue.serverTimestamp() });
        if (!isNaN(jonny)) batch.set(db.collection('race_results').doc(), { raceId: raceId, driverId: 'jonny_kirsch', finishPosition: jonny, createdAt: window.firebase.firestore.FieldValue.serverTimestamp() });
        batch.commit().then(function () {
          if (window.logAdminAction) logAdminAction('predictions.result', raceId, { jon: jon, jonny: jonny });
          st.style.color = '#4ade80'; st.textContent = '✓ Results saved'; closeModal();
        }).catch(function (e) { st.style.color = '#f87171'; st.textContent = '✗ ' + e.message; });
      }
    },
    'photo-of-week': {
      html: '<label style="font-size:.82rem;color:#94a3b8;display:block;margin-bottom:.2rem;">Image ID</label>' +
        '<input id="qc-potw-id" type="text" placeholder="gallery_image_doc_id" style="width:100%;background:#0d1a35;border:1px solid rgba(251,191,36,.3);color:#fff;padding:.35rem .6rem;border-radius:6px;font-size:.82rem;box-sizing:border-box;margin-bottom:.4rem;" />' +
        '<label style="font-size:.82rem;color:#94a3b8;display:block;margin-bottom:.2rem;">Caption</label>' +
        '<input id="qc-potw-cap" type="text" placeholder="Caption…" style="width:100%;background:#0d1a35;border:1px solid rgba(251,191,36,.3);color:#fff;padding:.35rem .6rem;border-radius:6px;font-size:.82rem;box-sizing:border-box;" />',
      submit: function (st) {
        var db  = window.firebase && window.firebase.firestore && window.firebase.firestore();
        var id  = (document.getElementById('qc-potw-id').value || '').trim();
        var cap = (document.getElementById('qc-potw-cap').value || '').trim();
        if (!id) { st.textContent = '✗ Enter image ID'; return; }
        db.doc('config/photo_of_the_week').set({ imageId: id, caption: cap, pinnedAt: window.firebase.firestore.FieldValue.serverTimestamp() })
          .then(function () {
            if (window.logAdminAction) logAdminAction('photo_of_week.set', id, {});
            st.style.color = '#4ade80'; st.textContent = '✓ Photo pinned'; closeModal();
          }).catch(function (e) { st.style.color = '#f87171'; st.textContent = '✗ ' + e.message; });
      }
    },
    'push': {
      html: '<label style="font-size:.82rem;color:#94a3b8;display:block;margin-bottom:.2rem;">Title</label>' +
        '<input id="qc-push-title" type="text" placeholder="Push title…" style="width:100%;background:#0d1a35;border:1px solid rgba(251,191,36,.3);color:#fff;padding:.35rem .6rem;border-radius:6px;font-size:.82rem;box-sizing:border-box;margin-bottom:.4rem;" />' +
        '<label style="font-size:.82rem;color:#94a3b8;display:block;margin-bottom:.2rem;">Body</label>' +
        '<textarea id="qc-push-body" rows="2" style="width:100%;background:#0d1a35;border:1px solid rgba(251,191,36,.3);color:#fff;padding:.4rem .6rem;border-radius:6px;font-size:.82rem;resize:vertical;box-sizing:border-box;"></textarea>',
      submit: function (st) {
        var db    = window.firebase && window.firebase.firestore && window.firebase.firestore();
        var title = (document.getElementById('qc-push-title').value || '').trim();
        var body  = (document.getElementById('qc-push-body').value || '').trim();
        if (!title) { st.textContent = '✗ Enter title'; return; }
        db.collection('scheduled_pushes').add({
          title: title, body: body, topic: 'all', audience: 'all', status: 'pending',
          scheduledFor: null, createdAt: window.firebase.firestore.FieldValue.serverTimestamp()
        }).then(function () {
          if (window.logAdminAction) logAdminAction('push.schedule', title, {});
          st.style.color = '#4ade80'; st.textContent = '✓ Push queued'; closeModal();
        }).catch(function (e) { st.style.color = '#f87171'; st.textContent = '✗ ' + e.message; });
      }
    },
    'recap': {
      html: '<label style="font-size:.82rem;color:#94a3b8;display:block;margin-bottom:.2rem;">Race ID</label>' +
        '<input id="qc-recap-race" type="text" placeholder="2026-05-25-golden-sands" style="width:100%;background:#0d1a35;border:1px solid rgba(251,191,36,.3);color:#fff;padding:.35rem .6rem;border-radius:6px;font-size:.82rem;box-sizing:border-box;margin-bottom:.4rem;" />' +
        '<label style="font-size:.82rem;color:#94a3b8;display:block;margin-bottom:.2rem;">Headline</label>' +
        '<input id="qc-recap-hl" type="text" placeholder="Recap headline…" style="width:100%;background:#0d1a35;border:1px solid rgba(251,191,36,.3);color:#fff;padding:.35rem .6rem;border-radius:6px;font-size:.82rem;box-sizing:border-box;" />',
      submit: function (st) {
        var db    = window.firebase && window.firebase.firestore && window.firebase.firestore();
        var raceId = (document.getElementById('qc-recap-race').value || '').trim();
        var hl     = (document.getElementById('qc-recap-hl').value   || '').trim();
        if (!raceId) { st.textContent = '✗ Enter race ID'; return; }
        db.doc('race_recaps/' + raceId).set({
          raceId: raceId, headline: hl || ('Race Recap — ' + raceId), body: '[Edit your recap here]',
          published: false, updatedAt: window.firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true }).then(function () {
          if (window.logAdminAction) logAdminAction('recap.save', raceId, {});
          st.style.color = '#4ade80'; st.textContent = '✓ Draft created'; closeModal();
        }).catch(function (e) { st.style.color = '#f87171'; st.textContent = '✗ ' + e.message; });
      }
    }
  };

  function renderForm(channel) {
    var body = document.getElementById('qc-form-body');
    if (!body) return;
    var def = FORMS[channel];
    body.innerHTML = def ? def.html : '';
  }

  function submitForm() {
    var channel = document.getElementById('qc-channel').value;
    var st      = document.getElementById('qc-status');
    var def     = FORMS[channel];
    if (def && def.submit) def.submit(st);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 400); });
  } else {
    setTimeout(init, 400);
  }
})();
