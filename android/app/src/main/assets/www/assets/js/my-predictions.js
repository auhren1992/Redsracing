/**
 * My Predictions history panel for predictions.html
 * Mounts into #my-predictions-panel when the user is signed in.
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

  function renderPanel(mount, rows, scoreTotal) {
    if (!rows.length) {
      mount.innerHTML =
        '<div class="glass-card p-6">' +
          '<h2 class="text-xl font-bold text-white mb-2 flex items-center"><i class="fas fa-user-check text-yellow-400 mr-3"></i>My Predictions</h2>' +
          '<p class="text-slate-400 text-sm">You have not submitted any predictions yet. Pick the next race above to get on the board.</p>' +
        '</div>';
      return;
    }
    var html = rows.map(function (r) {
      var driver = r.pickedDriver === 'jon' ? 'Jon #8 higher' : (r.pickedDriver === 'jonny' ? 'Jonny #88 higher' : '—');
      var score = (r.score === null || r.score === undefined) ? 'Pending' : (r.score + ' pts');
      var scoreClass = (r.score === null || r.score === undefined) ? 'text-slate-400' : 'text-yellow-400';
      return '<div class="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-lg bg-slate-800/40 border border-slate-700/40">' +
        '<div class="min-w-0">' +
          '<div class="text-white text-sm font-semibold truncate">' + esc(r.raceLabel) + '</div>' +
          '<div class="text-slate-500 text-xs">' + esc(driver) + ' · Jon P' + esc(r.jonFinish) + ' · Jonny P' + esc(r.jonnyFinish) +
            (r.winnerPick ? ' · Winner #' + esc(r.winnerPick) : '') + '</div>' +
        '</div>' +
        '<div class="' + scoreClass + ' font-bold text-sm">' + esc(score) + '</div>' +
      '</div>';
    }).join('');

    mount.innerHTML =
      '<div class="glass-card p-6">' +
        '<div class="flex items-center justify-between mb-4 gap-3 flex-wrap">' +
          '<h2 class="text-xl font-bold text-white flex items-center"><i class="fas fa-user-check text-yellow-400 mr-3"></i>My Predictions</h2>' +
          '<div class="text-sm text-slate-400">Season score: <span class="text-yellow-400 font-bold">' + esc(scoreTotal) + ' pts</span></div>' +
        '</div>' +
        '<div class="space-y-2">' + html + '</div>' +
      '</div>';
  }

  function loadForUser(uid) {
    var mount = document.getElementById('my-predictions-panel');
    var firestore = db();
    if (!mount || !firestore || !uid) return;
    mount.classList.remove('hidden');
    mount.innerHTML = '<div class="glass-card p-6 text-slate-400 text-sm"><i class="fas fa-spinner fa-spin mr-2"></i>Loading your picks…</div>';

    firestore.collection('predictions').where('userId', '==', uid).get().then(function (snap) {
      var docs = [];
      snap.forEach(function (d) { docs.push({ id: d.id, data: d.data() || {} }); });
      if (!docs.length) {
        return firestore.collection('predictions').where('uid', '==', uid).get().then(function (snap2) {
          snap2.forEach(function (d) { docs.push({ id: d.id, data: d.data() || {} }); });
          return docs;
        });
      }
      return docs;
    }).then(function (docs) {
      var raceIds = {};
      docs.forEach(function (d) { if (d.data.raceId) raceIds[d.data.raceId] = true; });
      var ids = Object.keys(raceIds);
      var raceNames = {};
      var chain = Promise.resolve();
      ids.forEach(function (id) {
        chain = chain.then(function () {
          return firestore.collection('races').doc(id).get().then(function (rs) {
            if (rs.exists) {
              var r = rs.data() || {};
              raceNames[id] = r.eventName || r.name || r.track || id;
            } else {
              raceNames[id] = id;
            }
          }).catch(function () { raceNames[id] = id; });
        });
      });
      return chain.then(function () {
        var rows = docs.map(function (d) {
          var v = d.data;
          return {
            raceLabel: raceNames[v.raceId] || v.raceDate || 'Race',
            raceDate: v.raceDate || '',
            pickedDriver: v.pickedDriver,
            jonFinish: v.jonFinish,
            jonnyFinish: v.jonnyFinish,
            winnerPick: v.winnerPick,
            score: v.score
          };
        }).sort(function (a, b) {
          return String(b.raceDate).localeCompare(String(a.raceDate));
        });
        var total = rows.reduce(function (s, r) {
          return s + (typeof r.score === 'number' ? r.score : 0);
        }, 0);
        renderPanel(mount, rows, total);
      });
    }).catch(function (e) {
      console.warn('[my-predictions]', e);
      mount.innerHTML = '<div class="glass-card p-6 text-red-400 text-sm">Could not load your prediction history.</div>';
    });
  }

  function boot() {
    if (!window.firebase || !firebase.auth) return setTimeout(boot, 200);
    firebase.auth().onAuthStateChanged(function (user) {
      var mount = document.getElementById('my-predictions-panel');
      if (!mount) return;
      if (!user) {
        mount.classList.add('hidden');
        mount.innerHTML = '';
        return;
      }
      loadForUser(user.uid);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
