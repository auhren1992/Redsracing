/**
 * Secure Random Number Generation
 * Provides cryptographically secure random number generation
 */

/**
 * Generates a cryptographically secure random float between 0 and 1
 * @returns {number} A secure random float in the range [0, 1)
 */
export function secureRandomFloat() {
    // Check if crypto.getRandomValues is available (modern browsers)
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        // Generate 32-bit random value
        const array = new Uint32Array(1);
        crypto.getRandomValues(array);
        // Convert to float in range [0, 1)
        return array[0] / 4294967296; // 2^32
    }
    
    // Fallback to Math.random() with warning
    // Note: This is NOT cryptographically secure and should only be used
    // when crypto.getRandomValues is not available
    console.warn('crypto.getRandomValues not available, falling back to Math.random() - NOT SECURE');
    return Math.random();
}

/**
 * Generates a cryptographically secure random integer in the specified range
 * @param {number} min - Minimum value (inclusive)
 * @param {number} max - Maximum value (exclusive)
 * @returns {number} A secure random integer
 */
export function secureRandomInt(min, max) {
    if (min >= max) {
        throw new Error('min must be less than max');
    }
    
    const range = max - min;
    const randomFloat = secureRandomFloat();
    return Math.floor(randomFloat * range) + min;
}

/**
 * Generates a cryptographically secure random string
 * @param {number} length - Length of the string to generate
 * @param {string} charset - Character set to use (default: alphanumeric)
 * @returns {string} A secure random string
 */
export function secureRandomString(length = 16, charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789') {
    if (length <= 0) {
        throw new Error('Length must be positive');
    }
    
    let result = '';
    for (let i = 0; i < length; i++) {
        const randomIndex = secureRandomInt(0, charset.length);
        result += charset[randomIndex];
    }
    return result;
}

/**
 * Generates secure jitter for exponential backoff
 * @param {number} baseDelay - Base delay in milliseconds
 * @param {number} jitterFactor - Jitter factor (0-1, default 0.1 = 10%)
 * @returns {number} Delay with secure random jitter applied
 */
export function secureJitter(baseDelay, jitterFactor = 0.1) {
    if (baseDelay < 0) {
        throw new Error('Base delay must be non-negative');
    }
    if (jitterFactor < 0 || jitterFactor > 1) {
        throw new Error('Jitter factor must be between 0 and 1');
    }
    
    const jitter = secureRandomFloat() * jitterFactor * baseDelay;
    return baseDelay + jitter;
}