/**
 * Async Data Hook for Firestore Operations
 * 
 * Provides React-like useAsync functionality for data fetching with:
 * - Loading, success, and error states
 * - Automatic retries with exponential backoff
 * - Timeout handling
 * - Proper cleanup and cancellation
 * - Permission validation
 */

import { validateUserClaims } from './auth-utils.js';
import { secureJitter } from './secure-random.js';

class AsyncDataHook {
    constructor(options = {}) {
        this.options = {
            timeout: 30000, // 30 seconds default
            maxRetries: 3,
            retryDelay: 1000, // 1 second base delay
            retryMultiplier: 2,
            jitterFactor: 0.3,
            requireAuth: true,
            requiredRoles: [],
            enableCache: false,
            cacheKey: null,
            cacheTTL: 5 * 60 * 1000, // 5 minutes
            ...options
        };

        this.state = {
            data: null,
            loading: false,
            error: null,
            retryCount: 0
        };

        this.listeners = [];
        this.abortController = null;
        this.timeoutId = null;
        this.cache = new Map();
    }

    // Subscribe to state changes
    subscribe(listener) {
        this.listeners.push(listener);
        return () => {
            const index = this.listeners.indexOf(listener);
            if (index > -1) {
                this.listeners.splice(index, 1);
            }
        };
    }

    // Emit state change to all listeners
    emit() {
        this.listeners.forEach(listener => {
            try {
                listener(this.state);
            } catch (error) {
                console.error('[AsyncDataHook] Error in state listener:', error);
            }
        });
    }

    // Update state and notify listeners
    setState(updates) {
        this.state = { ...this.state, ...updates };
        this.emit();
    }

    // Check if data is cached and valid
    getCachedData(key) {
        if (!this.options.enableCache || !key) return null;
        
        const cached = this.cache.get(key);
        if (!cached) return null;

        const isExpired = Date.now() - cached.timestamp > this.options.cacheTTL;
        if (isExpired) {
            this.cache.delete(key);
            return null;
        }

        return cached.data;
    }

    // Cache data
    setCachedData(key, data) {
        if (!this.options.enableCache || !key) return;
        
        this.cache.set(key, {
            data,
            timestamp: Date.now()
        });
    }

    // Execute the async operation with full error handling
    async execute(asyncFunction, ...args) {
        // Return cached data if available
        if (this.options.cacheKey) {
            const cached = this.getCachedData(this.options.cacheKey);
            if (cached) {
                console.log('[AsyncDataHook] Returning cached data for key:', this.options.cacheKey);
                this.setState({ data: cached, loading: false, error: null });
                return { data: cached, error: null };
            }
        }

        // Abort any existing operation
        this.abort();

        // Create new abort controller
        this.abortController = new AbortController();
        
        this.setState({ 
            loading: true, 
            error: null, 
            retryCount: 0 
        });

        try {
            // Check authentication and permissions if required
            if (this.options.requireAuth || this.options.requiredRoles.length > 0) {
                const claimsResult = await validateUserClaims(this.options.requiredRoles);
                if (!claimsResult.success) {
                    throw new Error(`Permission denied: ${claimsResult.error?.message || 'Insufficient permissions'}`);
                }
            }

            // Execute the operation with retry logic
            const result = await this.executeWithRetry(asyncFunction, args);
            
            // Cache successful result
            if (this.options.cacheKey) {
                this.setCachedData(this.options.cacheKey, result);
            }

            this.setState({ 
                data: result, 
                loading: false, 
                error: null 
            });

            return { data: result, error: null };

        } catch (error) {
            console.error('[AsyncDataHook] Operation failed:', error);
            
            const processedError = this.processError(error);
            this.setState({ 
                data: null, 
                loading: false, 
                error: processedError 
            });

            return { data: null, error: processedError };
        } finally {
            this.cleanup();
        }
    }

