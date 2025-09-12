/**
 * HTML Sanitization Utilities
 * Provides safe methods for handling user-generated content to prevent XSS attacks
 */

/**
 * Escapes HTML special characters to prevent XSS
 * @param {string} str - The string to escape
 * @returns {string} The escaped string
 */
export function escapeHTML(str) {
    if (str === null || str === undefined) {
        return '';
    }
    
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * Template tag for safe HTML interpolation
 * Automatically escapes all interpolated values
 * Usage: html`<div>Hello ${username}</div>`
 * @param {TemplateStringsArray} strings - Template string parts
 * @param {...any} values - Values to interpolate
 * @returns {string} Safe HTML string with escaped interpolations
 */
export function html(strings, ...values) {
    let result = strings[0];
    for (let i = 0; i < values.length; i++) {
        result += escapeHTML(values[i]) + strings[i + 1];
    }
    return result;
}

/**
 * Safely sets HTML content after sanitization
 * @param {HTMLElement} element - The element to set content on
 * @param {string} htmlString - The HTML string (should already be sanitized)
 */
export function safeSetHTML(element, htmlString) {
    if (!element || !htmlString) {
        return;
    }
    
    // Additional safety check - remove any script tags
    const cleanHTML = htmlString.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    element.innerHTML = cleanHTML;
}

/**
 * Creates a safe text node (alternative to innerHTML for plain text)
 * @param {HTMLElement} element - The element to set text content on
 * @param {string} text - The text content
 */
export function setSafeText(element, text) {
    if (!element) {
        return;
    }
    element.textContent = text || '';
}

/**
 * Safely creates HTML elements with text content
 * @param {string} tagName - The tag name (e.g., 'span', 'div')
 * @param {string} textContent - The text content
 * @param {string} className - Optional CSS class name
 * @returns {HTMLElement} The created element
 */
export function createSafeElement(tagName, textContent = '', className = '') {
    const element = document.createElement(tagName);
    if (textContent) {
        element.textContent = textContent;
    }
    if (className) {
        element.className = className;
    }
    return element;
}