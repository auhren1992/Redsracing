// Schedule handler with season dropdown support
(async function() {
  let scheduleData = null;
  let currentSeasonYear = 2026;

  // Load schedule data
  async function loadSchedule() {
    try {
      const response = await fetch('data/schedule.json', { cache: 'no-store' });
      scheduleData = await response.json();
      currentSeasonYear = scheduleData.currentSeason || 2026;
      
      // Populate season dropdown
      populateSeasonDropdown();
      
      // Display current season
      displaySeason(currentSeasonYear);
    } catch (error) {
      console.error('Failed to load schedule:', error);
      document.getElementById('super-cups-schedule').innerHTML = '<p class="text-slate-400">Failed to load schedule data.</p>';
    }
  }

  // Populate season dropdown with available seasons
  function populateSeasonDropdown() {
    const selector = document.getElementById('season-selector');
    if (!selector || !scheduleData || !scheduleData.seasons) return;

    selector.innerHTML = '';
    scheduleData.seasons.forEach(season => {
      const option = document.createElement('option');
      option.value = season.year;
      option.textContent = `${season.year} Season`;
      if (season.year === currentSeasonYear) {
        option.selected = true;
      }
      selector.appendChild(option);
    });

    // Add change listener
    selector.addEventListener('change', (e) => {
      displaySeason(parseInt(e.target.value));
    });
  }

  function raceStatusFlags(race, today) {
    const raceDate = new Date(race.date + 'T00:00:00');
    const status = String(race.status || '').toLowerCase();
    const isRainout = status === 'rainout';
    const isPast = raceDate < today || isRainout || status === 'completed';
    return { raceDate, isRainout, isPast };
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function buildRaceCard(race, opts) {
    const isPast = opts.isPast;
    const isRainout = opts.isRainout;
    const isNextUp = opts.isNextUp;
    const raceDate = opts.raceDate;
    const month = raceDate.toLocaleString('en-US', { month: 'short' });
    const dayNum = raceDate.toLocaleString('en-US', { day: 'numeric' });
    const dayOfWeek = raceDate.toLocaleString('en-US', { weekday: 'short' });

    const card = el('article', `schedule-card ${isRainout ? 'past rainout' : (isPast ? 'past' : 'upcoming')}${isNextUp ? ' next-up' : ''}`);
    card.dataset.raceDate = race.date || '';
    card.dataset.raceCity = race.city || '';
    card.dataset.raceState = race.state || '';
    card.dataset.nextUp = isNextUp ? '1' : '0';
    card.dataset.filter = isPast || isRainout ? 'past' : 'upcoming';

    const rail = el('div', 'sched-date-rail');
    rail.appendChild(el('span', 'sched-date-rail__dow', dayOfWeek));
    rail.appendChild(el('span', 'sched-date-rail__day', dayNum));
    rail.appendChild(el('span', 'sched-date-rail__mon', month));

    const body = el('div', 'sched-card-body');
    const raceNo = race.raceNumber ? `Race ${race.raceNumber} · ` : '';
    body.appendChild(el('h4', 'sched-card-title', `${raceNo}${race.eventName}`));
    body.appendChild(el('p', 'sched-card-track', `${race.track} · ${race.city}, ${race.state}`));

    if (race.startTime && race.startTime !== 'TBD') {
      const startTime = el('p', 'sched-card-time rr-start-time', `Green flag ${race.startTime}`);
      startTime.setAttribute('data-start-time', '1');
      body.appendChild(startTime);
    }

    const badges = el('div', 'race-badges');
    if (isNextUp) {
      const b = el('span', 'race-badge next');
      b.innerHTML = '<i class="fas fa-bolt"></i> NEXT UP';
      badges.appendChild(b);
    }
    const seriesBadge = el('span', 'race-badge');
    seriesBadge.textContent = race.type === 'specialEvent' ? 'SPECIAL EVENT' : 'SUPER CUP';
    badges.appendChild(seriesBadge);
    if (isRainout) {
      const rainBadge = el('span', 'race-badge');
      rainBadge.style.borderColor = 'rgba(239,68,68,0.5)';
      rainBadge.style.color = '#fca5a5';
      rainBadge.innerHTML = '<i class="fas fa-cloud-showers-heavy"></i> RAIN OUT';
      badges.appendChild(rainBadge);
    }
    if (!isPast && !isRainout) {
      const wxBadge = el('span', 'race-badge wx-badge');
      wxBadge.dataset.wxSlot = '1';
      wxBadge.innerHTML = '<i class="fas fa-cloud-sun"></i> Weather…';
      badges.appendChild(wxBadge);
    }
    body.appendChild(badges);

    const actions = el('div', 'race-actions');
    if (isNextUp) {
      const hubLink = el('a', 'race-btn primary');
      hubLink.href = 'next-race.html';
      hubLink.innerHTML = '<i class="fas fa-bolt"></i> Next Race Hub';
      actions.appendChild(hubLink);
    }
    const mapsLink = el('a', 'race-btn');
    mapsLink.target = '_blank';
    mapsLink.rel = 'noopener';
    mapsLink.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${race.track} ${race.city}, ${race.state}`)}`;
    mapsLink.innerHTML = '<i class="fas fa-map-marker-alt"></i> Map';
    actions.appendChild(mapsLink);
    const ticketUrl = getTicketsUrlForRace(race);
    if (ticketUrl) {
      const ticketsLink = el('a', 'race-btn primary');
      ticketsLink.target = '_blank';
      ticketsLink.rel = 'noopener';
      ticketsLink.href = ticketUrl;
      ticketsLink.innerHTML = '<i class="fas fa-ticket-alt"></i> Tickets';
      actions.appendChild(ticketsLink);
    }
    const icsBtn = el('button', 'race-btn');
    icsBtn.type = 'button';
    icsBtn.innerHTML = '<i class="fas fa-calendar-plus"></i> Add';
    icsBtn.addEventListener('click', () => {
      try {
        downloadIcs({
          title: race.eventName,
          date: race.date,
          startTime: race.startTime,
          location: `${race.track}, ${race.city}, ${race.state}`,
        });
      } catch (e) {
        console.warn('ICS failed', e);
      }
    });
    actions.appendChild(icsBtn);
    body.appendChild(actions);

    const status = el('div', 'sched-card-status');
    status.textContent = isRainout ? 'Rain out' : (isPast ? 'Done' : 'Upcoming');
    status.dataset.state = isRainout ? 'rainout' : (isPast ? 'past' : 'upcoming');

    card.appendChild(rail);
    card.appendChild(body);
    card.appendChild(status);
    return card;
  }

  function updateSeasonChrome(year, season) {
    const kicker = document.getElementById('schedule-season-kicker');
    if (kicker) kicker.textContent = `${year} Season`;

    const races = season.races || [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let done = 0;
    const tracks = new Set();
    races.forEach((r) => {
      const flags = raceStatusFlags(r, today);
      if (flags.isPast) done += 1;
      if (r.track) tracks.add(String(r.track).toLowerCase());
    });
    const setText = (id, val) => {
      const node = document.getElementById(id);
      if (node) node.textContent = String(val);
    };
    setText('stat-total', races.length);
    setText('stat-done', done);
    setText('stat-tracks', tracks.size);
  }

  function applyScheduleFilter(filter) {
    const active = filter || 'all';
    document.querySelectorAll('.sched-filter').forEach((btn) => {
      const on = btn.dataset.filter === active;
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    document.querySelectorAll('.schedule-card').forEach((card) => {
      const kind = card.dataset.filter || 'upcoming';
      card.hidden = !(active === 'all' || kind === active);
    });
  }

  function wireScheduleFilters() {
    const bar = document.querySelector('.sched-filters');
    if (!bar || bar.dataset.wired === '1') return;
    bar.dataset.wired = '1';
    bar.addEventListener('click', (e) => {
      const btn = e.target.closest('.sched-filter');
      if (!btn) return;
      applyScheduleFilter(btn.dataset.filter || 'all');
    });
  }

  // Display races for selected season
  function displaySeason(year) {
    const season = scheduleData.seasons.find(s => s.year === year);
    if (!season) return;

    const superCupsContainer = document.getElementById('super-cups-schedule');
    const specialEventsContainer = document.getElementById('special-events-schedule');

    if (superCupsContainer) superCupsContainer.innerHTML = '';
    if (specialEventsContainer) specialEventsContainer.innerHTML = '';

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const sortedRaces = [...season.races].sort((a, b) => new Date(a.date) - new Date(b.date));
    let markedNextUp = false;

    updateSeasonChrome(year, season);
    wireScheduleFilters();

    sortedRaces.forEach(race => {
      const flags = raceStatusFlags(race, today);
      const isNextUp = !flags.isPast && !flags.isRainout && !markedNextUp && race.type !== 'specialEvent';
      if (isNextUp) markedNextUp = true;
      const card = buildRaceCard(race, {
        isPast: flags.isPast,
        isRainout: flags.isRainout,
        isNextUp,
        raceDate: flags.raceDate,
      });
      const container = race.type === 'specialEvent' ? specialEventsContainer : superCupsContainer;
      if (container) container.appendChild(card);
    });

    if (superCupsContainer && superCupsContainer.innerHTML === '') {
      superCupsContainer.innerHTML = '<p class="text-slate-400 text-center py-8">No Super Cup races scheduled for this season.</p>';
    }
    const specialCol = document.getElementById('special-events-column');
    const columns = document.querySelector('.sched-columns');
    const specialEmpty = specialEventsContainer && specialEventsContainer.innerHTML === '';
    if (specialEmpty) {
      specialEventsContainer.innerHTML = '<p class="text-slate-400 text-center py-8">No special events scheduled for this season.</p>';
      if (specialCol) specialCol.hidden = true;
      if (columns) columns.classList.add('is-single');
    } else {
      if (specialCol) specialCol.hidden = false;
      if (columns) columns.classList.remove('is-single');
    }

    const activeFilter = document.querySelector('.sched-filter.is-active');
    applyScheduleFilter(activeFilter ? activeFilter.dataset.filter : 'all');

    try {
      enrichScheduleWeather(sortedRaces.filter((r) => new Date(r.date + 'T00:00:00') >= today));
    } catch (e) {
      console.warn('Weather enrich failed', e);
    }

    if (season.isActive) {
      updateCountdown(sortedRaces);
    } else {
      updateCountdownForPastSeason();
    }
  }

  // Active countdown interval (track so we can clear on season switch)
  let activeCountdownInterval = null;

  // Update countdown timer for next race (synced with homepage via Firestore)
  async function updateCountdown(races) {
    // Clear any previous countdown interval
    if (activeCountdownInterval) {
      clearInterval(activeCountdownInterval);
      activeCountdownInterval = null;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let nextRaceName = null;
    let nextRaceDate = null;

    // Try Firestore first — same query as index.html so both pages stay in sync
    try {
      if (window.__countdownDb) {
        const todayStr = window.RRRaceDateTime
          ? window.RRRaceDateTime.localTodayYmd()
          : today.toISOString().split('T')[0];
        const raceSnapshot = await window.__countdownDb.collection('races')
          .where('season', '==', 2026)
          .where('type', '==', 'superCup')
          .where('date', '>=', todayStr)
          .orderBy('date', 'asc')
          .limit(8)
          .get();

        if (!raceSnapshot.empty) {
          let firstRace = null;
          raceSnapshot.forEach((doc) => {
            const row = doc.data() || {};
            if (String(row.status || '').toLowerCase() === 'rainout') return;
            if (!firstRace) firstRace = row;
          });
          if (firstRace) {
            if (window.RRRaceDateTime) {
              nextRaceDate = window.RRRaceDateTime.raceDateTimeMs(firstRace.date, firstRace.startTime);
            } else if (firstRace.date && firstRace.date.toDate) {
              nextRaceDate = firstRace.date.toDate().getTime();
            } else if (typeof firstRace.date === 'string') {
              nextRaceDate = new Date(firstRace.date + 'T19:00:00').getTime();
            }

            nextRaceName = firstRace.eventName || firstRace.name || 'Next Race';
            console.log('Schedule countdown synced from Firestore:', nextRaceName, firstRace.startTime || 'TBD');
          }
        }
      }
    } catch (error) {
      console.warn('Firestore countdown unavailable, using local schedule:', error);
    }

    // Fallback to local JSON data if Firestore didn't work
    if (!nextRaceDate) {
      const nextRace = races.find(race =>
        new Date(race.date + 'T00:00:00') >= today &&
        String(race.status || '').toLowerCase() !== 'rainout'
      );
      if (nextRace) {
        nextRaceName = nextRace.eventName;
        nextRaceDate = window.RRRaceDateTime
          ? window.RRRaceDateTime.raceDateTimeMs(nextRace.date, nextRace.startTime)
          : new Date(nextRace.date + 'T19:00:00').getTime();
      }
    }

    if (nextRaceName && nextRaceDate) {
      const nextRaceNameEl = document.getElementById('next-race-name');
      if (nextRaceNameEl) nextRaceNameEl.textContent = nextRaceName;
      const metaEl = document.getElementById('next-race-meta');
      if (metaEl) {
        const local = races.find((r) =>
          (r.eventName || r.name) === nextRaceName &&
          new Date(r.date + 'T00:00:00') >= today &&
          String(r.status || '').toLowerCase() !== 'rainout'
        ) || races.find((r) =>
          new Date(r.date + 'T00:00:00') >= today &&
          String(r.status || '').toLowerCase() !== 'rainout'
        );
        if (local) {
          const when = new Date(local.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
          const time = local.startTime && local.startTime !== 'TBD' ? ` · ${local.startTime}` : '';
          metaEl.textContent = `${when}${time} · ${local.track}, ${local.city} ${local.state}`;
        } else {
          metaEl.textContent = 'Countdown synced to the next Super Cup green flag.';
        }
      }

      function tick() {
        const now = new Date().getTime();
        const distance = nextRaceDate - now;
        const countdownTimerEl = document.getElementById('countdown-timer');

        if (distance < 0) {
          clearInterval(activeCountdownInterval);
          if (countdownTimerEl) {
            countdownTimerEl.className = 'sched-count';
            countdownTimerEl.innerHTML = '<div class="sched-count__cell" style="grid-column:1/-1"><div class="sched-count__num" style="color:#fbbf24">RACE DAY</div><div class="sched-count__lbl">See you at the track</div></div>';
          }
          return;
        }

        const daysEl = document.getElementById('days');
        const hoursEl = document.getElementById('hours');
        const minutesEl = document.getElementById('minutes');
        const secondsEl = document.getElementById('seconds');

        if (daysEl) daysEl.textContent = Math.floor(distance / (1000 * 60 * 60 * 24));
        if (hoursEl) hoursEl.textContent = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        if (minutesEl) minutesEl.textContent = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        if (secondsEl) secondsEl.textContent = Math.floor((distance % (1000 * 60)) / 1000);
      }

      tick(); // Run immediately so there's no flash of "0"
      activeCountdownInterval = setInterval(tick, 1000);
    } else {
      updateCountdownForPastSeason();
    }
  }

  // Update countdown display for past seasons
  function updateCountdownForPastSeason() {
    const nextRaceNameEl = document.getElementById('next-race-name');
    const countdownTimerEl = document.getElementById('countdown-timer');
    const metaEl = document.getElementById('next-race-meta');

    if (nextRaceNameEl) nextRaceNameEl.textContent = 'Season Complete';
    if (metaEl) metaEl.textContent = 'Switch to the active season to see the next green flag.';
    if (countdownTimerEl) {
      countdownTimerEl.className = 'sched-count';
      countdownTimerEl.innerHTML = '<div class="sched-count__cell" style="grid-column:1/-1"><div class="sched-count__num" style="font-size:1.35rem;color:#94a3b8">Pick a live season</div><div class="sched-count__lbl">Countdown lives on the current year</div></div>';
    }
  }

  // Helper to escape HTML
  function escapeHTML(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function normalizeTrackName(name) {
    return String(name || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function getTicketsUrlForRace(race) {
    if (race && typeof race.ticketsUrl === 'string' && race.ticketsUrl.trim()) return race.ticketsUrl.trim();
    const track = normalizeTrackName(race && race.track);

    // Prefer official venue ticket/info pages (or their official ticketing provider pages)
    if (track.includes('grundy county speedway')) return 'http://www.grundycountyspeedwayonline.com/tickets.html';
    if (track.includes('golden sands')) return 'https://www.gssraces.com/ticketinfo/';
    if (track.includes('slinger')) return 'https://slingersuperspeedway.com/slinger-tickets/';
    if (track.includes('tomah')) return 'https://www.myracepass.com/tracks/3598/tickets';
    if (track.includes('la crosse')) return 'https://www.eventsprout.com/events/lacrosse-fairgrounds-speedway';
    if (track.includes('dells raceway')) return 'https://www.dellsracewaypark.com/ticketinfo/';
    if (track.includes('rockford speedway')) return 'https://rockfordspeedway.com/';
    if (track.includes('milwaukee mile')) return 'https://milwaukeemile.com/';

    return '';
  }

  // Generate a simple ICS file and download it (client-side)
  function downloadIcs({ title, date, startTime, location }) {
    const safeTitle = String(title || 'RedsRacing Event');
    const safeLocation = String(location || '');
    const dt = String(date || '').replace(/-/g, '');
    // If start time is unknown, use 7pm local as a reasonable default placeholder
    const t = (startTime && startTime !== 'TBD') ? String(startTime) : '7:00 PM';
    // Convert "7:00 PM" -> 190000 (best effort)
    let hh = 19, mm = 0;
    const m = t.match(/(\d{1,2})\s*:\s*(\d{2})\s*(AM|PM)/i);
    if (m) {
      hh = parseInt(m[1], 10);
      mm = parseInt(m[2], 10);
      const ap = (m[3] || '').toUpperCase();
      if (ap === 'PM' && hh < 12) hh += 12;
      if (ap === 'AM' && hh === 12) hh = 0;
    }
    const hh2 = String(hh).padStart(2, '0');
    const mm2 = String(mm).padStart(2, '0');
    // Use floating local time (no Z) to avoid timezone confusion
    const dtStart = `${dt}T${hh2}${mm2}00`;
    // Default duration 2 hours
    const end = new Date(`${date}T${hh2}:${mm2}:00`);
    end.setHours(end.getHours() + 2);
    const dtEnd = `${end.getFullYear()}${String(end.getMonth()+1).padStart(2,'0')}${String(end.getDate()).padStart(2,'0')}T${String(end.getHours()).padStart(2,'0')}${String(end.getMinutes()).padStart(2,'0')}00`;
    const uid = `${Date.now()}@redsracing.org`;
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');

    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//RedsRacing//Schedule//EN',
      'CALSCALE:GREGORIAN',
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${dtStart}`,
      `DTEND:${dtEnd}`,
      `SUMMARY:${safeTitle.replace(/,/g, '\\,')}`,
      safeLocation ? `LOCATION:${safeLocation.replace(/,/g, '\\,')}` : '',
      'END:VEVENT',
      'END:VCALENDAR',
    ].filter(Boolean).join('\r\n');

    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${safeTitle.replace(/[^a-z0-9]+/gi,'-').replace(/^-|-$/g,'').toLowerCase() || 'race'}.ics`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 0);
  }

  async function loadHubWeatherNote() {
    try {
      if (!window.firebase || !window.firebase.firestore) return null;
      const snap = await window.firebase.firestore().doc('config/homepage_pulse').get();
      if (!snap.exists) return null;
      const hub = (snap.data() || {}).hub || {};
      const note = String(hub.weatherNote || '').trim();
      if (!note) return null;
      return { note, override: !!hub.weatherOverride };
    } catch (_) {
      return null;
    }
  }

  function paintWxSlot(slot, wx, hubWx, isNextUp) {
    if (!slot) return;
    if (hubWx && hubWx.override && isNextUp) {
      slot.classList.add('wx-risk-medium');
      slot.title = hubWx.note;
      slot.innerHTML = '<i class="fas fa-pen"></i> Team update';
      return;
    }
    if (!wx) {
      slot.innerHTML = '<i class="fas fa-cloud"></i> Weather TBD';
      return;
    }
    slot.classList.add(window.RRRaceWeather.riskClass(wx.risk));
    const precip = Number.isFinite(wx.precipProb) ? wx.precipProb + '% rain' : wx.label;
    const noteBit = hubWx && hubWx.note && isNextUp ? ' · ' + hubWx.note : '';
    slot.title = (wx.summary || '') + (wx.tempLine ? ' · ' + wx.tempLine : '') + noteBit;
    slot.innerHTML = `<i class="${wx.icon}"></i> ${precip}${wx.risk === 'high' ? ' · WATCH' : ''}${hubWx && hubWx.note && isNextUp ? ' · NOTE' : ''}`;
  }

  async function enrichScheduleWeather(upcomingRaces) {
    if (!upcomingRaces || !upcomingRaces.length) return;
    const hubWx = await loadHubWeatherNote();
    const banner = document.getElementById('sched-weather-banner');
    if (banner) {
      if (hubWx && hubWx.note) {
        banner.hidden = false;
        banner.textContent = '';
        const icon = document.createElement('i');
        icon.className = hubWx.override ? 'fas fa-cloud-sun-rain' : 'fas fa-pen';
        icon.setAttribute('aria-hidden', 'true');
        const strong = document.createElement('strong');
        strong.textContent = hubWx.override ? 'Team weather override: ' : 'Team weather note: ';
        banner.appendChild(icon);
        banner.appendChild(document.createTextNode(' '));
        banner.appendChild(strong);
        banner.appendChild(document.createTextNode(hubWx.note));
      } else {
        banner.hidden = true;
        banner.textContent = '';
      }
    }

    if (!window.RRRaceWeather) {
      if (hubWx && hubWx.override) {
        document.querySelectorAll('.schedule-card.next-up [data-wx-slot="1"]').forEach((slot) => {
          paintWxSlot(slot, null, hubWx, true);
        });
      }
      return;
    }

    // Forecast horizon is limited — only next ~16 days matter for Open-Meteo daily
    const horizon = new Date();
    horizon.setDate(horizon.getDate() + 16);
    const near = upcomingRaces.filter((r) => new Date(r.date + 'T00:00:00') <= horizon);
    if (!near.length) {
      document.querySelectorAll('.wx-badge').forEach((el) => {
        const card = el.closest('.schedule-card');
        if (hubWx && hubWx.override && card && card.dataset.nextUp === '1') {
          paintWxSlot(el, null, hubWx, true);
        } else {
          el.innerHTML = '<i class="fas fa-cloud-sun"></i> Forecast closer to race';
        }
      });
      return;
    }
    const map = await window.RRRaceWeather.forRaces(near);
    document.querySelectorAll('.schedule-card[data-race-date]').forEach((card) => {
      const slot = card.querySelector('[data-wx-slot="1"]');
      if (!slot) return;
      const isNextUp = card.dataset.nextUp === '1';
      if (hubWx && hubWx.override && isNextUp) {
        paintWxSlot(slot, null, hubWx, true);
        return;
      }
      const key = (card.dataset.raceDate || '') + '|' + (card.dataset.raceCity || '') + '|' + (card.dataset.raceState || '');
      const wx = map.get(key);
      if (!wx) {
        const d = new Date((card.dataset.raceDate || '') + 'T00:00:00');
        if (d > horizon) {
          slot.innerHTML = '<i class="fas fa-cloud-sun"></i> Forecast closer to race';
        } else {
          paintWxSlot(slot, null, hubWx, isNextUp);
        }
        return;
      }
      paintWxSlot(slot, wx, hubWx, isNextUp);
    });
  }

  // Initialize
  loadSchedule();
})();
