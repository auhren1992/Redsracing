/**
 * RedsRacing Visual Page Editor
 * Allows direct editing of content by clicking on elements on the live website
 */

class VisualEditor {
    constructor() {
        this.isEnabled = false;
        this.selectedElement = null;
        this.editableElements = new Map();
        this.overlay = null;
        this.toolbar = null;
        this.editModal = null;
        this.apiBase = '/cms/api';
        this.unsavedChanges = new Map();
        this.init();
    }

    init() {
        // Only initialize if we're in edit mode (URL parameter or parent window)
        if (this.shouldEnableEditor()) {
            this.enable();
        }

        // Listen for messages from CMS dashboard
        window.addEventListener('message', (event) => {
            if (event.data.type === 'ENABLE_VISUAL_EDITOR') {
                this.enable();
            } else if (event.data.type === 'DISABLE_VISUAL_EDITOR') {
                this.disable();
            }
        });
    }

    shouldEnableEditor() {
        // Check URL parameter
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('cms_edit') === 'true') return true;
        
        // Check if opened from CMS dashboard
        try {
            if (window.opener && window.opener.cmsInstance) return true;
        } catch (e) {
            // Cross-origin error, ignore
        }
        
        return false;
    }

    async enable() {
        if (this.isEnabled) return;
        
        console.log('🎨 Visual Editor: Enabling...');
        this.isEnabled = true;
        
        // Create UI elements
        this.createOverlay();
        this.createToolbar();
        
        // Scan page for editable elements
        await this.scanEditableElements();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Add edit indicators to elements
        this.addEditIndicators();
        
        // Show welcome message
        this.showNotification('Visual Editor enabled! Click on any text, image, or element to edit it.', 'success');
        
        console.log('🎨 Visual Editor: Ready!');
    }

    disable() {
        if (!this.isEnabled) return;
        
        console.log('🎨 Visual Editor: Disabling...');
        this.isEnabled = false;
        
        // Remove UI elements
        if (this.overlay) this.overlay.remove();
        if (this.toolbar) this.toolbar.remove();
        if (this.editModal) this.editModal.remove();
        
        // Remove event listeners
        this.removeEventListeners();
        
        // Remove edit indicators
        this.removeEditIndicators();
        
        console.log('🎨 Visual Editor: Disabled');
    }

    createOverlay() {
        this.overlay = document.createElement('div');
        this.overlay.id = 'cms-visual-overlay';
        this.overlay.innerHTML = `
            <style>
                #cms-visual-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    pointer-events: none;
                    z-index: 999999;
                }
                
                .cms-edit-highlight {
                    position: absolute;
                    border: 2px dashed #3b82f6;
                    background-color: rgba(59, 130, 246, 0.1);
                    pointer-events: none;
                    transition: all 0.2s ease;
                    border-radius: 4px;
                }
                
                .cms-edit-highlight::after {
                    content: 'Click to edit';
                    position: absolute;
                    top: -30px;
                    left: 0;
                    background: #3b82f6;
                    color: white;
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-size: 12px;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    white-space: nowrap;
                    opacity: 0;
                    transition: opacity 0.2s ease;
                }
                
                .cms-edit-highlight.show-label::after {
                    opacity: 1;
                }
                
                .cms-edit-indicator {
                    position: absolute;
                    top: -8px;
                    right: -8px;
                    width: 20px;
                    height: 20px;
                    background: #3b82f6;
                    border: 2px solid white;
                    border-radius: 50%;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 10px;
                    color: white;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                    transition: all 0.2s ease;
                    pointer-events: auto;
                }
                
                .cms-edit-indicator:hover {
                    transform: scale(1.2);
                    background: #2563eb;
                }
                
                .cms-edit-indicator::before {
                    content: '✎';
                }
            </style>
        `;
        document.body.appendChild(this.overlay);
    }

    createToolbar() {
        this.toolbar = document.createElement('div');
        this.toolbar.id = 'cms-visual-toolbar';
        this.toolbar.innerHTML = `
            <style>
                #cms-visual-toolbar {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    background: linear-gradient(135deg, #1f2937 0%, #374151 100%);
                    border: 1px solid #4b5563;
                    border-radius: 12px;
                    padding: 12px;
                    box-shadow: 0 10px 40px rgba(0,0,0,0.3);
                    z-index: 1000000;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    backdrop-filter: blur(10px);
                }
                
                .cms-toolbar-button {
                    background: #3b82f6;
                    border: none;
                    border-radius: 8px;
                    color: white;
                    padding: 8px 12px;
                    margin: 0 4px;
                    cursor: pointer;
                    font-size: 12px;
                    font-weight: 500;
                    transition: all 0.2s ease;
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                }
                
                .cms-toolbar-button:hover {
                    background: #2563eb;
                    transform: translateY(-1px);
                }
                
                .cms-toolbar-button.danger {
                    background: #ef4444;
                }
                
                .cms-toolbar-button.danger:hover {
                    background: #dc2626;
                }
                
                .cms-toolbar-button.success {
                    background: #10b981;
                }
                
                .cms-toolbar-button.success:hover {
                    background: #059669;
                }
                
                .cms-toolbar-info {
                    color: #d1d5db;
                    font-size: 11px;
                    margin-bottom: 8px;
                    text-align: center;
                }
                
                .cms-unsaved-indicator {
                    display: inline-block;
                    width: 8px;
                    height: 8px;
                    background: #fbbf24;
                    border-radius: 50%;
                    margin-left: 4px;
                    animation: pulse 2s infinite;
                }
            </style>
            
            <div class="cms-toolbar-info">
                Visual Editor Active
                <span id="cms-unsaved-count" style="display: none;">
                    <span class="cms-unsaved-indicator"></span>
                    <span id="cms-unsaved-text">0 unsaved</span>
                </span>
            </div>
            
            <div style="display: flex; align-items: center;">
                <button class="cms-toolbar-button success" id="cms-save-all" title="Save all changes">
                    💾 Save All
                </button>
                <button class="cms-toolbar-button" id="cms-toggle-indicators" title="Toggle edit indicators">
                    👁️ Indicators
                </button>
                <button class="cms-toolbar-button" id="cms-return-dashboard" title="Return to dashboard">
                    📊 Dashboard
                </button>
                <button class="cms-toolbar-button danger" id="cms-exit-editor" title="Exit visual editor">
                    ✕ Exit
                </button>
            </div>
        `;
        document.body.appendChild(this.toolbar);
    }

    setupEventListeners() {
        // Toolbar buttons
        document.getElementById('cms-save-all').addEventListener('click', () => this.saveAllChanges());
        document.getElementById('cms-toggle-indicators').addEventListener('click', () => this.toggleIndicators());
        document.getElementById('cms-return-dashboard').addEventListener('click', () => this.returnToDashboard());
        document.getElementById('cms-exit-editor').addEventListener('click', () => this.disable());
        
        // Element selection
        this.elementClickHandler = (e) => this.handleElementClick(e);
        this.elementHoverHandler = (e) => this.handleElementHover(e);
        
        document.addEventListener('click', this.elementClickHandler, true);
        document.addEventListener('mouseover', this.elementHoverHandler, true);
        
        // Keyboard shortcuts
        this.keydownHandler = (e) => this.handleKeydown(e);
        document.addEventListener('keydown', this.keydownHandler);
    }

    removeEventListeners() {
        if (this.elementClickHandler) {
            document.removeEventListener('click', this.elementClickHandler, true);
        }
        if (this.elementHoverHandler) {
            document.removeEventListener('mouseover', this.elementHoverHandler, true);
        }
        if (this.keydownHandler) {
            document.removeEventListener('keydown', this.keydownHandler);
        }
    }

    async scanEditableElements() {
        console.log('🔍 Scanning for editable elements...');
        
        // Define selectors for different types of editable content
        const editableSelectors = [
            // Text content
            'h1, h2, h3, h4, h5, h6',
            'p',
            'span:not(.cms-toolbar-button):not([id*="cms-"])',
            'a',
            'button:not([id*="cms-"])',
            'li',
            'td',
            'label',
            
            // Images and media
            'img',
            'video',
            
            // Interactive elements
            'input[type="text"]',
            'input[type="email"]',
            'textarea',
            
            // Containers with direct text
            'div:not([id*="cms-"]):not(.cms-edit-highlight)',
            'section:not([id*="cms-"])',
        ];
        
        let elementCount = 0;
        
        editableSelectors.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(element => {
                if (this.isElementEditable(element)) {
                    const elementInfo = this.analyzeElement(element);
                    if (elementInfo) {
                        this.editableElements.set(element, elementInfo);
                        elementCount++;
                    }
                }
            });
        });
        
        console.log(`🔍 Found ${elementCount} editable elements`);
    }

    isElementEditable(element) {
        // Skip CMS elements
        if (element.id && element.id.startsWith('cms-')) return false;
        if (element.closest('[id*="cms-"]')) return false;
        
        // Skip empty elements (unless they're images)
        if (!element.tagName.match(/IMG|VIDEO|INPUT|TEXTAREA/) && !element.textContent.trim()) return false;
        
        // Skip elements that are too small to be meaningful
        const rect = element.getBoundingClientRect();
        if (rect.width < 10 || rect.height < 10) return false;
        
        // Skip hidden elements
        const style = getComputedStyle(element);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
        
        return true;
    }

    analyzeElement(element) {
        const tagName = element.tagName.toLowerCase();
        const rect = element.getBoundingClientRect();
        
        let contentType = 'text';
        let currentValue = '';
        let description = '';
        
        switch (tagName) {
            case 'img':
                contentType = 'image';
                currentValue = element.src;
                description = `Image: ${element.alt || 'No alt text'}`;
                break;
            case 'video':
                contentType = 'media';
                currentValue = element.src || (element.querySelector('source') ? element.querySelector('source').src : '');
                description = 'Video element';
                break;
            case 'input':
                if (element.type === 'email') contentType = 'email';
                currentValue = element.value || element.placeholder;
                description = `Input: ${element.placeholder || element.name || 'Text field'}`;
                break;
            case 'textarea':
                currentValue = element.value || element.placeholder;
                description = `Textarea: ${element.placeholder || element.name || 'Text area'}`;
                break;
            case 'a':
                contentType = 'link';
                currentValue = element.textContent.trim();
                description = `Link: ${element.href}`;
                break;
            case 'button':
                currentValue = element.textContent.trim();
                description = 'Button text';
                break;
            default:
                currentValue = element.textContent.trim();
                description = `${tagName.toUpperCase()}: ${currentValue.substring(0, 50)}${currentValue.length > 50 ? '...' : ''}`;
                break;
        }
        
        return {
            element,
            contentType,
            currentValue,
            description,
            selector: this.generateSelector(element),
            rect: {
                top: rect.top + window.scrollY,
                left: rect.left + window.scrollX,
                width: rect.width,
                height: rect.height
            }
        };
    }

    generateSelector(element) {
        // Generate a CSS selector for the element
        if (element.id) return `#${element.id}`;
        
        let selector = element.tagName.toLowerCase();
        
        if (element.className) {
            const classes = element.className.split(' ').filter(c => c && !c.startsWith('cms-'));
            if (classes.length > 0) {
                selector += '.' + classes.join('.');
            }
        }
        
        // Add position if needed
        const siblings = Array.from(element.parentNode.children).filter(child => 
            child.tagName === element.tagName && 
            child.className === element.className
        );
        
        if (siblings.length > 1) {
            const index = siblings.indexOf(element) + 1;
            selector += `:nth-child(${index})`;
        }
        
        return selector;
    }

    addEditIndicators() {
        this.editableElements.forEach((info, element) => {
            const indicator = document.createElement('div');
            indicator.className = 'cms-edit-indicator';
            indicator.addEventListener('click', (e) => {
                e.stopPropagation();
                this.selectElement(element);
            });
            
            // Position indicator
            this.positionIndicator(indicator, info.rect);
            
            this.overlay.appendChild(indicator);
            info.indicator = indicator;
        });
    }

    removeEditIndicators() {
        this.editableElements.forEach((info) => {
            if (info.indicator) {
                info.indicator.remove();
            }
        });
    }

    positionIndicator(indicator, rect) {
        indicator.style.position = 'absolute';
        indicator.style.top = rect.top + 'px';
        indicator.style.left = (rect.left + rect.width) + 'px';
    }

    toggleIndicators() {
        const indicators = this.overlay.querySelectorAll('.cms-edit-indicator');
        const isVisible = indicators[0] && indicators[0].style.display !== 'none';
        
        indicators.forEach(indicator => {
            indicator.style.display = isVisible ? 'none' : 'flex';
        });
    }

    handleElementClick(e) {
        if (!this.isEnabled) return;
        if (e.target.closest('#cms-visual-toolbar')) return;
        if (e.target.closest('#cms-visual-overlay')) return;
        
        e.preventDefault();
        e.stopPropagation();
        
        const element = e.target;
        if (this.editableElements.has(element)) {
            this.selectElement(element);
        }
    }

    handleElementHover(e) {
        if (!this.isEnabled) return;
        if (e.target.closest('#cms-visual-toolbar')) return;
        if (e.target.closest('#cms-visual-overlay')) return;
        
        const element = e.target;
        if (this.editableElements.has(element)) {
            this.highlightElement(element);
        } else {
            this.clearHighlight();
        }
    }

    highlightElement(element) {
        const info = this.editableElements.get(element);
        if (!info) return;
        
        this.clearHighlight();
        
        const highlight = document.createElement('div');
        highlight.className = 'cms-edit-highlight show-label';
        highlight.style.top = info.rect.top + 'px';
        highlight.style.left = info.rect.left + 'px';
        highlight.style.width = info.rect.width + 'px';
        highlight.style.height = info.rect.height + 'px';
        
        this.overlay.appendChild(highlight);
        this.currentHighlight = highlight;
    }

    clearHighlight() {
        if (this.currentHighlight) {
            this.currentHighlight.remove();
            this.currentHighlight = null;
        }
    }

    selectElement(element) {
        const info = this.editableElements.get(element);
        if (!info) return;
        
        this.selectedElement = element;
        this.showEditModal(info);
    }

    showEditModal(info) {
        // Remove existing modal
        if (this.editModal) this.editModal.remove();
        
        this.editModal = document.createElement('div');
        this.editModal.innerHTML = `
            <style>
                .cms-edit-modal {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0,0,0,0.8);
                    backdrop-filter: blur(4px);
                    z-index: 1000001;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                }
                
                .cms-modal-content {
                    background: linear-gradient(135deg, #1f2937 0%, #374151 100%);
                    border: 1px solid #4b5563;
                    border-radius: 16px;
                    padding: 24px;
                    max-width: 600px;
                    width: 90%;
                    max-height: 80vh;
                    overflow-y: auto;
                    box-shadow: 0 20px 60px rgba(0,0,0,0.5);
                    color: white;
                }
                
                .cms-modal-header {
                    display: flex;
                    justify-content: between;
                    align-items: center;
                    margin-bottom: 20px;
                    padding-bottom: 16px;
                    border-bottom: 1px solid #4b5563;
                }
                
                .cms-modal-title {
                    font-size: 18px;
                    font-weight: 600;
                    margin: 0;
                    flex: 1;
                }
                
                .cms-close-btn {
                    background: none;
                    border: none;
                    color: #9ca3af;
                    cursor: pointer;
                    font-size: 20px;
                    padding: 4px;
                }
                
                .cms-close-btn:hover {
                    color: white;
                }
                
                .cms-form-group {
                    margin-bottom: 16px;
                }
                
                .cms-form-label {
                    display: block;
                    margin-bottom: 6px;
                    font-weight: 500;
                    font-size: 14px;
                    color: #d1d5db;
                }
                
                .cms-form-input, .cms-form-textarea {
                    width: 100%;
                    background: #374151;
                    border: 1px solid #4b5563;
                    border-radius: 8px;
                    padding: 12px;
                    color: white;
                    font-size: 14px;
                    font-family: inherit;
                    resize: vertical;
                }
                
                .cms-form-input:focus, .cms-form-textarea:focus {
                    outline: none;
                    border-color: #3b82f6;
                    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
                }
                
                .cms-form-textarea {
                    min-height: 100px;
                }
                
                .cms-form-actions {
                    display: flex;
                    gap: 12px;
                    margin-top: 24px;
                    justify-content: flex-end;
                }
                
                .cms-btn {
                    padding: 10px 20px;
                    border: none;
                    border-radius: 8px;
                    font-size: 14px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }
                
                .cms-btn-primary {
                    background: #3b82f6;
                    color: white;
                }
                
                .cms-btn-primary:hover {
                    background: #2563eb;
                }
                
                .cms-btn-secondary {
                    background: #4b5563;
                    color: white;
                }
                
                .cms-btn-secondary:hover {
                    background: #6b7280;
                }
                
                .cms-element-preview {
                    background: #111827;
                    border: 1px solid #374151;
                    border-radius: 8px;
                    padding: 12px;
                    margin-bottom: 16px;
                    font-size: 12px;
                    color: #9ca3af;
                }
            </style>
            
            <div class="cms-edit-modal">
                <div class="cms-modal-content">
                    <div class="cms-modal-header">
                        <h3 class="cms-modal-title">Edit Content</h3>
                        <button class="cms-close-btn" onclick="this.closest('.cms-edit-modal').remove()">&times;</button>
                    </div>
                    
                    <div class="cms-element-preview">
                        <strong>Element:</strong> ${info.description}<br>
                        <strong>Type:</strong> ${info.contentType}<br>
                        <strong>Selector:</strong> ${info.selector}
                    </div>
                    
                    <form id="cms-edit-form">
                        ${this.getEditForm(info)}
                    </form>
                    
                    <div class="cms-form-actions">
                        <button type="button" class="cms-btn cms-btn-secondary" onclick="this.closest('.cms-edit-modal').remove()">
                            Cancel
                        </button>
                        <button type="button" class="cms-btn cms-btn-primary" id="cms-save-changes">
                            💾 Save Changes
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(this.editModal);
        
        // Setup save handler
        document.getElementById('cms-save-changes').addEventListener('click', () => {
            this.saveElementChanges(info);
        });
    }

    getEditForm(info) {
        switch (info.contentType) {
            case 'image':
                return `
                    <div class="cms-form-group">
                        <label class="cms-form-label">Image URL</label>
                        <input type="url" class="cms-form-input" id="cms-edit-value" value="${info.currentValue}" placeholder="https://example.com/image.jpg">
                    </div>
                    <div class="cms-form-group">
                        <label class="cms-form-label">Alt Text</label>
                        <input type="text" class="cms-form-input" id="cms-edit-alt" value="${info.element.alt || ''}" placeholder="Describe the image">
                    </div>
                `;
            case 'link':
                return `
                    <div class="cms-form-group">
                        <label class="cms-form-label">Link Text</label>
                        <input type="text" class="cms-form-input" id="cms-edit-value" value="${info.currentValue}">
                    </div>
                    <div class="cms-form-group">
                        <label class="cms-form-label">URL</label>
                        <input type="url" class="cms-form-input" id="cms-edit-url" value="${info.element.href || ''}" placeholder="https://example.com">
                    </div>
                `;
            case 'text':
            default:
                const isMultiline = info.currentValue.length > 100 || info.currentValue.includes('\n');
                return `
                    <div class="cms-form-group">
                        <label class="cms-form-label">Content</label>
                        ${isMultiline ? 
                            `<textarea class="cms-form-textarea" id="cms-edit-value">${info.currentValue}</textarea>` :
                            `<input type="text" class="cms-form-input" id="cms-edit-value" value="${info.currentValue}">`
                        }
                    </div>
                `;
        }
    }

    saveElementChanges(info) {
        const newValue = document.getElementById('cms-edit-value').value;
        const altText = document.getElementById('cms-edit-alt')?.value;
        const url = document.getElementById('cms-edit-url')?.value;
        
        // Apply changes immediately to the page
        this.applyElementChanges(info, newValue, altText, url);
        
        // Store changes for later saving
        this.unsavedChanges.set(info.element, {
            elementInfo: info,
            newValue,
            altText,
            url,
            timestamp: Date.now()
        });
        
        // Update UI
        this.updateUnsavedCounter();
        this.showNotification('Changes applied! Click "Save All" to make them permanent.', 'success');
        
        // Close modal
        this.editModal.remove();
    }

    applyElementChanges(info, newValue, altText, url) {
        const element = info.element;
        
        switch (info.contentType) {
            case 'image':
                if (newValue) element.src = newValue;
                if (altText !== undefined) element.alt = altText;
                break;
            case 'link':
                if (newValue) element.textContent = newValue;
                if (url) element.href = url;
                break;
            default:
                if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
                    element.value = newValue;
                } else {
                    element.textContent = newValue;
                }
                break;
        }
        
        // Update our stored info
        info.currentValue = newValue;
    }

    updateUnsavedCounter() {
        const count = this.unsavedChanges.size;
        const counterElement = document.getElementById('cms-unsaved-count');
        const textElement = document.getElementById('cms-unsaved-text');
        
        if (count > 0) {
            counterElement.style.display = 'inline-block';
            textElement.textContent = `${count} unsaved`;
        } else {
            counterElement.style.display = 'none';
        }
    }

    async saveAllChanges() {
        if (this.unsavedChanges.size === 0) {
            this.showNotification('No changes to save', 'info');
            return;
        }
        
        const changes = Array.from(this.unsavedChanges.values()).map(change => ({
            selector: change.elementInfo.selector,
            contentType: change.elementInfo.contentType,
            newValue: change.newValue,
            altText: change.altText,
            url: change.url,
            description: change.elementInfo.description
        }));
        
        try {
            // Save to backend
            await this.apiCall('/content/visual-save', 'POST', {
                page: window.location.pathname,
                changes: changes
            });
            
            this.unsavedChanges.clear();
            this.updateUnsavedCounter();
            this.showNotification('All changes saved successfully!', 'success');
            
        } catch (error) {
            console.error('Failed to save changes:', error);
            this.showNotification('Failed to save changes. Please try again.', 'error');
        }
    }

    handleKeydown(e) {
        if (!this.isEnabled) return;
        
        // Escape key - clear selection or close modal
        if (e.key === 'Escape') {
            if (this.editModal) {
                this.editModal.remove();
            } else {
                this.selectedElement = null;
                this.clearHighlight();
            }
        }
        
        // Ctrl+S - Save all changes
        if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
            this.saveAllChanges();
        }
    }

    returnToDashboard() {
        if (window.opener && window.opener.cmsInstance) {
            window.close();
        } else {
            window.location.href = '/cms/admin-dashboard.html';
        }
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            z-index: 1000002;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 14px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            animation: slideIn 0.3s ease;
        `;
        
        notification.textContent = message;
        document.body.appendChild(notification);
        
        // Add slide-in animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
        
        // Remove after 4 seconds
        setTimeout(() => {
            notification.style.animation = 'slideIn 0.3s ease reverse';
            setTimeout(() => {
                notification.remove();
                style.remove();
            }, 300);
        }, 4000);
    }

    async apiCall(endpoint, method = 'GET', data = null) {
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        if (data) {
            options.body = JSON.stringify(data);
        }

        const response = await fetch(`${this.apiBase}${endpoint}`, options);
        
        if (!response.ok) {
            throw new Error(`API call failed: ${response.status}`);
        }

        return response.json();
    }
}

// Initialize Visual Editor
document.addEventListener('DOMContentLoaded', () => {
    window.visualEditor = new VisualEditor();
    
    // Expose global toggle function
    window.toggleVisualEditor = () => {
        if (window.visualEditor.isEnabled) {
            window.visualEditor.disable();
        } else {
            window.visualEditor.enable();
        }
    };
});