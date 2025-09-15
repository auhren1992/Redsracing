/**
 * Error Boundary Component for Redsracing App
 * 
 * Provides React-like error boundary functionality for vanilla JavaScript
 * Catches unhandled errors and provides graceful fallback UI
 */

class ErrorBoundary {
    constructor(containerElement, fallbackRenderer = null) {
        this.container = containerElement;
        this.fallbackRenderer = fallbackRenderer || this.defaultFallbackRenderer;
        this.hasError = false;
        this.errorInfo = null;
        
        this.setupErrorHandlers();
    }

    setupErrorHandlers() {
        // Catch unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            console.error('[ErrorBoundary] Unhandled promise rejection:', event.reason);
            this.handleError(event.reason, 'unhandledrejection');
        });

        // Catch JavaScript errors
        window.addEventListener('error', (event) => {
            console.error('[ErrorBoundary] JavaScript error:', event.error);
            this.handleError(event.error, 'javascript');
        });
    }

    handleError(error, source = 'unknown') {
        this.hasError = true;
        this.errorInfo = {
            error,
            source,
            timestamp: new Date(),
            userAgent: navigator.userAgent,
            url: window.location.href
        };

        console.error('[ErrorBoundary] Error caught:', this.errorInfo);
        
        // Show fallback UI
        this.renderFallback();
        
        // Report error (can be extended to send to logging service)
        this.reportError();
    }

    renderFallback() {
        if (this.container && this.fallbackRenderer) {
            try {
                this.fallbackRenderer(this.container, this.errorInfo);
            } catch (fallbackError) {
                console.error('[ErrorBoundary] Error in fallback renderer:', fallbackError);
                this.defaultFallbackRenderer(this.container, this.errorInfo);
            }
        }
    }

    defaultFallbackRenderer(container, errorInfo) {
        try {
            // Clear container first
            container.textContent = '';

            // Wrapper
            const wrapper = document.createElement('div');
            wrapper.className = 'error-boundary-fallback bg-red-900/20 border border-red-500/50 rounded-lg p-6 text-center';

            // Icon
            const icon = document.createElement('div');
            icon.className = 'text-6xl mb-4';
            icon.textContent = '⚠️';

            // Title
            const title = document.createElement('h2');
            title.className = 'text-2xl font-bold text-red-400 mb-4';
            title.textContent = 'Something went wrong';

            // Message
            const msg = document.createElement('p');
            msg.className = 'text-gray-300 mb-4';
            msg.textContent = 'We apologize for the inconvenience. An unexpected error has occurred.';

            // Actions
            const actions = document.createElement('div');
            actions.className = 'space-x-4';

            const reloadBtn = document.createElement('button');
            reloadBtn.type = 'button';
            reloadBtn.className = 'bg-blue-600 text-white font-bold py-2 px-4 rounded-md hover:bg-blue-500 transition';
            reloadBtn.textContent = 'Reload Page';
            reloadBtn.addEventListener('click', () => window.location.reload());

            const homeLink = document.createElement('a');
            homeLink.href = 'index.html';
            homeLink.className = 'bg-slate-600 text-white font-bold py-2 px-4 rounded-md hover:bg-slate-500 transition';
            homeLink.textContent = 'Go Home';

            actions.append(reloadBtn, homeLink);

            // Append core elements
            const showDevDetails = ['localhost', '127.0.0.1'].includes(location.hostname);
            wrapper.append(icon, title, msg, actions);

            // Optional dev details (localhost only)
            if (showDevDetails && errorInfo) {
                const details = document.createElement('details');
                details.className = 'mt-4 text-left text-sm';

                const summary = document.createElement('summary');
                summary.className = 'cursor-pointer text-gray-400';
                summary.textContent = 'Error Details (Development)';

                const pre = document.createElement('pre');
                pre.className = 'mt-2 p-2 bg-gray-800 rounded text-red-300 overflow-auto';
                // Use textContent to avoid any HTML interpretation
                pre.textContent = typeof errorInfo === 'string' ? errorInfo : JSON.stringify(errorInfo, null, 2);

                details.append(summary, pre);
                wrapper.append(details);
            }

            container.appendChild(wrapper);
        } catch (e) {
            // As a last resort, set plain text to avoid innerHTML
            container.textContent = 'An unexpected error occurred.';
            console.error('[ErrorBoundary] Error rendering fallback UI:', e);
        }
    }

    reportError() {
        // Log error for analytics/monitoring
        console.error('[ErrorBoundary] Error Report:', {
            timestamp: this.errorInfo.timestamp,
            source: this.errorInfo.source,
            error: this.errorInfo.error?.message || String(this.errorInfo.error),
            stack: this.errorInfo.error?.stack,
            url: this.errorInfo.url,
            userAgent: this.errorInfo.userAgent
        });
        
        // Here you could send to an error reporting service
        // Example: Sentry, LogRocket, or custom analytics endpoint
    }

    reset() {
        this.hasError = false;
        this.errorInfo = null;
    }

    static wrap(elementId, fallbackRenderer = null) {
        const element = document.getElementById(elementId);
        if (!element) {
            console.warn(`[ErrorBoundary] Element with id '${elementId}' not found`);
            return null;
        }
        return new ErrorBoundary(element, fallbackRenderer);
    }
}

// Global error boundary for the entire application
let globalErrorBoundary = null;

// Initialize global error boundary when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const mainElement = document.querySelector('main') || document.body;
    globalErrorBoundary = new ErrorBoundary(mainElement);
});

export { ErrorBoundary, globalErrorBoundary };