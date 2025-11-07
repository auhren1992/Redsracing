// FIXED Mobile Navigation Handler - Direct targeting approach
// Handles all navigation interactions for the RedsRacing mobile app

console.log('🚀 Mobile Navigation Script Loading...');

// Wait for DOM to be ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNavigation);
} else {
    initNavigation();
}

function initNavigation() {
    console.log('📱 Initializing Mobile Navigation...');
    
    // Force show elements for debugging
    setTimeout(() => {
        setupMobileMenu();
        setupMobileAccordions();
        setupAdminDropdown();
        setupDesktopDropdowns();
    }, 100);
}

function setupMobileMenu() {
    console.log('🔧 Setting up Mobile Menu Toggle...');
    
    const mobileMenuButton = document.getElementById('mobile-menu-button');
    const mobileMenu = document.getElementById('mobile-menu');
    
    console.log('Mobile Menu Button:', mobileMenuButton);
    console.log('Mobile Menu:', mobileMenu);
    
    if (!mobileMenuButton || !mobileMenu) {
        console.error('❌ Mobile menu elements not found!');
        return;
    }
    
    let isOpen = false;
    
    mobileMenuButton.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        isOpen = !isOpen;
        console.log('📱 Mobile menu toggle clicked, isOpen:', isOpen);
        
        if (isOpen) {
            mobileMenu.classList.remove('hidden');
            mobileMenu.style.display = 'block';
            console.log('✅ Mobile menu opened');
        } else {
            mobileMenu.classList.add('hidden');
            mobileMenu.style.display = 'none';
            console.log('✅ Mobile menu closed');
        }
    });
    
    // Close on outside click
    document.addEventListener('click', function(e) {
        if (isOpen && !mobileMenu.contains(e.target) && !mobileMenuButton.contains(e.target)) {
            isOpen = false;
            mobileMenu.classList.add('hidden');
            mobileMenu.style.display = 'none';
            console.log('✅ Mobile menu closed (outside click)');
        }
    });
}

function setupMobileAccordions() {
    console.log('🔧 Setting up Mobile Accordions...');
    
    // Get all accordion buttons (both main navigation and admin menu accordions)
    const accordions = document.querySelectorAll('.mobile-accordion');
    console.log('Found accordions:', accordions.length);
    
    accordions.forEach((accordion, index) => {
        console.log(`Setting up accordion ${index + 1}:`, accordion.textContent.trim());
        
        const content = accordion.nextElementSibling;
        console.log('Accordion content:', content);
        
        if (!content || !content.classList.contains('mobile-accordion-content')) {
            console.warn(`❌ No content found for accordion ${index + 1}`);
            return;
        }
        
        // Initially hide content using CSS max-height transition
        content.style.maxHeight = '0';
        content.style.overflow = 'hidden';
        content.style.transition = 'max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
        // Don't set display: none - let CSS handle it with max-height
        
        // Add icon rotation for accordion state
        const icon = accordion.querySelector('.accordion-icon');
        if (icon) {
            icon.style.transition = 'transform 0.3s ease';
        }
        
        accordion.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            const isOpen = accordion.classList.contains('active');
            console.log(`🔄 Accordion ${index + 1} clicked, currently open:`, isOpen);
            
            // For admin accordions, only close other admin accordions in the same container
            const isAdminAccordion = accordion.closest('#mobile-user-profile');
            if (isAdminAccordion) {
                // Close other admin accordions within the same admin profile section
                const adminAccordions = document.querySelectorAll('#mobile-user-profile .mobile-accordion');
                adminAccordions.forEach(otherAccordion => {
                    if (otherAccordion !== accordion) {
                        otherAccordion.classList.remove('active');
                        const otherContent = otherAccordion.nextElementSibling;
                        const otherIcon = otherAccordion.querySelector('.accordion-icon');
                        if (otherContent) {
                            otherContent.style.maxHeight = '0';
                        }
                        if (otherIcon) {
                            otherIcon.style.transform = 'rotate(0deg)';
                        }
                    }
                });
            } else {
                // Close other main navigation accordions
                const mainAccordions = document.querySelectorAll('.mobile-accordion:not(#mobile-user-profile .mobile-accordion)');
                mainAccordions.forEach(otherAccordion => {
                    if (otherAccordion !== accordion) {
                        otherAccordion.classList.remove('active');
                        const otherContent = otherAccordion.nextElementSibling;
                        const otherIcon = otherAccordion.querySelector('.accordion-icon');
                        if (otherContent) {
                            otherContent.style.maxHeight = '0';
                        }
                        if (otherIcon) {
                            otherIcon.style.transform = 'rotate(0deg)';
                        }
                    }
                });
            }
            
            // Toggle current accordion
            if (isOpen) {
                accordion.classList.remove('active');
                content.style.maxHeight = '0';
                if (icon) {
                    icon.style.transform = 'rotate(0deg)';
                }
                console.log(`✅ Accordion ${index + 1} closed`);
            } else {
                accordion.classList.add('active');
                // Use scrollHeight for dynamic height or fixed height for admin items
                const maxHeight = isAdminAccordion ? '200px' : `${content.scrollHeight}px`;
                content.style.maxHeight = maxHeight;
                if (icon) {
                    icon.style.transform = 'rotate(180deg)';
                }
                console.log(`✅ Accordion ${index + 1} opened with max-height: ${maxHeight}`);
            }
        });
    });
}

