/**
 * Team Members Page Script
 *
 * Handles team member listing, search, filtering, and management
 * with proper error handling and loading states
 */

import { getFirebaseAuth, getFirebaseDb } from './firebase-core.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
    collection,
    query,
    where,
    orderBy,
    limit,
    startAfter,
    getDocs,
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Import utilities
import {
    validateUserClaims,
    showAuthError,
    clearAuthError,
    monitorAuthState
} from './auth-utils.js';
import { useFirestoreQuery } from './async-data-hook.js';
import { UIState } from './ui-components.js';
import { ErrorBoundary } from './error-boundary.js';
import { safeSetHTML, setSafeText } from './sanitize.js';
import { navigateToInternal } from './navigation-helpers.js';

// Wrap in async function for proper initialization
(async function() {
    let auth, db;
    let currentUser = null;
    let isTeamMember = false;
    let members = [];
    // let currentQuery = null;
    let lastVisible = null;
    let hasMoreMembers = false;
    let searchTerm = '';
    let roleFilter = '';

    // Page size for pagination
    const PAGE_SIZE = 12;

    // Get Firebase services
    auth = getFirebaseAuth();
    db = getFirebaseDb();


    // UI Elements
    const loadingState = document.getElementById('loading-state');
    const teamContent = document.getElementById('team-content');
    const errorState = document.getElementById('error-state');
    const permissionDeniedState = document.getElementById('permission-denied-state');
    const logoutButton = document.getElementById('logout-button');

    // Team content elements
    const totalMembersEl = document.getElementById('total-members');
    const activeMembersEl = document.getElementById('active-members');
    const newMembersEl = document.getElementById('new-members');
    const searchInput = document.getElementById('search-members');
    const roleFilterSelect = document.getElementById('role-filter');
    const refreshBtn = document.getElementById('refresh-members');
    const inviteMemberBtn = document.getElementById('invite-member');
    const membersContainer = document.getElementById('members-container');
    const loadMoreContainer = document.getElementById('load-more-container');
    const loadMoreBtn = document.getElementById('load-more-btn');

    // Modal elements
    const memberModal = document.getElementById('member-modal');
    const memberModalContent = document.getElementById('member-modal-content');
    const closeMemberModal = document.getElementById('close-member-modal');
    const inviteModal = document.getElementById('invite-modal');
    // const inviteForm = document.getElementById('invite-form');
    const cancelInvite = document.getElementById('cancel-invite');

    // Error boundary for the page
    // const errorBoundary = new ErrorBoundary(document.querySelector('main'));

    // Show different states
    function showLoadingState() {
        if (loadingState) loadingState.classList.remove('hidden');
        if (teamContent) teamContent.classList.add('hidden');
        if (errorState) errorState.classList.add('hidden');
        if (permissionDeniedState) permissionDeniedState.classList.add('hidden');
    }

    showLoadingState();

    function showTeamContent() {
        loadingState.classList.add('hidden');
        teamContent.classList.remove('hidden');
        errorState.classList.add('hidden');
        permissionDeniedState.classList.add('hidden');
    }

    function showErrorState(type = 'generic', message = null) {
        loadingState.classList.add('hidden');
        teamContent.classList.add('hidden');
        permissionDeniedState.classList.add('hidden');

        if (type === 'permission') {
            permissionDeniedState.classList.remove('hidden');
        } else {
            errorState.classList.remove('hidden');
            if (message) {
                const errorMessage = errorState.querySelector('p');
                if (errorMessage) {
                    setSafeText(errorMessage, message);
                }
            }
        }
    }

    // Load team members with pagination
    async function loadTeamMembers(isLoadMore = false) {
        try {


            if (!isLoadMore) {
                // Show loading in container for initial load
                UIState.loading(membersContainer, {
                    message: 'Loading team members...',
                    size: 'medium'
                });
                lastVisible = null;
                hasMoreMembers = false;
            }

            // Build query
            let q = collection(db, 'user_profiles');

            // Apply role filter if specified
            if (roleFilter) {
                q = query(q, where('role', '==', roleFilter));
            }

            // Order by join date
            q = query(q, orderBy('createdAt', 'desc'));

            // Apply pagination
            q = query(q, limit(PAGE_SIZE));
            if (isLoadMore && lastVisible) {
                q = query(q, startAfter(lastVisible));
            }

            const querySnapshot = await getDocs(q);


            const newMembers = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Filter by search term client-side (for simple search)
            let filteredMembers = newMembers;
            if (searchTerm) {
                const lowerSearchTerm = searchTerm.toLowerCase();
                filteredMembers = newMembers.filter(member =>
                    (member.displayName?.toLowerCase().includes(lowerSearchTerm)) ||
                    (member.username?.toLowerCase().includes(lowerSearchTerm)) ||
                    (member.email?.toLowerCase().includes(lowerSearchTerm))
                );
            }

            if (isLoadMore) {
                members = [...members, ...filteredMembers];
            } else {
                members = filteredMembers;
            }

            // Update pagination state
            lastVisible = querySnapshot.docs[querySnapshot.docs.length - 1];
            hasMoreMembers = querySnapshot.docs.length === PAGE_SIZE;

            // Render members
            renderMembers();
            updateLoadMoreButton();



        } catch (error) {


            if (error.code === 'permission-denied') {
                showErrorState('permission');
            } else {
                UIState.error(membersContainer, {
                    type: 'generic',
                    title: 'Failed to Load Members',
                    message: 'Unable to load team member information. Please try again.',
                    onRetry: () => loadTeamMembers()
                });
            }
        }
    }

    // Render members grid
    function renderMembers() {
        if (members.length === 0) {
            UIState.empty(membersContainer, {
                icon: '👥',
                title: 'No Team Members Found',
                message: searchTerm || roleFilter ? 'Try adjusting your search or filter criteria.' : 'No team members have been added yet.',
                actionText: searchTerm || roleFilter ? 'Clear Filters' : null,
                onAction: () => {
                    searchInput.value = '';
                    roleFilterSelect.value = '';
                    searchTerm = '';
                    roleFilter = '';
                    loadTeamMembers();
                }
            });
            return;
        }

        membersContainer.innerHTML = '';

        members.forEach(member => {
            const memberCard = createMemberCard(member);
            membersContainer.appendChild(memberCard);
        });
    }

    // Create individual member card
    function createMemberCard(member) {
        const card = document.createElement('div');
        card.className = 'card rounded-lg p-6 hover:bg-slate-800/50 transition-colors cursor-pointer';

        const avatarImg = member.avatarUrl ?
            `<img src="${member.avatarUrl}" alt="${member.displayName || 'Member'}" class="w-full h-full object-cover">` :
            `<span class="text-2xl font-bold text-slate-300">${(member.displayName || member.username || '?')[0].toUpperCase()}</span>`;

        const joinDate = member.createdAt ?
            formatDate(member.createdAt) : 'Unknown';

        const roleDisplay = member.role ?
            formatRole(member.role) : 'Member';

        const lastActive = member.lastActiveAt ?
            formatRelativeTime(member.lastActiveAt) : 'Unknown';

        safeSetHTML(card, `
            <div class="flex items-center space-x-4 mb-4">
                <div class="w-16 h-16 rounded-full overflow-hidden bg-slate-600 flex items-center justify-center flex-shrink-0">
                    ${avatarImg}
                </div>
                <div class="flex-1 min-w-0">
                    <h3 class="text-lg font-bold text-white truncate">${member.displayName || member.username || 'Unknown'}</h3>
                    <p class="text-slate-400 text-sm truncate">@${member.username || 'unknown'}</p>
                    <p class="text-sm text-neon-yellow">${roleDisplay}</p>
                </div>
            </div>
            <div class="space-y-2 text-sm text-slate-400">
                <div class="flex justify-between">
                    <span>Joined:</span>
                    <span>${joinDate}</span>
                </div>
                <div class="flex justify-between">
                    <span>Last Active:</span>
                    <span>${lastActive}</span>
                </div>
            </div>
        `);

        // Add click handler to show member details
        card.addEventListener('click', () => showMemberDetails(member));

        return card;
    }

    // Show member details in modal
    function showMemberDetails(member) {
        const avatarImg = member.avatarUrl ?
            `<img src="${member.avatarUrl}" alt="${member.displayName || 'Member'}" class="w-full h-full object-cover">` :
            `<span class="text-4xl font-bold text-slate-300">${(member.displayName || member.username || '?')[0].toUpperCase()}</span>`;

        const favoriteCars = member.favoriteCars ?
            member.favoriteCars.map(car => `<span class="bg-slate-700 px-2 py-1 rounded text-sm">${car}</span>`).join(' ') :
            '<span class="text-slate-400">None specified</span>';

        const bio = member.bio || 'No bio provided.';

        safeSetHTML(memberModalContent, `
            <div class="flex items-center space-x-6 mb-6">
                <div class="w-24 h-24 rounded-full overflow-hidden bg-slate-600 flex items-center justify-center flex-shrink-0">
                    ${avatarImg}
                </div>
                <div>
                    <h3 class="text-2xl font-bold text-white">${member.displayName || member.username || 'Unknown'}</h3>
                    <p class="text-slate-400">@${member.username || 'unknown'}</p>
                    <p class="text-neon-yellow font-bold">${formatRole(member.role)}</p>
                </div>
            </div>

            <div class="space-y-4">
                <div>
                    <label class="block text-sm font-bold text-slate-300 mb-2">Bio</label>
                    <p class="text-slate-400">${bio}</p>
                </div>

                <div>
                    <label class="block text-sm font-bold text-slate-300 mb-2">Favorite Cars</label>
                    <div class="flex flex-wrap gap-2">
                        ${favoriteCars}
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-bold text-slate-300 mb-2">Member Since</label>
                        <p class="text-slate-400">${formatDate(member.createdAt)}</p>
                    </div>
                    <div>
                        <label class="block text-sm font-bold text-slate-300 mb-2">Last Active</label>
                        <p class="text-slate-400">${formatRelativeTime(member.lastActiveAt)}</p>
                    </div>
                </div>

                ${member.achievements && member.achievements.length > 0 ? `
                    <div>
                        <label class="block text-sm font-bold text-slate-300 mb-2">Recent Achievements</label>
                        <div class="space-y-2">
                            ${member.achievements.slice(0, 3).map(achievement => `
                                <div class="flex items-center space-x-2">
                                    <span class="text-yellow-400">${achievement.icon || '🏆'}</span>
                                    <span class="text-white">${achievement.name}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
            </div>
        `);

        memberModal.classList.remove('hidden');
        memberModal.classList.add('flex');
    }

    // Update load more button visibility
    function updateLoadMoreButton() {
        if (hasMoreMembers && members.length > 0) {
            loadMoreContainer.classList.remove('hidden');
        } else {
            loadMoreContainer.classList.add('hidden');
        }
    }

    // Update team statistics
    function updateTeamStats() {
        const now = new Date();
        const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        const total = members.length;
        const active = members.filter(member => {
            if (!member.lastActiveAt) return false;
            const lastActive = member.lastActiveAt.toDate ? member.lastActiveAt.toDate() : new Date(member.lastActiveAt);
            return lastActive >= thisMonth;
        }).length;

        const newMembers = members.filter(member => {
            if (!member.createdAt) return false;
            const joinDate = member.createdAt.toDate ? member.createdAt.toDate() : new Date(member.createdAt);
            return joinDate >= thisMonth;
        }).length;

        setSafeText(totalMembersEl, total.toString());
        setSafeText(activeMembersEl, active.toString());
        setSafeText(newMembersEl, newMembers.toString());
    }

    // Utility functions
    function formatDate(timestamp) {
        if (!timestamp) return 'Unknown';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleDateString();
    }

    function formatRelativeTime(timestamp) {
        if (!timestamp) return 'Unknown';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;
        if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
        if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
        return `${Math.floor(diffDays / 365)} years ago`;
    }

    function formatRole(role) {
        if (!role) return 'Member';

        const roleMap = {
            'team-member': 'Team Member',
            'driver': 'Driver',
            'crew': 'Crew Member',
            'supporter': 'Supporter'
        };

        return roleMap.hasOwnProperty(role) ? roleMap[role] : role.charAt(0).toUpperCase() + role.slice(1);
    }

    // Debounced search function
    let searchTimeout;
    function debounceSearch(func, delay) {
        return function(...args) {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => func.apply(this, args), delay);
        };
    }

    const debouncedSearch = debounceSearch(() => {
        searchTerm = searchInput.value.trim();
        loadTeamMembers();
    }, 300);

    // Event listeners
    if (searchInput) {
        searchInput.addEventListener('input', debouncedSearch);
    }

    if (roleFilterSelect) {
        roleFilterSelect.addEventListener('change', () => {
            roleFilter = roleFilterSelect.value;
            loadTeamMembers();
        });
    }

    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => loadTeamMembers());
    }

    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', () => loadTeamMembers(true));
    }

    // Modal event listeners
    if (closeMemberModal) {
        closeMemberModal.addEventListener('click', () => {
            memberModal.classList.add('hidden');
            memberModal.classList.remove('flex');
        });
    }

    if (memberModal) {
        memberModal.addEventListener('click', (e) => {
            if (e.target === memberModal) {
                memberModal.classList.add('hidden');
                memberModal.classList.remove('flex');
            }
        });
    }

    // Invite modal event listeners
    if (cancelInvite) {
        cancelInvite.addEventListener('click', () => {
            inviteModal.classList.add('hidden');
            inviteModal.classList.remove('flex');
        });
    }
    if (inviteModal) {
        inviteModal.addEventListener('click', (e) => {
            if (e.target === inviteModal) {
                inviteModal.classList.add('hidden');
                inviteModal.classList.remove('flex');
            }
        });
    }

    // Authentication monitoring
    monitorAuthState(
        async (user, validToken) => {
            clearAuthError();

            if (user && validToken) {

                currentUser = user;

                try {
                    // Check if user has permission to view team members
                    const claimsResult = await validateUserClaims(['team-member']);
                    isTeamMember = claimsResult.success && claimsResult.claims.role === 'team-member';



                    if (isTeamMember) {
                        // Show admin features
                        if (inviteMemberBtn) {
                            inviteMemberBtn.classList.remove('hidden');
                        }
                    }

                    // Load team members
                    await loadTeamMembers();
                    updateTeamStats();
                    showTeamContent();

                } catch (error) {

                    if (error.code === 'permission-denied') {
                        showErrorState('permission');
                    } else {
                        showErrorState('generic', 'Unable to load team information. Please try again.');
                    }
                }
            } else {

                navigateToInternal('/login.html');
            }
        },
        (error) => {

            showAuthError(error);

            if (error.requiresReauth) {
                setTimeout(() => navigateToInternal('/login.html'), 3000);
            } else {
                showErrorState('auth', 'Authentication failed. Please log in again.');
            }
        }
    );

    // Logout handler
    if (logoutButton) {
        logoutButton.addEventListener('click', async (e) => {
            e.preventDefault();
            try {
                await signOut(auth);
                navigateToInternal('/login.html');
            } catch (error) {

                navigateToInternal('/login.html'); // Redirect anyway
            }
        });
    }

})();
