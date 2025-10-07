import "./app.js";
import { monitorAuthState, validateUserClaims } from "./auth-utils.js";

(async function initSpeedhiveResults(){
  const root = document.getElementById('race-results');
  if (!root) return;

  let isAdmin = false;

  // Load 2025 MYLAPS Speedhive data
  async function load2025Data() {
    try {
      const response = await fetch('./data/jon-2025-speedhive-results.json');
      if (!response.ok) {
        console.warn('Could not load 2025 race data');
        return null;
      }
      return await response.json();
    } catch (error) {
      console.warn('Error loading 2025 race data:', error);
      return null;
    }
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
      root.innerHTML = '<div class="flex items-center justify-center py-8"><div class="text-slate-400"><i class="fas fa-spinner fa-spin mr-2"></i>Loading 2025 MYLAPS Speedhive results...</div></div>';
      
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
            <div class="text-slate-300 text-sm font-semibold">📊 MYLAPS Speedhive Integration</div>
            <div class="text-xs text-green-400 bg-green-500/20 px-2 py-1 rounded">2025 Data Loaded</div>
          </div>
          <div class="text-slate-400 text-xs">Displaying official 2025 American Super Cup results from MYLAPS Speedhive</div>
        `;
        wrap.appendChild(controls);
      }

      if (!data || !data.events || data.events.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'text-center py-12';
        empty.innerHTML = `
          <div class="text-slate-400 text-lg mb-2">No race results found</div>
          <div class="text-slate-500 text-sm">2025 MYLAPS Speedhive data not available</div>
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
        <h4 class="text-2xl font-racing text-white uppercase mb-2">📅 Race Results Breakdown</h4>
        <div class="text-slate-400 text-sm">Detailed session-by-session results from MYLAPS Speedhive</div>
      `;
      wrap.appendChild(headerDiv);

      // Render events in reverse chronological order (most recent first)
      const sortedEvents = [...data.events].sort((a, b) => new Date(b.date) - new Date(a.date));
      sortedEvents.forEach(event => {
        wrap.appendChild(renderEvent(event));
      });

      root.innerHTML = '';
      root.appendChild(wrap);
    } catch (error) {
      console.error('Error rendering Speedhive results:', error);
      root.innerHTML = `
        <div class="text-center py-8">
          <div class="text-red-400 mb-2">⚠️ Failed to load MYLAPS Speedhive results</div>
          <div class="text-slate-500 text-sm">Please try refreshing the page</div>
        </div>
      `;
    }
  }

  // Auth-aware admin control
  monitorAuthState(async (user) => {
    if (user) {
      try {
        const res = await validateUserClaims(["team-member"]);
        isAdmin = res.success || (res?.claims?.role === 'admin');
      } catch { isAdmin = false; }
    } else {
      isAdmin = false;
    }
    await loadAndRender();
  }, async () => {
    isAdmin = false;
    await loadAndRender();
  });

  // Fallback initial render
  if (!root.__initialized) {
    root.__initialized = true;
    await loadAndRender();
  }
})();
