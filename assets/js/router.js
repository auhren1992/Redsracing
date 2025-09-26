// assets/js/router-fixed.js
import { navigateToInternal } from './navigation-helpers.js';
import { monitorAuthState, validateUserClaims } from './auth-utils.js';

let isProcessing = false; // Prevent race conditions

monitorAuthState(async (user, token) => {
    if (isProcessing) return;
    isProcessing = true;

    try {
        if (user) {
            const claimsResult = await validateUserClaims();
            const role = claimsResult.success ? claimsResult.claims.role : null;

            // Route based on role with fallbacks
            if (role === 'team-member') {
                navigateToInternal('/redsracing-dashboard.html');
            } else if (role === 'TeamRedFollower') {
                navigateToInternal('/follower-dashboard.html');
            } else {
                // No valid role - show profile or login
                navigateToInternal('/profile.html');
            }
        } else {
            navigateToInternal('/login.html');
        }
    } catch (error) {
        // Fallback to login on error
        navigateToInternal('/login.html');
    } finally {
        isProcessing = false;
    }
}, (error) => {
    isProcessing = false;
    navigateToInternal('/login.html');
});