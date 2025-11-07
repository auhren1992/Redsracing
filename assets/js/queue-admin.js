import "./app.js";

async function main() {
  try {
    const containerId = "queue-management-inject";
    const host = document.getElementById("dashboard-content") || document.body;
    const card = document.createElement("div");
    card.className = "admin-card rounded-xl p-6";
    card.id = containerId;
    card.innerHTML = `
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-2xl font-bold text-white">
          <i class="fas fa-inbox text-yellow-400 mr-2"></i>
          Queue Management
          <span id="eligible-soon" class="ml-3 text-slate-400 text-sm"></span>
        </h2>
        <div class="space-x-2">
          <button id="queue-refresh" class="modern-btn text-white px-3 py-2 rounded text-sm">
            <i class="fas fa-sync mr-1"></i>Refresh
          </button>
          <button id="queue-process" class="success-btn text-white px-3 py-2 rounded text-sm">
            <i class="fas fa-cogs mr-1"></i>Process Now
          </button>
        </div>
      </div>
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div class="admin-card rounded-xl p-4 mb-4 col-span-1 lg:col-span-2">
          <h4 class="text-white font-semibold mb-2">Eligible in next hour</h4>
          <canvas id="eligible-sparkline" height="40"></canvas>
        </div>
        <div>
          <h3 class="text-white font-semibold mb-2">Feedback Queue <span id="feedback-count" class="text-slate-400 text-sm"></span></h3>
          <div class="overflow-x-auto">
            <table class="w-full text-left modern-table text-sm">
              <thead class="table-header">
                <tr><th class="p-2">Name</th><th class="p-2">Email</th><th class="p-2">Message</th><th class="p-2">Status</th><th class="p-2">Next Attempt</th><th class="p-2">Actions</th></tr>
              </thead>
              <tbody id="feedback-rows"></tbody>
            </table>
          </div>
        </div>
        <div>
          <h3 class="text-white font-semibold mb-2">Sponsorship Queue <span id="sponsorship-count" class="text-slate-400 text-sm"></span></h3>
          <div class="overflow-x-auto">
            <table class="w-full text-left modern-table text-sm">
              <thead class="table-header">
                <tr><th class="p-2">Company</th><th class="p-2">Name</th><th class="p-2">Email</th><th class="p-2">Status</th><th class="p-2">Next Attempt</th><th class="p-2">Actions</th></tr>
              </thead>
              <tbody id="sponsorship-rows"></tbody>
            </table>
          </div>
        </div>
      </div>
    `;
    // Insert near top of dashboard content
    const dash = document.getElementById("dashboard-content");
    if (dash) {
      dash.classList.remove("hidden");
      dash.prepend(card);
      const loading = document.getElementById("loading-state");
      if (loading) loading.style.display = "none";
    } else {
      host.prepend(card);
    }

    const { getFirestore, collection, query, where, orderBy, limit, getDocs, getDoc, addDoc, setDoc, deleteDoc, doc, updateDoc } = await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js');
    const db = getFirestore();

    async function loadEligibleSoon() {
      try {
        const cutoff = new Date(Date.now() + 10 * 60 * 1000);
        let total = 0;
        const q1 = query(collection(db, 'feedback_queue'), where('status','in',['queued','retry']), where('nextAttemptAt','<=', cutoff), limit(500));
        const q2 = query(collection(db, 'sponsorship_queue'), where('status','in',['queued','retry']), where('nextAttemptAt','<=', cutoff), limit(500));
        let s1, s2;
        try { s1 = await getDocs(q1); } catch { s1 = { size: 0, forEach: ()=>{} }; }
        try { s2 = await getDocs(q2); } catch { s2 = { size: 0, forEach: ()=>{} }; }
        total = (s1.size || 0) + (s2.size || 0);
        const el = document.getElementById('eligible-soon');
        if (el) el.textContent = total > 0 ? `Eligible in ≤10m: ${total}` : '';
      } catch {
        const el = document.getElementById('eligible-soon');
        if (el) el.textContent = '';
      }
    }

    async function loadQueue() {
      const fbRows = document.getElementById("feedback-rows");
      const spRows = document.getElementById("sponsorship-rows");
      fbRows.innerHTML = "";
      spRows.innerHTML = "";

      // Feedback
      const fbQ = query(collection(db, 'feedback_queue'), where('status', 'in', ['queued','retry']), orderBy('queuedAt','desc'), limit(50));
      let fbSnap; try { fbSnap = await getDocs(fbQ); } catch { fbSnap = { forEach:()=>{} , size:0}; }
      let fbCount = 0;
      fbSnap.forEach((d)=>{
        fbCount++;
        const v = d.data();
        const tr = document.createElement('tr');
        tr.className = 'table-row';
        const nextAttempt = v.nextAttemptAt && v.nextAttemptAt.toDate ? v.nextAttemptAt.toDate() : null;
        tr.innerHTML = `
          <td class="p-2">${(v.name||'').toString().slice(0,40)}</td>
          <td class="p-2">${(v.email||'').toString().slice(0,40)}</td>
          <td class="p-2">${(v.message||'').toString().slice(0,60)}</td>
          <td class="p-2"><span class="status-badge ${v.status==='retry'?'status-pending':'status-approved'}">${v.status||'queued'}</span></td>
          <td class="p-2">${nextAttempt ? nextAttempt.toLocaleString() : '-'}</td>
          <td class="p-2">
            <button data-id="${d.id}" data-col="feedback_queue" class="inspect-btn modern-btn text-white px-2 py-1 rounded text-xs">Inspect</button>
            <button data-id="${d.id}" data-col="feedback_queue" class="retry-btn modern-btn text-white px-2 py-1 rounded text-xs">Retry</button>
            <button data-id="${d.id}" data-col="feedback_queue" class="resolve-btn success-btn text-white px-2 py-1 rounded text-xs">Resolve</button>
          </td>`;
        fbRows.appendChild(tr);
      });
      document.getElementById('feedback-count').textContent = `(${fbCount})`;

      // Sponsorship
      const spQ = query(collection(db, 'sponsorship_queue'), where('status', 'in', ['queued','retry']), orderBy('queuedAt','desc'), limit(50));
      let spSnap; try { spSnap = await getDocs(spQ); } catch { spSnap = { forEach:()=>{} , size:0}; }
      let spCount = 0;
      spSnap.forEach((d)=>{
        spCount++;
        const v = d.data();
        const tr = document.createElement('tr');
        tr.className = 'table-row';
        const nextAttempt = v.nextAttemptAt && v.nextAttemptAt.toDate ? v.nextAttemptAt.toDate() : null;
        tr.innerHTML = `
          <td class="p-2">${(v.company||'').toString().slice(0,40)}</td>
          <td class="p-2">${(v.name||'').toString().slice(0,40)}</td>
          <td class="p-2">${(v.email||'').toString().slice(0,40)}</td>
          <td class="p-2"><span class="status-badge ${v.status==='retry'?'status-pending':'status-approved'}">${v.status||'queued'}</span></td>
          <td class="p-2">${nextAttempt ? nextAttempt.toLocaleString() : '-'}</td>
          <td class="p-2">
            <button data-id="${d.id}" data-col="sponsorship_queue" class="inspect-btn modern-btn text-white px-2 py-1 rounded text-xs">Inspect</button>
            <button data-id="${d.id}" data-col="sponsorship_queue" class="retry-btn modern-btn text-white px-2 py-1 rounded text-xs">Retry</button>
            <button data-id="${d.id}" data-col="sponsorship_queue" class="resolve-btn success-btn text-white px-2 py-1 rounded text-xs">Resolve</button>
          </td>`;
        spRows.appendChild(tr);
      });
      document.getElementById('sponsorship-count').textContent = `(${spCount})`;

      // Wire actions
      document.querySelectorAll('.retry-btn').forEach(btn=>{
        btn.addEventListener('click', async ()=>{
          const id = btn.getAttribute('data-id');
          const col = btn.getAttribute('data-col');
          try {
            await updateDoc(doc(db, col, id), { status: 'queued', updatedAt: new Date(), lastError: null });
            await loadQueue();
          } catch {}
        });
      });
      document.querySelectorAll('.resolve-btn').forEach(btn=>{
        btn.addEventListener('click', async ()=>{
          const id = btn.getAttribute('data-id');
          const col = btn.getAttribute('data-col');
          try {
            await updateDoc(doc(db, col, id), { status: 'resolved', resolvedAt: new Date() });
            await loadQueue();
          } catch {}
        });
      });
    }

    // Dead-letter viewer
    const dlqCard = document.createElement('div');
    dlqCard.className = 'admin-card rounded-xl p-6 mt-6';
    dlqCard.innerHTML = `
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-white font-semibold">Dead Letter Queue <span id="dlq-count" class="text-slate-400 text-sm"></span></h3>
        <button id="dlq-refresh" class="modern-btn text-white px-3 py-2 rounded text-sm"><i class=\"fas fa-sync mr-1\"></i>Refresh</button>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-left modern-table text-sm">
          <thead class="table-header">
            <tr><th class="p-2">Original</th><th class="p-2">Name/Company</th><th class="p-2">Email</th><th class="p-2">Last Error</th><th class="p-2">Actions</th></tr>
          </thead>
          <tbody id="dlq-rows"></tbody>
        </table>
      </div>`;
    card.appendChild(dlqCard);

    async function loadDlq() {
      const dlqRows = document.getElementById('dlq-rows');
      dlqRows.innerHTML = '';
      const qdlq = query(collection(db, 'queue_dead_letter'), orderBy('movedAt','desc'), limit(50));
      let snap; try { snap = await getDocs(qdlq); } catch { snap = { forEach:()=>{} , size:0}; }
      let count = 0;
      snap.forEach((d)=>{
        count++;
        const v = d.data();
        const tr = document.createElement('tr');
        tr.className = 'table-row';
        tr.innerHTML = `
          <td class="p-2">${(v.originalCollection||'').toString()}</td>
          <td class="p-2">${(v.company||v.name||'').toString().slice(0,40)}</td>
          <td class="p-2">${(v.email||'').toString().slice(0,40)}</td>
          <td class="p-2">${(v.lastError||'').toString().slice(0,60)}</td>
          <td class="p-2">
            <button data-id="${d.id}" class="dlq-inspect modern-btn text-white px-2 py-1 rounded text-xs">Inspect</button>
            <button data-id="${d.id}" class="dlq-requeue success-btn text-white px-2 py-1 rounded text-xs">Requeue</button>
            <button data-id="${d.id}" class="dlq-delete danger-btn text-white px-2 py-1 rounded text-xs">Delete</button>
          </td>`;
        dlqRows.appendChild(tr);
      });
      document.getElementById('dlq-count').textContent = `(${count})`;

      // dead-letter actions
      document.querySelectorAll('.dlq-inspect').forEach(btn=>{
        btn.addEventListener('click', ()=> inspectDoc('queue_dead_letter', btn.getAttribute('data-id')));
      });
      document.querySelectorAll('.dlq-requeue').forEach(btn=>{
        btn.addEventListener('click', async ()=>{
          const id = btn.getAttribute('data-id');
          try {
            const ref = doc(db, 'queue_dead_letter', id);
            const snap = await getDoc(ref);
            if (!snap.exists()) return;
            const v = snap.data();
            const target = v.originalCollection || 'feedback_queue';
            await addDoc(collection(db, target), {
              ...v,
              status: 'queued',
              retryCount: 0,
              nextAttemptAt: new Date(),
              movedAt: null,
              lastError: null,
            });
            await deleteDoc(ref);
            await loadDlq();
          } catch {}
        });
      });
      document.querySelectorAll('.dlq-delete').forEach(btn=>{
        btn.addEventListener('click', async ()=>{
          const id = btn.getAttribute('data-id');
          try {
            await deleteDoc(doc(db, 'queue_dead_letter', id));
            await loadDlq();
          } catch {}
        });
      });
    }

    // Inspect modal
    const modal = document.createElement('div');
    modal.id = 'inspect-modal';
    modal.style.display = 'none';
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/60';
    modal.innerHTML = `
      <div class="bg-slate-900 border border-slate-700 rounded-lg w-11/12 max-w-3xl p-4">
        <div class="flex items-center justify-between mb-2">
          <h4 class="text-white font-semibold">Queued Item</h4>
          <button id="inspect-close" class="text-slate-400 hover:text-white">&times;</button>
        </div>
        <pre id="inspect-json" class="text-slate-300 text-xs overflow-auto" style="max-height: 60vh"></pre>
      </div>`;
    document.body.appendChild(modal);
    document.getElementById('inspect-close').addEventListener('click', ()=> modal.style.display='none');

    async function inspectDoc(col, id){
      try {
        const snap = await getDoc(doc(db, col, id));
        if (!snap.exists()) return;
        const data = snap.data();
        document.getElementById('inspect-json').textContent = JSON.stringify(data, (k,v)=>{
          if (v && v.toDate) { try { return v.toDate().toISOString(); } catch { return v; } }
          return v;
        }, 2);
        modal.style.display = 'flex';
      } catch {}
    }

    // wire generic inspect buttons for queues
    document.addEventListener('click', (e)=>{
      const t = e.target;
      if (t && t.classList && t.classList.contains('inspect-btn')){
        const id = t.getAttribute('data-id');
        const col = t.getAttribute('data-col');
        inspectDoc(col, id);
      }
    });

    document.getElementById('queue-refresh').addEventListener('click', async ()=>{ await loadQueue(); await loadDlq(); await loadEligibleSoon(); });
    document.getElementById('dlq-refresh').addEventListener('click', loadDlq);
    document.getElementById('queue-process').addEventListener('click', async ()=>{
      try {
        await fetch('/process_queues', { method: 'POST' });
        await loadQueue();
        await loadDlq();
      } catch {}
    });

    await loadQueue();
    await loadDlq();
    await loadEligibleSoon();

    // Sparkline: 6 buckets of 10 minutes over next hour
    async function drawSparkline() {
      try {
        const canvas = document.getElementById('eligible-sparkline');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const now = Date.now();
        const horizon = now + 60 * 60 * 1000;

        const q1 = query(collection(db, 'feedback_queue'), where('status','in',['queued','retry']), where('nextAttemptAt','<=', new Date(horizon)), limit(500));
        const q2 = query(collection(db, 'sponsorship_queue'), where('status','in',['queued','retry']), where('nextAttemptAt','<=', new Date(horizon)), limit(500));
        let s1, s2; try { s1 = await getDocs(q1); } catch { s1 = { forEach:()=>{} }; };
        try { s2 = await getDocs(q2); } catch { s2 = { forEach:()=>{} }; };

        const buckets = new Array(6).fill(0);
        function bump(ts){
          const t = ts instanceof Date ? ts.getTime() : (ts && ts.toDate ? ts.toDate().getTime() : null);
          if (!t) return;
          const mins = Math.max(0, Math.min(59, Math.floor((t - now)/60000)));
          const idx = Math.min(5, Math.floor(mins/10));
          buckets[idx]++;
        }
        s1.forEach(d=>{ const v=d.data(); bump(v.nextAttemptAt); });
        s2.forEach(d=>{ const v=d.data(); bump(v.nextAttemptAt); });

        // clear
        ctx.clearRect(0,0,canvas.width,canvas.height);
        const w = canvas.width || canvas.clientWidth;
        const h = canvas.height || 40;
        const max = Math.max(1, ...buckets);
        const barW = w / (buckets.length * 1.5);
        const gap = barW / 2;
        buckets.forEach((val,i)=>{
          const x = i * (barW + gap) + gap;
          const barH = (val / max) * (h - 6);
          ctx.fillStyle = '#60a5fa';
          ctx.fillRect(x, h - barH - 2, barW, barH);
        });
      } catch {}
    }

    await drawSparkline();
  } catch (e) {
    // Swallow errors to avoid breaking admin console
  }
}

main();