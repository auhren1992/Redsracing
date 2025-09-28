// Renders K1 Speed Addison stats for Jonny Kirsh
(async function(){
  const el = document.getElementById('k1-addison-stats-jonny');
  if (!el) return;
  // First, try to fetch official K1 points row via backend function (best-effort)
  let k1 = null;
  try {
    const rr = await fetch('/k1/addison/2025/jonny', { headers: { 'Accept': 'application/json' } });
    k1 = await rr.json();
  } catch {}
  try {
    const r = await fetch('data/k1_jon_addison_2025.json', { cache: 'no-store' }).catch(()=>null);
    const data = r && r.ok ? await r.json() : {};
    const best = data?.bestLap || '—';
    const avg = data?.averageLap || '—';
    const heats = Array.isArray(data?.heats) ? data.heats.length : 0;

    // Build season points block from backend OR local history fallback
    let pointsBlock = '';
    let ptsArray = null;
    let ptsTotal = null;
    if (k1 && k1.ok) {
      ptsArray = Array.isArray(k1.gpPoints) ? k1.gpPoints : null;
      ptsTotal = typeof k1.total === 'number' ? k1.total : null;
    }
    if (!ptsArray) {
      try {
        const hr = await fetch('data/k1_jonny_addison_history.json', { cache: 'no-store' });
        if (hr.ok) {
          const hist = await hr.json();
          const s2025 = Array.isArray(hist?.seasons) ? hist.seasons.find(s=>s.year===2025) : null;
          if (s2025) {
            ptsArray = Array.isArray(s2025.gpPoints) ? s2025.gpPoints : null;
            ptsTotal = typeof s2025.points === 'number' ? s2025.points : ptsTotal;
          }
        }
      } catch {}
    }
    if (ptsArray && ptsArray.length) {
      const ptsStr = ptsArray.map((n,i)=>`GP${i+1}:${n}`).join(' · ');
      pointsBlock = `
        <div class="mt-6">
          <h4 class="font-bold mb-2">K1 Season Points (2025)</h4>
          ${ptsTotal!=null ? `<p class=\"text-slate-300\">Total: ${ptsTotal}</p>` : ''}
          <p class="text-slate-400 text-sm mt-1">${ptsStr}</p>
        </div>`;
    }

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
      <div class="mt-4 text-slate-400 text-sm">Location: K1 Speed Addison, IL</div>
      ${pointsBlock}
    `;
  } catch {
    el.innerHTML = '<p class="text-slate-400">K1 Addison stats are coming soon. Visit <a class="text-neon-yellow underline" href="https://www.k1speed.com/addison-location.html" target="_blank" rel="noopener">K1 Speed Addison</a>.</p>';
  }
})();
