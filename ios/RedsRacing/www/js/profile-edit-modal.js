// Role-Based Profile Edit Modal Controller
import { getFirebaseAuth, getFirebaseDb } from '../assets/js/firebase-core.js';
import { serverTimestamp, doc, updateDoc } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';

class ProfileEditModal {
  constructor() {
    this.currentUser = null;
    this.userRole = 'public-fan';
    this.currentTab = 'profile';
    this.cars = [];
    this.maxCars = 5;
    this.editingCarIndex = -1;
    
    this.init();
  }

  async init() {
    await this.loadUser();
  }

  async loadUser() {
    try {
      const auth = getFirebaseAuth();
      if (!auth) return;
      
      auth.onAuthStateChanged(async (user) => {
        if (user) {
          this.currentUser = user;
          const idTokenResult = await user.getIdTokenResult();
          this.userRole = this.getUserRole(idTokenResult.claims);
          this.maxCars = this.getMaxCars(this.userRole);
        }
      });
    } catch (error) {
      console.error('Error loading user:', error);
    }
  }

  getUserRole(claims) {
    if (claims.admin || claims.role === 'admin') return 'admin';
    if (claims['team-member'] || claims.teamMember || claims.role === 'team-member') return 'team-member';
    if (claims.role === 'public-fan') return 'public-fan';
    return 'public-fan'; // default
  }

  getMaxCars(role) {
    if (role === 'admin') return 999;
    if (role === 'team-member') return 10;
    return 5;
  }

  getRoleBadgeHTML(role) {
    const badges = {
      'admin': '<span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-gradient-to-r from-yellow-500 to-amber-600 text-white"><i class="fas fa-crown mr-1"></i>Admin</span>',
      'team-member': '<span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-gradient-to-r from-red-500 to-orange-600 text-white"><i class="fas fa-star mr-1"></i>Team Member</span>',
      'public-fan': '<span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-gradient-to-r from-blue-500 to-purple-600 text-white"><i class="fas fa-heart mr-1"></i>Fan</span>'
    };
    return badges[role] || badges['public-fan'];
  }

  setupEventListeners() {
    // Modal controls
    document.getElementById('close-modal-btn')?.addEventListener('click', () => this.closeModal());
    document.getElementById('cancel-edit-btn')?.addEventListener('click', () => this.closeModal());
    document.getElementById('modal-backdrop')?.addEventListener('click', () => this.closeModal());
    document.getElementById('save-profile-btn')?.addEventListener('click', () => this.saveProfile());

    // Garage controls
    document.getElementById('add-car-btn')?.addEventListener('click', () => this.showCarForm());
    document.getElementById('save-car-btn')?.addEventListener('click', () => this.saveCarFromForm());
    document.getElementById('cancel-car-btn')?.addEventListener('click', () => this.hideCarForm());
    document.getElementById('cancel-car-form-btn')?.addEventListener('click', () => this.hideCarForm());

    // Avatar preview
    document.getElementById('edit-avatar')?.addEventListener('input', (e) => {
      const preview = document.getElementById('avatar-preview');
      const placeholder = document.getElementById('avatar-placeholder');
      if (e.target.value) {
        preview.src = e.target.value;
        preview.classList.remove('hidden');
        placeholder.classList.add('hidden');
      } else {
        preview.classList.add('hidden');
        placeholder.classList.remove('hidden');
      }
    });
  }

  setupCharacterCounters() {
    // Display name counter
    const nameInput = document.getElementById('edit-display-name');
    const nameCount = document.getElementById('name-count');
    nameInput?.addEventListener('input', (e) => {
      nameCount.textContent = e.target.value.length;
    });

    // Bio counter
    const bioInput = document.getElementById('edit-bio');
    const bioCount = document.getElementById('bio-count');
    const bioLimit = document.getElementById('bio-limit');
    bioInput?.addEventListener('input', (e) => {
      const limit = this.userRole === 'team-member' ? 500 : 300;
      bioLimit.textContent = limit;
      bioCount.textContent = e.target.value.length;
      bioInput.maxLength = limit;
    });
  }

