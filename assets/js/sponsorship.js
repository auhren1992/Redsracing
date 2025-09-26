import './app.js';

async function main() {
    const sponsorshipForm = document.getElementById('sponsorshipForm');
    const sponsorshipStatus = document.getElementById('sponsorshipStatus');

    if (sponsorshipForm) {
        sponsorshipForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const companyName = sponsorshipForm.companyName.value;
            const contactName = sponsorshipForm.contactName.value;
            const email = sponsorshipForm.email.value;
            const phone = sponsorshipForm.phone.value;
            const message = sponsorshipForm.message.value;

            sponsorshipStatus.textContent = 'Sending...';
            sponsorshipStatus.classList.remove('text-red-500', 'text-green-500');

            try {
                const response = await fetch('/send_sponsorship_email', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ company: companyName, name: contactName, email, phone, message }),
                });

                const result = await response.json();

                if (!response.ok) {
                    throw new Error(result.message || 'Something went wrong');
                }

                sponsorshipStatus.textContent = result.message || 'Inquiry sent successfully!';
                sponsorshipStatus.classList.add('text-green-500');
                sponsorshipForm.reset();
            } catch (error) {

                sponsorshipStatus.textContent = error.message || 'Failed to send inquiry.';
                sponsorshipStatus.classList.add('text-red-500');
            }
        });
    }
}

main();
