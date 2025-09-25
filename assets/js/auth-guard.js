import { navigateToInternal } from './navigation-helpers.js';
import { monitorAuthState, validateUserClaims } from './auth-utils.js';

const protectedPages = ['redsracing-dashboard.html', 'follower-dashboard.html', 'profile.html'];
const teamMemberPages = ['redsracing-dashboard.html'];
const followerPages = ['follower-dashboard.html'];

const currentPage = window.location.pathname.split('/').pop();

if (protectedPages.includes(currentPage)) {
    monitorAuthState(async (user, token) => {
        if (!user) {
            navigateToInternal('/login.html');
            return;
        }

        try {
            const claimsResult = await validateUserClaims();
            const role = claimsResult.success ? claimsResult.claims.role : null;

            if (teamMemberPages.includes(currentPage) && role !== 'team-member') {
                navigateToInternal('/follower-dashboard.html');
            } else if (followerPages.includes(currentPage) && role !== 'TeamRedFollower') {
                navigateToInternal('/redsracing-dashboard.html');
            }
        } catch (error) {
            navigateToInternal('/login.html');
        }
    }, (error) => {
        navigateToInternal('/login.html');
    });
}