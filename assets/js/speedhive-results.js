(async function initSpeedhiveResults() {
  const root = document.getElementById('race-results');
  if (!root) return;

  let isAdmin = false;

  async function loadJson(url) {
    try {
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) return null;
      return await response.json();
    } catch (err) {
      console.warn('Speedhive data fetch failed:', url, err);
      return null;
    }
  }

  function formatPosition(position) {
    if (!position) return '';
    const pos = parseInt(position, 10);
    if (pos === 1) return '<span class="text-yellow-400 font-bold">' + pos + 'st 🏆</span>';
    if (pos === 2) return '<span class="text-orange-400 font-bold">' + pos + 'nd 🥈</span>';
    if (pos === 3) return '<span class="text-orange-400 font-bold">' + pos + 'rd 🥉</span>';
    if (pos <= 5) return '<span class="text-blue-400 font-bold">' + pos + 'th</span>';
    if (pos <= 10) return '<span class="text-green-400">' + pos + 'th</span>';
    return '<span class="text-slate-300">' + pos + 'th</span>';
  }

  function formatLapTime(time) {
    if (!time) return '';
    return '<span class="text-slate-300 font-mono">' + time + 's</span>';
  }

  function fmtDate(iso) {
    try {
      return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric'
      });
    } catch (_) {
      return iso;
    }
  }

  function fmtPos(pos) {
    if (!pos) return '—';
    const suffixes = ['th', 'st', 'nd', 'rd'];
    const v = pos % 100;
    const suffix = suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0];
    return pos + suffix;
  }

  function fmtTime(t) {
    if (t == null) return '—';
    return Number(t).toFixed(3) + 's';
  }

  function headerColorForEvent(sessions) {
    const positions = sessions.filter(function (s) { return s.position; }).map(function (s) { return s.position; });
    if (!positions.length) return 'from-slate-600 to-slate-500';
    const best = Math.min.apply(null, positions);
    if (best === 1) return 'from-yellow-600 to-yellow-500';
    if (best <= 3) return 'from-orange-600 to-orange-500';
    if (best <= 5) return 'from-blue-600 to-blue-500';
    if (best <= 10) return 'from-green-600 to-green-500';
    return 'from-slate-600 to-slate-500';
  }

  function barChartHtml(laps, field) {
    if (!laps || !laps.length) return '';
    const vals = laps.map(function (l) { return l[field]; }).filter(function (v) { return v != null; });
    if (!vals.length) return '';
    const min = Math.min.apply(null, vals);
    const max = Math.max.apply(null, vals);
    const range = Math.max(max - min, 0.001);
    return laps.map(function (lap) {
      const v = lap[field];
      if (v == null) return '';
      const pct = field === 'pos'
        ? Math.max(8, 100 - ((v - 1) * 14))
        : Math.max(8, 100 - ((v - min) / range) * 92);
      const cls = lap.best ? 'sh-bar best' : (field === 'pos' ? 'sh-pos-bar' : 'sh-bar');
      return '<div class="' + cls + '" style="height:' + pct + '%" title="Lap ' + lap.lap + ': ' + v + '"></div>';
    }).join('');
  }

  function lapTableHtml(laps) {
    if (!laps || !laps.length) return '';
    const hasPos = laps.some(function (l) { return l.pos != null; });
    const hasSpeed = laps.some(function (l) { return l.speed != null; });
    let head = '<tr><th>Lap</th>';
    if (hasPos) head += '<th>Pos</th>';
    head += '<th>Time</th>';
    if (hasSpeed) head += '<th>Speed</th>';
    head += '</tr>';
    const rows = laps.map(function (lap) {
      let row = '<tr' + (lap.best ? ' class="best"' : '') + '><td>' + lap.lap + '</td>';
      if (hasPos) row += '<td>' + (lap.pos != null ? 'P' + lap.pos : '—') + '</td>';
      row += '<td>' + fmtTime(lap.time) + '</td>';
      if (hasSpeed) row += '<td>' + (lap.speed ? lap.speed + ' mph' : '—') + '</td>';
      row += '</tr>';
      return row;
    }).join('');
    return '<div class="sh-lap-table-wrap"><table class="sh-lap-table"><thead>' + head + '</thead><tbody>' + rows + '</tbody></table></div>';
  }

  function sessionDetailHtml(session) {
    const items = [
      ['Finish', fmtPos(session.position)],
      ['Best Lap', session.bestLap ? fmtTime(session.bestLap) : (session.lapTime ? session.lapTime + 's' : '—')],
      ['Best Speed', session.bestSpeed ? session.bestSpeed + ' mph' : (session.speed ? session.speed + ' mph' : '—')],
      ['Total Time', session.totalTime || '—']
    ];
    const summary = items.map(function (pair) {
      return '<div class="sh-session-stat"><span>' + pair[0] + '</span><strong>' + pair[1] + '</strong></div>';
    }).join('');

    const laps = session.laps;
    if (!laps || !laps.length) {
      return '<div class="sh-session-summary">' + summary + '</div>';
    }

    const hasPos = laps.some(function (l) { return l.pos != null; });
    return '<div class="sh-session-summary">' + summary + '</div>' +
      '<div class="sh-charts">' +
        '<div class="sh-chart-panel"><div class="sh-chart-title">Lap Time</div><div class="sh-bar-chart">' + barChartHtml(laps, 'time') + '</div></div>' +
        (hasPos ? '<div class="sh-chart-panel"><div class="sh-chart-title">Position</div><div class="sh-pos-chart">' + barChartHtml(laps, 'pos') + '</div></div>' : '') +
      '</div>' + lapTableHtml(laps);
  }

  function normalizeTelemetrySession(s) {
    return {
      sessionType: s.type || s.sessionType,
      position: s.position,
      lapTime: s.bestLap != null ? String(s.bestLap) : s.lapTime,
      speed: s.bestSpeed != null ? String(s.bestSpeed) : s.speed,
      totalTime: s.totalTime,
      laps: s.laps,
      notes: s.notes
    };
  }

  function normalizeTelemetryEvent(e) {
    return {
      id: e.id,
      season: e.season,
      eventName: e.name || e.eventName,
      date: e.date,
      track: e.venue || e.track || '',
      trackLength: e.trackLength || '',
      highlights: e.highlights,
      summaryOnly: e.summaryOnly,
      sessions: (e.sessions || []).map(normalizeTelemetrySession)
    };
  }

  function renderEvent(event) {
    const eventDiv = document.createElement('div');
    eventDiv.className = 'bg-slate-800/50 backdrop-blur-md rounded-xl border border-slate-700/50 overflow-hidden mb-6';

    const formattedDate = fmtDate(event.date);
    const headerColor = headerColorForEvent(event.sessions);
    const hasLapDetail = event.sessions.some(function (s) { return s.laps && s.laps.length; });
    const lapPaneId = 'sh-laps-' + (event.id || event.date);

    eventDiv.innerHTML =
      '<div class="bg-gradient-to-r ' + headerColor + ' px-6 py-4">' +
        '<div class="flex flex-wrap items-center justify-between gap-2">' +
          '<h3 class="text-white font-racing text-xl uppercase font-bold">' + event.eventName + '</h3>' +
          '<div class="text-white font-bold text-sm">' + event.track + (event.trackLength ? ' (' + event.trackLength + ')' : '') + '</div>' +
        '</div>' +
        '<div class="text-white/80 text-sm mt-1">' + formattedDate + '</div>' +
      '</div>' +
      '<div class="p-6">' +
        '<div class="grid grid-cols-1 md:grid-cols-' + Math.min(event.sessions.length, 4) + ' gap-4 mb-4">' +
          event.sessions.map(function (session) {
            return '<div class="stat-card-3d text-center py-3">' +
              '<div class="text-sm text-slate-400 mb-1">' + session.sessionType + '</div>' +
              '<div class="text-2xl mb-1">' + formatPosition(session.position) + '</div>' +
              (session.lapTime ? '<div class="text-sm mb-1">' + formatLapTime(session.lapTime) + '</div>' : '') +
              (session.speed ? '<div class="text-xs text-slate-500">' + session.speed + ' mph</div>' : '') +
              (session.totalTime ? '<div class="text-xs text-slate-400">' + session.totalTime + '</div>' : '') +
              (session.notes ? '<div class="text-xs text-slate-500">' + session.notes + '</div>' : '') +
            '</div>';
          }).join('') +
        '</div>' +
        (event.highlights && event.highlights.length ? (
          '<div class="mt-4 flex flex-wrap justify-center gap-2">' +
            event.highlights.map(function (highlight) {
              return '<div class="bg-yellow-500/20 border border-yellow-400/40 rounded-full px-3 py-1">' +
                '<span class="text-yellow-400 font-bold text-sm">' + highlight + '</span></div>';
            }).join('') +
          '</div>'
        ) : '') +
        (hasLapDetail ? (
          '<button type="button" class="sh-toggle-laps" aria-expanded="false" aria-controls="' + lapPaneId + '">' +
            '<i class="fas fa-chevron-down" aria-hidden="true"></i> Lap-by-lap detail' +
          '</button>' +
          '<div id="' + lapPaneId + '" class="sh-event-expand sh-lap-detail" hidden></div>'
        ) : '') +
        '<div class="mt-3 pt-3 border-t border-slate-600/30 text-center">' +
          '<p class="text-slate-500 text-xs">' +
            '<i class="fas fa-external-link-alt mr-1"></i>' +
            'Source: <a href="https://speedhive.mylaps.com" target="_blank" rel="noopener" class="text-yellow-400 hover:text-yellow-300 transition-colors">MYLAPS Speedhive Official Results</a>' +
          '</p>' +
        '</div>' +
      '</div>';

    if (hasLapDetail) {
      bindLapDetail(eventDiv, event, lapPaneId);
    }

    return eventDiv;
  }

  function bindLapDetail(eventDiv, event, lapPaneId) {
    const toggle = eventDiv.querySelector('.sh-toggle-laps');
    const pane = eventDiv.querySelector('#' + lapPaneId);
    if (!toggle || !pane) return;

    let activeIdx = 0;
    const tabsHtml = event.sessions.map(function (s, i) {
      const label = s.sessionType + (s.position ? ' · ' + fmtPos(s.position) : '');
      return '<button type="button" class="sh-session-tab' + (i === 0 ? ' active' : '') + '" data-idx="' + i + '">' + label + '</button>';
    }).join('');

    function showSession(idx) {
      activeIdx = idx;
      pane.querySelectorAll('.sh-session-tab').forEach(function (tab, i) {
        tab.classList.toggle('active', i === idx);
      });
      const detail = pane.querySelector('.sh-session-pane');
      if (detail && event.sessions[idx]) {
        detail.innerHTML = sessionDetailHtml(event.sessions[idx]);
      }
    }

    toggle.addEventListener('click', function () {
      const open = toggle.getAttribute('aria-expanded') !== 'true';
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      pane.hidden = !open;
      pane.classList.toggle('open', open);
      if (open && !pane.dataset.ready) {
        pane.innerHTML = '<div class="sh-session-tabs">' + tabsHtml + '</div><div class="sh-session-pane"></div>';
        pane.querySelectorAll('.sh-session-tab').forEach(function (tab) {
          tab.addEventListener('click', function () {
            showSession(parseInt(tab.dataset.idx, 10));
          });
        });
        pane.dataset.ready = '1';
        showSession(activeIdx);
      }
    });
  }

  function renderChampionship(data) {
    if (!data || !data.championship) return null;
    const div = document.createElement('div');
    div.className = 'bg-gradient-to-r from-slate-700 to-slate-600 rounded-xl p-6 mb-8';
    const ord = data.championship.dropPointStandings;
    const ordLabel = ord <= 3 ? (ord === 1 ? 'st' : ord === 2 ? 'nd' : 'rd') : 'th';
    div.innerHTML =
      '<div class="text-center mb-4">' +
        '<h3 class="text-white font-racing text-2xl uppercase font-bold mb-2">' +
          '<i class="fas fa-trophy text-yellow-400 mr-2"></i>' +
          data.season + ' ' + data.series + ' Championship' +
        '</h3>' +
        '<div class="text-slate-300 text-sm">' + data.driver + ' ' + data.carNumber + '</div>' +
      '</div>' +
      '<div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">' +
        '<div class="text-center"><div class="text-3xl font-bold text-yellow-400 mb-1">' + ord + ordLabel + '</div><div class="text-slate-300 text-sm uppercase font-semibold">Championship</div></div>' +
        '<div class="text-center"><div class="text-3xl font-bold text-green-400 mb-1">' + data.championship.totalPoints + '</div><div class="text-slate-300 text-sm uppercase font-semibold">Total Points</div></div>' +
        '<div class="text-center"><div class="text-3xl font-bold text-orange-400 mb-1">' + data.championship.featureWins + '</div><div class="text-slate-300 text-sm uppercase font-semibold">Feature Wins</div></div>' +
        '<div class="text-center"><div class="text-3xl font-bold text-blue-400 mb-1">' + data.championship.heatWins + '</div><div class="text-slate-300 text-sm uppercase font-semibold">Heat Wins</div></div>' +
      '</div>';
    return div;
  }

  function renderSeasonSummary(highlights, season) {
    if (!highlights) return null;
    const div = document.createElement('div');
    div.className = 'sh-season-summary';
    div.dataset.seasonPanel = String(season);
    div.innerHTML =
      '<div class="text-center mb-4">' +
        '<h4 class="font-racing text-xl uppercase text-white mb-1">' + season + ' Season Snapshot</h4>' +
        '<div class="text-slate-400 text-sm">From MYLAPS Speedhive timing data</div>' +
      '</div>' +
      '<div class="sh-stat-grid">' +
        statCell(highlights.events, 'Events') +
        statCell(highlights.podiums, 'Podiums') +
        statCell(highlights.heatWins, 'Heat Wins') +
        statCell(highlights.poles, 'Poles') +
        statCell(highlights.bestLap ? highlights.bestLap + 's' : '—', 'Best Lap') +
      '</div>' +
      (highlights.bestTrack ? '<div class="text-center text-slate-400 text-sm mt-3">Best lap at <span class="text-yellow-400">' + highlights.bestTrack + '</span></div>' : '');
    return div;
  }

  function statCell(val, label) {
    return '<div class="sh-stat"><div class="sh-stat-val">' + (val != null ? val : '—') + '</div><div class="sh-stat-label">' + label + '</div></div>';
  }

  function renderTelemetryView(telemetry, data2025) {
    const wrap = document.createElement('div');
    wrap.className = 'space-y-6';

    const events = (telemetry.events || []).map(normalizeTelemetryEvent);
    const seasons = [];
    events.forEach(function (e) {
      const s = String(e.season);
      if (seasons.indexOf(s) === -1) seasons.push(s);
    });
    seasons.sort().reverse();
    let activeSeason = seasons[0] || '2026';

    const tabs = document.createElement('div');
    tabs.className = 'sh-season-tabs';
    seasons.forEach(function (s) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'sh-season-tab' + (s === activeSeason ? ' active' : '');
      btn.textContent = s + ' Season';
      btn.dataset.season = s;
      btn.addEventListener('click', function () {
        activeSeason = s;
        tabs.querySelectorAll('.sh-season-tab').forEach(function (b) {
          b.classList.toggle('active', b.dataset.season === activeSeason);
        });
        summarySlot.querySelectorAll('[data-season-panel]').forEach(function (panel) {
          panel.style.display = panel.dataset.seasonPanel === activeSeason ? '' : 'none';
        });
        if (champSlot) {
          champSlot.style.display = activeSeason === '2025' && data2025 ? '' : 'none';
        }
        list.querySelectorAll('[data-season]').forEach(function (card) {
          card.style.display = card.dataset.season === activeSeason ? '' : 'none';
        });
      });
      tabs.appendChild(btn);
    });
    wrap.appendChild(tabs);

    const summarySlot = document.createElement('div');
    if (telemetry.seasonHighlights) {
      seasons.forEach(function (s) {
        const panel = renderSeasonSummary(telemetry.seasonHighlights[s], s);
        if (panel) {
          if (s !== activeSeason) panel.style.display = 'none';
          summarySlot.appendChild(panel);
        }
      });
    }
    wrap.appendChild(summarySlot);

    const champSlot = document.createElement('div');
    const champ = renderChampionship(data2025);
    if (champ) {
      if (activeSeason !== '2025') champ.style.display = 'none';
      champSlot.appendChild(champ);
      wrap.appendChild(champSlot);
    }

    const list = document.createElement('div');
    events
      .slice()
      .sort(function (a, b) { return new Date(b.date) - new Date(a.date); })
      .forEach(function (event) {
        const card = renderEvent(event);
        card.dataset.season = String(event.season);
        if (String(event.season) !== activeSeason) card.style.display = 'none';
        list.appendChild(card);
      });
    wrap.appendChild(list);

    const source = document.createElement('p');
    source.className = 'text-center text-slate-500 text-xs mt-4';
    source.innerHTML =
      '<i class="fas fa-external-link-alt mr-1"></i>' +
      'Powered by <a href="https://speedhive.mylaps.com" target="_blank" rel="noopener" class="text-yellow-400 hover:text-yellow-300 transition-colors">MYLAPS Speedhive</a>' +
      (telemetry.lastUpdated ? ' · Updated ' + fmtDate(telemetry.lastUpdated) : '');
    wrap.appendChild(source);

    return wrap;
  }

  function renderLegacy2025(data) {
    const wrap = document.createElement('div');
    wrap.className = 'space-y-6';

    if (isAdmin) {
      const controls = document.createElement('div');
      controls.className = 'bg-slate-800/30 border border-slate-700/50 rounded-lg p-4 mb-6';
      controls.innerHTML =
        '<div class="flex items-center justify-between mb-3">' +
          '<div class="text-slate-300 text-sm font-semibold">📊 MYLAPS Speedhive Integration</div>' +
          '<div class="text-xs text-green-400 bg-green-500/20 px-2 py-1 rounded">2025 Data Loaded</div>' +
        '</div>' +
        '<div class="text-slate-400 text-xs">Displaying official 2025 American Super Cup results from MYLAPS Speedhive</div>';
      wrap.appendChild(controls);
    }

    const champ = renderChampionship(data);
    if (champ) wrap.appendChild(champ);

    const headerDiv = document.createElement('div');
    headerDiv.className = 'text-center mb-6';
    headerDiv.innerHTML =
      '<h4 class="text-2xl font-racing text-white uppercase mb-2">📅 Race Results Breakdown</h4>' +
      '<div class="text-slate-400 text-sm">Detailed session-by-session results from MYLAPS Speedhive</div>';
    wrap.appendChild(headerDiv);

    [...data.events]
      .sort(function (a, b) { return new Date(b.date) - new Date(a.date); })
      .forEach(function (event) {
        wrap.appendChild(renderEvent(event));
      });

    if (data.seasonSummary) {
      const summaryDiv = document.createElement('div');
      summaryDiv.className = 'bg-slate-800/30 rounded-xl p-6 mt-8 border border-slate-700/50';
      summaryDiv.innerHTML =
        '<div class="text-center">' +
          '<h4 class="font-racing text-xl uppercase text-white mb-4"><i class="fas fa-chart-line text-blue-400 mr-2"></i>2025 Season Statistics</h4>' +
          '<div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">' +
            '<div class="text-center"><div class="text-2xl font-bold text-yellow-400">' + data.seasonSummary.featureWins + '</div><div class="text-slate-300 text-sm">Feature Wins</div></div>' +
            '<div class="text-center"><div class="text-2xl font-bold text-orange-400">' + data.seasonSummary.heatWins + '</div><div class="text-slate-300 text-sm">Heat Wins</div></div>' +
            '<div class="text-center"><div class="text-2xl font-bold text-blue-400">' + data.seasonSummary.podiumFinishes + '</div><div class="text-slate-300 text-sm">Podium Finishes</div></div>' +
            '<div class="text-center"><div class="text-2xl font-bold text-green-400">' + data.seasonSummary.averageFinishPosition + '</div><div class="text-slate-300 text-sm">Avg. Finish</div></div>' +
          '</div>' +
          '<div class="text-slate-400 text-sm">Best Lap: <span class="text-yellow-400 font-mono">' + data.seasonSummary.bestLapTime + 's</span> at ' + data.seasonSummary.bestTrack + '</div>' +
        '</div>';
      wrap.appendChild(summaryDiv);
    }

    return wrap;
  }

  async function loadAndRender() {
    try {
      root.innerHTML = '<div class="flex items-center justify-center py-8"><div class="text-slate-400"><i class="fas fa-spinner fa-spin mr-2"></i>Loading MYLAPS Speedhive results...</div></div>';

      const [telemetry, data2025] = await Promise.all([
        loadJson('./data/jon-asc-telemetry.json'),
        loadJson('./data/jon-2025-speedhive-results.json')
      ]);

      let content;
      if (telemetry && telemetry.events && telemetry.events.length) {
        content = renderTelemetryView(telemetry, data2025);
      } else if (data2025 && data2025.events && data2025.events.length) {
        content = renderLegacy2025(data2025);
      } else {
        root.innerHTML =
          '<div class="text-center py-12">' +
            '<div class="text-slate-400 text-lg mb-2">No race results found</div>' +
            '<div class="text-slate-500 text-sm">MYLAPS Speedhive data not available</div>' +
          '</div>';
        return;
      }

      root.innerHTML = '';
      root.appendChild(content);
    } catch (error) {
      console.error('Error rendering Speedhive results:', error);
      root.innerHTML =
        '<div class="text-center py-8">' +
          '<div class="text-red-400 mb-2">⚠️ Failed to load MYLAPS Speedhive results</div>' +
          '<div class="text-slate-500 text-sm">Please try refreshing the page</div>' +
        '</div>';
    }
  }

  try {
    if (typeof monitorAuthState === 'function' && typeof validateUserClaims === 'function') {
      monitorAuthState(async function (user) {
        if (user) {
          try {
            const res = await validateUserClaims(['team-member']);
            isAdmin = res.success || (res && res.claims && res.claims.role === 'admin');
          } catch (_) {
            isAdmin = false;
          }
        } else {
          isAdmin = false;
        }
        await loadAndRender();
      }, async function () {
        isAdmin = false;
        await loadAndRender();
      });
    } else {
      await loadAndRender();
    }
  } catch (_) {
    await loadAndRender();
  }
})();
