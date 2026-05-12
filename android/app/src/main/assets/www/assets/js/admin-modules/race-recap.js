/**
 * Admin Race Recap Auto-Draft Panel — injects into #admin-extensions
 * Generates a template recap from race_results, allows editing + publish.
 */
(function () {
  'use strict';

  function init() {
    const mount = document.getElementById('admin-extensions');
    if (!mount) return;

    const card = document.createElement('div');
    card.className = 'admin-card';
    card.id = 'panel-race-recap';
    card.innerHTML = `
      <div class="admin-card-header">
        <h3 class="admin-card-title"><i class="fas fa-newspaper" style="color:#fbbf24"></i> Race Recap Auto-Draft</h3>
      </div>
      <div class="admin-card-body">
        <label style="font-size:.82rem;color:#cbd5e1;display:block;margin-bottom:.2rem;">Race ID</label>
        <div style="display:flex;gap:.5rem;margin-bottom:.5rem;">
          <input id="rr-race-id" type="text" placeholder="2026-05-25-golden-sands"
            style="flex:1;background:#0d1a35;border:1px solid rgba(251,191,36,.3);color:#fff;padding:.4rem .7rem;border-radius:6px;font-size:.85rem;" />
          <button id="rr-load-btn" class="btn btn-sm btn-secondary">Generate Draft</button>
        </div>

        <label style="font-size:.82rem;color:#cbd5e1;display:block;margin-bottom:.2rem;">Headline</label>
        <input id="rr-headline" type="text" placeholder="Race recap headline…"
          style="width:100%;background:#0d1a35;border:1px solid rgba(251,191,36,.3);color:#fff;padding:.4rem .7rem;border-radius:6px;font-size:.85rem;box-sizing:border-box;margin-bottom:.5rem;" />

        <label style="font-size:.82rem;color:#cbd5e1;display:block;margin-bottom:.2rem;">Body</label>
        <textarea id="rr-body" rows="5" placeholder="Draft recap text…"
          style="width:100%;background:#0d1a35;border:1px solid rgba(251,191,36,.3);color:#fff;padding:.5rem .7rem;border-radius:6px;font-size:.85rem;box-sizing:border-box;resize:vertical;margin-bottom:.5rem;"></textarea>

        <div style="display:flex;gap:.5rem;">
          <button id="rr-save-btn" class="btn btn-sm btn-secondary" style="flex:1;">Save Draft</button>
          <button id="rr-publish-btn" class="btn btn-sm btn-primary" style="flex:1;">Publish</button>
        </div>
        <div id="rr-status" style="margin-top:.5rem;font-size:.8rem;min-height:1.2em;"></div>
      </div>`;
    mount.appendChild(card);

    document.getElementById('rr-load-btn').addEventListener('click', generateDraft);
    document.getElementById('rr-save-btn').addEventListener('click', function () { saveDraft(false); });
    document.getElementById('rr-publish-btn').addEventListener('click', function () { saveDraft(true); });
  }

  function generateDraft() {
    const db     = window.firebase && window.firebase.firestore && window.firebase.firestore();
    const raceId = document.getElementById('rr-race-id').value.trim();
    const st     = document.getElementById('rr-status');
    if (!db)     { st.textContent = '✗ Firestore not ready'; return; }
    if (!raceId) { st.textContent = '✗ Enter a race ID'; return; }

    st.style.color = '#fbbf24'; st.textContent = 'Loading results…';

    // First check if a recap doc already exists
    db.doc('race_recaps/' + raceId).get().then(function (snap) {
      if (snap.exists) {
        const d = snap.data();
        document.getElementById('rr-headline').value = d.headline || '';
        document.getElementById('rr-body').value     = d.body     || '';
        st.style.color = '#4ade80'; st.textContent = '✓ Loaded existing draft';
        return;
      }
      // Build from race_results
      db.collection('race_results').where('raceId', '==', raceId).get().then(function (resSnap) {
        let jonResult  = null;
        let jonnyResult = null;
        resSnap.forEach(function (doc) {
          const d = doc.data();
          if (d.driverId === 'jon_kirsch')   jonResult   = d;
          if (d.driverId === 'jonny_kirsch') jonnyResult = d;
        });

        const jonPos   = jonResult   ? (jonResult.isDNF   ? 'DNF' : 'P' + jonResult.finishPosition)   : 'TBD';
        const jonnyPos = jonnyResult ? (jonnyResult.isDNF ? 'DNF' : 'P' + jonnyResult.finishPosition) : 'TBD';
        const track    = jonResult   ? (jonResult.trackName  || raceId) :
                         jonnyResult ? (jonnyResult.trackName || raceId) : raceId;
        const date     = raceId.substring(0, 10);

        const headline = `Race Recap — ${track} (${date})`;
        const body = [
          `The RedsRacing team competed at ${track} on ${date}.`,
          ``,
          `Jon (#8) finished ${jonPos}. ${jonResult && jonResult.notes ? jonResult.notes : 'A solid run from start to finish.'}`,
          ``,
          `Jonny (#88) finished ${jonnyPos}. ${jonnyResult && jonnyResult.notes ? jonnyResult.notes : 'Another strong performance from Jonny.'}`,
          ``,
          `Key incident: [Edit here]`,
          ``,
          `Sponsor shoutout: A big thank you to our sponsors for making this race possible!`,
          ``,
          `Next up: [Next race details]`
        ].join('\n');

        document.getElementById('rr-headline').value = headline;
        document.getElementById('rr-body').value     = body;
        st.style.color = '#4ade80'; st.textContent = '✓ Draft generated';
      }).catch(function (e) {
        st.style.color = '#f87171'; st.textContent = '✗ Could not load results: ' + e.message;
      });
    }).catch(function (e) {
      st.style.color = '#f87171'; st.textContent = '✗ ' + e.message;
    });
  }

  function saveDraft(publish) {
    const db       = window.firebase && window.firebase.firestore && window.firebase.firestore();
    const raceId   = document.getElementById('rr-race-id').value.trim();
    const headline = document.getElementById('rr-headline').value.trim();
    const body     = document.getElementById('rr-body').value.trim();
    const st       = document.getElementById('rr-status');
    if (!db)       { st.textContent = '✗ Firestore not ready'; return; }
    if (!raceId)   { st.textContent = '✗ Enter a race ID'; return; }
    if (!headline) { st.textContent = '✗ Enter a headline'; return; }

    const doc = {
      raceId:    raceId,
      headline:  headline,
      body:      body,
      published: publish,
      updatedAt: window.firebase.firestore.FieldValue.serverTimestamp()
    };
    if (publish) {
      doc.publishedAt = window.firebase.firestore.FieldValue.serverTimestamp();
    }

    const btn = publish
      ? document.getElementById('rr-publish-btn')
      : document.getElementById('rr-save-btn');
    btn.disabled = true;

    db.doc('race_recaps/' + raceId).set(doc, { merge: true }).then(function () {
      if (window.logAdminAction) logAdminAction('recap.' + (publish ? 'publish' : 'save'), raceId, {});
      st.style.color = '#4ade80';
      st.textContent = publish ? '✓ Published!' : '✓ Draft saved';
      btn.disabled = false;
    }).catch(function (e) {
      st.style.color = '#f87171'; st.textContent = '✗ ' + e.message;
      btn.disabled = false;
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
