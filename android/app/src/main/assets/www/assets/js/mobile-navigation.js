// Comprehensive Mobile Navigation & Dropdown Handler
// Handles all navigation interactions for the RedsRacing mobile app

document.addEventListener('DOMContentLoaded', function() {
    console.log('Mobile Navigation: Initializing...');
    
    // Mobile Menu Toggle
    const mobileMenuButton = document.getElementById('mobile-menu-button');
    const mobileMenu = document.getElementById('mobile-menu');
    let mobileMenuOpen = false;

    if (mobileMenuButton && mobileMenu) {
        console.log('Mobile Navigation: Menu button and menu found');
        
        mobileMenuButton.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('Mobile Navigation: Menu button clicked');
            
            mobileMenuOpen = !mobileMenuOpen;
            
            if (mobileMenuOpen) {
                mobileMenu.classList.remove('hidden');
                mobileMenuButton.querySelector('svg').innerHTML = `
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                `;
                document.body.style.overflow = 'hidden'; // Prevent scroll
                console.log('Mobile Navigation: Menu opened');
            } else {
                mobileMenu.classList.add('hidden');
                mobileMenuButton.querySelector('svg').innerHTML = `
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16m-7 6h7"></path>
                `;
                document.body.style.overflow = ''; // Restore scroll
                console.log('Mobile Navigation: Menu closed');
            }
        });

        // Close mobile menu when clicking outside
        document.addEventListener('click', function(e) {
            if (mobileMenuOpen && !mobileMenu.contains(e.target) && !mobileMenuButton.contains(e.target)) {
                mobileMenuOpen = false;
                mobileMenu.classList.add('hidden');
                mobileMenuButton.querySelector('svg').innerHTML = `
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16m-7 6h7"></path>
                `;
                document.body.style.overflow = '';
                console.log('Mobile Navigation: Menu closed (outside click)');
            }
        });

        // Close mobile menu on window resize to desktop
        window.addEventListener('resize', function() {
            if (window.innerWidth >= 768 && mobileMenuOpen) {
                mobileMenuOpen = false;
                mobileMenu.classList.add('hidden');
                document.body.style.overflow = '';
                console.log('Mobile Navigation: Menu closed (resize to desktop)');
            }
        });
    } else {
        console.warn('Mobile Navigation: Menu button or menu not found');
    }

    // Mobile Accordion Functionality
    const mobileAccordions = document.querySelectorAll('.mobile-accordion');
    console.log(`Mobile Navigation: Found ${mobileAccordions.length} mobile accordions`);
    
    mobileAccordions.forEach((accordion, index) => {
        const content = accordion.nextElementSibling;
        if (content && content.classList.contains('mobile-accordion-content')) {
            console.log(`Mobile Navigation: Setting up accordion ${index + 1}`);
            
            accordion.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                console.log(`Mobile Navigation: Accordion ${index + 1} clicked`);
                
                const isActive = accordion.classList.contains('active');
                
                // Close all other accordions
                mobileAccordions.forEach(otherAccordion => {
                    if (otherAccordion !== accordion) {
                        otherAccordion.classList.remove('active');
                        const otherContent = otherAccordion.nextElementSibling;
                        if (otherContent) {
                            otherContent.style.maxHeight = '0';
                        }
                    }
                });
                
                // Toggle current accordion
                if (isActive) {
                    accordion.classList.remove('active');
                    content.style.maxHeight = '0';
                    console.log(`Mobile Navigation: Accordion ${index + 1} closed`);
                } else {
                    accordion.classList.add('active');
                    content.style.maxHeight = content.scrollHeight + 'px';
                    console.log(`Mobile Navigation: Accordion ${index + 1} opened`);
                }
            });
        }
    });

    // Desktop Dropdown Functionality
    const desktopDropdowns = document.querySelectorAll('.dropdown');
    console.log(`Mobile Navigation: Found ${desktopDropdowns.length} desktop dropdowns`);
    
    desktopDropdowns.forEach((dropdown, index) => {
        const toggle = dropdown.querySelector('.dropdown-toggle');
        const menu = dropdown.querySelector('.dropdown-menu');
        
        if (toggle && menu) {
            console.log(`Mobile Navigation: Setting up desktop dropdown ${index + 1}`);
            
            // Click toggle
            toggle.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                console.log(`Mobile Navigation: Desktop dropdown ${index + 1} clicked`);
                
                const isOpen = !menu.classList.contains('hidden');
                
                // Close all other dropdowns
                desktopDropdowns.forEach(otherDropdown => {
                    if (otherDropdown !== dropdown) {
                        const otherMenu = otherDropdown.querySelector('.dropdown-menu');
                        if (otherMenu) {
                            otherMenu.classList.add('hidden');
                        }
                    }
                });
                
                // Toggle current dropdown
                if (isOpen) {
                    menu.classList.add('hidden');
                    console.log(`Mobile Navigation: Desktop dropdown ${index + 1} closed`);
                } else {
                    menu.classList.remove('hidden');
                    console.log(`Mobile Navigation: Desktop dropdown ${index + 1} opened`);
                }
            });

            // Hover effects for desktop
            if (window.innerWidth >= 768) {
                dropdown.addEventListener('mouseenter', function() {
                    menu.classList.remove('hidden');
                });
                
                dropdown.addEventListener('mouseleave', function() {
                    menu.classList.add('hidden');
                });
            }
        }
    });

    // Close dropdowns when clicking outside
    document.addEventListener('click', function(e) {
        desktopDropdowns.forEach(dropdown => {
            const menu = dropdown.querySelector('.dropdown-menu');
            if (menu && !dropdown.contains(e.target)) {
                menu.classList.add('hidden');
            }
        });
    });

    // Admin Profile Dropdown (Enhanced)
    const userProfile = document.getElementById('user-profile');
    const mobileUserProfile = document.getElementById('mobile-user-profile');
    
    if (userProfile) {
        const profileToggle = userProfile.querySelector('.dropdown-toggle');
        const profileMenu = userProfile.querySelector('.dropdown-menu');
        
        if (profileToggle && profileMenu) {
            console.log('Mobile Navigation: Setting up admin profile dropdown');
            
            profileToggle.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                console.log('Mobile Navigation: Admin profile dropdown clicked');
                
                const isOpen = !profileMenu.classList.contains('hidden');
                
                if (isOpen) {
                    profileMenu.classList.add('hidden');
                    console.log('Mobile Navigation: Admin profile dropdown closed');
                } else {
                    profileMenu.classList.remove('hidden');
                    console.log('Mobile Navigation: Admin profile dropdown opened');
                }
            });
        }
    }

    // Handle logout buttons
    const logoutButtons = ['#user-logout', '#mobile-user-logout'];
    logoutButtons.forEach(selector => {
        const button = document.querySelector(selector);
        if (button) {
            console.log(`Mobile Navigation: Setting up logout button: ${selector}`);
            button.addEventListener('click', function(e) {
                e.preventDefault();
                console.log('Mobile Navigation: Logout button clicked');
                
                // Add logout functionality here
                if (confirm('Are you sure you want to sign out?')) {
                    // Perform logout
                    localStorage.removeItem('authToken');
                    sessionStorage.removeItem('authToken');
                    
                    // Redirect to login
                    window.location.href = 'admin-console.html';
                }
            });
        }
    });

    // Smooth scroll for internal links
    const internalLinks = document.querySelectorAll('a[href^="#"]');
    internalLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;
            
            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                e.preventDefault();
                
                // Close mobile menu if open
                if (mobileMenuOpen) {
                    mobileMenuOpen = false;
                    mobileMenu.classList.add('hidden');
                    document.body.style.overflow = '';
                }
                
                targetElement.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

    // Header scroll effect
    let lastScrollTop = 0;
    const header = document.querySelector('header');
    
    if (header) {
        window.addEventListener('scroll', function() {
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            
            if (scrollTop > 50) {
                header.classList.add('scrolled');
            } else {
                header.classList.remove('scrolled');
            }
            
            lastScrollTop = scrollTop;
        });
    }

    // Initialize auth state checking
    function checkAuthState() {
        const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
        const loginBtn = document.getElementById('login-btn');
        const mobileLoginBtn = document.getElementById('mobile-login-btn');
        
        if (token) {
            // Show user profile, hide login button
            if (userProfile) userProfile.classList.remove('hidden');
            if (mobileUserProfile) mobileUserProfile.classList.remove('hidden');
            if (loginBtn) loginBtn.style.display = 'none';
            if (mobileLoginBtn) mobileLoginBtn.style.display = 'none';
            
            console.log('Mobile Navigation: User authenticated');
        } else {
            // Show login button, hide user profile
            if (userProfile) userProfile.classList.add('hidden');
            if (mobileUserProfile) mobileUserProfile.classList.add('hidden');
            if (loginBtn) loginBtn.style.display = 'flex';
            if (mobileLoginBtn) mobileLoginBtn.style.display = 'block';
            
            console.log('Mobile Navigation: User not authenticated');
        }
    }

    // Check auth state on load
    checkAuthState();

    // Listen for storage changes (login/logout in other tabs)
    window.addEventListener('storage', checkAuthState);

    console.log('Mobile Navigation: Initialization complete');
});

// Export for potential use by other scripts
window.MobileNavigation = {
    init: function() {
        console.log('Mobile Navigation: Manual initialization called');
    },
    
    closeAllDropdowns: function() {
        document.querySelectorAll('.dropdown-menu').forEach(menu => {
            menu.classList.add('hidden');
        });
        console.log('Mobile Navigation: All dropdowns closed');
    },
    
    closeMobileMenu: function() {
        const mobileMenu = document.getElementById('mobile-menu');
        if (mobileMenu) {
            mobileMenu.classList.add('hidden');
            document.body.style.overflow = '';
        }
        console.log('Mobile Navigation: Mobile menu closed');
    }
};