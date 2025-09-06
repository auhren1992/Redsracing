import { getFirebaseConfig } from './firebase-config.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

async function main() {
    const firebaseConfig = await getFirebaseConfig();
    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);

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
}

main();