  async openModal() {
    const modal = document.getElementById('profile-edit-modal');
    if (!modal) {
      console.error('Profile edit modal not found. Make sure the HTML component is loaded.');
      return;
    }

    // Ensure Firebase is loaded and get current user
    try {
      const auth = getFirebaseAuth();
      if (auth) {
        this.currentUser = auth.currentUser;
        if (this.currentUser) {
          const idTokenResult = await this.currentUser.getIdTokenResult();
          this.userRole = this.getUserRole(idTokenResult.claims);
          this.maxCars = this.getMaxCars(this.userRole);
        }
      }
    } catch (error) {
      console.error('Error getting current user:', error);
    }

    // Setup event listeners NOW that modal exists
    this.setupEventListeners();
    this.setupCharacterCounters();

    // Show modal
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    // Update role badge
    document.getElementById('role-badge').innerHTML = this.getRoleBadgeHTML(this.userRole);

    // Setup tabs
    this.setupTabs();

    // Load profile data
    await this.loadProfileData();

    // Show first tab
    this.switchTab('profile');
  }

  closeModal() {
    document.getElementById('profile-edit-modal')?.classList.add('hidden');
    document.body.style.overflow = '';
  }

  setupTabs() {
    const tabsContainer = document.getElementById('tabs-container');
    if (!tabsContainer) return;

    const tabs = this.getTabsForRole(this.userRole);
    
    tabsContainer.innerHTML = tabs.map(tab => `
      <button class="tab-button" data-tab="${tab.id}">
        <i class="${tab.icon} mr-2"></i>${tab.label}
      </button>
    `).join('');

    // Add click listeners
    tabsContainer.querySelectorAll('.tab-button').forEach(btn => {
      btn.addEventListener('click', () => {
        const tabId = btn.getAttribute('data-tab');
        this.switchTab(tabId);
      });
    });

    // Show/hide role-specific fields
    this.updateFieldVisibility();
  }

  getTabsForRole(role) {
    const allTabs = [
      { id: 'profile', label: 'Profile', icon: 'fas fa-user', roles: ['public-fan', 'team-member', 'admin'] },
      { id: 'garage', label: 'Garage', icon: 'fas fa-car', roles: ['public-fan', 'team-member', 'admin'] },
      { id: 'social', label: 'Social', icon: 'fas fa-share-alt', roles: ['public-fan', 'team-member', 'admin'] },
      { id: 'racing', label: 'Racing', icon: 'fas fa-flag-checkered', roles: ['public-fan', 'team-member', 'admin'] },
      { id: 'appearance', label: 'Appearance', icon: 'fas fa-palette', roles: ['team-member', 'admin'] }
    ];

    return allTabs.filter(tab => tab.roles.includes(role));
  }

  updateFieldVisibility() {
    // Banner field (team-member and admin only)
    const bannerField = document.getElementById('banner-field');
    if (this.userRole === 'team-member' || this.userRole === 'admin') {
      bannerField?.classList.remove('hidden');
    } else {
      bannerField?.classList.add('hidden');
    }

    // Discord and Twitch (team-member and admin only)
    const discordField = document.getElementById('discord-field');
    const twitchField = document.getElementById('twitch-field');
    if (this.userRole === 'team-member' || this.userRole === 'admin') {
      discordField?.classList.remove('hidden');
      twitchField?.classList.remove('hidden');
    }

    // Update car limit text
    const carLimitText = document.getElementById('car-limit-text');
    if (carLimitText) {
      if (this.userRole === 'admin') {
        carLimitText.textContent = 'Unlimited cars';
      } else if (this.userRole === 'team-member') {
        carLimitText.textContent = 'Add up to 10 cars';
      } else {
        carLimitText.textContent = 'Add up to 5 cars';
      }
    }

    // Update bio limit
    const bioInput = document.getElementById('edit-bio');
    const bioLimit = document.getElementById('bio-limit');
    const limit = this.userRole === 'team-member' || this.userRole === 'admin' ? 500 : 300;
    if (bioInput) bioInput.maxLength = limit;
    if (bioLimit) bioLimit.textContent = limit;
  }

