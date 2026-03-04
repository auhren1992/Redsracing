// Modern Tabbed Mobile Menu
(function() {
  'use strict';
  
  let mobileMenuElement = null;
  
  function createMobileMenu() {
    // Remove old mobile menu if exists
    const oldMenu = document.getElementById('mobile-menu-tabs');
    if (oldMenu) oldMenu.remove();
    
    // Create new mobile menu structure
    const menuHTML = `
      <div id="mobile-menu-tabs" class="mobile-menu-tabs">
        <!-- Header -->
        <div class="mobile-menu-header">
          <div class="mobile-menu-logo">REDSRACING</div>
          <button class="mobile-menu-close" id="mobile-menu-close">
            <i class="fas fa-times"></i>
          </button>
        </div>
        
        <!-- Tab Navigation -->
        <div class="mobile-menu-tabs-nav">
          <button class="mobile-tab-btn active" data-tab="home">
            <i class="fas fa-home"></i>
            Home
          </button>
          <button class="mobile-tab-btn" data-tab="drivers">
            <i class="fas fa-users"></i>
            Drivers
          </button>
          <button class="mobile-tab-btn" data-tab="racing">
            <i class="fas fa-flag-checkered"></i>
            Racing
          </button>
          <button class="mobile-tab-btn" data-tab="community">
            <i class="fas fa-heart"></i>
            Community
          </button>
        </div>
        
        <!-- Tab Content: Home -->
        <div class="mobile-tab-content active" data-tab-content="home">
          <a href="index.html" class="mobile-nav-link">
            <div class="mobile-nav-link-icon">
              <i class="fas fa-home"></i>
            </div>
            <span>Home</span>
          </a>
          
          <div class="mobile-section-header">Quick Access</div>
          
          <a href="schedule.html" class="mobile-nav-link">
            <div class="mobile-nav-link-icon">
              <i class="fas fa-calendar"></i>
            </div>
            <span>Race Schedule</span>
          </a>
          
          <a href="leaderboard.html" class="mobile-nav-link">
            <div class="mobile-nav-link-icon">
              <i class="fas fa-trophy"></i>
            </div>
            <span>Leaderboard</span>
          </a>
          
          <a href="videos.html" class="mobile-nav-link">
            <div class="mobile-nav-link-icon">
              <i class="fas fa-video"></i>
            </div>
            <span>Videos</span>
          </a>
        </div>
        
        <!-- Tab Content: Drivers -->
        <div class="mobile-tab-content" data-tab-content="drivers">
          <!-- Jon Kirsch Card -->
          <div class="mobile-nav-card">
            <div class="mobile-nav-card-header">
              <div class="mobile-nav-card-number">#8</div>
              <div class="mobile-nav-card-title">
                <div class="mobile-nav-card-name">Jon Kirsch</div>
                <div class="mobile-nav-card-role">Father & Team Leader</div>
              </div>
            </div>
            <div class="driver-links">
              <a href="driver.html" class="driver-link">
                <span class="driver-link-icon">👤</span>
                <span class="driver-link-text">Profile</span>
              </a>
              <a href="gallery.html" class="driver-link">
                <span class="driver-link-icon">📸</span>
                <span class="driver-link-text">Gallery</span>
              </a>
              <a href="jons.html" class="driver-link">
                <span class="driver-link-icon">📊</span>
                <span class="driver-link-text">Stats</span>
              </a>
            </div>
          </div>
          
          <!-- Jonny Kirsch Card -->
          <div class="mobile-nav-card">
            <div class="mobile-nav-card-header">
              <div class="mobile-nav-card-title">
                <div class="mobile-nav-card-icon yellow">🏁</div>
                <div>
                  <div>Jonny Kirsch</div>
                  <div style="font-size: 0.75rem; color: #94a3b8; font-weight: 400;">#88 • Rising Star</div>
                </div>
              </div>
            </div>
            <div class="mobile-nav-card-desc">
              Next generation racer following in championship footsteps
            </div>
            <div class="driver-submenu-grid">
              <a href="jonny.html" class="driver-submenu-item">
                <div class="driver-submenu-item-icon">👤</div>
                <div class="driver-submenu-item-label">Profile</div>
              </a>
              <a href="jonny-gallery.html" class="driver-submenu-item">
                <div class="driver-submenu-item-icon">📸</div>
                <div class="driver-submenu-item-label">Gallery</div>
              </a>
              <a href="jonny-results.html" class="driver-submenu-item">
                <div class="driver-submenu-item-icon">📊</div>
                <div class="driver-submenu-item-label">Race Results</div>
              </a>
            </div>
          </div>
          
          <!-- Team Legends -->
          <a href="legends.html" class="mobile-nav-link">
            <div class="mobile-nav-link-icon" style="background: rgba(251, 191, 36, 0.2); color: #fbbf24;">
              <i class="fas fa-star"></i>
            </div>
            <span>Team Legends</span>
          </a>
        </div>
        
        <!-- Tab Content: Racing -->
        <div class="mobile-tab-content" data-tab-content="racing">
          <a href="schedule.html" class="mobile-nav-link">
            <div class="mobile-nav-link-icon">
              <i class="fas fa-calendar-alt"></i>
            </div>
            <span>Schedule</span>
          </a>
          
          <a href="leaderboard.html" class="mobile-nav-link">
            <div class="mobile-nav-link-icon" style="background: rgba(251, 191, 36, 0.2); color: #fbbf24;">
              <i class="fas fa-trophy"></i>
            </div>
            <span>Leaderboard</span>
          </a>
          
          <a href="videos.html" class="mobile-nav-link">
            <div class="mobile-nav-link-icon" style="background: rgba(239, 68, 68, 0.2); color: #ef4444;">
              <i class="fas fa-video"></i>
            </div>
            <span>Videos</span>
          </a>
        </div>
        
        <!-- Tab Content: Community -->
        <div class="mobile-tab-content" data-tab-content="community">
          <a href="qna.html" class="mobile-nav-link">
            <div class="mobile-nav-link-icon" style="background: rgba(16, 185, 129, 0.2); color: #10b981;">
              <i class="fas fa-question-circle"></i>
            </div>
            <span>Q&A</span>
          </a>
          
          <a href="feedback.html" class="mobile-nav-link">
            <div class="mobile-nav-link-icon">
              <i class="fas fa-comments"></i>
            </div>
            <span>Feedback</span>
          </a>
          
          <a href="sponsorship.html" class="mobile-nav-link">
            <div class="mobile-nav-link-icon" style="background: rgba(251, 191, 36, 0.2); color: #fbbf24;">
              <i class="fas fa-handshake"></i>
            </div>
            <span>Sponsorship</span>
          </a>
        </div>
        
        <!-- User Profile Section (shown when logged in) -->
        <div class="mobile-menu-user" id="mobile-menu-user-section" style="display: none;">
          <div class="mobile-menu-user-info">
            <div class="mobile-menu-user-avatar">
              <i class="fas fa-user"></i>
            </div>
            <div class="mobile-menu-user-details">
              <div class="mobile-menu-user-name" id="mobile-menu-user-name">Driver</div>
              <div class="mobile-menu-user-role">Team Member</div>
              <div class="mobile-menu-user-status">Online</div>
            </div>
          </div>
          <button class="mobile-menu-logout" id="mobile-menu-logout-btn">
            <i class="fas fa-sign-out-alt"></i>
            Sign Out
          </button>
        </div>
        
        <!-- Login Button (shown when not logged in) -->
        <div style="padding: 1rem;">
          <a href="login.html" id="mobile-menu-login-link" class="mobile-nav-link" style="background: linear-gradient(135deg, #ef4444, #dc2626); border-color: #ef4444;">
            <div class="mobile-nav-link-icon" style="background: rgba(255, 255, 255, 0.2); color: white;">
              <i class="fas fa-sign-in-alt"></i>
            </div>
            <span style="color: white;">Driver Login</span>
          </a>
        </div>
      </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', menuHTML);
    mobileMenuElement = document.getElementById('mobile-menu-tabs');
    
    initializeMenu();
  }
  
  function initializeMenu() {
    // Tab switching
    const tabBtns = document.querySelectorAll('.mobile-tab-btn');
    const tabContents = document.querySelectorAll('.mobile-tab-content');
    
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const tabName = btn.dataset.tab;
        
        // Update active tab button
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        // Update active tab content
        tabContents.forEach(content => {
          if (content.dataset.tabContent === tabName) {
            content.classList.add('active');
          } else {
            content.classList.remove('active');
          }
        });
      });
    });
    
    // Close menu
    const closeBtn = document.getElementById('mobile-menu-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', closeMobileMenu);
    }
    
    // Close on link click
    const allLinks = mobileMenuElement.querySelectorAll('a');
    allLinks.forEach(link => {
      link.addEventListener('click', () => {
        closeMobileMenu();
      });
    });
    
    // Close on outside click
    mobileMenuElement.addEventListener('click', (e) => {
      if (e.target === mobileMenuElement) {
        closeMobileMenu();
      }
    });
    
    // Handle auth state
    updateAuthUI();
  }
  
  function openMobileMenu() {
    if (!mobileMenuElement) {
      createMobileMenu();
    }
    mobileMenuElement.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
  
  function closeMobileMenu() {
    if (mobileMenuElement) {
      mobileMenuElement.classList.remove('active');
      document.body.style.overflow = '';
    }
  }
  
  async function updateAuthUI() {
    try {
      // Check if user is logged in
      const uid = localStorage.getItem('rr_auth_uid');
      const userSection = document.getElementById('mobile-menu-user-section');
      const loginLink = document.getElementById('mobile-menu-login-link');
      
      if (uid && userSection && loginLink) {
        // User is logged in
        userSection.style.display = 'block';
        loginLink.style.display = 'none';
        
        // Try to get user name from localStorage or Firebase
        const userName = localStorage.getItem('rr_user_name') || 'Driver';
        const userNameEl = document.getElementById('mobile-menu-user-name');
        if (userNameEl) {
          userNameEl.textContent = userName;
        }
        
        // Logout handler
        const logoutBtn = document.getElementById('mobile-menu-logout-btn');
        if (logoutBtn) {
          logoutBtn.addEventListener('click', async () => {
            try {
              // Import Firebase auth
              const { getAuth } = await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js');
              const auth = getAuth();
              await auth.signOut();
              localStorage.removeItem('rr_auth_uid');
              localStorage.removeItem('rr_user_name');
              window.location.href = 'index.html';
            } catch (err) {
              console.error('Logout error:', err);
              window.location.href = 'index.html';
            }
          });
        }
      } else if (userSection && loginLink) {
        // User is not logged in
        userSection.style.display = 'none';
        loginLink.style.display = 'flex';
      }
    } catch (err) {
      console.error('Auth UI error:', err);
    }
  }
  
  // Initialize when DOM is ready
  function init() {
    // Replace old mobile menu button functionality
    const mobileMenuBtn = document.getElementById('mobile-menu-button');
    if (mobileMenuBtn) {
      // Remove old listeners by cloning
      const newBtn = mobileMenuBtn.cloneNode(true);
      mobileMenuBtn.parentNode.replaceChild(newBtn, mobileMenuBtn);
      
      // Add new listener
      newBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openMobileMenu();
      });
    }
    
    // Create menu structure
    createMobileMenu();
  }
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  
  // Make functions globally available
  window.openMobileMenu = openMobileMenu;
  window.closeMobileMenu = closeMobileMenu;
})();
