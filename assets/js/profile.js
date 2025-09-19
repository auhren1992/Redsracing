// Importing Firebase services and specific functions
import { getFirebaseAuth, getFirebaseApp, getFirebaseDb } from './firebase-core.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { doc, getDoc, setDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Import centralized authentication utilities
import { 
    validateAndRefreshToken, 
    validateUserClaims, 
    safeFirestoreOperation, 
    retryAuthOperation,
    showAuthError,
    clearAuthError,
    monitorAuthState,
    getCurrentUser
} from './auth-utils.js';

// Import sanitization utilities
import { html, safeSetHTML, setSafeText, createSafeElement } from './sanitize.js';

// Import navigation helpers
import { navigateToInternal } from './navigation-helpers.js';

// Import error handling utilities
import { getFriendlyAuthError, isRecaptchaError } from './auth-errors.js';

// Wrap everything in an async function to allow early returns
(async function() {
    console.log('[DEBUG] Profile script execution started.');
    const auth = getFirebaseAuth();
    const app = getFirebaseApp();
    console.log('[Profile] Firebase services obtained successfully');

    let loadingTimeout = setTimeout(() => {
        console.warn('[DEBUG] Loading timeout reached, showing fallback content');
        hideLoadingAndShowFallback();
    }, 15000); // 15 second timeout

    function hideLoadingAndShowFallback() {
        console.log('[DEBUG] hideLoadingAndShowFallback called');
        const loadingState = document.getElementById('loading-state');
        const profileContent = document.getElementById('profile-content');
        if (loadingState) {
            loadingState.style.display = 'none';
            loadingState.classList.add('hidden');
        }
        if (profileContent) {
            profileContent.innerHTML = `<div class="text-center py-20">...</div>`; // Content omitted for brevity
            profileContent.classList.remove('hidden');
        }
        if (loadingTimeout) { clearTimeout(loadingTimeout); loadingTimeout = null; }
    }

    // ... UI Elements getters ...
    console.log('[DEBUG] Getting all DOM elements for profile page.');
    const loadingState = document.getElementById('loading-state');
    // ... all other getElementById calls ...

    let currentUser = null;
    let isEditing = false;
    let isCurrentUserProfile = false;

    console.log('[DEBUG] Setting up auth state monitoring for profile page.');
    const authUnsubscribe = monitorAuthState(
        async (user, validToken) => {
            console.log('[DEBUG] Profile monitorAuthState success callback triggered. User:', user ? user.uid : 'null');
            clearAuthError();
            if (user && validToken) {
                console.log('[DEBUG] Profile user is authenticated.');
                currentUser = user;
                const targetUserId = getUserIdFromUrl() || user.uid;
                isCurrentUserProfile = (targetUserId === user.uid);
                console.log(`[DEBUG] Target User ID: ${targetUserId}, Is Current User Profile: ${isCurrentUserProfile}`);

                try {
                    await loadUserProfile(targetUserId);
                } catch (profileError) {
                    console.error('[DEBUG] Critical error during loadUserProfile, showing error state.', profileError);
                    showErrorState();
                    return;
                }

                try {
                    const claimsResult = await validateUserClaims(['team-member']);
                    const isAdmin = claimsResult.success && claimsResult.claims.role === 'team-member';
                    console.log('[DEBUG] Profile isAdmin check:', isAdmin);
                    if (isAdmin && adminAchievements) {
                        adminAchievements.classList.remove('hidden');
                        const achievementsResult = await safeFirestoreOperation(loadAllAchievements, ['team-member'], 'Load achievements for admin');
                        if (!achievementsResult.success) {
                            console.error('[DEBUG] Error loading achievements for admin:', achievementsResult.error);
                            showAuthError(achievementsResult.error);
                        }
                    }
                } catch (claimsError) {
                    console.error('[DEBUG] Error validating user claims for admin functions:', claimsError);
                }

                hideLoadingAndShowContent();
            } else {
                console.warn('[DEBUG] Profile user not authenticated, redirecting to login.');
                window.location.href = 'login.html';
            }
            console.log('[DEBUG] Profile monitorAuthState success callback finished.');
        },
        (error) => {
            console.error('[DEBUG] Profile monitorAuthState error callback triggered:', error);
            showAuthError(error);
            if (error.requiresReauth) {
                setTimeout(() => { navigateToInternal('/login.html'); }, 3000);
            } else {
                showErrorState();
            }
        }
    );

    function hideLoadingAndShowContent() {
        console.log('[DEBUG] hideLoadingAndShowContent called');
        if (loadingState) loadingState.classList.add('hidden');
        if (profileContent) profileContent.classList.remove('hidden');
        if (loadingTimeout) { clearTimeout(loadingTimeout); loadingTimeout = null; }
        console.log('[DEBUG] ✓ Profile content displayed successfully');
    }

    function finalizeProfileLoad() {
        console.log('[DEBUG] finalizeProfileLoad called');
        if (loadingState) loadingState.classList.add('hidden');
        if (loadingTimeout) { clearTimeout(loadingTimeout); loadingTimeout = null; }
    }

    async function loadUserProfile(userId) {
        console.log(`[DEBUG] loadUserProfile started for user: ${userId}`);
        try {
            const profileData = await callProfileAPI(`/profile/${userId}`);
            console.log('[DEBUG] Profile data fetched:', profileData);
            displayProfile(profileData);
            loadAchievements(profileData.achievements || []);
            if (isCurrentUserProfile) {
                await loadAchievementProgress(userId);
            }
            console.log(`[DEBUG] loadUserProfile finished successfully for user: ${userId}`);
        } catch (error) {
            console.error(`[DEBUG] Error in loadUserProfile for ${userId}:`, error);
            if (error.code === 'not-found') {
                if (isCurrentUserProfile) {
                    console.log('[DEBUG] Profile not found for current user, creating default profile.');
                    await createDefaultProfile(userId);
                } else {
                    console.log('[DEBUG] Profile not found for other user, showing minimal profile.');
                    displayMinimalProfile(userId);
                    finalizeProfileLoad();
                }
            } else {
                console.error(`[DEBUG] Unhandled error in loadUserProfile, showing minimal profile.`, error);
                displayMinimalProfile(userId);
                finalizeProfileLoad();
            }
        }
    }

    async function createDefaultProfile(userId) {
        console.log(`[DEBUG] createDefaultProfile started for user: ${userId}`);
        const defaultProfile = {
            username: currentUser.email.split('@')[0],
            displayName: currentUser.displayName || 'Anonymous User',
            bio: '',
            avatarUrl: '',
            favoriteCars: [],
            joinDate: new Date().toISOString(),
            achievements: []
        };
        try {
            await callProfileAPI(`/update_profile/${userId}`, 'PUT', defaultProfile);
            console.log('[DEBUG] Default profile created via API.');
            const awardResult = await autoAwardAchievement(userId, 'profile_created');
            if(awardResult && awardResult.awardedAchievements && awardResult.awardedAchievements.length > 0) {
                defaultProfile.achievements.push(...awardResult.awardedAchievements);
            }
            console.log('[DEBUG] Displaying newly created profile.');
            displayProfile(defaultProfile);
            loadAchievements(defaultProfile.achievements);
        } catch (error) {
            console.error('[DEBUG] Error creating default profile:', error);
            displayMinimalProfile(userId);
            finalizeProfileLoad();
        }
        console.log(`[DEBUG] createDefaultProfile finished for user: ${userId}`);
    }

    function displayProfile(profileData) {
        console.log('[DEBUG] displayProfile called with data:', profileData);
        // ... implementation ...
        console.log('[DEBUG] displayProfile finished.');
        hideLoadingAndShowContent();
        finalizeProfileLoad();
    }

    function loadAchievements(achievements) {
        console.log('[DEBUG] loadAchievements called with achievements:', achievements);
        // ... implementation ...
        console.log('[DEBUG] loadAchievements finished.');
    }

    function renderAchievements(achievements) {
        console.log('[DEBUG] renderAchievements called with achievements:', achievements);
        // ... implementation ...
        console.log('[DEBUG] renderAchievements finished.');
    }

    async function loadAllAchievements() {
        console.log('[DEBUG] loadAllAchievements (for admin) started.');
        // ... implementation ...
        console.log('[DEBUG] loadAllAchievements (for admin) finished.');
    }

    console.log('[DEBUG] Profile script initialization finished, waiting for async operations.');
})();
