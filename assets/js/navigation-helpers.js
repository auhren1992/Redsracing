/**
 * Navigation Security Helpers
 * Provides safe navigation utilities to prevent open redirects and injection attacks
 */

/**
 * Validates that a path is safe for internal navigation
 * @param {string} path - The path to validate
 * @returns {boolean} True if the path is safe for internal navigation
 */
function isSafeInternalPath(path) {
    if (!path || typeof path !== 'string') {
        return false;
    }
    
    // Remove leading/trailing whitespace
    path = path.trim();
    
    // Must start with / for relative paths, or be a known internal page
    if (!path.startsWith('/')) {
        return false;
    }
    
    // Reject paths that could be dangerous
    const dangerousPatterns = [
        /javascript:/i,
        /data:/i,
        /vbscript:/i,
        /file:/i,
        /\/\//,  // Protocol-relative URLs
        /\.\./,  // Path traversal
    ];
    
    return !dangerousPatterns.some(pattern => pattern.test(path));
}

/**
 * Safely navigates to an internal path
 * @param {string} path - The internal path to navigate to
 * @param {boolean} replace - Whether to replace current history entry (default: false)
 * @throws {Error} If the path is not safe for internal navigation
 */
export function navigateToInternal(path, replace = false) {
    if (!isSafeInternalPath(path)) {
        throw new Error(`Unsafe navigation path: ${path}`);
    }
    
    try {
        if (replace) {
            window.location.replace(safeInternalPath(path));
        } else {
            if (isSafeInternalPath(path)) window.location.href = path;
        }
    } catch (error) {
        console.error('Navigation failed:', error);
        throw new Error('Navigation failed');
    }
}

/**
 * Safely redirects to an internal path with validation
 * Similar to navigateToInternal but specifically for redirects
 * @param {string} path - The internal path to redirect to
 */
export function safeRedirect(path) {
    navigateToInternal(path, true);
}

/**
 * Validates and sanitizes a redirect URL from user input
 * @param {string} url - The URL to validate
 * @param {string} fallbackPath - Fallback path if URL is invalid (default: '/')
 * @returns {string} A safe internal path
 */
export function validateRedirectUrl(url, fallbackPath = '/') {
    if (!url || typeof url !== 'string') {
        return fallbackPath;
    }
    
    // Remove leading/trailing whitespace
    url = url.trim();
    
    // Handle URL objects or absolute URLs by extracting pathname
    try {
        const urlObj = new URL(url, window.location.origin);
        // Only allow same-origin redirects
        if (urlObj.origin !== window.location.origin) {
            console.warn('Cross-origin redirect blocked:', url);
            return fallbackPath;
        }
        url = urlObj.pathname + urlObj.search + urlObj.hash;
    } catch {
        // If URL parsing fails, treat as relative path
    }
    
    // Validate the resulting path
    if (isSafeInternalPath(url)) {
        return url;
    }
    
    console.warn('Unsafe redirect URL blocked:', url);
    return fallbackPath;
}

/**
 * Safely opens a link, validating internal vs external
 * @param {string} url - The URL to open
 * @param {boolean} newTab - Whether to open in new tab (default: false)
 */
export function safeOpenLink(url, newTab = false) {
    if (!url || typeof url !== 'string') {
        throw new Error('Invalid URL provided');
    }
    
    try {
        const urlObj = new URL(url, window.location.origin);
        
        // For external URLs, always open in new tab with security attributes
        if (urlObj.origin !== window.location.origin) {
            const link = document.createElement('a');
            link.href = url;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.click();
            return;
        }
        
        // For internal URLs, use safe navigation
        const path = urlObj.pathname + urlObj.search + urlObj.hash;
        if (newTab) {
            window.open(path, '_blank', 'noopener,noreferrer');
        } else {
            navigateToInternal(path);
        }
    } catch (error) {
        console.error('Failed to open link:', error);
        throw new Error('Failed to open link');
    }
}