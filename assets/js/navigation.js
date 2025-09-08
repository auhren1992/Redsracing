// Navigation functionality - independent of Firebase and ES6 modules
(function() {
    'use strict';

    // Initialize navigation functionality immediately
    function initNavigation() {
        console.log('Initializing navigation...');

        // Mobile menu toggle
        const mobileMenuButton = document.getElementById('mobile-menu-button');
        if(mobileMenuButton) {
            mobileMenuButton.addEventListener('click', () => {
                const mobileMenu = document.getElementById('mobile-menu');
                if (mobileMenu) {
                    mobileMenu.classList.toggle('hidden');
                    console.log('Mobile menu toggled, hidden:', mobileMenu.classList.contains('hidden'));
                }
            });
            console.log('Mobile menu button listener added');
        }

        // Mobile menu accordion
        document.querySelectorAll('.mobile-accordion').forEach(button => {
            button.addEventListener('click', () => {
                const content = button.nextElementSibling;
                if (content) {
                    content.classList.toggle('hidden');
                    console.log('Mobile accordion toggled');
                }
            });
        });
        console.log('Mobile accordion listeners added:', document.querySelectorAll('.mobile-accordion').length);

        // Desktop dropdowns
        document.querySelectorAll('.dropdown-toggle').forEach(button => {
            button.addEventListener('click', (event) => {
                event.stopPropagation();
                const dropdownMenu = button.nextElementSibling;
                if (!dropdownMenu) return;
                
                const isHidden = dropdownMenu.classList.contains('hidden');

                // Close all other dropdowns
                document.querySelectorAll('.dropdown-menu').forEach(menu => {
                    menu.classList.add('hidden');
                });

                // Toggle the current dropdown
                if (isHidden) {
                    dropdownMenu.classList.remove('hidden');
                    console.log('Dropdown opened');
                } else {
                    console.log('Dropdown closed');
                }
            });
        });
        console.log('Desktop dropdown listeners added:', document.querySelectorAll('.dropdown-toggle').length);

        // Close dropdowns when clicking outside
        window.addEventListener('click', () => {
            document.querySelectorAll('.dropdown-menu').forEach(menu => {
                menu.classList.add('hidden');
            });
        });
        console.log('Outside click listener added');

        // Set current year in footer
        const yearEl = document.getElementById('year');
        if (yearEl) {
            yearEl.textContent = new Date().getFullYear();
            console.log('Year set in footer');
        }
    }

    // Initialize navigation when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initNavigation);
    } else {
        initNavigation();
    }

    // Make initNavigation available globally for debugging
    window.initNavigation = initNavigation;
})();