import { getFirebaseAuth } from './firebase-core.js';
import { onAuthStateChanged } from "firebase/auth";
import { navigateToInternal } from './navigation-helpers.js';

const auth = getFirebaseAuth();
const protectedPages = ['redsracing-dashboard.html', 'follower-dashboard.html', 'profile.html'];
const teamMemberPages = ['redsracing-dashboard.html'];
const followerPages = ['follower-dashboard.html'];

const currentPage = window.location.pathname.split('/').pop();

if (protectedPages.includes(currentPage)) {
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            navigateToInternal('/login.html');
            return;
        }

        try {
            const idTokenResult = await user.getIdTokenResult(true);
            const role = idTokenResult.claims.role;

            if (teamMemberPages.includes(currentPage) && role !== 'team-member') {
                navigateToInternal('/follower-dashboard.html');
            } else if (followerPages.includes(currentPage) && role !== 'TeamRedFollower') {
                navigateToInternal('/redsracing-dashboard.html');
            }
        } catch (error) {
            console.error("Error getting user role, redirecting to login.", error);
            navigateToInternal('/login.html');
        }
    });
}