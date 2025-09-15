import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";
import { getFirebaseApp } from './firebase-core.js';

const DEFAULT_PARAM_NAMES = ['invite', 'code'];

export function captureInvitationCodeFromURL(paramNames = DEFAULT_PARAM_NAMES, stripFromUrl = true) {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        let capturedCode = null;
        let foundParam = null;
        for (const paramName of paramNames) {
            const code = urlParams.get(paramName);
            if (code && code.trim()) {
                capturedCode = code.trim();
                foundParam = paramName;
                break;
            }
        }
        if (capturedCode) {
            if (stripFromUrl && foundParam) {
                urlParams.delete(foundParam);
                const newUrl = window.location.pathname +
                    (urlParams.toString() ? '?' + urlParams.toString() : '') +
                    window.location.hash;
                window.history.replaceState({}, '', newUrl);
            }
            return capturedCode;
        }
        return null;
    } catch (error) {
        console.error('[InvitationCodes] Error capturing code from URL:', error);
        return null;
    }
}

export async function validateInvitationCode(code) {
    if (!code || typeof code !== 'string') return false;
    const app = getFirebaseApp();
    const functions = getFunctions(app);
    const validate = httpsCallable(functions, 'validateInvitationCode');
    try {
        const result = await validate({ code });
        return result.data && result.data.status === 'valid';
    } catch (err) {
        console.error('[InvitationCodes] Invite code validation failed:', err);
        return false;
    }
}

export async function processInvitationCode(code, uid) {
    if (!code || !uid) throw new Error('Invite code and UID required.');
    const app = getFirebaseApp();
    const functions = getFunctions(app);
    const process = httpsCallable(functions, 'processInvitationCode');
    try {
        const result = await process({ code, uid });
        return result.data;
    } catch (err) {
        console.error('[InvitationCodes] Error processing invitation code:', err);
        throw err;
    }
}