import "./app.js";
import {
  getFirestore,
  collection,
  query,
  onSnapshot,
  orderBy,
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { getFirebaseDb } from "./firebase-core.js";
import { monitorAuthState } from "./auth-utils.js";

// Import invitation code utilities
import {
  captureInvitationCodeFromURL,
  applyPendingInvitationCode,
} from "./invitation-codes.js";

// Import sanitization utilities
import { html, safeSetHTML } from "./sanitize.js";

// Helper to escape HTML
function escapeHTML(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

async function main() {
  // Capture invitation code from URL as early as possible
  captureInvitationCodeFromURL();

  const db = getFirebaseDb();

  // UI Elements
  const authLink = document.getElementById("auth-link");
  const authLinkMobile = document.getElementById("auth-link-mobile");

  // Auth State Change
  monitorAuthState(
    async (user) => {
      if (user) {
        if (authLink) authLink.textContent = "Dashboard";
        if (authLink) authLink.href = "dashboard.html";
        if (authLinkMobile) authLinkMobile.textContent = "Dashboard";
        if (authLinkMobile) authLinkMobile.href = "dashboard.html";

        // Apply pending invitation code if available
        try {
          await applyPendingInvitationCode(user);
        } catch (error) {
          // Don't block the auth flow for invitation code errors
        }
      } else {
        if (authLink) authLink.textContent = "DRIVER LOGIN";
        if (authLink) authLink.href = "login.html";
        if (authLinkMobile) authLinkMobile.textContent = "DRIVER LOGIN";
        if (authLinkMobile) authLinkMobile.href = "login.html";
      }
    },
    (error) => {
      // Optional: handle auth errors
    },
  );

  const superCupsContainer = document.getElementById("super-cups-schedule");
  const specialEventsContainer = document.getElementById(
    "special-events-schedule",
  );
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const qRaces = query(collection(db, "races"), orderBy("date", "asc"));
onSnapshot(qRaces, async (snapshot) => {
    if (superCupsContainer) superCupsContainer.innerHTML = "";
    if (specialEventsContainer) specialEventsContainer.innerHTML = "";
    const allRaces = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Merge in JSON official results as fallback/complement
    try {
      const resp = await fetch('/data/jon-2025-speedhive-results.json', { cache: 'no-store' });
      if (resp.ok) {
        const results = await resp.json();
        const jsonEvents = Array.isArray(results.events) ? results.events : [];
        const byId = new Map(allRaces.map(r => [r.id, true]));
        jsonEvents.forEach(ev => {
          if (!ev || !ev.id || byId.has(ev.id)) return;
          // Build summary from sessions
          let feature = ev.sessions?.find(s => (s.sessionType||'').toLowerCase().includes('feature')) || null;
          let qual = ev.sessions?.find(s => (s.sessionType||'').toLowerCase().includes('qual')) || null;
          const fmtPos = (p) => typeof p === 'number' ? (p === 1 ? '1st' : p === 2 ? '2nd' : p === 3 ? '3rd' : `${p}th`) : '—';
          const resultsLine = feature ? `Feature: ${fmtPos(feature.position)}${feature.lapTime?` (${feature.lapTime}s)`:''}` : '';
          const qualLine = qual ? `Qual: ${fmtPos(qual.position)}${qual.lapTime?` (${qual.lapTime}s)`:''}` : '';
          
          // Format summary for display
          let summaryParts = [];
          if (ev.track) summaryParts.push(ev.track);
          if (ev.trackLength) summaryParts.push(ev.trackLength);
          
          // Add session results in a readable format
          const sessionResults = [];
          (ev.sessions||[]).forEach(s => {
            if (s.position) {
              const sessionName = s.sessionType || 'Session';
              sessionResults.push(`${sessionName}: ${fmtPos(s.position)}`);
            }
          });
          
          if (sessionResults.length > 0) {
            summaryParts.push(sessionResults.join(' • '));
          }
          
          const merged = {
            id: ev.id,
            name: ev.eventName || ev.id,
            date: ev.date,
            type: 'superCup',
            results: [resultsLine, qualLine].filter(Boolean).join(' • '),
            summary: summaryParts.join(' • ')
          };
          allRaces.push(merged);
        });
        // sort by date ascending
        allRaces.sort((a,b) => new Date(a.date) - new Date(b.date));
      }
    } catch (_) {
      // ignore JSON fetch errors
    }

    allRaces.forEach((race) => {
      const raceDate = new Date(race.date + "T00:00:00");
      const isPast = raceDate < today;
      let cardClass = isPast ? "past" : "upcoming";
      const formattedDate = raceDate.toLocaleString("en-US", {
        month: "long",
        day: "numeric",
      });

      // Build the recap section separately if needed
      let recapSection = '';
      if (isPast && (race.results || race.summary)) {
        cardClass += " cursor-pointer";
        recapSection = '<div class="race-recap hidden mt-4 pt-4 border-t border-slate-700">';
        if (race.results) {
          recapSection += '<p class="font-bold text-lg text-neon-yellow">' + escapeHTML(race.results) + '</p>';
        }
        if (race.summary) {
          recapSection += '<p class="text-slate-300 mt-2">' + escapeHTML(race.summary) + '</p>';
        }
        recapSection += '</div>';
      }

      const cardHTML = html` <div
        class="schedule-card p-4 rounded-lg ${cardClass}"
        data-race-id="${race.id}"
      >
        <div class="flex justify-between items-center">
          <div>
            <p class="font-bold text-lg text-white">${race.name}</p>
            <p class="text-sm text-slate-400">
              ${race.special || `Official Results`}
            </p>
          </div>
          <div class="font-semibold text-right text-slate-300">
            ${formattedDate}
          </div>
        </div>
      </div>` + recapSection;

      const cardElement = document.createElement("div");
      safeSetHTML(cardElement, cardHTML);
      const card = cardElement.firstElementChild;

      if (race.type === "specialEvent") {
        if (specialEventsContainer) specialEventsContainer.appendChild(card);
      } else {
        if (superCupsContainer) superCupsContainer.appendChild(card);
      }
    });

    document.querySelectorAll(".schedule-card.past").forEach((card) => {
      card.addEventListener("click", () => {
        const recap = card.querySelector(".race-recap");
        if (recap) recap.classList.toggle("hidden");
      });
    });

    const nextRace = allRaces.find(
      (race) => new Date(race.date + "T00:00:00") >= today,
    );
    if (nextRace) {
      const nextRaceNameEl = document.getElementById("next-race-name");
      if (nextRaceNameEl) nextRaceNameEl.textContent = nextRace.name;

      const nextRaceDate = new Date(nextRace.date + "T19:00:00").getTime();
      const countdownInterval = setInterval(() => {
        const now = new Date().getTime();
        const distance = nextRaceDate - now;
        const countdownTimerEl = document.getElementById("countdown-timer");

        if (distance < 0) {
          clearInterval(countdownInterval);
          if (countdownTimerEl)
            countdownTimerEl.innerHTML =
              "<div class='col-span-4 text-3xl font-racing neon-yellow'>RACE DAY!</div>";
          return;
        }

        const daysEl = document.getElementById("days");
        const hoursEl = document.getElementById("hours");
        const minutesEl = document.getElementById("minutes");
        const secondsEl = document.getElementById("seconds");

        if (daysEl)
          daysEl.textContent = Math.floor(distance / (1000 * 60 * 60 * 24));
        if (hoursEl)
          hoursEl.textContent = Math.floor(
            (distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
          );
        if (minutesEl)
          minutesEl.textContent = Math.floor(
            (distance % (1000 * 60 * 60)) / (1000 * 60),
          );
        if (secondsEl)
          secondsEl.textContent = Math.floor((distance % (1000 * 60)) / 1000);
      }, 1000);
    } else {
      const nextRaceNameEl = document.getElementById("next-race-name");
      const countdownTimerEl = document.getElementById("countdown-timer");
      if (nextRaceNameEl) nextRaceNameEl.textContent = "Season Complete!";
      if (countdownTimerEl)
        countdownTimerEl.innerHTML =
          "<div class='col-span-4 text-2xl font-racing'>Thanks for a great season!</div>";
    }
  });
}

main();
