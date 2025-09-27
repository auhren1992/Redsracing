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
      const { monitorAuthState } = await import("./auth-utils.js");

      // Locate the desktop nav container
      const desktopNav = document.querySelector(
        "nav .md\\:flex.items-center, nav .hidden.md\\:flex.items-center",
      );
      // Find the login dropdown by looking for a login link in its menu
      const loginLink = document.querySelector('a[href="login.html"]');
      const loginDropdown = loginLink ? loginLink.closest(".dropdown") : null;

      // Create a Dashboard link we can toggle
      let dashboardLink = document.getElementById("auth-link-nav");
      if (!dashboardLink && desktopNav) {
        dashboardLink = document.createElement("a");
        dashboardLink.id = "auth-link-nav";
        dashboardLink.href = "dashboard.html"; // routes to correct dashboard
        dashboardLink.className =
          "bg-neon-yellow text-slate-900 py-2 px-5 rounded-md hover:bg-yellow-300 transition duration-300 font-bold";
        dashboardLink.textContent = "Dashboard";
        dashboardLink.style.display = "none";
        desktopNav.appendChild(dashboardLink);
      }

      monitorAuthState(
        (user) => {
          const isAuthed = !!user;
          if (dashboardLink) {
            dashboardLink.style.display = isAuthed ? "inline-block" : "none";
          }
          if (loginDropdown) {
            loginDropdown.style.display = isAuthed ? "none" : "";
          }
        },
        () => {
          // On error, prefer showing login dropdown
          if (dashboardLink) dashboardLink.style.display = "none";
          if (loginDropdown) loginDropdown.style.display = "";
        },
      );
    } catch (e) {
      // If auth utils fail to load, do nothing; nav remains static
    }
  }

  // Enhanced initialization with error handling and retry mechanism
  function initNavigation() {
    if (navigationInitialized) {
      return;
    }

    try {
      // Mobile menu toggle with enhanced error handling
      const mobileMenuButton = document.getElementById("mobile-menu-button");

      // Initialize auth-aware nav once DOM is available
      initAuthNavigation();
      if (mobileMenuButton) {
        // Remove any existing listeners to prevent duplicates
        mobileMenuButton.replaceWith(mobileMenuButton.cloneNode(true));
        const newMobileMenuButton =
          document.getElementById("mobile-menu-button");

        newMobileMenuButton.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();

          const mobileMenu = document.getElementById("mobile-menu");
          if (mobileMenu) {
            mobileMenu.classList.toggle("hidden");
            const isHidden = mobileMenu.classList.contains("hidden");

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
              const wasHidden = content.classList.contains("hidden");

              // Close other accordions (optional - remove if you want multiple open)
              document
                .querySelectorAll(".mobile-accordion-content")
                .forEach((otherContent) => {
                  if (otherContent !== content) {
                    otherContent.classList.add("hidden");
                  }
                });

              content.classList.toggle("hidden");

              // Update aria attributes
              newButton.setAttribute("aria-expanded", wasHidden);
              content.setAttribute("aria-hidden", !wasHidden);
            }
          });

          // Add keyboard support
          newButton.addEventListener("keydown", (event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              newButton.click();
            }
          });
        });

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
              menu.classList.add("hidden");
              menu.setAttribute("aria-hidden", "true");
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
            dropdownMenu.classList.remove("hidden");
            dropdownMenu.setAttribute("aria-hidden", "false");
            newButton.setAttribute("aria-expanded", "true");

            // Focus first menu item for accessibility
            const firstMenuItem = dropdownMenu.querySelector("a");
            if (firstMenuItem) {
              setTimeout(() => firstMenuItem.focus(), 100);
            }
          } else {
            dropdownMenu.classList.add("hidden");
            dropdownMenu.setAttribute("aria-hidden", "true");
            newButton.setAttribute("aria-expanded", "false");
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

        // Add hover support for desktop (but not on touch devices)
        if (window.matchMedia && !window.matchMedia("(hover: none)").matches) {
          const dropdown = newButton.closest(".dropdown");

          // Handle mouse enter on the entire dropdown container
          dropdown.addEventListener("mouseenter", () => {
            const dropdownMenu = newButton.nextElementSibling;
            if (dropdownMenu) {
              // Close other dropdowns
              document.querySelectorAll(".dropdown-menu").forEach((menu) => {
                if (menu !== dropdownMenu) {
                  menu.classList.add("hidden");
                }
              });

              // Show current dropdown after a short delay
              clearTimeout(dropdown.hoverTimeout);
              dropdown.hoverTimeout = setTimeout(() => {
                if (!dropdownMenu.classList.contains("hidden")) return;
                dropdownMenu.classList.remove("hidden");
                dropdownMenu.setAttribute("aria-hidden", "false");
                newButton.setAttribute("aria-expanded", "true");
              }, 150);
            }
          });

          // Handle mouse leave on the entire dropdown container
          dropdown.addEventListener("mouseleave", () => {
            clearTimeout(dropdown.hoverTimeout);
            const dropdownMenu = newButton.nextElementSibling;
            if (dropdownMenu) {
              // Longer timeout to allow users to move mouse to menu items
              dropdown.hoverTimeout = setTimeout(() => {
                dropdownMenu.classList.add("hidden");
                dropdownMenu.setAttribute("aria-hidden", "true");
                newButton.setAttribute("aria-expanded", "false");
              }, 500);
            }
          });
        }
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

        // Close all dropdowns
        document.querySelectorAll(".dropdown-menu").forEach((menu) => {
          menu.classList.add("hidden");
          menu.setAttribute("aria-hidden", "true");
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
              menu.classList.add("hidden");
              menu.setAttribute("aria-hidden", "true");
              const toggle = menu.previousElementSibling;
              if (toggle) {
                toggle.setAttribute("aria-expanded", "false");
                toggle.focus();
              }
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
