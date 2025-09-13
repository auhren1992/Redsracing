const showMfaRecaptchaFallback = (message) => {
    const container = document.getElementById('mfa-recaptcha-container');
    if (container) {
        container.innerHTML += `
            <div class="bg-yellow-900 border border-yellow-600 text-yellow-200 px-3 py-2 rounded-md text-sm">
                <span class="font-medium">⚠️ Notice:</span> ${message}
            </div>
        `;
    }
};