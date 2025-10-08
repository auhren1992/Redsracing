import "./app.js";

// Enhanced Navigation functionality - independent of Firebase and ES6 modules
(function () {
  "use strict";

  let navigationInitialized = false;
  let retryCount = 0;
  const maxRetries = 3;

  // Lazy import auth utilities only when needed to keep navigation independent
  let authNavInitialized = false;
  async function initAuthNavigation() {
    if (authNavInitialized) return;
    authNavInitialized = true;
    try {
      const { monitorAuthState, validateUserClaims, safeSignOut } = await import("./auth-utils.js");

      // Locate the desktop nav container
      const desktopNav = document.querySelector(
        "nav .md\\:flex.items-center, nav .hidden.md\\:flex.items-center",
      );

      // Ensure a consistent Account dropdown exists (desktop)
      let accountDropdown = document.getElementById("account-dropdown");
      if (!accountDropdown && desktopNav) {
        accountDropdown = document.createElement("div");
        accountDropdown.className = "dropdown relative";
        accountDropdown.id = "account-dropdown";
        accountDropdown.innerHTML = `
          <button id=\"account-toggle\" class=\"dropdown-toggle bg-neon-yellow text-slate-900 py-2 px-4 rounded-md font-bold hover:bg-yellow-300 transition\" aria-haspopup=\"true\" aria-expanded=\"false\">
            Account
          </button>
          <div id=\"account-menu\" class=\"dropdown-menu hidden\" role=\"menu\" aria-hidden=\"true\">
            <!-- Items populated by JS -->
          </div>
        `;
        desktopNav.appendChild(accountDropdown);
      }

      // Ensure mobile Account section exists
      const mobileMenu = document.getElementById("mobile-menu");
      if (mobileMenu && !document.getElementById("account-dropdown-mobile")) {
        const container = document.createElement("div");
        container.id = "account-dropdown-mobile";
        container.innerHTML = `
          <button id=\"account-toggle-mobile\" class=\"mobile-accordion text-sm px-6 pt-3 font-bold text-slate-400 w-full text-left\">Login</button>
          <div id=\"account-menu-mobile\" class=\"mobile-accordion-content hidden pl-4\"></div>
        `;
        mobileMenu.appendChild(container);
      }

      function buildMenuInto(menuId, items, opts = {}) {
        const menu = document.getElementById(menuId);
        if (!menu) return;
        menu.innerHTML = "";
        for (const item of items) {
          const a = document.createElement("a");
          a.href = item.href || "#";
          a.textContent = item.label;
          if (opts.roleMenuItem) a.setAttribute("role", "menuitem");
          if (opts.extraClasses) a.className = opts.extraClasses;
          if (item.onClick) {
            a.addEventListener("click", (e) => {
              e.preventDefault();
              item.onClick();
            });
          }
          menu.appendChild(a);
        }
      }

      function buildMenu(items) {
        // Desktop dropdown
        buildMenuInto("account-menu", items, { roleMenuItem: true });
        // Mobile accordion menu
        buildMenuInto(
          "account-menu-mobile",
          items,
          { extraClasses: "block py-2 pl-6 text-sm hover:bg-slate-800" }
        );
      }

      function hideLegacyLinks() {
        const selectors = [
          'a[href="login.html"]',
          'a[href="signup.html"]',
          'a[href="profile.html"]',
          'a[href="dashboard.html"]',
          'a[href="redsracing-dashboard.html"]',
          'a[href="follower-dashboard.html"]'
        ];
        selectors.forEach((sel) => {
          document.querySelectorAll(sel).forEach((el) => {
            const parentDropdown = el.closest('.dropdown');
            if (parentDropdown && parentDropdown.id === 'account-dropdown') return;
            el.style.display = 'none';
          });
        });
      }

      function setAvatarButtonContent(name, email, photoURL) {
        const btn = document.getElementById('account-toggle');
        if (!btn) return;
        const initials = (name || email || 'U')
          .replace(/[^a-zA-Z ]/g, '')
          .trim()
          .split(' ')
          .map((p) => p[0])
          .join('')
          .slice(0, 2)
          .toUpperCase();
        btn.innerHTML = '';
        const wrap = document.createElement('span');
        wrap.className = 'inline-flex items-center gap-2';
        const avatar = document.createElement('span');
        avatar.className = 'avatar-btn';
        if (photoURL) {
          const img = document.createElement('img');
          img.src = photoURL;
          img.alt = 'Profile';
          img.className = 'avatar-img';
          avatar.appendChild(img);
        } else {
          const i = document.createElement('span');
          i.textContent = initials;
          i.className = 'avatar-initials';
          avatar.appendChild(i);
        }
        const label = document.createElement('span');
        label.textContent = 'Account';
        wrap.appendChild(avatar);
        wrap.appendChild(label);
        btn.appendChild(wrap);
      }

      async function renderForUser(user) {
        hideLegacyLinks();
        const menuBtn = document.getElementById("account-toggle");
        if (!menuBtn) return;
        if (!user) {
          menuBtn.textContent = "Login";
          const items = [
            { label: "Team Member Login", href: "login.html" },
            { label: "Follower Login", href: "follower-login.html" },
            { label: "Sign Up", href: "signup.html" },
          ];
          buildMenu(items);
          const mobileBtn = document.getElementById("account-toggle-mobile");
          if (mobileBtn) mobileBtn.textContent = "Login";
          return;
        }
        // Ensure default role is set (admin vs public-fan), then read claims
        let role = null;
        try {
          // Call backend to enforce role
          const { getFunctions, httpsCallable } = await import("firebase/functions");
          try { await httpsCallable(getFunctions(), "ensureDefaultRole")({}); } catch (_) {}
          // Force token refresh to pick up new claims
          try { await user.getIdToken(true); } catch (_) {}
          const claims = await validateUserClaims();
          role = claims.success ? claims.claims.role : null;
        } catch {}

        const isAdmin = role === "admin";
        const displayName = user.displayName || '';
        const email = user.email || '';
        setAvatarButtonContent(displayName, email, user.photoURL);

        // Persist role into users/{uid}.role for visibility in Firestore (without changing security claims)
        try {
          const normalized = (role && typeof role === 'string') ? role : 'public-fan';
          // Optional: map legacy 'follower' to 'public-fan'
          const normRole = normalized === 'follower' ? 'public-fan' : normalized;
          const [{ getFirebaseDb }, { doc, setDoc }] = await Promise.all([
            import("./firebase-core.js"),
            import("firebase/firestore"),
          ]);
          const db = getFirebaseDb();
          await setDoc(doc(db, 'users', user.uid), { role: normRole }, { merge: true });
        } catch (_) {}

        const items = [];
        // Header (not clickable)
        items.push({ label: `${displayName || email}`, href: '#' });
        items.push({ label: '—', href: '#' });

        // Settings (was under crown menu; now under account dropdown for all users)
        items.push({ label: "Settings", href: "settings.html" });

        // Role-specific main destination
        if (isAdmin) {
          items.push({ label: "Admin Console", href: "admin-console.html" });
        } else {
          items.push({ label: "Follower Dashboard", href: "follower-dashboard.html" });
        }

        // Back to site (was under crown menu)
        items.push({ label: "Back to Site", href: "index.html" });

        // Sign out
        items.push({
          label: "Sign out",
          onClick: async () => {
            try {
              await safeSignOut();
            } finally {
              window.location.href = "login.html";
            }
          },
        });
        buildMenu(items);
        const mobileBtn = document.getElementById("account-toggle-mobile");
        if (mobileBtn) mobileBtn.textContent = "Account";
      }

      // Wire dropdown toggle behavior (click to open/close)
      function wireDropdown() {
        const toggle = document.getElementById("account-toggle");
        const menu = document.getElementById("account-menu");
        if (!toggle || !menu) return;
        // Remove existing listeners by replacing nodes
        const newToggle = toggle.cloneNode(true);
        toggle.parentNode.replaceChild(newToggle, toggle);
        newToggle.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          const hidden = menu.classList.contains("hidden");
          document.querySelectorAll(".dropdown-menu").forEach((m) => m.classList.add("hidden"));
          if (hidden) menu.classList.remove("hidden");
          newToggle.setAttribute("aria-expanded", String(hidden));
        });
        document.addEventListener("click", () => menu.classList.add("hidden"));
      }

      wireDropdown();

      monitorAuthState(
        async (user) => {
          await renderForUser(user);
        },
        () => {
          // On error, show logged-out menu
          renderForUser(null);
        },
      );
    } catch (e) {
      // If auth utils fail to load, do nothing; nav remains static
    }
  }

  // Lazy-load Sentry once per page if configured and in production
  if (process.env.NODE_ENV === 'production' && !window.__sentryLoaded) {
    window.__sentryLoaded = true;
    setTimeout(() => {
      import(/* webpackChunkName: "sentry" */ './sentry-init.js')
        .then(({ initSentry }) => initSentry && initSentry())
        .catch(() => {});
    }, 0);
  }

  // Enhanced initialization with error handling and retry mechanism
  function initNavigation() {
    if (navigationInitialized) {
      return;
    }

    try {
      // Mobile menu toggle with enhanced error handling - support both IDs
      const mobileMenuButton = document.getElementById("mobile-menu-button") || document.getElementById("mobile-menu-toggle");

      // Initialize auth-aware nav once DOM is available
      initAuthNavigation();
      if (mobileMenuButton) {
        // Remove any existing listeners to prevent duplicates
        mobileMenuButton.replaceWith(mobileMenuButton.cloneNode(true));
        const newMobileMenuButton =
          document.getElementById("mobile-menu-button") || document.getElementById("mobile-menu-toggle");

        newMobileMenuButton.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();

          const mobileMenu = document.getElementById("mobile-menu");
          if (mobileMenu) {
            mobileMenu.classList.toggle("hidden");
            const isHidden = mobileMenu.classList.contains("hidden");
            
            // Handle hamburger icon switching
            const menuIcon = document.getElementById("menu-icon");
            const closeIcon = document.getElementById("close-icon");
            
            if (menuIcon && closeIcon) {
              if (isHidden) {
                menuIcon.style.display = "block";
                closeIcon.style.display = "none";
              } else {
                menuIcon.style.display = "none";
                closeIcon.style.display = "block";
              }
            }

            // Update aria attributes for accessibility
            newMobileMenuButton.setAttribute("aria-expanded", !isHidden);
            mobileMenu.setAttribute("aria-hidden", isHidden);
          }
        });

        // Add keyboard support
        newMobileMenuButton.addEventListener("keydown", (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            newMobileMenuButton.click();
          } else if (event.key === "Escape") {
            const mobileMenu = document.getElementById("mobile-menu");
            if (mobileMenu && !mobileMenu.classList.contains("hidden")) {
              // If focus is inside mobile menu, move it back to the button first
              if (mobileMenu.contains(document.activeElement)) {
                try { newMobileMenuButton.focus(); } catch (_) {}
              }
              mobileMenu.classList.add("hidden");
              newMobileMenuButton.setAttribute("aria-expanded", "false");
              mobileMenu.setAttribute("aria-hidden", "true");
            }
          }
        });
      }

      // Mobile menu accordion with enhanced functionality
      document
        .querySelectorAll(".mobile-accordion")
        .forEach((button, index) => {
          // Remove existing listeners
          const newButton = button.cloneNode(true);
          button.parentNode.replaceChild(newButton, button);

          newButton.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();

            const content = newButton.nextElementSibling;
            if (
              content &&
              content.classList.contains("mobile-accordion-content")
            ) {
              // Check both hidden class and display style
              const isCurrentlyHidden = content.classList.contains("hidden") || 
                content.style.display === "none" || 
                getComputedStyle(content).display === "none";

              // Close other accordions (optional - remove if you want multiple open)
              document
                .querySelectorAll(".mobile-accordion-content")
                .forEach((otherContent) => {
                  if (otherContent !== content) {
                    otherContent.classList.add("hidden");
                    otherContent.style.display = "none";
                  }
                });

              // Toggle current accordion
              if (isCurrentlyHidden) {
                content.classList.remove("hidden");
                content.style.display = "block";
              } else {
                content.classList.add("hidden");
                content.style.display = "none";
              }

              // Update aria attributes
              newButton.setAttribute("aria-expanded", !isCurrentlyHidden);
              content.setAttribute("aria-hidden", isCurrentlyHidden);
            }
          });

          // Add keyboard support
          newButton.addEventListener("keydown", (event) => {
          if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              newButton.click();
            } else if (event.key === "Escape") {
              const content = newButton.nextElementSibling;
              if (content && content.classList.contains("mobile-accordion-content")) {
                if (!content.classList.contains("hidden")) {
                  // If focus is inside the content being hidden, move it out
                  if (content.contains(document.activeElement)) {
                    try { newButton.focus(); } catch (_) {}
                  }
                  content.classList.add("hidden");
                  content.style.display = "none";
                  newButton.setAttribute("aria-expanded", "false");
                  content.setAttribute("aria-hidden", "true");
                }
              }
            }
          });
        });

      // Helpers to manage dropdown visibility, focus, and accessibility state
      function setInert(el, value) {
        try {
          if (!el) return;
          if (value) el.setAttribute("inert", "");
          else el.removeAttribute("inert");
        } catch (_) {}
      }
      function hideDropdownMenu(menu) {
        if (!menu) return;
        const toggle = menu.previousElementSibling;
        // If focus is inside the menu being hidden, move it back to the toggle first
        if (menu.contains(document.activeElement) && toggle) {
          try { toggle.focus(); } catch (_) {}
        }
        menu.classList.add("hidden");
        menu.setAttribute("aria-hidden", "true");
        setInert(menu, true);
        if (toggle) toggle.setAttribute("aria-expanded", "false");
      }
      function showDropdownMenu(menu, toggle) {
        if (!menu) return;
        menu.classList.remove("hidden");
        menu.setAttribute("aria-hidden", "false");
        setInert(menu, false);
        if (toggle) toggle.setAttribute("aria-expanded", "true");
      }

      // Enhanced desktop dropdowns
      document.querySelectorAll(".dropdown-toggle").forEach((button, index) => {
        // Remove existing listeners
        const newButton = button.cloneNode(true);
        button.parentNode.replaceChild(newButton, button);

        newButton.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();

          const dropdownMenu = newButton.nextElementSibling;
          if (
            !dropdownMenu ||
            !dropdownMenu.classList.contains("dropdown-menu")
          ) {
            return;
          }

          const isCurrentlyHidden = dropdownMenu.classList.contains("hidden");

          // Close all other dropdowns first
          document.querySelectorAll(".dropdown-menu").forEach((menu) => {
            if (menu !== dropdownMenu) {
              hideDropdownMenu(menu);
            }
          });

          // Update all other dropdown toggles
          document
            .querySelectorAll(".dropdown-toggle")
            .forEach((otherButton) => {
              if (otherButton !== newButton) {
                otherButton.setAttribute("aria-expanded", "false");
              }
            });

          // Toggle the current dropdown
          if (isCurrentlyHidden) {
            showDropdownMenu(dropdownMenu, newButton);

            // Focus first menu item for accessibility
            const firstMenuItem = dropdownMenu.querySelector("a");
            if (firstMenuItem) {
              setTimeout(() => firstMenuItem.focus(), 100);
            }
          } else {
            hideDropdownMenu(dropdownMenu);
          }
        });

        // Add keyboard support for dropdown toggles
        newButton.addEventListener("keydown", (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            newButton.click();
          } else if (event.key === "Escape") {
            // Close dropdown on Escape
            const dropdownMenu = newButton.nextElementSibling;
            if (dropdownMenu) {
              dropdownMenu.classList.add("hidden");
              dropdownMenu.setAttribute("aria-hidden", "true");
              newButton.setAttribute("aria-expanded", "false");
              newButton.focus();
            }
          }
        });

      });

      // Enhanced outside click handling
      const handleOutsideClick = (event) => {
        // Don't close if clicking on a dropdown toggle or menu
        if (
          event.target.closest(".dropdown-toggle") ||
          event.target.closest(".dropdown-menu")
        ) {
          return;
        }

        // Close all dropdowns (move focus out if it was inside)
        document.querySelectorAll(".dropdown-menu").forEach((menu) => {
          hideDropdownMenu(menu);
        });

        // Update all toggle buttons
        document.querySelectorAll(".dropdown-toggle").forEach((button) => {
          button.setAttribute("aria-expanded", "false");
        });
      };

      // Remove existing listener and add new one
      document.removeEventListener(
        "click",
        window.navigationOutsideClickHandler,
      );
      document.addEventListener("click", handleOutsideClick);
      window.navigationOutsideClickHandler = handleOutsideClick;

      // Enhanced keyboard navigation for dropdown menus
      document.querySelectorAll(".dropdown-menu").forEach((menu) => {
        menu.addEventListener("keydown", (event) => {
          const menuItems = Array.from(menu.querySelectorAll("a"));
          const currentIndex = menuItems.indexOf(event.target);

          switch (event.key) {
            case "ArrowDown":
              event.preventDefault();
              const nextIndex = (currentIndex + 1) % menuItems.length;
              menuItems[nextIndex]?.focus();
              break;
            case "ArrowUp":
              event.preventDefault();
              const prevIndex =
                currentIndex === 0 ? menuItems.length - 1 : currentIndex - 1;
              menuItems[prevIndex]?.focus();
              break;
            case "Escape":
              event.preventDefault();
              hideDropdownMenu(menu);
              break;
          }
        });
      });

      // Set current year in footer with error handling
      const yearEl = document.getElementById("year");
      if (yearEl) {
        try {
          yearEl.textContent = new Date().getFullYear().toString();
        } catch (error) {
          yearEl.textContent = "2025"; // Fallback year
        }
      }

      // Initialize ARIA attributes
      document.querySelectorAll(".dropdown-toggle").forEach((toggle) => {
        toggle.setAttribute("aria-expanded", "false");
        toggle.setAttribute("aria-haspopup", "true");
      });

      document.querySelectorAll(".dropdown-menu").forEach((menu) => {
        menu.setAttribute("aria-hidden", "true");
        menu.setAttribute("role", "menu");
        try { menu.setAttribute("inert", ""); } catch (_) {}
      });

      document.querySelectorAll(".mobile-accordion").forEach((accordion) => {
        accordion.setAttribute("aria-expanded", "false");
      });

      document
        .querySelectorAll(".mobile-accordion-content")
        .forEach((content) => {
          content.setAttribute("aria-hidden", "true");
        });

      navigationInitialized = true;
    } catch (error) {
      retryCount++;

      if (retryCount <= maxRetries) {
        setTimeout(initNavigation, 1000);
      } else {
        // Try basic fallback initialization
        initBasicNavigation();
      }
    }
  }

  // Basic fallback navigation for when main initialization fails
  function initBasicNavigation() {
    try {
      // Basic mobile menu toggle
      const mobileButton = document.getElementById("mobile-menu-button");
      const mobileMenu = document.getElementById("mobile-menu");

      if (mobileButton && mobileMenu) {
        mobileButton.onclick = () => mobileMenu.classList.toggle("hidden");
      }

      // Basic dropdown functionality
      document.querySelectorAll(".dropdown-toggle").forEach((button) => {
        button.onclick = (event) => {
          event.stopPropagation();
          const menu = button.nextElementSibling;
          if (menu) {
            document
              .querySelectorAll(".dropdown-menu")
              .forEach((m) => m.classList.add("hidden"));
            menu.classList.remove("hidden");
          }
        };
      });

      // Basic outside click
      document.onclick = () => {
        document
          .querySelectorAll(".dropdown-menu")
          .forEach((menu) => menu.classList.add("hidden"));
      };
    } catch (error) {}
  }

  // Initialize navigation when DOM is ready with multiple fallback attempts
  function attemptInitialization() {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", initNavigation);
      // Backup initialization after a delay
      setTimeout(initNavigation, 2000);
    } else {
      initNavigation();
    }
  }

  // Start initialization
  attemptInitialization();

  // Make functions available globally for debugging
  window.initNavigation = initNavigation;
  window.initBasicNavigation = initBasicNavigation;

  // Re-initialize on page visibility change (handles cases where page was in background)
  if (typeof document.visibilityState !== "undefined") {
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden && !navigationInitialized) {
        setTimeout(initNavigation, 500);
      }
    });
  }
})();
