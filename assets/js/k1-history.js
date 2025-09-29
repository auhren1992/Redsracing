// Render Jon Kirsh K1 Addison prior years with finishing place
(async function(){
  const el = document.getElementById('k1-addison-history');
  if (!el) return;
  try {
    const r = await fetch('data/k1_jon_addison_history.json', { cache: 'no-store' });
    const data = r.ok ? await r.json() : null;
    if (!data || !Array.isArray(data.seasons) || data.seasons.length === 0) {
      el.innerHTML = '<p class="text-slate-400">K1 prior years results coming soon.</p>';
      return;
    }
    const wrap = document.createElement('div');
    wrap.className = 'space-y-3';
    data.seasons.forEach(s => {
      const row = document.createElement('div');
      row.className = 'p-4 rounded-lg bg-slate-800/50 border border-slate-700/50';
      const gp = Array.isArray(s.gpPoints) && s.gpPoints.length ? `<div class=\"text-slate-400 text-xs mt-2\">GP: ${s.gpPoints.map((n,i)=>`GP${i+1}:${n}`).join(' · ')}</div>` : '';
      row.innerHTML = `<div class=\"flex items-center justify-between\"> <div><div class=\"text-white font-bold\">Season ${s.year}</div><div class=\"text-slate-400 text-sm\">${s.series||'K1 Addison'}</div></div><div class=\"text-right\"><div class=\"text-neon-yellow font-bold\">Place: ${s.place ?? '—'}</div><div class=\"text-slate-400 text-sm\">Points: ${s.points ?? '—'}</div></div></div>${gp}`;
      wrap.appendChild(row);
    });
    el.innerHTML = '';
    el.appendChild(wrap);
  } catch {
    el.innerHTML = '<p class="text-slate-400">K1 prior years results coming soon.</p>';
  }
})();