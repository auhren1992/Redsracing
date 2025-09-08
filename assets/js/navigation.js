// Enhanced Navigation functionality - independent of Firebase and ES6 modules
(function() {
    'use strict';

    let navigationInitialized = false;
    let retryCount = 0;
    const maxRetries = 3;

    // Enhanced initialization with error handling and retry mechanism
    function initNavigation() {
        if (navigationInitialized) {
            console.log('Navigation already initialized');
            return;
        }

        try {
            console.log('Initializing navigation... (attempt', retryCount + 1, '/', maxRetries + 1, ')');

            // Mobile menu toggle with enhanced error handling
            const mobileMenuButton = document.getElementById('mobile-menu-button');
            if (mobileMenuButton) {
                // Remove any existing listeners to prevent duplicates
                mobileMenuButton.replaceWith(mobileMenuButton.cloneNode(true));
                const newMobileMenuButton = document.getElementById('mobile-menu-button');
                
                newMobileMenuButton.addEventListener('click', (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    
                    const mobileMenu = document.getElementById('mobile-menu');
                    if (mobileMenu) {
                        mobileMenu.classList.toggle('hidden');
                        const isHidden = mobileMenu.classList.contains('hidden');
                        console.log('Mobile menu toggled, hidden:', isHidden);
                        
                        // Update aria attributes for accessibility
                        newMobileMenuButton.setAttribute('aria-expanded', !isHidden);
                        mobileMenu.setAttribute('aria-hidden', isHidden);
                    }
                });
                
                // Add keyboard support
                newMobileMenuButton.addEventListener('keydown', (event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        newMobileMenuButton.click();
                    }
                });
                
                console.log('Mobile menu button listener added');
            }

            // Mobile menu accordion with enhanced functionality
            document.querySelectorAll('.mobile-accordion').forEach((button, index) => {
                // Remove existing listeners
                const newButton = button.cloneNode(true);
                button.parentNode.replaceChild(newButton, button);
                
                newButton.addEventListener('click', (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    
                    const content = newButton.nextElementSibling;
                    if (content && content.classList.contains('mobile-accordion-content')) {
                        const wasHidden = content.classList.contains('hidden');
                        
                        // Close other accordions (optional - remove if you want multiple open)
                        document.querySelectorAll('.mobile-accordion-content').forEach(otherContent => {
                            if (otherContent !== content) {
                                otherContent.classList.add('hidden');
                            }
                        });
                        
                        content.classList.toggle('hidden');
                        
                        // Update aria attributes
                        newButton.setAttribute('aria-expanded', wasHidden);
                        content.setAttribute('aria-hidden', !wasHidden);
                        
                        console.log('Mobile accordion toggled:', newButton.textContent?.trim());
                    }
                });
                
                // Add keyboard support
                newButton.addEventListener('keydown', (event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        newButton.click();
                    }
                });
            });
            console.log('Mobile accordion listeners added:', document.querySelectorAll('.mobile-accordion').length);

            // Enhanced desktop dropdowns
            document.querySelectorAll('.dropdown-toggle').forEach((button, index) => {
                // Remove existing listeners
                const newButton = button.cloneNode(true);
                button.parentNode.replaceChild(newButton, button);
                
                newButton.addEventListener('click', (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    
                    const dropdownMenu = newButton.nextElementSibling;
                    if (!dropdownMenu || !dropdownMenu.classList.contains('dropdown-menu')) {
                        console.warn('Dropdown menu not found for button:', newButton.textContent?.trim());
                        return;
                    }
                    
                    const isCurrentlyHidden = dropdownMenu.classList.contains('hidden');

                    // Close all other dropdowns first
                    document.querySelectorAll('.dropdown-menu').forEach(menu => {
                        if (menu !== dropdownMenu) {
                            menu.classList.add('hidden');
                            menu.setAttribute('aria-hidden', 'true');
                        }
                    });
                    
                    // Update all other dropdown toggles
                    document.querySelectorAll('.dropdown-toggle').forEach(otherButton => {
                        if (otherButton !== newButton) {
                            otherButton.setAttribute('aria-expanded', 'false');
                        }
                    });

                    // Toggle the current dropdown
                    if (isCurrentlyHidden) {
                        dropdownMenu.classList.remove('hidden');
                        dropdownMenu.setAttribute('aria-hidden', 'false');
                        newButton.setAttribute('aria-expanded', 'true');
                        console.log('Dropdown opened:', newButton.textContent?.trim());
                        
                        // Focus first menu item for accessibility
                        const firstMenuItem = dropdownMenu.querySelector('a');
                        if (firstMenuItem) {
                            setTimeout(() => firstMenuItem.focus(), 100);
                        }
                    } else {
                        dropdownMenu.classList.add('hidden');
                        dropdownMenu.setAttribute('aria-hidden', 'true');
                        newButton.setAttribute('aria-expanded', 'false');
                        console.log('Dropdown closed:', newButton.textContent?.trim());
                    }
                });
                
                // Add keyboard support for dropdown toggles
                newButton.addEventListener('keydown', (event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        newButton.click();
                    } else if (event.key === 'Escape') {
                        // Close dropdown on Escape
                        const dropdownMenu = newButton.nextElementSibling;
                        if (dropdownMenu) {
                            dropdownMenu.classList.add('hidden');
                            dropdownMenu.setAttribute('aria-hidden', 'true');
                            newButton.setAttribute('aria-expanded', 'false');
                            newButton.focus();
                        }
                    }
                });

                // Add hover support for desktop (but not on touch devices)
                if (window.matchMedia && !window.matchMedia('(hover: none)').matches) {
                    newButton.addEventListener('mouseenter', () => {
                        const dropdownMenu = newButton.nextElementSibling;
                        if (dropdownMenu) {
                            // Close other dropdowns
                            document.querySelectorAll('.dropdown-menu').forEach(menu => {
                                if (menu !== dropdownMenu) {
                                    menu.classList.add('hidden');
                                }
                            });
                            
                            // Show current dropdown after a short delay
                            clearTimeout(newButton.hoverTimeout);
                            newButton.hoverTimeout = setTimeout(() => {
                                if (!dropdownMenu.classList.contains('hidden')) return;
                                dropdownMenu.classList.remove('hidden');
                                dropdownMenu.setAttribute('aria-hidden', 'false');
                                newButton.setAttribute('aria-expanded', 'true');
                            }, 150);
                        }
                    });

                    newButton.addEventListener('mouseleave', () => {
                        clearTimeout(newButton.hoverTimeout);
                        const dropdownMenu = newButton.nextElementSibling;
                        if (dropdownMenu) {
                            newButton.hoverTimeout = setTimeout(() => {
                                dropdownMenu.classList.add('hidden');
                                dropdownMenu.setAttribute('aria-hidden', 'true');
                                newButton.setAttribute('aria-expanded', 'false');
                            }, 300);
                        }
                    });
                }
            });
            console.log('Desktop dropdown listeners added:', document.querySelectorAll('.dropdown-toggle').length);

            // Enhanced outside click handling
            const handleOutsideClick = (event) => {
                // Don't close if clicking on a dropdown toggle or menu
                if (event.target.closest('.dropdown-toggle') || event.target.closest('.dropdown-menu')) {
                    return;
                }
                
                // Close all dropdowns
                document.querySelectorAll('.dropdown-menu').forEach(menu => {
                    menu.classList.add('hidden');
                    menu.setAttribute('aria-hidden', 'true');
                });
                
                // Update all toggle buttons
                document.querySelectorAll('.dropdown-toggle').forEach(button => {
                    button.setAttribute('aria-expanded', 'false');
                });
            };

            // Remove existing listener and add new one
            document.removeEventListener('click', window.navigationOutsideClickHandler);
            document.addEventListener('click', handleOutsideClick);
            window.navigationOutsideClickHandler = handleOutsideClick;
            console.log('Outside click listener added');

            // Enhanced keyboard navigation for dropdown menus
            document.querySelectorAll('.dropdown-menu').forEach(menu => {
                menu.addEventListener('keydown', (event) => {
                    const menuItems = Array.from(menu.querySelectorAll('a'));
                    const currentIndex = menuItems.indexOf(event.target);
                    
                    switch (event.key) {
                        case 'ArrowDown':
                            event.preventDefault();
                            const nextIndex = (currentIndex + 1) % menuItems.length;
                            menuItems[nextIndex]?.focus();
                            break;
                        case 'ArrowUp':
                            event.preventDefault();
                            const prevIndex = currentIndex === 0 ? menuItems.length - 1 : currentIndex - 1;
                            menuItems[prevIndex]?.focus();
                            break;
                        case 'Escape':
                            event.preventDefault();
                            menu.classList.add('hidden');
                            menu.setAttribute('aria-hidden', 'true');
                            const toggle = menu.previousElementSibling;
                            if (toggle) {
                                toggle.setAttribute('aria-expanded', 'false');
                                toggle.focus();
                            }
                            break;
                    }
                });
            });

            // Set current year in footer with error handling
            const yearEl = document.getElementById('year');
            if (yearEl) {
                try {
                    yearEl.textContent = new Date().getFullYear().toString();
                    console.log('Year set in footer');
                } catch (error) {
                    console.warn('Failed to set year in footer:', error);
                    yearEl.textContent = '2025'; // Fallback year
                }
            }

            // Initialize ARIA attributes
            document.querySelectorAll('.dropdown-toggle').forEach(toggle => {
                toggle.setAttribute('aria-expanded', 'false');
                toggle.setAttribute('aria-haspopup', 'true');
            });

            document.querySelectorAll('.dropdown-menu').forEach(menu => {
                menu.setAttribute('aria-hidden', 'true');
                menu.setAttribute('role', 'menu');
            });

            document.querySelectorAll('.mobile-accordion').forEach(accordion => {
                accordion.setAttribute('aria-expanded', 'false');
            });

            document.querySelectorAll('.mobile-accordion-content').forEach(content => {
                content.setAttribute('aria-hidden', 'true');
            });

            navigationInitialized = true;
            console.log('Navigation initialization completed successfully');

        } catch (error) {
            console.error('Navigation initialization failed:', error);
            retryCount++;
            
            if (retryCount <= maxRetries) {
                console.log('Retrying navigation initialization in 1 second...');
                setTimeout(initNavigation, 1000);
            } else {
                console.error('Navigation initialization failed after', maxRetries + 1, 'attempts');
                // Try basic fallback initialization
                initBasicNavigation();
            }
        }
    }

    // Basic fallback navigation for when main initialization fails
    function initBasicNavigation() {
        console.log('Attempting basic navigation fallback...');
        
        try {
            // Basic mobile menu toggle
            const mobileButton = document.getElementById('mobile-menu-button');
            const mobileMenu = document.getElementById('mobile-menu');
            
            if (mobileButton && mobileMenu) {
                mobileButton.onclick = () => mobileMenu.classList.toggle('hidden');
            }

            // Basic dropdown functionality
            document.querySelectorAll('.dropdown-toggle').forEach(button => {
                button.onclick = (event) => {
                    event.stopPropagation();
                    const menu = button.nextElementSibling;
                    if (menu) {
                        document.querySelectorAll('.dropdown-menu').forEach(m => m.classList.add('hidden'));
                        menu.classList.remove('hidden');
                    }
                };
            });

            // Basic outside click
            document.onclick = () => {
                document.querySelectorAll('.dropdown-menu').forEach(menu => menu.classList.add('hidden'));
            };

            console.log('Basic navigation fallback initialized');
        } catch (error) {
            console.error('Even basic navigation fallback failed:', error);
        }
    }

    // Initialize navigation when DOM is ready with multiple fallback attempts
    function attemptInitialization() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initNavigation);
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
    if (typeof document.visibilityState !== 'undefined') {
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && !navigationInitialized) {
                console.log('Page became visible, checking navigation...');
                setTimeout(initNavigation, 500);
            }
        });
    }

})();