  switchTab(tabId) {
    this.currentTab = tabId;

    // Update tab buttons
    document.querySelectorAll('.tab-button').forEach(btn => {
      if (btn.getAttribute('data-tab') === tabId) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Show/hide tab content
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.add('hidden');
    });
    document.getElementById(`tab-${tabId}`)?.classList.remove('hidden');
  }

  async loadProfileData() {
    if (!this.currentUser) return;

    try {
      const db = getFirebaseDb();
      if (!db) {
        console.error('Firestore not available');
        return;
      }
      
      const { getDoc } = await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js');
      const userDocRef = doc(db, 'users', this.currentUser.uid);
      const userDoc = await getDoc(userDocRef);
      const userData = userDoc.exists() ? userDoc.data() : {};

      // Load basic fields
      document.getElementById('edit-avatar').value = userData.avatarUrl || '';
      document.getElementById('edit-banner').value = userData.bannerUrl || '';
      document.getElementById('edit-display-name').value = userData.displayName || '';
      document.getElementById('edit-username').value = userData.username || '';
      document.getElementById('edit-bio').value = userData.bio || '';
      document.getElementById('edit-location').value = userData.location || '';
      document.getElementById('edit-racing-since').value = userData.racingSince || '';

      // Load social links
      const social = userData.socialLinks || {};
      document.getElementById('edit-instagram').value = social.instagram || '';
      document.getElementById('edit-tiktok').value = social.tiktok || '';
      document.getElementById('edit-youtube').value = social.youtube || '';
      document.getElementById('edit-discord').value = social.discord || '';
      document.getElementById('edit-twitch').value = social.twitch || '';
      
      // Load racing stats (Phase 2)
      const racing = userData.racingStats || {};
      document.getElementById('edit-favorite-track').value = racing.favoriteTrack || '';
      document.getElementById('edit-racing-class').value = racing.racingClass || '';
      document.getElementById('edit-best-lap').value = racing.bestLap || '';
      document.getElementById('edit-wins').value = racing.wins || '';
      document.getElementById('edit-second').value = racing.second || '';
      document.getElementById('edit-third').value = racing.third || '';

      // Load cars
      this.cars = userData.cars || [];
      this.renderCars();
      this.updateCarCount();

      // Update character counters
      document.getElementById('name-count').textContent = (userData.displayName || '').length;
      document.getElementById('bio-count').textContent = (userData.bio || '').length;

      // Update avatar preview
      if (userData.avatarUrl) {
        document.getElementById('avatar-preview').src = userData.avatarUrl;
        document.getElementById('avatar-preview').classList.remove('hidden');
        document.getElementById('avatar-placeholder').classList.add('hidden');
      }

    } catch (error) {
      console.error('Error loading profile:', error);
      this.showStatus('Failed to load profile data', 'error');
    }
  }

  updateCarCount() {
    const countDisplay = document.getElementById('car-count-display');
    if (countDisplay) {
      if (this.cars.length > 0) {
        countDisplay.textContent = `(${this.cars.length}/${this.maxCars === 999 ? '∞' : this.maxCars})`;
      } else {
        countDisplay.textContent = '';
      }
    }
  }

