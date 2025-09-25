import './app.js';

import { getFirebaseAuth, getFirebaseDb } from './firebase-core.js';
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { monitorAuthState, showAuthError, clearAuthError, safeSignOut } from './auth-utils.js';
import { html, safeSetHTML, setSafeText } from './sanitize.js';
import { navigateToInternal } from './navigation-helpers.js';

(async function() {
    const auth = getFirebaseAuth();
    const db = getFirebaseDb();

    const loadingState = document.getElementById('loading-state');
    const dashboardContent = document.getElementById('dashboard-content');
    const userEmailEl = document.getElementById('user-email');
    const logoutButton = document.getElementById('logout-button');
    let countdownInterval;

    let isDestroyed = false;

    function cleanup() {
        isDestroyed = true;
        if (countdownInterval) {
            clearInterval(countdownInterval);
        }
    }

    async function handleLogout() {
        if (isDestroyed) return;

        if (logoutButton) {
            logoutButton.disabled = true;
            logoutButton.textContent = 'Signing out...';
        }

        cleanup();

        const success = await safeSignOut();

        if (success) {
            setTimeout(() => {
                navigateToInternal('/login.html');
            }, 100);
        } else {
            navigateToInternal('/login.html');
        }
    }

    function hideLoadingAndShowContent() {
        if (loadingState) {
            loadingState.style.display = 'none';
        }
        if (dashboardContent) {
            dashboardContent.classList.remove('hidden');
        }
    }

    function startCountdown(races) {
        if (isDestroyed) return;

        if (countdownInterval) clearInterval(countdownInterval);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        let nextRace = null;

        for (const race of races) {
            if (race && race.date && !isNaN(new Date(race.date + 'T00:00:00'))) {
                const raceDate = new Date(race.date + 'T00:00:00');
                if (raceDate >= today) {
                    nextRace = race;
                    break;
                }
            }
        }

        const nextRaceNameEl = document.getElementById('next-race-name');
        const countdownTimerEl = document.getElementById('countdown-timer');

        if (!nextRace) {
            if (nextRaceNameEl) safeSetHTML(nextRaceNameEl, html`Season Complete!`);
            if (countdownTimerEl) safeSetHTML(countdownTimerEl, html`<div class='col-span-4 text-2xl font-racing'>Thanks for a great season!</div>`);
            return;
        }

        if (nextRaceNameEl) safeSetHTML(nextRaceNameEl, html`${nextRace.name}`);
        const nextRaceDate = new Date(nextRace.date + 'T19:00:00').getTime();

        if (isNaN(nextRaceDate)) {
            console.error(`[Dashboard:Countdown] Invalid date for next race:`, nextRace);
            if (countdownTimerEl) safeSetHTML(countdownTimerEl, html`<div class='col-span-4 text-red-500'>Error: Invalid race date</div>`);
            return;
        }

        countdownInterval = setInterval(() => {
            if (isDestroyed) {
                clearInterval(countdownInterval);
                return;
            }

            const now = new Date().getTime();
            const distance = nextRaceDate - now;

            if (distance < 0) {
                clearInterval(countdownInterval);
                if (countdownTimerEl) safeSetHTML(countdownTimerEl, html`<div class='col-span-4 text-3xl font-racing neon-yellow'>RACE DAY!</div>`);
                return;
            }

            const days = Math.floor(distance / (1000 * 60 * 60 * 24));
            const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((distance % (1000 * 60)) / 1000);

            const daysEl = document.getElementById('days');
            const hoursEl = document.getElementById('hours');
            const minutesEl = document.getElementById('minutes');
            const secondsEl = document.getElementById('seconds');

            if (daysEl) setSafeText(daysEl, days.toString());
            if (hoursEl) setSafeText(hoursEl, hours.toString());
            if (minutesEl) setSafeText(minutesEl, minutes.toString());
            if (secondsEl) setSafeText(secondsEl, seconds.toString());
        }, 1000);
    }

    async function getRaceData() {
        if (isDestroyed) return;

        try {
            const racesCol = collection(db, "races");
            const q = query(racesCol, orderBy("date", "asc"));
            const raceSnapshot = await getDocs(q);
            const raceList = raceSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            startCountdown(raceList);

            console.log('[Dashboard:Races] Successfully loaded races:', raceList.length);
        } catch (error) {
            console.error('[Dashboard:Races] Error loading race data:', error);
        }
    }

    if (logoutButton) {
        logoutButton.addEventListener('click', (e) => {
            e.preventDefault();
            handleLogout();
        });
    }

    monitorAuthState(
        (user, validToken) => {
            if (user && validToken) {
                if (userEmailEl) {
                    setSafeText(userEmailEl, user.email);
                }
                getRaceData();
                hideLoadingAndShowContent();
            } else {
                cleanup();
                navigateToInternal('/login.html');
            }
        },
        (error) => {
            showAuthError(error);
            if (error.requiresReauth) {
                setTimeout(() => {
                    cleanup();
                    navigateToInternal('/login.html');
                }, 2000);
            }
        }
    );

    window.addEventListener('beforeunload', cleanup);
})();