// Firebase-dependent functionality
import { getFirebaseConfig } from './firebase-config.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, query, onSnapshot, where, limit } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

async function initFirebase() {
    try {
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
        onAuthStateChanged(auth, user => {
            if (user) {
                if(authLink) authLink.textContent = 'Dashboard';
                if(authLink) authLink.href = 'dashboard.html';
                if(authLinkMobile) authLinkMobile.textContent = 'Dashboard';
                if(authLinkMobile) authLinkMobile.href = 'dashboard.html';
                
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

        // Live Timing Banner
        const liveBanner = document.getElementById('live-banner');
        const liveTimingLink = document.getElementById('live-timing-link');
        const header = document.querySelector('header');
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if(liveBanner) {
            const qRaces = query(collection(db, "races"), where("date", "==", today.toISOString().split('T')[0]), limit(1));
            onSnapshot(qRaces, (snapshot) => {
                if (!snapshot.empty) {
                    const race = snapshot.docs[0].data();
                    if (race.liveTimingLink) {
                        liveTimingLink.href = race.liveTimingLink;
                        liveBanner.classList.remove('hidden');
                        if(header) {
                            header.style.top = liveBanner.offsetHeight + 'px';
                        }
                    }
                }
            });
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
