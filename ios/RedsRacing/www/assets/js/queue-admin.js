import "./app.js";
import { getFirebaseDb } from "./firebase-core.js";
import { escHtml } from "./html-escape.js";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  updateDoc,
  where,
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

/** Opens the staff’s email app to reply to the address the visitor provided (feedback / queue items). */
function buildFeedbackReplyMailto(email, name, message, kindLabel) {
  const to = String(email || "").trim();
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return null;
  const label = kindLabel || "message";
  const subject = encodeURIComponent(`RedsRacing — re: your ${label}`);
  const nm = String(name || "").trim();
  const snippet = String(message || "").replace(/\r/g, "").slice(0, 1200);
  const body = encodeURIComponent(
    `Hi${nm ? " " + nm : " there"},\n\nThank you for reaching out to RedsRacing.\n\n\n---\nTheir original ${label}:\n${snippet}\n`,
  );
  return `mailto:${to}?subject=${subject}&body=${body}`;
}

function appendReplyEmailLink(container, email, name, message, kindLabel) {
  if (!container) return;
  const href = buildFeedbackReplyMailto(email, name, message, kindLabel);
  if (!href) return;
  const a = document.createElement("a");
  a.href = href;
  a.className =
    "success-btn text-white px-2 py-1 rounded text-xs inline-block align-middle ml-1";
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.setAttribute("aria-label", "Reply by email");
  a.textContent = "Reply";
  container.appendChild(document.createTextNode(" "));
  container.appendChild(a);
}

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
        <div class="admin-card rounded-xl p-4 mb-4 col-span-1 lg:col-span-2">
          <h3 class="text-white font-semibold mb-2">
            Website feedback <span id="web-feedback-hint" class="text-slate-400 text-sm font-normal">(Firestore <code class="text-slate-500">feedback</code>)</span>
            <span id="web-feedback-count" class="text-slate-400 text-sm"></span>
          </h3>
          <p class="text-slate-400 text-xs mb-2">Submissions from feedback.html. Use <strong class="text-slate-300">Reply</strong> to open your mail app to their address. Retries / failures also appear in “Feedback Queue” below.</p>
          <div class="overflow-x-auto">
            <table class="w-full text-left modern-table text-sm">
              <thead class="table-header">
                <tr><th class="p-2">Time</th><th class="p-2">Name</th><th class="p-2">Email</th><th class="p-2">Message</th><th class="p-2">Page</th><th class="p-2">Reply</th><th class="p-2">Actions</th></tr>
              </thead>
              <tbody id="web-feedback-rows"></tbody>
            </table>
          </div>
        </div>
        <div>
          <h3 class="text-white font-semibold mb-2">Feedback Queue <span id="feedback-count" class="text-slate-400 text-sm"></span></h3>
          <div class="overflow-x-auto">
            <table class="w-full text-left modern-table text-sm">
              <thead class="table-header">
                <tr><th class="p-2">Name</th><th class="p-2">Email</th><th class="p-2">Message</th><th class="p-2">Status</th><th class="p-2">Next Attempt</th><th class="p-2">Reply</th><th class="p-2">Actions</th></tr>
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
                <tr><th class="p-2">Company</th><th class="p-2">Name</th><th class="p-2">Email</th><th class="p-2">Status</th><th class="p-2">Next Attempt</th><th class="p-2">Reply</th><th class="p-2">Actions</th></tr>
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

    const db = getFirebaseDb();
    if (!db) {
      console.error("[queue-admin] Firestore is not available (getFirebaseDb returned null/undefined).");
      return;
    }

    /** Filled in below; used by row builders so inspect works even if other scripts stop click propagation. */
    let inspectDoc = async () => {};
    const isInspectOpen = () => {
      const m = document.getElementById('inspect-modal');
      return !!(m && m.style && m.style.display && m.style.display !== 'none');
    };

    function attachInspectHandler(btn) {
      if (!btn || btn.__rrInspectBound) return;
      btn.__rrInspectBound = true;
      btn.addEventListener(
        "click",
        (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          if (isInspectOpen()) return;
          const id = btn.getAttribute("data-id");
          const col = btn.getAttribute("data-col");
          if (id && col) void inspectDoc(col, id);
        },
        true
      );
    }

    async function loadWebFeedback() {
      const tbody = document.getElementById("web-feedback-rows");
      const countEl = document.getElementById("web-feedback-count");
      if (!tbody) return;
      tbody.innerHTML = "";
      const webQ = query(collection(db, "feedback"), orderBy("createdAt", "desc"), limit(50));
      let snap;
      try {
        snap = await getDocs(webQ);
      } catch (e) {
        console.error("[queue-admin] Failed to load feedback collection:", e);
        const tr = document.createElement("tr");
        tr.className = "table-row";
        const td = document.createElement("td");
        td.className = "p-2 text-red-400";
        td.colSpan = 7;
        const msg = (e && typeof e.message === "string") ? e.message : String(e);
        td.textContent = `Could not load website feedback (check rules/indexes). ${msg}`;
        tr.appendChild(td);
        tbody.appendChild(tr);
        if (countEl) countEl.textContent = "";
        return;
      }
      let n = 0;
      snap.forEach((d) => {
        n++;
        const v = d.data();
        const tr = document.createElement("tr");
        tr.className = "table-row";
        const ts =
          v.createdAt && v.createdAt.toDate
            ? v.createdAt.toDate().toLocaleString()
            : "—";
        tr.innerHTML = `
          <td class="p-2 whitespace-nowrap">${escHtml(ts)}</td>
          <td class="p-2">${escHtml((v.name || "").toString().slice(0, 40))}</td>
          <td class="p-2">${escHtml((v.email || "").toString().slice(0, 40))}</td>
          <td class="p-2">${escHtml((v.message || "").toString().slice(0, 80))}</td>
          <td class="p-2">${escHtml((v.page || "").toString().slice(0, 40))}</td>
          <td class="p-2" data-reply-cell="1"></td>
          <td class="p-2">
            <button type="button" data-id="${escHtml(d.id)}" data-col="feedback" class="inspect-btn modern-btn text-white px-2 py-1 rounded text-xs">Inspect</button>
          </td>`;
        tbody.appendChild(tr);
        appendReplyEmailLink(tr.querySelector("[data-reply-cell]"), v.email, v.name, v.message, "feedback");
        attachInspectHandler(tr.querySelector(".inspect-btn"));
      });
      if (countEl) countEl.textContent = `(${n})`;
    }

    async function loadEligibleSoon() {
      try {
        const cutoff = new Date(Date.now() + 10 * 60 * 1000);
        let total = 0;
        const q1 = query(collection(db, 'feedback_queue'), where('status','in',['queued','retry']), where('nextAttemptAt','<=', cutoff), limit(500));
        const q2 = query(collection(db, 'sponsorship_queue'), where('status','in',['queued','retry']), where('nextAttemptAt','<=', cutoff), limit(500));
        let s1, s2;
        try {
          s1 = await getDocs(q1);
        } catch (e) {
          console.warn("[queue-admin] feedback_queue eligible count:", e);
          s1 = { size: 0, forEach: () => {} };
        }
        try {
          s2 = await getDocs(q2);
        } catch (e) {
          console.warn("[queue-admin] sponsorship_queue eligible count:", e);
          s2 = { size: 0, forEach: () => {} };
        }
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
      let fbSnap;
      try {
        fbSnap = await getDocs(fbQ);
      } catch (e) {
        console.error("[queue-admin] feedback_queue list failed:", e);
        fbSnap = { forEach: () => {}, size: 0 };
      }
      let fbCount = 0;
      fbSnap.forEach((d)=>{
        fbCount++;
        const v = d.data();
        const tr = document.createElement('tr');
        tr.className = 'table-row';
        const nextAttempt = v.nextAttemptAt && v.nextAttemptAt.toDate ? v.nextAttemptAt.toDate() : null;
        tr.innerHTML = `
          <td class="p-2">${escHtml((v.name||'').toString().slice(0,40))}</td>
          <td class="p-2">${escHtml((v.email||'').toString().slice(0,40))}</td>
          <td class="p-2">${escHtml((v.message||'').toString().slice(0,60))}</td>
          <td class="p-2"><span class="status-badge ${v.status==='retry'?'status-pending':'status-approved'}">${escHtml(v.status||'queued')}</span></td>
          <td class="p-2">${nextAttempt ? escHtml(nextAttempt.toLocaleString()) : '-'}</td>
          <td class="p-2" data-reply-cell="1"></td>
          <td class="p-2">
            <button type="button" data-id="${escHtml(d.id)}" data-col="feedback_queue" class="inspect-btn modern-btn text-white px-2 py-1 rounded text-xs">Inspect</button>
            <button type="button" data-id="${escHtml(d.id)}" data-col="feedback_queue" class="retry-btn modern-btn text-white px-2 py-1 rounded text-xs">Retry</button>
            <button type="button" data-id="${escHtml(d.id)}" data-col="feedback_queue" class="resolve-btn success-btn text-white px-2 py-1 rounded text-xs">Resolve</button>
          </td>`;
        fbRows.appendChild(tr);
        appendReplyEmailLink(tr.querySelector("[data-reply-cell]"), v.email, v.name, v.message, "feedback");
        attachInspectHandler(tr.querySelector(".inspect-btn"));
      });
      document.getElementById('feedback-count').textContent = `(${fbCount})`;

      // Sponsorship
      const spQ = query(collection(db, 'sponsorship_queue'), where('status', 'in', ['queued','retry']), orderBy('queuedAt','desc'), limit(50));
      let spSnap;
      try {
        spSnap = await getDocs(spQ);
      } catch (e) {
        console.error("[queue-admin] sponsorship_queue list failed:", e);
        spSnap = { forEach: () => {}, size: 0 };
      }
      let spCount = 0;
      spSnap.forEach((d)=>{
        spCount++;
        const v = d.data();
        const tr = document.createElement('tr');
        tr.className = 'table-row';
        const nextAttempt = v.nextAttemptAt && v.nextAttemptAt.toDate ? v.nextAttemptAt.toDate() : null;
        tr.innerHTML = `
          <td class="p-2">${escHtml((v.company||'').toString().slice(0,40))}</td>
          <td class="p-2">${escHtml((v.name||'').toString().slice(0,40))}</td>
          <td class="p-2">${escHtml((v.email||'').toString().slice(0,40))}</td>
          <td class="p-2"><span class="status-badge ${v.status==='retry'?'status-pending':'status-approved'}">${escHtml(v.status||'queued')}</span></td>
          <td class="p-2">${nextAttempt ? escHtml(nextAttempt.toLocaleString()) : '-'}</td>
          <td class="p-2" data-reply-cell="1"></td>
          <td class="p-2">
            <button type="button" data-id="${escHtml(d.id)}" data-col="sponsorship_queue" class="inspect-btn modern-btn text-white px-2 py-1 rounded text-xs">Inspect</button>
            <button type="button" data-id="${escHtml(d.id)}" data-col="sponsorship_queue" class="retry-btn modern-btn text-white px-2 py-1 rounded text-xs">Retry</button>
            <button type="button" data-id="${escHtml(d.id)}" data-col="sponsorship_queue" class="resolve-btn success-btn text-white px-2 py-1 rounded text-xs">Resolve</button>
          </td>`;
        spRows.appendChild(tr);
        appendReplyEmailLink(tr.querySelector("[data-reply-cell]"), v.email, v.name || v.company, v.message, "sponsorship inquiry");
        attachInspectHandler(tr.querySelector(".inspect-btn"));
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
            <tr><th class="p-2">Original</th><th class="p-2">Name/Company</th><th class="p-2">Email</th><th class="p-2">Last Error</th><th class="p-2">Reply</th><th class="p-2">Actions</th></tr>
          </thead>
          <tbody id="dlq-rows"></tbody>
        </table>
      </div>`;
    card.appendChild(dlqCard);

    async function loadDlq() {
      const dlqRows = document.getElementById('dlq-rows');
      dlqRows.innerHTML = '';
      const qdlq = query(collection(db, 'queue_dead_letter'), orderBy('movedAt','desc'), limit(50));
      let snap;
      try {
        snap = await getDocs(qdlq);
      } catch (e) {
        console.error("[queue-admin] queue_dead_letter list failed:", e);
        snap = { forEach: () => {}, size: 0 };
      }
      let count = 0;
      snap.forEach((d)=>{
        count++;
        const v = d.data();
        const tr = document.createElement('tr');
        tr.className = 'table-row';
        tr.innerHTML = `
          <td class="p-2">${escHtml((v.originalCollection||'').toString())}</td>
          <td class="p-2">${escHtml((v.company||v.name||'').toString().slice(0,40))}</td>
          <td class="p-2">${escHtml((v.email||'').toString().slice(0,40))}</td>
          <td class="p-2">${escHtml((v.lastError||'').toString().slice(0,60))}</td>
          <td class="p-2">
            <button data-id="${escHtml(d.id)}" class="dlq-inspect modern-btn text-white px-2 py-1 rounded text-xs">Inspect</button>
            <button data-id="${escHtml(d.id)}" class="dlq-requeue success-btn text-white px-2 py-1 rounded text-xs">Requeue</button>
            <button data-id="${escHtml(d.id)}" class="dlq-delete danger-btn text-white px-2 py-1 rounded text-xs">Delete</button>
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
    // Use inline styles (not Tailwind classes) so it works everywhere.
    modal.style.display = 'none';
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.right = '0';
    modal.style.bottom = '0';
    modal.style.left = '0';
    modal.style.padding = '16px';
    modal.style.background = 'rgba(0,0,0,0.60)';
    modal.style.zIndex = '100000';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    modal.style.webkitTapHighlightColor = 'transparent';
    modal.innerHTML = `
      <div id="inspect-panel" class="bg-slate-900 border border-slate-700 rounded-lg w-11/12 max-w-3xl p-4 shadow-2xl">
        <div class="flex items-center justify-between mb-2">
          <h4 id="inspect-title" class="text-white font-semibold">Document</h4>
          <button type="button" id="inspect-close" class="text-slate-400 hover:text-white text-2xl leading-none px-3 py-2 -mr-2 -mt-2" aria-label="Close">&times;</button>
        </div>
        <pre id="inspect-json" class="text-slate-300 text-xs overflow-auto whitespace-pre-wrap break-words" style="max-height: 60vh"></pre>
        <div id="inspect-reply-bar" class="hidden mt-3 pt-3 border-t border-slate-600 flex flex-wrap items-center gap-2">
          <span class="text-slate-400 text-xs">Reply to their email:</span>
          <a id="inspect-reply-link" href="#" class="success-btn text-white px-3 py-1.5 rounded text-sm inline-flex items-center gap-1"><i class="fas fa-envelope"></i> Open draft</a>
        </div>
      </div>`;
    document.body.appendChild(modal);
    const inspectPanel = modal.querySelector('#inspect-panel');
    if (inspectPanel) {
      inspectPanel.addEventListener('click', (e) => e.stopPropagation());
    }
    let lastInspectCloseTs = 0;
    const setInspectOpen = (open) => {
      if (open) {
        modal.style.display = 'flex';
        modal.style.pointerEvents = 'auto';
        modal.setAttribute('aria-hidden', 'false');
        try { document.body.style.overflow = 'hidden'; } catch (_) {}
      } else {
        modal.style.display = 'none';
        modal.style.pointerEvents = 'none';
        modal.setAttribute('aria-hidden', 'true');
        try { document.body.style.overflow = ''; } catch (_) {}
      }
    };
    // Start closed and non-interactive so it can't block taps.
    setInspectOpen(false);

    const closeInspect = (ev) => {
      try {
        if (ev) {
          ev.preventDefault();
          ev.stopPropagation();
        }
      } catch (_) {}
      lastInspectCloseTs = Date.now();
      setInspectOpen(false);
    };

    const closeBtn = document.getElementById('inspect-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', closeInspect, true);
      // Mobile WebView: prefer pointer/touch so it doesn't "fall through" to underlying Inspect buttons.
      closeBtn.addEventListener('pointerdown', closeInspect, true);
      closeBtn.addEventListener('touchstart', closeInspect, { capture: true, passive: false });
    }

    // Close when tapping the backdrop.
    modal.addEventListener('click', (e) => { if (e.target === modal) closeInspect(e); }, true);
    modal.addEventListener('pointerdown', (e) => { if (e.target === modal) closeInspect(e); }, true);
    modal.addEventListener('touchstart', (e) => { if (e.target === modal) closeInspect(e); }, { capture: true, passive: false });
    document.addEventListener('keydown', (e) => {
      if (e && e.key === 'Escape' && modal.style.display !== 'none') closeInspect(e);
    }, true);

    inspectDoc = async function inspectDocImpl(col, id) {
      const pre = document.getElementById('inspect-json');
      const titleEl = document.getElementById('inspect-title');
      const replyBar = document.getElementById('inspect-reply-bar');
      const replyLink = document.getElementById('inspect-reply-link');
      if (!pre || !id || !col) return;
      // Prevent immediate reopen right after a close tap (mobile "click-through" behavior).
      if (Date.now() - lastInspectCloseTs < 350) return;
      const hideReply = () => {
        if (replyBar) replyBar.classList.add('hidden');
      };
      try {
        const snap = await getDoc(doc(db, col, id));
        if (!snap.exists()) {
          pre.textContent = `No document at ${col}/${id}`;
          if (titleEl) titleEl.textContent = 'Not found';
          hideReply();
          setInspectOpen(true);
          return;
        }
        const data = snap.data();
        if (titleEl) titleEl.textContent = col === 'feedback' ? 'Website feedback' : 'Queued item';
        pre.textContent = JSON.stringify(data, (k, v) => {
          if (v && typeof v.toDate === 'function') {
            try { return v.toDate().toISOString(); } catch { return String(v); }
          }
          return v;
        }, 2);
        const kind =
          col === 'sponsorship_queue' || (data && data.company)
            ? 'sponsorship inquiry'
            : col === 'queue_dead_letter' &&
                String(data.originalCollection || '').includes('sponsorship')
              ? 'sponsorship inquiry'
              : 'feedback';
        const href = buildFeedbackReplyMailto(
          data.email,
          data.name || data.company,
          data.message,
          kind,
        );
        if (replyBar && replyLink && href) {
          replyLink.href = href;
          replyBar.classList.remove('hidden');
        } else {
          hideReply();
        }
        setInspectOpen(true);
      } catch (err) {
        console.error('[queue-admin] inspectDoc failed:', col, id, err);
        if (titleEl) titleEl.textContent = 'Inspect failed';
        pre.textContent = (err && err.message) ? err.message : String(err);
        hideReply();
        setInspectOpen(true);
      }
    };

    card.addEventListener(
      'click',
      (e) => {
        const btn = e.target && e.target.closest ? e.target.closest('.inspect-btn') : null;
        if (!btn || !card.contains(btn)) return;
        e.preventDefault();
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        const col = btn.getAttribute('data-col');
        if (id && col) void inspectDoc(col, id);
      },
      true
    );

    // Wire up buttons with proper error handling
    const queueRefreshBtn = document.getElementById('queue-refresh');
    const dlqRefreshBtn = document.getElementById('dlq-refresh');
    const queueProcessBtn = document.getElementById('queue-process');
    
    if (queueRefreshBtn) {
      queueRefreshBtn.addEventListener('click', async ()=>{ 
        queueRefreshBtn.disabled = true;
        queueRefreshBtn.innerHTML = '<i class="fas fa-sync fa-spin mr-1"></i>Refreshing...';
        try {
          await loadWebFeedback();
          await loadQueue(); 
          await loadDlq(); 
          await loadEligibleSoon();
        } finally {
          queueRefreshBtn.disabled = false;
          queueRefreshBtn.innerHTML = '<i class="fas fa-sync mr-1"></i>Refresh';
        }
      });
    }
    
    if (dlqRefreshBtn) {
      dlqRefreshBtn.addEventListener('click', async ()=>{
        dlqRefreshBtn.disabled = true;
        dlqRefreshBtn.innerHTML = '<i class="fas fa-sync fa-spin mr-1"></i>Refreshing...';
        try {
          await loadDlq();
        } finally {
          dlqRefreshBtn.disabled = false;
          dlqRefreshBtn.innerHTML = '<i class="fas fa-sync mr-1"></i>Refresh';
        }
      });
    }
    
    if (queueProcessBtn) {
      queueProcessBtn.addEventListener('click', async ()=>{
        queueProcessBtn.disabled = true;
        queueProcessBtn.innerHTML = '<i class="fas fa-cogs fa-spin mr-1"></i>Processing...';
        try {
          // Call Firebase Cloud Function instead of local endpoint
          const functionUrl = 'https://us-central1-redsracing-a7f8b.cloudfunctions.net/process_queues';
          const response = await fetch(functionUrl, { method: 'POST' });
          if (!response.ok) {
            let detail = "";
            try {
              detail = (await response.text()).slice(0, 500);
            } catch (_) {}
            throw new Error(
              `HTTP ${response.status}${detail ? `: ${detail}` : ""}`,
            );
          }
          await loadQueue();
          await loadDlq();
          await loadEligibleSoon();
        } catch(e) {
          console.error('Failed to process queues:', e);
          alert('Failed to process queues. Check console for details.');
        } finally {
          queueProcessBtn.disabled = false;
          queueProcessBtn.innerHTML = '<i class="fas fa-cogs mr-1"></i>Process Now';
        }
      });
    }

    await loadWebFeedback();
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
        let s1, s2;
        try {
          s1 = await getDocs(q1);
        } catch (e) {
          console.warn("[queue-admin] sparkline feedback_queue:", e);
          s1 = { forEach: () => {} };
        }
        try {
          s2 = await getDocs(q2);
        } catch (e) {
          console.warn("[queue-admin] sparkline sponsorship_queue:", e);
          s2 = { forEach: () => {} };
        }

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
    console.error('[queue-admin] failed to initialize:', e);
  }
}

main();