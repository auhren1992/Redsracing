import './app.js';

// Fixed Leaderboard Module - Resolves infinite loading issues
import { getFirebaseAuth, getFirebaseDb } from './firebase-core.js';
import { monitorAuthState } from './auth-utils.js';

// Import sanitization utilities
import { html, safeSetHTML, setSafeText, createSafeElement } from './sanitize.js';

// Track initialization state
let isInitialized = false;
let isDestroyed = false;
let loadingTimeout = null;

async function init() {
  // Prevent multiple initializations
  if (isInitialized) {
    return;
  }

  const auth = getFirebaseAuth();
  
  // Check if Firebase services are available
  if (!auth) {
    showError();
    return;
  }

  // Start loading timeout
  startLoadingTimeout();

  try {
    // Toggle nav auth link
    monitorAuthState(user => {
      if (isDestroyed) return;
      
      const authLink = document.getElementById('auth-link');
      const authLinkMobile = document.getElementById('auth-link-mobile');
      const setLinks = (text, href) => {
        if (authLink) { 
          setSafeText(authLink, text);
          authLink.href = href; 
        }
        if (authLinkMobile) { 
          setSafeText(authLinkMobile, text);
          authLinkMobile.href = href; 
        }
      };
      
      if (user) {
        setLinks('Dashboard', 'dashboard.html');
      } else {
        setLinks('DRIVER LOGIN', 'login.html');
      }
    }, (error) => {
        // Optional: handle auth errors
    });

    // Mobile menu toggle
    const toggleBtn = document.getElementById('mobile-menu-toggle');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        if (isDestroyed) return;
        const mobileMenu = document.getElementById('mobile-menu');
        if (mobileMenu) mobileMenu.classList.toggle('hidden');
      });
    }

    // Retry button
    const retryBtn = document.getElementById('retry-btn');
    if (retryBtn) {
      retryBtn.addEventListener('click', () => {
        if (isDestroyed) return;
        
        document.getElementById('error-state')?.classList.add('hidden');
        document.getElementById('loading-state')?.classList.remove('hidden');
        
        // Clear any existing timeout and start fresh
        clearLoadingTimeout();
        startLoadingTimeout();
        
        loadLeaderboard().catch(showError);
      });
    }

    // Load leaderboard data
    await loadLeaderboard();
    
    isInitialized = true;
    
  } catch (error) {
    showError();
  }
}

function startLoadingTimeout() {
  if (loadingTimeout) clearTimeout(loadingTimeout);
  
  loadingTimeout = setTimeout(() => {
    if (isDestroyed) return;
    
    showError();
  }, 15000); // 15 second timeout
}

function clearLoadingTimeout() {
  if (loadingTimeout) {
    clearTimeout(loadingTimeout);
    loadingTimeout = null;
  }
}

async function loadLeaderboard() {
  if (isDestroyed) return;
  
  try {
    // Create AbortController for timeout handling
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      if (!isDestroyed) {
        controller.abort();
      }
    }, 10000); // 10 second timeout

    const response = await fetch('/leaderboard', {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    clearTimeout(timeoutId);

    if (isDestroyed) {
      return;
    }

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const leaderboard = await response.json();

    if (isDestroyed) {
      return;
    }

    if (leaderboard.length === 0) {
      showEmptyState();
      return;
    }

    renderLeaderboard(leaderboard);
    
    // Clear loading timeout and show content
    clearLoadingTimeout();
    document.getElementById('loading-state')?.classList.add('hidden');
    document.getElementById('leaderboard-content')?.classList.remove('hidden');
    
  } catch (err) {
    if (isDestroyed) return;
    
    showError();
  }
}

function renderLeaderboard(leaderboard) {
  if (isDestroyed) return;
  
  try {
    renderPodium(leaderboard.slice(0, 3));
    renderTable(leaderboard);
    renderStats(leaderboard);
    
  } catch (error) {
    showError();
  }
}

function renderPodium(topThree) {
  const podium = document.getElementById('podium');
  if (!podium || isDestroyed) return;
  
  podium.innerHTML = '';

  const positions = [2, 1, 3]; // Second, First, Third for visual layout
  const podiumHeights = ['h-32', 'h-40', 'h-24'];
  const podiumColors = ['bg-slate-600', 'bg-yellow-500', 'bg-orange-500'];

  positions.forEach((position, index) => {
    const racer = topThree[position - 1];
    if (!racer) return;

    const el = document.createElement('div');
    el.className = `card rounded-lg p-4 text-center ${index === 1 ? 'order-1' : index === 0 ? 'order-2' : 'order-3'}`;
    
    const avatarHTML = racer.avatarUrl && racer.avatarUrl.trim()
      ? html`<img src="${racer.avatarUrl}" alt="${racer.displayName}" class="w-16 h-16 rounded-full mb-3 object-cover mx-auto">`
      : html`<div class="w-16 h-16 rounded-full bg-slate-600 flex items-center justify-center mb-3 mx-auto">
               <span class="text-xl font-racing text-white">${(racer.displayName || 'U').charAt(0).toUpperCase()}</span>
             </div>`;
    
    const usernameHTML = racer.username ? html`<p class="text-sm text-slate-400 mb-2">@${racer.username}</p>` : '';
    
    const podiumHTML = html`
      <div class="flex flex-col items-center">
        <div class="${podiumColors[position - 1]} ${podiumHeights[position - 1]} w-16 rounded-lg mb-4 flex items-center justify-center">
          <span class="text-2xl font-racing text-white">${position}</span>
        </div>
        ${avatarHTML}
        <h3 class="text-lg font-bold text-white mb-1">${racer.displayName || 'Unknown'}</h3>
        ${usernameHTML}
        <p class="text-2xl font-racing text-neon-yellow">${racer.totalPoints || 0}</p>
        <p class="text-sm text-slate-400">${racer.achievementCount || 0} achievements</p>
      </div>
    `;
    
    safeSetHTML(el, podiumHTML);
    podium.appendChild(el);
  });
}

