// 2025 Race Stats renderer: tries backend fetch, falls back to schedule.json
(async function(){
  try {
    const box = document.getElementById('stats-2025');
    if (!box) return;
    let events = [];
    try {
      const r = await fetch('/speedhive/2025', { headers: { 'Accept': 'application/json' } });
      const data = await r.json().catch(()=>({events: []}));
      events = Array.isArray(data?.events) ? data.events : [];
    } catch {}
    if (!events.length) {
      // Fallback to local schedule.json rows filtered for 2025
      try {
        const rs = await fetch('data/schedule.json');
        const all = await rs.json();
        events = (all||[]).filter(e => (e.date||'').startsWith('2025-'));
      } catch {}
    }
    if (!events.length) {
      box.innerHTML = '<p class="text-slate-400">No 2025 race data yet. Check back soon.</p>';
      return;
    }
    const total = events.length;
    const first = events[0];
    const html = `
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div class="stat-card p-4 rounded-lg text-center">
          <div class="text-4xl font-bold">${total}</div>
          <div class="text-sm font-racing uppercase text-white tracking-wider">Races</div>
        </div>
        <div class="stat-card p-4 rounded-lg text-center">
          <div class="text-4xl font-bold">—</div>
          <div class="text-sm font-racing uppercase text-white tracking-wider">Podiums</div>
        </div>
        <div class="stat-card p-4 rounded-lg text-center">
          <div class="text-4xl font-bold">—</div>
          <div class="text-sm font-racing uppercase text-white tracking-wider">Fastest Lap</div>
        </div>
      </div>
      <div class="mt-6">
        <h3 class="text-xl font-bold mb-2">Next Event</h3>
        <p class="text-slate-300">${(first?.name||'TBA')} ${(first?.date? '• '+first.date : '')}</p>
      </div>`;
    box.innerHTML = html;
  } catch {}
})();