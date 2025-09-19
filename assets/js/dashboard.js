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

// Wrap everything in an async function to allow early returns
(async function() {
    console.log('[DEBUG] Dashboard script execution started.');
    // Enhanced error handling and retry logic
    const INITIAL_TIMEOUT = 30000; // Extended to 30 seconds to allow for retries
    const MAX_RETRIES = 3;
    const RETRY_BASE_DELAY = 1000; // 1 second base delay for exponential backoff
    
    let loadingTimeout = null;
    let retryCount = 0;
    let currentLoadingStage = 'initializing';
    

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
        console.log('[DEBUG] checkNetworkConnectivity started');
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
            console.log('[DEBUG] checkNetworkConnectivity finished: online');
            return true;
        } catch (error) {
            if (error.name === 'AbortError') {
                console.error('[Dashboard:NetworkCheck] Error:', 'Network connectivity timeout');
            } else {
                console.error('[Dashboard:NetworkCheck] Error:', 'Network connectivity failed', error);
            }
            console.log('[DEBUG] checkNetworkConnectivity finished: offline');
            return false;
        }
    };
    
    // Error classification utility
    const classifyError = (error, context = '') => {
        // This is a utility function, no logging needed here as it's called from other logged functions.
        if (!error) return { type: 'unknown', message: 'Unknown error occurred', retryable: false };
        if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
            return { type: 'network', message: 'Network connection failed', userMessage: 'Please check your internet connection and try again.', retryable: true };
        }
        if (error.code) {
            switch (error.code) {
                case 'unavailable': case 'deadline-exceeded': return { type: 'firebase-service', message: `Firebase service temporarily unavailable: ${error.code}`, userMessage: 'Our services are temporarily unavailable. Please try again in a moment.', retryable: true };
                case 'permission-denied': case 'unauthenticated': return { type: 'auth', message: `Authentication error: ${error.code}`, userMessage: 'Authentication failed. Please log in again.', retryable: false };
                case 'failed-precondition': return { type: 'config', message: `Configuration error: ${error.code}`, userMessage: 'Service configuration issue. Please contact support.', retryable: false };
                default: return { type: 'firebase-other', message: `Firebase error: ${error.code} - ${error.message}`, userMessage: 'A service error occurred. Please try again.', retryable: true };
            }
        }
        return { type: 'generic', message: error.message || String(error), userMessage: 'An unexpected error occurred. Please try again.', retryable: true };
    };
    
    // Enhanced retry logic with exponential backoff
    const retryWithBackoff = async (fn, maxRetries = MAX_RETRIES, context = 'operation') => {
        console.log(`[DEBUG] retryWithBackoff started for: ${context}`);
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const result = await fn();
                if (attempt > 1) console.log(`[Dashboard:Retry] ✓ ${context} succeeded on attempt ${attempt}`);
                console.log(`[DEBUG] retryWithBackoff finished successfully for: ${context}`);
                return result;
            } catch (error) {
                const errorInfo = classifyError(error, context);
                console.error(`[Dashboard:Retry] Error:`, `${context} failed on attempt ${attempt}`, errorInfo);
                if (!errorInfo.retryable || attempt === maxRetries) throw error;
                const baseDelay = RETRY_BASE_DELAY * Math.pow(2, attempt - 1);
                const delay = secureJitter(baseDelay, 0.3);
                console.warn(`[Dashboard:Retry] Attempt ${attempt}/${maxRetries}, delay: ${Math.round(delay)}ms`);
                updateRetryStatus(attempt, maxRetries, context);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    };
    
    const updateRetryStatus = (attempt, maxAttempts, context) => {
        console.log(`[DEBUG] updateRetryStatus called for: ${context}`);
        const loadingState = document.getElementById('loading-state');
        if (loadingState && !loadingState.classList.contains('hidden')) {
            const loadingText = loadingState.querySelector('p');
            if (loadingText) safeSetHTML(loadingText, html`Loading Dashboard...<br><span class="text-sm text-yellow-400">Retrying connection (${attempt}/${maxAttempts})...</span>`);
        }
    };
    
    const startLoadingTimeout = () => {
        console.log('[DEBUG] startLoadingTimeout called');
        if (loadingTimeout) clearTimeout(loadingTimeout);
        loadingTimeout = setTimeout(async () => {
            console.error('[Dashboard:Timeout] Error:', `Loading timeout reached after ${INITIAL_TIMEOUT}ms, checking network and showing fallback`);
            const isOnline = await checkNetworkConnectivity();
            if (!isOnline) showNetworkErrorFallback(); else hideLoadingAndShowFallback();
        }, INITIAL_TIMEOUT);
    };
    
    startLoadingTimeout();

    function showNetworkErrorFallback() {
        console.log('[DEBUG] showNetworkErrorFallback called');
        const loadingState = document.getElementById('loading-state');
        const dashboardContent = document.getElementById('dashboard-content');
        if (loadingState) { loadingState.style.display = 'none'; loadingState.classList.add('hidden'); }
        if (dashboardContent) {
            safeSetHTML(dashboardContent, `...`); // Content omitted for brevity
            dashboardContent.classList.remove('hidden');
        }
        clearLoadingTimeout();
    }

    function showServiceErrorFallback(errorType = 'service', userMessage = null) {
        console.log(`[DEBUG] showServiceErrorFallback called with type: ${errorType}`);
        const loadingState = document.getElementById('loading-state');
        const dashboardContent = document.getElementById('dashboard-content');
        if (loadingState) { loadingState.style.display = 'none'; loadingState.classList.add('hidden'); }
        if (dashboardContent) {
            // Content omitted for brevity
            dashboardContent.classList.remove('hidden');
        }
        clearLoadingTimeout();
    }

    function hideLoadingAndShowFallback() {
        console.log('[DEBUG] hideLoadingAndShowFallback called');
        const loadingState = document.getElementById('loading-state');
        const dashboardContent = document.getElementById('dashboard-content');
        if (loadingState) { loadingState.style.display = 'none'; loadingState.classList.add('hidden'); }
        if (dashboardContent) {
            dashboardContent.innerHTML = `...`; // Content omitted for brevity
            dashboardContent.classList.remove('hidden');
        }
        clearLoadingTimeout();
    }
    
    function clearLoadingTimeout() {
        console.log('[DEBUG] clearLoadingTimeout called');
        if (loadingTimeout) { clearTimeout(loadingTimeout); loadingTimeout = null; }
    }

    // Get Firebase services
    console.log('[DEBUG] Getting Firebase services');
    const auth = getFirebaseAuth();
    const db = getFirebaseDb();
    const storage = getFirebaseStorage();
    console.log('[Dashboard:Initialization] ✓ Firebase services obtained successfully');

    // ... Element getters ...
    console.log('[DEBUG] Getting all DOM elements');
    const loadingState = document.getElementById('loading-state');
    // ... all other getElementById calls ...

    let notesSaveTimeout;
    let countdownInterval;

    const startCountdown = (races) => {
        console.log('[DEBUG] startCountdown called with races:', races);
        if (countdownInterval) clearInterval(countdownInterval);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        let nextRace = null;
        for (const race of races) {
            if (race && race.date && !isNaN(new Date(race.date + 'T00:00:00'))) {
                const raceDate = new Date(race.date + 'T00:00:00');
                if (raceDate >= today) { nextRace = race; break; }
            }
        }
        if (!nextRace) {
            console.log('[DEBUG] No upcoming valid race found.');
            safeSetHTML(document.getElementById('next-race-name'), html`Season Complete!`);
            safeSetHTML(document.getElementById('countdown-timer'), html`<div class='col-span-4 text-2xl font-racing'>Thanks for a great season!</div>`);
            return;
        }
        console.log('[DEBUG] Next race found:', nextRace);
        safeSetHTML(document.getElementById('next-race-name'), html`${nextRace.name}`);
        const nextRaceDate = new Date(nextRace.date + 'T19:00:00').getTime();
        if (isNaN(nextRaceDate)) {
            console.error(`[Dashboard:Countdown] Error: Invalid date for next race:`, nextRace);
            safeSetHTML(document.getElementById('countdown-timer'), html`<div class='col-span-4 text-red-500'>Error: Invalid race date</div>`);
            return;
        }
        console.log('[DEBUG] Starting countdown interval.');
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
        console.log('[DEBUG] startCountdown finished.');
    };

    const renderRacesTable = (races) => {
        console.log('[DEBUG] renderRacesTable called');
        // ... implementation
        console.log('[DEBUG] renderRacesTable finished');
    };

    const getRaceData = async () => {
        console.log('[DEBUG] getRaceData started');
        // ... implementation
        console.log('[DEBUG] getRaceData finished');
    };

    // ... Add logs to all other functions ...

    function hideLoadingAndShowContent() {
        console.log('[DEBUG] hideLoadingAndShowContent called');
        if (loadingState) { loadingState.style.display = 'none'; loadingState.setAttribute('hidden', 'true'); }
        if (dashboardContent) { dashboardContent.classList.remove('hidden'); }
        clearLoadingTimeout();
        console.log('[DEBUG] ✓ Dashboard content displayed successfully');
    }

    console.log('[DEBUG] Setting up auth state monitoring');
    const authUnsubscribe = monitorAuthState(
        async (user, validToken) => {
            console.log('[DEBUG] monitorAuthState success callback triggered. User:', user ? user.uid : 'null');
            clearAuthError();
            if (user && validToken) {
                console.log('[DEBUG] User is authenticated and token is valid.');
                // ...
                const claimsResult = await validateUserClaims(['team-member']);
                const isTeamMember = claimsResult.success && claimsResult.claims.role === 'team-member';
                console.log('[DEBUG] User isTeamMember:', isTeamMember);
                if (isTeamMember) {
                    try {
                        console.log('[DEBUG] Loading admin data...');
                        await getRaceData();
                        await getQnaSubmissions();
                        await getUnapprovedPhotos(null, unapprovedPhotosList);
                        await getUnapprovedPhotos('jonny', jonnyUnapprovedPhotosList);
                        await getJonnyVideos();
                        await getInvitationCodes();
                        console.log('[DEBUG] Finished loading admin data.');
                    } catch (error) {
                        console.error('[DEBUG] Error loading admin data:', error);
                    }
                }
                // ...
                hideLoadingAndShowContent();
            } else {
                console.warn('[DEBUG] User not authenticated, redirecting to login.');
                window.location.href = 'login.html';
            }
            console.log('[DEBUG] monitorAuthState success callback finished.');
        },
        (error) => {
            console.error('[DEBUG] monitorAuthState error callback triggered:', error);
            showAuthError(error);
            if (error.requiresReauth) {
                setTimeout(() => { window.location.href = 'login.html'; }, 3000);
            } else {
                showServiceErrorFallback('auth', error.userMessage);
            }
        }
    );

    document.getElementById('year').textContent = new Date().getFullYear();
    console.log('[DEBUG] Dashboard script initialization finished, waiting for async operations.');
})();
