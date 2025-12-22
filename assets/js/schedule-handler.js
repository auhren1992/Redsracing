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

      const cardHTML = `
        <div class="schedule-card p-4 rounded-lg ${cardClass}">
          <div class="flex justify-between items-center">
            <div class="flex-1">
              <p class="font-bold text-lg text-white">${escapeHTML(race.eventName)}</p>
              <p class="text-sm text-slate-400">
                ${escapeHTML(race.track)} • ${escapeHTML(race.city)}, ${escapeHTML(race.state)}
              </p>
              ${race.startTime !== 'TBD' ? `<p class="text-xs text-slate-500 mt-1">Start: ${escapeHTML(race.startTime)}</p>` : ''}
            </div>
            <div class="text-right">
              <div class="font-semibold text-slate-300">${dayOfWeek}</div>
              <div class="text-lg font-bold ${isPast ? 'text-slate-500' : 'text-yellow-400'}">${formattedDate}</div>
              ${isPast ? '<span class="text-xs text-slate-600 uppercase">Completed</span>' : '<span class="text-xs text-green-400 uppercase">Upcoming</span>'}
            </div>
          </div>
        </div>
      `;

      const container = race.type === 'specialEvent' ? specialEventsContainer : superCupsContainer;
      if (container) {
        container.innerHTML += cardHTML;
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

  // Initialize
  loadSchedule();
})();
