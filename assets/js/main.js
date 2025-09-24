import './app.js';

// Firebase-dependent functionality
import { getFirebaseConfig } from './firebase-config.js';
import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { getFirestore, collection, query, onSnapshot, where, limit } from "firebase/firestore";

// Import invitation code utilities
import { captureInvitationCodeFromURL, applyPendingInvitationCode } from './invitation-codes.js';

async function initFirebase() {
    try {
        // Capture invitation code from URL as early as possible
        captureInvitationCodeFromURL();

        // Get Firebase config
        const firebaseConfig = await getFirebaseConfig();

        // Initialize Firebase
        const app = initializeApp(firebaseConfig);
        const auth = getAuth(app);
        const db = getFirestore(app);

        // UI Elements
        const authLink = document.getElementById('auth-link');
        const authLinkMobile = document.getElementById('auth-link-mobile');

        // Auth State Change
        onAuthStateChanged(auth, async user => {
            if (user) {
                if(authLink) authLink.textContent = 'Dashboard';
                if(authLink) authLink.href = 'dashboard.html';
                if(authLinkMobile) authLinkMobile.textContent = 'Dashboard';
                if(authLinkMobile) authLinkMobile.href = 'dashboard.html';
                
                // Apply pending invitation code if available
                try {
                    await applyPendingInvitationCode(user);
                } catch (error) {
                    console.warn('[Main] Failed to apply pending invitation code:', error);
                    // Don't block the auth flow for invitation code errors
                }
                
                // Check for first login achievement
                checkFirstLoginAchievement(user.uid);
            } else {
                if(authLink) authLink.textContent = 'DRIVER LOGIN';
                if(authLink) authLink.href = 'login.html';
                if(authLinkMobile) authLinkMobile.textContent = 'DRIVER LOGIN';
                if(authLinkMobile) authLinkMobile.href = 'login.html';
            }
        });

        // Check and award first login achievement
        async function checkFirstLoginAchievement(userId) {
            // Only run this check once per session to avoid repeated calls
            const sessionKey = `firstLoginCheck_${userId}`;
            if (sessionStorage.getItem(sessionKey)) return;
            
            try {
                const response = await fetch('/auto_award_achievement', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        userId: userId,
                        actionType: 'first_login'
                    })
                });
                
                if (response.ok) {
                    console.log('First login achievement checked successfully');
                } else if (response.status === 404) {
                    console.log('Achievement endpoint not available. This is expected if Cloud Functions are not deployed.');
                } else {
                    console.warn('Achievement check failed:', response.statusText);
                }
                
                sessionStorage.setItem(sessionKey, 'true');
            } catch (error) {
                if (error.message.includes('Failed to fetch') || error.name === 'TypeError') {
                    console.log('Achievement backend not available, skipping first login achievement check');
                } else {
                    console.error('Error checking first login achievement:', error);
                }
                sessionStorage.setItem(sessionKey, 'true'); // Mark as attempted to avoid retries
            }
        }


        // Subscribe Form Logic
        const subscribeForm = document.getElementById('subscribeForm');
        const subscribeStatus = document.getElementById('subscribeStatus');
        const emailInput = document.getElementById('emailInput');

        if (subscribeForm) {
            subscribeForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const email = emailInput.value;

                subscribeStatus.textContent = 'Subscribing...';
                subscribeStatus.classList.remove('text-red-500', 'text-green-500');

                try {
                    const response = await fetch('/add_subscriber', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ email }),
                    });

                    const result = await response.json();

                    if (!response.ok) {
                        throw new Error(result.message || 'Something went wrong');
                    }

                    subscribeStatus.textContent = result.message || 'Subscribed successfully!';
                    subscribeStatus.classList.add('text-green-500');
                    subscribeForm.reset();
                } catch (error) {
                    console.error('Error subscribing:', error);
                    subscribeStatus.textContent = error.message || 'Failed to subscribe.';
                    subscribeStatus.classList.add('text-red-500');
                }
            });
        }
    } catch (error) {
        console.error('Firebase initialization failed:', error);
        // Firebase functionality will not be available, but navigation still works
    }
}

// Initialize Firebase functionality
initFirebase();
