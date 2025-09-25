import { getFirebaseAuth } from './firebase-core.js';
import { onAuthStateChanged } from "firebase/auth";
import { navigateToInternal } from './navigation-helpers.js';

const auth = getFirebaseAuth();

onAuthStateChanged(auth, async (user) => {
    if (user) {
        try {
            const idTokenResult = await user.getIdTokenResult(true);
            const role = idTokenResult.claims.role;

            if (role === 'team-member') {
                navigateToInternal('/redsracing-dashboard.html');
            } else if (role === 'TeamRedFollower') {
                navigateToInternal('/follower-dashboard.html');
            } else {
                navigateToInternal('/login.html');
            }
        } catch (error) {
            console.error("Error getting user role, redirecting to login.", error);
            navigateToInternal('/login.html');
        }
    } else {
        navigateToInternal('/login.html');
    }
});