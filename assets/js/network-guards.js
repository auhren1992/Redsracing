/**
 * Network Security Guards
 * Provides safe networking utilities to prevent SSRF and other URL-based attacks
 */

/**
 * List of allowed URL patterns (same-origin by default)
 * Can be extended for specific trusted external domains
 */
const ALLOWED_ORIGINS = [
    window.location.origin, // Same origin
    // Add other trusted origins here if needed
    // 'https://trusted-api.example.com'
];

/**
 * Validates that a URL is safe to use
 * @param {string} inputUrl - The URL to validate
 * @returns {string} The validated URL
 * @throws {Error} If the URL is not safe
 */
export function ensureSafeUrl(inputUrl) {
    if (!inputUrl) {
        throw new Error('URL cannot be empty');
    }
    
    let url;
    try {
        // Handle relative URLs by resolving against current origin
        if (inputUrl.startsWith('/')) {
            url = new URL(inputUrl, window.location.origin);
        } else {
            url = new URL(inputUrl);
        }
    } catch (error) {
        throw new Error(`Invalid URL format: ${inputUrl}`);
    }
    
    // Check if the origin is allowed
    const isAllowed = ALLOWED_ORIGINS.some(allowedOrigin => {
        try {
            const allowedUrl = new URL(allowedOrigin);
            return url.origin === allowedUrl.origin;
        } catch {
            return false;
        }
    });
    
    if (!isAllowed) {
        throw new Error(`URL origin not allowed: ${url.origin}`);
    }
    
    // Prevent javascript: and data: schemes
    if (url.protocol === 'javascript:' || url.protocol === 'data:') {
        throw new Error(`Unsafe URL protocol: ${url.protocol}`);
    }
    
    return url.toString();
}

/**
 * Safe wrapper around fetch that validates URLs
 * @param {string|Request} input - The URL or Request object
 * @param {RequestInit} init - Optional request configuration
 * @returns {Promise<Response>} The fetch response
 */
export async function safeFetch(input, init = {}) {
    let url;
    
    if (typeof input === 'string') {
        url = ensureSafeUrl(input);
    } else if (input instanceof Request) {
        url = ensureSafeUrl(input.url);
        // Create new request with validated URL
        input = new Request(url, input);
    } else {
        throw new Error('Invalid input type for safeFetch');
    }
    
    // Add some basic security headers if not already present
    const headers = new Headers(init.headers || {});
    if (!headers.has('X-Requested-With')) {
        headers.set('X-Requested-With', 'XMLHttpRequest');
    }
    
    const safeInit = {
        ...init,
        headers: headers
    };
    
    if (!isSafeUrl(input)) throw new Error('Unsafe URL'); return fetch(input, safeInit);
}

/**
 * Validates if a URL is safe without throwing
 * @param {string} inputUrl - The URL to validate
 * @returns {boolean} True if the URL is safe
 */
export function isSafeUrl(inputUrl) {
    try {
        ensureSafeUrl(inputUrl);
        return true;
    } catch {
        return false;
    }
}