function renderTable(leaderboard) {
  const tableBody = document.getElementById('leaderboard-table');
  if (!tableBody || isDestroyed) return;
  
  tableBody.innerHTML = '';

  leaderboard.forEach((racer, index) => {
    const row = document.createElement('tr');
    row.className = 'border-b border-slate-700/50 hover:bg-slate-800/30 transition';

    let rankDisplay = racer.rank || (index + 1);
    let rankClass = 'text-white';
    
    if (rankDisplay === 1) { 
      rankDisplay = '🥇'; 
      rankClass = 'text-yellow-400'; 
    } else if (rankDisplay === 2) { 
      rankDisplay = '🥈'; 
      rankClass = 'text-gray-300'; 
    } else if (rankDisplay === 3) { 
      rankDisplay = '🥉'; 
      rankClass = 'text-orange-400'; 
    }

    const avatarCell = racer.avatarUrl && racer.avatarUrl.trim()
      ? `<img src="${racer.avatarUrl}" alt="${racer.displayName}" class="w-10 h-10 rounded-full object-cover">`
      : `<div class="w-10 h-10 rounded-full bg-slate-600 flex items-center justify-center">
           <span class="text-sm font-racing text-white">${(racer.displayName || 'U').charAt(0).toUpperCase()}</span>
         </div>`;

    const usernameRow = racer.username ? `<p class="text-sm text-slate-400">@${racer.username}</p>` : '';

    const rowHTML = `
      <td class="p-3"><span class="text-2xl ${rankClass}">${rankDisplay}</span></td>
      <td class="p-3">
        <div class="flex items-center space-x-3">
          ${avatarCell}
          <div>
            <p class="font-bold text-white">${racer.displayName || 'Unknown'}</p>
            ${usernameRow}
          </div>
        </div>
      </td>
      <td class="p-3 text-center"><span class="text-xl font-racing text-neon-yellow">${racer.totalPoints || 0}</span></td>
      <td class="p-3 text-center"><span class="text-white">${racer.achievementCount || 0}</span></td>
    `;

    row.innerHTML = rowHTML;
    tableBody.appendChild(row);
  });
}

function renderStats(leaderboard) {
  if (isDestroyed) return;
  
  const totalRacers = leaderboard.length;
  const totalPoints = leaderboard.reduce((sum, r) => sum + (r.totalPoints || 0), 0);
  const totalAchievements = leaderboard.reduce((sum, r) => sum + (r.achievementCount || 0), 0);

  const elRacers = document.getElementById('total-racers');
  const elPoints = document.getElementById('total-points');
  const elAchievements = document.getElementById('total-achievements');

  if (elRacers) setSafeText(elRacers, totalRacers.toString());
  if (elPoints) setSafeText(elPoints, totalPoints.toLocaleString());
  if (elAchievements) setSafeText(elAchievements, totalAchievements.toString());
}

function showError() {
  if (isDestroyed) return;
  
  clearLoadingTimeout();
  document.getElementById('loading-state')?.classList.add('hidden');
  document.getElementById('leaderboard-content')?.classList.add('hidden');
  document.getElementById('error-state')?.classList.remove('hidden');
}

function showEmptyState() {
  if (isDestroyed) return;
  
  clearLoadingTimeout();
  document.getElementById('loading-state')?.classList.add('hidden');
  
  const content = document.getElementById('leaderboard-content');
  if (content) {
    const emptyStateHTML = `
      <div class="text-center py-20">
        <div class="text-6xl mb-4">🏁</div>
        <h2 class="text-3xl font-racing text-slate-400 mb-4">No Racers Yet</h2>
        <p class="text-slate-500">Be the first to earn achievements and appear on the leaderboard!</p>
      </div>
    `;
    content.innerHTML = emptyStateHTML;
    content.classList.remove('hidden');
  }
}

// Cleanup function
function cleanup() {
  isDestroyed = true;
  clearLoadingTimeout();
}

// Handle page unload cleanup
window.addEventListener('beforeunload', cleanup);
window.addEventListener('unload', cleanup);

// Handle visibility change
if (typeof document.visibilityState !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      // Page hidden
    } else if (isDestroyed) {
      window.location.reload();
    }
  });
}

// Initialize when ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    init().catch(showError);
  });
} else {
  init().catch(showError);
}