    // Execute operation with retry logic and timeout
    async executeWithRetry(asyncFunction, args) {
        let lastError = null;

        for (let attempt = 0; attempt <= this.options.maxRetries; attempt++) {
            if (this.abortController?.signal.aborted) {
                throw new Error('Operation was cancelled');
            }

            try {
                // Set up timeout
                const timeoutPromise = new Promise((_, reject) => {
                    this.timeoutId = setTimeout(() => {
                        reject(new Error(`Operation timeout after ${this.options.timeout}ms`));
                    }, this.options.timeout);
                });

                // Execute operation
                const operationPromise = asyncFunction.apply(null, args);

                // Race between operation and timeout
                const result = await Promise.race([operationPromise, timeoutPromise]);
                
                // Clear timeout on success
                if (this.timeoutId) {
                    clearTimeout(this.timeoutId);
                    this.timeoutId = null;
                }

                return result;

            } catch (error) {
                lastError = error;
                
                // Clear timeout
                if (this.timeoutId) {
                    clearTimeout(this.timeoutId);
                    this.timeoutId = null;
                }

                // Check if we should retry
                if (attempt < this.options.maxRetries && this.shouldRetry(error)) {
                    const delay = this.calculateRetryDelay(attempt);
                    console.warn(
                        `[AsyncDataHook] Attempt ${attempt + 1}/${this.options.maxRetries + 1} failed, retrying in ${delay}ms:`, 
                        error.message
                    );

                    this.setState({ retryCount: attempt + 1 });

                    // Wait before retry
                    await new Promise(resolve => setTimeout(resolve, delay));
                } else {
                    // No more retries or non-retryable error
                    throw error;
                }
            }
        }

        throw lastError;
    }

    // Determine if error should trigger a retry
    shouldRetry(error) {
        if (this.abortController?.signal.aborted) return false;

        // Network errors are retryable
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            return true;
        }

        // Firebase specific retryable errors
        if (error.code) {
            const retryableCodes = [
                'unavailable',
                'deadline-exceeded',
                'internal',
                'aborted'
            ];
            return retryableCodes.includes(error.code);
        }

        // Timeout errors are retryable
        if (error.message.includes('timeout')) {
            return true;
        }

        return false;
    }

    // Calculate retry delay with exponential backoff and jitter
    calculateRetryDelay(attempt) {
        const baseDelay = this.options.retryDelay * Math.pow(this.options.retryMultiplier, attempt);
        return secureJitter(baseDelay, this.options.jitterFactor);
    }

    // Process error for consistent format
    processError(error) {
        const processedError = {
            message: error.message || 'Unknown error',
            code: error.code || 'unknown',
            type: 'generic',
            timestamp: new Date(),
            retryable: this.shouldRetry(error)
        };

        // Classify error type
        if (error.code) {
            switch (error.code) {
                case 'permission-denied':
                case 'unauthenticated':
                    processedError.type = 'permission';
                    break;
                case 'unavailable':
                case 'deadline-exceeded':
                    processedError.type = 'service';
                    break;
                case 'not-found':
                    processedError.type = 'not-found';
                    break;
                default:
                    processedError.type = 'firebase';
            }
        } else if (error.message.includes('timeout')) {
            processedError.type = 'timeout';
        } else if (error.message.includes('fetch') || error.message.includes('network')) {
            processedError.type = 'network';
        }

        return processedError;
    }

    // Abort current operation
    abort() {
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
        }
        
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = null;
        }
    }

    // Clean up resources
    cleanup() {
        this.abort();
        this.listeners = [];
        // Keep cache for potential reuse
    }

    // Reset state
    reset() {
        this.abort();
        this.setState({
            data: null,
            loading: false,
            error: null,
            retryCount: 0
        });
    }

    // Refresh data (bypass cache)
    async refresh(asyncFunction, ...args) {
        if (this.options.cacheKey) {
            this.cache.delete(this.options.cacheKey);
        }
        return this.execute(asyncFunction, ...args);
    }
}

/**
 * Factory function to create async data hooks
 */
function useAsync(options = {}) {
    return new AsyncDataHook(options);
}

/**
 * Convenience function for Firestore queries
 */
function useFirestoreQuery(options = {}) {
    return useAsync({
        requireAuth: true,
        enableCache: true,
        ...options
    });
}

/**
 * Hook specifically for user data with optimistic caching
 */
function useUserData(userId, options = {}) {
    return useAsync({
        requireAuth: true,
        enableCache: true,
        cacheKey: `user_${userId}`,
        cacheTTL: 2 * 60 * 1000, // 2 minutes for user data
        ...options
    });
}

export { AsyncDataHook, useAsync, useFirestoreQuery, useUserData };