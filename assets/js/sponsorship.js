import { getFirebaseConfig } from './firebase-config.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";

async function initializeSponsorshipForm() {
    const firebaseConfig = await getFirebaseConfig();
    if (!firebaseConfig.apiKey || firebaseConfig.apiKey.startsWith("YOUR_")) {
        console.warn("Firebase config not found, sponsorship form will not work.");
        return;
    }

    const app = initializeApp(firebaseConfig, "sponsorshipApp");
    const functions = getFunctions(app);
    const sendSponsorshipEmail = httpsCallable(functions, 'send_sponsorship_email');

    const sponsorshipForm = document.getElementById('sponsorshipForm');
    const statusDiv = document.getElementById('sponsorshipStatus');

    if (sponsorshipForm) {
        sponsorshipForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const formData = new FormData(sponsorshipForm);
            const data = Object.fromEntries(formData.entries());

            statusDiv.textContent = 'Sending inquiry...';
            statusDiv.className = 'p-4 rounded-md mb-4 bg-blue-900 text-blue-300';
            statusDiv.classList.remove('hidden');

            try {
                const result = await sendSponsorshipEmail(data);
                if (result.data.status === 'success') {
                    statusDiv.textContent = result.data.message;
                    statusDiv.className = 'p-4 rounded-md mb-4 bg-green-800 text-green-300';
                    sponsorshipForm.reset();
                } else {
                    throw new Error(result.data.message || 'An unknown error occurred.');
                }
            } catch (error) {
                console.error('Error sending sponsorship inquiry:', error);
                statusDiv.textContent = `Error: ${error.message}`;
                statusDiv.className = 'p-4 rounded-md mb-4 error-message';
            }
        });
    }
}

initializeSponsorshipForm();
