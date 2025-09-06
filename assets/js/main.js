import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, query, onSnapshot, where, limit } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getFirebaseConfig } from './firebase-config.js';

// This script will handle all common functionality across pages:
// - Navigation (mobile menu, desktop dropdowns)
// - Authentication state (updating login/dashboard links and showing/hiding forms)
// - Live timing banner visibility
// - Footer year

// --- Non-Firebase dependent UI logic ---
document.addEventListener('DOMContentLoaded', () => {
    // Mobile menu toggle
    const mobileMenuButton = document.getElementById('mobile-menu-button');
    const mobileMenu = document.getElementById('mobile-menu');
    if (mobileMenuButton && mobileMenu) {
        mobileMenuButton.addEventListener('click', () => {
            mobileMenu.classList.toggle('hidden');
        });
    }

    // Mobile menu accordion
    document.querySelectorAll('.mobile-accordion').forEach(button => {
        button.addEventListener('click', () => {
            const content = button.nextElementSibling;
            if (content) {
                content.classList.toggle('hidden');
            }
        });
    });

    // Desktop dropdowns
    document.querySelectorAll('.dropdown-toggle').forEach(button => {
        button.addEventListener('click', (event) => {
            event.stopPropagation();
            const dropdownMenu = button.nextElementSibling;
            if (!dropdownMenu) return;

            const isHidden = dropdownMenu.classList.contains('hidden');

            document.querySelectorAll('.dropdown-menu').forEach(menu => {
                if (menu !== dropdownMenu) {
                    menu.classList.add('hidden');
                }
            });

            if (isHidden) {
                dropdownMenu.classList.remove('hidden');
            } else {
                dropdownMenu.classList.add('hidden');
            }
        });
    });

    // Close dropdowns when clicking outside
    window.addEventListener('click', () => {
        document.querySelectorAll('.dropdown-menu').forEach(menu => {
            menu.classList.add('hidden');
        });
    });

    // Set footer year
    const yearSpan = document.getElementById('year');
    if (yearSpan) {
        yearSpan.textContent = new Date().getFullYear();
    }
});

// --- Firebase dependent logic ---
async function initializeFirebaseFeatures() {
    try {
        const firebaseConfig = await getFirebaseConfig();

        if (!firebaseConfig.apiKey || firebaseConfig.apiKey.startsWith("YOUR_")) {
            console.warn("Firebase config not found or is a placeholder. Skipping Firebase-dependent features.");
            const authLink = document.getElementById('auth-link');
            const authLinkMobile = document.getElementById('auth-link-mobile');
            if(authLink) authLink.style.display = 'none';
            if(authLinkMobile) authLinkMobile.style.display = 'none';
            return;
        }

        const app = initializeApp(firebaseConfig);
        const auth = getAuth(app);
        const db = getFirestore(app);

        // --- Auth State Change ---
        onAuthStateChanged(auth, user => {
            const authLink = document.getElementById('auth-link');
            const authLinkMobile = document.getElementById('auth-link-mobile');
            const uploadContainer = document.getElementById('upload-container');
            const qnaFormContainer = document.getElementById('qna-form-container');

            if (user) {
                // User is signed in
                if (authLink) authLink.textContent = 'Dashboard';
                if (authLink) authLink.href = 'dashboard.html';
                if (authLinkMobile) authLinkMobile.textContent = 'Dashboard';
                if (authLinkMobile) authLinkMobile.href = 'dashboard.html';
                if (uploadContainer) uploadContainer.style.display = 'block';
                if (qnaFormContainer) qnaFormContainer.style.display = 'block';
            } else {
                // User is signed out
                if (authLink) authLink.textContent = 'DRIVER LOGIN';
                if (authLink) authLink.href = 'login.html';
                if (authLinkMobile) authLinkMobile.textContent = 'DRIVER LOGIN';
                if (authLinkMobile) authLinkMobile.href = 'login.html';
                if (uploadContainer) uploadContainer.style.display = 'none';
                if (qnaFormContainer) qnaFormContainer.style.display = 'none';
            }
        });

        // --- Live Timing Banner ---
        const liveBanner = document.getElementById('live-banner');
        if (liveBanner) {
            const liveTimingLink = document.getElementById('live-timing-link');
            const header = document.querySelector('header');
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const qRaces = query(collection(db, "races"), where("date", "==", today.toISOString().split('T')[0]), limit(1));
            onSnapshot(qRaces, (snapshot) => {
                if (!snapshot.empty) {
                    const race = snapshot.docs[0].data();
                    if (race.liveTimingLink && liveTimingLink && header) {
                        liveTimingLink.href = race.liveTimingLink;
                        liveBanner.classList.remove('hidden');
                        header.style.top = liveBanner.offsetHeight + 'px';
                    }
                }
            });
        }

    } catch (error) {
        console.error("Error initializing Firebase main features:", error);
    }
}

initializeFirebaseFeatures();
