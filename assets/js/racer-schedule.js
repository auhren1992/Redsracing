// Shared schedule renderer for driver pages
import "./app.js";

async function fetchJSON(path) {
  try {
    const res = await fetch(path, { cache: "no-cache" });
    if (!res.ok) throw new Error(`Failed to fetch ${path}`);
    return await res.json();
  } catch (e) {
    return null;
  }
}

function formatDate(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return iso;
  }
}

function renderSchedule(root, races, opts = {}) {
  if (!root) return;
  root.innerHTML = "";

  const isJonny = document.body && document.body.classList.contains('jonny-page');

  // Title + optional next race countdown (Jonny only)
  const headerWrap = document.createElement('div');
  headerWrap.className = 'mb-6';

  const title = document.createElement("h2");
  title.className = "font-racing text-5xl uppercase mb-2 text-center";
  title.innerHTML = isJonny
    ? 'Rookie <span class="neon-red">Calendar</span>'
    : 'Season <span class="neon-yellow">Schedule</span>';
  headerWrap.appendChild(title);

  if (isJonny) {
    // Next race countdown widget
    const next = races.find(r => new Date(r.date) >= new Date());
    if (next) {
      const widget = document.createElement('div');
      widget.className = 'next-race-widget-jonny mx-auto max-w-3xl mb-4';
      widget.innerHTML = `
        <div class="bg-black/40 border border-red-400/30 rounded-2xl p-4 backdrop-blur-md shadow-2xl">
          <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div class="text-slate-300 text-xs uppercase tracking-wider">Next Race</div>
              <div class="text-white text-xl font-bold">${next.eventName || 'Race Day'}</div>
              <div class="text-slate-400 text-sm">${next.track || ''} ${next.city ? '— ' + next.city : ''}${next.state ? ', ' + next.state : ''}</div>
            </div>
            <div class="grid grid-cols-4 gap-2 text-center">
              <div class="countdown-pill"><div id="jr-days" class="num">0</div><div class="lbl">Days</div></div>
              <div class="countdown-pill"><div id="jr-hours" class="num">0</div><div class="lbl">Hours</div></div>
              <div class="countdown-pill"><div id="jr-mins" class="num">0</div><div class="lbl">Min</div></div>
              <div class="countdown-pill"><div id="jr-secs" class="num">0</div><div class="lbl">Sec</div></div>
            </div>
          </div>
        </div>`;
      headerWrap.appendChild(widget);

      // Start countdown
      try {
        const target = new Date(next.date + 'T19:00:00').getTime();
        const iv = setInterval(() => {
          const now = Date.now();
          let d = target - now;
          if (d < 0) { clearInterval(iv); d = 0; }
          const days = Math.floor(d / (1000*60*60*24));
          const hours = Math.floor((d % (1000*60*60*24)) / (1000*60*60));
          const mins = Math.floor((d % (1000*60*60)) / (1000*60));
          const secs = Math.floor((d % (1000*60)) / 1000);
          const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = String(val); };
          set('jr-days', days); set('jr-hours', hours); set('jr-mins', mins); set('jr-secs', secs);
        }, 1000);
      } catch {}
    }
  } else if (opts.seasonOver) {
    const note = document.createElement('p');
    note.className = 'text-center text-slate-400 mb-3';
    note.textContent = `Season ${opts.seasonYear || ''} complete. ${opts.nextSeasonYear ? 'Next season starts ' + opts.nextSeasonYear + '.' : ''}`;
    headerWrap.appendChild(note);
  }

  root.appendChild(headerWrap);

  // Schedule grid
  const list = document.createElement("div");
  list.className = "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6";

  const now = new Date();
  races.forEach((r) => {
    const card = document.createElement("div");
    const isPast = opts.seasonOver ? true : new Date(r.date) < now;
    const base = `schedule-card rounded-lg p-5 card ${isPast ? 'past' : 'upcoming'}`;
    card.className = isJonny ? base + ' schedule-card-jonny' : base;
    const status = isPast 
      ? '<span class="race-status badge-complete">Completed</span>' 
      : '<span class="race-status badge-upcoming">Upcoming</span>';
    card.innerHTML = `
      <div class="flex items-center justify-between">
        <div>
          <div class="text-xl font-bold">${r.eventName}</div>
          <div class="text-slate-400 text-sm">${r.track} — ${r.city}, ${r.state}</div>
        </div>
        <div class="text-right">
          <div class="${isPast ? 'text-slate-400' : (isJonny ? 'text-red-400' : 'text-neon-yellow')} font-bold">${formatDate(r.date)}</div>
          <div class="text-slate-400 text-sm">${r.startTime || "TBA"}</div>
          ${status}
        </div>
      </div>
    `;
    list.appendChild(card);
  });

  root.appendChild(list);
}

(async function initRacerSchedule() {
  const root = document.getElementById("racer-schedule");
  if (!root) return;
  const data = await fetchJSON("data/schedule.json");
  if (!data || !data.races) {
    root.innerHTML = '<p class="text-center text-slate-400">Schedule coming soon.</p>';
    return;
  }
  const seasonOver = !!data.seasonOver;
  const opts = { seasonOver, seasonYear: data.seasonYear, nextSeasonYear: data.nextSeasonYear };
  // Show full schedule with past/upcoming styling
  renderSchedule(root, data.races, opts);
})();
