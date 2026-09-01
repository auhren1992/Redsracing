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
    if (t == null || t === '') return '—';
    return Number(t).toFixed(3) + 's';
  }

  function posClass(pos) {
    if (!pos) return 'sh-pos-other';
    if (pos === 1) return 'sh-pos-win';
    if (pos <= 3) return 'sh-pos-podium';
    if (pos <= 5) return 'sh-pos-top5';
    if (pos <= 10) return 'sh-pos-top10';
    return 'sh-pos-other';
  }

  function posLabel(pos) {
    if (!pos) return '—';
    if (pos === 1) return pos + 'st 🏆';
    if (pos === 2) return pos + 'nd';
    if (pos === 3) return pos + 'rd';
    return pos + 'th';
  }

  function headerClassForEvent(sessions) {
    const positions = sessions.filter(function (s) { return s.position; }).map(function (s) { return s.position; });
    if (!positions.length) return 'sh-hdr-default';
    const best = Math.min.apply(null, positions);
    if (best === 1) return 'sh-hdr-win';
    if (best <= 3) return 'sh-hdr-podium';
    if (best <= 5) return 'sh-hdr-top5';
    if (best <= 10) return 'sh-hdr-top10';
    return 'sh-hdr-default';
  }

  function highlightClass(text) {
    if (/win|pole/i.test(text)) return 'win';
    if (/podium|p2|p3|top-?5/i.test(text)) return 'podium';
    return '';
  }

  function normalizeSession(s) {
    return {
      sessionType: s.type || s.sessionType,
      position: s.position,
      lapTime: s.bestLap != null ? String(s.bestLap) : (s.lapTime || null),
      speed: s.bestSpeed != null ? String(s.bestSpeed) : (s.speed || null),
      totalTime: s.totalTime || null,
      laps: s.laps || null,
      notes: s.notes || null
    };
  }

  function normalizeTelemetryEvent(e) {
    return {
      id: e.id || e.date,
      season: String(e.season || '2025'),
      eventName: e.name || e.eventName,
      date: e.date,
      track: e.venue || e.track || '',
      trackLength: e.trackLength || '',
      highlights: e.highlights || [],
      sessions: (e.sessions || []).map(normalizeSession)
    };
  }

  function normalizeLegacyEvent(e) {
    return {
      id: e.id || e.date,
      season: '2025',
      eventName: e.eventName,
      date: e.date,
      track: e.track || '',
      trackLength: e.trackLength || '',
      highlights: e.highlights || [],
      summary: e.summary || null,
      sessions: (e.sessions || []).map(normalizeSession)
    };
  }

  function mergeEventsForSeason(telemetryEvents, legacyData, season) {
    const merged = new Map();

    telemetryEvents
      .filter(function (e) { return String(e.season) === String(season); })
      .forEach(function (e) {
        const norm = normalizeTelemetryEvent(e);
        merged.set(norm.id, norm);
      });

    if (String(season) === '2025' && legacyData && legacyData.events) {
      legacyData.events.forEach(function (e) {
        const norm = normalizeLegacyEvent(e);
        const existing = merged.get(norm.id);
        if (!existing) {
          merged.set(norm.id, norm);
          return;
        }
        if ((!existing.sessions || !existing.sessions.some(function (s) { return s.laps && s.laps.length; })) && norm.sessions.length > existing.sessions.length) {
          merged.set(norm.id, Object.assign({}, existing, {
            track: existing.track || norm.track,
            trackLength: existing.trackLength || norm.trackLength,
            highlights: existing.highlights.length ? existing.highlights : norm.highlights,
            sessions: norm.sessions
          }));
        }
      });
    }

    return Array.from(merged.values()).sort(function (a, b) {
      return new Date(b.date) - new Date(a.date);
    });
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
      ['Best Lap', session.lapTime ? (String(session.lapTime).indexOf('s') > -1 ? session.lapTime : fmtTime(session.lapTime)) : '—'],
      ['Best Speed', session.speed ? session.speed + ' mph' : '—'],
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

  function sessionCardHtml(session) {
    return '<div class="sh-session-card">' +
      '<div class="sh-session-type">' + session.sessionType + '</div>' +
      '<div class="sh-session-pos ' + posClass(session.position) + '">' + posLabel(session.position) + '</div>' +
      (session.lapTime ? '<div class="sh-lap-time">' + fmtTime(session.lapTime) + '</div>' : '') +
      (session.speed ? '<div class="sh-session-meta">' + session.speed + ' mph</div>' : '') +
      (session.totalTime ? '<div class="sh-session-meta">' + session.totalTime + '</div>' : '') +
      (session.notes ? '<div class="sh-session-meta">' + session.notes + '</div>' : '') +
    '</div>';
  }

  function bindLapDetail(eventDiv, event, lapPaneId) {
    const toggle = eventDiv.querySelector('.sh-toggle-laps');
    const pane = eventDiv.querySelector('#' + lapPaneId);
    if (!toggle || !pane) return;

    const lapSessions = event.sessions
      .map(function (s, i) { return { session: s, index: i }; })
      .filter(function (x) { return x.session.laps && x.session.laps.length; });

    if (!lapSessions.length) return;

    const tabsHtml = lapSessions.map(function (x, i) {
      const s = x.session;
      const label = s.sessionType + (s.position ? ' · ' + fmtPos(s.position) : '');
      return '<button type="button" class="sh-session-tab' + (i === 0 ? ' active' : '') + '" data-idx="' + x.index + '">' + label + '</button>';
    }).join('');

    function showSession(sessionIdx) {
      pane.querySelectorAll('.sh-session-tab').forEach(function (tab) {
        tab.classList.toggle('active', parseInt(tab.dataset.idx, 10) === sessionIdx);
      });
      const detail = pane.querySelector('.sh-session-pane');
      if (detail) detail.innerHTML = sessionDetailHtml(event.sessions[sessionIdx]);
    }

    toggle.addEventListener('click', function () {
      const open = toggle.getAttribute('aria-expanded') !== 'true';
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      pane.hidden = !open;
      if (open && !pane.dataset.ready) {
        pane.innerHTML = '<div class="sh-session-tabs">' + tabsHtml + '</div><div class="sh-session-pane"></div>';
        pane.querySelectorAll('.sh-session-tab').forEach(function (tab) {
          tab.addEventListener('click', function () {
            showSession(parseInt(tab.dataset.idx, 10));
          });
        });
        pane.dataset.ready = '1';
        showSession(lapSessions[0].index);
      }
    });
  }

  function renderEvent(event) {
    const eventDiv = document.createElement('article');
    eventDiv.className = 'sh-event-card';

    const hasLapDetail = event.sessions.some(function (s) { return s.laps && s.laps.length; });
    const lapPaneId = 'sh-laps-' + String(event.id).replace(/[^a-z0-9_-]/gi, '-');
    const trackLine = event.track + (event.trackLength ? ' (' + event.trackLength + ')' : '');

    eventDiv.innerHTML =
      '<div class="sh-event-header ' + headerClassForEvent(event.sessions) + '">' +
        '<div class="sh-event-header-top">' +
          '<h3 class="sh-event-title">' + event.eventName + '</h3>' +
          (trackLine ? '<div class="sh-event-track">' + trackLine + '</div>' : '') +
        '</div>' +
        '<div class="sh-event-date">' + fmtDate(event.date) + '</div>' +
      '</div>' +
      '<div class="sh-event-body">' +
        '<div class="sh-session-grid">' +
          event.sessions.map(sessionCardHtml).join('') +
        '</div>' +
        (event.highlights && event.highlights.length ? (
          '<div class="sh-highlights">' +
            event.highlights.map(function (h) {
              return '<span class="sh-highlight ' + highlightClass(h) + '">' + h + '</span>';
            }).join('') +
          '</div>'
        ) : '') +
        (hasLapDetail ? (
          '<div class="sh-lap-toggle-wrap">' +
            '<button type="button" class="sh-toggle-laps" aria-expanded="false" aria-controls="' + lapPaneId + '">' +
              '<i class="fas fa-chevron-down" aria-hidden="true"></i> Lap-by-lap detail' +
            '</button>' +
          '</div>' +
          '<div id="' + lapPaneId + '" class="sh-event-expand sh-lap-detail" hidden></div>'
        ) : '') +
      '</div>';

    if (hasLapDetail) bindLapDetail(eventDiv, event, lapPaneId);
    return eventDiv;
  }

  function statCell(val, label) {
    return '<div class="sh-stat"><div class="sh-stat-val">' + (val != null ? val : '—') + '</div><div class="sh-stat-label">' + label + '</div></div>';
  }

  function renderSeasonSummary(highlights, season) {
    if (!highlights) return null;
    const div = document.createElement('div');
    div.className = 'sh-season-summary';
    div.dataset.seasonPanel = String(season);
    div.innerHTML =
      '<h4 class="sh-summary-title">' + season + ' Season Snapshot</h4>' +
      '<p class="sh-summary-sub">From MYLAPS Speedhive timing data</p>' +
      '<div class="sh-stat-grid">' +
        statCell(highlights.events, 'Events') +
        statCell(highlights.podiums, 'Podiums') +
        statCell(highlights.heatWins, 'Heat Wins') +
        statCell(highlights.poles, 'Poles') +
        statCell(highlights.bestLap ? highlights.bestLap + 's' : '—', 'Best Lap') +
      '</div>' +
      (highlights.bestTrack ? '<p class="sh-best-track">Best lap at <strong>' + highlights.bestTrack + '</strong></p>' : '');
    return div;
  }

  function renderChampionship(data) {
    if (!data || !data.championship) return null;
    const div = document.createElement('div');
    div.className = 'sh-championship';
    const ord = data.championship.dropPointStandings;
    const ordLabel = ord <= 3 ? (ord === 1 ? 'st' : ord === 2 ? 'nd' : 'rd') : 'th';
    div.innerHTML =
      '<h4 class="sh-summary-title"><i class="fas fa-trophy" style="color:var(--rr-accent)"></i> ' + data.season + ' ' + data.series + ' Championship</h4>' +
      '<p class="sh-summary-sub">' + data.driver + ' ' + data.carNumber + '</p>' +
      '<div class="sh-champ-grid">' +
        '<div class="sh-champ-stat"><div class="sh-champ-val" style="color:var(--rr-accent)">' + ord + ordLabel + '</div><div class="sh-champ-label">Championship</div></div>' +
        '<div class="sh-champ-stat"><div class="sh-champ-val" style="color:#34d399">' + data.championship.totalPoints + '</div><div class="sh-champ-label">Total Points</div></div>' +
        '<div class="sh-champ-stat"><div class="sh-champ-val" style="color:#fb923c">' + data.championship.featureWins + '</div><div class="sh-champ-label">Feature Wins</div></div>' +
        '<div class="sh-champ-stat"><div class="sh-champ-val" style="color:#60a5fa">' + data.championship.heatWins + '</div><div class="sh-champ-label">Heat Wins</div></div>' +
      '</div>';
    return div;
  }

  function renderMainView(telemetry, data2025) {
    const wrap = document.createElement('div');

    const telemetryEvents = (telemetry.events || []).map(normalizeTelemetryEvent);
    const seasons = [];
    telemetryEvents.forEach(function (e) {
      if (seasons.indexOf(e.season) === -1) seasons.push(e.season);
    });
    if (data2025 && seasons.indexOf('2025') === -1) seasons.push('2025');
    seasons.sort().reverse();

    let activeSeason = seasons[0] || '2026';
    const eventsBySeason = {};
    seasons.forEach(function (s) {
      eventsBySeason[s] = mergeEventsForSeason(telemetry.events || [], data2025, s);
    });

    const tabs = document.createElement('div');
    tabs.className = 'sh-season-tabs';
    const summarySlot = document.createElement('div');
    const champSlot = document.createElement('div');
    const list = document.createElement('div');

    function refreshSeason() {
      summarySlot.querySelectorAll('[data-season-panel]').forEach(function (panel) {
        panel.style.display = panel.dataset.seasonPanel === activeSeason ? '' : 'none';
      });
      if (champSlot.firstChild) {
        champSlot.style.display = activeSeason === '2025' && data2025 ? '' : 'none';
      }
      list.querySelectorAll('[data-season]').forEach(function (card) {
        card.style.display = card.dataset.season === activeSeason ? '' : 'none';
      });
    }

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
        refreshSeason();
      });
      tabs.appendChild(btn);
    });
    wrap.appendChild(tabs);

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

    const champ = renderChampionship(data2025);
    if (champ) {
      if (activeSeason !== '2025') champSlot.style.display = 'none';
      champSlot.appendChild(champ);
      wrap.appendChild(champSlot);
    }

    const heading = document.createElement('div');
    heading.className = 'sh-events-heading';
    heading.innerHTML = '<h4>Race Weekends</h4><p>Session results from each event</p>';
    wrap.appendChild(heading);

    seasons.forEach(function (s) {
      eventsBySeason[s].forEach(function (event) {
        const card = renderEvent(event);
        card.dataset.season = s;
        if (s !== activeSeason) card.style.display = 'none';
        list.appendChild(card);
      });
    });
    wrap.appendChild(list);

    const source = document.createElement('p');
    source.className = 'sh-source';
    source.innerHTML =
      '<i class="fas fa-external-link-alt"></i> Powered by ' +
      '<a href="https://speedhive.mylaps.com" target="_blank" rel="noopener">MYLAPS Speedhive</a>' +
      (telemetry.lastUpdated ? ' · Updated ' + fmtDate(telemetry.lastUpdated) : '');
    wrap.appendChild(source);

    return wrap;
  }

  function renderLegacy2025(data) {
    const wrap = document.createElement('div');

    if (isAdmin) {
      const controls = document.createElement('div');
      controls.className = 'sh-season-summary';
      controls.innerHTML = '<p class="sh-summary-sub">Admin: 2025 MYLAPS Speedhive data loaded</p>';
      wrap.appendChild(controls);
    }

    const champ = renderChampionship(data);
    if (champ) wrap.appendChild(champ);

    const heading = document.createElement('div');
    heading.className = 'sh-events-heading';
    heading.innerHTML = '<h4>Race Weekends</h4><p>Session-by-session results from MYLAPS Speedhive</p>';
    wrap.appendChild(heading);

    data.events
      .slice()
      .sort(function (a, b) { return new Date(b.date) - new Date(a.date); })
      .forEach(function (e) {
        wrap.appendChild(renderEvent(normalizeLegacyEvent(e)));
      });

    if (data.seasonSummary) {
      const summary = renderSeasonSummary({
        events: data.events.length,
        podiums: data.seasonSummary.podiumFinishes,
        heatWins: data.seasonSummary.heatWins,
        poles: 0,
        bestLap: data.seasonSummary.bestLapTime,
        bestTrack: data.seasonSummary.bestTrack
      }, data.season || '2025');
      if (summary) wrap.appendChild(summary);
    }

    return wrap;
  }

  async function loadAndRender() {
    root.innerHTML = '<div class="sh-loading"><i class="fas fa-spinner fa-spin mr-2"></i>Loading MYLAPS Speedhive results…</div>';

    try {
      const [telemetry, data2025] = await Promise.all([
        loadJson('./data/jon-asc-telemetry.json'),
        loadJson('./data/jon-2025-speedhive-results.json')
      ]);

      let content;
      if (telemetry && telemetry.events && telemetry.events.length) {
        content = renderMainView(telemetry, data2025);
      } else if (data2025 && data2025.events && data2025.events.length) {
        content = renderLegacy2025(data2025);
      } else {
        root.innerHTML = '<div class="sh-empty"><div>No race results found</div><div class="text-sm mt-2">MYLAPS Speedhive data not available</div></div>';
        return;
      }

      root.innerHTML = '';
      root.appendChild(content);
    } catch (error) {
      console.error('Error rendering Speedhive results:', error);
      root.innerHTML = '<div class="sh-empty"><div>Failed to load MYLAPS Speedhive results</div><div class="text-sm mt-2">Please try refreshing the page</div></div>';
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
