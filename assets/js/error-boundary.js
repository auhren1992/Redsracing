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
        container.innerHTML = `
            <div class="error-boundary-fallback bg-red-900/20 border border-red-500/50 rounded-lg p-6 text-center">
                <div class="text-6xl mb-4">⚠️</div>
                <h2 class="text-2xl font-bold text-red-400 mb-4">Something went wrong</h2>
                <p class="text-gray-300 mb-4">
                    We apologize for the inconvenience. An unexpected error has occurred.
                </p>
                <div class="space-x-4">
                    <button onclick="window.location.reload()" 
                            class="bg-blue-600 text-white font-bold py-2 px-4 rounded-md hover:bg-blue-500 transition">
                        Reload Page
                    </button>
                    <a href="index.html" 
                       class="bg-slate-600 text-white font-bold py-2 px-4 rounded-md hover:bg-slate-500 transition">
                        Go Home
                    </a>
                </div>
                ${errorInfo && process.env.NODE_ENV === 'development' ? `
                    <details class="mt-4 text-left text-sm">
                        <summary class="cursor-pointer text-gray-400">Error Details (Development)</summary>
                        <pre class="mt-2 p-2 bg-gray-800 rounded text-red-300 overflow-auto">
                            ${JSON.stringify(errorInfo, null, 2)}
                        </pre>
                    </details>
                ` : ''}
            </div>
        `;
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