// Renders K1 Speed Addison stats for Jon Kirsh if data file exists
(async function(){
  const el = document.getElementById('k1-addison-stats');
  if (!el) return;
  try {
    const r = await fetch('data/k1_jon_addison_2025.json', { cache: 'no-store' });
    if (!r.ok) throw new Error('no data');
    const data = await r.json();
    const best = data?.bestLap || '—';
    const avg = data?.averageLap || '—';
    const heats = Array.isArray(data?.heats) ? data.heats.length : 0;
    el.innerHTML = `
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div class="stat-card p-4 rounded-lg text-center">
          <div class="text-3xl font-bold">${best}</div>
          <div class="text-sm font-racing uppercase text-white tracking-wider">Best Lap</div>
        </div>
        <div class="stat-card p-4 rounded-lg text-center">
          <div class="text-3xl font-bold">${avg}</div>
          <div class="text-sm font-racing uppercase text-white tracking-wider">Avg Lap</div>
        </div>
        <div class="stat-card p-4 rounded-lg text-center">
          <div class="text-3xl font-bold">${heats}</div>
          <div class="text-sm font-racing uppercase text-white tracking-wider">Sessions</div>
        </div>
      </div>
      <div class="mt-4 text-slate-400 text-sm">Location: K1 Speed Addison, IL</div>`;
  } catch {
    el.innerHTML = '<p class="text-slate-400">K1 Addison stats are coming soon. Visit <a class="text-neon-yellow underline" href="https://www.k1speed.com/addison-location.html" target="_blank" rel="noopener">K1 Speed Addison</a>.</p>';
  }
})();