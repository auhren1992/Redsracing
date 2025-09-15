// Importing Firebase services and specific functions
import { initializeFirebaseCore } from './firebase-core.js';
import { onAuthStateChanged, signOut, sendEmailVerification, linkWithPhoneNumber } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
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

// Import invitation code utilities
import { 
    userNeedsInvitationCode, 
    getPendingInvitationCode, 
    setPendingInvitationCode, 
    applyPendingInvitationCode 
} from './invitation-codes.js';

// Import sanitization utilities
import { html, safeSetHTML, setSafeText } from './sanitize.js';

// Import reCAPTCHA Enterprise
// import { recaptchaService } from './recaptcha-enterprise.js'; // Remove this line

// Import secure random utilities
import { secureJitter } from './secure-random.js';

// Import navigation helpers
import { navigateToInternal } from './navigation-helpers.js';

// Import reCAPTCHA manager
import { RecaptchaManager } from './recaptcha-manager.js';

// Import error handling utilities
import { getFriendlyAuthError, isRecaptchaError } from './auth-errors.js';

// Wrap everything in an async function to allow early returns
(async function() {
    // Enhanced error handling and retry logic
    const INITIAL_TIMEOUT = 15000; // Extended to 15 seconds to allow for retries
    const MAX_RETRIES = 3;
    const RETRY_BASE_DELAY = 1000; // 1 second base delay for exponential backoff
    
    let loadingTimeout = null;
    let retryCount = 0;
    let currentLoadingStage = 'initializing';
    
    // Global variables for dashboard state
    let mfaRecaptchaManager = null; // Managed reCAPTCHA instance for MFA
    let confirmationResult = null; // Store MFA confirmation result
    

    // Enhanced logging utility
    const dashboardLogger = {
        stage: (stage, message) => console.log(`[Dashboard:${stage}] ${message}`),
        error: (stage, error, context = {}) => console.error(`[Dashboard:${stage}] Error:`, error, context),
        retry: (attempt, maxAttempts, delay) => console.warn(`[Dashboard:Retry] Attempt ${attempt}/${maxAttempts}, delay: ${delay}ms`),
        success: (stage, message) => console.log(`[Dashboard:${stage}] ✓ ${message}`),
        info: (stage, message, ...args) => console.log(`[Dashboard:${stage}] ${message}`, ...args)
    };
    

    // Network connectivity detection
    const checkNetworkConnectivity = async () => {
        try {
            // Try to fetch a small resource with a short timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout
            
            const response = await fetch('https://www.google.com/favicon.ico', {
                method: 'HEAD',
                mode: 'no-cors',
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            return true;
        } catch (error) {
            if (error.name === 'AbortError') {
                console.error('[Dashboard:NetworkCheck] Error:', 'Network connectivity timeout');
            } else {
                console.error('[Dashboard:NetworkCheck] Error:', 'Network connectivity failed', error);
            }
            return false;
        }
    };
    
    // Error classification utility
    const classifyError = (error, context = '') => {
        if (!error) return { type: 'unknown', message: 'Unknown error occurred', retryable: false };
        
        // Network connectivity issues
        if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
            return { 
                type: 'network', 
                message: 'Network connection failed',
                userMessage: 'Please check your internet connection and try again.',
                retryable: true
            };
        }
        
        // Firebase-specific errors
        if (error.code) {
            switch (error.code) {
                case 'unavailable':
                case 'deadline-exceeded':
                    return {
                        type: 'firebase-service',
                        message: `Firebase service temporarily unavailable: ${error.code}`,
                        userMessage: 'Our services are temporarily unavailable. Please try again in a moment.',
                        retryable: true
                    };
                case 'permission-denied':
                case 'unauthenticated':
                    return {
                        type: 'auth',
                        message: `Authentication error: ${error.code}`,
                        userMessage: 'Authentication failed. Please log in again.',
                        retryable: false
                    };
                case 'failed-precondition':
                    return {
                        type: 'config',
                        message: `Configuration error: ${error.code}`,
                        userMessage: 'Service configuration issue. Please contact support.',
                        retryable: false
                    };
                default:
                    return {
                        type: 'firebase-other',
                        message: `Firebase error: ${error.code} - ${error.message}`,
                        userMessage: 'A service error occurred. Please try again.',
                        retryable: true
                    };
            }
        }
        
        // Generic errors
        return {
            type: 'generic',
            message: error.message || String(error),
            userMessage: 'An unexpected error occurred. Please try again.',
            retryable: true
        };
    };
    
    // Enhanced retry logic with exponential backoff
    const retryWithBackoff = async (fn, maxRetries = MAX_RETRIES, context = 'operation') => {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const result = await fn();
                if (attempt > 1) {
                    console.log(`[Dashboard:Retry] ✓ ${context} succeeded on attempt ${attempt}`);
                }
                return result;
            } catch (error) {
                const errorInfo = classifyError(error, context);
                console.error(`[Dashboard:Retry] Error:`, `${context} failed on attempt ${attempt}`, errorInfo);
                
                // Don't retry non-retryable errors
                if (!errorInfo.retryable || attempt === maxRetries) {
                    throw error;
                }
                
                // Calculate exponential backoff delay with secure jitter
                const baseDelay = RETRY_BASE_DELAY * Math.pow(2, attempt - 1);
                const delay = secureJitter(baseDelay, 0.3); // 30% jitter
                console.warn(`[Dashboard:Retry] Attempt ${attempt}/${maxRetries}, delay: ${Math.round(delay)}ms`);
                
                // Update UI to show retry status
                updateRetryStatus(attempt, maxRetries, context);
                
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    };
    
    // Update loading UI with retry information
const updateRetryStatus = (attempt, maxAttempts, context) => {
    const loadingState = document.getElementById('loading-state');
    if (loadingState && !loadingState.classList.contains('hidden')) {
        const loadingText = loadingState.querySelector('p');
        if (loadingText) {
            safeSetHTML(
                loadingText,
                html`Loading Dashboard...<br>
                    <span class="text-sm text-yellow-400">
                        Retrying connection (${attempt}/${maxAttempts})...
                    </span>`
            );
        }
    }
};
    
    // Set up enhanced loading timeout
    const startLoadingTimeout = () => {
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
    };
    
    startLoadingTimeout();

    // Enhanced fallback display functions
    function showNetworkErrorFallback() {
        console.error('[Dashboard:Network] Error:', 'Network connectivity issue detected, showing network error fallback');
        const loadingState = document.getElementById('loading-state');
        const dashboardContent = document.getElementById('dashboard-content');

        if (loadingState) {
            loadingState.style.display = 'none';
            loadingState.style.visibility = 'hidden';
            loadingState.classList.add('hidden');
            loadingState.setAttribute('hidden', 'true');
        }

        if (dashboardContent) {
            safeSetHTML(dashboardContent, `
                <div class="text-center py-20">
                    <h1 class="text-5xl font-racing uppercase mb-2">Driver <span class="neon-yellow">Dashboard</span></h1>
                    <div class="text-red-400 mb-6">
                        <div class="text-6xl mb-4">🌐</div>
                        <h2 class="text-2xl font-bold">No Internet Connection</h2>
                        <p class="mt-2">Please check your internet connection and try again.</p>
                        <p class="text-sm text-slate-400 mt-2">Make sure you're connected to WiFi or cellular data.</p>
                    </div>
                    <div class="space-x-4">
                        <button onclick="window.location.reload()" class="bg-blue-600 text-white font-bold py-2 px-4 rounded-md hover:bg-blue-500 transition">
                            Check Connection & Retry
                        </button>
                        <a href="index.html" class="bg-slate-600 text-white font-bold py-2 px-4 rounded-md hover:bg-slate-500 transition">
                            Go Home
                        </a>
                    </div>
                </div>
            `);
            dashboardContent.classList.remove('hidden');
        }

        clearLoadingTimeout();
    }

    function showServiceErrorFallback(errorType = 'service', userMessage = null) {
        console.error('[Dashboard:Service] Error:', `Service error detected: ${errorType}, showing service error fallback`);
        const loadingState = document.getElementById('loading-state');
        const dashboardContent = document.getElementById('dashboard-content');

        if (loadingState) {
            loadingState.style.display = 'none';
            loadingState.style.visibility = 'hidden';
            loadingState.classList.add('hidden');
            loadingState.setAttribute('hidden', 'true');
        }

        if (dashboardContent) {
            const defaultMessage = 'Our services are temporarily unavailable.';
            const displayMessage = userMessage || defaultMessage;
            const icon = errorType === 'auth' ? '🔐' : '⚠️';
            
            const authMessage = errorType === 'auth' ? 
                '<p class="text-sm text-slate-400 mt-1">You may need to log in again.</p>' : 
                '<p class="text-sm text-slate-400 mt-1">Please try again in a few moments.</p>';
            
            const actionButton = errorType === 'auth' ? 
                '<a href="login.html" class="bg-blue-600 text-white font-bold py-2 px-4 rounded-md hover:bg-blue-500 transition">Go to Login</a>' :
                '<button onclick="window.location.reload()" class="bg-blue-600 text-white font-bold py-2 px-4 rounded-md hover:bg-blue-500 transition">Try Again</button>';
            
            safeSetHTML(dashboardContent, html`
                <div class="text-center py-20">
                    <h1 class="text-5xl font-racing uppercase mb-2">Driver <span class="neon-yellow">Dashboard</span></h1>
                    <div class="text-yellow-400 mb-6">
                        <div class="text-6xl mb-4">${icon}</div>
                        <h2 class="text-2xl font-bold">Service Temporarily Unavailable</h2>
                        <p class="mt-2">${displayMessage}</p>
                        <p class="text-sm text-slate-400 mt-2">This appears to be a temporary service issue.</p>
                        ${authMessage}
                    </div>
                    <div class="space-x-4">
                        ${actionButton}
                        <a href="index.html" class="bg-slate-600 text-white font-bold py-2 px-4 rounded-md hover:bg-slate-500 transition">
                            Go Home
                        </a>
                    </div>
                </div>
            `);
            dashboardContent.classList.remove('hidden');
        }

        clearLoadingTimeout();
    }

    function hideLoadingAndShowFallback() {
        console.error('[Dashboard:Fallback] Error:', 'Showing generic fallback due to unspecified error');
        const loadingState = document.getElementById('loading-state');
        const dashboardContent = document.getElementById('dashboard-content');

        if (loadingState) {
            loadingState.style.display = 'none';
            loadingState.style.visibility = 'hidden';
            loadingState.classList.add('hidden');
            loadingState.setAttribute('hidden', 'true');
        }

        if (dashboardContent) {
            dashboardContent.innerHTML = `
                <div class="text-center py-20">
                    <h1 class="text-5xl font-racing uppercase mb-2">Driver <span class="neon-yellow">Dashboard</span></h1>
                    <div class="text-yellow-400 mb-6">
                        <div class="text-6xl mb-4">⚠️</div>
                        <h2 class="text-2xl font-bold">Dashboard Temporarily Unavailable</h2>
                        <p class="mt-2">We're experiencing technical difficulties loading the dashboard.</p>
                        <p class="text-sm text-slate-400 mt-2">This could be due to network issues or temporary service downtime.</p>
                        <p class="text-sm text-slate-400 mt-1">Please check your internet connection and try again.</p>
                    </div>
                    <div class="space-x-4">
                        <button onclick="window.location.reload()" class="bg-blue-600 text-white font-bold py-2 px-4 rounded-md hover:bg-blue-500 transition">
                            Try Again
                        </button>
                        <a href="index.html" class="bg-slate-600 text-white font-bold py-2 px-4 rounded-md hover:bg-slate-500 transition">
                            Go Home
                        </a>
                    </div>
                </div>
            `;
            dashboardContent.classList.remove('hidden');
        }

        clearLoadingTimeout();
    }
    
    function clearLoadingTimeout() {
        if (loadingTimeout) {
            clearTimeout(loadingTimeout);
            loadingTimeout = null;
        }
    }

    // Initialize Firebase services with enhanced error handling
    let auth, db, storage;
    
    try {
        console.log('[Dashboard:Initialization] Initializing Firebase services');
        const firebaseServices = await retryAuthOperation(initializeFirebaseCore, 'Firebase initialization');
        auth = firebaseServices.auth;
        db = firebaseServices.db;
        storage = firebaseServices.storage;
        console.log('[Dashboard:Initialization] ✓ Firebase services initialized successfully');
    } catch (error) {
        console.error('[Dashboard:Initialization] Error:', 'Critical Firebase initialization failure', error);
        showAuthError({
            code: 'firebase-init-failed',
            message: 'Firebase initialization failed',
            userMessage: 'Unable to connect to our services. Please refresh the page and try again.',
            requiresReauth: false,
            retryable: true
        });
        showServiceErrorFallback('service', 'Unable to connect to our services. Please refresh the page and try again.');
        return; // Exit early if Firebase can't be initialized
    }

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
    const mfaCard = document.getElementById('mfa-card');
    const mfaStatus = document.getElementById('mfa-status');
    const mfaEnrollForm = document.getElementById('mfa-enroll-form');
    const mfaVerifyForm = document.getElementById('mfa-verify-form');
    const mfaPhoneNumberInput = document.getElementById('mfa-phone-number');
    const mfaSendCodeBtn = document.getElementById('mfa-send-code-btn');
    const mfaVerificationCodeInput = document.getElementById('mfa-verification-code');
    const mfaVerifyBtn = document.getElementById('mfa-verify-btn');

    // Modal elements
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

    // Q&A elements
    const qnaManagementCard = document.getElementById('qna-management-card');
    const qnaList = document.getElementById('qna-list');
    const qnaModal = document.getElementById('qna-modal');
    const qnaAnswerForm = document.getElementById('qna-answer-form');
    const qnaIdInput = document.getElementById('qna-id');
    const qnaModalQuestion = document.getElementById('qna-modal-question');
    const qnaAnswerInput = document.getElementById('qna-answer');
    const cancelQnaBtn = document.getElementById('cancel-qna-btn');

    // Photo Approval elements
    const photoApprovalCard = document.getElementById('photo-approval-card');
    const unapprovedPhotosList = document.getElementById('unapproved-photos-list');
    const jonnyPhotoApprovalCard = document.getElementById('jonny-photo-approval-card');
    const jonnyUnapprovedPhotosList = document.getElementById('jonny-unapproved-photos-list');

    // Jonny's Video elements
    const jonnyVideoManagementCard = document.getElementById('jonny-video-management-card');
    const addVideoForm = document.getElementById('add-video-form');
    const videoUrlInput = document.getElementById('video-url');
    const videoTitleInput = document.getElementById('video-title');
    const jonnyVideosList = document.getElementById('jonny-videos-list');

    // Invitation Codes elements
    const invitationCodesCard = document.getElementById('invitation-codes-card');
    const invitationCodesTableBody = document.getElementById('invitation-codes-table-body');
    const refreshCodesBtn = document.getElementById('refresh-codes-btn');

    // Invitation Code Prompt elements
    const invitationCodePrompt = document.getElementById('invitation-code-prompt');
    const inlineInvitationCodeInput = document.getElementById('inline-invitation-code');
    const applyInvitationCodeBtn = document.getElementById('apply-invitation-code-btn');
    const invitationCodeMessage = document.getElementById('invitation-code-message');

    function classifyFirestoreError(err) {
      if (!err) return 'Unknown Firestore error';
      if (err.code) return `Firestore error ${err.code}: ${err.message}`;
      return err.message || String(err);
    }

    let notesSaveTimeout;
    let countdownInterval;

    // Countdown function
    const startCountdown = (races) => {
        if (countdownInterval) clearInterval(countdownInterval);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const nextRace = races.find(race => new Date(race.date + 'T00:00:00') >= today);

        if (!nextRace) {
            document.getElementById('next-race-name').textContent = "Season Complete!";
            document.getElementById('countdown-timer').innerHTML = "<div class='col-span-4 text-2xl font-racing'>Thanks for a great season!</div>";
            return;
        }

        document.getElementById('next-race-name').textContent = nextRace.name;
        const nextRaceDate = new Date(nextRace.date + 'T19:00:00').getTime();

        countdownInterval = setInterval(() => {
            const now = new Date().getTime();
            const distance = nextRaceDate - now;
            if (distance < 0) {
                clearInterval(countdownInterval);
                document.getElementById('countdown-timer').innerHTML = "<div class='col-span-4 text-3xl font-racing neon-yellow'>RACE DAY!</div>";
                return;
            }
            document.getElementById('days').textContent = Math.floor(distance / (1000 * 60 * 60 * 24));
            document.getElementById('hours').textContent = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            document.getElementById('minutes').textContent = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
            document.getElementById('seconds').textContent = Math.floor((distance % (1000 * 60)) / 1000);
        }, 1000);
    };

    // --- CRUD Functions ---

    // 1. READ Races and Render Table
    const renderRacesTable = (races) => {
        const tableBody = document.getElementById('races-table-body');
        tableBody.innerHTML = ''; // Clear existing rows
        races.forEach(race => {
            const row = document.createElement('tr');
            row.className = 'border-b border-slate-700 hover:bg-slate-800';
            row.innerHTML = `
                <td class="p-2">${race.date}</td>
                <td class="p-2">${race.name}</td>
                <td class="p-2">
                    <button class="edit-race-btn bg-yellow-500 text-white px-2 py-1 rounded text-sm" data-id="${race.id}">Edit</button>
                    <button class="delete-race-btn bg-red-600 text-white px-2 py-1 rounded text-sm ml-2" data-id="${race.id}">Delete</button>
                </td>
            `;
            tableBody.appendChild(row);
        });

        // Add event listeners for the new buttons
        document.querySelectorAll('.edit-race-btn').forEach(btn => btn.addEventListener('click', () => openRaceModal(races.find(r => r.id === btn.dataset.id))));
        document.querySelectorAll('.delete-race-btn').forEach(btn => btn.addEventListener('click', () => deleteRace(btn.dataset.id)));
    };

    // Enhanced data loading functions with retry logic
    const getRaceData = async () => {
        console.log('[Dashboard:RaceData] Loading race data from Firestore');
        const racesCol = collection(db, "races");
        const q = query(racesCol, orderBy("date", "asc"));
        const raceSnapshot = await getDocs(q);
        const raceList = raceSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        renderRacesTable(raceList);
        startCountdown(raceList);
        console.log(`[Dashboard:RaceData] ✓ Loaded ${raceList.length} races successfully`);
    };

    // 2. CREATE/UPDATE Races
    const openRaceModal = (race = null) => {
        raceForm.reset();
        if (race) {
            modalTitle.textContent = 'Edit Race';
            raceIdInput.value = race.id;
            raceDateInput.value = race.date;
            raceNameInput.value = race.name;
            raceTypeInput.value = race.type;
            if (race.type === 'superCup') {
                raceNumberInput.value = race.race || '';
                specialNameInput.value = '';
            } else {
                specialNameInput.value = race.special || '';
                raceNumberInput.value = '';
            }
            raceResultsInput.value = race.results || '';
            raceSummaryInput.value = race.summary || '';
            liveTimingLinkInput.value = race.liveTimingLink || '';
        } else {
            modalTitle.textContent = 'Add New Race';
            raceIdInput.value = '';
        }
        toggleRaceTypeFields();
        raceModal.classList.remove('hidden');
        raceModal.classList.add('flex');
    };

    const closeRaceModal = () => {
        raceModal.classList.add('hidden');
        raceModal.classList.remove('flex');
        // Clear form when closing
        raceForm.reset();
    };

    const toggleRaceTypeFields = () => {
        if (raceTypeInput.value === 'superCup') {
            raceNumberContainer.classList.remove('hidden');
            specialNameContainer.classList.add('hidden');
        } else {
            raceNumberContainer.classList.add('hidden');
            specialNameContainer.classList.remove('hidden');
        }
    };

    raceForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const raceId = raceIdInput.value;
        const raceData = {
            date: raceDateInput.value,
            name: raceNameInput.value,
            type: raceTypeInput.value,
            ...(raceTypeInput.value === 'superCup'
                ? { race: raceNumberInput.value }
                : { special: specialNameInput.value }),
            results: raceResultsInput.value,
            summary: raceSummaryInput.value,
            liveTimingLink: liveTimingLinkInput.value
        };

        try {
            if (raceId) {
                await updateDoc(doc(db, 'races', raceId), raceData);
            } else {
                await addDoc(collection(db, 'races'), raceData);
            }
            closeRaceModal();
            await getRaceData();
        } catch (error) {
            console.error("Error saving race:", error);
            alert("Failed to save race. Check console for details.");
        }
    });

    // 3. DELETE Races
    const deleteRace = async (id) => {
        if (confirm('Are you sure you want to delete this race?')) {
            try {
                await deleteDoc(doc(db, 'races', id));
                await getRaceData();
            } catch (error) {
                console.error("Error deleting race:", error);
                alert("Failed to delete race. Check console for details.");
            }
        }
    };

    // Wire up modal buttons
    addRaceBtn.addEventListener('click', () => openRaceModal());
    cancelRaceBtn.addEventListener('click', closeRaceModal);
    raceTypeInput.addEventListener('change', toggleRaceTypeFields);

    // Add click outside modal to close functionality for race modal
    raceModal.addEventListener('click', (e) => {
        if (e.target === raceModal) {
            closeRaceModal();
        }
    });

    // Add ESC key support (already covered above for both modals)

    // --- Q&A Management Functions ---
    const renderQnaSubmissions = (submissions) => {
        qnaList.innerHTML = '';
        if (submissions.length === 0) {
            qnaList.innerHTML = '<p class="text-slate-400">No pending questions.</p>';
            return;
        }
        submissions.forEach(sub => {
            const item = document.createElement('div');
            item.className = 'p-4 bg-slate-800 rounded-md';
            item.innerHTML = `
                <p class="text-white">${sub.question}</p>
                <p class="text-sm text-slate-400 mt-2">Submitted by: ${sub.submitterName}</p>
                <div class="mt-4 flex space-x-2">
                    <button class="approve-qna-btn bg-green-600 text-white px-2 py-1 rounded text-sm" data-id="${sub.id}">Approve & Answer</button>
                    <button class="delete-qna-btn bg-red-600 text-white px-2 py-1 rounded text-sm" data-id="${sub.id}">Delete</button>
                </div>
            `;
            qnaList.appendChild(item);
        });

        document.querySelectorAll('.approve-qna-btn').forEach(btn => btn.addEventListener('click', () => openQnaModal(submissions.find(s => s.id === btn.dataset.id))));
        document.querySelectorAll('.delete-qna-btn').forEach(btn => btn.addEventListener('click', () => deleteQnaSubmission(btn.dataset.id)));
    };

    const getQnaSubmissions = async () => {
        console.log('[Dashboard:QnAData] Loading Q&A submissions');
        const q = query(collection(db, "qna_submissions"), where("status", "==", "submitted"), orderBy("submittedAt", "asc"));
        const snapshot = await getDocs(q);
        const submissions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderQnaSubmissions(submissions);
        console.log(`[Dashboard:QnAData] ✓ Loaded ${submissions.length} Q&A submissions`);
    };

    const openQnaModal = (submission) => {
        qnaAnswerForm.reset();
        qnaIdInput.value = submission.id;
        qnaModalQuestion.textContent = submission.question;
        qnaModal.classList.remove('hidden');
        qnaModal.classList.add('flex');
    };

    const closeQnaModal = () => {
        qnaModal.classList.add('hidden');
        qnaModal.classList.remove('flex');
        // Clear form when closing
        qnaAnswerForm.reset();
    };

    qnaAnswerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = qnaIdInput.value;
        const answer = qnaAnswerInput.value.trim();
        if (!answer) return;
        if (!id) {
            console.error("Error publishing answer: Missing question ID");
            alert("Error: Missing question ID. Please try again.");
            return;
        }

        try {
            const qnaRef = doc(db, 'qna_submissions', id);
            await updateDoc(qnaRef, {
                answer: answer,
                status: 'published',
                answeredAt: new Date()
            });
            closeQnaModal();
            await getQnaSubmissions(); // Refresh the list
        } catch (error) {
            console.error("Error publishing answer:", error);
            alert("Failed to publish answer. Check console for details.");
        }
    });

    const deleteQnaSubmission = async (id) => {
        if (!id) {
            console.error("Error deleting question: Missing question ID");
            alert("Error: Missing question ID. Please try again.");
            return;
        }
        if (confirm('Are you sure you want to delete this question permanently?')) {
            try {
                await deleteDoc(doc(db, 'qna_submissions', id));
                await getQnaSubmissions(); // Refresh list
            } catch (error) {
                console.error("Error deleting question:", error);
                alert("Failed to delete question. Check console for details.");
            }
        }
    };

    cancelQnaBtn.addEventListener('click', closeQnaModal);

    // Add click outside modal to close functionality
    qnaModal.addEventListener('click', (e) => {
        if (e.target === qnaModal) {
            closeQnaModal();
        }
    });

    // Add ESC key to close modals
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (!qnaModal.classList.contains('hidden')) {
                closeQnaModal();
            } else if (!raceModal.classList.contains('hidden')) {
                closeRaceModal();
            }
        }
    });

    // --- Photo Approval Functions ---
    const renderUnapprovedPhotos = (photos, container, category) => {
        container.innerHTML = '';
        if (photos.length === 0) {
            container.innerHTML = `<p class="text-slate-400">No photos are currently pending approval in this category.</p>`;
            return;
        }
        photos.forEach(photo => {
            const item = document.createElement('div');
            item.className = 'p-4 bg-slate-800 rounded-md flex items-center justify-between';
            item.innerHTML = `
                <div class="flex items-center">
                    <img src="${photo.imageUrl}" class="w-16 h-16 object-cover rounded-md mr-4" alt="Thumbnail">
                    <div>
                        <p class="text-white">${photo.uploaderEmail || 'Unknown Uploader'}</p>
                        <p class="text-sm text-slate-400">${new Date(photo.createdAt.seconds * 1000).toLocaleString()}</p>
                    </div>
                </div>
                <div class="flex space-x-2">
                    <button class="approve-photo-btn bg-green-600 text-white px-3 py-1 rounded text-sm" data-id="${photo.id}">Approve</button>
                    <button class="delete-photo-btn bg-red-600 text-white px-3 py-1 rounded text-sm" data-id="${photo.id}" data-url="${photo.imageUrl}">Delete</button>
                </div>
            `;
            container.appendChild(item);
        });

        document.querySelectorAll('.approve-photo-btn').forEach(btn => btn.addEventListener('click', () => approvePhoto(btn.dataset.id)));
        document.querySelectorAll('.delete-photo-btn').forEach(btn => btn.addEventListener('click', () => deletePhoto(btn.dataset.id, btn.dataset.url)));
    };

    const getUnapprovedPhotos = async (category, container) => {
        console.log(`[Dashboard:PhotoData] Loading unapproved photos for category: ${category || 'main'}`);
        let photos = [];
        if (category) {
            // Query for specific category (e.g., "jonny")
            const q = query(
                collection(db, "gallery_images"),
                where("category", "==", category),
                where("approved", "==", false),
                orderBy("createdAt", "asc")
            );
            const snapshot = await getDocs(q);
            photos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } else {
            // Query for main gallery photos (those without jonny category or with explicit main category)
            // First get all unapproved photos, then filter client-side to avoid complex index requirements
            const q = query(
                collection(db, "gallery_images"),
                where("approved", "==", false),
                orderBy("createdAt", "asc")
            );
            const snapshot = await getDocs(q);
            // Filter out photos with "jonny" category client-side
            photos = snapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .filter(photo => !photo.category || photo.category !== "jonny");
        }
        renderUnapprovedPhotos(photos, container, category);
        console.log(`[Dashboard:PhotoData] ✓ Loaded ${photos.length} unapproved photos for ${category || 'main'} gallery`);
    };

    const approvePhoto = async (id) => {
        try {
            const photoRef = doc(db, 'gallery_images', id);
            await updateDoc(photoRef, { approved: true });
            // Refresh both lists after any approval
            getUnapprovedPhotos(null, unapprovedPhotosList);
            getUnapprovedPhotos('jonny', jonnyUnapprovedPhotosList);
        } catch (error) {
            console.error("Error approving photo:", error);
            alert("Failed to approve photo.");
        }
    };

    const deletePhoto = async (id, imageUrl) => {
        if (!confirm('Are you sure you want to permanently delete this photo?')) return;
        try {
            // Delete the Firestore document
            await deleteDoc(doc(db, 'gallery_images', id));

            // Delete the file from Cloud Storage
            const photoRef = ref(storage, imageUrl);
            await deleteObject(photoRef);

            // Refresh both lists after any deletion
            getUnapprovedPhotos(null, unapprovedPhotosList);
            getUnapprovedPhotos('jonny', jonnyUnapprovedPhotosList);
        } catch (error) {
            console.error("Error deleting photo:", error);
            alert("Failed to delete photo. It may have already been deleted from storage.");
        }
    };

    // --- Jonny's Video Management ---

    const getYouTubeVideoId = (url) => {
        try {
            const urlObj = new URL(url);
            if (urlObj.hostname === "youtu.be") {
                return urlObj.pathname.slice(1);
            } else if (urlObj.hostname === "www.youtube.com" || urlObj.hostname === "youtube.com") {
                return urlObj.searchParams.get("v");
            }
            return null;
        } catch (e) {
            return null;
        }
    };

    const renderJonnyVideos = (videos) => {
        jonnyVideosList.innerHTML = '';
        if (videos.length === 0) {
            jonnyVideosList.innerHTML = '<p class="text-slate-400">No videos added yet.</p>';
            return;
        }
        videos.forEach(video => {
            const item = document.createElement('div');
            item.className = 'flex items-center justify-between p-2 bg-slate-800 rounded-md';
            item.innerHTML = `
                <p class="text-white truncate">${video.title}</p>
                <button class="delete-video-btn bg-red-600 text-white px-2 py-1 rounded text-sm" data-id="${video.id}">Delete</button>
            `;
            jonnyVideosList.appendChild(item);
        });
        document.querySelectorAll('.delete-video-btn').forEach(btn => {
            btn.addEventListener('click', () => deleteJonnyVideo(btn.dataset.id));
        });
    };

    // Helper function to debug authentication issues
    const debugAuthToken = async (context) => {
        if (auth.currentUser) {
            try {
                const idTokenResult = await auth.currentUser.getIdTokenResult();
                console.log(`[${context}] Current user ID token:`, {
                    uid: idTokenResult.claims.sub,
                    role: idTokenResult.claims.role,
                    authTime: new Date(idTokenResult.claims.auth_time * 1000).toISOString(),
                    issuedAt: new Date(idTokenResult.issuedAtTime).toISOString(),
                    expirationTime: new Date(idTokenResult.expirationTime).toISOString()
                });
            } catch (error) {
                console.error(`[${context}] Error getting ID token:`, error);
            }
        } else {
            console.log(`[${context}] No current user`);
        }
    };

    const getJonnyVideos = async () => {
        const operation = async () => {
            console.log('[Dashboard:VideoData] Loading Jonny videos');
            const q = query(collection(db, "jonny_videos"), orderBy("createdAt", "desc"));
            const snapshot = await getDocs(q);
            const videos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderJonnyVideos(videos);
            console.log(`[Dashboard:VideoData] ✓ Loaded ${videos.length} Jonny videos`);
            return videos;
        };

        const result = await safeFirestoreOperation(operation, ['team-member'], 'Load Jonny videos');
        
        if (!result.success) {
            console.error('[Dashboard:VideoData] Error:', 'Error loading Jonny videos', result.error);
            showAuthError(result.error, 'jonny-videos-error');
            
            // Debug authentication issues if permission denied
            if (result.error.code === 'permission-denied') {
                await debugAuthToken('getJonnyVideos permission denied');
            }
            
            renderJonnyVideos([]); // Render empty list to prevent UI issues
        }
        
        return result.success ? result.data : [];
    };

    const deleteJonnyVideo = async (id) => {
        if (confirm('Are you sure you want to delete this video?')) {
            const operation = async () => {
                await deleteDoc(doc(db, 'jonny_videos', id));
                getJonnyVideos(); // Refresh the list
            };

            const result = await safeFirestoreOperation(operation, ['team-member'], 'Delete Jonny video');
            
            if (!result.success) {
                console.error("Error deleting video:", result.error);
                showAuthError(result.error, 'delete-video-error');
                alert(`Failed to delete video: ${result.error.userMessage}`);
            }
        }
    };

    addVideoForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const url = videoUrlInput.value.trim();
        const title = videoTitleInput.value.trim();
        const videoId = getYouTubeVideoId(url);

        if (!title || !videoId) {
            alert("Please enter a valid YouTube URL and a title.");
            return;
        }

        try {
            // Force token refresh to ensure custom claims are up to date
            if (auth.currentUser) {
                await auth.currentUser.getIdToken(true);
            }
            
            await addDoc(collection(db, "jonny_videos"), {
                youtubeId: videoId,
                title: title,
                createdAt: new Date()
            });
            addVideoForm.reset();
            getJonnyVideos(); // Refresh list
        } catch (error) {
            console.error("Error adding video:", error);
            alert("Failed to add video.");
        }
    });


    // --- Invitation Codes Management ---
    const getInvitationCodes = async () => {
        console.log('[Dashboard:InvitationCodes] Loading invitation codes from Firebase Functions');
        
        try {
            // Import Functions module
            const { getFunctions, httpsCallable } = await import("https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js");
            const functions = getFunctions();
            const getInvitationCodesFunction = httpsCallable(functions, 'getInvitationCodes');
            
            const result = await getInvitationCodesFunction();
            
            if (result.data.status === 'success') {
                renderInvitationCodes(result.data.codes);
                console.log('[Dashboard:InvitationCodes] Successfully loaded invitation codes');
            } else {
                console.error('[Dashboard:InvitationCodes] Error from function:', result.data.message);
                showAuthError({
                    code: 'invitation-codes-failed',
                    message: result.data.message
                }, 'invitation-codes-error');
            }
        } catch (error) {
            console.error('[Dashboard:InvitationCodes] Error loading invitation codes:', error);
            showAuthError(error, 'invitation-codes-error');
        }
    };

    const renderInvitationCodes = (codes) => {
        if (!invitationCodesTableBody) return;
        
        invitationCodesTableBody.innerHTML = '';
        
        if (!codes || codes.length === 0) {
            invitationCodesTableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center p-4 text-slate-400">No invitation codes found</td>
                </tr>
            `;
            return;
        }
        
        codes.forEach(code => {
            const row = document.createElement('tr');
            row.className = 'border-b border-slate-700 hover:bg-slate-800/50';
            
            const formatDate = (timestamp) => {
                if (!timestamp) return '-';
                const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
                return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
            };
            
            const statusText = code.used ? 'Used' : 'Available';
            const statusClass = code.used ? 'text-red-400' : 'text-green-400';
            
            row.innerHTML = `
                <td class="p-2 font-mono text-sm">${code.id}</td>
                <td class="p-2">${code.role}</td>
                <td class="p-2 ${statusClass} font-bold">${statusText}</td>
                <td class="p-2">${code.usedBy || '-'}</td>
                <td class="p-2 text-sm">${formatDate(code.usedAt)}</td>
                <td class="p-2 text-sm">${formatDate(code.expiresAt)}</td>
            `;
            
            invitationCodesTableBody.appendChild(row);
        });
    };

    // Add event listener for refresh button
    if (refreshCodesBtn) {
        refreshCodesBtn.addEventListener('click', getInvitationCodes);
    }


    // --- Invitation Code Prompt Handling ---
    const handleInvitationCodePrompt = async (user) => {
        try {
            // Check if user needs an invitation code and there's no pending code
            const needsCode = await userNeedsInvitationCode({ currentUser: user });
            const pendingCode = getPendingInvitationCode();
            
            if (needsCode && !pendingCode && invitationCodePrompt) {
                console.log('[Dashboard:InvitationCode] Showing invitation code prompt for user without role');
                invitationCodePrompt.classList.remove('hidden');
                
                // Set up the apply button handler
                if (applyInvitationCodeBtn && !applyInvitationCodeBtn.hasAttribute('data-listener')) {
                    applyInvitationCodeBtn.setAttribute('data-listener', 'true');
                    applyInvitationCodeBtn.addEventListener('click', async () => {
                        const code = inlineInvitationCodeInput?.value?.trim();
                        if (!code) {
                            showInvitationCodeMessage('Please enter an invitation code.', 'error');
                            return;
                        }

                        applyInvitationCodeBtn.disabled = true;
                        applyInvitationCodeBtn.textContent = 'Applying...';
                        showInvitationCodeMessage('Processing invitation code...', 'info');

                        try {
                            // Store the code and apply it
                            setPendingInvitationCode(code);
                            const result = await applyPendingInvitationCode({ currentUser: user });

                            if (result.success) {
                                showInvitationCodeMessage(`Success! Role assigned: ${result.role || 'team-member'}`, 'success');
                                // Hide the prompt after success
                                setTimeout(() => {
                                    invitationCodePrompt.classList.add('hidden');
                                    // Refresh the page to update UI with new role
                                    window.location.reload();
                                }, 2000);
                            } else {
                                showInvitationCodeMessage(result.error || 'Failed to apply invitation code', 'error');
                                if (!result.retryable) {
                                    // Clear the input for non-retryable errors
                                    inlineInvitationCodeInput.value = '';
                                }
                            }
                        } catch (error) {
                            console.error('[Dashboard:InvitationCode] Error applying code:', error);
                            showInvitationCodeMessage('An error occurred. Please try again.', 'error');
                        } finally {
                            applyInvitationCodeBtn.disabled = false;
                            applyInvitationCodeBtn.textContent = 'Apply Code';
                        }
                    });
                }
            } else {
                // Hide the prompt if not needed
                if (invitationCodePrompt) {
                    invitationCodePrompt.classList.add('hidden');
                }
            }
        } catch (error) {
            console.error('[Dashboard:InvitationCode] Error handling invitation code prompt:', error);
            // Don't show prompt if there's an error checking
            if (invitationCodePrompt) {
                invitationCodePrompt.classList.add('hidden');
            }
        }
    };

    // Helper function to show messages in the invitation code prompt
    const showInvitationCodeMessage = (message, type) => {
        if (!invitationCodeMessage) return;
        
        // Clear existing classes
        invitationCodeMessage.className = 'mt-2 text-sm';
        
        // Add appropriate styling based on type
        switch (type) {
            case 'error':
                invitationCodeMessage.className += ' text-red-400';
                break;
            case 'success':
                invitationCodeMessage.className += ' text-green-400';
                break;
            case 'info':
                invitationCodeMessage.className += ' text-blue-400';
                break;
            default:
                invitationCodeMessage.className += ' text-gray-400';
        }
        
        invitationCodeMessage.textContent = message;
        
        // Clear message after 5 seconds for non-error messages
        if (type !== 'error') {
            setTimeout(() => {
                if (invitationCodeMessage) {
                    invitationCodeMessage.textContent = '';
                }
            }, 5000);
        }
    };


    // --- MFA Setup with improved reCAPTCHA handling ---
    const setupMfa = async (user) => {
        const hasPhoneNumber = user.providerData.some(p => p.providerId === 'phone');

        if (hasPhoneNumber) {
            mfaStatus.innerHTML = `<p class="text-green-400 font-bold">2-Step Verification is enabled.</p>`;
            mfaEnrollForm.style.display = 'none';
            mfaVerifyForm.style.display = 'none';
            // Clean up reCAPTCHA if it exists
            if (mfaRecaptchaManager) {
                mfaRecaptchaManager.cleanup();
                mfaRecaptchaManager = null;
            }
        } else {
            mfaStatus.innerHTML = `<p class="text-yellow-400 font-bold">2-Step Verification is not enabled.</p>`;
            mfaEnrollForm.style.display = 'block';
            mfaVerifyForm.style.display = 'none';

            // Setup reCAPTCHA for MFA with proper error handling
            await setupMfaRecaptcha();

            mfaSendCodeBtn.onclick = async () => {
                await handleMfaSendCode(user);
            };

            mfaVerifyBtn.onclick = async () => {
                await handleMfaVerifyCode(user);
            };
        }
    };

    /**
     * Setup reCAPTCHA for MFA with timeout and error handling
     * 
     * IMPROVEMENTS MADE:
     * - Uses RecaptchaManager instead of direct RecaptchaVerifier
     * - 8-second timeout prevents hanging during initialization  
     * - Graceful fallback when reCAPTCHA fails (shows warning, keeps MFA functional)
     * - Proper error callbacks for user feedback
     * - Non-blocking: MFA UI remains available even if reCAPTCHA fails
     * - Cleanup management to prevent memory leaks
     * 
     * This function ensures MFA UI remains functional even if reCAPTCHA fails
     */
    const setupMfaRecaptcha = async () => {
        try {
            console.log('[Dashboard:MFA] Setting up reCAPTCHA for MFA enrollment');
            
            // Clean up any existing reCAPTCHA manager
            if (mfaRecaptchaManager) {
                mfaRecaptchaManager.cleanup();
            }

            mfaRecaptchaManager = new RecaptchaManager();

            // Set up error handling callbacks
            mfaRecaptchaManager.onError((error) => {
                console.warn('[Dashboard:MFA] reCAPTCHA error:', error);
                showMfaRecaptchaFallback('reCAPTCHA verification failed. MFA enrollment may not work properly.');
            });

            mfaRecaptchaManager.onExpired(() => {
                console.warn('[Dashboard:MFA] reCAPTCHA expired');
                showMfaRecaptchaFallback('Security verification expired. Please try again.');
            });

            // Try to create verifier with 8-second timeout
            const verifier = await mfaRecaptchaManager.createVerifier(
                auth,
                'mfa-recaptcha-container',
                {
                    'size': 'invisible',
                    'callback': () => {
                        console.log('[Dashboard:MFA] reCAPTCHA solved');
                    },
                    'expired-callback': () => {
                        console.log('[Dashboard:MFA] reCAPTCHA expired in callback');
                    }
                },
                8000 // 8 second timeout
            );

            if (verifier) {
                console.log('[Dashboard:MFA] ✓ reCAPTCHA initialized successfully for MFA');
                hideMfaRecaptchaError();
            } else {
                console.warn('[Dashboard:MFA] reCAPTCHA not available for MFA');
                showMfaRecaptchaFallback('Security verification is temporarily unavailable. MFA enrollment may not work.');
            }

        } catch (error) {
            console.warn('[Dashboard:MFA] reCAPTCHA setup failed:', error.message);
            
            // Don't block the dashboard - just show a warning
            if (isRecaptchaError(error)) {
                showMfaRecaptchaFallback('Security verification is temporarily unavailable. MFA enrollment may not work.');
            } else {
                showMfaRecaptchaFallback('Unable to setup security verification for MFA enrollment.');
            }
        }
    };

    /**
     * Handle MFA code sending with improved error handling
     * 
     * FIXES APPLIED:
     * - Checks reCAPTCHA availability before attempting phone auth
     * - Provides clear user feedback when reCAPTCHA is unavailable
     * - Uses RecaptchaManager for proper error classification  
     * - Attempts reCAPTCHA reset on recoverable errors
     * - Fallback UI when reCAPTCHA cannot be recovered
     */
    const handleMfaSendCode = async (user) => {
        const phoneNumber = mfaPhoneNumberInput.value?.trim();
        
        if (!phoneNumber) {
            alert('Please enter a valid phone number.');
            return;
        }

        // Check if reCAPTCHA is available
        if (!mfaRecaptchaManager || !mfaRecaptchaManager.isReady()) {
            alert('Security verification is required for MFA but is currently unavailable. Please try again later.');
            return;
        }

        try {
            mfaSendCodeBtn.disabled = true;
            mfaSendCodeBtn.textContent = 'Sending...';
            
            confirmationResult = await linkWithPhoneNumber(
                user, 
                phoneNumber, 
                mfaRecaptchaManager.getVerifier()
            );
            
            mfaEnrollForm.style.display = 'none';
            mfaVerifyForm.style.display = 'block';
            alert('Verification code sent!');
            
        } catch (error) {
            console.error('[Dashboard:MFA] Error sending MFA code:', error);
            
            // Provide user-friendly error messages
            if (isRecaptchaError(error)) {
                const friendlyError = getFriendlyAuthError(error);
                alert(friendlyError.userMessage);
                
                // Try to reset reCAPTCHA
                if (mfaRecaptchaManager) {
                    try {
                        await mfaRecaptchaManager.reset();
                    } catch (resetError) {
                        console.warn('[Dashboard:MFA] Error resetting reCAPTCHA:', resetError);
                        showMfaRecaptchaFallback('Security verification needs to be reloaded. Please refresh the page.');
                    }
                }
            } else {
                alert(`Error: ${error.message}`);
            }
        } finally {
            mfaSendCodeBtn.disabled = false;
            mfaSendCodeBtn.textContent = 'Send Code';
        }
    };

    /**
     * Handle MFA code verification
     */
    const handleMfaVerifyCode = async (user) => {
        const code = mfaVerificationCodeInput.value?.trim();
        
        if (!code) {
            alert('Please enter the verification code.');
            return;
        }
        
        if (!confirmationResult) {
            alert('Please request a verification code first.');
            return;
        }

        try {
            mfaVerifyBtn.disabled = true;
            mfaVerifyBtn.textContent = 'Verifying...';
            
            await confirmationResult.confirm(code);
            alert('2-Step Verification enabled successfully!');
            
            // Refresh MFA setup to show new status
            await setupMfa(user);
            
        } catch (error) {
            console.error('[Dashboard:MFA] Error verifying MFA code:', error);
            const friendlyError = getFriendlyAuthError(error);
            alert(friendlyError.userMessage || `Error: ${error.message}`);
        } finally {
            mfaVerifyBtn.disabled = false;
            mfaVerifyBtn.textContent = 'Verify & Enable';
        }
    };

const showMfaRecaptchaFallback = (message) => {
    const container = document.getElementById('mfa-recaptcha-container');
    if (container) {
        // Remove any existing notice
        const existing = container.querySelector('.bg-yellow-900');
        if (existing) existing.remove();

        const noticeDiv = document.createElement('div');
        noticeDiv.className = 'bg-yellow-900 border border-yellow-600 text-yellow-200 px-3 py-2 rounded-md text-sm';
        noticeDiv.innerHTML = `<span class="font-medium">⚠️ Notice:</span> ${message}`;
        container.appendChild(noticeDiv);
    }
};

const hideMfaRecaptchaError = () => {
    const container = document.getElementById('mfa-recaptcha-container');
    if (container) {
        // Clear any error messages but keep the reCAPTCHA
        const errorDiv = container.querySelector('.bg-yellow-900');
        if (errorDiv) {
            errorDiv.remove();
        }
    }
};

// ... everything after (including hideMfaRecaptchaError, etc.) unchanged ...
    /**
     * Hide reCAPTCHA error message for MFA
     */
    const hideMfaRecaptchaError = () => {
        const container = document.getElementById('mfa-recaptcha-container');
        if (container) {
            // Clear any error messages but keep the reCAPTCHA
            const errorDiv = container.querySelector('.bg-yellow-900');
            if (errorDiv) {
                errorDiv.remove();
            }
        }
    };

    // Enhanced loading completion handler
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

    // Logout handler with error handling
    logoutButton.addEventListener('click', async (e) => {
        e.preventDefault();
        try {
            console.log('[Dashboard:Logout] Signing out user');
            await signOut(auth);
            console.log('[Dashboard:Logout] ✓ User signed out successfully');
        } catch (error) {
            const errorInfo = classifyError(error, 'Logout');
            console.error('[Dashboard:Logout] Error:', 'Error during logout', errorInfo);
            // Still try to redirect even if logout fails
            navigateToInternal('/login.html');
        }
    });

    // Set up authentication state monitoring with enhanced error handling
    console.log('[Dashboard:AuthSetup] Setting up authentication state monitoring');
    
    const authUnsubscribe = monitorAuthState(
        async (user, validToken) => {
            clearAuthError(); // Clear any previous auth errors
            
            if (user && validToken) {
                console.log('[Dashboard:AuthSetup] ✓ User authenticated successfully', {
                    uid: user.uid,
                    email: user.email,
                    emailVerified: user.emailVerified
                });

                // Set user email in UI
                if (userEmailEl) {
                    userEmailEl.textContent = user.email;
                }

                // Check if email is verified
                if (!user.emailVerified && emailVerificationNotice) {
                    emailVerificationNotice.classList.remove('hidden');
                    
                    // Set up resend verification handler
                    if (resendVerificationBtn) {
                        resendVerificationBtn.addEventListener('click', async () => {
                            try {
                                await sendEmailVerification(user);
                                alert('Verification email sent! Please check your inbox.');
                            } catch (error) {
                                console.error('Error sending verification email:', error);
                                alert('Failed to send verification email. Please try again later.');
                            }
                        });
                    }
                }

                // Validate user permissions for dashboard features
                const claimsResult = await validateUserClaims(['team-member']);
                const isTeamMember = claimsResult.success && claimsResult.claims.role === 'team-member';

                console.log('[Dashboard:AuthSetup] User role validation', {
                    isTeamMember,
                    role: claimsResult.claims?.role,
                    hasPermissions: claimsResult.success
                });

                // Show/hide admin features based on role
                if (isTeamMember) {
                    // Show admin cards
                    if (raceManagementCard) raceManagementCard.classList.remove('hidden');
                    if (qnaManagementCard) qnaManagementCard.classList.remove('hidden');
                    if (photoApprovalCard) photoApprovalCard.classList.remove('hidden');
                    if (jonnyPhotoApprovalCard) jonnyPhotoApprovalCard.classList.remove('hidden');
                    if (jonnyVideoManagementCard) jonnyVideoManagementCard.classList.remove('hidden');
                    if (invitationCodesCard) invitationCodesCard.classList.remove('hidden');
                    
                    // Load admin data with error handling
                    try {
                        await getRaceData();
                        await getQnaSubmissions();
                        await getUnapprovedPhotos(null, unapprovedPhotosList);
                        await getUnapprovedPhotos('jonny', jonnyUnapprovedPhotosList);
                        await getJonnyVideos();
                        await getInvitationCodes();
                    } catch (error) {
                        console.error('[Dashboard:AuthSetup] Error:', 'Error loading admin data', error);
                        showAuthError({
                            code: 'data-load-failed',
                            message: 'Failed to load dashboard data',
                            userMessage: 'Some dashboard features may not be available. Please refresh the page.',
                            requiresReauth: false,
                            retryable: true
                        });
                    }
                } else {
                    // Hide admin cards for non-team members
                    if (raceManagementCard) raceManagementCard.classList.add('hidden');
                    if (qnaManagementCard) qnaManagementCard.classList.add('hidden');
                    if (photoApprovalCard) photoApprovalCard.classList.add('hidden');
                    if (jonnyPhotoApprovalCard) jonnyPhotoApprovalCard.classList.add('hidden');
                    if (jonnyVideoManagementCard) jonnyVideoManagementCard.classList.add('hidden');
                }

                // Check if user needs invitation code prompt
                await handleInvitationCodePrompt(user);

                // Show driver notes for all authenticated users
                if (driverNotesCard) {
                    driverNotesCard.classList.remove('hidden');
                }

                // Set up MFA for verified users
                if (user.emailVerified && mfaCard) {
                    mfaCard.classList.remove('hidden');
                    await setupMfa(user);
                }

                // Hide loading and show content
                hideLoadingAndShowContent();

            } else {
                console.warn('[Dashboard:AuthSetup] User not authenticated, redirecting to login');
                window.location.href = 'login.html';
            }
        },
        (error) => {
            console.error('[Dashboard:AuthSetup] Error:', 'Authentication error', error);
            showAuthError(error);
            
            if (error.requiresReauth) {
                // Redirect to login for auth errors that require re-authentication
                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 3000);
            } else {
                // Show service error for other auth issues
                showServiceErrorFallback('auth', error.userMessage);
            }
        }
    );

    document.getElementById('year').textContent = new Date().getFullYear();

    // Clear the loading timeout since we successfully initialized
    clearLoadingTimeout();
    console.log('[Dashboard:Complete] ✓ Dashboard initialization completed successfully');

    // Cleanup reCAPTCHA resources on page unload
    window.addEventListener('beforeunload', () => {
        if (mfaRecaptchaManager) {
            console.log('[Dashboard:Cleanup] Cleaning up MFA reCAPTCHA resources');
            mfaRecaptchaManager.cleanup();
            mfaRecaptchaManager = null;
        }
    });

})(); // End of async function wrapper
