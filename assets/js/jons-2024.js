import "./app.js";
import { monitorAuthState, validateUserClaims } from "./auth-utils.js";

(async function initJons2024Stats() {
  const root = document.getElementById('jons-2024-stats');
  if (!root) return;

  let isAdmin = false;

  // Monitor authentication state
  try {
    const claims = await validateUserClaims();
    isAdmin = claims.success && claims.claims.role === 'team-member';
  } catch (error) {
    console.warn('Auth validation failed:', error);
  }

  // Load 2024 MYLAPS Speedhive data
  async function load2024Data() {
    try {
      const response = await fetch('./data/jons-2024-speedhive-results.json', { 
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      if (!response.ok) {
        console.warn('Could not load 2024 race data:', response.status);
        return getDefault2024Data();
      }
      const data = await response.json();
      // Ensure we have the most recent data by checking localStorage backup
      const backupData = localStorage.getItem('jons-2024-backup');
      if (backupData) {
        const backup = JSON.parse(backupData);
        if (new Date(backup.lastUpdated) > new Date(data.lastUpdated)) {
          console.log('Using more recent backup data');
          return backup;
        }
      }
      // Save current data as backup
      localStorage.setItem('jons-2024-backup', JSON.stringify(data));
      return data;
    } catch (error) {
      console.warn('Error loading 2024 race data:', error);
      // Try to load from localStorage backup
      const backupData = localStorage.getItem('jons-2024-backup');
      if (backupData) {
        console.log('Loading from backup');
        return JSON.parse(backupData);
      }
      return getDefault2024Data();
    }
  }

  // Default 2024 data structure based on the current HTML content
  function getDefault2024Data() {
    return {
      season: "2024",
      series: "American Super Cup",
      driver: "Jon Kirsch",
      carNumber: "#8",
      lastUpdated: new Date().toISOString(),
      championship: {
        dropPointStandings: 4,
        totalPoints: 156,
        featureWins: 1,
        heatWins: 2,
        podiumFinishes: 5
      },
      events: [
        {
          eventName: "Small Car Nationals",
          date: "2024-08-03",
          track: "Slinger Super Speedway, WI",
          trackLength: "0.25 mi",
          sessions: [
            {
              sessionType: "Practice",
              position: 4,
              lapTime: "11.892",
              speed: null,
              totalTime: null,
              gapToLeader: null
            },
            {
              sessionType: "Qualifying", 
              position: 5,
              lapTime: "11.821",
              speed: null,
              totalTime: null,
              gapToLeader: null
            },
            {
              sessionType: "Feature",
              position: 2,
              lapTime: "11.748",
              speed: null,
              totalTime: null,
              gapToLeader: null
            }
          ],
          highlights: ["🏆 Podium Finish", "⚡ Fast Qualifier"],
          summary: "Jon Kirsch delivered an outstanding performance at the Small Car Nationals at Slinger Super Speedway. Starting 5th, he methodically worked his way forward on the high-banked quarter-mile to secure a strong 2nd place finish."
        },
        {
          eventName: "La Crosse Speedway",
          date: "2024-06-29", 
          track: "La Crosse Speedway, WI",
          trackLength: "0.33 mi",
          sessions: [
            {
              sessionType: "Practice",
              position: 6,
              lapTime: "16.245",
              speed: null,
              totalTime: null,
              gapToLeader: null
            },
            {
              sessionType: "Qualifying",
              position: 4,
              lapTime: "16.125", 
              speed: null,
              totalTime: null,
              gapToLeader: null
            },
            {
              sessionType: "Feature",
              position: 3,
              lapTime: "16.089",
              speed: null,
              totalTime: null,
              gapToLeader: null
            }
          ],
          highlights: ["🏆 Podium Finish"],
          summary: "Jon Kirsch continued his strong 2024 campaign with another podium finish at La Crosse Speedway. Starting 4th after a solid qualifying run, he worked his way to 3rd place on the one-third mile oval."
        },
        {
          eventName: "Golden Sands Speedway",
          date: "2024-05-27",
          track: "Golden Sands Speedway, WI", 
          trackLength: "0.25 mi",
          sessions: [
            {
              sessionType: "Practice",
              position: 5,
              lapTime: "14.521",
              speed: null,
              totalTime: null,
              gapToLeader: null
            },
            {
              sessionType: "Qualifying",
              position: 3,
              lapTime: "14.342",
              speed: null,
              totalTime: null,
              gapToLeader: null
            },
            {
              sessionType: "Feature",
              position: 1,
              lapTime: "14.198",
              speed: null,
              totalTime: null,
              gapToLeader: null
            }
          ],
          highlights: ["🏆 WINNER!", "🚀 Dominant Performance"],
          summary: "Jon Kirsch delivered a masterful performance at Golden Sands Speedway, converting his 3rd place qualifying position into a convincing victory. Starting on the front row, he took command of the race and never looked back."
        },
        {
          eventName: "Dells Raceway Park",
          date: "2024-05-11",
          track: "Dells Raceway Park, WI",
          trackLength: "0.33 mi",
          sessions: [
            {
              sessionType: "Practice",
              position: 7,
              lapTime: "16.125",
              speed: null,
              totalTime: null,
              gapToLeader: null
            },
            {
              sessionType: "Qualifying",
              position: 5,
              lapTime: "15.945",
              speed: null,
              totalTime: null,
              gapToLeader: null
            },
            {
              sessionType: "Feature",
              position: 3,
              lapTime: "15.821",
              speed: null,
              totalTime: null,
              gapToLeader: null
            }
          ],
          highlights: ["🏆 Podium Finish", "💪 Strong Start"],
          summary: "Jon Kirsch kicked off his 2024 season in fine form with a podium finish at Dells Raceway Park. Starting 5th, he methodically worked his way through the field to claim 3rd place on the one-third mile oval."
        },
        {
          eventName: "Season Opener",
          date: "2024-04-20",
          track: "Grundy County Speedway, IL",
          trackLength: "0.25 mi",
          sessions: [
            {
              sessionType: "Practice",
              position: 8,
              lapTime: "15.245",
              speed: null,
              totalTime: null,
              gapToLeader: null
            },
            {
              sessionType: "Qualifying",
              position: 7,
              lapTime: "15.102",
              speed: null,
              totalTime: null,
              gapToLeader: null
            },
            {
              sessionType: "Feature",
              position: 6,
              lapTime: "14.987",
              speed: null,
              totalTime: null,
              gapToLeader: null
            }
          ],
          highlights: ["🏁 Season Debut"],
          summary: "Jon Kirsch opened the 2024 season with a solid performance at Grundy County Speedway, setting the foundation for what would become a successful championship campaign."
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
    const bestPosition = Math.min(...event.sessions.filter(s => s.position).map(s => s.position));
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
              ${session.speed ? `<div class="text-xs text-slate-500">${session.speed} mph</div>` : ''}
              ${session.totalTime ? `<div class="text-xs text-slate-400">${session.totalTime}</div>` : ''}
              ${session.gapToLeader ? `<div class="text-xs text-slate-400">${session.gapToLeader}</div>` : ''}
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
      root.innerHTML = '<div class="flex items-center justify-center py-8"><div class="text-slate-400"><i class="fas fa-spinner fa-spin mr-2"></i>Loading 2024 race results...</div></div>';
      
      // Load 2024 race data
      const data = await load2024Data();

      const wrap = document.createElement('div');
      wrap.className = 'space-y-6';

      // Admin controls
      if (isAdmin) {
        const controls = document.createElement('div');
        controls.className = 'bg-slate-800/30 border border-slate-700/50 rounded-lg p-4 mb-6';
        controls.innerHTML = `
          <div class="flex items-center justify-between mb-3">
            <div class="text-slate-300 text-sm font-semibold">📊 2024 Season Data</div>
            <div class="text-xs text-green-400 bg-green-500/20 px-2 py-1 rounded">Data Loaded</div>
          </div>
          <div class="text-slate-400 text-xs">Jon's 2024 race results with persistence backup</div>
        `;
        wrap.appendChild(controls);
      }

      if (!data || !data.events || data.events.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'text-center py-12';
        empty.innerHTML = `
          <div class="text-slate-400 text-lg mb-2">No 2024 race results found</div>
          <div class="text-slate-500 text-sm">Race data not available</div>
        `;
        wrap.appendChild(empty);
        root.innerHTML = '';
        root.appendChild(wrap);
        return;
      }

      // Championship summary header
      if (data.championship) {
        const championshipDiv = document.createElement('div');
        championshipDiv.className = 'bg-gradient-to-r from-slate-700 to-slate-600 rounded-xl p-6 mb-8';
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
              <div class="text-3xl font-bold text-yellow-400 mb-1">${data.championship.dropPointStandings}${data.championship.dropPointStandings <= 3 ? (data.championship.dropPointStandings === 1 ? 'st' : data.championship.dropPointStandings === 2 ? 'nd' : 'rd') : 'th'}</div>
              <div class="text-slate-300 text-sm uppercase font-semibold">Championship</div>
            </div>
            <div class="text-center">
              <div class="text-3xl font-bold text-green-400 mb-1">${data.championship.totalPoints}</div>
              <div class="text-slate-300 text-sm uppercase font-semibold">Total Points</div>
            </div>
            <div class="text-center">
              <div class="text-3xl font-bold text-orange-400 mb-1">${data.championship.featureWins}</div>
              <div class="text-slate-300 text-sm uppercase font-semibold">Feature Wins</div>
            </div>
            <div class="text-center">
              <div class="text-3xl font-bold text-blue-400 mb-1">${data.championship.heatWins}</div>
              <div class="text-slate-300 text-sm uppercase font-semibold">Heat Wins</div>
            </div>
          </div>
          
          <div class="text-center text-slate-300 text-sm">
            Last Updated: ${new Date(data.lastUpdated).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        `;
        wrap.appendChild(championshipDiv);
      }

      // Event results header
      const headerDiv = document.createElement('div');
      headerDiv.className = 'text-center mb-6';
      headerDiv.innerHTML = `
        <h4 class="text-2xl font-racing text-white uppercase mb-2">📅 2024 Race Results</h4>
        <div class="text-slate-400 text-sm">Complete season breakdown with official timing data</div>
      `;
      wrap.appendChild(headerDiv);

      // Render events in reverse chronological order (most recent first)
      const sortedEvents = [...data.events].sort((a, b) => new Date(b.date) - new Date(a.date));
      console.log('Rendering 2024 events in order:', sortedEvents.map(e => `${e.date}: ${e.eventName}`));
      sortedEvents.forEach(event => {
        wrap.appendChild(renderEvent(event));
      });

      root.innerHTML = '';
      root.appendChild(wrap);

      console.log('Jon\'s 2024 race stats loaded and rendered successfully');
    } catch (error) {
      console.error('Error rendering 2024 race stats:', error);
      root.innerHTML = `
        <div class="text-center py-12">
          <div class="text-red-400 text-lg mb-2">Error loading 2024 race results</div>
          <div class="text-slate-500 text-sm">Please try refreshing the page</div>
        </div>
      `;
    }
  }

  // Function to save updated data (for admin use)
  window.updateJons2024Data = async function(newData) {
    if (!isAdmin) {
      console.warn('Unauthorized: Only admins can update race data');
      return;
    }
    
    try {
      // Update timestamp
      newData.lastUpdated = new Date().toISOString();
      
      // Save to localStorage as backup
      localStorage.setItem('jons-2024-backup', JSON.stringify(newData));
      
      // Re-render with new data
      await loadAndRender();
      
      console.log('Jon\'s 2024 race data updated successfully');
    } catch (error) {
      console.error('Error updating 2024 race data:', error);
    }
  };

  // Initialize the stats display
  await loadAndRender();

})();