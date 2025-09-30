import "./app.js";
import { monitorAuthState, validateUserClaims } from "./auth-utils.js";

(async function initSpeedhiveResults(){
  const root = document.getElementById('race-results');
  if (!root) return;

  let isAdmin = false;

  async function loadAndRender() {
    try {
      root.innerHTML = '<p class="text-slate-400">Loading Speedhive results...</p>';
      const r = await fetch('/speedhive/jon', { headers: { 'Accept': 'application/json' } });
      const data = r.ok ? await r.json() : null;

      const wrap = document.createElement('div');
      wrap.className = 'space-y-4';

      // Admin controls
      if (isAdmin) {
        const controls = document.createElement('div');
        controls.className = 'flex items-center justify-between';
        controls.innerHTML = `
          <div class="text-slate-400 text-sm">Speedhive auto-refreshes daily.</div>
          <button id="sh-refresh" class="bg-neon-yellow text-slate-900 hover:bg-yellow-300 font-bold py-2 px-4 rounded-md">Refresh from Speedhive now</button>
        `;
        wrap.appendChild(controls);
        controls.querySelector('#sh-refresh').addEventListener('click', async (e) => {
          const btn = e.currentTarget;
          btn.disabled = true;
          btn.textContent = 'Refreshing...';
          try {
            await fetch('/speedhive/jon', { headers: { 'Accept': 'application/json' } });
          } catch {}
          btn.disabled = false;
          btn.textContent = 'Refresh from Speedhive now';
          // Re-load results after refresh
          await loadAndRender();
        });
      }

      if (!data || !data.ok || !Array.isArray(data.events) || !data.events.length) {
        const empty = document.createElement('p');
        empty.className = 'text-slate-400';
        empty.textContent = 'No results found yet.';
        wrap.appendChild(empty);
        root.innerHTML = '';
        root.appendChild(wrap);
        return;
      }

      const list = document.createElement('div');
      list.className = 'space-y-3';
      data.events.slice(0, 20).forEach(ev => {
        const row = document.createElement('div');
        row.className = 'p-4 rounded-lg bg-slate-800/50 border border-slate-700/50';
        const name = (ev.name || ev.title || 'Race');
        const date = ev.startDate || ev.date || '';
        const track = ev.location || ev.venue || '';
        const link = ev.link && typeof ev.link === 'string' ? ev.link : null;
        row.innerHTML = `
          <div class="flex items-center justify-between">
            <div>
              <div class="text-white font-bold">${name}</div>
              <div class="text-slate-400 text-sm">${[track, date].filter(Boolean).join(' • ')}</div>
            </div>
            ${link ? `<a href="${link}" target="_blank" rel="noopener" class="text-neon-yellow underline text-sm">Open</a>` : ''}
          </div>`;
        list.appendChild(row);
      });

      wrap.appendChild(list);
      root.innerHTML = '';
      root.appendChild(wrap);
    } catch {
      root.innerHTML = '<p class="text-red-400">Failed to load Speedhive results.</p>';
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
