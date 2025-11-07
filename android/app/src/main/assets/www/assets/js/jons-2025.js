(async function initJons2025Stats() {
  let root = document.getElementById('jons-2025-stats');
  if (!root) {
    // Fallback: create container if missing
    const fallback = document.createElement('div');
    fallback.id = 'jons-2025-stats';
    fallback.className = 'max-w-6xl mx-auto space-y-8 mb-12';
    const hostSection = document.querySelector('section') || document.body;
    hostSection.appendChild(fallback);
    root = fallback;
  }
  // Debug marker to verify script execution
  try {
    const marker = document.createElement('div');
    marker.className = 'text-center text-xs text-slate-500 mb-2';
    marker.textContent = 'Loading 2025 MYLAPS data...';
    root.appendChild(marker);
  } catch {}

  let isAdmin = false;

  // Load 2025 MYLAPS Speedhive data
  async function load2025Data() {
    try {
      const response = await fetch('./data/jon-2025-speedhive-results.json', { 
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      if (!response.ok) {
        console.warn('Could not load 2025 race data:', response.status);
        return getDefault2025Data();
      }
      const data = await response.json();
      // Ensure we have the most recent data by checking localStorage backup
      const backupData = localStorage.getItem('jons-2025-backup');
      if (backupData) {
        const backup = JSON.parse(backupData);
        if (new Date(backup.lastUpdated) > new Date(data.lastUpdated)) {
          console.log('Using more recent backup data for 2025');
          return backup;
        }
      }
      // Save current data as backup
      localStorage.setItem('jons-2025-backup', JSON.stringify(data));
      return data;
    } catch (error) {
      console.warn('Error loading 2025 race data:', error);
      // Try to load from localStorage backup
      const backupData = localStorage.getItem('jons-2025-backup');
      if (backupData) {
        console.log('Loading 2025 data from backup');
        return JSON.parse(backupData);
      }
      return getDefault2025Data();
    }
  }

  // Default 2025 data structure based on the current HTML content
  function getDefault2025Data() {
    return {
      season: "2025",
      series: "American Super Cup",
      driver: "Jon Kirsch",
      carNumber: "#8",
      lastUpdated: new Date().toISOString(),
      championship: {
        dropPointStandings: 4,
        totalPoints: 415,
        featureWins: 1,
        heatWins: 2,
        podiumFinishes: 3
      },
      events: [
        {
          eventName: "Labor Day of Doom",
          date: "2025-08-31",
          track: "Dells Raceway Park, WI",
          trackLength: "0.3333 mi",
          sessions: [
            {
              sessionType: "ASC Practice 2",
              position: 7,
              lapTime: "17.716",
              speed: "67.729",
              totalTime: null,
              gapToLeader: "+0.489s"
            },
            {
              sessionType: "ASC Heat 2",
              position: 1,
              lapTime: "17.619",
              speed: "68.101",
              totalTime: "2:25.948",
              gapToLeader: "WINNER"
            },
            {
              sessionType: "ASC Feature",
              position: 3,
              lapTime: "17.475",
              speed: "68.663",
              totalTime: "4:31.305",
              gapToLeader: "+3.028s"
            }
          ],
          highlights: ["🏆 Heat Race Victory", "🥉 Feature Podium", "⏱️ 17.475s Best Lap"],
          summary: "Jon Kirsch delivered an exceptional performance at Dells Raceway Park, capturing a dominant heat race victory with a commanding performance over 8 laps. His consistency continued into the feature race where he secured a well-earned 3rd place podium finish."
        },
        {
          eventName: "Golden Sands Speedway",
          date: "2025-08-31",
          track: "Golden Sands Speedway, WI",
          trackLength: "0.25 mi",
          sessions: [
            {
              sessionType: "Qualifying",
              position: 3,
              lapTime: "14.412",
              speed: null,
              totalTime: null,
              gapToLeader: null
            },
            {
              sessionType: "Heat Race",
              position: 1,
              lapTime: "14.335",
              speed: null,
              totalTime: null,
              gapToLeader: "WINNER"
            },
            {
              sessionType: "Feature",
              position: 1,
              lapTime: "14.198",
              speed: null,
              totalTime: null,
              gapToLeader: "WINNER"
            }
          ],
          highlights: ["🏆 PERFECT WEEKEND", "🏆 Feature Win", "🏆 Heat Win"],
          summary: "Jon Kirsch swept Golden Sands Speedway with qualifying 3rd, winning his heat, and capturing the feature race victory!"
        },
        {
          eventName: "Dells Raceway Park",
          date: "2025-07-25",
          track: "Dells Raceway Park, WI",
          trackLength: "0.3333 mi",
          sessions: [
            {
              sessionType: "Qualifying",
              position: 6,
              lapTime: "17.235",
              speed: null,
              totalTime: null,
              gapToLeader: null
            },
            {
              sessionType: "Heat Race",
              position: 1,
              lapTime: "17.619",
              speed: null,
              totalTime: null,
              gapToLeader: "WINNER"
            },
            {
              sessionType: "Feature",
              position: 3,
              lapTime: "17.475",
              speed: null,
              totalTime: null,
              gapToLeader: null
            }
          ],
          highlights: ["🏆 Heat Win", "🏆 Podium Finish"],
          summary: "Jon Kirsch delivered exceptional racing at Dells, winning his heat race and converting it to a podium finish in the feature."
        },
        {
          eventName: "Slinger Speedway",
          date: "2025-06-07",
          track: "Slinger Speedway, WI",
          trackLength: "0.25 mi",
          sessions: [
            {
              sessionType: "Qualifying",
              position: 5,
              lapTime: "15.947",
              speed: null,
              totalTime: null,
              gapToLeader: null
            },
            {
              sessionType: "Heat Race",
              position: 6,
              lapTime: "15.444",
              speed: null,
              totalTime: null,
              gapToLeader: null
            },
            {
              sessionType: "Feature",
              position: 3,
              lapTime: "15.285",
              speed: null,
              totalTime: null,
              gapToLeader: null
            }
          ],
          highlights: ["🏆 Podium Finish"],
          summary: "Strong performance at Slinger with a feature podium finish."
        },
        {
          eventName: "Grundy County Speedway",
          date: "2025-05-25",
          track: "Grundy County Speedway, IL",
          trackLength: "0.25 mi",
          sessions: [
            {
              sessionType: "Qualifying",
              position: 4,
              lapTime: "14.625",
              speed: null,
              totalTime: null,
              gapToLeader: null
            },
            {
              sessionType: "Heat Race",
              position: 3,
              lapTime: "14.783",
              speed: null,
              totalTime: null,
              gapToLeader: null
            },
            {
              sessionType: "Feature",
              position: 5,
              lapTime: "14.559",
              speed: null,
              totalTime: null,
              gapToLeader: null
            }
          ],
          highlights: ["💪 Top 5 Finish"],
          summary: "Solid season opener with consistent performance across all sessions."
        }
      ]
    };
  }

  function formatPosition(position) {
    if (!position) return '';
    const pos = parseInt(position);
    if (pos === 1) return `<span class="text-yellow-400 font-bold">${pos}st 🏆</span>`;
    if (pos === 2) return `<span class="text-orange-400 font-bold">${pos}nd 🥈</span>`;
    if (pos === 3) return `<span class="text-orange-400 font-bold">${pos}rd 🥉</span>`;
    if (pos <= 5) return `<span class="text-blue-400 font-bold">${pos}th</span>`;
    if (pos <= 10) return `<span class="text-green-400">${pos}th</span>`;
    return `<span class="text-slate-300">${pos}th</span>`;
  }

  function formatLapTime(time) {
    if (!time) return '';
    return `<span class="text-slate-300 font-mono">${time}s</span>`;
  }

  function formatSpeed(speed) {
    if (!speed) return '';
    return `<span class="text-green-400">${speed} mph</span>`;
  }

  function renderEvent(event) {
    const eventDiv = document.createElement('div');
    eventDiv.className = 'bg-slate-800/50 backdrop-blur-md rounded-xl border border-slate-700/50 overflow-hidden mb-6';
    
    const dateObj = new Date(event.date);
    const formattedDate = dateObj.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
    
    // Determine header color based on best result
    const positions = event.sessions.filter(s => typeof s.position === 'number').map(s => s.position);
    const bestPosition = positions.length ? Math.min(...positions) : Infinity;
    let headerColor = 'from-slate-600 to-slate-500';
    if (bestPosition === 1) headerColor = 'from-yellow-600 to-yellow-500';
    else if (bestPosition === 2 || bestPosition === 3) headerColor = 'from-orange-600 to-orange-500';
    else if (bestPosition <= 5) headerColor = 'from-blue-600 to-blue-500';
    else if (bestPosition <= 10) headerColor = 'from-green-600 to-green-500';
    
    eventDiv.innerHTML = `
      <div class="bg-gradient-to-r ${headerColor} px-6 py-4">
        <div class="flex items-center justify-between">
          <h3 class="text-white font-racing text-xl uppercase font-bold">${event.eventName}</h3>
          <div class="text-white font-bold text-sm">${event.track} (${event.trackLength})</div>
        </div>
        <div class="text-white/80 text-sm mt-1">${formattedDate}</div>
      </div>
      <div class="p-6">
        <div class="grid grid-cols-1 md:grid-cols-${Math.min(event.sessions.length, 4)} gap-4 mb-4">
          ${event.sessions.map(session => `
            <div class="stat-card-3d text-center py-3">
              <div class="text-sm text-slate-400 mb-1">${session.sessionType}</div>
              <div class="text-2xl mb-1">${formatPosition(session.position)}</div>
              ${session.lapTime ? `<div class="text-sm mb-1">${formatLapTime(session.lapTime)}</div>` : ''}
              ${session.speed ? `<div class="text-xs text-slate-500">${formatSpeed(session.speed)}</div>` : ''}
              ${session.totalTime ? `<div class="text-xs text-slate-400">${session.totalTime}</div>` : ''}
              ${session.gapToLeader && session.gapToLeader !== 'WINNER' ? `<div class="text-xs text-slate-400">${session.gapToLeader}</div>` : ''}
            </div>
          `).join('')}
        </div>
        
        ${event.highlights ? `
          <div class="mt-4 flex flex-wrap justify-center gap-2">
            ${event.highlights.map(highlight => `
              <div class="bg-yellow-500/20 border border-yellow-400/40 rounded-full px-3 py-1">
                <span class="text-yellow-400 font-bold text-sm">${highlight}</span>
              </div>
            `).join('')}
          </div>
        ` : ''}
        
        ${event.summary ? `
          <div class="mt-4 p-4 bg-slate-700/30 rounded-lg border border-slate-600/30">
            <p class="text-slate-300 text-sm text-center leading-relaxed">${event.summary}</p>
          </div>
        ` : ''}
        
        <div class="mt-3 pt-3 border-t border-slate-600/30 text-center">
          <p class="text-slate-500 text-xs">
            <i class="fas fa-external-link-alt mr-1"></i>
            Source: <a href="https://speedhive.mylaps.com" target="_blank" rel="noopener" class="text-yellow-400 hover:text-yellow-300 transition-colors">MYLAPS Speedhive Official Results</a>
          </p>
        </div>
      </div>
    `;
    
    return eventDiv;
  }

  async function loadAndRender() {
    try {
      root.innerHTML = '<div class="flex items-center justify-center py-8"><div class="text-slate-400"><i class="fas fa-spinner fa-spin mr-2"></i>Loading 2025 race results...</div></div>';
      
      // Load 2025 race data
      const data = await load2025Data();

      const wrap = document.createElement('div');
      wrap.className = 'space-y-6';

      // Admin controls
      if (isAdmin) {
        const controls = document.createElement('div');
        controls.className = 'bg-slate-800/30 border border-slate-700/50 rounded-lg p-4 mb-6';
        controls.innerHTML = `
          <div class="flex items-center justify-between mb-3">
            <div class="text-slate-300 text-sm font-semibold">📊 2025 MYLAPS Speedhive Integration</div>
            <div class="text-xs text-green-400 bg-green-500/20 px-2 py-1 rounded">Data Protected</div>
          </div>
          <div class="text-slate-400 text-xs">Official 2025 American Super Cup results with backup persistence</div>
        `;
        wrap.appendChild(controls);
      }

      if (!data || !data.events || data.events.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'text-center py-12';
        empty.innerHTML = `
          <div class="text-slate-400 text-lg mb-2">No 2025 race results found</div>
          <div class="text-slate-500 text-sm">MYLAPS Speedhive data not available</div>
        `;
        wrap.appendChild(empty);
        root.innerHTML = '';
        root.appendChild(wrap);
        return;
      }

      // Championship summary header
      if (data.championship) {
        const championshipDiv = document.createElement('div');
        championshipDiv.className = 'bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 rounded-xl border border-yellow-400/20 p-6 mb-8';
        championshipDiv.innerHTML = `
          <div class="text-center mb-4">
            <h3 class="text-white font-racing text-2xl uppercase font-bold mb-2">
              <i class="fas fa-trophy text-yellow-400 mr-2"></i>
              ${data.season} ${data.series} Championship
            </h3>
            <div class="text-slate-300 text-sm">${data.driver} ${data.carNumber}</div>
          </div>
          
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div class="text-center">
              <div class="text-4xl font-bold text-blue-400 mb-1">${data.championship.dropPointStandings}${data.championship.dropPointStandings <= 3 ? (data.championship.dropPointStandings === 1 ? 'st' : data.championship.dropPointStandings === 2 ? 'nd' : 'rd') : 'th'}</div>
              <div class="text-slate-300 text-sm uppercase font-semibold">Championship</div>
            </div>
            <div class="text-center">
              <div class="text-4xl font-bold text-green-400 mb-1">${data.championship.totalPoints}</div>
              <div class="text-slate-300 text-sm uppercase font-semibold">Total Points</div>
            </div>
            <div class="text-center">
              <div class="text-4xl font-bold text-yellow-400 mb-1">${data.championship.featureWins}</div>
              <div class="text-slate-300 text-sm uppercase font-semibold">Feature Wins</div>
            </div>
            <div class="text-center">
              <div class="text-4xl font-bold text-orange-400 mb-1">${data.championship.podiumFinishes}</div>
              <div class="text-slate-300 text-sm uppercase font-semibold">Podium Finishes</div>
            </div>
          </div>
          
          <div class="text-center">
            <p class="text-slate-300 text-sm leading-relaxed">
              <strong class="text-white">Successful 2025 Campaign:</strong> 
              Jon Kirsch delivered consistent performance throughout the 2025 American Super Cup season, 
              highlighted by his dominant victory at Golden Sands Speedway and multiple podium finishes. 
              His 4th place championship finish with ${data.championship.totalPoints} points demonstrates the competitive excellence 
              and racecraft that defines the #8 team.
            </p>
          </div>
          
          <div class="text-center text-slate-400 text-xs mt-4">
            Last Updated: ${new Date(data.lastUpdated).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        `;
        wrap.appendChild(championshipDiv);
      }

      // Event results header
      const headerDiv = document.createElement('div');
      headerDiv.className = 'text-center mb-6';
      headerDiv.innerHTML = `
        <h4 class="text-2xl font-racing text-white uppercase mb-2">📅 2025 Race Results Breakdown</h4>
        <div class="text-slate-400 text-sm">Detailed session-by-session results from MYLAPS Speedhive</div>
      `;
      wrap.appendChild(headerDiv);

      // Render events in reverse chronological order (most recent first)
      const sortedEvents = [...data.events].sort((a, b) => new Date(b.date) - new Date(a.date));
      console.log('Rendering 2025 events in order:', sortedEvents.map(e => `${e.date}: ${e.eventName}`));
      sortedEvents.forEach(event => {
        wrap.appendChild(renderEvent(event));
      });

      root.innerHTML = '';
      root.appendChild(wrap);

      console.log('Jon\'s 2025 race stats loaded and rendered successfully');
    } catch (error) {
      console.error('Error rendering 2025 race stats:', error);
      root.innerHTML = `
        <div class="text-center py-12">
          <div class="text-red-400 text-lg mb-2">Error loading 2025 race results</div>
          <div class="text-slate-500 text-sm">Please try refreshing the page</div>
        </div>
      `;
    }
  }

  // Function to save updated data (for admin use)
  window.updateJons2025Data = async function(newData) {
    if (!isAdmin) {
      console.warn('Unauthorized: Only admins can update race data');
      return;
    }
    
    try {
      // Update timestamp
      newData.lastUpdated = new Date().toISOString();
      
      // Save to localStorage as backup (this prevents data loss!)
      localStorage.setItem('jons-2025-backup', JSON.stringify(newData));
      
      // Re-render with new data
      await loadAndRender();
      
      console.log('Jon\'s 2025 race data updated and backed up successfully');
    } catch (error) {
      console.error('Error updating 2025 race data:', error);
    }
  };

  // Function to export data for backup
  window.exportJons2025Data = function() {
    const backup = localStorage.getItem('jons-2025-backup');
    if (backup) {
      const blob = new Blob([backup], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `jons-2025-speedhive-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  // Initialize the stats display
  await loadAndRender();

})();