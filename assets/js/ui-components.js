/**
 * Shared UI Components for Redsracing App
 * 
 * Provides consistent loading, empty state, and error state components
 */

import { safeSetHTML, createSafeElement } from './sanitize.js';

/**
 * Loading Component
 */
class LoadingComponent {
    constructor(options = {}) {
        this.options = {
            size: 'large', // 'small', 'medium', 'large'
            message: 'Loading...',
            showSpinner: true,
            className: '',
            timeout: 30000, // 30 seconds default timeout
            onTimeout: null,
            ...options
        };
        
        this.timeoutId = null;
        this.element = null;
    }

    create() {
        const sizeClasses = {
            small: 'h-8 w-8',
            medium: 'h-12 w-12', 
            large: 'h-16 w-16'
        };

        const spinnerSize = sizeClasses[this.options.size] || sizeClasses.large;
        
        this.element = createSafeElement('div', {
            className: `loading-component flex flex-col items-center justify-center text-center py-8 ${this.options.className}`,
            innerHTML: `
                ${this.options.showSpinner ? `
                    <div class="animate-spin rounded-full ${spinnerSize} border-t-2 border-b-2 border-neon-yellow mb-4"></div>
                ` : ''}
                <p class="text-lg font-racing uppercase tracking-wider text-white">${this.options.message}</p>
                <div class="loading-progress-bar mt-4 w-64 bg-gray-700 rounded-full h-2">
                    <div class="loading-progress bg-neon-yellow h-2 rounded-full w-0 transition-all duration-1000"></div>
                </div>
            `
        });

        // Start timeout if specified
        if (this.options.timeout > 0) {
            this.startTimeout();
        }

        // Animate progress bar
        this.animateProgress();

        return this.element;
    }

    startTimeout() {
        this.timeoutId = setTimeout(() => {
            console.warn('[LoadingComponent] Loading timeout reached');
            if (this.options.onTimeout) {
                this.options.onTimeout();
            } else {
                this.showTimeoutError();
            }
        }, this.options.timeout);
    }

    showTimeoutError() {
        if (this.element) {
            safeSetHTML(this.element, `
                <div class="text-center py-8">
                    <div class="text-4xl mb-4">⏱️</div>
                    <h3 class="text-xl font-bold text-yellow-400 mb-2">Loading Timeout</h3>
                    <p class="text-gray-300 mb-4">This is taking longer than expected.</p>
                    <div class="space-x-4">
                        <button onclick="window.location.reload()" 
                                class="bg-blue-600 text-white font-bold py-2 px-4 rounded-md hover:bg-blue-500 transition">
                            Try Again
                        </button>
                    </div>
                </div>
            `);
        }
    }

    animateProgress() {
        if (!this.element) return;
        
        const progressBar = this.element.querySelector('.loading-progress');
        if (!progressBar) return;

        let progress = 0;
        const interval = setInterval(() => {
            progress += Math.random() * 20;
            if (progress >= 90) {
                progress = 90; // Stop at 90% until actually loaded
                clearInterval(interval);
            }
            progressBar.style.width = `${progress}%`;
        }, 500);

        // Store interval for cleanup
        this.progressInterval = interval;
    }

    complete() {
        if (this.element) {
            const progressBar = this.element.querySelector('.loading-progress');
            if (progressBar) {
                progressBar.style.width = '100%';
            }
        }
        this.cleanup();
    }

    cleanup() {
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = null;
        }
        if (this.progressInterval) {
            clearInterval(this.progressInterval);
            this.progressInterval = null;
        }
    }

    static create(container, options = {}) {
        const loader = new LoadingComponent(options);
        const element = loader.create();
        if (container) {
            container.innerHTML = '';
            container.appendChild(element);
        }
        return loader;
    }
}

/**
 * Empty State Component
 */
