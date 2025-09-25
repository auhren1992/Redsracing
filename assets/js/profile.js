import './app.js';

// Fixed Profile Module - Resolves infinite loading and logout issues
import { getFirebaseAuth, getFirebaseApp, getFirebaseDb } from './firebase-core.js';
import { signOut } from "firebase/auth";
import { doc, getDoc, setDoc, collection, getDocs } from "firebase/firestore";

// Import centralized authentication utilities
import { 
    validateAndRefreshToken, 
    validateUserClaims, 
    safeFirestoreOperation, 
    retryAuthOperation,
    showAuthError,
    clearAuthError,
    monitorAuthState,
    getCurrentUser,
    safeSignOut
} from './auth-utils.js';

// Import sanitization utilities
import { html, safeSetHTML, setSafeText, createSafeElement } from './sanitize.js';

// Import navigation helpers
import { navigateToInternal } from './navigation-helpers.js';

// Import error handling utilities
import { getFriendlyAuthError, isRecaptchaError } from './auth-errors.js';

// Wrap everything in an async function to allow early returns
(async function() {


    // Track initialization and cleanup state
    let isInitialized = false;
    let isDestroyed = false;
    let loadingTimeout = null;
    let authStateUnsubscribe = null;
    let isProcessingAuth = false; // Guard against re-entrant auth calls

    const auth = getFirebaseAuth();
    const app = getFirebaseApp();
    const db = getFirebaseDb();
    


    // Check if Firebase services are available
    if (!auth || !app || !db) {

        hideLoadingAndShowFallback();
        return;
    }

    // Add immediate loading timeout as backup
    function startLoadingTimeout() {
        if (loadingTimeout) clearTimeout(loadingTimeout);
        
        loadingTimeout = setTimeout(() => {
            if (isDestroyed) return;
            

            hideLoadingAndShowFallback();
        }, 15000); // 15 second timeout
    }

    function clearLoadingTimeout() {
        if (loadingTimeout) {
            clearTimeout(loadingTimeout);
            loadingTimeout = null;
        }
    }

    function hideLoadingAndShowFallback() {
        if (isDestroyed) return;
        
        const loadingState = document.getElementById('loading-state');
        const profileContent = document.getElementById('profile-content');

        if (loadingState) {
            loadingState.style.display = 'none';
            loadingState.style.visibility = 'hidden';
            loadingState.classList.add('hidden');
            loadingState.setAttribute('hidden', 'true');

        }

        if (profileContent) {
            profileContent.innerHTML = `
                <div class="text-center py-20">
                    <h1 class="text-5xl font-racing uppercase mb-2">User <span class="neon-yellow">Profile</span></h1>
                    <div class="text-yellow-400 mb-6">
                        <div class="text-6xl mb-4">⚠️</div>
                        <h2 class="text-2xl font-bold">Profile Temporarily Unavailable</h2>
                        <p class="mt-2">We're unable to load your profile right now.</p>
                        <p class="text-sm text-slate-400 mt-2">This could be a temporary connectivity or service issue.</p>
                    </div>
                    <div class="space-x-4">
                        <button onclick="window.location.reload()" class="bg-blue-600 text-white font-bold py-2 px-4 rounded-md hover:bg-blue-500 transition">Try Again</button>
                        <a href="index.html" class="bg-slate-600 text-white font-bold py-2 px-4 rounded-md hover:bg-slate-500 transition">Go Home</a>
                    </div>
                </div>
            `;
            profileContent.classList.remove('hidden');

        }

        clearLoadingTimeout();
    }

    function hideLoadingAndShowContent() {
        if (isDestroyed) return;
        

        const loadingState = document.getElementById('loading-state');
        const profileContent = document.getElementById('profile-content');
        
        if (loadingState) {
            loadingState.classList.add('hidden');
        }
        if (profileContent) {
            profileContent.classList.remove('hidden');
        }
        
        clearLoadingTimeout();

    }

    function showErrorState(type = 'generic', message = null) {
        if (isDestroyed) return;
        

        const loadingState = document.getElementById('loading-state');
        const profileContent = document.getElementById('profile-content');
        const errorState = document.getElementById('error-state');
        
        if (loadingState) loadingState.classList.add('hidden');
        if (profileContent) profileContent.classList.add('hidden');
        if (errorState) errorState.classList.remove('hidden');
        
        clearLoadingTimeout();
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

    // Enhanced logout handler
    async function handleLogout() {
        if (isDestroyed) return;
        

        
        try {
            // Disable the logout button to prevent multiple clicks
            if (logoutButton) {
                logoutButton.disabled = true;
                logoutButton.textContent = 'Signing out...';
            }
            
            // Clean up any ongoing operations
            cleanup();
            
            // Attempt safe sign out
            const success = await safeSignOut();
            
            if (success) {

                setTimeout(() => {
                    navigateToInternal('/login.html');
                }, 100);
            } else {

                navigateToInternal('/login.html');
            }
            
        } catch (error) {

            navigateToInternal('/login.html');
        }
    }

    // Cleanup function to prevent memory leaks
    function cleanup() {

        isDestroyed = true;
        
        clearLoadingTimeout();
        
        if (authStateUnsubscribe) {
            authStateUnsubscribe();
            authStateUnsubscribe = null;
        }
        

    }

    // Start loading timeout immediately
    startLoadingTimeout();

    // Set up logout button with enhanced error handling
    if (logoutButton) {
        logoutButton.addEventListener('click', (e) => {
            e.preventDefault();
            handleLogout();
        });

    }

    // Get user ID from URL or use current user
    function getUserIdFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('id');
    }

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


            return fallback;
        } catch (error) {

            return fallback;
        }
    }

    // Helper function to call profile API endpoints
    async function callProfileAPI(endpoint, method = 'GET', data = null) {
        if (isDestroyed) return null;
        
        try {
            // Firestore fallback: GET /profile/:id
            const profileGet = endpoint.match(/^\/profile\/([^/]+)$/);
            if (db && method === 'GET' && profileGet) {
                const userId = profileGet[1];
                const profileRef = doc(db, 'users', userId);
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
                    const achRef = collection(db, 'users', userId, 'achievements');
                    const achSnap = await getDocs(achRef);
                    achievements = achSnap.docs.map(d => ({ id: d.id, ...(d.data() || {}) }));
                } catch (_) { /* ignore if missing */ }

                return { ...profile, achievements };
            }

            // Firestore fallback: PUT/PATCH /update_profile/:id
            const profilePut = endpoint.match(/^\/update_profile\/([^/]+)$/);
            if (db && (method === 'PUT' || method === 'PATCH') && profilePut) {
                const userId = profilePut[1];
                const profileRef = doc(db, 'users', userId);

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

            // If we get here, no Firestore fallback was available
            throw new Error(`API endpoint ${endpoint} not available - backend service unavailable`);

        } catch (error) {

            throw error;
        }
    }

    // Load user profile
    async function loadUserProfile(userId) {
        if (isDestroyed) {

            return;
        }
        

        try {
            const profileData = await callProfileAPI(`/profile/${userId}`);

            displayProfile(profileData);
            loadAchievements(profileData.achievements || []);


        } catch (error) {


            // Distinguish between different error types and handle appropriately
            if (error.code === 'not-found') {

                if (isCurrentUserProfile) {

                    try {
                        await createDefaultProfile(userId);
                        return; // Successfully created and loaded profile
                    } catch (createError) {

                        displayMinimalProfile(userId);
                        hideLoadingAndShowContent();
                        return;
                    }
                } else {

                    displayMinimalProfile(userId);
                    hideLoadingAndShowContent();
                    return;
                }
            } else if (error.code === 'unauthorized' || error.code === 'forbidden' || 
                      error.code === 'permission-denied' || error.code === 'unauthenticated') {

                displayMinimalProfile(userId);
                hideLoadingAndShowContent();
                return;
            } else {

                displayMinimalProfile(userId);
                hideLoadingAndShowContent();
                return;
            }
        }
    }

    // Create default profile for new users
    async function createDefaultProfile(userId) {
        if (isDestroyed) {

            return;
        }
        
        const defaultProfile = {
            username: currentUser.email.split('@')[0], // Use email username as default
            displayName: currentUser.displayName || 'Anonymous User',
            bio: '',
            avatarUrl: '',
            favoriteCars: [],
            joinDate: new Date().toISOString()
        };

        try {

            await callProfileAPI(`/update_profile/${userId}`, 'PUT', defaultProfile);


            // Reload profile after creation
            await loadUserProfile(userId);
        } catch (error) {

            displayMinimalProfile(userId);
            hideLoadingAndShowContent();
        }
    }

    // Display profile data
    function displayProfile(profileData) {
        if (isDestroyed) return;
        
        if (profileDisplayName) setSafeText(profileDisplayName, profileData.displayName || 'Anonymous User');
        if (profileUsername) setSafeText(profileUsername, `@${profileData.username || 'unknown'}`);
        if (profileBio) setSafeText(profileBio, profileData.bio || 'No bio provided.');

        // Handle avatar
        if (profileData.avatarUrl && profileAvatar && profileAvatarPlaceholder) {
            profileAvatar.src = profileData.avatarUrl;
            profileAvatar.classList.remove('hidden');
            profileAvatarPlaceholder.classList.add('hidden');
        } else if (profileAvatar && profileAvatarPlaceholder) {
            profileAvatar.classList.add('hidden');
            profileAvatarPlaceholder.classList.remove('hidden');
            setSafeText(profileAvatarPlaceholder, (profileData.displayName || 'U').charAt(0).toUpperCase());
        }

        // Handle favorite cars
        if (profileFavoriteCars) {
            if (profileData.favoriteCars && profileData.favoriteCars.length > 0) {
                profileFavoriteCars.innerHTML = '';
                profileData.favoriteCars.forEach(car => {
                    const span = createSafeElement('span', car, 'bg-slate-700 text-slate-300 px-2 py-1 rounded-md text-sm mr-2');
                    profileFavoriteCars.appendChild(span);
                });
            } else {
                setSafeText(profileFavoriteCars, 'No favorite cars added.');
                profileFavoriteCars.className = 'text-slate-400';
            }
        }

        // Handle join date
        if (profileJoinDate) {
            if (profileData.joinDate) {
                setSafeText(profileJoinDate, formatFirestoreTimestamp(profileData.joinDate));
            } else {
                setSafeText(profileJoinDate, 'Unknown');
            }
        }

        // Pre-fill edit form
        if (editUsername) editUsername.value = profileData.username || '';
        if (editDisplayName) editDisplayName.value = profileData.displayName || '';
        if (editBio) editBio.value = profileData.bio || '';
        if (editAvatarUrl) editAvatarUrl.value = profileData.avatarUrl || '';
        if (editFavoriteCars) editFavoriteCars.value = profileData.favoriteCars ? profileData.favoriteCars.join(', ') : '';

        // Show edit button only for current user's profile
        if (editProfileBtn) {
            editProfileBtn.style.display = isCurrentUserProfile ? 'block' : 'none';
        }

        hideLoadingAndShowContent();
    }

    // Display minimal profile when backend is not available
    function displayMinimalProfile(userId) {
        if (isDestroyed) return;
        

        const user = getCurrentUser();
        if (!user) {

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


    }

    // Load achievements
    function loadAchievements(achievements) {
        if (isDestroyed) return;
        
        if (!userAchievements) return;
        
        if (achievements.length === 0) {
            safeSetHTML(userAchievements, '<p class="text-slate-400">No achievements yet. Keep racing!</p>');
            
            const achievementSummary = document.getElementById('achievement-summary');
            const categoryFilter = document.getElementById('category-filter');
            if (achievementSummary) achievementSummary.classList.add('hidden');
            if (categoryFilter) categoryFilter.classList.add('hidden');
            return;
        }

        // Show achievement summary and filter
        const achievementSummary = document.getElementById('achievement-summary');
        const categoryFilter = document.getElementById('category-filter');
        if (achievementSummary) achievementSummary.classList.remove('hidden');
        if (categoryFilter) categoryFilter.classList.remove('hidden');

        // Calculate total points
        const totalPoints = achievements.reduce((sum, achievement) => sum + (achievement.points || 0), 0);
        const totalPointsEl = document.getElementById('total-points');
        const totalAchievementsCountEl = document.getElementById('total-achievements-count');
        
        if (totalPointsEl) setSafeText(totalPointsEl, totalPoints.toString());
        if (totalAchievementsCountEl) setSafeText(totalAchievementsCountEl, achievements.length.toString());

        // Render achievements
        renderAchievements(achievements);
    }

    function renderAchievements(achievements) {
        if (isDestroyed || !userAchievements) return;
        
        if (achievements.length === 0) {
            safeSetHTML(userAchievements, '<p class="text-slate-400">No achievements in this category.</p>');
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
            if (achievementElement.firstElementChild) {
                userAchievements.appendChild(achievementElement.firstElementChild);
            }
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

    // Toggle edit mode
    async function toggleEditMode() {
        if (isDestroyed) return;
        
        isEditing = !isEditing;
        if (isEditing) {
            if (profileDisplay) profileDisplay.classList.add('hidden');
            if (profileEditForm) profileEditForm.classList.remove('hidden');
            if (editProfileBtn) setSafeText(editProfileBtn, 'Cancel');
        } else {
            if (profileDisplay) profileDisplay.classList.remove('hidden');
            if (profileEditForm) profileEditForm.classList.add('hidden');
            if (editProfileBtn) setSafeText(editProfileBtn, 'Edit Profile');
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
        saveProfileBtn.addEventListener('click', async () => {
            // Save profile functionality - placeholder

        });
    }

    // Set up authentication state monitoring with enhanced error handling


    try {
        authStateUnsubscribe = monitorAuthState(
            async (user, validToken) => {

                if (isDestroyed || isProcessingAuth) {
                    if (isProcessingAuth)
                    return;
                }
                
                isProcessingAuth = true;


                try {
                    clearAuthError();

                    if (user && validToken) {


                        currentUser = user;
                        const targetUserId = getUserIdFromUrl() || user.uid;
                        isCurrentUserProfile = (targetUserId === user.uid);


                        // Load the user profile with enhanced error handling
                        try {
                            await loadUserProfile(targetUserId);
                        } catch (profileError) {

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

                        // Check if user is admin for achievements management
                        try {

                            const claimsResult = await validateUserClaims(['team-member']);
                            const isAdmin = claimsResult.success && claimsResult.claims.role === 'team-member';



                            if (isAdmin && adminAchievements) {
                                adminAchievements.classList.remove('hidden');

                            }
                        } catch (claimsError) {

                        }

                    } else {

                        cleanup();
                        navigateToInternal('/login.html');
                    }
                } finally {
                    isProcessingAuth = false;

                }
            },
            (error) => {
                if (isDestroyed) return;
                

                showAuthError(error);

                if (error.requiresReauth) {
                    // Redirect to login for auth errors that require re-authentication
                    setTimeout(() => {
                        cleanup();
                        navigateToInternal('/login.html');
                    }, 3000);
                } else {
                    // Show error state for other auth issues
                    showErrorState();
                }
            }
        );
        
    } catch (error) {

        hideLoadingAndShowFallback();
        return;
    }

    // Handle page unload cleanup
    window.addEventListener('beforeunload', cleanup);
    window.addEventListener('unload', cleanup);
    
    // Handle visibility change (page becomes hidden)
    if (typeof document.visibilityState !== 'undefined') {
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {

            } else if (isDestroyed) {

                window.location.reload();
            }
        });
    }

    // Prevent multiple initializations
    if (isInitialized) {

        return;
    }

    isInitialized = true;


})();