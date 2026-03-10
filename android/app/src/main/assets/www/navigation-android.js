// Android WebView compatible navigation.js - uses Firebase Compat API
(function () {
  'use strict';

  // Use Firebase compat that's already loaded via script tags
  (async function initAuthPersistence() {
    console.log('[RedsRacing Auth] ===== INIT STARTING (Android) =====');
    try {
      // Wait for Firebase compat to be available
      if (typeof firebase === 'undefined') {
        console.error('[RedsRacing Auth] Firebase compat not loaded');
        return;
      }

      const cfg = {
        apiKey: 'AIzaSyARFiFCadGKFUc_s6x3qNX8F4jsVawkzVg',
        authDomain: 'redsracing-a7f8b.firebaseapp.com',
        projectId: 'redsracing-a7f8b',
        storageBucket: 'redsracing-a7f8b.firebasestorage.app',
        messagingSenderId: '517034606151',
        appId: '1:517034606151:web:24cae262e1d98832757b62'
      };

      // Initialize if not already
      if (!firebase.apps.length) {
        firebase.initializeApp(cfg);
        console.log('[RedsRacing Auth] Firebase initialized');
      }

      const auth = firebase.auth();
      await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);

      console.log('[RedsRacing Auth] Setting up auth listener');

      // Setup auth state listener
      auth.onAuthStateChanged((user) => {
        const handleAuth = () => {
          try {
            const loginBtn = document.getElementById('login-btn');
            const userProfile = document.getElementById('user-profile');
            const mobileLoginBtn = document.getElementById('mobile-login-btn');
            const mobileUserProfile = document.getElementById('mobile-user-profile');
            const userNameEl = document.getElementById('user-name');
            const mobileUserNameEl = document.getElementById('mobile-user-name');
            const logoutBtn = document.getElementById('user-logout');
            const mobileLogoutBtn = document.getElementById('mobile-user-logout');

            if (user) {
              console.log('[RedsRacing Auth] User signed in:', user.email);
              document.body.setAttribute('data-auth', 'signed-in');
              localStorage.setItem('rr_auth_uid', user.uid);

              if (userProfile) {
                userProfile.classList.remove('hidden');
                userProfile.style.display = 'flex';
                userProfile.style.visibility = 'visible';
                userProfile.style.opacity = '1';
              }
              if (mobileUserProfile) {
                mobileUserProfile.classList.remove('hidden');
                mobileUserProfile.style.display = 'block';
              }
              if (loginBtn) {
                loginBtn.classList.add('hidden');
                loginBtn.style.display = 'none';
              }
              if (mobileLoginBtn) {
                mobileLoginBtn.classList.add('hidden');
                mobileLoginBtn.style.display = 'none';
              }

              const name = user.displayName || user.email || 'Driver';
              if (userNameEl) userNameEl.textContent = name;
              if (mobileUserNameEl) mobileUserNameEl.textContent = name;

              const handleLogout = async () => {
                try {
                  await auth.signOut();
                  window.location.href = 'index.html';
                } catch (e) {
                  console.error('Logout error:', e);
                }
              };

              if (logoutBtn) {
                logoutBtn.addEventListener('click', (e) => {
                  e.preventDefault();
                  handleLogout();
                });
              }
              if (mobileLogoutBtn) {
                mobileLogoutBtn.addEventListener('click', (e) => {
                  e.preventDefault();
                  handleLogout();
                });
              }
            } else {
              console.log('[RedsRacing Auth] User signed out');
              document.body.setAttribute('data-auth', 'signed-out');
              localStorage.removeItem('rr_auth_uid');

              if (userProfile) {
                userProfile.classList.add('hidden');
                userProfile.style.display = 'none';
              }
              if (mobileUserProfile) {
                mobileUserProfile.classList.add('hidden');
                mobileUserProfile.style.display = 'none';
              }
              if (loginBtn) {
                loginBtn.classList.remove('hidden');
                loginBtn.style.display = '';
              }
              if (mobileLoginBtn) {
                mobileLoginBtn.classList.remove('hidden');
                mobileLoginBtn.style.display = '';
              }
            }
          } catch (err) {
            console.error('[RedsRacing Auth] handleAuth error:', err);
          }
        };

        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', handleAuth);
        } else {
          handleAuth();
        }
      });

      console.log('[RedsRacing Auth] ===== INIT COMPLETE =====');
    } catch (err) {
      console.error('[RedsRacing Auth] ===== INIT FAILED =====', err);
    }
  })();

  // Dropdown handling (rest of navigation.js functionality)
  function hideAllDropdowns() {
    document.querySelectorAll('.dropdown-menu, .modern-dropdown').forEach((menu) => {
      menu.classList.add('hidden');
      menu.setAttribute('aria-hidden', 'true');
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

  function initDropdowns() {
    hideAllDropdowns();

    document.addEventListener('click', (e) => {
      const toggleBtn = e.target.closest('.dropdown-toggle');
      const nestedToggleBtn = e.target.closest('.dropdown-nested-toggle');
      const insideMenu = e.target.closest('.dropdown-menu');

      if (nestedToggleBtn) {
        e.preventDefault();
        e.stopPropagation();
        const nestedMenu = nestedToggleBtn.nextElementSibling;
        if (nestedMenu && nestedMenu.classList.contains('dropdown-menu-nested')) {
          document.querySelectorAll('.dropdown-menu-nested').forEach((m) => {
            if (m !== nestedMenu) m.classList.add('hidden');
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

      if (!insideMenu) {
        hideAllDropdowns();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDropdowns);
  } else {
    initDropdowns();
  }

  // Mobile menu
  const mobileMenuButton = document.getElementById('mobile-menu-button');
  const mobileMenu = document.getElementById('mobile-menu');

  if (mobileMenuButton && mobileMenu) {
    mobileMenuButton.addEventListener('click', () => {
      const isHidden = mobileMenu.classList.contains('hidden');
      if (isHidden) {
        mobileMenu.classList.remove('hidden');
        mobileMenu.classList.add('slide-down');
      } else {
        mobileMenu.classList.add('hidden');
        mobileMenu.classList.remove('slide-down');
      }
    });
  }

  // Mobile accordions
  document.addEventListener('click', (e) => {
    const accordion = e.target.closest('.mobile-accordion');
    if (accordion) {
      const content = accordion.nextElementSibling;
      const icon = accordion.querySelector('.accordion-icon');

      if (content && content.classList.contains('mobile-accordion-content')) {
        const isHidden = content.style.display === 'none' || !content.style.display;

        if (isHidden) {
          content.style.display = 'block';
          if (icon) icon.style.transform = 'rotate(180deg)';
        } else {
          content.style.display = 'none';
          if (icon) icon.style.transform = 'rotate(0deg)';
        }
      }
    }
  });
})();
