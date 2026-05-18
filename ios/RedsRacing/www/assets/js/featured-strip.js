import { getFirebaseDb } from "./firebase-core.js";

const [{ collection, getDocs, limit, orderBy, query, where, doc, onSnapshot }] = await Promise.all([
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

/** Root-relative links: ../ when page is under fan/, crew/, or racer/. */
function pageHref(path) {
  const clean = String(path || "").replace(/^\//, "");
  try {
    const p = (window.location.pathname || "").replace(/\\/g, "/");
    if (/\/(fan|crew|racer)\//i.test(p)) return "../" + clean;
  } catch (_) {}
  return clean;
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

function ordinal(n) {
  if (n === "DNF" || n === "dnf" || String(n).toUpperCase() === "DNF") return "DNF";
  const p = parseInt(String(n), 10);
  if (isNaN(p)) return escapeHtml(String(n ?? "--"));
  if (p === 1) return "1st";
  if (p === 2) return "2nd";
  if (p === 3) return "3rd";
  return p + "th";
}

function fmtAgoFromTs(ts) {
  try {
    if (!ts?.toMillis) return "";
    const sec = Math.floor((Date.now() - ts.toMillis()) / 1000);
    if (sec < 10) return "just now";
    if (sec < 60) return sec + "s ago";
    if (sec < 3600) return Math.floor(sec / 60) + "m ago";
    return Math.floor(sec / 3600) + "h ago";
  } catch {
    return "";
  }
}

function flagLabel(flag) {
  const f = String(flag || "green").toLowerCase();
  if (f === "yellow") return { t: "Yellow", c: "text-yellow-400" };
  if (f === "red") return { t: "Red", c: "text-red-400" };
  if (f === "checkered") return { t: "Checkered", c: "text-slate-200" };
  return { t: "Green", c: "text-emerald-400" };
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
  const db = getFirebaseDb();
  const ref = collection(db, "race_results");
  const snap = await getDocs(ref);
  if (snap.empty) return null;
  const all = snap.docs.map((d) => d.data()).filter(Boolean);
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

let stripCache = { nextRace: null, recap: null, photoUrl: null };
let agoTimer = null;

function clearAgoTimer() {
  if (agoTimer) {
    clearInterval(agoTimer);
    agoTimer = null;
  }
}

function tickLiveAgo(lastUpdate) {
  const el = document.getElementById("rr-live-ago");
  if (!el || !lastUpdate?.toMillis) return;
  el.textContent = fmtAgoFromTs(lastUpdate);
}

function renderDefaultStrip({ nextRace, recap, photoUrl }) {
  const el = document.getElementById("rr-feature-strip");
  if (!el) return;
  clearAgoTimer();

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
  const thirdHref = pageHref(photoUrl ? "gallery.html" : "team.html");
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
            <a href="${escapeHtml(pageHref("live.html"))}">Live board</a>
            <a href="${escapeHtml(pageHref("schedule.html"))}">Schedule</a>
            <a href="${escapeHtml(pageHref("recaps.html"))}">Recaps</a>
            <a href="${escapeHtml(pageHref("stats.html"))}">Stats</a>
          </div>
        </div>
        <div class="rr-feature-grid">
          <div class="rr-feature-card rr-accent-amber">
            <div class="rr-feature-label">Next race</div>
            <div class="rr-feature-title">${raceTitle}</div>
            <p class="rr-feature-sub">${raceSub}</p>
            <a class="rr-feature-cta" href="${escapeHtml(pageHref("schedule.html"))}"><i class="fas fa-calendar-check"></i> View schedule</a>
          </div>
          <div class="rr-feature-card rr-accent-blue">
            <div class="rr-feature-label">Latest recap</div>
            <div class="rr-feature-title">${recapTitle}</div>
            <p class="rr-feature-sub">${recapSub}</p>
            <a class="rr-feature-cta" href="${escapeHtml(pageHref("recaps.html"))}"><i class="fas fa-flag-checkered"></i> Read recaps</a>
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

function renderLiveStrip(live) {
  const el = document.getElementById("rr-feature-strip");
  if (!el) return;
  clearAgoTimer();

  const track = escapeHtml(live.trackName || "Live race");
  const rtype = escapeHtml(live.raceType || "Feature");
  const cur = live.currentLap != null ? live.currentLap : "--";
  const tot = live.totalLaps != null ? live.totalLaps : "--";
  const jon = live.drivers?.jon || {};
  const jy = live.drivers?.jonny || {};
  const jPos = jon.position;
  const jyPos = jy.position;
  const jPlace = ordinal(jPos);
  const jyPlace = ordinal(jyPos);
  const jGapRaw = jPos == 1 || jPos === "1" ? "Leading" : String(jon.gap != null && jon.gap !== "" ? jon.gap : "--");
  const jyGapRaw = jyPos == 1 || jyPos === "1" ? "Leading" : String(jy.gap != null && jy.gap !== "" ? jy.gap : "--");
  const jGap = escapeHtml(jGapRaw);
  const jyGap = escapeHtml(jyGapRaw);
  const ago = fmtAgoFromTs(live.lastUpdate);
  const fl = flagLabel(live.flag);
  const eventLine =
    live.event && String(live.event).trim()
      ? `<p class="rr-feature-sub rr-feature-live-event"><i class="fas fa-bullhorn"></i> ${escapeHtml(String(live.event).trim())}</p>`
      : "";

  el.innerHTML = `
    <div class="rr-feature-strip rr-feature-strip--broadcast">
      <div class="rr-feature-shell rr-feature-shell--live">
        <div class="rr-feature-head rr-feature-head--live">
          <div class="rr-feature-kicker rr-feature-kicker--live">
            <span class="rr-feature-live-dot rr-feature-live-dot--danger" aria-hidden="true"></span>
            ON TRACK NOW
          </div>
          <div class="rr-feature-actions">
            <a href="${escapeHtml(pageHref("live.html"))}"><i class="fas fa-broadcast-tower"></i> Full live page</a>
            <a href="${escapeHtml(pageHref("schedule.html"))}">Schedule</a>
          </div>
        </div>
        <div class="rr-feature-grid rr-feature-grid--live">
          <div class="rr-feature-card rr-accent-live">
            <div class="rr-feature-label">Race</div>
            <div class="rr-feature-title">${track}</div>
            <p class="rr-feature-sub">${rtype} · Lap <strong>${escapeHtml(String(cur))}</strong> / ${escapeHtml(String(tot))}</p>
            <p class="rr-feature-sub"><span class="${fl.c} font-bold">${escapeHtml(fl.t)} flag</span></p>
            ${eventLine}
            <p class="rr-feature-live-meta">Pit row updated <span id="rr-live-ago">${escapeHtml(ago)}</span></p>
            <a class="rr-feature-cta rr-feature-cta--live" href="${escapeHtml(pageHref("live.html"))}"><i class="fas fa-satellite-dish"></i> Open live times &amp; places</a>
          </div>
          <div class="rr-feature-card rr-accent-blue">
            <div class="rr-feature-label">Jon #8 — place</div>
            <div class="rr-feature-title rr-feature-place">${jPlace}</div>
            <p class="rr-feature-sub">Gap: <strong>${jGap}</strong></p>
          </div>
          <div class="rr-feature-card rr-accent-red">
            <div class="rr-feature-label">Jonny #88 — place</div>
            <div class="rr-feature-title rr-feature-place">${jyPlace}</div>
            <p class="rr-feature-sub">Gap: <strong>${jyGap}</strong></p>
          </div>
        </div>
      </div>
    </div>
  `;

  if (live.lastUpdate?.toMillis) {
    agoTimer = setInterval(() => tickLiveAgo(live.lastUpdate), 12000);
  }
}

function snapExists(snap) {
  if (!snap) return false;
  return typeof snap.exists === "function" ? snap.exists() : !!snap.exists;
}

function applyLiveOrDefault(liveSnap) {
  const data = snapExists(liveSnap) ? liveSnap.data() : null;
  if (data && data.isLive === true) {
    renderLiveStrip(data);
  } else {
    renderDefaultStrip(stripCache);
  }
}

async function boot() {
  const el = document.getElementById("rr-feature-strip");
  if (!el) return;

  try {
    const [nextRace, recap, photoUrl] = await Promise.all([
      fetchNextRace().catch(() => null),
      fetchLatestRecap().catch(() => null),
      fetchLatestPhoto().catch(() => null),
    ]);
    stripCache = { nextRace, recap, photoUrl };
    renderDefaultStrip(stripCache);
  } catch {
    stripCache = { nextRace: null, recap: null, photoUrl: null };
    renderDefaultStrip(stripCache);
  }

  try {
    const db = getFirebaseDb();
    onSnapshot(
      doc(db, "live_race", "current"),
      (snap) => {
        applyLiveOrDefault(snap);
      },
      () => {
        renderDefaultStrip(stripCache);
      },
    );
  } catch {
    renderDefaultStrip(stripCache);
  }
}

boot();