class EmptyStateComponent {
    static create(container, options = {}) {
        const defaults = {
            icon: '📭',
            title: 'No data found',
            message: 'There\'s nothing here yet.',
            actionText: null,
            actionHref: null,
            onAction: null,
            className: ''
        };

        const opts = { ...defaults, ...options };
        
        const actionButton = opts.actionText ? `
            <button ${opts.onAction ? 'data-action="true"' : ''} 
                    ${opts.actionHref ? `onclick="window.location.href='${opts.actionHref}'"` : ''} 
                    class="bg-blue-600 text-white font-bold py-2 px-4 rounded-md hover:bg-blue-500 transition">
                ${opts.actionText}
            </button>
        ` : '';

        const element = createSafeElement('div', {
            className: `empty-state-component text-center py-12 ${opts.className}`,
            innerHTML: `
                <div class="text-6xl mb-4">${opts.icon}</div>
                <h3 class="text-2xl font-bold text-white mb-2">${opts.title}</h3>
                <p class="text-gray-400 mb-6">${opts.message}</p>
                ${actionButton}
            `
        });

        // Attach action handler if provided
        if (opts.actionText && opts.onAction) {
            const button = element.querySelector('[data-action="true"]');
            if (button) {
                button.addEventListener('click', opts.onAction);
            }
        }

        if (container) {
            container.innerHTML = '';
            container.appendChild(element);
        }

        return element;
    }
}

/**
 * Error State Component
 */
class ErrorStateComponent {
    static create(container, options = {}) {
        const defaults = {
            type: 'generic', // 'generic', 'network', 'permission', 'auth', 'timeout'
            title: null,
            message: null,
            showRetry: true,
            showHome: true,
            onRetry: null,
            retryText: 'Try Again',
            className: '',
            details: null
        };

        const opts = { ...defaults, ...options };

        // Error type specific defaults
        const errorTypes = {
            network: {
                icon: '🌐',
                title: 'Connection Error',
                message: 'Please check your internet connection and try again.'
            },
            permission: {
                icon: '🔒',
                title: 'Access Denied',
                message: 'You don\'t have permission to view this content.'
            },
            auth: {
                icon: '🔐',
                title: 'Authentication Required',
                message: 'Please log in to continue.'
            },
            timeout: {
                icon: '⏱️',
                title: 'Request Timeout',
                message: 'This request is taking longer than expected.'
            },
            generic: {
                icon: '⚠️',
                title: 'Something went wrong',
                message: 'An unexpected error occurred. Please try again.'
            }
        };

        const typeDefaults = errorTypes[opts.type] || errorTypes.generic;
        const finalOpts = {
            ...typeDefaults,
            ...opts
        };

        const retryButton = finalOpts.showRetry ? `
            <button data-retry="true" 
                    class="bg-blue-600 text-white font-bold py-2 px-4 rounded-md hover:bg-blue-500 transition">
                ${finalOpts.retryText}
            </button>
        ` : '';

        const homeButton = finalOpts.showHome ? `
            <a href="index.html" 
               class="bg-slate-600 text-white font-bold py-2 px-4 rounded-md hover:bg-slate-500 transition">
                Go Home
            </a>
        ` : '';

        const detailsSection = finalOpts.details ? `
            <details class="mt-4 text-left">
                <summary class="cursor-pointer text-gray-400 text-sm">Technical Details</summary>
                <pre class="mt-2 p-3 bg-gray-800 rounded text-red-300 text-xs overflow-auto max-h-32">
                    ${typeof finalOpts.details === 'string' ? finalOpts.details : JSON.stringify(finalOpts.details, null, 2)}
                </pre>
            </details>
        ` : '';

        const element = createSafeElement('div', {
            className: `error-state-component text-center py-12 ${finalOpts.className}`,
            innerHTML: `
                <div class="text-6xl mb-4">${finalOpts.icon}</div>
                <h3 class="text-2xl font-bold text-red-400 mb-2">${finalOpts.title}</h3>
                <p class="text-gray-300 mb-6">${finalOpts.message}</p>
                <div class="space-x-4">
                    ${retryButton}
                    ${homeButton}
                </div>
                ${detailsSection}
            `
        });

        // Attach retry handler
        if (finalOpts.showRetry) {
            const retryBtn = element.querySelector('[data-retry="true"]');
            if (retryBtn) {
                retryBtn.addEventListener('click', () => {
                    if (finalOpts.onRetry) {
                        finalOpts.onRetry();
                    } else {
                        window.location.reload();
                    }
                });
            }
        }

        if (container) {
            container.innerHTML = '';
            container.appendChild(element);
        }

        return element;
    }
}

/**
 * Utility function to show different states
 */
const UIState = {
    loading: (container, options) => LoadingComponent.create(container, options),
    empty: (container, options) => EmptyStateComponent.create(container, options),
    error: (container, options) => ErrorStateComponent.create(container, options)
};

export { LoadingComponent, EmptyStateComponent, ErrorStateComponent, UIState };