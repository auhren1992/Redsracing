// Mobile-friendly hotspot interaction system
(function() {
  'use strict';

  class HotspotManager {
    constructor() {
      this.activeHotspot = null;
      this.isMobile = window.innerWidth <= 768;
      this.backdrop = null;
      this.init();
    }

    init() {
      // Wait for DOM to be ready
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => this.initializeHotspots());
      } else {
        this.initializeHotspots();
      }

      // Update mobile state on resize
      window.addEventListener('resize', () => {
        this.isMobile = window.innerWidth <= 768;
      });
    }

    initializeHotspots() {
      // Get all hotspots and backdrop
      const hotspots = document.querySelectorAll('.hotspot-3d');
      this.backdrop = document.getElementById('hotspot-backdrop');

      if (!hotspots.length) {
        console.log('No hotspots found');
        return;
      }

      console.log(`🎯 Initializing ${hotspots.length} hotspots for mobile interaction`);

      // Setup hotspot interactions
      hotspots.forEach((hotspot, index) => {
        this.setupHotspot(hotspot, index);
      });

      // Setup backdrop click handler
      if (this.backdrop) {
        this.backdrop.addEventListener('click', () => this.closeActiveHotspot());
      }

      // Setup escape key handler
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          this.closeActiveHotspot();
        }
      });

      console.log('✅ Hotspot system initialized');
    }

    setupHotspot(hotspot, index) {
      const info = hotspot.querySelector('.hotspot-info-3d');
      const closeBtn = hotspot.querySelector('.hotspot-close');
      
      if (!info) {
        console.warn(`Hotspot ${index} missing info panel`);
        return;
      }

      // Add touch/click handlers
      hotspot.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleHotspot(hotspot);
      });

      // Prevent info panel clicks from closing
      info.addEventListener('click', (e) => {
        e.stopPropagation();
      });

      // Setup close button
      if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.closeActiveHotspot();
        });
      }

      // Add touch feedback for mobile
      if ('ontouchstart' in window) {
        hotspot.addEventListener('touchstart', () => {
          hotspot.style.transform = 'scale(0.95)';
        }, { passive: true });

        hotspot.addEventListener('touchend', () => {
          setTimeout(() => {
            hotspot.style.transform = '';
          }, 150);
        }, { passive: true });
      }

      // Enhanced hover effects for desktop
      if (!('ontouchstart' in window)) {
        hotspot.addEventListener('mouseenter', () => {
          this.showHotspotPreview(hotspot);
        });

        hotspot.addEventListener('mouseleave', () => {
          this.hideHotspotPreview(hotspot);
        });
      }
    }

    toggleHotspot(hotspot) {
      if (this.activeHotspot === hotspot) {
        this.closeActiveHotspot();
      } else {
        this.openHotspot(hotspot);
      }
    }

    openHotspot(hotspot) {
      // Close any active hotspot first
      this.closeActiveHotspot();

      this.activeHotspot = hotspot;
      hotspot.classList.add('active');

      // Show backdrop on mobile
      if (this.isMobile && this.backdrop) {
        this.backdrop.classList.add('active');
        // Prevent body scrolling on mobile when hotspot is open
        document.body.style.overflow = 'hidden';
      }

      // Add enhanced visual feedback
      this.addVisualFeedback(hotspot);

      // Track interaction for analytics (if needed)
      const hotspotId = hotspot.getAttribute('data-hotspot') || 'unknown';
      console.log(`🎯 Hotspot opened: ${hotspotId}`);
    }

    closeActiveHotspot() {
      if (!this.activeHotspot) return;

      this.activeHotspot.classList.remove('active');
      this.removeVisualFeedback(this.activeHotspot);

      // Hide backdrop
      if (this.backdrop) {
        this.backdrop.classList.remove('active');
        document.body.style.overflow = ''; // Restore scrolling
      }

      const hotspotId = this.activeHotspot.getAttribute('data-hotspot') || 'unknown';
      console.log(`🎯 Hotspot closed: ${hotspotId}`);

      this.activeHotspot = null;
    }

    showHotspotPreview(hotspot) {
      if (this.isMobile) return; // Preview only on desktop
      
      hotspot.style.transform = 'scale(1.1)';
      hotspot.style.zIndex = '15';
    }

    hideHotspotPreview(hotspot) {
      if (this.isMobile || hotspot === this.activeHotspot) return;
      
      hotspot.style.transform = '';
      hotspot.style.zIndex = '';
    }

    addVisualFeedback(hotspot) {
      // Add pulsing effect to active hotspot
      hotspot.style.animationPlayState = 'paused';
      hotspot.style.boxShadow = '0 0 0 4px rgba(251, 191, 36, 0.3), 0 0 20px rgba(251, 191, 36, 0.5)';
      
      // Add entrance animation to info panel on mobile
      if (this.isMobile) {
        const info = hotspot.querySelector('.hotspot-info-3d');
        if (info) {
          info.style.transform = 'translate(-50%, -50%) scale(0.8)';
          info.style.transition = 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)';
          
          // Trigger animation
          setTimeout(() => {
            info.style.transform = 'translate(-50%, -50%) scale(1)';
          }, 10);
        }
      }
    }

    removeVisualFeedback(hotspot) {
      hotspot.style.animationPlayState = '';
      hotspot.style.boxShadow = '';
      hotspot.style.transform = '';
      hotspot.style.zIndex = '';

      const info = hotspot.querySelector('.hotspot-info-3d');
      if (info) {
        info.style.transform = '';
        info.style.transition = '';
      }
    }
  }

  // Initialize when page loads
  const hotspotManager = new HotspotManager();

  // Make available globally for debugging
  window.HotspotManager = hotspotManager;

  console.log('🎯 Hotspot Mobile System Loaded');
})();