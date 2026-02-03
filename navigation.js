// Root navigation.js: lightweight nav behavior without external deps
(function () {
  'use strict';

  // Ensure a single Firebase app is initialized on every page and use LOCAL persistence
  (async function initAuthPersistence() {
    try {
      const { initializeApp, getApps } = await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js');
      const { getAuth, setPersistence, browserLocalPersistence, onAuthStateChanged } = await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js');
      const cfg = {
        apiKey: 'AIzaSyARFiFCadGKFUc_s6x3qNX8F4jsVawkzVg',
        authDomain: 'redsracing-a7f8b.firebaseapp.com',
        projectId: 'redsracing-a7f8b',
        storageBucket: 'redsracing-a7f8b.firebasestorage.app',
        messagingSenderId: '517034606151',
        appId: '1:517034606151:web:24cae262e1d98832757b62'
      };
      if (getApps().length === 0) initializeApp(cfg);
      const auth = getAuth();
      try { await setPersistence(auth, browserLocalPersistence); } catch (_) {}
      onAuthStateChanged(auth, (user) => {
        try {
          const loginBtn = document.getElementById('login-btn');
          const userProfile = document.getElementById('user-profile');
          const mobileLoginBtn = document.getElementById('mobile-login-btn');
          const mobileUserProfile = document.getElementById('mobile-user-profile');
          const userNameEl = document.getElementById('user-name');
          const mobileUserNameEl = document.getElementById('mobile-user-name');
          const logoutBtn = document.getElementById('user-logout');
          const mobileLogoutBtn = document.getElementById('mobile-user-logout');
          const authSection = document.getElementById('auth-section');

          const hideLegacyLoginLinks = (hide) => {
            try {
              // Always hide legacy login anchor in nav
              document.querySelectorAll('#login-btn, nav a[href="login.html"]').forEach((a) => {
                a.style.display = 'none';
              });
              // Hide any generic "Login" anchors that might exist without IDs
              document.querySelectorAll('nav a').forEach((a) => {
                const t = (a.textContent || '').trim().toLowerCase();
                if (t === 'login' || t === 'driver login') {
                  a.style.display = 'none';
                }
              });
              const authLink = document.getElementById('auth-link');
              const authLinkMobile = document.getElementById('auth-link-mobile');
              if (authLink) authLink.style.display = 'none';
              if (authLinkMobile) authLinkMobile.style.display = 'none';
            } catch(_) {}
          };

          function mountLoggedOutButton() {
            try {
              if (!authSection) return;
              let btn = document.getElementById('account-toggle-loggedout');
              if (!btn) {
                btn = document.createElement('button');
                btn.id = 'account-toggle-loggedout';
                btn.className = 'dropdown-toggle flex items-center space-x-2 bg-slate-800/50 hover:bg-slate-700/50 px-3 py-2 rounded-lg border border-slate-600/50 hover:border-slate-500/50 transition-colors';
                btn.innerHTML = '<div class="w-7 h-7 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center"><i class="fas fa-user text-white text-xs"></i></div><div class="text-left hidden md:block"><div class="text-sm font-semibold text-white">Login</div><div class="text-xs text-slate-400">Team Member</div></div><i class="fas fa-chevron-down text-slate-400 text-xs"></i>';
                btn.addEventListener('click', (e) => {
                  e.preventDefault();
                  window.location.href = 'login.html';
                });
                // Insert before any existing profile dropdown
                authSection.insertBefore(btn, authSection.firstChild);
              }
            } catch(_) {}
          }

          function unmountLoggedOutButton() {
            try {
              const btn = document.getElementById('account-toggle-loggedout');
              if (btn && btn.parentNode) btn.parentNode.removeChild(btn);
            } catch(_) {}
          }

          if (user) {
            document.body.setAttribute('data-auth', 'signed-in');
            localStorage.setItem('rr_auth_uid', user.uid);
            
            // Force show profile dropdown with multiple attempts
            const showProfile = () => {
              if (loginBtn) {
                loginBtn.classList.add('hidden');
                loginBtn.style.display = 'none';
              }
              unmountLoggedOutButton();
              
              if (userProfile) {
                userProfile.classList.remove('hidden');
                userProfile.style.display = 'flex';
                userProfile.style.opacity = '1';
                userProfile.style.visibility = 'visible';
                userProfile.style.pointerEvents = 'auto';
                // Force override any conflicting styles
                userProfile.setAttribute('data-auth-visible', 'true');
              }
              
              if (mobileLoginBtn) {
                mobileLoginBtn.classList.add('hidden');
                mobileLoginBtn.style.display = 'none';
              }
              
              if (mobileUserProfile) {
                mobileUserProfile.classList.remove('hidden');
                mobileUserProfile.style.display = 'block';
                mobileUserProfile.style.opacity = '1';
                mobileUserProfile.style.visibility = 'visible';
                mobileUserProfile.style.pointerEvents = 'auto';
                mobileUserProfile.setAttribute('data-auth-visible', 'true');
              }
            };
            
            // Show immediately
            showProfile();
            // Retry after short delay to overcome any CSS loading issues
            setTimeout(showProfile, 50);
            setTimeout(showProfile, 200);
            setTimeout(showProfile, 500);
            
            hideLegacyLoginLinks(true);
            const name = user.displayName || user.email || 'Driver';
            if (userNameEl) userNameEl.textContent = name;
            if (mobileUserNameEl) mobileUserNameEl.textContent = name;
            async function multiSignOut() {
              try { await auth.signOut(); } catch(_) {}
              try {
const core = await import('./assets/js/firebase-core.js');
                try { await core.getFirebaseAuth().signOut(); } catch(_) {}
              } catch(_) {}
            }
            if (logoutBtn) {
              logoutBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                await multiSignOut();
                window.location.href = 'index.html';
              });
            }
            if (mobileLogoutBtn) {
              mobileLogoutBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                await multiSignOut();
                window.location.href = 'index.html';
              });
            }
          } else {
            document.body.setAttribute('data-auth', 'signed-out');
            localStorage.removeItem('rr_auth_uid');
            if (userProfile) {
              userProfile.classList.add('hidden');
              userProfile.style.display = 'none';
            }
            if (loginBtn) {
              loginBtn.classList.remove('hidden');
              loginBtn.style.display = 'flex';
            }
            unmountLoggedOutButton();
            if (mobileUserProfile) {
              mobileUserProfile.classList.add('hidden');
              mobileUserProfile.style.display = 'none';
            }
            if (mobileLoginBtn) {
              mobileLoginBtn.classList.remove('hidden');
              mobileLoginBtn.style.display = 'block';
            }
          }
        } catch (_) {}
      });
    } catch (_) {
      // Non-fatal; pages without auth still work
    }
  })();

  function hideAllDropdowns() {
    document.querySelectorAll('.dropdown-menu, .modern-dropdown').forEach((menu) => {
      menu.classList.add('hidden');
      menu.setAttribute('aria-hidden', 'true');
      // Ensure it's not visually visible if CSS missing
      try {
        menu.style.display = 'none';
        menu.style.visibility = 'hidden';
        menu.style.opacity = '0';
      } catch (_) {}
    });
  }

  function showMenu(menu) {
    if (!menu) return;
    menu.classList.remove('hidden');
    menu.removeAttribute('aria-hidden');
    try {
      menu.style.display = 'block';
      menu.style.visibility = 'visible';
      menu.style.opacity = '1';
    } catch (_) {}
  }

  function toggleMenu(button, menu) {
    if (!menu) return;
    const hidden = menu.classList.contains('hidden');
    hideAllDropdowns();
    if (hidden) showMenu(menu);
    if (button) button.setAttribute('aria-expanded', String(hidden));
  }

  function initDropdowns() {
    // Hide all menus on load
    hideAllDropdowns();

    // Event delegation: toggle dropdown menus on click
    // Use capture=true to ensure we get the event even if other handlers stopPropagation
    document.addEventListener('click', (e) => {
      const toggleBtn = e.target.closest('.dropdown-toggle');
      const nestedToggleBtn = e.target.closest('.dropdown-nested-toggle');
      const insideMenu = e.target.closest('.dropdown-menu');

      // Handle nested dropdown toggle
      if (nestedToggleBtn) {
        e.preventDefault();
        e.stopPropagation();
        const nestedMenu = nestedToggleBtn.nextElementSibling;
        if (nestedMenu && nestedMenu.classList.contains('dropdown-menu-nested')) {
          // Close all other nested menus
          document.querySelectorAll('.dropdown-menu-nested').forEach((m) => {
            if (m !== nestedMenu) {
              m.classList.add('hidden');
            }
          });
          
          const isHidden = nestedMenu.classList.contains('hidden');
          if (isHidden) {
            nestedMenu.classList.remove('hidden');
            nestedMenu.style.display = 'block';
            nestedMenu.style.visibility = 'visible';
            nestedMenu.style.opacity = '1';
          } else {
            nestedMenu.classList.add('hidden');
          }
        }
        return;
      }

      if (toggleBtn) {
        e.preventDefault();
        e.stopPropagation();
        const menu = toggleBtn.nextElementSibling;
        if (menu && menu.classList.contains('dropdown-menu')) {
          // Close all other dropdowns first
          document.querySelectorAll('.dropdown-menu').forEach((m) => {
            if (m !== menu) {
              m.classList.add('hidden');
              m.setAttribute('aria-hidden', 'true');
              const otherToggle = m.previousElementSibling;
              if (otherToggle) otherToggle.setAttribute('aria-expanded', 'false');
            }
          });

          const isHidden = menu.classList.contains('hidden');
          if (isHidden) {
            showMenu(menu);
            toggleBtn.setAttribute('aria-expanded', 'true');
          } else {
            menu.classList.add('hidden');
            menu.setAttribute('aria-hidden', 'true');
            toggleBtn.setAttribute('aria-expanded', 'false');
          }
        }
        return;
      }

      // Outside click (not inside any dropdown) closes everything
      if (!insideMenu) {
        hideAllDropdowns();
        // Also hide nested menus
        document.querySelectorAll('.dropdown-menu-nested').forEach((m) => {
          m.classList.add('hidden');
        });
      }
    }, true);

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        hideAllDropdowns();
      }
    });
  }

  function initMobileMenu() {
    const btn = document.getElementById('mobile-menu-button');
    const mobileMenu = document.getElementById('mobile-menu');
    if (!btn || !mobileMenu) return;

    // Make mobile menu visible and functional
    mobileMenu.classList.add('hidden'); // Start hidden
    
    // Mobile menu toggle functionality
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      mobileMenu.classList.toggle('hidden');
    });
    
    // Close mobile menu when clicking outside
    document.addEventListener('click', (e) => {
      if (!mobileMenu.contains(e.target) && !btn.contains(e.target)) {
        mobileMenu.classList.add('hidden');
      }
    });
    
    // Initialize mobile accordion content
    const accordionContents = mobileMenu.querySelectorAll('.mobile-accordion-content');
    accordionContents.forEach(content => {
      content.style.maxHeight = '0';
      content.style.overflow = 'hidden';
      content.style.transition = 'max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
    });
    
    // Mobile accordion functionality
    const accordions = mobileMenu.querySelectorAll('.mobile-accordion');
    accordions.forEach(accordion => {
      accordion.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const content = accordion.nextElementSibling;
        const icon = accordion.querySelector('.accordion-icon');
        
        if (content && content.classList.contains('mobile-accordion-content')) {
          // Initialize content for CSS transitions
          content.style.overflow = 'hidden';
          content.style.transition = 'max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
          
          const isCurrentlyOpen = accordion.classList.contains('active');
          const currentMaxHeight = content.style.maxHeight;
          const isCurrentlyHidden = !isCurrentlyOpen || currentMaxHeight === '0px' || currentMaxHeight === '';
            
          // Close other accordions
          accordions.forEach(otherAccordion => {
            if (otherAccordion !== accordion) {
              const otherContent = otherAccordion.nextElementSibling;
              const otherIcon = otherAccordion.querySelector('.accordion-icon');
              if (otherContent) {
                otherContent.style.maxHeight = '0';
                otherAccordion.classList.remove('active');
                if (otherIcon) {
                  otherIcon.style.transform = 'rotate(0deg)';
                }
              }
            }
          });
          
          // Toggle current accordion
          if (isCurrentlyHidden) {
            accordion.classList.add('active');
            content.style.maxHeight = content.scrollHeight + 'px';
            if (icon) {
              icon.style.transform = 'rotate(180deg)';
            }
          } else {
            accordion.classList.remove('active');
            content.style.maxHeight = '0';
            if (icon) {
              icon.style.transform = 'rotate(0deg)';
            }
          }
        }
      });
    });
    
    // Close mobile menu when clicking on navigation links
    const navLinks = mobileMenu.querySelectorAll('a');
    navLinks.forEach(link => {
      link.addEventListener('click', () => {
        mobileMenu.classList.add('hidden');
      });
    });
  }

  // Add real-time clock for mobile app
  function initClock() {
    const clockElement = document.getElementById('mobile-clock');
    if (clockElement) {
      function updateClock() {
        const now = new Date();
        const timeString = now.toLocaleTimeString('en-US', {
          hour12: true,
          hour: 'numeric',
          minute: '2-digit'
        });
        clockElement.textContent = timeString;
      }
      
      // Update immediately and then every second
      updateClock();
      setInterval(updateClock, 1000);
    }
  }

  async function initSentryGlobal() {
    try {
      const { initSentry } = await import('/assets/js/sentry-init.js');
      await initSentry();
    } catch (_) {}
  }

  async function logClientError(evt) {
    try {
      // Throttle to max 1 write per 8s to avoid floods
      const now = Date.now();
      const last = window.__rr_last_log_ts || 0;
      if (now - last < 8000) return;
      window.__rr_last_log_ts = now;

      const { getFirestore, collection, addDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js');
      const { getAuth } = await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js');
      const auth = getAuth();
      const db = getFirestore();

      const isErrorEvent = evt instanceof ErrorEvent;
      const isPromiseRejection = evt && evt.type === 'unhandledrejection';
      const errorObj = isPromiseRejection ? (evt.reason || {}) : (isErrorEvent ? (evt.error || {}) : evt);
      const message = (errorObj && (errorObj.message || String(errorObj))) || (evt && evt.message) || 'Unknown front-end error';
      const stack = (errorObj && errorObj.stack) || null;

      const payload = {
        level: 'error',
        message,
        stack,
        page: (location && location.href) || null,
        userAgent: (navigator && navigator.userAgent) || null,
        uid: auth?.currentUser?.uid || null,
        email: auth?.currentUser?.email || null,
        createdAt: serverTimestamp(),
      };
      await addDoc(collection(db, 'client_logs'), payload);
    } catch (_) {}
  }

  function upgradeNavMenus() {
    try {
      console.log('[RedsRacing] Upgrading navigation menus...');
      // Desktop: Drivers dropdown -> ensure nested structure
      const dropdownToggles = document.querySelectorAll('nav .dropdown-toggle');
      console.log('[RedsRacing] Found', dropdownToggles.length, 'dropdown toggles');
      
      dropdownToggles.forEach((btn) => {
        const label = (btn.textContent || '').toLowerCase();
        const menu = btn.nextElementSibling;
        if (!menu) return;
        
        // Skip user profile dropdown - don't upgrade it
        const isProfileDropdown = btn.closest('#user-profile') || btn.closest('#auth-section') || btn.id === 'account-toggle-loggedout';
        if (isProfileDropdown) return;
        
        // Normalize menus to be visible only on toggle
        menu.classList.add('dropdown-menu');
        menu.classList.add('modern-dropdown');

        if (label.includes('drivers')) {
          console.log('[RedsRacing] Upgrading Drivers desktop menu');
          menu.innerHTML = `
              <div class="relative dropdown-nested">
                <button class="dropdown-item dropdown-nested-toggle flex items-center justify-between w-full">
                  <span>Jon Kirsch #8</span>
                  <i class="fas fa-chevron-right ml-2 text-xs"></i>
                </button>
                <div class="dropdown-menu-nested modern-dropdown hidden">
                  <a href="driver.html" class="dropdown-item">👤 Profile</a>
                  <a href="gallery.html" class="dropdown-item">📸 Gallery</a>
                  <a href="jons.html" class="dropdown-item">📊 Racing Stats</a>
                </div>
              </div>
              <div class="relative dropdown-nested">
                <button class="dropdown-item dropdown-nested-toggle flex items-center justify-between w-full">
                  <span>Jonny Kirsch #88</span>
                  <i class="fas fa-chevron-right ml-2 text-xs"></i>
                </button>
                <div class="dropdown-menu-nested modern-dropdown hidden">
                  <a href="jonny.html" class="dropdown-item">👤 Profile</a>
                  <a href="jonny-gallery.html" class="dropdown-item">📸 Gallery</a>
                  <a href="jonny-results.html" class="dropdown-item">📊 Race Results</a>
                </div>
              </div>
              <a href="legends.html" class="dropdown-item">Team Legends</a>
          `;
          console.log('[RedsRacing] Drivers desktop menu upgraded successfully');
        }
        if (label.includes('racing')) {
          console.log('[RedsRacing] Processing Racing menu to remove gallery');
          // Remove Gallery from Racing menu if present
          try {
            menu.querySelectorAll('a').forEach(a => {
              const t = (a.textContent || '').toLowerCase();
              if (t.includes('gallery')) a.remove();
            });
          } catch(_) {}
        }
      });

      // Mobile: Drivers accordion -> ensure nested structure
      const mobileMenu = document.getElementById('mobile-menu');
      console.log('[RedsRacing] Mobile menu found:', !!mobileMenu);
      if (mobileMenu) {
        const mobileAccordions = Array.from(mobileMenu.querySelectorAll('.mobile-accordion'));
        console.log('[RedsRacing] Found', mobileAccordions.length, 'mobile accordions');
        mobileAccordions.forEach(acc => {
          const label = (acc.textContent || '').toLowerCase();
          const content = acc.nextElementSibling;
          if (!content || !content.classList.contains('mobile-accordion-content')) return;
          if (label.includes('drivers')) {
            console.log('[RedsRacing] Upgrading Drivers mobile menu');
            content.innerHTML = `
              <button class="mobile-accordion mobile-accordion-nested">
                <span>Jon Kirsch #8</span><i class="fas fa-chevron-down accordion-icon"></i>
              </button>
              <div class="mobile-accordion-content mobile-accordion-content-nested">
                <a href="driver.html" class="mobile-nav-subitem mobile-nav-subitem-nested">👤 Profile</a>
                <a href="gallery.html" class="mobile-nav-subitem mobile-nav-subitem-nested">📸 Gallery</a>
                <a href="jons.html" class="mobile-nav-subitem mobile-nav-subitem-nested">📊 Racing Stats</a>
              </div>
              <button class="mobile-accordion mobile-accordion-nested">
                <span>Jonny Kirsch #88</span><i class="fas fa-chevron-down accordion-icon"></i>
              </button>
              <div class="mobile-accordion-content mobile-accordion-content-nested">
                <a href="jonny.html" class="mobile-nav-subitem mobile-nav-subitem-nested">👤 Profile</a>
                <a href="jonny-gallery.html" class="mobile-nav-subitem mobile-nav-subitem-nested">📸 Gallery</a>
                <a href="jonny-results.html" class="mobile-nav-subitem mobile-nav-subitem-nested">📊 Race Results</a>
              </div>
              <a href="legends.html" class="mobile-nav-subitem">Team Legends</a>
            `;
            console.log('[RedsRacing] Drivers mobile menu upgraded successfully');
          }
          if (label.includes('racing')) {
            console.log('[RedsRacing] Processing Racing mobile menu to remove gallery');
            // Remove Gallery from Racing mobile panel
            try {
              content.querySelectorAll('a').forEach(a => {
                const t = (a.textContent || '').toLowerCase();
                if (t.includes('gallery')) a.remove();
              });
            } catch(_) {}
          }
        });
      }
      console.log('[RedsRacing] Navigation upgrade complete');
      
      // Re-initialize mobile menu to handle dynamically added nested accordions
      initMobileMenuNested();
    } catch (err) {
      console.error('[RedsRacing] Error upgrading navigation:', err);
    }
  }
  
  // Handle nested mobile accordions after dynamic menu upgrade
  function initMobileMenuNested() {
    const mobileMenu = document.getElementById('mobile-menu');
    if (!mobileMenu) return;
    
    // Initialize nested accordion content
    const nestedContents = mobileMenu.querySelectorAll('.mobile-accordion-content-nested');
    nestedContents.forEach(content => {
      content.style.maxHeight = '0';
      content.style.overflow = 'hidden';
      content.style.transition = 'max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
    });
    
    // Nested accordion functionality
    const nestedAccordions = mobileMenu.querySelectorAll('.mobile-accordion-nested');
    console.log('[RedsRacing] Found', nestedAccordions.length, 'nested mobile accordions');
    
    nestedAccordions.forEach(accordion => {
      // Remove old listeners to avoid duplicates
      const newAccordion = accordion.cloneNode(true);
      accordion.parentNode.replaceChild(newAccordion, accordion);
      
      newAccordion.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const content = newAccordion.nextElementSibling;
        const icon = newAccordion.querySelector('.accordion-icon');
        
        if (content && content.classList.contains('mobile-accordion-content-nested')) {
          content.style.overflow = 'hidden';
          content.style.transition = 'max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
          
          const isCurrentlyOpen = newAccordion.classList.contains('active');
          const currentMaxHeight = content.style.maxHeight;
          const isCurrentlyHidden = !isCurrentlyOpen || currentMaxHeight === '0px' || currentMaxHeight === '';
          
          // Close other nested accordions
          nestedAccordions.forEach(otherAccordion => {
            if (otherAccordion !== newAccordion) {
              const otherContent = otherAccordion.nextElementSibling;
              const otherIcon = otherAccordion.querySelector('.accordion-icon');
              if (otherContent && otherContent.classList.contains('mobile-accordion-content-nested')) {
                otherContent.style.maxHeight = '0';
                otherAccordion.classList.remove('active');
                if (otherIcon) {
                  otherIcon.style.transform = 'rotate(0deg)';
                }
              }
            }
          });
          
          // Toggle current nested accordion
          if (isCurrentlyHidden) {
            newAccordion.classList.add('active');
            content.style.maxHeight = content.scrollHeight + 'px';
            if (icon) {
              icon.style.transform = 'rotate(180deg)';
            }
            
            // Update parent accordion height to accommodate nested content
            const parentContent = newAccordion.closest('.mobile-accordion-content');
            if (parentContent) {
              setTimeout(() => {
                parentContent.style.maxHeight = parentContent.scrollHeight + 'px';
              }, 50);
            }
          } else {
            newAccordion.classList.remove('active');
            content.style.maxHeight = '0';
            if (icon) {
              icon.style.transform = 'rotate(0deg)';
            }
            
            // Update parent accordion height
            const parentContent = newAccordion.closest('.mobile-accordion-content');
            if (parentContent) {
              setTimeout(() => {
                parentContent.style.maxHeight = parentContent.scrollHeight + 'px';
              }, 350);
            }
          }
        }
      });
    });
    
    console.log('[RedsRacing] Nested mobile accordion initialization complete');
  }
  
  // Make it globally available for debugging
  window.upgradeNavMenus = upgradeNavMenus;

  function ready() {
    try { upgradeNavMenus(); } catch (_) {}
    try { initDropdowns(); } catch (_) {}
    try { initMobileMenu(); } catch (_) {}
    try { initClock(); } catch (_) {}
    // Initialize Sentry (error monitoring, tracing, profiling, replay) if DSN present
    try { initSentryGlobal(); } catch (_) {}
    // Global frontend error fallback to Firestore
    try {
      window.addEventListener('error', logClientError);
      window.addEventListener('unhandledrejection', logClientError);
    } catch (_) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ready);
  } else {
    ready();
  }
  
  // Android WebView sometimes needs extra time - retry upgrade after delay
  setTimeout(() => {
    try { upgradeNavMenus(); } catch (_) {}
  }, 100);
  
  setTimeout(() => {
    try { upgradeNavMenus(); } catch (_) {}
  }, 500);
})();
