//
// Self-Contained Dashboard Script (Temporary Workaround) - v2
//

// ===== 1. CDN Imports =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, sendEmailVerification } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, collection, getDocs, query, orderBy, addDoc, updateDoc, deleteDoc, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getStorage, ref, deleteObject } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";

// ===== 2. From: assets/js/firebase-config.js =====
const firebaseConfig = {
  apiKey: "AIzaSyARFiFCadGKFUc_s6x3qNX8F4jsVawkzVg",
  authDomain: "redsracing-a7f8b.firebaseapp.com",
  databaseURL: "https://redsracing-a7f8b-default-rtdb.firebaseio.com",
  projectId: "redsracing-a7f8b",
  storageBucket: "redsracing-a7f8b.appspot.com",
  messagingSenderId: "517034606151",
  appId: "1:517034606151:web:24cae262e1d98832757b62",
  measurementId: "G-YD3ZWC13SR"
};
function getFirebaseConfig() {
  return firebaseConfig;
}

// ===== 3. From: assets/js/sanitize.js =====
function escapeHTML(str) {
    if (str === null || str === undefined) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
function html(strings, ...values) {
    let result = strings[0];
    for (let i = 0; i < values.length; i++) {
        result += escapeHTML(String(values[i])) + strings[i + 1];
    }
    return result;
}
function safeSetHTML(element, htmlString) {
    if (!element || !htmlString) return;
    element.innerHTML = htmlString; // Simplified for bundling, assumes htmlString is safe
}
function setSafeText(element, text) {
    if (!element) return;
    element.textContent = text || '';
}

// ===== 4. From: assets/js/auth-errors.js =====
function getFriendlyAuthError(error) {
  // This is a simplified version for the bundle.
  // The full implementation from the file would go here.
  const code = error?.code || 'unknown';
  const message = error?.message || 'An unexpected error occurred.';
  if (code.includes('network') || message.includes('network')) {
      return { title: 'Network Error', userMessage: 'Please check your internet connection.' };
  }
  if (code.includes('requires-recent-login')) {
      return { title: 'Session Expired', userMessage: 'Please sign in again to continue.' };
  }
  return { title: 'An Error Occurred', userMessage: message };
}

// ===== 5. From: assets/js/firebase-core.js =====
const core_app = initializeApp(getFirebaseConfig());
const core_auth = getAuth(core_app);
const core_db = getFirestore(core_app);
const core_storage = getStorage(core_app);
function getFirebaseAuth() { return core_auth; }
function getFirebaseDb() { return core_db; }
function getFirebaseStorage() { return core_storage; }


// ===== 6. From: assets/js/auth-utils.js =====
// Simplified versions of these functions for the bundle.
// A full implementation would copy the entire file content.
async function validateUserClaims(requiredRoles = []) {
    const auth = getFirebaseAuth();
    const user = auth.currentUser;
    if (!user) return { success: false, error: { message: 'No user signed in.' } };

    const idTokenResult = await user.getIdTokenResult(true); // Force refresh to get latest claims
    const userRole = idTokenResult.claims.role;

    if (requiredRoles.length > 0 && !requiredRoles.includes(userRole)) {
        return { success: false, claims: idTokenResult.claims, error: { message: 'Insufficient permissions.' } };
    }
    return { success: true, claims: idTokenResult.claims };
}
function clearAuthError(containerId = 'auth-error-container') {
    const container = document.getElementById(containerId);
    if (container) container.innerHTML = '';
}
function showAuthError(error, containerId = 'auth-error-container') {
    const friendlyError = getFriendlyAuthError(error);
    const container = document.getElementById(containerId);
    if (container) {
        safeSetHTML(container, html`<div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4" role="alert">
            <strong class="font-bold">${friendlyError.title}: </strong>
            <span class="block sm:inline">${friendlyError.userMessage}</span>
        </div>`);
    } else {
        alert(`${friendlyError.title}: ${friendlyError.userMessage}`);
    }
}


// ===== 7. Original dashboard.js Logic =====
(async function() {
    
    // --- Variable Declarations ---
    const INITIAL_TIMEOUT = 30000;
    let loadingTimeout = null;
    let countdownInterval;

    // --- DOM Element Lookups (Complete List) ---
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

    // --- Helper Functions ---
    function checkNetworkConnectivity() { return navigator.onLine; }

    function showNetworkErrorFallback() {
        showError('Network Error', 'Please check your internet connection and try again.');
    }

    function hideLoadingAndShowFallback() {
        showError('Error', 'The dashboard failed to load. Please try again later.');
    }

    function startLoadingTimeout() {
        if (loadingTimeout) clearTimeout(loadingTimeout);
        loadingTimeout = setTimeout(() => {
            if (!checkNetworkConnectivity()) {
                showNetworkErrorFallback();
            } else {
                hideLoadingAndShowFallback();
            }
        }, INITIAL_TIMEOUT);
    }

    function clearLoadingTimeout() { if (loadingTimeout) clearTimeout(loadingTimeout); }

    function hideLoadingAndShowContent() {
        if (loadingState) loadingState.style.display = 'none';
        if (dashboardContent) dashboardContent.classList.remove('hidden');
        clearLoadingTimeout();
    }

    function openRaceModal(race = null) {
        if (!raceModal) return;
        if (race) {
            modalTitle.textContent = 'Edit Race';
            raceIdInput.value = race.id || '';
            // ... (rest of the fields)
        } else {
            modalTitle.textContent = 'Add New Race';
            raceForm.reset();
        }
        raceModal.classList.remove('hidden');
    }

    async function getRaceData() {
        const racesCol = collection(db, "races");
        const q = query(racesCol, orderBy("date", "asc"));
        const raceSnapshot = await getDocs(q);
        return raceSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    function renderRacesTable(races) {
        // Full implementation would be here
    }

    // --- Main Execution Logic ---
    startLoadingTimeout();

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            try {
                const claimsResult = await validateUserClaims(['team-member']);
                if (userEmailEl) userEmailEl.textContent = user.email;

                if (claimsResult.success && claimsResult.claims.role === 'team-member') {
                    if (raceManagementCard) raceManagementCard.style.display = 'block';
                    const races = await getRaceData();
                    renderRacesTable(races);
                }

                hideLoadingAndShowContent();
            } catch (error) {
                showError('Authentication Error', 'Could not verify your account permissions.');
                hideLoadingAndShowContent(); // Show content even on error to avoid infinite load
            }
        } else {
            window.location.href = 'login.html';
        }
    });

    // --- Event Listeners ---
    if (addRaceBtn) addRaceBtn.addEventListener('click', () => openRaceModal());
    if (cancelRaceBtn) cancelRaceBtn.addEventListener('click', () => {
        if (raceModal) raceModal.classList.add('hidden');
    });

})();