function setupAdminDropdown() {
    console.log('🔧 Setting up Admin Dropdown...');
    
    // Desktop admin profile dropdown
    const userProfile = document.getElementById('user-profile');
    const loginBtn = document.getElementById('login-btn');
    
    // Mobile admin profile
    const mobileUserProfile = document.getElementById('mobile-user-profile');
    const mobileLoginBtn = document.getElementById('mobile-login-btn');
    
    console.log('User Profile:', userProfile);
    console.log('Login Button:', loginBtn);
    console.log('Mobile User Profile:', mobileUserProfile);
    console.log('Mobile Login Button:', mobileLoginBtn);
    
    // Check if user is authenticated (simulate with localStorage)
    const isAuthenticated = localStorage.getItem('authToken') || 
                          sessionStorage.getItem('authToken') ||
                          window.location.href.includes('admin') ||
                          document.body.classList.contains('admin-mode');
    
    console.log('Is Authenticated:', isAuthenticated);
    
    if (isAuthenticated) {
        // Show admin profile, hide login
        if (userProfile) {
            userProfile.classList.remove('hidden');
            userProfile.style.display = 'block';
        }
        if (loginBtn) {
            loginBtn.style.display = 'none';
        }
        if (mobileUserProfile) {
            mobileUserProfile.classList.remove('hidden');
            mobileUserProfile.style.display = 'block';
        }
        if (mobileLoginBtn) {
            mobileLoginBtn.style.display = 'none';
        }
    } else {
        // Show login, hide admin profile
        if (userProfile) {
            userProfile.classList.add('hidden');
            userProfile.style.display = 'none';
        }
        if (loginBtn) {
            loginBtn.style.display = 'flex';
        }
        if (mobileUserProfile) {
            mobileUserProfile.classList.add('hidden');
            mobileUserProfile.style.display = 'none';
        }
        if (mobileLoginBtn) {
            mobileLoginBtn.style.display = 'block';
        }
    }
    
    // Setup admin profile dropdown functionality
    if (userProfile && isAuthenticated) {
        const profileToggle = userProfile.querySelector('.dropdown-toggle');
        const profileMenu = userProfile.querySelector('.dropdown-menu');
        
        console.log('Profile Toggle:', profileToggle);
        console.log('Profile Menu:', profileMenu);
        
        if (profileToggle && profileMenu) {
            console.log('✅ Setting up admin profile dropdown click handler');
            
            profileToggle.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                const isOpen = !profileMenu.classList.contains('hidden');
                console.log('🔄 Admin dropdown clicked, currently open:', isOpen);
                
                if (isOpen) {
                    profileMenu.classList.add('hidden');
                    profileMenu.style.display = 'none';
                    console.log('✅ Admin dropdown closed');
                } else {
                    profileMenu.classList.remove('hidden');
                    profileMenu.style.display = 'block';
                    console.log('✅ Admin dropdown opened');
                }
            });
            
            // Close on outside click
            document.addEventListener('click', function(e) {
                if (!userProfile.contains(e.target)) {
                    profileMenu.classList.add('hidden');
                    profileMenu.style.display = 'none';
                }
            });
        }
    }
    
    // Setup logout functionality
    const logoutButtons = ['#user-logout', '#mobile-user-logout'];
    logoutButtons.forEach(selector => {
        const button = document.querySelector(selector);
        if (button) {
            console.log(`✅ Setting up logout button: ${selector}`);
            button.addEventListener('click', function(e) {
                e.preventDefault();
                console.log('🚪 Logout clicked');
                
                if (confirm('Are you sure you want to sign out?')) {
                    localStorage.removeItem('authToken');
                    sessionStorage.removeItem('authToken');
                    window.location.href = 'admin-console.html';
                }
            });
        }
    });
}