  renderCars() {
    const carsList = document.getElementById('cars-list');
    if (!carsList) return;

    if (this.cars.length === 0) {
      carsList.innerHTML = '<p class="text-center py-8 text-slate-500">No cars added yet. Click "Add Car" to start building your garage!</p>';
      return;
    }

    carsList.innerHTML = this.cars.map((car, index) => `
      <div class="bg-slate-800/50 border border-slate-700 rounded-lg p-4 hover:border-slate-600 transition">
        <div class="flex items-start gap-4">
          ${car.photoUrl ? `
            <img src="${car.photoUrl}" alt="${car.make} ${car.model}" class="w-24 h-24 rounded-lg object-cover">
          ` : `
            <div class="w-24 h-24 rounded-lg bg-slate-700 flex items-center justify-center">
              <i class="fas fa-car text-3xl text-slate-500"></i>
            </div>
          `}
          <div class="flex-1 min-w-0">
            <h4 class="text-white font-bold text-lg">${car.make || 'Unknown'} ${car.model || ''}</h4>
            ${car.year ? `<p class="text-slate-400 text-sm">${car.year}</p>` : ''}
            ${car.mods ? `<p class="text-slate-300 text-sm mt-1">${car.mods}</p>` : ''}
          </div>
          <div class="flex gap-2">
            <button onclick="profileEditModal.editCar(${index})" class="p-2 text-blue-400 hover:text-blue-300 transition">
              <i class="fas fa-edit"></i>
            </button>
            <button onclick="profileEditModal.deleteCar(${index})" class="p-2 text-red-400 hover:text-red-300 transition">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
      </div>
    `).join('');
  }

  showCarForm(editIndex = -1) {
    const carForm = document.getElementById('car-form');
    const formTitle = document.getElementById('car-form-title');
    
    this.editingCarIndex = editIndex;
    
    if (editIndex >= 0) {
      // Edit mode
      const car = this.cars[editIndex];
      formTitle.textContent = 'Edit Car';
      document.getElementById('car-make').value = car.make || '';
      document.getElementById('car-model').value = car.model || '';
      document.getElementById('car-year').value = car.year || '';
      document.getElementById('car-photo').value = car.photoUrl || '';
      document.getElementById('car-mods').value = car.mods || '';
    } else {
      // Add mode
      if (this.cars.length >= this.maxCars) {
        this.showStatus(`You've reached the maximum of ${this.maxCars} cars`, 'error');
        return;
      }
      formTitle.textContent = 'Add New Car';
      document.getElementById('car-make').value = '';
      document.getElementById('car-model').value = '';
      document.getElementById('car-year').value = '';
      document.getElementById('car-photo').value = '';
      document.getElementById('car-mods').value = '';
    }
    
    carForm.classList.remove('hidden');
  }

  hideCarForm() {
    document.getElementById('car-form')?.classList.add('hidden');
    this.editingCarIndex = -1;
  }

  saveCarFromForm() {
    const make = document.getElementById('car-make').value.trim();
    const model = document.getElementById('car-model').value.trim();
    
    if (!make || !model) {
      this.showStatus('Make and Model are required', 'error');
      return;
    }
    
    const carData = {
      make: make,
      model: model,
      year: document.getElementById('car-year').value.trim(),
      photoUrl: document.getElementById('car-photo').value.trim(),
      mods: document.getElementById('car-mods').value.trim(),
      isFavorite: false
    };
    
    if (this.editingCarIndex >= 0) {
      // Update existing car
      this.cars[this.editingCarIndex] = { ...this.cars[this.editingCarIndex], ...carData };
      this.showStatus('Car updated!', 'success');
    } else {
      // Add new car
      this.cars.push(carData);
      this.showStatus('Car added!', 'success');
    }
    
    this.hideCarForm();
    this.renderCars();
    this.updateCarCount();
  }

  editCar(index) {
    this.showCarForm(index);
  }

  deleteCar(index) {
    if (!confirm('Remove this car from your garage?')) return;
    
    this.cars.splice(index, 1);
    this.renderCars();
    this.updateCarCount();
    this.showStatus('Car removed', 'success');
  }

