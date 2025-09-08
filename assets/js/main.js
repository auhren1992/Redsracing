import { getFirebaseConfig } from './firebase-config.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, query, onSnapshot, where, limit } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

async function main() {
    // Get Firebase config
    const firebaseConfig = await getFirebaseConfig();

    // Initialize Firebase
    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const db = getFirestore(app);


    document.addEventListener('DOMContentLoaded', () => {
        // Mobile menu toggle
        const mobileMenuButton = document.getElementById('mobile-menu-button');
        if(mobileMenuButton) {
            mobileMenuButton.addEventListener('click', () => {
                document.getElementById('mobile-menu').classList.toggle('hidden');
            });
        }

        // Mobile menu accordion
        document.querySelectorAll('.mobile-accordion').forEach(button => {
            button.addEventListener('click', () => {
                const content = button.nextElementSibling;
                content.classList.toggle('hidden');
            });
        });

        // Desktop dropdowns
        document.querySelectorAll('.dropdown-toggle').forEach(button => {
            button.addEventListener('click', (event) => {
                event.stopPropagation();
                const dropdownMenu = button.nextElementSibling;
                const isHidden = dropdownMenu.classList.contains('hidden');

                // Close all other dropdowns
                document.querySelectorAll('.dropdown-menu').forEach(menu => {
                    menu.classList.add('hidden');
                });

                // Toggle the current dropdown
                if (isHidden) {
                    dropdownMenu.classList.remove('hidden');
                }
            });
        });

        // Close dropdowns when clicking outside
        window.addEventListener('click', () => {
            document.querySelectorAll('.dropdown-menu').forEach(menu => {
                menu.classList.add('hidden');
            });
        });

        const yearEl = document.getElementById('year');
        if (yearEl) {
            yearEl.textContent = new Date().getFullYear();
        }

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

        // Subscribe Form Logic - handle both form variations
        const subscribeForm = document.getElementById('subscribeForm') || document.getElementById('subscribe-form');
        const subscribeStatus = document.getElementById('subscribeStatus') || document.getElementById('subscribe-message');
        const emailInput = document.getElementById('emailInput') || document.getElementById('subscribe-email');

        if (subscribeForm && subscribeStatus && emailInput) {
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
    });
}

main();
