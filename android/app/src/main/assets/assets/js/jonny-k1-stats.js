import "./app.js";
import { monitorAuthState, validateUserClaims } from "./auth-utils.js";

(async function initJonsK1Stats() {
  const root = document.getElementById('jonny-k1-stats');
  if (!root) return;

  let isAdmin = false;

  // Monitor authentication state
  try {
    const claims = await validateUserClaims();
    isAdmin = claims.success && claims.claims.role === 'team-member';
  } catch (error) {
    console.warn('Auth validation failed:', error);
  }

  // Load K1 Speed data
  async function loadK1Data() {
    try {
      const response = await fetch('./data/jonny-k1-addison-history.json', { 
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      if (!response.ok) {
        console.warn('Could not load K1 data:', response.status);
        return getDefaultK1Data();
      }
      const data = await response.json();
      // Ensure we have the most recent data by checking localStorage backup
      const backupData = localStorage.getItem('jonny-k1-backup');
      if (backupData) {
        const backup = JSON.parse(backupData);
        if (new Date(backup.lastUpdated) > new Date(data.lastUpdated)) {
          console.log('Using more recent K1 backup data');
          return backup;
        }
      }
      // Save current data as backup
      localStorage.setItem('jonny-k1-backup', JSON.stringify(data));
      return data;
    } catch (error) {
      console.warn('Error loading K1 data:', error);
      // Try to load from localStorage backup
      const backupData = localStorage.getItem('jonny-k1-backup');
      if (backupData) {
        console.log('Loading K1 data from backup');
        return JSON.parse(backupData);
      }
      return getDefaultK1Data();
    }
  }

  // Default K1 Speed data structure based on the current HTML content
  function getDefaultK1Data() {
    return {
      location: "K1 Speed Addison",
      locationState: "IL",
      driver: "Jonny Kirsch",
      lastUpdated: new Date().toISOString(),
      seasons: [
        {
          year: 2025,
          status: "ACTIVE SEASON",
          championshipStanding: 2,
          totalPoints: 160,
          bestLapTime: "29.842",
          racesCompleted: 8,
          gpPoints: [24, 22, 22, 31, 18, 15, 13, 15],
          averageLap: "30.123",
          topFinishes: 3,
          summary: "Elite Performance: Jonny Kirsch is having an outstanding 2025 season at K1 Speed Addison, currently sitting in 2nd place in the Adult League championship standings. With 160 points across 8 Grand Prix events, he's established himself as a consistent front-runner."
        },
        {
          year: 2024,
          status: "Previous Season",
          championshipStanding: 5,
          totalPoints: 142,
          bestLapTime: "30.145",
          racesCompleted: 12,
          gpPoints: [18, 20, 15, 12, 16, 19, 13, 11, 8, 14, 9, 7],
          averageLap: "30.789",
          topFinishes: 2,
          summary: "Building Momentum: Jonny's 2024 season at K1 Speed Addison was a solid foundation year, finishing 5th in the championship with 142 points. This season provided valuable experience in indoor karting competition and set the stage for his impressive 2025 championship run."
        },
        {
          year: 2023,
          status: "Debut Season",
          championshipStanding: 8,
          totalPoints: 89,
          bestLapTime: "30.892",
          racesCompleted: 10,
          gpPoints: [12, 8, 6, 9, 11, 7, 5, 10, 12, 9],
          averageLap: "31.456",
          topFinishes: 1,
          summary: "Racing Genesis: Jonny's 2023 debut season at K1 Speed Addison marked the beginning of his indoor karting journey. Finishing 8th with 89 points, this rookie campaign provided the foundation for everything that followed. The skills, racecraft, and competitive spirit developed during this first season have been instrumental in his progression to championship contention and his success in stock car racing."
        }
      ],
      careerStats: {
        totalRaces: 30,
        bestOverallLap: "29.842",
        totalPoints: 391,
        averageFinish: 5.2,
        winRate: "12%",
        podiumRate: "28%"
      }
    };
  }

  function renderSeasonCard(season) {
    const isCurrentSeason = season.year === 2025;
    const cardClass = isCurrentSeason 
      ? 'bg-gradient-to-r from-yellow-600 to-yellow-500' 
      : season.year === 2024 
        ? 'bg-gradient-to-r from-blue-600 to-blue-500'
        : 'bg-gradient-to-r from-purple-600 to-purple-500';

    const statusIndicator = isCurrentSeason 
      ? '<div class="w-2 h-2 bg-green-400 rounded-full animate-pulse mr-2"></div>ACTIVE SEASON'
      : season.status;

    const standingColor = season.championshipStanding <= 3 
      ? 'text-yellow-400' 
      : season.championshipStanding <= 5 
        ? 'text-blue-400' 
        : 'text-slate-300';

    const seasonDiv = document.createElement('div');
    seasonDiv.className = 'bg-slate-800/50 backdrop-blur-md rounded-xl border border-slate-700/50 overflow-hidden';
    
    // Generate GP points breakdown
    const gpPointsHtml = season.gpPoints && season.gpPoints.length 
      ? `<div class="bg-slate-700/30 rounded-lg p-4 border border-slate-600/30">
          <h4 class="text-white font-racing text-lg uppercase mb-3 text-center">Grand Prix Points Breakdown</h4>
          <div class="grid grid-cols-4 md:grid-cols-8 gap-2">
            ${season.gpPoints.map((points, index) => `
              <div class="text-center p-2 bg-slate-800/50 rounded">
                <div class="text-xs text-slate-400">GP${index + 1}</div>
                <div class="text-lg font-bold text-white">${points}</div>
              </div>
            `).join('')}
          </div>
        </div>`
      : '';

    seasonDiv.innerHTML = `
      <div class="${cardClass} px-6 py-4">
        <div class="flex items-center justify-between">
          <h3 class="text-white font-racing text-xl uppercase font-bold">K1 Speed Addison Adult League - ${season.year} Season</h3>
          <div class="text-white font-bold text-sm flex items-center">
            ${statusIndicator}
          </div>
        </div>
      </div>
      <div class="p-6">
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div class="stat-card-3d text-center py-3">
            <div class="text-sm text-slate-400 mb-1">Championship Standing</div>
            <div class="text-3xl font-bold ${standingColor}">${season.championshipStanding}${season.championshipStanding <= 3 ? (season.championshipStanding === 1 ? 'st' : season.championshipStanding === 2 ? 'nd' : 'rd') : 'th'}</div>
            ${season.championshipStanding <= 3 ? '<div class="text-xs text-yellow-400">🏆 PODIUM POSITION</div>' : ''}
          </div>
          <div class="stat-card-3d text-center py-3">
            <div class="text-sm text-slate-400 mb-1">Total Points</div>
            <div class="text-3xl font-bold text-white">${season.totalPoints}</div>
            <div class="text-xs text-slate-500">Championship Points</div>
          </div>
          <div class="stat-card-3d text-center py-3">
            <div class="text-sm text-slate-400 mb-1">Best Lap Time</div>
            <div class="text-3xl font-bold text-green-400">${season.bestLapTime}s</div>
            <div class="text-xs text-green-400">Personal Best</div>
          </div>
          <div class="stat-card-3d text-center py-3">
            <div class="text-sm text-slate-400 mb-1">Races Completed</div>
            <div class="text-3xl font-bold text-blue-400">${season.racesCompleted}</div>
            <div class="text-xs text-slate-500">Grand Prix Events</div>
          </div>
        </div>
        
        ${gpPointsHtml}
        
        <div class="mt-4 p-4 bg-slate-700/30 rounded-lg border border-slate-600/30">
          <div class="text-center mb-3">
            <h4 class="text-white font-racing text-lg uppercase">${season.year === 2025 ? '2025 Championship Contender' : season.year === 2024 ? 'Solid Foundation Year' : 'The Beginning'}</h4>
          </div>
          <div class="text-slate-300 text-sm leading-relaxed text-center">
            <p><strong class="text-white">${season.year === 2025 ? 'Elite Performance:' : season.year === 2024 ? 'Building Momentum:' : 'Racing Genesis:'}</strong> ${season.summary}</p>
          </div>
        </div>
      </div>
    `;
    
    return seasonDiv;
  }

  function renderCareerSummary(data) {
    const summaryDiv = document.createElement('div');
    summaryDiv.className = 'bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 rounded-xl border border-yellow-400/20 overflow-hidden';
    
    summaryDiv.innerHTML = `
      <div class="bg-gradient-to-r from-yellow-600 to-red-500 px-6 py-4">
        <div class="flex items-center justify-between">
          <h3 class="text-white font-racing text-xl uppercase font-bold">K1 Speed Career Summary</h3>
          <div class="text-white font-bold text-sm">3 Seasons • 2023-2025</div>
        </div>
      </div>
      <div class="p-6">
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div class="stat-card-3d text-center py-4">
            <div class="text-sm text-slate-400 mb-1">Total Races</div>
            <div class="text-4xl font-bold text-blue-400">${data.careerStats.totalRaces}</div>
            <div class="text-xs text-slate-500">Grand Prix Events</div>
          </div>
          <div class="stat-card-3d text-center py-4">
            <div class="text-sm text-slate-400 mb-1">Best Lap Ever</div>
            <div class="text-4xl font-bold text-green-400">${data.careerStats.bestOverallLap}s</div>
            <div class="text-xs text-green-400">Career Record</div>
          </div>
          <div class="stat-card-3d text-center py-4">
            <div class="text-sm text-slate-400 mb-1">Total Points</div>
            <div class="text-4xl font-bold text-yellow-400">${data.careerStats.totalPoints}</div>
            <div class="text-xs text-yellow-400">All Seasons</div>
          </div>
          <div class="stat-card-3d text-center py-4">
            <div class="text-sm text-slate-400 mb-1">Podium Rate</div>
            <div class="text-4xl font-bold text-orange-400">${data.careerStats.podiumRate}</div>
            <div class="text-xs text-orange-400">Top 3 Finishes</div>
          </div>
        </div>
        
        <div class="text-center">
          <p class="text-slate-300 text-sm leading-relaxed">
            <strong class="text-white">Three-Year Journey:</strong> 
            From rookie to championship contender, Jonny's K1 Speed progression tells the story of dedication and improvement. 
            Starting 8th in his debut season, he's climbed to 2nd place in 2025, demonstrating the same competitive drive 
            that makes him successful in stock car racing. His indoor karting experience has been instrumental in developing 
            the racecraft and consistency that defines his driving style.
          </p>
        </div>
        
        <div class="text-center text-slate-400 text-xs mt-4">
          Career Span: 2023-2025 • Location: K1 Speed Addison, IL
        </div>
      </div>
    `;
    
    return summaryDiv;
  }

  async function loadAndRender() {
    try {
      root.innerHTML = '<div class="flex items-center justify-center py-8"><div class="text-slate-400"><i class="fas fa-spinner fa-spin mr-2"></i>Loading K1 Speed stats...</div></div>';
      
      // Load K1 Speed data
      const data = await loadK1Data();

      const wrap = document.createElement('div');
      wrap.className = 'space-y-8';

      // Admin controls
      if (isAdmin) {
        const controls = document.createElement('div');
        controls.className = 'bg-slate-800/30 border border-slate-700/50 rounded-lg p-4 mb-6';
        controls.innerHTML = `
          <div class="flex items-center justify-between mb-3">
            <div class="text-slate-300 text-sm font-semibold">🏎️ K1 Speed Integration</div>
            <div class="text-xs text-green-400 bg-green-500/20 px-2 py-1 rounded">Multi-Season Data</div>
          </div>
          <div class="text-slate-400 text-xs">Jonny's complete K1 Speed Addison racing history with backup persistence</div>
        `;
        wrap.appendChild(controls);
      }

      if (!data || !data.seasons || data.seasons.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'text-center py-12';
        empty.innerHTML = `
          <div class="text-slate-400 text-lg mb-2">No K1 Speed data found</div>
          <div class="text-slate-500 text-sm">Racing history not available</div>
        `;
        wrap.appendChild(empty);
        root.innerHTML = '';
        root.appendChild(wrap);
        return;
      }

      // Header
      const headerDiv = document.createElement('div');
      headerDiv.className = 'text-center mb-8';
      headerDiv.innerHTML = `
        <h2 class="heading-premium text-5xl md:text-6xl mb-4">
          K1 Speed <span class="accent">Racing</span> Results
        </h2>
        <div class="text-slate-400 text-lg">Complete racing history at K1 Speed Addison Adult League</div>
      `;
      wrap.appendChild(headerDiv);

      // Render seasons (most recent first)
      const sortedSeasons = [...data.seasons].sort((a, b) => b.year - a.year);
      sortedSeasons.forEach(season => {
        wrap.appendChild(renderSeasonCard(season));
      });

      // Career summary
      wrap.appendChild(renderCareerSummary(data));

      root.innerHTML = '';
      root.appendChild(wrap);

      console.log('Jon\'s K1 Speed stats loaded and rendered successfully');
    } catch (error) {
      console.error('Error rendering K1 Speed stats:', error);
      root.innerHTML = `
        <div class="text-center py-12">
          <div class="text-red-400 text-lg mb-2">Error loading K1 Speed results</div>
          <div class="text-slate-500 text-sm">Please try refreshing the page</div>
        </div>
      `;
    }
  }

  // Function to save updated data (for admin use)
  window.updateJonnyK1Data = async function(newData) {
    if (!isAdmin) {
      console.warn('Unauthorized: Only admins can update K1 data');
      return;
    }
    
    try {
      // Update timestamp
      newData.lastUpdated = new Date().toISOString();
      
      // Save to localStorage as backup (this prevents data loss!)
      localStorage.setItem('jonny-k1-backup', JSON.stringify(newData));
      
      // Re-render with new data
      await loadAndRender();
      
      console.log('Jon\'s K1 Speed data updated and backed up successfully');
    } catch (error) {
      console.error('Error updating K1 Speed data:', error);
    }
  };

  // Function to export data for backup
  window.exportJonnyK1Data = function() {
    const backup = localStorage.getItem('jonny-k1-backup');
    if (backup) {
      const blob = new Blob([backup], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `jons-k1-addison-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  // Initialize the stats display
  await loadAndRender();

})();
