import './app.js';

// Fixed Dashboard Module - Resolves infinite loading and logout issues
import { getFirebaseAuth, getFirebaseDb, getFirebaseStorage } from './firebase-core.js';
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc, collection, getDocs, query, orderBy, addDoc, updateDoc, deleteDoc, where } from "firebase/firestore";
import { ref, deleteObject } from "firebase/storage";

// Import centralized authentication utilities
import {
    validateUserClaims,
    showAuthError,
    clearAuthError,
    monitorAuthState,
    getCurrentUser,
    safeSignOut
} from './auth-utils.js';

// Import sanitization utilities
import { html, safeSetHTML, setSafeText } from './sanitize.js';

// Import navigation helpers
import { navigateToInternal } from './navigation-helpers.js';

// Main IIFE to encapsulate dashboard logic
(async function() {
    
    // --- Start of Variable Declarations ---

    const INITIAL_TIMEOUT = 15000; // Reduced from 30s to 15s
    const MAX_RETRIES = 2; // Reduced from 3 to 2
    const RETRY_BASE_DELAY = 1000;

    let loadingTimeout = null;
    let countdownInterval;
    let authStateUnsubscribe = null;

    // DOM Element Lookups
    const loadingState = document.getElementById('loading-state');
    const dashboardContent = document.getElementById('dashboard-content');
    const userEmailEl = document.getElementById('user-email');
    const logoutButton = document.getElementById('logout-button');
    const driverNotesCard = document.getElementById('driver-notes-card');
    const raceManagementCard = document.getElementById('race-management-card');
    const driverNotesEl = document.getElementById('driver-notes');
    const notesStatusEl = document.getElementById('notes-status');
    const addRaceBtn = document.getElementById('add-race-btn');
    const qnaManagementCard = document.getElementById('qna-management-card');
    const qnaList = document.getElementById('qna-list');
    const photoApprovalCard = document.getElementById('photo-approval-card');
    const unapprovedPhotosList = document.getElementById('unapproved-photos-list');
    const jonnyPhotoApprovalCard = document.getElementById('jonny-photo-approval-card');
    const jonnyUnapprovedPhotosList = document.getElementById('jonny-unapproved-photos-list');
    const jonnyVideoManagementCard = document.getElementById('jonny-video-management-card');
    const jonnyVideosList = document.getElementById('jonny-videos-list');
    const addVideoForm = document.getElementById('add-video-form');
    const invitationCodesCard = document.getElementById('invitation-codes-card');
    const invitationCodesTableBody = document.getElementById('invitation-codes-table-body');

    // Firebase Services
    const auth = getFirebaseAuth();
    const db = getFirebaseDb();
    const storage = getFirebaseStorage();

    // Track initialization state
    let isInitialized = false;
    let isDestroyed = false;
    let isProcessingAuth = false; // Guard against re-entrant auth calls

    // --- Start of Function Declarations ---

    function startLoadingTimeout() {
        if (loadingTimeout) clearTimeout(loadingTimeout);
        loadingTimeout = setTimeout(async () => {
            if (isDestroyed) return;
            


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
        if (isDestroyed) return;
        

        if (loadingState) {
            loadingState.style.display = 'none';
            loadingState.setAttribute('hidden', 'true');
            loadingState.classList.add('hidden');
        }
        if (dashboardContent) {
            dashboardContent.classList.remove('hidden');
            dashboardContent.style.display = 'block';
        }
        clearLoadingTimeout();

    }

    function hideLoadingAndShowFallback() {
        if (isDestroyed) return;
        

        
        if (loadingState) {
            loadingState.style.display = 'none';
            loadingState.classList.add('hidden');
        }
        
        if (dashboardContent) {
            dashboardContent.innerHTML = `
                <div class="text-center py-20">
                    <h1 class="text-5xl font-racing uppercase mb-2">Driver <span class="neon-yellow">Dashboard</span></h1>
                    <div class="text-yellow-400 mb-6">
                        <div class="text-6xl mb-4">⚠️</div>
                        <h2 class="text-2xl font-bold">Dashboard Temporarily Unavailable</h2>
                        <p class="mt-2">We're unable to load your dashboard right now.</p>
                        <p class="text-sm text-slate-400 mt-2">This could be a temporary connectivity or service issue.</p>
                    </div>
                    <div class="space-x-4">
                        <button onclick="window.location.reload()" class="bg-blue-600 text-white font-bold py-2 px-4 rounded-md hover:bg-blue-500 transition">Try Again</button>
                        <a href="index.html" class="bg-slate-600 text-white font-bold py-2 px-4 rounded-md hover:bg-slate-500 transition">Go Home</a>
                    </div>
                </div>
            `;
            dashboardContent.classList.remove('hidden');
            dashboardContent.style.display = 'block';
        }
        
        clearLoadingTimeout();
    }

    function showNetworkErrorFallback() {
        if (isDestroyed) return;
        

        
        if (loadingState) {
            loadingState.style.display = 'none';
            loadingState.classList.add('hidden');
        }
        
        if (dashboardContent) {
            dashboardContent.innerHTML = `
                <div class="text-center py-20">
                    <h1 class="text-5xl font-racing uppercase mb-2">Driver <span class="neon-yellow">Dashboard</span></h1>
                    <div class="text-red-400 mb-6">
                        <div class="text-6xl mb-4">🌐</div>
                        <h2 class="text-2xl font-bold">Network Connection Issue</h2>
                        <p class="mt-2">Unable to connect to our servers.</p>
                        <p class="text-sm text-slate-400 mt-2">Please check your internet connection and try again.</p>
                    </div>
                    <div class="space-x-4">
                        <button onclick="window.location.reload()" class="bg-blue-600 text-white font-bold py-2 px-4 rounded-md hover:bg-blue-500 transition">Try Again</button>
                        <a href="index.html" class="bg-slate-600 text-white font-bold py-2 px-4 rounded-md hover:bg-slate-500 transition">Go Home</a>
                    </div>
                </div>
            `;
            dashboardContent.classList.remove('hidden');
            dashboardContent.style.display = 'block';
        }
        
        clearLoadingTimeout();
    }

    async function checkNetworkConnectivity() {
        try {
            if (typeof navigator !== 'undefined' && navigator.onLine === false) {
                return false;
            }
            
            const response = await fetch('https://www.google.com/favicon.ico', {
                method: 'HEAD',
                mode: 'no-cors',
                cache: 'no-store',
                signal: AbortSignal.timeout ? AbortSignal.timeout(5000) : undefined
            });
            return true;
        } catch (error) {

            return false;
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

    function renderRacesTable(races) {
        const tableBody = document.getElementById('races-table-body');
        if (!tableBody) return;
        
        tableBody.innerHTML = '';
        races.forEach(race => {
            const row = document.createElement('tr');
            row.className = 'border-b border-slate-700 hover:bg-slate-800';
            
            const dateStr = race.date ? new Date(race.date).toLocaleDateString() : 'TBD';
            const raceName = race.name || 'Unnamed Race';
            const raceType = race.type === 'specialEvent' ? race.special || 'Special Event' : `Race ${race.race || '?'}`;
            
            safeSetHTML(row, html`
                <td class="p-2">${dateStr}</td>
                <td class="p-2">${raceName} - ${raceType}</td>
                <td class="p-2">
                    <button class="edit-race-btn bg-blue-600 text-white px-2 py-1 rounded text-xs hover:bg-blue-500 transition mr-1" data-id="${race.id}">Edit</button>
                    <button class="delete-race-btn bg-red-600 text-white px-2 py-1 rounded text-xs hover:bg-red-500 transition" data-id="${race.id}">Delete</button>
                </td>
            `);
            
            tableBody.appendChild(row);
        });
        
        // Re-attach event listeners
        document.querySelectorAll('.edit-race-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const race = races.find(r => r.id === btn.dataset.id);
                if (race) openRaceModal(race);
            });
        });
        
        document.querySelectorAll('.delete-race-btn').forEach(btn => {
            btn.addEventListener('click', () => deleteRace(btn.dataset.id));
        });
    }

    async function getRaceData() {
        if (isDestroyed) return;
        
        try {
            const racesCol = collection(db, "races");
            const q = query(racesCol, orderBy("date", "asc"));
            const raceSnapshot = await getDocs(q);
            const raceList = raceSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            renderRacesTable(raceList);
            startCountdown(raceList);
        } catch (error) {
            if (raceManagementCard) {
                safeSetHTML(raceManagementCard, html`<div class="p-4 text-red-400">Error loading race data.</div>`);
            }
        }
    }

    function openRaceModal(race = null) {
        // Placeholder - implement race modal functionality

    }

    function deleteRace(raceId) {
        if (confirm('Are you sure you want to delete this race?')) {
            // Placeholder - implement race deletion

        }
    }

    async function loadQnASubmissions() {
        if (isDestroyed) return;

        try {
            const qnaCol = collection(db, "qna_submissions");
            const q = query(qnaCol, where("status", "==", "submitted"));
            const qnaSnapshot = await getDocs(q);
            const qnaSubmissions = qnaSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            if (qnaList) {
                qnaList.innerHTML = '';
                if (qnaSubmissions.length > 0) {
                    qnaManagementCard.style.display = 'block';
                    qnaSubmissions.forEach(submission => {
                        const qnaElement = document.createElement('div');
                        qnaElement.className = 'p-4 bg-slate-800 rounded-lg';
                        safeSetHTML(qnaElement, html`
                            <p class="text-white">${submission.question}</p>
                            <button class="text-neon-yellow mt-2" data-id="${submission.id}">Answer</button>
                        `);
                        qnaList.appendChild(qnaElement);
                    });
                }
            }
        } catch (error) {
            if (qnaManagementCard) {
                safeSetHTML(qnaManagementCard, html`<div class="p-4 text-red-400">Error loading Q&A submissions.</div>`);
            }
        }
    }

    async function loadPhotoApprovals() {
        if (isDestroyed) return;

        try {
            const photosCol = collection(db, "gallery_images");
            const q = query(photosCol, where("approved", "==", false));
            const photoSnapshot = await getDocs(q);
            const unapprovedPhotos = photoSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            if (unapprovedPhotosList) {
                unapprovedPhotosList.innerHTML = '';
                if (unapprovedPhotos.length > 0) {
                    photoApprovalCard.style.display = 'block';
                    unapprovedPhotos.forEach(photo => {
                        const photoElement = document.createElement('div');
                        photoElement.className = 'p-4 bg-slate-800 rounded-lg flex items-center justify-between';
                        safeSetHTML(photoElement, html`
                            <div>
                                <img src="${photo.url}" class="w-16 h-16 object-cover rounded-md mr-4">
                                <p class="text-white">${photo.title}</p>
                            </div>
                            <div>
                                <button class="bg-green-600 text-white px-2 py-1 rounded text-xs hover:bg-green-500 transition mr-1" data-id="${photo.id}">Approve</button>
                                <button class="bg-red-600 text-white px-2 py-1 rounded text-xs hover:bg-red-500 transition" data-id="${photo.id}">Reject</button>
                            </div>
                        `);
                        unapprovedPhotosList.appendChild(photoElement);
                    });
                }
            }
        } catch (error) {
            if (photoApprovalCard) {
                safeSetHTML(photoApprovalCard, html`<div class="p-4 text-red-400">Error loading photo approvals.</div>`);
            }
        }
    }

    async function loadJonnyPhotoApprovals() {
        if (isDestroyed) return;

        try {
            const photosCol = collection(db, "jonny_gallery_images");
            const q = query(photosCol, where("approved", "==", false));
            const photoSnapshot = await getDocs(q);
            const unapprovedPhotos = photoSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            if (jonnyUnapprovedPhotosList) {
                jonnyUnapprovedPhotosList.innerHTML = '';
                if (unapprovedPhotos.length > 0) {
                    jonnyPhotoApprovalCard.style.display = 'block';
                    unapprovedPhotos.forEach(photo => {
                        const photoElement = document.createElement('div');
                        photoElement.className = 'p-4 bg-slate-800 rounded-lg flex items-center justify-between';
                        safeSetHTML(photoElement, html`
                            <div>
                                <img src="${photo.url}" class="w-16 h-16 object-cover rounded-md mr-4">
                                <p class="text-white">${photo.title}</p>
                            </div>
                            <div>
                                <button class="bg-green-600 text-white px-2 py-1 rounded text-xs hover:bg-green-500 transition mr-1" data-id="${photo.id}">Approve</button>
                                <button class="bg-red-600 text-white px-2 py-1 rounded text-xs hover:bg-red-500 transition" data-id="${photo.id}">Reject</button>
                            </div>
                        `);
                        jonnyUnapprovedPhotosList.appendChild(photoElement);
                    });
                }
            }
        } catch (error) {
            if (jonnyPhotoApprovalCard) {
                safeSetHTML(jonnyPhotoApprovalCard, html`<div class="p-4 text-red-400">Error loading Jonny's photo approvals.</div>`);
            }
        }
    }

    async function loadJonnyVideos() {
        if (isDestroyed) return;

        try {
            const videosCol = collection(db, "jonny_videos");
            const q = query(videosCol, orderBy("timestamp", "desc"));
            const videoSnapshot = await getDocs(q);
            const videos = videoSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            if (jonnyVideosList) {
                jonnyVideosList.innerHTML = '';
                if (videos.length > 0) {
                    jonnyVideoManagementCard.style.display = 'block';
                    videos.forEach(video => {
                        const videoElement = document.createElement('div');
                        videoElement.className = 'p-4 bg-slate-800 rounded-lg flex items-center justify-between';
                        safeSetHTML(videoElement, html`
                            <div>
                                <p class="text-white">${video.title}</p>
                                <a href="${video.url}" target="_blank" class="text-neon-yellow text-sm">Watch</a>
                            </div>
                            <button class="bg-red-600 text-white px-2 py-1 rounded text-xs hover:bg-red-500 transition" data-id="${video.id}">Delete</button>
                        `);
                        jonnyVideosList.appendChild(videoElement);
                    });
                }
            }
        } catch (error) {
            if (jonnyVideoManagementCard) {
                safeSetHTML(jonnyVideoManagementCard, html`<div class="p-4 text-red-400">Error loading Jonny's videos.</div>`);
            }
        }
    }

    if (addVideoForm) {
        addVideoForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const url = document.getElementById('video-url').value;
            const title = document.getElementById('video-title').value;

            if (url && title) {
                try {
                    await addDoc(collection(db, 'jonny_videos'), {
                        url,
                        title,
                        timestamp: new Date()
                    });
                    addVideoForm.reset();
                    loadJonnyVideos();
                } catch (error) {

                }
            }
        });
    }

    async function loadInvitationCodes() {
        if (isDestroyed) return;

        try {
            const codesCol = collection(db, "invitation_codes");
            const codeSnapshot = await getDocs(codesCol);
            const codes = codeSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            if (invitationCodesTableBody) {
                invitationCodesTableBody.innerHTML = '';
                if (codes.length > 0) {
                    invitationCodesCard.style.display = 'block';
                    codes.forEach(code => {
                        const row = document.createElement('tr');
                        row.className = 'border-b border-slate-700';
                        safeSetHTML(row, html`
                            <td class="p-2">${code.id}</td>
                            <td class="p-2">${code.role}</td>
                            <td class="p-2">${code.status}</td>
                            <td class="p-2">${code.usedBy || 'N/A'}</td>
                            <td class="p-2">${code.usedAt ? new Date(code.usedAt.seconds * 1000).toLocaleDateString() : 'N/A'}</td>
                            <td class="p-2">${new Date(code.expires.seconds * 1000).toLocaleDateString()}</td>
                        `);
                        invitationCodesTableBody.appendChild(row);
                    });
                }
            }
        } catch (error) {
            if (invitationCodesCard) {
                safeSetHTML(invitationCodesCard, html`<div class="p-4 text-red-400">Error loading invitation codes.</div>`);
            }
        }
    }

    // Enhanced logout handler
    async function handleLogout() {
        if (isDestroyed) return;
        

        
        try {
            // Disable the logout button to prevent multiple clicks
            if (logoutButton) {
                logoutButton.disabled = true;
                logoutButton.textContent = 'Signing out...';
            }
            
            // Clean up any ongoing operations
            cleanup();
            
            // Attempt safe sign out
            const success = await safeSignOut();
            
            if (success) {

                // Short delay before redirect to ensure cleanup
                setTimeout(() => {
                    navigateToInternal('/login.html');
                }, 100);
            } else {

                // Even if logout fails, redirect to login
                navigateToInternal('/login.html');
            }
            
        } catch (error) {

            // Always redirect to login even if there's an error
            navigateToInternal('/login.html');
        }
    }

    // Cleanup function to prevent memory leaks
    function cleanup() {

        isDestroyed = true;
        
        // Clear timers
        clearLoadingTimeout();
        if (countdownInterval) {
            clearInterval(countdownInterval);
            countdownInterval = null;
        }
        
        // Unsubscribe from auth state changes
        if (authStateUnsubscribe) {
            authStateUnsubscribe();
            authStateUnsubscribe = null;
        }
        

    }

    // --- Start of Main Execution Logic ---

    // Prevent multiple initializations
    if (isInitialized) {

        return;
    }
    

    
    // Check if Firebase services are available
    if (!auth || !db) {

        hideLoadingAndShowFallback();
        return;
    }

    // Start loading timeout immediately
    startLoadingTimeout();

    // Setup logout button handler
    if (logoutButton) {
        logoutButton.addEventListener('click', (e) => {
            e.preventDefault();
            handleLogout();
        });

    } else {

    }

    // Setup auth state monitoring
    try {
        authStateUnsubscribe = monitorAuthState(
            async (user, validToken) => {

                if (isDestroyed || isProcessingAuth) {
                    if (isProcessingAuth)
                    return;
                }
                
                isProcessingAuth = true;


                try {
                    clearAuthError();
                    
                    if (user && validToken) {


                        // Update UI with user info
                        if (userEmailEl) {
                            setSafeText(userEmailEl, user.email);
                        }
                        
                        try {

                            const claimsResult = await validateUserClaims(['team-member']);
                            const isTeamMember = claimsResult.success && claimsResult.claims.role === 'team-member';



                            const dataLoadingPromises = [];
                            if (isTeamMember) {
                                if (raceManagementCard) {
                                    raceManagementCard.style.display = 'block';
                                }
                                dataLoadingPromises.push(getRaceData());
                                dataLoadingPromises.push(loadQnASubmissions());
                                dataLoadingPromises.push(loadPhotoApprovals());
                                dataLoadingPromises.push(loadJonnyPhotoApprovals());
                                dataLoadingPromises.push(loadJonnyVideos());
                                dataLoadingPromises.push(loadInvitationCodes());
                            }
                            
                            if (driverNotesCard) {
                                driverNotesCard.classList.remove('hidden');
                            }

                            // Load all data concurrently and don't let one failure block others.
                            await Promise.allSettled(dataLoadingPromises);

                            hideLoadingAndShowContent();


                        } catch (error) {

                            showAuthError({
                                code: 'dashboard-data-load-failed',
                                message: 'Failed to load dashboard data',
                                userMessage: 'Unable to load dashboard information. Please try refreshing the page.',
                                requiresReauth: false,
                                retryable: true
                            });
                            hideLoadingAndShowFallback();
                        }
                    } else {

                        cleanup();
                        navigateToInternal('/login.html');
                    }
                } finally {
                    isProcessingAuth = false;

                }
            },
            (error) => {
                if (isDestroyed) return;
                

                showAuthError(error);
                
                if (error.requiresReauth) {
                    // Redirect to login after showing error briefly
                    setTimeout(() => {
                        cleanup();
                        navigateToInternal('/login.html');
                    }, 2000);
                } else {
                    // Show fallback for non-auth errors
                    hideLoadingAndShowFallback();
                }
            }
        );
        
    } catch (error) {

        hideLoadingAndShowFallback();
        return;
    }

    // Event listeners for other functionality
    if (addRaceBtn) {
        addRaceBtn.addEventListener('click', () => openRaceModal());
    }

    // Set footer year
    const yearEl = document.getElementById('year');
    if (yearEl) {
        setSafeText(yearEl, new Date().getFullYear().toString());
    }

    // Handle page unload cleanup
    window.addEventListener('beforeunload', cleanup);
    window.addEventListener('unload', cleanup);
    
    // Handle visibility change (page becomes hidden)
    if (typeof document.visibilityState !== 'undefined') {
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                // Page is now hidden, could pause some operations

            } else if (isDestroyed) {
                // Page became visible but we're destroyed, reload

                window.location.reload();
            }
        });
    }

    isInitialized = true;


})();
