/**
 * Race Night Kit — next-race toolkit for fans.
 * Mount: <div id="rr-race-night-kit"></div>
 * Optional: data-compact="1" for a denser layout.
 *
 * Features: countdown, track deep-link, predict, live, passport, I'm Going RSVP.
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

  function rootPrefix() {
    try {
      var p = (window.location.pathname || '').replace(/\\/g, '/');
      if (/\/(fan|crew|racer)\//i.test(p)) return '../';
    } catch (_) {}
    return '';
  }

  function db() {
    return window._rrFirestore || (window.firebase && window.firebase.firestore && window.firebase.firestore());
  }

  function auth() {
    return window.firebase && window.firebase.auth && window.firebase.auth();
  }

  function parseRaceDate(r) {
    if (!r || !r.date) return null;
    if (r.date.toDate) return r.date.toDate();
    var s = String(r.date);
    var d = new Date(s.indexOf('T') >= 0 ? s : s + 'T19:00:00');
    return isNaN(d.getTime()) ? null : d;
  }

  function trackSlug(track) {
    return String(track || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  function ensureStyles() {
    if (document.getElementById('rr-rnk-style')) return;
    var style = document.createElement('style');
    style.id = 'rr-rnk-style';
    style.textContent =
      '#rr-race-night-kit,.rr-rnk{--rnk-ac:#fbbf24;--rnk-dim:rgba(251,191,36,.18);font-family:Inter,system-ui,sans-serif}' +
      '.rr-rnk-card{background:linear-gradient(145deg,rgba(15,23,42,.92),rgba(10,18,40,.88));border:1px solid var(--rnk-dim);border-radius:1rem;padding:1.15rem 1.25rem;color:#e2e8f0}' +
      '.rr-rnk-kicker{font-size:.65rem;letter-spacing:.14em;text-transform:uppercase;color:var(--rnk-ac);font-weight:800;margin-bottom:.35rem}' +
      '.rr-rnk-title{font-family:"Racing Sans One",cursive,sans-serif;font-size:clamp(1.25rem,3vw,1.7rem);color:#fff;line-height:1.15;margin:0 0 .25rem}' +
      '.rr-rnk-meta{color:#94a3b8;font-size:.85rem;margin-bottom:.85rem}' +
      '.rr-rnk-cd{display:grid;grid-template-columns:repeat(4,1fr);gap:.45rem;margin-bottom:.95rem}' +
      '.rr-rnk-cd div{background:rgba(251,191,36,.06);border:1px solid var(--rnk-dim);border-radius:.55rem;text-align:center;padding:.45rem .2rem}' +
      '.rr-rnk-cd strong{display:block;font-family:"Racing Sans One",cursive;font-size:1.35rem;color:var(--rnk-ac);line-height:1}' +
      '.rr-rnk-cd span{font-size:.58rem;text-transform:uppercase;letter-spacing:.08em;color:#64748b;font-weight:700}' +
      '.rr-rnk-actions{display:grid;grid-template-columns:repeat(2,1fr);gap:.45rem}' +
      '@media(min-width:640px){.rr-rnk-actions{grid-template-columns:repeat(3,1fr)}}' +
      '.rr-rnk-btn{display:flex;align-items:center;justify-content:center;gap:.4rem;padding:.55rem .65rem;border-radius:.55rem;border:1px solid var(--rnk-dim);background:rgba(251,191,36,.08);color:#fff;font-size:.78rem;font-weight:700;text-decoration:none;cursor:pointer;transition:border-color .2s,transform .15s}' +
      '.rr-rnk-btn:hover{border-color:rgba(251,191,36,.45);transform:translateY(-1px);color:#fde68a}' +
      '.rr-rnk-btn.primary{background:linear-gradient(45deg,#fbbf24,#f59e0b);color:#0a0e17;border-color:transparent}' +
      '.rr-rnk-btn.primary:hover{color:#0a0e17;filter:brightness(1.05)}' +
      '.rr-rnk-btn.going{background:rgba(34,197,94,.15);border-color:rgba(34,197,94,.4);color:#4ade80}' +
      '.rr-rnk-foot{margin-top:.7rem;font-size:.72rem;color:#64748b}' +
      '.rr-rnk-compact .rr-rnk-cd{display:none}' +
      '.rr-rnk-empty{color:#94a3b8;font-size:.85rem;padding:.5rem 0}';
    document.head.appendChild(style);
  }

  function mount() {
    var el = document.getElementById('rr-race-night-kit');
    if (!el || el.dataset.ready === '1') return;
    ensureStyles();
    el.dataset.ready = '1';
    el.classList.add('rr-rnk');
    el.innerHTML = '<div class="rr-rnk-card"><div class="rr-rnk-empty"><i class="fas fa-spinner fa-spin"></i> Loading race night kit…</div></div>';
    tryLoad(0, el);
  }

  function tryLoad(attempt, el) {
    var firestore = db();
    if (!firestore) {
      if (attempt < 40) return setTimeout(function () { tryLoad(attempt + 1, el); }, 250);
      el.innerHTML = '<div class="rr-rnk-card"><div class="rr-rnk-empty">Connect to load the next race toolkit.</div></div>';
      return;
    }
    loadKit(firestore, el);
  }

  function loadKit(firestore, el) {
    var todayStr = new Date().toISOString().split('T')[0];
    var compact = el.getAttribute('data-compact') === '1';
    var root = rootPrefix();

    firestore.collection('races').where('season', '==', 2026).where('date', '>=', todayStr).orderBy('date', 'asc').limit(8).get()
      .then(function (snap) {
        if (snap.empty) {
          return firestore.collection('races').where('date', '>=', todayStr).orderBy('date', 'asc').limit(8).get();
        }
        return snap;
      })
      .then(function (snap) {
        if (!snap || snap.empty) {
          el.innerHTML = '<div class="rr-rnk-card"><div class="rr-rnk-kicker">Race Night Kit</div><div class="rr-rnk-empty">No upcoming races on the calendar yet. Check the <a href="' + root + 'schedule.html" style="color:var(--rnk-ac)">schedule</a>.</div></div>';
          return;
        }
        var raceDoc = snap.docs[0];
        var r = raceDoc.data() || {};
        var raceId = raceDoc.id;
        var when = parseRaceDate(r);
        var name = r.eventName || r.name || 'Next race';
        var track = r.track || '';
        var loc = [r.city, r.state].filter(Boolean).join(', ');
        var dateLabel = when ? when.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : (r.date || '');
        var tSlug = trackSlug(track);
        var trackHref = root + 'tracks.html' + (tSlug ? '#' + encodeURIComponent(tSlug) : '');

        el.innerHTML =
          '<div class="rr-rnk-card' + (compact ? ' rr-rnk-compact' : '') + '">' +
            '<div class="rr-rnk-kicker"><i class="fas fa-moon" style="margin-right:.35rem"></i>Race Night Kit</div>' +
            '<h3 class="rr-rnk-title">' + esc(name) + '</h3>' +
            '<div class="rr-rnk-meta">' + esc(track) + (loc ? ' · ' + esc(loc) : '') + (dateLabel ? ' · ' + esc(dateLabel) : '') + '</div>' +
            '<div class="rr-rnk-cd" aria-label="Countdown">' +
              '<div><strong id="rnk-d">0</strong><span>Days</span></div>' +
              '<div><strong id="rnk-h">0</strong><span>Hrs</span></div>' +
              '<div><strong id="rnk-m">0</strong><span>Min</span></div>' +
              '<div><strong id="rnk-s">0</strong><span>Sec</span></div>' +
            '</div>' +
            '<div class="rr-rnk-actions">' +
              '<button type="button" class="rr-rnk-btn primary" id="rnk-going"><i class="fas fa-check"></i><span>I\'m Going</span></button>' +
              '<a class="rr-rnk-btn" href="' + root + 'predictions.html"><i class="fas fa-dice"></i><span>Predict</span></a>' +
              '<a class="rr-rnk-btn" href="' + root + 'live.html"><i class="fas fa-broadcast-tower"></i><span>Live</span></a>' +
              '<a class="rr-rnk-btn" href="' + esc(trackHref) + '"><i class="fas fa-map-marker-alt"></i><span>Track guide</span></a>' +
              '<a class="rr-rnk-btn" href="' + root + 'passport.html?raceId=' + encodeURIComponent(raceId) + '"><i class="fas fa-passport"></i><span>Passport</span></a>' +
              '<a class="rr-rnk-btn" href="' + root + 'fan-wall.html"><i class="fas fa-bullhorn"></i><span>Fan Wall</span></a>' +
            '</div>' +
            '<div class="rr-rnk-foot" id="rnk-foot">Loading fan RSVPs…</div>' +
          '</div>';

        if (when) startCountdown(when.getTime());
        wireGoing(firestore, raceId, r, name, track);
      })
      .catch(function (e) {
        console.warn('[race-night-kit]', e);
        el.innerHTML = '<div class="rr-rnk-card"><div class="rr-rnk-empty">Could not load the next race right now.</div></div>';
      });
  }

  function startCountdown(targetMs) {
    function tick() {
      var d = targetMs - Date.now();
      if (d < 0) d = 0;
      var elD = document.getElementById('rnk-d');
      var elH = document.getElementById('rnk-h');
      var elM = document.getElementById('rnk-m');
      var elS = document.getElementById('rnk-s');
      if (!elD) return;
      elD.textContent = String(Math.floor(d / 864e5));
      elH.textContent = String(Math.floor((d % 864e5) / 36e5));
      elM.textContent = String(Math.floor((d % 36e5) / 6e4));
      elS.textContent = String(Math.floor((d % 6e4) / 1e3));
    }
    tick();
    setInterval(tick, 1000);
  }

  function wireGoing(firestore, raceId, race, name, track) {
    var btn = document.getElementById('rnk-going');
    var foot = document.getElementById('rnk-foot');
    if (!btn) return;

    function refreshCount() {
      firestore.collection('race_rsvps').doc(raceId).collection('entries').get().then(function (snap) {
        var n = snap.size;
        if (foot) foot.textContent = n === 0 ? 'Be the first fan to RSVP for this race.' : (n + ' fan' + (n === 1 ? '' : 's') + ' marked going');
      }).catch(function () {
        if (foot) foot.textContent = 'Sign in to RSVP for race night.';
      });
    }

    function setGoingUI(going) {
      if (going) {
        btn.classList.add('going');
        btn.innerHTML = '<i class="fas fa-check-circle"></i><span>You\'re Going</span>';
      } else {
        btn.classList.remove('going');
        btn.innerHTML = '<i class="fas fa-check"></i><span>I\'m Going</span>';
      }
    }

    function currentUid() {
      var a = auth();
      return a && a.currentUser ? a.currentUser.uid : null;
    }

    function syncState() {
      var uid = currentUid();
      if (!uid) {
        setGoingUI(false);
        refreshCount();
        return;
      }
      firestore.collection('race_rsvps').doc(raceId).collection('entries').doc(uid).get().then(function (snap) {
        setGoingUI(snap.exists);
        refreshCount();
      }).catch(refreshCount);
    }

    btn.addEventListener('click', function () {
      var a = auth();
      var user = a && a.currentUser;
      if (!user) {
        window.location.href = rootPrefix() + 'login.html?returnTo=' + encodeURIComponent((window.location.pathname || '') + (window.location.search || '') + '#rr-race-night-kit');
        return;
      }
      var entryRef = firestore.collection('race_rsvps').doc(raceId).collection('entries').doc(user.uid);
      var mineRef = firestore.collection('users').doc(user.uid).collection('race_rsvps').doc(raceId);
      btn.disabled = true;
      entryRef.get().then(function (snap) {
        if (snap.exists) {
          return Promise.all([entryRef.delete(), mineRef.delete()]).then(function () { setGoingUI(false); });
        }
        var payload = {
          displayName: user.displayName || (user.email || '').split('@')[0] || 'Fan',
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          raceId: raceId,
          raceName: name || '',
          raceDate: race.date || '',
          track: track || ''
        };
        return Promise.all([
          entryRef.set(payload),
          mineRef.set(payload, { merge: true })
        ]).then(function () { setGoingUI(true); });
      }).then(refreshCount).catch(function (e) {
        console.warn('[race-night-kit] rsvp', e);
        if (foot) foot.textContent = 'Could not save RSVP — check you are signed in.';
      }).finally(function () { btn.disabled = false; });
    });

    var a = auth();
    if (a) a.onAuthStateChanged(syncState);
    else syncState();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();
