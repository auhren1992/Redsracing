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

    // Sort races by date
    const sortedRaces = [...season.races].sort((a, b) => new Date(a.date) - new Date(b.date));
    let markedNextUp = false;

    sortedRaces.forEach(race => {
      const raceDate = new Date(race.date + 'T00:00:00');
      const isPast = raceDate < today;
      const cardClass = isPast ? 'past' : 'upcoming';
      const isNextUp = !isPast && !markedNextUp && race.type !== 'specialEvent';
      if (isNextUp) markedNextUp = true;
      
      const formattedDate = raceDate.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });

      const dayOfWeek = raceDate.toLocaleString('en-US', { weekday: 'short' });

      // Create card using DOM methods to prevent XSS
      const card = document.createElement('div');
      card.className = `schedule-card p-4 rounded-lg ${cardClass}${isNextUp ? ' next-up' : ''}`;
      
      const flexContainer = document.createElement('div');
      flexContainer.className = 'flex justify-between items-center';
      
      // Left side content
      const leftDiv = document.createElement('div');
      leftDiv.className = 'flex-1';
      
      const eventName = document.createElement('p');
      eventName.className = 'font-bold text-lg text-white';
      eventName.textContent = race.eventName;
      leftDiv.appendChild(eventName);
      
      const trackInfo = document.createElement('p');
      trackInfo.className = 'text-sm text-slate-400';
      trackInfo.textContent = `${race.track} • ${race.city}, ${race.state}`;
      leftDiv.appendChild(trackInfo);
      
      if (race.startTime !== 'TBD') {
        const startTime = document.createElement('p');
        startTime.className = 'text-xs text-slate-500 mt-1';
        startTime.textContent = `Start: ${race.startTime}`;
        leftDiv.appendChild(startTime);
      }

      // Badges row
      const badges = document.createElement('div');
      badges.className = 'race-badges';
      if (isNextUp) {
        const b = document.createElement('span');
        b.className = 'race-badge next';
        b.innerHTML = '<i class="fas fa-bolt"></i> NEXT UP';
        badges.appendChild(b);
      }
      const seriesBadge = document.createElement('span');
      seriesBadge.className = 'race-badge';
      seriesBadge.textContent = race.type === 'specialEvent' ? 'SPECIAL EVENT' : 'SUPER CUP';
      badges.appendChild(seriesBadge);
      leftDiv.appendChild(badges);

      // Actions row (map + add to calendar)
      const actions = document.createElement('div');
      actions.className = 'race-actions';

      const mapsLink = document.createElement('a');
      mapsLink.className = 'race-btn';
      mapsLink.target = '_blank';
      mapsLink.rel = 'noopener';
      const q = encodeURIComponent(`${race.track} ${race.city}, ${race.state}`);
      mapsLink.href = `https://www.google.com/maps/search/?api=1&query=${q}`;
      mapsLink.innerHTML = '<i class="fas fa-map-marker-alt"></i> Map';
      actions.appendChild(mapsLink);

      const ticketUrl = getTicketsUrlForRace(race);
      if (ticketUrl) {
        const ticketsLink = document.createElement('a');
        ticketsLink.className = 'race-btn primary';
        ticketsLink.target = '_blank';
        ticketsLink.rel = 'noopener';
        ticketsLink.href = ticketUrl;
        ticketsLink.innerHTML = '<i class="fas fa-ticket-alt"></i> Tickets';
        actions.appendChild(ticketsLink);
      }

      const icsBtn = document.createElement('button');
      icsBtn.type = 'button';
      icsBtn.className = 'race-btn';
      icsBtn.innerHTML = '<i class="fas fa-calendar-plus"></i> Add to Calendar';
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

      leftDiv.appendChild(actions);
      
      // Right side content
      const rightDiv = document.createElement('div');
      rightDiv.className = 'text-right';
      
      const dayDiv = document.createElement('div');
      dayDiv.className = 'font-semibold text-slate-300';
      dayDiv.textContent = dayOfWeek;
      rightDiv.appendChild(dayDiv);
      
      const dateDiv = document.createElement('div');
      dateDiv.className = `text-lg font-bold ${isPast ? 'text-slate-500' : 'text-yellow-400'}`;
      dateDiv.textContent = formattedDate;
      rightDiv.appendChild(dateDiv);
      
      const statusSpan = document.createElement('span');
      statusSpan.className = `text-xs ${isPast ? 'text-slate-600' : 'text-green-400'} uppercase`;
      statusSpan.textContent = isPast ? 'Completed' : 'Upcoming';
      rightDiv.appendChild(statusSpan);
      
      // Assemble the card
      flexContainer.appendChild(leftDiv);
      flexContainer.appendChild(rightDiv);
      card.appendChild(flexContainer);
      
      const container = race.type === 'specialEvent' ? specialEventsContainer : superCupsContainer;
      if (container) {
        container.appendChild(card);
      }
    });

    // Show message if no races
    if (superCupsContainer && superCupsContainer.innerHTML === '') {
      superCupsContainer.innerHTML = '<p class="text-slate-400 text-center py-8">No Super Cup races scheduled for this season.</p>';
    }
    if (specialEventsContainer && specialEventsContainer.innerHTML === '') {
      specialEventsContainer.innerHTML = '<p class="text-slate-400 text-center py-8">No special events scheduled for this season.</p>';
    }

    // Update countdown for current/active season
    if (season.isActive) {
      updateCountdown(sortedRaces);
    } else {
      updateCountdownForPastSeason();
    }
  }

  // Update countdown timer for next race
  function updateCountdown(races) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const nextRace = races.find(race => new Date(race.date + 'T00:00:00') >= today);
    
    if (nextRace) {
      const nextRaceNameEl = document.getElementById('next-race-name');
      if (nextRaceNameEl) nextRaceNameEl.textContent = nextRace.eventName;

      const nextRaceDate = new Date(nextRace.date + 'T19:00:00').getTime();
      
      const countdownInterval = setInterval(() => {
        const now = new Date().getTime();
        const distance = nextRaceDate - now;
        const countdownTimerEl = document.getElementById('countdown-timer');

        if (distance < 0) {
          clearInterval(countdownInterval);
          if (countdownTimerEl) {
            countdownTimerEl.innerHTML = '<div class="col-span-4 text-3xl font-racing text-yellow-400">RACE DAY!</div>';
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
      }, 1000);
    } else {
      updateCountdownForPastSeason();
    }
  }

  // Update countdown display for past seasons
  function updateCountdownForPastSeason() {
    const nextRaceNameEl = document.getElementById('next-race-name');
    const countdownTimerEl = document.getElementById('countdown-timer');
    
    if (nextRaceNameEl) nextRaceNameEl.textContent = 'Season Complete!';
    if (countdownTimerEl) {
      countdownTimerEl.innerHTML = '<div class="col-span-4 text-2xl font-racing text-slate-400">View upcoming season for next races</div>';
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

  // Initialize
  loadSchedule();
})();
