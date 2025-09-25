// assets/js/router-fixed.js
import { getFirebaseAuth } from './firebase-core.js';
import { onAuthStateChanged } from "firebase/auth";
import { navigateToInternal } from './navigation-helpers.js';

const auth = getFirebaseAuth();
let isProcessing = false; // Prevent race conditions

onAuthStateChanged(auth, async (user) => {
    // Prevent multiple simultaneous processing
    if (isProcessing) return;
    isProcessing = true;

    try {
        if (user) {
            // Don't force refresh token every time - only get cached token
            const idTokenResult = await user.getIdTokenResult(false); // false = use cache
            const role = idTokenResult.claims.role;

            console.log('[Router] User role:', role);

            // Route based on role with fallbacks
            if (role === 'team-member') {
                navigateToInternal('/redsracing-dashboard.html');
            } else if (role === 'TeamRedFollower') {
                navigateToInternal('/follower-dashboard.html');
            } else {
                // No valid role - show profile or login
                console.warn('[Router] User has no valid role:', role);
                navigateToInternal('/profile.html');
            }
        } else {
            console.log('[Router] No user - redirecting to login');
            navigateToInternal('/login.html');
        }
    } catch (error) {
        console.error('[Router] Error processing auth state:', error);
        // Fallback to login on error
        navigateToInternal('/login.html');
    } finally {
        isProcessing = false;
    }
});