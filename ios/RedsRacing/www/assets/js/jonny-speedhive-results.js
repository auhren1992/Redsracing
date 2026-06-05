(function initJonnyResults(){
  const root = document.getElementById('jonny-results-root');
  if (!root) return;
  function ordinal(n){return n<=0?String(n):n%10==1&&n%100!=11?n+"st":n%10==2&&n%100!=12?n+"nd":n%10==3&&n%100!=13?n+"rd":n+"th"}
  async function load(){
    try{
      root.innerHTML = '<div class="text-slate-400 py-8"><i class="fas fa-spinner fa-spin mr-2"></i>Loading Jonny results...</div>';
      const resp = await fetch('./data/jonny-2025-speedhive-results.json',{cache:'no-store'});
      const data = resp.ok ? await resp.json() : {championship:{featureWins:0,heatWins:0,podiumFinishes:0},events:[]};
      const wrap = document.createElement('div');
      wrap.className = 'space-y-6';
      // Summary
      const ch = data.championship||{};
      const header = document.createElement('div');
      header.className = 'bg-slate-800/40 border border-slate-700/50 rounded-xl p-6';
      header.innerHTML = `
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div><div class="text-3xl font-bold text-yellow-400">${ch.featureWins||0}</div><div class="text-slate-300 text-sm">Feature Wins</div></div>
          <div><div class="text-3xl font-bold text-green-400">${ch.heatWins||0}</div><div class="text-slate-300 text-sm">Heat Wins</div></div>
          <div><div class="text-3xl font-bold text-orange-400">${ch.podiumFinishes||0}</div><div class="text-slate-300 text-sm">Podiums</div></div>
          <div><div class="text-3xl font-bold text-blue-400">${data.season||''}</div><div class="text-slate-300 text-sm">Season</div></div>
        </div>`;
      wrap.appendChild(header);
      // Events
      const events = Array.isArray(data.events)?data.events:[];
      if (!events.length){
        const empty = document.createElement('div');
        empty.className = 'text-center text-slate-400 py-8';
        empty.textContent = 'No events recorded yet.';
        wrap.appendChild(empty);
      } else {
        events.sort((a,b)=> new Date(b.date)-new Date(a.date));
        events.forEach(ev=>{
          const box = document.createElement('div');
          box.className = 'modern-card rounded-xl p-5';
          const when = new Date(ev.date).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
          const sess = (ev.sessions||[]).map(s=>{
            const pos = typeof s.position==='number'? ordinal(s.position): (s.position||'—');
            const lap = s.lapTime? ` • ${s.lapTime}s`:'';
            return `<div class="text-slate-300 text-sm"><span class="font-semibold">${s.sessionType}</span>: ${pos}${lap}</div>`;
          }).join('');
          box.innerHTML = `
            <div class="flex items-center justify-between mb-2">
              <div class="text-white font-bold">${ev.eventName||''}</div>
              <div class="text-slate-400 text-sm">${when}</div>
            </div>
            <div class="text-slate-400 text-sm mb-2">${ev.track||''} ${ev.trackLength?`(${ev.trackLength})`:''}</div>
            <div class="border-t border-slate-700/50 pt-3">${sess||'<div class="text-slate-500 text-sm">No session details</div>'}</div>`;
          wrap.appendChild(box);
        });
      }
      root.innerHTML = '';
      root.appendChild(wrap);
      // Update wins on jonny.html if present
      try {
        const winsEl = document.getElementById('jonny-feature-wins');
        if (winsEl) winsEl.textContent = String(ch.featureWins||0);
      } catch {}
    }catch(err){
      console.error('Jonny results load error:', err);
      root.innerHTML = '<div class="text-red-400 py-8">Failed to load results.</div>';
    }
  }
  load();
})();