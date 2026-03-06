/**
 * RedsRacing Performance Optimization Utilities
 * Lazy loading, skeleton loaders, and performance enhancements
 */

// Lazy Loading for Images
class LazyLoader {
  constructor(options = {}) {
    this.options = {
      rootMargin: options.rootMargin || '50px',
      threshold: options.threshold || 0.01,
      loadingClass: options.loadingClass || 'lazy-loading',
      loadedClass: options.loadedClass || 'lazy-loaded',
      errorClass: options.errorClass || 'lazy-error'
    };
    
    this.observer = null;
    this.init();
  }
  
  init() {
    if ('IntersectionObserver' in window) {
      this.observer = new IntersectionObserver(
        (entries) => this.handleIntersection(entries),
        {
          rootMargin: this.options.rootMargin,
          threshold: this.options.threshold
        }
      );
      
      this.observeImages();
    } else {
      // Fallback for older browsers
      this.loadAllImages();
    }
  }
  
  observeImages() {
    const images = document.querySelectorAll('img[data-src], img[loading="lazy"]');
    images.forEach(img => {
      if (img.dataset.src || img.loading === 'lazy') {
        this.observer.observe(img);
      }
    });
  }
  
  handleIntersection(entries) {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        this.loadImage(entry.target);
        this.observer.unobserve(entry.target);
      }
    });
  }
  
  loadImage(img) {
    const src = img.dataset.src || img.src;
    
    if (!src) return;
    
    img.classList.add(this.options.loadingClass);
    
    const tempImg = new Image();
    
    tempImg.onload = () => {
      if (img.dataset.src) {
        img.src = src;
      }
      img.classList.remove(this.options.loadingClass);
      img.classList.add(this.options.loadedClass);
      
      // Remove skeleton if present
      const skeleton = img.previousElementSibling;
      if (skeleton && skeleton.classList.contains('skeleton')) {
        skeleton.style.display = 'none';
      }
    };
    
    tempImg.onerror = () => {
      img.classList.remove(this.options.loadingClass);
      img.classList.add(this.options.errorClass);
      console.error('Failed to load image:', src);
    };
    
    tempImg.src = src;
  }
  
  loadAllImages() {
    const images = document.querySelectorAll('img[data-src]');
    images.forEach(img => this.loadImage(img));
  }
}

// Skeleton Loader Generator
function createSkeleton(type = 'text', options = {}) {
  const skeleton = document.createElement('div');
  skeleton.classList.add('skeleton', `skeleton-${type}`);
  
  if (type === 'text') {
    skeleton.style.width = options.width || '100%';
    skeleton.style.height = options.height || '1rem';
  } else if (type === 'image') {
    skeleton.style.width = options.width || '100%';
    skeleton.style.paddingBottom = options.aspectRatio || '56.25%'; // 16:9 default
  } else if (type === 'card') {
    skeleton.innerHTML = `
      <div class="skeleton skeleton-image" style="height: 200px"></div>
      <div class="skeleton skeleton-text" style="margin-top: 1rem; width: 80%"></div>
      <div class="skeleton skeleton-text" style="margin-top: 0.5rem; width: 60%"></div>
    `;
  }
  
  return skeleton;
}

// Page Transition Effects
class PageTransitions {
  constructor() {
    this.transitionDuration = 300;
    this.init();
  }
  
  init() {
    // Add fade-in effect to body on load
    document.body.style.opacity = '0';
    document.body.style.transition = `opacity ${this.transitionDuration}ms ease-in-out`;
    
    window.addEventListener('load', () => {
      requestAnimationFrame(() => {
        document.body.style.opacity = '1';
      });
    });
    
    // Handle link clicks for smooth transitions
    this.setupLinkTransitions();
  }
  
  setupLinkTransitions() {
    document.addEventListener('click', (e) => {
      const link = e.target.closest('a[href]');
      
      // Only apply to same-origin links
      if (link && link.href && link.origin === location.origin && !link.target) {
        const href = link.href;
        
        // Skip anchor links
        if (href.includes('#') && href.split('#')[0] === location.href.split('#')[0]) {
          return;
        }
        
        e.preventDefault();
        this.navigate(href);
      }
    });
  }
  
  navigate(url) {
    document.body.style.opacity = '0';
    
    setTimeout(() => {
      window.location.href = url;
    }, this.transitionDuration);
  }
}

// Script Loading Optimization
class ScriptLoader {
  static async loadScript(src, options = {}) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = options.async !== false;
      script.defer = options.defer || false;
      
      if (options.module) {
        script.type = 'module';
      }
      
      script.onload = () => resolve(script);
      script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
      
      document.head.appendChild(script);
    });
  }
  
  static preload(href, as = 'script') {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.href = href;
    link.as = as;
    document.head.appendChild(link);
  }
  
  static prefetch(href) {
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = href;
    document.head.appendChild(link);
  }
}

// Performance Monitoring
class PerformanceMonitor {
  static getMetrics() {
    if ('performance' in window && performance.getEntriesByType) {
      const navigation = performance.getEntriesByType('navigation')[0];
      const paint = performance.getEntriesByType('paint');
      
      return {
        // Page load times
        domContentLoaded: navigation ? navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart : 0,
        loadComplete: navigation ? navigation.loadEventEnd - navigation.loadEventStart : 0,
        
        // Paint metrics
        firstPaint: paint.find(p => p.name === 'first-paint')?.startTime || 0,
        firstContentfulPaint: paint.find(p => p.name === 'first-contentful-paint')?.startTime || 0,
        
        // Connection
        connectionType: navigator.connection ? navigator.connection.effectiveType : 'unknown'
      };
    }
    
    return null;
  }
  
  static logMetrics() {
    window.addEventListener('load', () => {
      setTimeout(() => {
        const metrics = PerformanceMonitor.getMetrics();
        if (metrics) {
          console.log('[Performance Metrics]', metrics);
          
          // Send to analytics if available
          if (window.trackEvent) {
            trackEvent('performance_metrics', metrics);
          }
        }
      }, 0);
    });
  }
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
  // Initialize lazy loading
  window.lazyLoader = new LazyLoader();
  
  // Initialize page transitions (optional - can be enabled/disabled)
  // window.pageTransitions = new PageTransitions();
  
  // Monitor performance
  PerformanceMonitor.logMetrics();
  
  console.log('[Performance] Optimization utilities loaded');
});

// Export for use in other scripts
window.Performance = {
  LazyLoader,
  createSkeleton,
  PageTransitions,
  ScriptLoader,
  PerformanceMonitor
};
