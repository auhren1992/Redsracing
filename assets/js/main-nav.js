// Handles shared navigation logic for mobile menu and dropdowns

document.addEventListener('DOMContentLoaded', () => {
    // Mobile menu toggle
    const mobileMenuButton = document.getElementById('mobile-menu-button');
    if (mobileMenuButton) {
        mobileMenuButton.addEventListener('click', () => {
            document.getElementById('mobile-menu').classList.toggle('hidden');
        });
    }

    // Mobile menu accordion
    document.querySelectorAll('.mobile-accordion').forEach(button => {
        button.addEventListener('click', () => {
            const content = button.nextElementSibling;
            content.classList.toggle('hidden');
        });
    });

    // Desktop dropdowns
    document.querySelectorAll('.dropdown-toggle').forEach(button => {
        button.addEventListener('click', (event) => {
            event.stopPropagation();
            const dropdownMenu = button.nextElementSibling;
            const isHidden = dropdownMenu.classList.contains('hidden');

            // Close all other dropdowns
            document.querySelectorAll('.dropdown-menu').forEach(menu => {
                menu.classList.add('hidden');
            });

            // Toggle the current dropdown
            if (isHidden) {
                dropdownMenu.classList.remove('hidden');
            }
        });
    });

    // Close dropdowns when clicking outside
    window.addEventListener('click', () => {
        document.querySelectorAll('.dropdown-menu').forEach(menu => {
            menu.classList.add('hidden');
        });
    });

    // Set current year in footer
    const yearSpan = document.getElementById('year');
    if(yearSpan) {
        yearSpan.textContent = new Date().getFullYear();
    }
});
