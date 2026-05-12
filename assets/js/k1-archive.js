/*
 * k1-archive.js — read-only renderer for the K1 Speed Addison karting archive.
 *
 * Loads the static snapshots under data/k1_<who>_addison_history.json and
 * renders a per-season table into a target element. No Firestore, no Cloud
 * Function calls, no live refresh. Jon Kirsch and his son retired from K1
 * karting in 2025; these snapshots are a frozen historical record.
 *
 * Classic script (not an ES module) so it works inside Android WebView
 * `file:///android_asset/` loads where MIME-type-strict module imports fail.
 *
 * Exposes:
 *   window.K1Archive.renderJon(targetEl)
 *   window.K1Archive.renderJonny(targetEl)
 *
 * TODO: the canonical snapshots currently only carry per-season summary
 * data (year / series / place / total points / per-GP points). The
 * original spec asked for per-session rows of "date, position, fastest lap,
 * total laps", but those fields are not present in the JSON. If/when the
 * snapshots are enriched with per-session detail, expand renderTable()
 * to emit a session-level row per GP entry instead of (or alongside) the
 * season summary rendered today.
 */
(function () {
  'use strict';

  var SOURCES = {
    jon: {
      url: 'data/k1_jon_addison_history.json',
      driver: 'Jon Kirsch',
      defaultSeries: 'K1 Addison Adult League'
    },
    jonny: {
      url: 'data/k1_jonny_addison_history.json',
      driver: 'Jonny Kirsch',
      defaultSeries: 'K1 Addison Junior League'
    }
  };

  function escapeHtml(value) {
    if (value === null || typeof value === 'undefined') return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatPlace(place) {
    if (place === null || typeof place === 'undefined' || place === '') return '—';
    var n = Number(place);
    if (!Number.isFinite(n)) return escapeHtml(place);
    var suffix = 'th';
    var mod100 = n % 100;
    var mod10 = n % 10;
    if (mod100 < 11 || mod100 > 13) {
      if (mod10 === 1) suffix = 'st';
      else if (mod10 === 2) suffix = 'nd';
      else if (mod10 === 3) suffix = 'rd';
    }
    return n + suffix;
  }

  function formatPoints(points) {
    if (points === null || typeof points === 'undefined' || points === '') return '—';
    return escapeHtml(points);
  }

  function formatGpPoints(gpPoints) {
    if (!Array.isArray(gpPoints) || !gpPoints.length) return '—';
    return gpPoints.map(function (p) { return escapeHtml(p); }).join(' · ');
  }

  function renderTable(targetEl, config, data) {
    var seasons = (data && Array.isArray(data.seasons)) ? data.seasons.slice() : [];
    seasons.sort(function (a, b) {
      var ay = Number(a && a.year) || 0;
      var by = Number(b && b.year) || 0;
      return by - ay;
    });

    if (!seasons.length) {
      targetEl.innerHTML =
        '<div class="bg-slate-800/50 backdrop-blur-md rounded-xl border border-slate-700/50 p-6 text-center text-slate-400">' +
        'No archived K1 Speed Addison seasons recorded for ' + escapeHtml(config.driver) + '.' +
        '</div>';
      return;
    }

    var rows = seasons.map(function (s) {
      var year = escapeHtml(s && s.year);
      var series = escapeHtml((s && s.series) || config.defaultSeries);
      var place = formatPlace(s && s.place);
      var points = formatPoints(s && s.points);
      var gp = formatGpPoints(s && s.gpPoints);
      var races = (s && Array.isArray(s.gpPoints)) ? s.gpPoints.length : '—';
      return (
        '<tr class="border-b border-slate-700/40 last:border-b-0">' +
          '<td class="px-4 py-3 text-white font-racing">' + year + '</td>' +
          '<td class="px-4 py-3 text-slate-300">' + series + '</td>' +
          '<td class="px-4 py-3 text-yellow-400 font-bold">' + place + '</td>' +
          '<td class="px-4 py-3 text-white font-bold">' + points + '</td>' +
          '<td class="px-4 py-3 text-blue-400">' + escapeHtml(races) + '</td>' +
          '<td class="px-4 py-3 text-slate-400 text-sm">' + gp + '</td>' +
        '</tr>'
      );
    }).join('');

    targetEl.innerHTML =
      '<div class="bg-slate-800/50 backdrop-blur-md rounded-xl border border-slate-700/50 overflow-hidden">' +
        '<div class="bg-gradient-to-r from-slate-700 to-slate-800 px-6 py-4 border-b border-slate-700/50">' +
          '<div class="flex flex-wrap items-center justify-between gap-2">' +
            '<h3 class="text-white font-racing text-xl uppercase">' +
              escapeHtml(config.driver) + ' — K1 Speed Addison Archive' +
            '</h3>' +
            '<span class="text-xs uppercase tracking-wider text-slate-400">' +
              'Frozen 2024–2025 record' +
            '</span>' +
          '</div>' +
        '</div>' +
        '<div class="overflow-x-auto">' +
          '<table class="min-w-full text-left">' +
            '<thead class="bg-slate-900/50">' +
              '<tr class="text-xs uppercase tracking-wider text-slate-400">' +
                '<th class="px-4 py-3">Season</th>' +
                '<th class="px-4 py-3">Series</th>' +
                '<th class="px-4 py-3">Place</th>' +
                '<th class="px-4 py-3">Total Points</th>' +
                '<th class="px-4 py-3">GP Events</th>' +
                '<th class="px-4 py-3">GP Point Breakdown</th>' +
              '</tr>' +
            '</thead>' +
            '<tbody>' + rows + '</tbody>' +
          '</table>' +
        '</div>' +
        '<div class="px-6 py-3 text-xs text-slate-500 border-t border-slate-700/50">' +
          'Archive only. No live refresh — source: <code>' + escapeHtml(config.url) + '</code>.' +
        '</div>' +
      '</div>';
  }

  function renderUnavailable(targetEl, config, errorLabel) {
    var detail = errorLabel ? ' (' + escapeHtml(errorLabel) + ')' : '';
    targetEl.innerHTML =
      '<div class="bg-slate-800/50 backdrop-blur-md rounded-xl border border-red-500/30 p-6 text-center">' +
        '<div class="text-red-300 font-racing uppercase text-lg mb-1">Archive data unavailable</div>' +
        '<div class="text-slate-400 text-sm">' +
          'Could not load ' + escapeHtml(config.driver) + '\u2019s K1 Speed Addison history' + detail + '.' +
        '</div>' +
      '</div>';
  }

  function renderFor(key, targetEl) {
    if (!targetEl) return Promise.resolve();
    var config = SOURCES[key];
    if (!config) {
      renderUnavailable(targetEl, { driver: 'Unknown driver', url: '' }, 'unknown driver key');
      return Promise.resolve();
    }
    targetEl.innerHTML =
      '<div class="text-center text-slate-400 py-6">' +
        '<i class="fas fa-spinner fa-spin mr-2"></i>Loading K1 Speed Addison archive…' +
      '</div>';
    return fetch(config.url, { cache: 'no-store' })
      .then(function (resp) {
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        return resp.json();
      })
      .then(function (data) { renderTable(targetEl, config, data); })
      .catch(function (err) {
        try { console.warn('[K1Archive] failed to render ' + key + ':', err); } catch (e) { /* noop */ }
        renderUnavailable(targetEl, config, err && err.message);
      });
  }

  window.K1Archive = {
    renderJon: function (targetEl) { return renderFor('jon', targetEl); },
    renderJonny: function (targetEl) { return renderFor('jonny', targetEl); }
  };
}());
