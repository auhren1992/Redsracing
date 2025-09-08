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
            } else {
                if(authLink) authLink.textContent = 'DRIVER LOGIN';
                if(authLink) authLink.href = 'login.html';
                if(authLinkMobile) authLinkMobile.textContent = 'DRIVER LOGIN';
                if(authLinkMobile) authLinkMobile.href = 'login.html';
            }
        });

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
                    const response = await fetch('/handleAddSubscriber', {
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
