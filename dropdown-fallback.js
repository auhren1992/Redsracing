// Fallback dropdown initialization - Ensures dropdowns work in all cases
(function() {
  'use strict';

  // Simple fallback dropdown functionality
  function initFallbackDropdowns() {
    console.log('🔧 Initializing fallback dropdown functionality...');

    // Hide all dropdowns initially
    document.querySelectorAll('.dropdown-menu, .modern-dropdown').forEach(menu => {
      menu.classList.add('hidden');
      menu.style.display = 'none';
    });

    // Add click handlers to dropdown toggles
    document.querySelectorAll('.dropdown-toggle').forEach(toggle => {
      toggle.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();

        const menu = this.nextElementSibling;
        if (!menu) return;

        // Close all other dropdowns
        document.querySelectorAll('.dropdown-menu, .modern-dropdown').forEach(otherMenu => {
          if (otherMenu !== menu) {
            otherMenu.classList.add('hidden');
            otherMenu.style.display = 'none';
          }
        });

        // Toggle current dropdown
        const isHidden = menu.classList.contains('hidden') || 
                        menu.style.display === 'none' ||
                        getComputedStyle(menu).display === 'none';

        if (isHidden) {
          menu.classList.remove('hidden');
          menu.style.display = 'block';
          menu.style.visibility = 'visible';
          menu.style.opacity = '1';
        } else {
          menu.classList.add('hidden');
          menu.style.display = 'none';
        }
      });
    });

    // Add mobile menu toggle
    const mobileMenuButton = document.getElementById('mobile-menu-button') || 
                             document.getElementById('mobile-menu-toggle');
    const mobileMenu = document.getElementById('mobile-menu');

    if (mobileMenuButton && mobileMenu) {
      mobileMenuButton.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        const isHidden = mobileMenu.classList.contains('hidden');
        if (isHidden) {
          mobileMenu.classList.remove('hidden');
          mobileMenu.style.display = 'block';
        } else {
          mobileMenu.classList.add('hidden');
          mobileMenu.style.display = 'none';
        }
      });
    }

    // Add mobile accordion functionality
    document.querySelectorAll('.mobile-accordion').forEach(accordion => {
      accordion.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();

        const content = this.nextElementSibling;
        if (!content || !content.classList.contains('mobile-accordion-content')) return;

        const isHidden = content.classList.contains('hidden') || 
                        content.style.display === 'none' ||
                        getComputedStyle(content).display === 'none';

        // Close other accordions (optional)
        document.querySelectorAll('.mobile-accordion-content').forEach(otherContent => {
          if (otherContent !== content) {
            otherContent.classList.add('hidden');
            otherContent.style.display = 'none';
          }
        });

        // Toggle current accordion
        if (isHidden) {
          content.classList.remove('hidden');
          content.style.display = 'block';
          this.classList.add('active');
        } else {
          content.classList.add('hidden');
          content.style.display = 'none';
          this.classList.remove('active');
        }

        // Rotate icon if present
        const icon = this.querySelector('.accordion-icon');
        if (icon) {
          icon.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
        }
      });
    });

    // Close dropdowns when clicking outside
    document.addEventListener('click', function(e) {
      if (!e.target.closest('.dropdown') && !e.target.closest('#mobile-menu')) {
        document.querySelectorAll('.dropdown-menu, .modern-dropdown').forEach(menu => {
          menu.classList.add('hidden');
          menu.style.display = 'none';
        });

        // Close mobile menu if clicked outside
        if (mobileMenu && !e.target.closest('#mobile-menu-button') && !e.target.closest('#mobile-menu-toggle')) {
          mobileMenu.classList.add('hidden');
          mobileMenu.style.display = 'none';
        }
      }
    });

    console.log('✅ Fallback dropdown functionality initialized');
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFallbackDropdowns);
  } else {
    initFallbackDropdowns();
  }

  // Also try after a short delay to catch dynamically loaded content
  setTimeout(initFallbackDropdowns, 1000);

})();