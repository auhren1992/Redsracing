/**
 * Smart Next-Race Hub — countdown, weather, track tips, last result, gate notes.
 */
(function () {
  'use strict';

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function parseRaceDate(raw, startTime) {
    if (window.RRRaceDateTime) {
      return window.RRRaceDateTime.raceDateTime(raw, startTime);
    }
    if (!raw) return null;
    if (raw.toDate) return raw.toDate();
    if (typeof raw === 'string') {
      const d = new Date(raw.length <= 10 ? raw + 'T19:00:00' : raw);
      return isNaN(d.getTime()) ? null : d;
    }
    return null;
  }

  function findTrackTips(trackName, tracks) {
    if (!Array.isArray(tracks) || !trackName) return null;
    const t = String(trackName).toLowerCase();
    return tracks.find((x) => String(x.name || '').toLowerCase() === t)
      || tracks.find((x) => t.includes(String(x.name || '').toLowerCase().split(' ')[0]))
      || null;
  }

  async function loadTracks() {
    try {
      const res = await fetch('data/tracks.json', { cache: 'force-cache' });
      return await res.json();
    } catch (_) {
      return [];
    }
  }

  async function loadNextRace(db) {
    const todayStr = window.RRRaceDateTime
      ? window.RRRaceDateTime.localTodayYmd()
      : new Date().toISOString().split('T')[0];
    try {
      const snap = await db.collection('races')
        .where('season', '==', 2026)
        .where('date', '>=', todayStr)
        .orderBy('date', 'asc')
        .limit(8)
        .get();
      if (snap.empty) return null;
      // Prefer superCup when available; skip rainouts
      let chosen = null;
      snap.forEach((d) => {
        const r = Object.assign({ id: d.id }, d.data());
        if (String(r.status || '').toLowerCase() === 'rainout') return;
        if (!chosen) chosen = r;
        if (!chosen._prefer && r.type === 'superCup') {
          chosen = r;
          chosen._prefer = true;
        }
      });
      return chosen;
    } catch (e) {
      console.warn('[next-race-hub] firestore races failed, trying JSON', e);
      try {
        const res = await fetch('data/schedule.json', { cache: 'no-store' });
        const data = await res.json();
        const season = (data.seasons || []).find((s) => s.year === (data.currentSeason || 2026));
        const races = (season && season.races) || [];
        const upcoming = races
          .filter((r) => String(r.date) >= todayStr && String(r.status || '').toLowerCase() !== 'rainout')
          .sort((a, b) => String(a.date).localeCompare(String(b.date)));
        return upcoming.find((r) => r.type === 'superCup') || upcoming[0] || null;
      } catch (_) {
        return null;
      }
    }
  }

  async function loadLastResult(db) {
    try {
      const snap = await db.collection('race_results')
        .orderBy('raceDate', 'desc')
        .limit(12)
        .get();
      if (snap.empty) return null;
      const byKey = {};
      snap.forEach((d) => {
        const v = d.data() || {};
        const key = String(v.raceDate || '') + '|' + String(v.trackName || '');
        if (!byKey[key]) byKey[key] = { raceDate: v.raceDate, trackName: v.trackName, trackLocation: v.trackLocation || '', drivers: [] };
        byKey[key].drivers.push(v);
      });
      const first = Object.values(byKey)[0];
      if (!first) return null;
      first.drivers.sort((a, b) => (Number(a.finishPosition) || 99) - (Number(b.finishPosition) || 99));
      return first;
    } catch (e) {
      console.warn('[next-race-hub] last result', e);
      return null;
    }
  }

  async function loadHubNotes(db) {
    try {
      const snap = await db.doc('config/homepage_pulse').get();
      if (!snap.exists) return {};
      const d = snap.data() || {};
      return d.hub || {};
    } catch (_) {
      return {};
    }
  }

  async function loadPulseMode(db) {
    try {
      const snap = await db.doc('config/homepage_pulse').get();
      if (!snap.exists) return null;
      return snap.data() || null;
    } catch (_) {
      return null;
    }
  }

  function startCountdown(targetDate) {
    const els = { d: $('nr-days'), h: $('nr-hours'), m: $('nr-minutes'), s: $('nr-seconds') };
    function tick() {
      const now = Date.now();
      let dist = targetDate.getTime() - now;
      if (dist < 0) dist = 0;
      const days = Math.floor(dist / 86400000);
      const hours = Math.floor((dist % 86400000) / 3600000);
      const mins = Math.floor((dist % 3600000) / 60000);
      const secs = Math.floor((dist % 60000) / 1000);
      if (els.d) els.d.textContent = String(days);
      if (els.h) els.h.textContent = String(hours);
      if (els.m) els.m.textContent = String(mins);
      if (els.s) els.s.textContent = String(secs);
    }
    tick();
    setInterval(tick, 1000);
  }

  function paintWeather(wx, hub) {
    const box = $('nr-weather');
    if (!box) return;
    const note = hub && String(hub.weatherNote || '').trim();
    const override = !!(hub && hub.weatherOverride && note);

    if (override) {
      box.innerHTML = `
        <div class="nr-weather-card wx-risk-medium">
          <div class="nr-weather-icon"><i class="fas fa-cloud-sun-rain" aria-hidden="true"></i></div>
          <div>
            <div class="nr-weather-title">Team weather update</div>
            <div class="nr-weather-sub">${esc(note)}</div>
          </div>
        </div>`;
      return;
    }

    if (!wx) {
      box.innerHTML = note
        ? `<div class="nr-weather-card wx-risk-unknown"><div class="nr-weather-icon"><i class="fas fa-cloud-sun" aria-hidden="true"></i></div><div><div class="nr-weather-title">Team note</div><div class="nr-weather-sub">${esc(note)}</div></div></div>`
        : '<div class="nr-muted">Weather forecast unavailable for this track yet.</div>';
      return;
    }
    const risk = wx.risk || 'unknown';
    const riskClass = window.RRRaceWeather ? window.RRRaceWeather.riskClass(risk) : 'wx-risk-unknown';
    box.innerHTML = `
      <div class="nr-weather-card ${esc(riskClass)}">
        <div class="nr-weather-icon"><i class="${esc(wx.icon)}" aria-hidden="true"></i></div>
        <div>
          <div class="nr-weather-title">${esc(wx.label)}${wx.tempLine ? ' · ' + esc(wx.tempLine) : ''}</div>
          <div class="nr-weather-sub">${esc(wx.summary)}</div>
          ${risk === 'high' ? '<div class="nr-weather-alert"><i class="fas fa-umbrella"></i> Rain risk is elevated — check for delays closer to green.</div>' : ''}
          ${note ? '<div class="nr-weather-alert"><i class="fas fa-pen"></i> ' + esc(note) + '</div>' : ''}
        </div>
      </div>`;
  }

  function paintRace(race, trackTips) {
    const title = $('nr-title');
    const sub = $('nr-sub');
    const meta = $('nr-meta');
    const tips = $('nr-tips');
    const map = $('nr-map-link');
    const name = race.eventName || race.name || race.track || 'Next race';
    if (title) title.textContent = name;
    if (sub) {
      sub.textContent = [race.track, [race.city, race.state].filter(Boolean).join(', ')].filter(Boolean).join(' · ');
    }
    if (meta) {
      const d = parseRaceDate(race.date, race.startTime);
      const dateLabel = d
        ? d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
        : String(race.date || '');
      meta.innerHTML = `
        <div><i class="fas fa-calendar-day"></i> ${esc(dateLabel)}</div>
        <div><i class="fas fa-clock"></i> ${esc(race.startTime && race.startTime !== 'TBD' ? race.startTime : 'Start time TBA')}</div>
        <div><i class="fas fa-flag"></i> ${esc(race.type === 'specialEvent' ? 'Special Event' : 'Super Cup')}</div>`;
    }
    if (tips) {
      const tipText = (trackTips && trackTips.tips) || 'Arrive early for parking and a good seat. Follow Live for green-flag updates.';
      tips.textContent = tipText;
    }
    if (map) {
      const q = (trackTips && trackTips.mapQuery)
        || [race.track, race.city, race.state].filter(Boolean).join(' ');
      map.href = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q);
    }
  }

  function paintLastResult(last) {
    const box = $('nr-last-result');
    if (!box) return;
    if (!last) {
      box.innerHTML = '<div class="nr-muted">No recent results posted yet.</div>';
      return;
    }
    const lines = (last.drivers || []).slice(0, 4).map((d) => {
      const pos = d.finishPosition != null ? 'P' + d.finishPosition : '—';
      return `<li><strong>${esc(pos)}</strong> ${esc(d.driverName || d.driverId || 'Driver')}${d.carNumber ? ' <span class="nr-car">#' + esc(d.carNumber) + '</span>' : ''}</li>`;
    }).join('');
    box.innerHTML = `
      <div class="nr-last-head">${esc(last.trackName || 'Last race')}${last.raceDate ? ' · ' + esc(String(last.raceDate).slice(0, 10)) : ''}</div>
      <ul class="nr-last-list">${lines || '<li class="nr-muted">Results posting soon</li>'}</ul>
      <a class="nr-link" href="recaps.html">Full recaps →</a>`;
  }

  function paintNotes(hub, pulse) {
    const gate = $('nr-gate');
    const park = $('nr-parking');
    const raceMode = $('nr-race-mode');
    if (gate) gate.textContent = (hub && hub.gateNotes) || 'Gate / ticket details usually post closer to race week. Check the track socials and our Live page.';
    if (park) park.textContent = (hub && hub.parkingNotes) || 'Parking is typically on-site at the speedway. Arrive early on feature nights.';
    if (raceMode) {
      const rm = pulse && pulse.raceMode;
      if (rm && rm.enabled) {
        raceMode.classList.remove('hidden');
        raceMode.innerHTML = `
          <div class="nr-live-pill"><span class="nr-live-dot"></span> RACE MODE</div>
          <div class="nr-live-status">${esc(rm.status || 'Race weekend is live')}</div>
          ${rm.note ? '<div class="nr-live-note">' + esc(rm.note) + '</div>' : ''}
          <a class="nr-cta" href="live.html">Open Live updates</a>`;
      } else {
        raceMode.classList.add('hidden');
      }
    }
  }

  async function init() {
    const loading = $('nr-loading');
    const content = $('nr-content');
    const empty = $('nr-empty');

    function getDb() {
      return window.firebase && window.firebase.firestore && window.firebase.firestore();
    }

    let tries = 0;
    while (!getDb() && tries < 40) {
      await new Promise((r) => setTimeout(r, 200));
      tries += 1;
    }
    const db = getDb();
    if (!db) {
      if (loading) loading.textContent = 'Could not connect. Refresh and try again.';
      return;
    }

    const [race, tracks, last, hub, pulse] = await Promise.all([
      loadNextRace(db),
      loadTracks(),
      loadLastResult(db),
      loadHubNotes(db),
      loadPulseMode(db)
    ]);

    if (!race) {
      if (loading) loading.classList.add('hidden');
      if (empty) empty.classList.remove('hidden');
      return;
    }

    const trackTips = findTrackTips(race.track, tracks);
    paintRace(race, trackTips);
    paintLastResult(last);
    paintNotes(hub, pulse);

    const when = parseRaceDate(race.date, race.startTime) || new Date();
    startCountdown(when);

    if (hub && hub.weatherOverride && String(hub.weatherNote || '').trim()) {
      paintWeather(null, hub);
    } else if (window.RRRaceWeather) {
      const wx = await window.RRRaceWeather.forRace({
        city: race.city || (trackTips && trackTips.city),
        state: race.state || (trackTips && trackTips.state),
        date: String(race.date).slice(0, 10)
      });
      paintWeather(wx, hub);
    } else {
      paintWeather(null, hub);
    }

    if (loading) loading.classList.add('hidden');
    if (content) content.classList.remove('hidden');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
