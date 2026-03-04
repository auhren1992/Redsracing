// Modern Visual Effects JavaScript
console.log('🎨 Modern Effects System Loading...');

class ModernEffectsManager {
    constructor() {
        this.init();
    }

    init() {
        this.setupScrollReveal();
        this.setupCounterAnimations();
        this.setupLoadingStates();
        this.setupProgressRings();
        this.setupGradientText();
        this.setupPerformanceOptimizations();
        console.log('✨ Modern Effects System Active');
    }

    // Scroll Reveal System
    setupScrollReveal() {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                }
            });
        }, {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        });

        // Auto-detect reveal elements
        const revealElements = document.querySelectorAll(
            '.reveal-fade, .reveal-slide, .reveal-scale, .modern-card, .card'
        );
        
        revealElements.forEach((el, index) => {
            // Add staggered delays
            el.style.transitionDelay = `${index * 0.1}s`;
            observer.observe(el);
        });
    }

    // Animated Counter System
    setupCounterAnimations() {
        const counters = document.querySelectorAll('.animated-counter, [data-counter]');
        
        counters.forEach(counter => {
            const target = parseInt(counter.getAttribute('data-target') || counter.textContent);
            if (!target || isNaN(target)) return;

            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        this.animateCounter(counter, target);
                        observer.unobserve(counter);
                    }
                });
            });

            observer.observe(counter);
        });
    }

    animateCounter(element, target) {
        const duration = 2000;
        const start = 0;
        const startTime = Date.now();
        
        const update = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Easing function for smooth animation
            const easeOutQuart = 1 - Math.pow(1 - progress, 4);
            const current = Math.floor(start + (target - start) * easeOutQuart);
            
            element.textContent = current.toLocaleString();
            
            if (progress < 1) {
                requestAnimationFrame(update);
            }
        };
        
        update();
    }

    // Loading States Management
    setupLoadingStates() {
        // Auto-remove loading states after content loads
        window.addEventListener('load', () => {
            setTimeout(() => {
                document.querySelectorAll('.loading-shimmer').forEach(el => {
                    el.classList.remove('loading-shimmer');
                    el.classList.add('reveal-fade', 'visible');
                });
            }, 500);
        });

        // Create loading dots for async operations
        this.createLoadingDots();
    }

    createLoadingDots() {
        const loadingContainers = document.querySelectorAll('[data-loading]');
        
        loadingContainers.forEach(container => {
            const dots = document.createElement('div');
            dots.className = 'loading-dots';
            dots.innerHTML = `
                <div class="loading-dot"></div>
                <div class="loading-dot"></div>
                <div class="loading-dot"></div>
            `;
            dots.style.display = 'none';
            container.appendChild(dots);
        });
    }

    showLoading(selector) {
        const container = document.querySelector(selector);
        if (container) {
            const dots = container.querySelector('.loading-dots');
            if (dots) dots.style.display = 'inline-flex';
        }
    }

    hideLoading(selector) {
        const container = document.querySelector(selector);
        if (container) {
            const dots = container.querySelector('.loading-dots');
            if (dots) dots.style.display = 'none';
        }
    }

    // Progress Ring Animations
    setupProgressRings() {
        const rings = document.querySelectorAll('.progress-ring');
        
        rings.forEach(ring => {
            const circle = ring.querySelector('.progress-ring-progress');
            if (!circle) return;

            const radius = circle.r.baseVal.value;
            const circumference = 2 * Math.PI * radius;
            const percentage = parseInt(ring.getAttribute('data-progress') || '0');
            
            circle.style.strokeDasharray = circumference;
            circle.style.strokeDashoffset = circumference;

            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        this.animateProgressRing(circle, circumference, percentage);
                        observer.unobserve(ring);
                    }
                });
            });

            observer.observe(ring);
        });
    }

    animateProgressRing(circle, circumference, percentage) {
        const offset = circumference - (percentage / 100) * circumference;
        
        setTimeout(() => {
            circle.style.strokeDashoffset = offset;
        }, 300);
    }

    // Gradient Text Effects
    setupGradientText() {
        const gradientTexts = document.querySelectorAll('.text-gradient');
        
        gradientTexts.forEach(text => {
            // Add hover effects for interactive gradient text
            text.addEventListener('mouseenter', () => {
                text.style.animationDuration = '1s';
            });
            
            text.addEventListener('mouseleave', () => {
                text.style.animationDuration = '3s';
            });
        });
    }

    // Performance Optimizations
    setupPerformanceOptimizations() {
        // Add GPU acceleration to animated elements
        const animatedElements = document.querySelectorAll(`
            .card, .modern-card, .modern-btn, .progress-ring,
            .text-gradient, .racing-pulse, .speed-lines
        `);
        
        animatedElements.forEach(el => {
            el.classList.add('gpu-accelerated');
        });

        // Reduce animations on low-end devices
        this.optimizeForDevice();
    }

    optimizeForDevice() {
        const isLowEnd = navigator.hardwareConcurrency <= 2 || 
                        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        
        if (isLowEnd) {
            document.documentElement.style.setProperty('--animation-duration', '0.1s');
            document.querySelectorAll('.speed-lines').forEach(el => {
                el.classList.remove('speed-lines');
            });
        }
    }

    // Public API Methods
    addGlowEffect(selector, color = '#fbbf24') {
        const element = document.querySelector(selector);
        if (element) {
            element.style.boxShadow = `0 0 20px ${color}40, 0 0 40px ${color}20`;
            element.style.transition = 'box-shadow 0.3s ease';
        }
    }

    removeGlowEffect(selector) {
        const element = document.querySelector(selector);
        if (element) {
            element.style.boxShadow = '';
        }
    }

    pulseElement(selector, duration = 1000) {
        const element = document.querySelector(selector);
        if (element) {
            element.style.animation = `racingPulse ${duration}ms ease-in-out`;
            setTimeout(() => {
                element.style.animation = '';
            }, duration);
        }
    }

    createNotification(message, type = 'info', duration = 4000) {
        const notification = document.createElement('div');
        notification.className = `notification glass-card ${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-message">${message}</span>
                <button class="notification-close" onclick="this.parentElement.parentElement.remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        
        // Styles
        Object.assign(notification.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            zIndex: '10000',
            padding: '16px 20px',
            borderRadius: '12px',
            color: 'white',
            minWidth: '300px',
            transform: 'translateX(400px)',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
        });

        // Type-specific colors
        const colors = {
            success: { bg: 'rgba(16, 185, 129, 0.9)', border: '#10b981' },
            error: { bg: 'rgba(239, 68, 68, 0.9)', border: '#ef4444' },
            warning: { bg: 'rgba(245, 158, 11, 0.9)', border: '#f59e0b' },
            info: { bg: 'rgba(59, 130, 246, 0.9)', border: '#3b82f6' }
        };

        const colorScheme = colors[type] || colors.info;
        notification.style.background = colorScheme.bg;
        notification.style.borderLeft = `4px solid ${colorScheme.border}`;

        document.body.appendChild(notification);

        // Animate in
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);

        // Auto remove
        if (duration > 0) {
            setTimeout(() => {
                notification.style.transform = 'translateX(400px)';
                setTimeout(() => {
                    if (notification.parentElement) {
                        notification.remove();
                    }
                }, 300);
            }, duration);
        }

        return notification;
    }
}

// Global Effects Manager Instance
window.modernEffects = new ModernEffectsManager();

// Utility Functions for Global Use
window.showLoading = (selector) => window.modernEffects.showLoading(selector);
window.hideLoading = (selector) => window.modernEffects.hideLoading(selector);
window.addGlow = (selector, color) => window.modernEffects.addGlowEffect(selector, color);
window.removeGlow = (selector) => window.modernEffects.removeGlowEffect(selector);
window.pulseElement = (selector, duration) => window.modernEffects.pulseElement(selector, duration);
window.notify = (message, type, duration) => window.modernEffects.createNotification(message, type, duration);

// Racing-Specific Effects
class RacingEffects {
    static speedBoost(selector) {
        const element = document.querySelector(selector);
        if (element) {
            element.classList.add('speed-lines');
            setTimeout(() => {
                element.classList.remove('speed-lines');
            }, 2000);
        }
    }

    static victoryAnimation(selector) {
        const element = document.querySelector(selector);
        if (element) {
            element.style.animation = 'racingPulse 0.5s ease-in-out 3';
            window.addGlow(selector, '#fbbf24');
            
            setTimeout(() => {
                element.style.animation = '';
                window.removeGlow(selector);
            }, 1500);
        }
    }

    static checkeredFlag(selector) {
        const element = document.querySelector(selector);
        if (element) {
            const flag = document.createElement('div');
            flag.innerHTML = '🏁';
            flag.style.cssText = `
                position: absolute;
                top: -20px;
                right: -20px;
                font-size: 2rem;
                animation: racingPulse 1s ease-in-out 2;
                z-index: 1000;
            `;
            element.style.position = 'relative';
            element.appendChild(flag);
            
            setTimeout(() => flag.remove(), 2000);
        }
    }
}

window.RacingEffects = RacingEffects;

// Initialize on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log('🏁 Racing Effects Ready!');
    });
} else {
    console.log('🏁 Racing Effects Ready!');
}