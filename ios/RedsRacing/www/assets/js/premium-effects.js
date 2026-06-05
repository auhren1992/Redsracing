/**
 * REDSRACING PREMIUM EFFECTS
 * Interactive features for enhanced UX
 */

// ============================================
// LAZY LOADING WITH BLUR-UP EFFECT
// ============================================
const lazyLoadImages = () => {
  const images = document.querySelectorAll('.lazy-image');
  
  const imageObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        
        // Load the image
        if (img.dataset.src) {
          img.src = img.dataset.src;
        }
        
        // Remove blur when loaded
        img.addEventListener('load', () => {
          img.classList.add('loaded');
          const placeholder = img.parentElement.querySelector('.lazy-placeholder');
          if (placeholder) {
            placeholder.style.opacity = '0';
            setTimeout(() => placeholder.remove(), 500);
          }
        });
        
        observer.unobserve(img);
      }
    });
  }, {
    rootMargin: '50px' // Start loading 50px before entering viewport
  });
  
  images.forEach(img => imageObserver.observe(img));
};

// ============================================
// DARK MODE TOGGLE
// ============================================
const initDarkModeToggle = () => {
  const toggle = document.getElementById('darkModeToggle');
  if (!toggle) return;
  
  // Check for saved preference
  const savedMode = localStorage.getItem('darkMode');
  if (savedMode === 'light') {
    document.body.classList.add('light-mode');
    toggle.classList.add('active');
  }
  
  toggle.addEventListener('click', () => {
    document.body.classList.toggle('light-mode');
    toggle.classList.toggle('active');
    
    // Save preference
    const isLightMode = document.body.classList.contains('light-mode');
    localStorage.setItem('darkMode', isLightMode ? 'light' : 'dark');
    
    // Add transition class to body for smooth mode switch
    document.body.style.transition = 'all 0.6s ease';
  });
};

// ============================================
// PAGE TRANSITION ON NAVIGATION
// ============================================
const initPageTransitions = () => {
  // Add transition class to main content
  const mainContent = document.querySelector('main');
  if (mainContent) {
    mainContent.classList.add('page-transition');
  }
  
  // Smooth transitions for internal links
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        target.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    });
  });
};

// ============================================
// SKELETON LOADING FOR DYNAMIC CONTENT
// ============================================
const showSkeleton = (container) => {
  const skeleton = `
    <div class="skeleton-card glass-card">
      <div class="skeleton skeleton-title"></div>
      <div class="skeleton skeleton-text"></div>
      <div class="skeleton skeleton-text"></div>
      <div class="skeleton skeleton-text" style="width: 80%;"></div>
      <div class="skeleton skeleton-image" style="margin-top: 1rem;"></div>
    </div>
  `;
  container.innerHTML = skeleton;
};

const hideSkeleton = (container, content) => {
  container.innerHTML = content;
  container.classList.add('fade-in');
};

// ============================================
// RIPPLE EFFECT FOR BUTTONS
// ============================================
const initRippleEffect = () => {
  document.querySelectorAll('.ripple').forEach(button => {
    button.addEventListener('click', function(e) {
      const rect = this.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      const ripple = document.createElement('span');
      ripple.style.cssText = `
        position: absolute;
        width: 0;
        height: 0;
        border-radius: 50%;
        background: rgba(251, 191, 36, 0.5);
        transform: translate(-50%, -50%);
        pointer-events: none;
        animation: rippleEffect 0.6s ease-out;
        left: ${x}px;
        top: ${y}px;
      `;
      
      this.appendChild(ripple);
      setTimeout(() => ripple.remove(), 600);
    });
  });
};

// ============================================
// INTERSECTION OBSERVER FOR SCROLL ANIMATIONS
// ============================================
const initScrollAnimations = () => {
  const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -100px 0px'
  };
  
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('animate-in');
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);
  
  // Observe elements with animation classes
  document.querySelectorAll('.slide-in-left, .slide-in-right, .page-transition-slow').forEach(el => {
    observer.observe(el);
  });
};

