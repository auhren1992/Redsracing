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
  const title = document.createElement("h2");
  title.className = "font-racing text-5xl uppercase mb-4 text-center";
  title.innerHTML = 'Season <span class="neon-yellow">Schedule</span>';
  root.appendChild(title);

  if (opts.seasonOver) {
    const note = document.createElement('p');
    note.className = 'text-center text-slate-400 mb-6';
    note.textContent = `Season ${opts.seasonYear || ''} complete. ${opts.nextSeasonYear ? 'Next season starts ' + opts.nextSeasonYear + '.' : ''}`;
    root.appendChild(note);
  }

  const list = document.createElement("div");
  list.className = "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6";

  const now = new Date();
  races.forEach((r) => {
    const card = document.createElement("div");
    const isPast = opts.seasonOver ? true : new Date(r.date) < now;
    card.className = `schedule-card rounded-lg p-5 card ${isPast ? 'past' : 'upcoming'}`;
    const status = isPast ? '<span class="text-xs text-slate-400">Completed</span>' : '<span class="text-xs text-neon-yellow">Upcoming</span>';
    card.innerHTML = `
      <div class="flex items-center justify-between">
        <div>
          <div class="text-xl font-bold">${r.eventName}</div>
          <div class="text-slate-400 text-sm">${r.track} — ${r.city}, ${r.state}</div>
        </div>
        <div class="text-right">
          <div class="${isPast ? 'text-slate-400' : 'text-neon-yellow'} font-bold">${formatDate(r.date)}</div>
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