  async saveProfile() {
    // Ensure we have the latest auth state
    try {
      const auth = getFirebaseAuth();
      if (!auth) {
        this.showStatus('Error: Firebase not initialized', 'error');
        console.error('Firebase auth not available');
        return;
      }

      const currentUser = auth.currentUser;
      if (!currentUser) {
        this.showStatus('Error: Not authenticated. Please log in again.', 'error');
        console.error('No authenticated user found');
        return;
      }

      this.currentUser = currentUser;

      const saveBtn = document.getElementById('save-profile-btn');
      saveBtn.disabled = true;
      saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Saving...';
      this.showStatus('Saving changes...', 'info');

      console.log('Gathering profile data...');
      const profileData = {
        avatarUrl: document.getElementById('edit-avatar')?.value.trim() || '',
        displayName: document.getElementById('edit-display-name')?.value.trim() || '',
        username: document.getElementById('edit-username')?.value.trim() || '',
        bio: document.getElementById('edit-bio')?.value.trim() || '',
        location: document.getElementById('edit-location')?.value.trim() || '',
        racingSince: document.getElementById('edit-racing-since')?.value || '',
        socialLinks: {
          instagram: document.getElementById('edit-instagram')?.value.trim() || '',
          tiktok: document.getElementById('edit-tiktok')?.value.trim() || '',
          youtube: document.getElementById('edit-youtube')?.value.trim() || '',
          discord: document.getElementById('edit-discord')?.value.trim() || '',
          twitch: document.getElementById('edit-twitch')?.value.trim() || ''
        },
        racingStats: {
          favoriteTrack: document.getElementById('edit-favorite-track')?.value.trim() || '',
          racingClass: document.getElementById('edit-racing-class')?.value.trim() || '',
          bestLap: document.getElementById('edit-best-lap')?.value.trim() || '',
          wins: parseInt(document.getElementById('edit-wins')?.value) || 0,
          second: parseInt(document.getElementById('edit-second')?.value) || 0,
          third: parseInt(document.getElementById('edit-third')?.value) || 0
        },
        cars: this.cars,
        updatedAt: serverTimestamp()
      };
      console.log('Profile data collected:', profileData);

      // Add banner for team/admin only
      if (this.userRole === 'team-member' || this.userRole === 'admin') {
        profileData.bannerUrl = document.getElementById('edit-banner')?.value.trim() || '';
      }

      console.log('Saving to Firestore for user:', currentUser.uid);
      const db = getFirebaseDb();
      const userDocRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userDocRef, profileData);
      console.log('Profile saved successfully to Firestore');

      this.showStatus('Profile saved successfully!', 'success');
      
      // Reload page to show updated profile (with cache busting)
      setTimeout(() => {
        console.log('Reloading page to show updated profile...');
        window.location.reload(true); // Force reload from server, not cache
      }, 1500);

    } catch (error) {
      console.error('Error saving profile:', error);
      this.showStatus(`Failed to save profile: ${error.message}`, 'error');
    } finally {
      const saveBtn = document.getElementById('save-profile-btn');
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="fas fa-save mr-2"></i>Save Changes';
      }
    }
  }

  showStatus(message, type = 'info') {
    const statusEl = document.getElementById('save-status');
    if (!statusEl) return;

    const colors = {
      success: 'text-green-400',
      error: 'text-red-400',
      info: 'text-blue-400'
    };

    statusEl.textContent = message;
    statusEl.className = `flex-1 text-sm ${colors[type] || colors.info}`;

    if (type === 'success' || type === 'error') {
      setTimeout(() => {
        statusEl.textContent = '';
      }, 5000);
    }
  }
}

// Initialize global instance and make it available globally
let profileEditModal;

// Export for use as a module
export { ProfileEditModal };

// Also make it available globally for non-module scripts
if (typeof window !== 'undefined') {
  window.ProfileEditModal = ProfileEditModal;
}

document.addEventListener('DOMContentLoaded', () => {
  profileEditModal = new ProfileEditModal();
  // Make instance globally available
  if (typeof window !== 'undefined') {
    window.profileEditModal = profileEditModal;
  }
});
