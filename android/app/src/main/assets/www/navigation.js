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
            if (loginBtn) loginBtn.classList.add('hidden');
            unmountLoggedOutButton();
            if (userProfile) userProfile.classList.remove('hidden');
            if (mobileLoginBtn) mobileLoginBtn.classList.add('hidden');
            if (mobileUserProfile) mobileUserProfile.classList.remove('hidden');
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
                window.location.href = 'login.html';
              });
            }
            if (mobileLogoutBtn) {
              mobileLogoutBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                await multiSignOut();
                window.location.href = 'login.html';
              });
            }
          } else {
            document.body.setAttribute('data-auth', 'signed-out');
            localStorage.removeItem('rr_auth_uid');
            if (userProfile) userProfile.classList.add('hidden');
            if (loginBtn) loginBtn.classList.add('hidden');
            mountLoggedOutButton();
            if (mobileUserProfile) mobileUserProfile.classList.add('hidden');
            if (mobileLoginBtn) mobileLoginBtn.classList.add('hidden');
            hideLegacyLoginLinks(true);
          }
        } catch (_) {}
      });
    } catch (_) {
      // Non-fatal; pages without auth still work
    }
  })();

  function hideAllDropdowns() {
    document.querySelectorAll('.dropdown-menu').forEach((menu) => {
      menu.classList.add('hidden');
      menu.setAttribute('aria-hidden', 'true');
      // Ensure it's not visually visible if CSS missing
      try { menu.style.display = 'none'; } catch (_) {}
    });
  }

  function showMenu(menu) {
    if (!menu) return;
    menu.classList.remove('hidden');
    menu.removeAttribute('aria-hidden');
    try { menu.style.display = ''; } catch (_) {}
  }

  function toggleMenu(button, menu) {
    if (!menu) return;
    const hidden = menu.classList.contains('hidden');
    hideAllDropdowns();
    if (hidden) showMenu(menu);
    if (button) button.setAttribute('aria-expanded', String(hidden));
  }

  function initDropdowns() {
    // Hide on load
    hideAllDropdowns();

    // Wire toggles
    document.querySelectorAll('.dropdown-toggle').forEach((btn) => {
      const menu = btn.nextElementSibling;
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleMenu(btn, menu);
      });
    });

    // Close on outside click
    document.addEventListener('click', () => hideAllDropdowns());
  }

  function initMobileMenu() {
    const btn = document.getElementById('mobile-menu-button');
    const legacy = document.getElementById('mobile-menu');
    if (!btn) return;

    // Always hide legacy accordion menu to reduce clutter on mobile
    if (legacy) {
      try { legacy.classList.add('hidden'); legacy.style.display = 'none'; } catch(_) {}
    }

    // Build a compact dropdown panel for mobile
    let panel = document.getElementById('mobile-menu-dropdown');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'mobile-menu-dropdown';
      panel.className = 'dropdown-menu modern-dropdown mobile-dropdown-panel hidden';
      // Populate with grouped links (same items you already use)
      panel.innerHTML = `
        <div class="px-3 py-2 text-xs uppercase tracking-wider text-slate-400">Quick Links</div>
        <a href="index.html">🏠 Home</a>
        <div class="border-t border-slate-600/50 my-2"></div>
        <div class="px-3 py-2 text-xs uppercase tracking-wider text-slate-400">Drivers</div>
        <a href="driver.html">Jon Kirsch #8</a>
        <a href="jonny.html">Jonny Kirsch #88</a>
        <a href="legends.html">Team Legends</a>
        <div class="border-t border-slate-600/50 my-2"></div>
        <div class="px-3 py-2 text-xs uppercase tracking-wider text-slate-400">Racing</div>
        <a href="schedule.html">Schedule</a>
        <a href="leaderboard.html">Leaderboard</a>
        <a href="gallery.html">📸 Gallery</a>
        <a href="videos.html">🎥 Videos</a>
        <div class="border-t border-slate-600/50 my-2"></div>
        <div class="px-3 py-2 text-xs uppercase tracking-wider text-slate-400">Community</div>
        <a href="qna.html">❓ Q&A</a>
        <a href="feedback.html">💬 Feedback</a>
        <a href="sponsorship.html">💰 Sponsorship</a>
        <div class="border-t border-slate-600/50 my-2"></div>
        <a href="admin-console.html">🛠️ Dashboard</a>
        <a href="profile.html">👤 My Profile</a>
      `;
      // Attach near the button
      try {
        const nav = btn.closest('nav') || document.body;
        nav.appendChild(panel);
      } catch(_) { document.body.appendChild(panel); }
    }

    function positionPanel() {
      try {
        const rect = btn.getBoundingClientRect();
        panel.style.position = 'absolute';
        panel.style.top = (rect.bottom + window.scrollY + 8) + 'px';
        panel.style.right = '1rem';
        panel.style.zIndex = 10000;
      } catch(_) {}
    }

    // Toggle behavior
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      positionPanel();
      const hidden = panel.classList.contains('hidden');
      hideAllDropdowns();
      if (hidden) panel.classList.remove('hidden');
    });

    // Close on outside click or resize/scroll
    document.addEventListener('click', (evt) => {
      if (!panel.contains(evt.target) && evt.target !== btn) {
        panel.classList.add('hidden');
      }
    });
    window.addEventListener('resize', () => { panel.classList.add('hidden'); });
    window.addEventListener('scroll', () => { panel.classList.add('hidden'); });
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

  function ready() {
    try { initDropdowns(); } catch (_) {}
    try { initMobileMenu(); } catch (_) {}
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
})();
