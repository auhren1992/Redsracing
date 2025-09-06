async function main() {
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
}

main();
