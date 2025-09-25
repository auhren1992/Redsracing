/**
 * Navigation Security Helpers
 * Provides safe navigation utilities to prevent open redirects and injection attacks
 */

/**
 * Allowlist of safe internal paths
 */
const ALLOWED_PATHS = new Set([
    '/',
    '/dashboard',
    '/dashboard.html',
    '/login.html',
    '/signup.html',
    '/profile.html',
    '/gallery.html',
    '/schedule.html',
    '/leaderboard.html',
    '/team-members.html',
    '/sponsorship.html',
    '/feedback.html',
    '/qna.html',
    '/videos.html',
    '/jonny.html',
    '/driver.html',
    'dashboard.html',
    'login.html',
    'signup.html',
    'profile.html',
    'gallery.html',
    'schedule.html',
    'leaderboard.html',
    'team-members.html',
    'sponsorship.html',
    'feedback.html',
    'qna.html',
    'videos.html',
    'jonny.html',
    'driver.html'
]);

/**
 * Normalize and validate a path for internal navigation
 * @param {string} path - The path to normalize and validate
 * @returns {string|null} Normalized path if safe, null if unsafe
 */
function normalizeAndValidatePath(path) {
    if (!path || typeof path !== 'string') {
        return null;
    }

    // Remove leading/trailing whitespace
    path = path.trim();

    // Handle absolute URLs by extracting pathname if same-origin
    try {
        if (path.includes('://')) {
            const urlObj = new URL(path);
            // Only allow same-origin URLs
            if (urlObj.origin !== window.location.origin) {
                return null;
            }
            path = urlObj.pathname + urlObj.search + urlObj.hash;
        }
    } catch {
        // If URL parsing fails and contains ://, it's likely malformed
        if (path.includes('://')) {
            return null;
        }
    }

    // Decode any URL encoding to prevent bypasses
    try {
        path = decodeURIComponent(path);
    } catch {
        return null; // Invalid encoding
    }

    // Reject paths with dangerous patterns
    const dangerousPatterns = [
        /javascript:/i,
        /data:/i,
        /vbscript:/i,
        /file:/i,
        /\/\//,  // Protocol-relative URLs
        /\.\./,  // Path traversal
        /%2e%2e/i, // Encoded path traversal
        /%2f/i,    // Encoded slash
        /\\x/i,    // Hex encoding
        /\\/       // Backslashes
    ];

    if (dangerousPatterns.some(pattern => pattern.test(path))) {
        return null;
    }

    // Normalize path - ensure leading slash for relative paths
    if (!path.startsWith('/') && !path.includes('.html')) {
        path = '/' + path;
    }

    return path;
}

/**
 * Validates that a path is safe for internal navigation
 * @param {string} path - The path to validate
 * @returns {boolean} True if the path is safe for internal navigation
 */
function isSafeInternalPath(path) {
    const normalizedPath = normalizeAndValidatePath(path);
    if (!normalizedPath) {
        return false;
    }

    // Check against allowlist
    return ALLOWED_PATHS.has(normalizedPath) ||
           ALLOWED_PATHS.has(normalizedPath.replace(/^\//, ''));
}

/**
 * Safely navigates to an internal path
 * @param {string} path - The internal path to navigate to
 * @param {boolean} replace - Whether to replace current history entry (default: false)
 * @throws {Error} If the path is not safe for internal navigation
 */
export function navigateToInternal(path, replace = false) {
    const normalizedPath = normalizeAndValidatePath(path);
    if (!normalizedPath || !isSafeInternalPath(normalizedPath)) {
        throw new Error(`Unsafe navigation path: ${path}`);
    }

    try {
        if (replace) {
            window.location.replace(normalizedPath);
        } else {
            window.location.href = normalizedPath;
        }
    } catch (error) {

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
    const normalizedPath = normalizeAndValidatePath(url);
    if (!normalizedPath) {

        return fallbackPath;
    }

    if (isSafeInternalPath(normalizedPath)) {
        return normalizedPath;
    }


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

        throw new Error('Failed to open link');
    }
}