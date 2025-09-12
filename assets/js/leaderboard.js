import { initializeFirebaseCore } from './firebase-core.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

// Import sanitization utilities
import { html, safeSetHTML, setSafeText, createSafeElement } from './sanitize.js';

async function init() {
  const { auth } = await initializeFirebaseCore();

  // Toggle nav auth link
  onAuthStateChanged(auth, user => {
    const authLink = document.getElementById('auth-link');
    const authLinkMobile = document.getElementById('auth-link-mobile');
    const setLinks = (text, href) => {
      if (authLink) { authLink.textContent = text; authLink.href = href; }
      if (authLinkMobile) { authLinkMobile.textContent = text; authLinkMobile.href = href; }
    };
    if (user) setLinks('Dashboard', 'dashboard.html'); else setLinks('DRIVER LOGIN', 'login.html');
  });

  // Mobile menu toggle
  const toggleBtn = document.getElementById('mobile-menu-toggle');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const mobileMenu = document.getElementById('mobile-menu');
      if (mobileMenu) mobileMenu.classList.toggle('hidden');
    });
  }

  // Retry button
  const retryBtn = document.getElementById('retry-btn');
  if (retryBtn) {
    retryBtn.addEventListener('click', () => {
      document.getElementById('error-state')?.classList.add('hidden');
      document.getElementById('loading-state')?.classList.remove('hidden');
      loadLeaderboard().catch(showError);
    });
  }

  // Load leaderboard
  await loadLeaderboard();
}

async function loadLeaderboard() {
  try {
    // Create AbortController for timeout handling
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const response = await fetch('/leaderboard', {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const leaderboard = await response.json();

    if (leaderboard.length === 0) {
      showEmptyState();
      return;
    }

    renderLeaderboard(leaderboard);
    document.getElementById('loading-state')?.classList.add('hidden');
    document.getElementById('leaderboard-content')?.classList.remove('hidden');
  } catch (err) {
    console.error('Error loading leaderboard:', err);
    showError();
  }
}

function renderLeaderboard(leaderboard) {
  renderPodium(leaderboard.slice(0, 3));
  renderTable(leaderboard);
  renderStats(leaderboard);
}

function renderPodium(topThree) {
  const podium = document.getElementById('podium');
  if (!podium) return;
  podium.innerHTML = '';

  const positions = [2, 1, 3];
  const podiumHeights = ['h-32', 'h-40', 'h-24'];
  const podiumColors = ['bg-slate-600', 'bg-yellow-500', 'bg-orange-500'];

  positions.forEach((position, index) => {
    const racer = topThree[position - 1];
    if (!racer) return;

    const el = document.createElement('div');
    el.className = `card rounded-lg p-4 text-center ${index === 1 ? 'order-1' : index === 0 ? 'order-2' : 'order-3'}`;
    
    const avatarHTML = racer.avatarUrl
      ? html`<img src="${racer.avatarUrl}" alt="${racer.displayName}" class="w-16 h-16 rounded-full mb-3 object-cover">`
      : html`<div class="w-16 h-16 rounded-full bg-slate-600 flex items-center justify-center mb-3">
               <span class="text-xl font-racing text-white">${racer.displayName.charAt(0).toUpperCase()}</span>
             </div>`;
    
    const usernameHTML = racer.username ? html`<p class="text-sm text-slate-400 mb-2">@${racer.username}</p>` : '';
    
    const podiumHTML = html`
      <div class="flex flex-col items-center">
        <div class="${podiumColors[position - 1]} ${podiumHeights[position - 1]} w-16 rounded-lg mb-4 flex items-center justify-center">
          <span class="text-2xl font-racing text-white">${position}</span>
        </div>
        ${avatarHTML}
        <h3 class="text-lg font-bold text-white mb-1">${racer.displayName}</h3>
        ${usernameHTML}
        <p class="text-2xl font-racing text-neon-yellow">${racer.totalPoints}</p>
        <p class="text-sm text-slate-400">${racer.achievementCount} achievements</p>
      </div>
    `;
    
    safeSetHTML(el, podiumHTML);
    podium.appendChild(el);
  });
}

function renderTable(leaderboard) {
  const tableBody = document.getElementById('leaderboard-table');
  if (!tableBody) return;
  tableBody.innerHTML = '';

  leaderboard.forEach((racer) => {
    const row = document.createElement('tr');
    row.className = 'border-b border-slate-700/50 hover:bg-slate-800/30 transition';

    let rankDisplay = racer.rank;
    let rankClass = 'text-white';
    if (racer.rank === 1) { rankDisplay = '🥇'; rankClass = 'text-yellow-400'; }
    else if (racer.rank === 2) { rankDisplay = '🥈'; rankClass = 'text-gray-300'; }
    else if (racer.rank === 3) { rankDisplay = '🥉'; rankClass = 'text-orange-400'; }

    row.innerHTML = `
      <td class="p-3"><span class="text-2xl ${rankClass}">${rankDisplay}</span></td>
      <td class="p-3">
        <div class="flex items-center space-x-3">
          ${racer.avatarUrl
            ? `<img src="${racer.avatarUrl}" alt="${racer.displayName}" class="w-10 h-10 rounded-full object-cover">`
            : `<div class="w-10 h-10 rounded-full bg-slate-600 flex items-center justify-center">
                 <span class="text-sm font-racing text-white">${racer.displayName.charAt(0).toUpperCase()}</span>
               </div>`
          }
          <div>
            <p class="font-bold text-white">${racer.displayName}</p>
            ${racer.username ? `<p class="text-sm text-slate-400">@${racer.username}</p>` : ''}
          </div>
        </div>
      </td>
      <td class="p-3 text-center"><span class="text-xl font-racing text-neon-yellow">${racer.totalPoints}</span></td>
      <td class="p-3 text-center"><span class="text-white">${racer.achievementCount}</span></td>
    `;
    tableBody.appendChild(row);
  });
}

function renderStats(leaderboard) {
  const totalRacers = leaderboard.length;
  const totalPoints = leaderboard.reduce((sum, r) => sum + (r.totalPoints || 0), 0);
  const totalAchievements = leaderboard.reduce((sum, r) => sum + (r.achievementCount || 0), 0);

  const elRacers = document.getElementById('total-racers');
  const elPoints = document.getElementById('total-points');
  const elAchievements = document.getElementById('total-achievements');

  if (elRacers) elRacers.textContent = totalRacers;
  if (elPoints) elPoints.textContent = totalPoints.toLocaleString();
  if (elAchievements) elAchievements.textContent = totalAchievements;
}

function showError() {
  document.getElementById('loading-state')?.classList.add('hidden');
  document.getElementById('leaderboard-content')?.classList.add('hidden');
  document.getElementById('error-state')?.classList.remove('hidden');
}

function showEmptyState() {
  document.getElementById('loading-state')?.classList.add('hidden');
  const content = document.getElementById('leaderboard-content');
  if (content) {
    content.innerHTML = `
      <div class="text-center py-20">
        <h2 class="text-3xl font-racing text-slate-400 mb-4">No Racers Yet</h2>
        <p class="text-slate-500">Be the first to earn achievements and appear on the leaderboard!</p>
      </div>
    `;
    content.classList.remove('hidden');
  }
}

init().catch(showError);