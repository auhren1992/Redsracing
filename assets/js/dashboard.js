// Importing Firebase services and specific functions
import { getFirebaseAuth, getFirebaseDb, getFirebaseStorage } from './firebase-core.js';
import { onAuthStateChanged, signOut, sendEmailVerification } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, getDoc, setDoc, collection, getDocs, query, orderBy, addDoc, updateDoc, deleteDoc, where } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { ref, deleteObject } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";

// Import centralized authentication utilities
import { 
    validateAndRefreshToken, 
    validateUserClaims, 
    safeFirestoreOperation, 
    retryAuthOperation,
    showAuthError,
    clearAuthError,
    monitorAuthState,
    getCurrentUser
} from './auth-utils.js';

// Import sanitization utilities
import { html, safeSetHTML, setSafeText } from './sanitize.js';

// Import secure random utilities
import { secureJitter } from './secure-random.js';

// Import navigation helpers
import { navigateToInternal } from './navigation-helpers.js';


// Import error handling utilities
import { getFriendlyAuthError, isRecaptchaError } from './auth-errors.js';

// Main IIFE to encapsulate dashboard logic
(async function() {
    console.log('[DEBUG] Dashboard script started.');
    // --- Start of Variable Declarations ---
    
    const INITIAL_TIMEOUT = 30000;
    const MAX_RETRIES = 3;
    const RETRY_BASE_DELAY = 1000;
    
    let loadingTimeout = null;
    let countdownInterval;

    // DOM Element Lookups
    const loadingState = document.getElementById('loading-state');
    const dashboardContent = document.getElementById('dashboard-content');
    const userEmailEl = document.getElementById('user-email');
    const logoutButton = document.getElementById('logout-button');
    const emailVerificationNotice = document.getElementById('email-verification-notice');
    const resendVerificationBtn = document.getElementById('resend-verification-btn');
    const driverNotesCard = document.getElementById('driver-notes-card');
    const raceManagementCard = document.getElementById('race-management-card');
    const driverNotesEl = document.getElementById('driver-notes');
    const notesStatusEl = document.getElementById('notes-status');
    const raceModal = document.getElementById('race-modal');
    const modalTitle = document.getElementById('modal-title');
    const raceForm = document.getElementById('race-form');
    const raceIdInput = document.getElementById('race-id');
    const raceDateInput = document.getElementById('race-date');
    const raceNameInput = document.getElementById('race-name');
    const raceTypeInput = document.getElementById('race-type');
    const raceNumberContainer = document.getElementById('race-number-container');
    const raceNumberInput = document.getElementById('race-number');
    const specialNameContainer = document.getElementById('special-name-container');
    const specialNameInput = document.getElementById('special-name');
    const raceResultsInput = document.getElementById('race-results');
    const raceSummaryInput = document.getElementById('race-summary');
    const liveTimingLinkInput = document.getElementById('live-timing-link');
    const addRaceBtn = document.getElementById('add-race-btn');
    const cancelRaceBtn = document.getElementById('cancel-race-btn');
    const qnaManagementCard = document.getElementById('qna-management-card');
    const qnaList = document.getElementById('qna-list');
    const qnaModal = document.getElementById('qna-modal');
    const qnaAnswerForm = document.getElementById('qna-answer-form');
    const qnaIdInput = document.getElementById('qna-id');
    const qnaModalQuestion = document.getElementById('qna-modal-question');
    const qnaAnswerInput = document.getElementById('qna-answer');
    const cancelQnaBtn = document.getElementById('cancel-qna-btn');
    const photoApprovalCard = document.getElementById('photo-approval-card');
    const unapprovedPhotosList = document.getElementById('unapproved-photos-list');
    const jonnyPhotoApprovalCard = document.getElementById('jonny-photo-approval-card');
    const jonnyUnapprovedPhotosList = document.getElementById('jonny-unapproved-photos-list');
    const jonnyVideoManagementCard = document.getElementById('jonny-video-management-card');
    const addVideoForm = document.getElementById('add-video-form');
    const videoUrlInput = document.getElementById('video-url');
    const videoTitleInput = document.getElementById('video-title');
    const jonnyVideosList = document.getElementById('jonny-videos-list');
    const invitationCodesCard = document.getElementById('invitation-codes-card');
    const invitationCodesTableBody = document.getElementById('invitation-codes-table-body');
    const refreshCodesBtn = document.getElementById('refresh-codes-btn');

    // Firebase Services
    const auth = getFirebaseAuth();
    const db = getFirebaseDb();
    const storage = getFirebaseStorage();

    // --- End of Variable Declarations ---


    // --- Start of Function Declarations ---

    function startLoadingTimeout() {
        if (loadingTimeout) clearTimeout(loadingTimeout);
        loadingTimeout = setTimeout(async () => {
            console.error('[Dashboard:Timeout] Error:', `Loading timeout reached after ${INITIAL_TIMEOUT}ms, checking network and showing fallback`);

            // Before showing fallback, check if it's a network issue
            const isOnline = await checkNetworkConnectivity();

            if (!isOnline) {
                showNetworkErrorFallback();
            } else {
                hideLoadingAndShowFallback();
            }
        }, INITIAL_TIMEOUT);
    }

    function clearLoadingTimeout() {
        if (loadingTimeout) {
            clearTimeout(loadingTimeout);
            loadingTimeout = null;
        }
    }

    function hideLoadingAndShowContent() {
        console.log('[Dashboard:UI] Hiding loading state and showing dashboard content');
        if (loadingState) {
            loadingState.style.display = 'none';
            loadingState.setAttribute('hidden', 'true');
        }
        if (dashboardContent) {
            dashboardContent.classList.remove('hidden');
        }
        clearLoadingTimeout();
        console.log('[Dashboard:UI] ✓ Dashboard content displayed successfully');
    }

    function startCountdown(races) {
        console.log('[DEBUG] startCountdown called.');
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
        if (!nextRace) {
            safeSetHTML(document.getElementById('next-race-name'), html`Season Complete!`);
            safeSetHTML(document.getElementById('countdown-timer'), html`<div class='col-span-4 text-2xl font-racing'>Thanks for a great season!</div>`);
            return;
        }
        safeSetHTML(document.getElementById('next-race-name'), html`${nextRace.name}`);
        const nextRaceDate = new Date(nextRace.date + 'T19:00:00').getTime();
        if (isNaN(nextRaceDate)) {
            console.error(`[Dashboard:Countdown] Error: Invalid date for next race:`, nextRace);
            safeSetHTML(document.getElementById('countdown-timer'), html`<div class='col-span-4 text-red-500'>Error: Invalid race date</div>`);
            return;
        }
        countdownInterval = setInterval(() => {
            const now = new Date().getTime();
            const distance = nextRaceDate - now;
            if (distance < 0) {
                clearInterval(countdownInterval);
                safeSetHTML(document.getElementById('countdown-timer'), html`<div class='col-span-4 text-3xl font-racing neon-yellow'>RACE DAY!</div>`);
                return;
            }
            setSafeText(document.getElementById('days'), Math.floor(distance / (1000 * 60 * 60 * 24)));
            setSafeText(document.getElementById('hours'), Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)));
            setSafeText(document.getElementById('minutes'), Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)));
            setSafeText(document.getElementById('seconds'), Math.floor((distance % (1000 * 60)) / 1000));
        }, 1000);
    }

    function openRaceModal(race = null) {
        if (race) {
            modalTitle.textContent = 'Edit Race';
            raceIdInput.value = race.id || '';
            raceDateInput.value = race.date || '';
            raceNameInput.value = race.name || '';
            raceTypeInput.value = race.type || 'standard';
            raceResultsInput.value = race.results || '';
            raceSummaryInput.value = race.summary || '';
            liveTimingLinkInput.value = race.liveTimingLink || '';

            if (race.type === 'special') {
                raceNumberContainer.style.display = 'none';
                specialNameContainer.style.display = 'block';
                specialNameInput.value = race.specialName || '';
            } else {
                specialNameContainer.style.display = 'none';
                raceNumberContainer.style.display = 'block';
                raceNumberInput.value = race.raceNumber || '';
            }
        } else {
            modalTitle.textContent = 'Add New Race';
            raceForm.reset();
            raceIdInput.value = '';
            specialNameContainer.style.display = 'none';
            raceNumberContainer.style.display = 'block';
        }
        raceModal.classList.remove('hidden');
    }

    function renderRacesTable(races) {
        console.log('[DEBUG] renderRacesTable called with', races.length, 'races.');
        const tableBody = document.getElementById('races-table-body');
        if (!tableBody) return;
        tableBody.innerHTML = '';
        races.forEach(race => {
            const row = document.createElement('tr');
            row.className = 'border-b border-slate-700 hover:bg-slate-800';
            row.innerHTML = `...`; // Content omitted for brevity
            tableBody.appendChild(row);
        });
        document.querySelectorAll('.edit-race-btn').forEach(btn => btn.addEventListener('click', () => openRaceModal(races.find(r => r.id === btn.dataset.id))));
        document.querySelectorAll('.delete-race-btn').forEach(btn => btn.addEventListener('click', () => deleteRace(btn.dataset.id)));
    }

    async function getRaceData() {
        console.log('[DEBUG] getRaceData called.');
        const racesCol = collection(db, "races");
        const q = query(racesCol, orderBy("date", "asc"));
        const raceSnapshot = await getDocs(q);
        const raceList = raceSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderRacesTable(raceList);
        startCountdown(raceList);
    }

    // ... other function declarations ...

    // --- End of Function Declarations ---


    // --- Start of Main Execution Logic ---

    // Setup auth listener
    monitorAuthState(
        async (user, validToken) => {
            console.log('[DEBUG] monitorAuthState callback. User:', user ? user.uid : 'null', 'Token:', validToken);
            clearAuthError();
            if (user && validToken) {
                if (userEmailEl) userEmailEl.textContent = user.email;
                const claimsResult = await validateUserClaims(['team-member']);
                const isTeamMember = claimsResult.success && claimsResult.claims.role === 'team-member';

                if (isTeamMember) {
                    // Show and load all admin data
                    if (raceManagementCard) raceManagementCard.style.display = 'block';
                    // ... show other admin cards ...
                    try {
                        await getRaceData();
                        // await getQnaSubmissions(); // Assuming this and others are also refactored
                        // ...
                    } catch (error) {
                        console.error('[Dashboard:AuthSetup] Error loading admin data', error);
                        showAuthError({ code: 'data-load-failed', message: 'Failed to load dashboard data' });
                    }
                }
                if (driverNotesCard) driverNotesCard.classList.remove('hidden');
                hideLoadingAndShowContent();
            } else {
                window.location.href = 'login.html';
            }
        },
        (error) => {
            console.error('[Dashboard:AuthSetup] Authentication error', error);
            showAuthError(error);
            // ... error handling
        }
    );

    // Initial loading timeout
    startLoadingTimeout();

    // Set footer year
    document.getElementById('year').textContent = new Date().getFullYear();

    // Event listeners for modals, etc.
    if (addRaceBtn) addRaceBtn.addEventListener('click', () => openRaceModal());
    // ... other event listeners ...

    console.log('[Dashboard:Complete] ✓ Dashboard initialization setup complete');

})();
