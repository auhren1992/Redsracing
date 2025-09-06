import { getFirebaseConfig } from './firebase-config.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";

async function main() {
    const firebaseConfig = await getFirebaseConfig();
    const app = initializeApp(firebaseConfig);

    const feedbackForm = document.getElementById('feedbackForm');
    const feedbackStatus = document.getElementById('feedbackStatus');

    if (feedbackForm) {
        feedbackForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = feedbackForm.name.value;
            const email = feedbackForm.email.value;
            const message = feedbackForm.message.value;

            feedbackStatus.textContent = 'Sending...';
            feedbackStatus.classList.remove('text-red-500', 'text-green-500');

            try {
                const response = await fetch('/send_feedback_email', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ name, email, message }),
                });

                const result = await response.json();

                if (!response.ok) {
                    throw new Error(result.message || 'Something went wrong');
                }

                feedbackStatus.textContent = result.message || 'Feedback sent successfully!';
                feedbackStatus.classList.add('text-green-500');
                feedbackForm.reset();
            } catch (error) {
                console.error('Error sending feedback:', error);
                feedbackStatus.textContent = error.message || 'Failed to send feedback.';
                feedbackStatus.classList.add('text-red-500');
            }
        });
    }
}

main();
