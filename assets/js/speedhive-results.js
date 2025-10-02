import "./app.js";
import { monitorAuthState, validateUserClaims } from "./auth-utils.js";

(async function initSpeedhiveResults(){
  const root = document.getElementById('race-results');
  if (!root) return;

  let isAdmin = false;

  async function loadAndRender() {
    try {
      root.innerHTML = '<p class="text-slate-400">Loading Speedhive results...</p>';
      // Prefer Cloud Run Go service if available
      let data = null;
      try {
        const rGo = await fetch('/api/speedhive/events', { headers: { 'Accept': 'application/json' } });
        if (rGo.ok) {
          data = await rGo.json();
          // Normalize raw arrays from Go service
          if (Array.isArray(data)) data = { ok: true, events: data };
        }
      } catch {}
      if (!data || (Array.isArray(data) && !data.length) || (data && data.ok === false)) {
        // Fallback to Functions-based scraper
        const rFn = await fetch('/speedhive/jon', { headers: { 'Accept': 'application/json' } });
        const tmp = rFn.ok ? await rFn.json() : null;
        data = tmp;
      }

      const wrap = document.createElement('div');
      wrap.className = 'space-y-4';

      // Admin controls
      if (isAdmin) {
        const controls = document.createElement('div');
        controls.className = 'space-y-3';
        controls.innerHTML = `
          <div class="flex items-center justify-between">
            <div class="text-slate-400 text-sm">Speedhive auto-refreshes daily.</div>
            <button id="sh-refresh" class="bg-neon-yellow text-slate-900 hover:bg-yellow-300 font-bold py-2 px-4 rounded-md">Refresh from Speedhive now</button>
          </div>
          <div class="flex gap-2">
            <input id="sh-url" type="url" placeholder="Paste Speedhive event/session URL" class="flex-1 bg-slate-800 border border-slate-600 rounded-md p-2 text-sm text-white placeholder-slate-400" />
            <button id="sh-import" class="bg-blue-600 text-white font-bold py-2 px-4 rounded-md hover:bg-blue-500">Import</button>
          </div>
          <p id="sh-status" class="text-slate-400 text-sm"></p>
        `;
        wrap.appendChild(controls);
        controls.querySelector('#sh-refresh').addEventListener('click', async (e) => {
          const btn = e.currentTarget;
          btn.disabled = true;
          btn.textContent = 'Refreshing...';
          let ok = false;
          try {
            const rr = await fetch('/speedhive/jon', { headers: { 'Accept': 'application/json' } });
            ok = rr.ok;
          } catch {}
          btn.disabled = false;
          btn.textContent = 'Refresh from Speedhive now';
          const status = controls.querySelector('#sh-status');
          if (status) status.textContent = ok ? 'Refreshed from Speedhive.' : 'Refresh request sent.';
          await loadAndRender();
        });
        controls.querySelector('#sh-import').addEventListener('click', async () => {
          const input = controls.querySelector('#sh-url');
          const status = controls.querySelector('#sh-status');
          const url = input && input.value ? input.value.trim() : '';
          if (!url) { if (status) status.textContent = 'Please paste a Speedhive URL.'; return; }
          if (status) status.textContent = 'Importing...';
          try {
            const r = await fetch('/speedhive/event?url=' + encodeURIComponent(url), { headers: { 'Accept': 'application/json' } });
            const data = r.ok ? await r.json() : null;
            if (status) status.textContent = data && data.ok ? `Imported ${data.entriesCount || 0} entries from ${data.eventName || 'event'}.` : 'Import failed.';
          } catch {
            if (status) status.textContent = 'Import failed.';
          }
          await loadAndRender();
        });
      }

      if (!data || (data && data.ok === false)) {
        const empty = document.createElement('p');
        empty.className = 'text-slate-400';
        empty.textContent = 'No results found yet.';
        wrap.appendChild(empty);
        root.innerHTML = '';
        root.appendChild(wrap);
        return;
      }
      const events = Array.isArray(data) ? data : (Array.isArray(data?.events) ? data.events : []);
      if (!events.length) {
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
      events.slice(0, 20).forEach(ev => {
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
