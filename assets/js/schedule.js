import './app.js';
import { getFirestore, collection, query, onSnapshot, orderBy } from "firebase/firestore";
import { getFirebaseDb } from './firebase-core.js';
import { monitorAuthState } from './auth-utils.js';


// Import invitation code utilities
import { captureInvitationCodeFromURL, applyPendingInvitationCode } from './invitation-codes.js';

// Import sanitization utilities
import { html, safeSetHTML } from './sanitize.js';

async function main() {
    // Capture invitation code from URL as early as possible
    captureInvitationCodeFromURL();

    const db = getFirebaseDb();

    // UI Elements
    const authLink = document.getElementById('auth-link');
    const authLinkMobile = document.getElementById('auth-link-mobile');

    // Auth State Change
    monitorAuthState(async (user, token) => {
        if (user) {
            if(authLink) authLink.textContent = 'Dashboard';
            if(authLink) authLink.href = 'dashboard.html';
            if(authLinkMobile) authLinkMobile.textContent = 'Dashboard';
            if(authLinkMobile) authLinkMobile.href = 'dashboard.html';
            
            // Apply pending invitation code if available
            try {
                await applyPendingInvitationCode(user);
            } catch (error) {
                // Don't block the auth flow for invitation code errors
            }
        } else {
            if(authLink) authLink.textContent = 'DRIVER LOGIN';
            if(authLink) authLink.href = 'login.html';
            if(authLinkMobile) authLinkMobile.textContent = 'DRIVER LOGIN';
            if(authLinkMobile) authLinkMobile.href = 'login.html';
        }
    }, (error) => {
        // Optional: handle auth errors
    });

    const superCupsContainer = document.getElementById('super-cups-schedule');
    const specialEventsContainer = document.getElementById('special-events-schedule');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const qRaces = query(collection(db, "races"), orderBy("date", "asc"));
    onSnapshot(qRaces, (snapshot) => {
        if(superCupsContainer) superCupsContainer.innerHTML = '';
        if(specialEventsContainer) specialEventsContainer.innerHTML = '';
        const allRaces = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        allRaces.forEach(race => {
            const raceDate = new Date(race.date + 'T00:00:00');
            const isPast = raceDate < today;
            let cardClass = isPast ? 'past' : 'upcoming';
            const formattedDate = raceDate.toLocaleString('en-US', { month: 'long', day: 'numeric' });

            let recapHTML = '';
            if (isPast && (race.results || race.summary)) {
                cardClass += ' cursor-pointer';
                const resultsHTML = race.results ? html`<p class="font-bold text-lg text-neon-yellow">Result: ${race.results}</p>` : '';
                const summaryHTML = race.summary ? html`<p class="text-slate-300 mt-2">${race.summary}</p>` : '';
                recapHTML = `
                    <div class="race-recap hidden mt-4 pt-4 border-t border-slate-700">
                        ${resultsHTML}
                        ${summaryHTML}
                    </div>
                `;
            }

            const cardHTML = html`
                <div class="schedule-card p-4 rounded-lg ${cardClass}" data-race-id="${race.id}">
                    <div class="flex justify-between items-center">
                        <div><p class="font-bold text-lg text-white">${race.name}</p><p class="text-sm text-slate-400">${race.special || `Race ${race.race}`}</p></div>
                        <div class="font-semibold text-right text-slate-300">${formattedDate}</div>
                    </div>
                    ${recapHTML}
                </div>`;

            const cardElement = document.createElement('div');
            safeSetHTML(cardElement, cardHTML);
            const card = cardElement.firstElementChild;

            if (race.type === 'specialEvent') {
                if(specialEventsContainer) specialEventsContainer.appendChild(card);
            } else {
                if(superCupsContainer) superCupsContainer.appendChild(card);
            }
        });

        document.querySelectorAll('.schedule-card.past').forEach(card => {
            card.addEventListener('click', () => {
                const recap = card.querySelector('.race-recap');
                if (recap) recap.classList.toggle('hidden');
            });
        });

        const nextRace = allRaces.find(race => new Date(race.date + 'T00:00:00') >= today);
        if (nextRace) {
            const nextRaceNameEl = document.getElementById('next-race-name');
            if(nextRaceNameEl) nextRaceNameEl.textContent = nextRace.name;

            const nextRaceDate = new Date(nextRace.date + 'T19:00:00').getTime();
            const countdownInterval = setInterval(() => {
                const now = new Date().getTime();
                const distance = nextRaceDate - now;
                const countdownTimerEl = document.getElementById('countdown-timer');

                if (distance < 0) {
                    clearInterval(countdownInterval);
                    if(countdownTimerEl) countdownTimerEl.innerHTML = "<div class='col-span-4 text-3xl font-racing neon-yellow'>RACE DAY!</div>";
                    return;
                }

                const daysEl = document.getElementById('days');
                const hoursEl = document.getElementById('hours');
                const minutesEl = document.getElementById('minutes');
                const secondsEl = document.getElementById('seconds');

                if(daysEl) daysEl.textContent = Math.floor(distance / (1000 * 60 * 60 * 24));
                if(hoursEl) hoursEl.textContent = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                if(minutesEl) minutesEl.textContent = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
                if(secondsEl) secondsEl.textContent = Math.floor((distance % (1000 * 60)) / 1000);
            }, 1000);
        } else {
            const nextRaceNameEl = document.getElementById('next-race-name');
            const countdownTimerEl = document.getElementById('countdown-timer');
            if(nextRaceNameEl) nextRaceNameEl.textContent = "Season Complete!";
            if(countdownTimerEl) countdownTimerEl.innerHTML = "<div class='col-span-4 text-2xl font-racing'>Thanks for a great season!</div>";
        }
    });
}

main();
