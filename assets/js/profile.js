// Importing Firebase services and specific functions
// Using centralized Firebase initialization from firebase-core
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

// Import reCAPTCHA manager and error handling utilities
import { getFriendlyAuthError, isRecaptchaError } from './auth-errors.js';

// Wrap everything in an async function to allow early returns
(async function() {
    const auth = getFirebaseAuth();
    const app = getFirebaseApp();
    console.log('[Profile] Firebase services obtained successfully');
    // Add immediate loading timeout as backup
    let loadingTimeout = setTimeout(() => {
        console.warn('Loading timeout reached, showing fallback content');
        hideLoadingAndShowFallback();
    }, 5000); // 5 second timeout

    function hideLoadingAndShowFallback() {
        const loadingState = document.getElementById('loading-state');
        const profileContent = document.getElementById('profile-content');

        if (loadingState) {
            loadingState.style.display = 'none';
            loadingState.style.visibility = 'hidden';
            loadingState.classList.add('hidden');
            loadingState.setAttribute('hidden', 'true');
            console.log('Profile loading state hidden');
        }

        if (profileContent) {
            profileContent.innerHTML = `
                <div class="text-center py-20">
                    <h1 class="text-5xl font-racing uppercase mb-2">User <span class="neon-yellow">Profile</span></h1>
                    <div class="text-yellow-400 mb-6">
                        <h2 class="text-2xl font-bold">Profile Temporarily Unavailable</h2>
                        <p class="mt-2">Our services are currently unavailable.</p>
                        <p class="text-sm text-slate-400 mt-2">This could be due to network issues or temporary service downtime.</p>
                        <p class="text-sm text-slate-400 mt-1">Please check your internet connection and try again.</p>
                    </div>
                    <div class="space-x-4">
                        <button onclick="window.location.reload()" class="bg-blue-600 text-white font-bold py-2 px-4 rounded-md hover:bg-blue-500 transition">
                            Try Again
                        </button>
                        <a href="index.html" class="bg-slate-600 text-white font-bold py-2 px-4 rounded-md hover:bg-slate-500 transition">
                            Go Home
                        </a>
                    </div>
                </div>
            `;
            profileContent.classList.remove('hidden');
            console.log('Profile fallback content shown');
        }

        if (loadingTimeout) {
            clearTimeout(loadingTimeout);
            loadingTimeout = null;
        }
    }

    // UI Elements
    const loadingState = document.getElementById('loading-state');
    const profileContent = document.getElementById('profile-content');
    const errorState = document.getElementById('error-state');
    const logoutButton = document.getElementById('logout-button');

    // Profile elements
    const profileAvatar = document.getElementById('profile-avatar');
    const profileAvatarPlaceholder = document.getElementById('profile-avatar-placeholder');
    const profileDisplayName = document.getElementById('profile-display-name');
    const profileUsername = document.getElementById('profile-username');
    const profileBio = document.getElementById('profile-bio');
    const profileFavoriteCars = document.getElementById('profile-favorite-cars');
    const profileJoinDate = document.getElementById('profile-join-date');

    // Form elements
    const editProfileBtn = document.getElementById('edit-profile-btn');
    const profileDisplay = document.getElementById('profile-display');
    const profileEditForm = document.getElementById('profile-edit-form');
    const editUsername = document.getElementById('edit-username');
    const editDisplayName = document.getElementById('edit-display-name');
    const editBio = document.getElementById('edit-bio');
    const editAvatarUrl = document.getElementById('edit-avatar-url');
    const editFavoriteCars = document.getElementById('edit-favorite-cars');
    const saveProfileBtn = document.getElementById('save-profile-btn');
    const cancelEditBtn = document.getElementById('cancel-edit-btn');

    // Achievement elements
    const userAchievements = document.getElementById('user-achievements');
    const adminAchievements = document.getElementById('admin-achievements');

    let currentUser = null;
    let isEditing = false;
    let isCurrentUserProfile = false;

    // Set up authentication state monitoring with enhanced error handling
    console.log('[Profile] Setting up authentication state monitoring');
    
    const authUnsubscribe = monitorAuthState(
        async (user, validToken) => {
            clearAuthError(); // Clear any previous auth errors
            
            if (user && validToken) {
                console.log('[Profile] User authenticated successfully', {
                    uid: user.uid,
                    email: user.email,
                    emailVerified: user.emailVerified
                });

                currentUser = user;
                const targetUserId = getUserIdFromUrl() || user.uid;
                isCurrentUserProfile = (targetUserId === user.uid);

                // Load the user profile with enhanced error handling
                try {
                    await loadUserProfile(targetUserId);
                } catch (profileError) {
                    console.error('[Profile] Error loading profile:', profileError);
                    showAuthError({
                        code: 'profile-load-failed',
                        message: 'Failed to load user profile',
                        userMessage: 'Unable to load profile data. Please refresh the page and try again.',
                        requiresReauth: false,
                        retryable: true
                    });
                    showErrorState();
                    return;
                }

                // Check if user is admin for achievements management using new validation
                try {
                    const claimsResult = await validateUserClaims(['team-member']);
                    const isAdmin = claimsResult.success && claimsResult.claims.role === 'team-member';
                    
                    console.log('[Profile] User role validation', {
                        isAdmin,
                        role: claimsResult.claims?.role,
                        hasPermissions: claimsResult.success
                    });

                    if (isAdmin && adminAchievements) {
                        adminAchievements.classList.remove('hidden');
                        
                        // Load achievements with safe operation wrapper
                        const achievementsResult = await safeFirestoreOperation(
                            loadAllAchievements,
                            ['team-member'],
                            'Load achievements for admin'
                        );
                        
                        if (!achievementsResult.success) {
                            console.error('[Profile] Error loading achievements:', achievementsResult.error);
                            showAuthError(achievementsResult.error);
                        }
                    }
                } catch (claimsError) {
                    console.error('[Profile] Error validating user claims:', claimsError);
                    // Don't show error for claims validation failure - just hide admin features
                }

                // Hide loading and show content
                hideLoadingAndShowContent();

            } else {
                console.log('[Profile] User not authenticated, redirecting to login');
                window.location.href = 'login.html';
            }
        },
        (error) => {
            console.error('[Profile] Authentication error:', error);
            showAuthError(error);
            
            if (error.requiresReauth) {
                // Redirect to login for auth errors that require re-authentication
                setTimeout(() => {
                    navigateToInternal('/login.html');
                }, 3000);
            } else {
                // Show error state for other auth issues
                showErrorState();
            }
        }
    );

    // Set up logout button with enhanced error handling
    if (logoutButton) {
        logoutButton.addEventListener('click', async () => {
            try {
                console.log('[Profile] Signing out user');
                await signOut(auth);
                console.log('[Profile] User signed out successfully');
                window.location.href = 'login.html';
            } catch (error) {
                console.error('[Profile] Error signing out:', error);
                showAuthError({
                    code: 'logout-failed',
                    message: 'Logout failed',
                    userMessage: 'Failed to sign out. Redirecting to login page.',
                    requiresReauth: false,
                    retryable: false
                });
                // Still redirect even if logout fails
                window.location.href = 'login.html';
            }
        });
    }

    // Add loading timeout to prevent infinite loading
    function setupLoadingTimeout() {
        if (loadingTimeout) clearTimeout(loadingTimeout);
        loadingTimeout = setTimeout(() => {
            console.warn('Loading timeout reached, hiding loading state');
            hideLoadingAndShowContent();
        }, 10000); // 10 second timeout
    }

    function hideLoadingAndShowContent() {
        if (loadingState) {
            loadingState.classList.add('hidden');
        }
        if (profileContent) {
            profileContent.classList.remove('hidden');
        }
        if (loadingTimeout) {
            clearTimeout(loadingTimeout);
            loadingTimeout = null;
        }
    }

    // Helper function to centralize loading state cleanup
    function finalizeProfileLoad() {
        console.log('[Profile] Finalizing profile load, clearing loading state');
        if (loadingState) {
            loadingState.classList.add('hidden');
        }
        if (loadingTimeout) {
            clearTimeout(loadingTimeout);
            loadingTimeout = null;
        }
    }

    // Start the loading timeout immediately
    setupLoadingTimeout();

    // Helper function to safely format timestamps from various sources
    function formatFirestoreTimestamp(timestamp, fallback = 'Unknown') {
        if (!timestamp) {
            return fallback;
        }

        try {
            // Handle Firestore Timestamp objects with .seconds property
            if (timestamp && typeof timestamp === 'object' && timestamp.seconds) {
                return new Date(timestamp.seconds * 1000).toLocaleDateString();
            }
            
            // Handle Date objects
            if (timestamp instanceof Date) {
                return timestamp.toLocaleDateString();
            }
            
            // Handle string representations
            if (typeof timestamp === 'string') {
                const date = new Date(timestamp);
                if (!isNaN(date.getTime())) {
                    return date.toLocaleDateString();
                }
            }
            
            // Handle numeric timestamps (milliseconds)
            if (typeof timestamp === 'number') {
                const date = new Date(timestamp);
                if (!isNaN(date.getTime())) {
                    return date.toLocaleDateString();
                }
            }
            
            console.warn('Unable to parse timestamp:', timestamp);
            return fallback;
        } catch (error) {
            console.error('Error formatting timestamp:', error, timestamp);
            return fallback;
        }
    }

    // Get user ID from URL or use current user
    function getUserIdFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('id');
    }

    // Helper function to call profile API endpoints
    async function callProfileAPI(endpoint, method = 'GET', data = null) {
        const db = getFirebaseDb();

        // Firestore fallback: GET /profile/:id
        const profileGet = endpoint.match(/^\/profile\/([^/]+)$/);
        if (db && method === 'GET' && profileGet) {
            const userId = profileGet[1];
            const profileRef = doc(db, 'profiles', userId);
            const snap = await getDoc(profileRef);

            if (!snap.exists()) {
                const error = new Error('Profile not found');
                error.code = 'not-found';
                throw error;
            }

            const profile = snap.data() || {};

            // Load achievements subcollection (optional)
            let achievements = [];
            try {
                const achRef = collection(db, 'profiles', userId, 'achievements');
                const achSnap = await getDocs(achRef);
                achievements = achSnap.docs.map(d => ({ id: d.id, ...(d.data() || {}) }));
            } catch (_) { /* ignore if missing */ }

            return { ...profile, achievements };
        }

        // Firestore fallback: PUT/PATCH /update_profile/:id
        const profilePut = endpoint.match(/^\/update_profile\/([^/]+)$/);
        if (db && (method === 'PUT' || method === 'PATCH') && profilePut) {
            const userId = profilePut[1];
            const profileRef = doc(db, 'profiles', userId);

            const payload = {
                username: data?.username || '',
                displayName: data?.displayName || 'Anonymous User',
                bio: data?.bio || '',
                avatarUrl: data?.avatarUrl || '',
                favoriteCars: Array.isArray(data?.favoriteCars) ? data.favoriteCars : [],
                joinDate: data?.joinDate || new Date().toISOString(),
                totalPoints: typeof data?.totalPoints === 'number' ? data.totalPoints : 0,
                achievementCount: typeof data?.achievementCount === 'number' ? data.achievementCount : 0,
            };

            await setDoc(profileRef, payload, { merge: true });
            const saved = await getDoc(profileRef);
            return saved.exists() ? saved.data() : payload;
        }

        // Optional Firestore fallback placeholders
        const progressGet = endpoint.match(/^\/achievement_progress\/([^/]+)$/);
        if (db && method === 'GET' && progressGet) {
            return {};
        }
        if (db && method === 'POST' && endpoint === '/auto_award_achievement') {
            return { awardedAchievements: [] };
        }

        // Original network flow retained for future backend
        let tokenValidation = null;
        let options = {};

        // For authenticated requests, validate and refresh token
        if (currentUser) {
            tokenValidation = await validateAndRefreshToken();
            
            if (!tokenValidation.success) {
                console.error('[Profile] Token validation failed for API call:', tokenValidation.error);
                
                // For GET requests, we might still try without auth for public profile viewing
                if (method === 'GET') {
                    console.log(`[Profile] Attempting ${endpoint} without authentication for public access`);
                    options = {
                        method,
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    };
                } else {
                    throw new Error(`Authentication failed: ${tokenValidation.error.userMessage}`);
                }
            } else {
                options = {
                    method,
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${tokenValidation.token}`
                    }
                };
            }
        } else {
            // Unauthenticated request
            options = {
                method,
                headers: {
                    'Content-Type': 'application/json'
                }
            };
        }
        
        if (data && method !== 'GET') {
            options.body = JSON.stringify(data);
        }
        
        console.log(`[Profile] Calling API: ${method} ${endpoint}${tokenValidation?.success ? ' (authenticated with validated token)' : ' (unauthenticated)'}`);
        
        let response = await fetch(endpoint, options);
        
        // For GET requests, retry without auth if we get 401/403 (for public profile viewing)
        if (!response.ok && method === 'GET' && (response.status === 401 || response.status === 403) && tokenValidation?.success) {
            console.log(`[Profile] Retrying ${endpoint} without authentication for public access`);
            const publicOptions = {
                method,
                headers: {
                    'Content-Type': 'application/json'
                }
            };
            response = await fetch(endpoint, publicOptions);
        }
        
        if (!response.ok) {
            const error = new Error(`HTTP error! status: ${response.status}`);
            error.status = response.status;
            console.error(`[Profile] API call failed: ${response.status} ${response.statusText}`);
            
            // Handle specific authentication errors with user feedback
            if (response.status === 404) {
                error.code = 'not-found';
            } else if (response.status === 401) {
                error.code = 'unauthorized';
                showAuthError({
                    code: 'api-unauthorized',
                    message: 'API call unauthorized',
                    userMessage: 'Your session has expired. Please sign in again.',
                    requiresReauth: true,
                    retryable: false
                });
            } else if (response.status === 403) {
                error.code = 'forbidden';
                showAuthError({
                    code: 'api-forbidden',
                    message: 'API call forbidden',
                    userMessage: 'You do not have permission to perform this action.',
                    requiresReauth: false,
                    retryable: false
                });
            } else if (response.status >= 500) {
                showAuthError({
                    code: 'server-error',
                    message: 'Server error',
                    userMessage: 'Server error occurred. Please try again later.',
                    requiresReauth: false,
                    retryable: true
                });
            }
            
            throw error;
        }
        
        console.log(`[Profile] API call successful: ${method} ${endpoint}`);
        return response.json();
    }

    // Load user profile
    async function loadUserProfile(userId) {
        console.log(`[Profile] Loading profile for user: ${userId}`);
        try {
            const profileData = await callProfileAPI(`/profile/${userId}`);
            displayProfile(profileData);
            loadAchievements(profileData.achievements || []);

            // Load achievement progress for current user's profile
            if (isCurrentUserProfile) {
                await loadAchievementProgress(userId);
            }
            console.log(`[Profile] Successfully loaded profile for user: ${userId}`);
        } catch (error) {
            console.error(`[Profile] Error loading profile for ${userId}:`, error);
            
            // Distinguish between different error types and handle appropriately
            if (error.code === 'not-found') {
                console.log(`[Profile] Profile not found for ${userId}`);
                if (isCurrentUserProfile) {
                    console.log('[Profile] Creating default profile for current user');
                    try {
                        await createDefaultProfile(userId);
                        return; // Successfully created and loaded profile
                    } catch (createError) {
                        console.error('[Profile] Failed to create default profile:', createError);
                        displayMinimalProfile(userId);
                        finalizeProfileLoad();
                        return;
                    }
                } else {
                    console.log('[Profile] Showing minimal profile for other user');
                    displayMinimalProfile(userId);
                    finalizeProfileLoad();
                    return;
                }
            } else if (error.code === 'unauthorized' || error.code === 'forbidden' || error.code === 'permission-denied' || error.code === 'unauthenticated') {
                console.log(`[Profile] Access denied (${error.code}) for ${userId}, showing minimal profile`);
                displayMinimalProfile(userId);
                finalizeProfileLoad();
                return;
            } else {
                console.error(`[Profile] Network or server error for ${userId}:`, error);
                displayMinimalProfile(userId);
                finalizeProfileLoad();
                return;
            }
        }
    }

    // Create default profile for new users
    async function createDefaultProfile(userId) {
        const defaultProfile = {
            username: currentUser.email.split('@')[0], // Use email username as default
            displayName: currentUser.displayName || 'Anonymous User',
            bio: '',
            avatarUrl: '',
            favoriteCars: [],
            joinDate: new Date().toISOString()
        };

        try {
            console.log(`[Profile] Creating default profile for user ${userId}`);
            await callProfileAPI(`/update_profile/${userId}`, 'PUT', defaultProfile);
            // Award community member achievement for profile creation
            await autoAwardAchievement(userId, 'profile_created');

            // Reload profile after creation - this will handle loading state
            await loadUserProfile(userId);
        } catch (error) {
            console.error('[Profile] Error creating default profile:', error);
            displayMinimalProfile(userId);
            finalizeProfileLoad();
        }
    }

    // Display profile data
    function displayProfile(profileData) {
        profileDisplayName.textContent = profileData.displayName || 'Anonymous User';
        profileUsername.textContent = `@${profileData.username || 'unknown'}`;
        profileBio.textContent = profileData.bio || 'No bio provided.';

        // Handle avatar
        if (profileData.avatarUrl) {
            profileAvatar.src = profileData.avatarUrl;
            profileAvatar.classList.remove('hidden');
            profileAvatarPlaceholder.classList.add('hidden');
        } else {
            profileAvatar.classList.add('hidden');
            profileAvatarPlaceholder.classList.remove('hidden');
            profileAvatarPlaceholder.textContent = (profileData.displayName || 'U').charAt(0).toUpperCase();
        }

        // Handle favorite cars
        if (profileData.favoriteCars && profileData.favoriteCars.length > 0) {
            // Clear existing content
            profileFavoriteCars.innerHTML = '';
            // Create safe elements for each car
            profileData.favoriteCars.forEach(car => {
                const span = createSafeElement('span', car, 'bg-slate-700 text-slate-300 px-2 py-1 rounded-md text-sm');
                profileFavoriteCars.appendChild(span);
            });
        } else {
            setSafeText(profileFavoriteCars, 'No favorite cars added.');
            profileFavoriteCars.className = 'text-slate-400';
        }

        // Handle join date
        if (profileData.joinDate) {
            profileJoinDate.textContent = formatFirestoreTimestamp(profileData.joinDate);
        } else {
            profileJoinDate.textContent = 'Unknown';
        }

        // Pre-fill edit form
        editUsername.value = profileData.username || '';
        editDisplayName.value = profileData.displayName || '';
        editBio.value = profileData.bio || '';
        editAvatarUrl.value = profileData.avatarUrl || '';
        editFavoriteCars.value = profileData.favoriteCars ? profileData.favoriteCars.join(', ') : '';

        // Show edit button only for current user's profile
        if (editProfileBtn) {
            editProfileBtn.style.display = isCurrentUserProfile ? 'block' : 'none';
        }

        hideLoadingAndShowContent();
        finalizeProfileLoad();
    }

    // Load achievements
    let userAchievementsData = []; // Store achievements data for filtering

    // Display minimal profile when backend is not available
    function displayMinimalProfile(userId) {
        console.log(`[Profile] Displaying minimal profile for user: ${userId}`);
        const user = auth?.currentUser;
        if (!user) {
            console.warn('[Profile] Cannot display minimal profile - no authenticated user');
            hideLoadingAndShowFallback();
            return;
        }

        // Create a basic profile - if viewing current user, use their data; otherwise show generic profile
        const isViewingOwnProfile = (userId === user.uid);
        const basicProfile = {
            username: isViewingOwnProfile && user.email ? user.email.split('@')[0] : 'unknown',
            displayName: isViewingOwnProfile && user.displayName ? user.displayName : 'User Not Found',
            bio: isViewingOwnProfile ? 'Profile backend not available. Some features may not work correctly.' : 'This user profile could not be loaded',
            avatarUrl: isViewingOwnProfile ? (user.photoURL || '') : '',
            favoriteCars: [],
            joinDate: new Date().toISOString()
        };

        displayProfile(basicProfile);
        loadAchievements([]); // Load empty achievements

        console.log(`[Profile] Displayed minimal profile due to ${isViewingOwnProfile ? 'backend unavailability' : 'user not found/access denied'}`);
    }

    function loadAchievements(achievements) {
        userAchievementsData = achievements; // Store for filtering

        if (achievements.length === 0) {
            userAchievements.innerHTML = '<p class="text-slate-400">No achievements yet. Keep racing!</p>';
            document.getElementById('achievement-summary').classList.add('hidden');
            document.getElementById('category-filter').classList.add('hidden');
            return;
        }

        // Show achievement summary and filter
        document.getElementById('achievement-summary').classList.remove('hidden');
        document.getElementById('category-filter').classList.remove('hidden');

        // Calculate total points
        const totalPoints = achievements.reduce((sum, achievement) => sum + (achievement.points || 0), 0);
        document.getElementById('total-points').textContent = totalPoints;
        document.getElementById('total-achievements-count').textContent = achievements.length;

        // Render achievements
        renderAchievements(achievements);
    }

    function renderAchievements(achievements) {
        if (achievements.length === 0) {
            userAchievements.innerHTML = '<p class="text-slate-400">No achievements in this category.</p>';
            return;
        }

        // Clear existing content
        userAchievements.innerHTML = '';
        
        achievements.forEach(achievement => {
            // Ensure category defaults to 'uncategorized' if missing
            const category = achievement.category || 'uncategorized';
            const dateEarnedText = achievement.dateEarned ? formatFirestoreTimestamp(achievement.dateEarned) : '';
            
            const achievementHTML = html`
            <div class="achievement-item flex items-center space-x-3 p-3 bg-slate-700 rounded-md" data-category="${category}">
                <div class="w-10 h-10 bg-yellow-500 rounded-full flex items-center justify-center">
                    ${achievement.icon || '🏆'}
                </div>
                <div class="flex-1">
                    <div class="flex items-center justify-between mb-1">
                        <h4 class="font-bold text-white">${achievement.name}</h4>
                        <div class="flex items-center space-x-2">
                            <span class="achievement-category-badge">${getCategoryDisplayName(category)}</span>
                            <span class="text-xs font-racing text-neon-yellow">${achievement.points || 0}pts</span>
                        </div>
                    </div>
                    <p class="text-sm text-slate-400">${achievement.description}</p>
                    ${dateEarnedText ? html`<p class="text-xs text-slate-500">Earned: ${dateEarnedText}</p>` : ''}
                </div>
            </div>
            `;
            
            const achievementElement = document.createElement('div');
            safeSetHTML(achievementElement, achievementHTML);
            userAchievements.appendChild(achievementElement.firstElementChild);
        });
    }

    function getCategoryDisplayName(category) {
        const categoryMap = {
            'racing': '🏁 Racing',
            'performance': '⚡ Performance',
            'community': '👥 Community',
            'sportsmanship': '✨ Fair Play',
            'uncategorized': '📋 Other'
        };
        return categoryMap[category] || '📋 Other';
    }

    function filterAchievementsByCategory(category) {
        if (category === 'all') {
            renderAchievements(userAchievementsData);
        } else {
            const filteredAchievements = userAchievementsData.filter(achievement => {
                const achievementCategory = achievement.category || 'uncategorized';
                return achievementCategory === category;
            });
            renderAchievements(filteredAchievements);
        }
    }

    // Auto award achievement helper function
    async function autoAwardAchievement(userId, actionType, actionData = {}) {
        try {
            const response = await fetch('/auto_award_achievement', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    userId: userId,
                    actionType: actionType,
                    actionData: actionData
                })
            });

            if (response.ok) {
                const result = await response.json();
                if (result.awardedAchievements && result.awardedAchievements.length > 0) {
                    console.log('Achievements awarded:', result.awardedAchievements);
                    // Optionally show a notification to the user
                    showAchievementNotification(result.awardedAchievements);
                }
                return result;
            } else if (response.status === 404) {
                console.log('Achievement endpoint not available. This is expected if Cloud Functions are not deployed.');
                return null;
            } else {
                console.warn('Achievement request failed:', response.statusText);
                return null;
            }
        } catch (error) {
            if (error.message.includes('Failed to fetch') || error.name === 'TypeError') {
                console.log('Achievement backend not available, skipping auto-award');
            } else {
                console.error('Error auto-awarding achievement:', error);
            }
            return null;
        }
    }

    // Show achievement notification
    function showAchievementNotification(achievements) {
        achievements.forEach(achievement => {
            // Create a simple toast notification
            const notification = document.createElement('div');
            notification.className = 'fixed top-4 right-4 bg-neon-yellow text-black p-4 rounded-lg shadow-lg z-50 animate-pulse';
            notification.innerHTML = `
                <div class="flex items-center space-x-3">
                    <div class="w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center">🏆</div>
                    <div>
                        <h4 class="font-bold">Achievement Unlocked!</h4>
                        <p class="text-sm">${achievement.name}</p>
                    </div>
                </div>
            `;

            document.body.appendChild(notification);

            // Remove after 5 seconds
            setTimeout(() => {
                if (notification && notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 5000);
        });
    }

    // Load achievement progress
    async function loadAchievementProgress(userId) {
        try {
            const response = await fetch(`/achievement_progress/${userId}`);
            if (response.ok) {
                const progressData = await response.json();
                displayAchievementProgress(progressData);
            }
        } catch (error) {
            console.error('Error loading achievement progress:', error);
        }
    }

    // Display achievement progress
    function displayAchievementProgress(progressData) {
        const progressSection = document.getElementById('achievement-progress-section');
        const progressContainer = document.getElementById('achievement-progress');

        if (Object.keys(progressData).length === 0) {
            progressSection.classList.add('hidden');
            return;
        }

        progressSection.classList.remove('hidden');

        const progressItems = Object.entries(progressData).map(([achievementId, progress]) => {
            return `
                <div class="bg-slate-700 rounded-lg p-4">
                    <div class="flex items-center justify-between mb-2">
                        <h4 class="font-bold text-white">${getAchievementName(achievementId)}</h4>
                        <span class="text-sm text-slate-400">${progress.current}/${progress.target}</span>
                    </div>
                    <p class="text-sm text-slate-400 mb-3">${progress.description}</p>
                    <div class="w-full bg-slate-600 rounded-full h-2">
                        <div class="bg-neon-yellow h-2 rounded-full transition-all duration-300"
                             style="width: ${progress.percentage}%"></div>
                    </div>
                    <div class="text-xs text-slate-500 mt-1">${Math.round(progress.percentage)}% complete</div>
                </div>
            `;
        }).join('');

        progressContainer.innerHTML = progressItems;
    }

    // Get achievement display name
    function getAchievementName(achievementId) {
        const achievementNames = {
            'photographer': '📸 Photographer',
            'fan_favorite': '❤️ Fan Favorite',
            'community_member': '👥 Community Member',
            'first_race': '🏁 First Race',
            'speed_demon': '⚡ Speed Demon',
            'consistent_racer': '🎯 Consistent Racer',
            'podium_finish': '🏆 Podium Finish',
            'clean_racer': '✨ Clean Racer',
            'season_veteran': '🗓️ Season Veteran',
            'track_master': '🏅 Track Master'
        };
        return achievementNames[achievementId] || achievementId;
    }

    // Show error state
    function showErrorState() {
        console.log('[Profile] Showing error state');
        if (loadingState) {
            loadingState.classList.add('hidden');
        }
        if (profileContent) {
            profileContent.classList.add('hidden');
        }
        if (errorState) {
            errorState.classList.remove('hidden');
        }
        finalizeProfileLoad();
    }

    // Toggle edit mode
    async function toggleEditMode() {
        isEditing = !isEditing;
        if (isEditing) {
            profileDisplay.classList.add('hidden');
            profileEditForm.classList.remove('hidden');
            editProfileBtn.textContent = 'Cancel';
        } else {
            profileDisplay.classList.remove('hidden');
            profileEditForm.classList.add('hidden');
            editProfileBtn.textContent = 'Edit Profile';
        }
    }

    // Save profile changes with reCAPTCHA Enterprise protection
    async function saveProfile() {
        if (!currentUser) return;

        // Basic validation
        const username = editUsername.value.trim();
        const displayName = editDisplayName.value.trim();

        if (!username || !displayName) {
            alert('Username and Display Name are required.');
            return;
        }

        // Validate username format (alphanumeric and underscores only)
        if (!/^[a-zA-Z0-9_]+$/.test(username)) {
            alert('Username can only contain letters, numbers, and underscores.');
            return;
        }

        // Validate avatar URL if provided
        const avatarUrl = editAvatarUrl.value.trim();
        if (avatarUrl && !isValidUrl(avatarUrl)) {
            alert('Please enter a valid avatar URL.');
            return;
        }

        saveProfileBtn.disabled = true;
        saveProfileBtn.textContent = 'Saving...';

        const profileData = {
            username: username,
            displayName: displayName,
            bio: editBio.value.trim(),
            avatarUrl: avatarUrl,
            favoriteCars: editFavoriteCars.value.split(',').map(car => car.trim()).filter(car => car)
        };

        try {
            await callProfileAPI(`/update_profile/${currentUser.uid}`, 'PUT', profileData);

            await loadUserProfile(currentUser.uid);
            await toggleEditMode();
            
        } catch (error) {
            console.error('Error saving profile:', error);
            alert('Failed to save profile. Please try again.');
        } finally {
            saveProfileBtn.disabled = false;
            saveProfileBtn.textContent = 'Save Changes';
        }
    }

    // Helper function to validate URLs
    function isValidUrl(string) {
        try {
            new URL(string);
            return true;
        } catch (_) {
            return false;
        }
    }

    // Helper function to format Firestore timestamps in various formats
    function formatFirestoreTimestamp(ts) {
        try {
            // Handle Firestore Timestamp-like objects: {seconds, nanoseconds}
            if (ts && typeof ts === 'object' && ts.seconds !== undefined) {
                return new Date(ts.seconds * 1000).toLocaleDateString();
            }
            // Handle JS Date instances
            if (ts instanceof Date) {
                return ts.toLocaleDateString();
            }
            // Handle ISO/parsable strings
            if (typeof ts === 'string') {
                const date = new Date(ts);
                if (!isNaN(date.getTime())) {
                    return date.toLocaleDateString();
                }
            }
            // Return empty string on failure
            return '';
        } catch (error) {
            console.warn('Failed to format timestamp:', ts, error);
            return '';
        }
    }

    // Event listeners with null checks
    if (editProfileBtn) {
        editProfileBtn.addEventListener('click', toggleEditMode);
    }
    if (cancelEditBtn) {
        cancelEditBtn.addEventListener('click', toggleEditMode);
    }
    if (saveProfileBtn) {
        saveProfileBtn.addEventListener('click', saveProfile);
    }

    // Category filter event listeners
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('category-filter-btn')) {
            // Update active state
            document.querySelectorAll('.category-filter-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            e.target.classList.add('active');

            // Filter achievements
            const category = e.target.dataset.category;
            filterAchievementsByCategory(category);
        }
    });

    // Admin functions for achievement management
    async function loadAllAchievements() {
        try {
            const db = getFirebaseDb();
            
            if (!db) {
                console.error('Firestore database not available');
                displayAllAchievements([]);
                showUserFriendlyError('Unable to connect to database. Please check your connection and try again.');
                return;
            }

            console.log('[Profile] Loading achievements from Firestore...');
            const achievementsRef = collection(db, 'achievements');
            const achievementsSnapshot = await getDocs(achievementsRef);
            
            const achievements = achievementsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            console.log(`[Profile] Successfully loaded ${achievements.length} achievements from Firestore`);
            displayAllAchievements(achievements);
        } catch (error) {
            console.error('Error loading achievements from Firestore:', error);
            displayAllAchievements([]);
            
            // Provide user-friendly error message based on error type
            if (error.code === 'permission-denied') {
                showUserFriendlyError('You do not have permission to view achievements. Please check your account status.');
            } else if (error.code === 'unavailable') {
                showUserFriendlyError('Achievement service is temporarily unavailable. Please try again later.');
            } else {
                showUserFriendlyError('Failed to load achievements. Please refresh the page and try again.');
            }
        }
    }

    // Helper function to show user-friendly error messages
    function showUserFriendlyError(message) {
        // Show error in the admin achievements section if it exists
        const allAchievements = document.getElementById('all-achievements');
        if (allAchievements) {
            allAchievements.textContent = message;
        }
        
        // Also log for debugging
        console.warn('[Profile] User-friendly error shown:', message);
    }

    function displayAllAchievements(achievements) {
        const allAchievements = document.getElementById('all-achievements');
        if (achievements.length === 0) {
            allAchievements.innerHTML = '<p class="text-slate-400">No achievements available.</p>';
            return;
        }

        allAchievements.innerHTML = achievements.map(achievement => `
            <div class="flex items-center justify-between p-3 bg-slate-700 rounded-md">
                <div class="flex items-center space-x-3">
                    <div class="w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center text-sm">
                        ${achievement.icon || '🏆'}
                    </div>
                    <div>
                        <h4 class="font-bold text-white text-sm">${achievement.name}</h4>
                        <p class="text-xs text-slate-400">${achievement.description}</p>
                        <p class="text-xs text-slate-500">${achievement.category} • ${achievement.points || 0} pts</p>
                    </div>
                </div>
                <button onclick="assignAchievementToUser('${achievement.id}')" class="bg-green-600 text-white text-xs px-3 py-1 rounded hover:bg-green-500 transition">
                    Assign
                </button>
            </div>
        `).join('');
    }

    // Global function for assigning achievements (called from HTML)
    window.assignAchievementToUser = async function(achievementId) {
        const targetUserId = getUserIdFromUrl();
        if (!targetUserId || !currentUser) {
            alert('Cannot assign achievement: No target user or current user not authenticated');
            return;
        }

        if (targetUserId === currentUser.uid) {
            alert('Cannot assign achievement to yourself');
            return;
        }

        const confirmAssign = confirm(`Assign this achievement to the user?`);
        if (!confirmAssign) return;

        try {
            const userToken = await currentUser.getIdToken();
            const response = await fetch('/assign_achievement', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${userToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    userId: targetUserId,
                    achievementId: achievementId
                })
            });

            if (response.ok) {
                alert('Achievement assigned successfully!');
                // Reload user profile to show new achievement
                await loadUserProfile(targetUserId, userToken);
            } else if (response.status === 400) {
                alert('User already has this achievement or invalid data');
            } else {
                throw new Error(`Failed to assign achievement: ${response.statusText}`);
            }
        } catch (error) {
            console.error('Error assigning achievement:', error);
            alert('Failed to assign achievement. Please try again.');
        }
    };

    // Only setup Firebase event listeners if initialization was successful
    if (auth) {
        console.log('[Profile] Firebase services available, authentication monitoring already set up above');
        // The authentication state monitoring is now handled above with monitorAuthState
    } else {
        console.error('[Profile] Cannot setup Firebase event listeners - services not available');
        hideLoadingAndShowFallback();
    }

    // Clear the loading timeout since we successfully loaded
    if (loadingTimeout) {
        clearTimeout(loadingTimeout);
        loadingTimeout = null;
    }

})(); // End of async function wrapper