// ============================================
// MAGNETIC HOVER EFFECT
// ============================================
const initMagneticHover = () => {
  document.querySelectorAll('.hover-magnetic').forEach(el => {
    el.addEventListener('mousemove', function(e) {
      const rect = this.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      
      this.style.transform = `translate(${x * 0.1}px, ${y * 0.1}px) scale(1.05)`;
    });
    
    el.addEventListener('mouseleave', function() {
      this.style.transform = 'translate(0, 0) scale(1)';
    });
  });
};

// ============================================
// GLASS CARD TILT EFFECT (3D)
// ============================================
const initCardTilt = () => {
  document.querySelectorAll('.hover-3d').forEach(card => {
    card.addEventListener('mousemove', function(e) {
      const rect = this.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      
      const rotateX = (y - centerY) / 10;
      const rotateY = (centerX - x) / 10;
      
      this.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-10px)`;
    });
    
    card.addEventListener('mouseleave', function() {
      this.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) translateY(0)';
    });
  });
};

// ============================================
// PERFORMANCE MONITORING
// ============================================
const logPerformance = () => {
  if (!window.performance) {
    return;
  }

  window.addEventListener("load", () => {
    let pageLoadTime = 0;
    try {
      const navEntry = performance.getEntriesByType?.("navigation")?.[0];
      if (navEntry && typeof navEntry.duration === "number") {
        pageLoadTime = navEntry.duration;
      } else if (performance.timing) {
        const perfData = performance.timing;
        pageLoadTime = perfData.loadEventEnd - perfData.navigationStart;
      } else if (typeof performance.now === "function") {
        pageLoadTime = performance.now();
      }
    } catch (_) {
      if (typeof performance.now === "function") {
        pageLoadTime = performance.now();
      }
    }

    if (!Number.isFinite(pageLoadTime) || pageLoadTime < 0) {
      pageLoadTime = 0;
    }

    console.log(`🏁 Page loaded in ${Math.round(pageLoadTime)}ms`);
  });
};

// ============================================
// PRELOAD CRITICAL IMAGES
// ============================================
const preloadCriticalImages = () => {
  const criticalImages = document.querySelectorAll('[data-preload]');
  criticalImages.forEach(img => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = img.dataset.src || img.src;
    document.head.appendChild(link);
  });
};

// ============================================
// TOUCH FEEDBACK FOR MOBILE
// ============================================
const initTouchFeedback = () => {
  if ('ontouchstart' in window) {
    document.querySelectorAll('.premium-hover, .glass-card, button, a').forEach(el => {
      el.addEventListener('touchstart', function() {
        this.classList.add('touch-feedback');
      });
      
      el.addEventListener('touchend', function() {
        setTimeout(() => this.classList.remove('touch-feedback'), 300);
      });
    });
  }
};

// ============================================
// SMOOTH SCROLL PROGRESS INDICATOR
// ============================================
const initScrollProgress = () => {
  const progressBar = document.getElementById('scrollProgress');
  if (!progressBar) {
    // Create progress bar if it doesn't exist
    const bar = document.createElement('div');
    bar.id = 'scrollProgress';
    bar.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      height: 3px;
      background: linear-gradient(90deg, #dc2626, #fbbf24);
      z-index: 9999;
      transition: width 0.1s ease;
    `;
    document.body.appendChild(bar);
  }
  
  window.addEventListener('scroll', () => {
    const winScroll = document.body.scrollTop || document.documentElement.scrollTop;
    const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    const scrolled = (winScroll / height) * 100;
    document.getElementById('scrollProgress').style.width = scrolled + '%';
  });
};

// ============================================
// INITIALIZE ALL EFFECTS
// ============================================
const initPremiumEffects = () => {
  console.log('🎨 Initializing premium effects...');
  
  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      runAllInitializers();
    });
  } else {
    runAllInitializers();
  }
};

const runAllInitializers = () => {
  lazyLoadImages();
  initDarkModeToggle();
  initPageTransitions();
  initRippleEffect();
  initScrollAnimations();
  initMagneticHover();
  initCardTilt();
  initTouchFeedback();
  initScrollProgress();
  preloadCriticalImages();
  logPerformance();
  
  console.log('✅ Premium effects loaded successfully!');
};

// Auto-initialize
initPremiumEffects();

// Export for manual use if needed
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    lazyLoadImages,
    initDarkModeToggle,
    showSkeleton,
    hideSkeleton
  };
}
