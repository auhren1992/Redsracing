// Render Jon Kirsh K1 Addison prior years with finishing place
(async function(){
  const el = document.getElementById('k1-addison-history');
  if (!el) return;
  try {
    // Try live multi-season fetch first
    try {
      const rrAll = await fetch('/k1/addison/jon/seasons', { headers: { 'Accept': 'application/json' } });
      if (rrAll.ok) {
        const dataAll = await rrAll.json();
        if (dataAll && dataAll.ok && Array.isArray(dataAll.seasons) && dataAll.seasons.length) {
          const container = document.createElement('div');
          container.className = 'space-y-3';
          dataAll.seasons.sort((a,b)=>b.year-a.year).forEach(s => {
            const row = document.createElement('div');
            row.className = 'p-4 rounded-lg bg-slate-800/50 border border-slate-700/50';
            const gp = Array.isArray(s.gpPoints) && s.gpPoints.length ? `<div class=\"text-slate-400 text-xs mt-2\">GP: ${s.gpPoints.map((n,i)=>`GP${i+1}:${n}`).join(' · ')}</div>` : '';
            row.innerHTML = `<div class=\"flex items-center justify-between\"> <div><div class=\"text-white font-bold\">Season ${s.year}</div><div class=\"text-slate-400 text-sm\">${s.series||'K1 Addison'}</div></div><div class=\"text-right\"><div class=\"text-neon-yellow font-bold\">Place: ${s.place ?? '—'}</div><div class=\"text-slate-400 text-sm\">Points: ${s.points ?? '—'}</div></div></div>${gp}`;
            container.appendChild(row);
          });
          el.innerHTML = '';
          el.appendChild(container);
          return;
        }
      }
    } catch {}

    // Fallback to single-season live fetch + local history
    let live = null;
    try {
      const rr = await fetch('/k1/addison/2025/jon', { headers: { 'Accept': 'application/json' } });
      live = rr.ok ? await rr.json() : null;
      if (live && live.ok && Array.isArray(live.gpPoints)) {
        const current = { year: 2025, series: 'K1 Addison Adult League', place: null, points: live.total ?? null, gpPoints: live.gpPoints };
        const container = document.createElement('div');
        container.className = 'space-y-3';
        const row = document.createElement('div');
        row.className = 'p-4 rounded-lg bg-slate-800/50 border border-slate-700/50';
        const gp = current.gpPoints && current.gpPoints.length ? `<div class=\"text-slate-400 text-xs mt-2\">GP: ${current.gpPoints.map((n,i)=>`GP${i+1}:${n}`).join(' · ')}</div>` : '';
        row.innerHTML = `<div class=\"flex items-center justify-between\"> <div><div class=\"text-white font-bold\">Season ${current.year}</div><div class=\"text-slate-400 text-sm\">${current.series}</div></div><div class=\"text-right\"><div class=\"text-neon-yellow font-bold\">Points: ${current.points ?? '—'}</div></div></div>${gp}`;
        container.appendChild(row);
        const rHist = await fetch('data/k1_jon_addison_history.json', { cache: 'no-store' });
        const hist = rHist.ok ? await rHist.json() : { seasons: [] };
        if (Array.isArray(hist.seasons)) {
          hist.seasons.forEach(s => {
            const row2 = document.createElement('div');
            row2.className = 'p-4 rounded-lg bg-slate-800/50 border border-slate-700/50';
            const gp2 = Array.isArray(s.gpPoints) && s.gpPoints.length ? `<div class=\"text-slate-400 text-xs mt-2\">GP: ${s.gpPoints.map((n,i)=>`GP${i+1}:${n}`).join(' · ')}</div>` : '';
            row2.innerHTML = `<div class=\"flex items-center justify-between\"> <div><div class=\"text-white font-bold\">Season ${s.year}</div><div class=\"text-slate-400 text-sm\">${s.series||'K1 Addison'}</div></div><div class=\"text-right\"><div class=\"text-neon-yellow font-bold\">Place: ${s.place ?? '—'}</div><div class=\"text-slate-400 text-sm\">Points: ${s.points ?? '—'}</div></div></div>${gp2}`;
            container.appendChild(row2);
          });
        }
        el.innerHTML = '';
        el.appendChild(container);
        return;
      }
    } catch {}

    // Fallback: static history file
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