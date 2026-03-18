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

    sortedRaces.forEach(race => {
      const raceDate = new Date(race.date + 'T00:00:00');
      const isPast = raceDate < today;
      const cardClass = isPast ? 'past' : 'upcoming';
      
      const formattedDate = raceDate.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });

      const dayOfWeek = raceDate.toLocaleString('en-US', { weekday: 'short' });

      // Create card using DOM methods to prevent XSS
      const card = document.createElement('div');
      card.className = `schedule-card p-4 rounded-lg ${cardClass}`;
      
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
        const raceSnapshot = await window.__countdownDb.collection('races')
          .where('season', '==', 2026)
          .where('type', '==', 'superCup')
          .orderBy('date', 'asc')
          .limit(1)
          .get();

        if (!raceSnapshot.empty) {
          const firstRace = raceSnapshot.docs[0].data();
          const raceDate = firstRace.date;

          // Parse the date — handle both Firestore Timestamp and string
          if (raceDate && raceDate.toDate) {
            nextRaceDate = raceDate.toDate().getTime();
          } else if (typeof raceDate === 'string') {
            nextRaceDate = new Date(raceDate).getTime();
          }

          nextRaceName = firstRace.eventName || firstRace.name || 'First Race';
          console.log('Schedule countdown synced from Firestore:', nextRaceName);
        }
      }
    } catch (error) {
      console.warn('Firestore countdown unavailable, using local schedule:', error);
    }

    // Fallback to local JSON data if Firestore didn't work
    if (!nextRaceDate) {
      const nextRace = races.find(race => new Date(race.date + 'T00:00:00') >= today);
      if (nextRace) {
        nextRaceName = nextRace.eventName;
        nextRaceDate = new Date(nextRace.date + 'T00:00:00').getTime();
      }
    }

    if (nextRaceName && nextRaceDate) {
      const nextRaceNameEl = document.getElementById('next-race-name');
      if (nextRaceNameEl) nextRaceNameEl.textContent = nextRaceName;

      function tick() {
        const now = new Date().getTime();
        const distance = nextRaceDate - now;
        const countdownTimerEl = document.getElementById('countdown-timer');

        if (distance < 0) {
          clearInterval(activeCountdownInterval);
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

  // Initialize
  loadSchedule();
})();