function setupDesktopDropdowns() {
    console.log('🔧 Setting up Desktop Dropdowns...');
    
    const dropdowns = document.querySelectorAll('.dropdown');
    console.log('Found desktop dropdowns:', dropdowns.length);
    
    dropdowns.forEach((dropdown, index) => {
        const toggle = dropdown.querySelector('.dropdown-toggle');
        const menu = dropdown.querySelector('.dropdown-menu');
        
        if (toggle && menu) {
            console.log(`Setting up desktop dropdown ${index + 1}`);
            
            toggle.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                const isOpen = !menu.classList.contains('hidden');
                
                // Close all other dropdowns
                dropdowns.forEach(otherDropdown => {
                    if (otherDropdown !== dropdown) {
                        const otherMenu = otherDropdown.querySelector('.dropdown-menu');
                        if (otherMenu) {
                            otherMenu.classList.add('hidden');
                            otherMenu.style.display = 'none';
                        }
                    }
                });
                
                // Toggle current dropdown
                if (isOpen) {
                    menu.classList.add('hidden');
                    menu.style.display = 'none';
                } else {
                    menu.classList.remove('hidden');
                    menu.style.display = 'block';
                }
            });
            
            // Hover functionality for desktop
            if (window.innerWidth >= 768) {
                dropdown.addEventListener('mouseenter', function() {
                    menu.classList.remove('hidden');
                    menu.style.display = 'block';
                });
                
                dropdown.addEventListener('mouseleave', function() {
                    menu.classList.add('hidden');
                    menu.style.display = 'none';
                });
            }
        }
    });
    
    // Close dropdowns on outside click
    document.addEventListener('click', function(e) {
        dropdowns.forEach(dropdown => {
            const menu = dropdown.querySelector('.dropdown-menu');
            if (menu && !dropdown.contains(e.target)) {
                menu.classList.add('hidden');
                menu.style.display = 'none';
            }
        });
    });
}

// Force show admin profile if on admin page
if (window.location.href.includes('admin')) {
    localStorage.setItem('authToken', 'admin-mode');
}

// Export for global access
window.MobileNavigation = {
    init: initNavigation,
    showAdminProfile: function() {
        localStorage.setItem('authToken', 'admin-mode');
        setupAdminDropdown();
    },
    hideAdminProfile: function() {
        localStorage.removeItem('authToken');
        setupAdminDropdown();
    }
};

console.log('✅ Mobile Navigation Script Loaded');

// Debug function
window.debugNavigation = function() {
    console.log('🐛 Navigation Debug Info:');
    console.log('Mobile Menu Button:', document.getElementById('mobile-menu-button'));
    console.log('Mobile Menu:', document.getElementById('mobile-menu'));
    console.log('Mobile Accordions:', document.querySelectorAll('.mobile-accordion'));
    console.log('User Profile:', document.getElementById('user-profile'));
    console.log('Auth Token:', localStorage.getItem('authToken'));
};

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