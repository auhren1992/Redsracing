import { getFirebaseDb } from "./firebase-core.js";

// Modular Firestore (via CDN, matches existing patterns in repo)
const [{ collection, getDocs, limit, orderBy, query, where }] = await Promise.all([
  import("https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js"),
]);

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function fmtDate(d) {
  try {
    if (!d) return "";
    if (typeof d === "string") {
      const x = new Date(d + "T12:00:00");
      if (!isNaN(x.getTime())) {
        return x.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
      }
      return d;
    }
    if (d?.toDate) {
      const x = d.toDate();
      return x.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    }
    return "";
  } catch {
    return "";
  }
}

async function fetchNextRace() {
  const db = getFirebaseDb();
  const racesRef = collection(db, "races");
  const todayStr = new Date().toISOString().split("T")[0];
  const q = query(
    racesRef,
    where("season", "==", 2026),
    where("type", "==", "superCup"),
    where("date", ">=", todayStr),
    orderBy("date", "asc"),
    limit(1),
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const r = snap.docs[0].data();
  return {
    name: r.eventName || r.name || "Next race",
    track: r.track || "",
    date: r.date || r.raceDate || "",
  };
}

async function fetchLatestRecap() {
  // race_results isn't structured for easy orderBy everywhere in this repo; keep it safe/simple.
  const db = getFirebaseDb();
  const ref = collection(db, "race_results");
  const snap = await getDocs(ref);
  if (snap.empty) return null;
  const all = snap.docs.map((d) => d.data()).filter(Boolean);
  // Group by (raceDate + trackName) like recaps.html
  const grouped = new Map();
  for (const r of all) {
    const k = String(r.raceDate || "") + "|" + String(r.trackName || "");
    if (!grouped.has(k)) grouped.set(k, { date: r.raceDate, track: r.trackName, loc: r.trackLocation || "" });
  }
  const list = Array.from(grouped.values()).filter((x) => x.date);
  list.sort((a, b) => new Date(b.date) - new Date(a.date));
  const top = list[0];
  if (!top) return null;
  return {
    track: top.track || "Race recap",
    date: top.date || "",
    loc: top.loc || "",
  };
}

async function fetchLatestPhoto() {
  const db = getFirebaseDb();
  const ref = collection(db, "gallery_images");
  const q = query(ref, where("approved", "==", true), orderBy("uploadedAt", "desc"), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0].data();
  return d?.imageUrl || d?.downloadURL || null;
}

function renderStrip({ nextRace, recap, photoUrl }) {
  const el = document.getElementById("rr-feature-strip");
  if (!el) return;

  const raceTitle = nextRace ? escapeHtml(nextRace.name) : "Season is rolling";
  const raceSub = nextRace
    ? [escapeHtml(nextRace.track), escapeHtml(fmtDate(nextRace.date))].filter(Boolean).join(" • ")
    : "See every date and track in one place.";

  const recapTitle = recap ? escapeHtml(recap.track) : "Race recaps";
  const recapSub = recap
    ? [escapeHtml(fmtDate(recap.date)), escapeHtml(recap.loc)].filter(Boolean).join(" • ")
    : "Finishes, points, and shareable summaries.";

  const thirdTitle = photoUrl ? "New gallery shots" : "Driver hubs";
  const thirdSub = photoUrl ? "Fresh photos from race weekends and shop days." : "Jon #8 and Jonny #88 — profiles and results.";
  const thirdHref = photoUrl ? "gallery.html" : "team.html";
  const thirdCta = photoUrl ? "Open gallery" : "Meet the team";

  el.innerHTML = `
    <div class="rr-feature-strip">
      <div class="rr-feature-shell">
        <div class="rr-feature-head">
          <div class="rr-feature-kicker">
            <span class="rr-feature-live-dot" aria-hidden="true"></span>
            LIVE UPDATES
          </div>
          <div class="rr-feature-actions">
            <a href="schedule.html">Schedule</a>
            <a href="recaps.html">Recaps</a>
            <a href="stats.html">Stats</a>
          </div>
        </div>
        <div class="rr-feature-grid">
          <div class="rr-feature-card rr-accent-amber">
            <div class="rr-feature-label">Next race</div>
            <div class="rr-feature-title">${raceTitle}</div>
            <p class="rr-feature-sub">${raceSub}</p>
            <a class="rr-feature-cta" href="schedule.html"><i class="fas fa-calendar-check"></i> View schedule</a>
          </div>
          <div class="rr-feature-card rr-accent-blue">
            <div class="rr-feature-label">Latest recap</div>
            <div class="rr-feature-title">${recapTitle}</div>
            <p class="rr-feature-sub">${recapSub}</p>
            <a class="rr-feature-cta" href="recaps.html"><i class="fas fa-flag-checkered"></i> Read recaps</a>
          </div>
          <div class="rr-feature-card rr-accent-red" ${photoUrl ? `style="background-image: linear-gradient(to top, rgba(2,6,23,0.85), rgba(2,6,23,0.25)), url('${escapeHtml(photoUrl)}'); background-size: cover; background-position: center;"` : ""}>
            <div class="rr-feature-label">${photoUrl ? "Fresh photos" : "Drivers"}</div>
            <div class="rr-feature-title">${escapeHtml(thirdTitle)}</div>
            <p class="rr-feature-sub">${escapeHtml(thirdSub)}</p>
            <a class="rr-feature-cta" href="${escapeHtml(thirdHref)}"><i class="fas fa-bolt"></i> ${escapeHtml(thirdCta)}</a>
          </div>
        </div>
      </div>
    </div>
  `;
}

async function boot() {
  try {
    const [nextRace, recap, photoUrl] = await Promise.all([
      fetchNextRace().catch(() => null),
      fetchLatestRecap().catch(() => null),
      fetchLatestPhoto().catch(() => null),
    ]);
    renderStrip({ nextRace, recap, photoUrl });
  } catch {
    // If anything fails, quietly do nothing (page still looks fine).
  }
}

boot();

