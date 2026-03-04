// Shared schedule renderer for driver pages
import "./app.js";
import { getFirebaseDb } from "./firebase-core.js";
import { collection, getDocs, orderBy, query } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

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
    const subtitle = r.subtitle || [r.track, r.city && r.state ? `${r.city}, ${r.state}` : null].filter(Boolean).join(' — ');
    card.innerHTML = `
      <div class="flex items-center justify-between">
        <div>
          <div class="text-xl font-bold">${r.eventName || r.name}</div>
          ${subtitle ? `<div class="text-slate-400 text-sm">${subtitle}</div>` : ''}
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

  // Try Firestore first to mirror schedule.html
  try {
    const db = getFirebaseDb();
    const snap = await getDocs(query(collection(db, 'races'), orderBy('date', 'asc')));
    const racesFs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (racesFs.length) {
      // Normalize to renderer format
      const races = racesFs.map(r => ({
        date: r.date,
        eventName: r.name,
        name: r.name,
        startTime: r.startTime || null,
        subtitle: r.special ? String(r.special) : (r.race ? `Race ${r.race}` : null),
      }));
      renderSchedule(root, races, { seasonOver: false });
      return;
    }
  } catch (e) {
    // fall through to JSON
  }

  // Fallback to static JSON if Firestore unavailable/empty
  const data = await fetchJSON("data/schedule.json");
  if (!data || !data.races) {
    root.innerHTML = '<p class="text-center text-slate-400">Schedule coming soon.</p>';
    return;
  }
  const seasonOver = !!data.seasonOver;
  const opts = { seasonOver, seasonYear: data.seasonYear, nextSeasonYear: data.nextSeasonYear };
  renderSchedule(root, data.races, opts);
})();
