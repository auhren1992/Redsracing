import { getFirebaseConfig } from './firebase-config.js';

document.addEventListener('DOMContentLoaded', () => {
    const feedbackForm = document.getElementById('feedbackForm');
    if (feedbackForm) {
        feedbackForm.addEventListener('submit', async (event) => {
            event.preventDefault();

            const name = document.getElementById('name').value;
            const email = document.getElementById('email').value;
            const message = document.getElementById('message').value;
            const statusDiv = document.getElementById('feedbackStatus');
            statusDiv.textContent = 'Sending feedback...';

            try {
                const firebaseConfig = await getFirebaseConfig();
                const response = await fetch(`https://us-central1-${firebaseConfig.projectId}.cloudfunctions.net/send_feedback_email`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ name, email, message }),
                });

                const responseText = await response.text();
                if (response.ok) {
                    statusDiv.textContent = 'Feedback sent successfully! Thank you.';
                    statusDiv.style.color = 'green';
                    feedbackForm.reset();
                } else {
                    statusDiv.textContent = `Error: ${responseText}`;
                    statusDiv.style.color = 'red';
                }
            } catch (error) {
                console.error('Error sending feedback:', error);
                statusDiv.textContent = 'An unexpected error occurred. Please try again.';
                statusDiv.style.color = 'red';
            }
        });
    }
});
