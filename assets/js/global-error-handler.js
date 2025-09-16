(function() {
    function displayError(message, source, lineno, colno, error) {
        // Prevent recursive errors
        if (document.getElementById('global-error-overlay')) {
            return;
        }

        const overlay = document.createElement('div');
        overlay.id = 'global-error-overlay';
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        overlay.style.color = 'white';
        overlay.style.zIndex = '999999';
        overlay.style.padding = '20px';
        overlay.style.fontFamily = 'monospace';
        overlay.style.fontSize = '14px';
        overlay.style.overflow = 'auto';

        const errorBox = document.createElement('div');
        errorBox.style.backgroundColor = '#330000';
        errorBox.style.border = '2px solid red';
        errorBox.style.borderRadius = '8px';
        errorBox.style.padding = '20px';
        errorBox.style.maxWidth = '800px';
        errorBox.style.margin = 'auto';

        let errorMessage = '<h2>A Critical Error Occurred</h2>';
        errorMessage += '<p><strong>Message:</strong> ' + message + '</p>';
        if (source) {
            errorMessage += '<p><strong>Source:</strong> ' + source + ':' + lineno + ':' + colno + '</p>';
        }
        if (error && error.stack) {
            errorMessage += '<p><strong>Stack Trace:</strong></p><pre>' + error.stack + '</pre>';
        }

        errorBox.innerHTML = errorMessage;
        overlay.appendChild(errorBox);
        document.body.appendChild(overlay);

        // Also log to console
        console.error("Global Error Handler Caught:", {
            message: message,
            source: source,
            lineno: lineno,
            colno: colno,
            error: error
        });
    }

    window.onerror = function(message, source, lineno, colno, error) {
        displayError(message, source, lineno, colno, error);
        return true; // Prevents the default browser error handling
    };

    window.addEventListener('unhandledrejection', function(event) {
        let reason = event.reason;
        if (reason instanceof Error) {
            displayError(reason.message, reason.fileName || 'Promise', reason.lineNumber, reason.columnNumber, reason);
        } else {
            displayError(String(reason), 'Promise', null, null, null);
        }
    });

    console.log('Global error handler initialized.');
})();
