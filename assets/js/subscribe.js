import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig, "subscriber-app"); // Use a unique name to avoid conflicts
const functions = getFunctions(app, 'us-central1');
const addSubscriber = httpsCallable(functions, 'add_subscriber');

const subscribeForm = document.getElementById('subscribe-form');
if (subscribeForm) {
    const subscribeEmail = document.getElementById('subscribe-email');
    const subscribeMessage = document.getElementById('subscribe-message');

    subscribeForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = subscribeEmail.value;
        const submitBtn = subscribeForm.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        subscribeMessage.textContent = 'Subscribing...';
        subscribeMessage.style.color = '#e2e8f0';

        try {
            const result = await addSubscriber({ email });
            subscribeMessage.textContent = result.data.message;
            subscribeMessage.style.color = '#22c55e';
            subscribeForm.reset();
        } catch (error) {
            subscribeMessage.textContent = error.message;
            subscribeMessage.style.color = '#ef4444';
        } finally {
            submitBtn.disabled = false;
            setTimeout(() => { subscribeMessage.textContent = ''; }, 5000);
        }
    });
}
