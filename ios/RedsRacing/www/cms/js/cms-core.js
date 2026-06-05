/**
 * RedsRacing CMS Core Functionality
 * Handles all core CMS operations including content management, API calls, and UI interactions
 */

class RedsRacingCMS {
    constructor() {
        this.apiBase = '/cms/api';
        this.currentUser = null;
        this.unsavedChanges = [];
        this.currentPage = null;
        this.isVisualMode = false;
        this.init();
    }

    async init() {
        this.setupEventListeners();
        await this.loadInitialData();
        this.showToast('CMS initialized successfully!', 'success');
    }

    setupEventListeners() {
        // Sidebar toggle
        document.getElementById('sidebar-toggle').addEventListener('click', () => {
            this.toggleSidebar();
        });

        // Navigation items
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const section = item.dataset.section;
                this.loadSection(section);
            });
        });

        // Main action buttons
        document.getElementById('save-all').addEventListener('click', () => {
            this.saveAllChanges();
        });

        document.getElementById('preview-site').addEventListener('click', () => {
            this.previewSite();
        });

        document.getElementById('bulk-edit-toggle').addEventListener('click', () => {
            this.toggleBulkEditMode();
        });

        document.getElementById('visual-editor-btn').addEventListener('click', () => {
            this.openVisualEditor();
        });

        // Page selector
        document.getElementById('page-selector').addEventListener('change', (e) => {
            this.loadPageContent(e.target.value);
        });

        // Content search and filters
        document.getElementById('content-search').addEventListener('input', (e) => {
            this.filterContent(e.target.value);
        });

        document.getElementById('content-type-filter').addEventListener('change', (e) => {
            this.filterContentByType(e.target.value);
        });

        // Media upload
        this.setupMediaUpload();

        // Auto-save functionality
        setInterval(() => {
            if (this.unsavedChanges.length > 0) {
                this.autoSave();
            }
        }, 30000); // Auto-save every 30 seconds
    }

    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        const mainContent = document.getElementById('main-content');
        
        if (sidebar.style.transform === 'translateX(-100%)') {
            sidebar.style.transform = 'translateX(0)';
            mainContent.style.marginLeft = '16rem';
        } else {
            sidebar.style.transform = 'translateX(-100%)';
            mainContent.style.marginLeft = '0';
        }
    }

    async loadSection(sectionName) {
        // Hide all sections
        document.querySelectorAll('.cms-section').forEach(section => {
            section.classList.add('hidden');
        });

        // Show selected section
        const targetSection = document.getElementById(`section-${sectionName}`);
        if (targetSection) {
            targetSection.classList.remove('hidden');
        }

        // Update navigation active state
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('bg-gray-700');
        });
        document.querySelector(`[data-section="${sectionName}"]`).classList.add('bg-gray-700');

        // Load section-specific data
        switch (sectionName) {
            case 'content':
                await this.loadContentEditor();
                break;
            case 'pages':
                await this.loadPagesManager();
                break;
            case 'media':
                await this.loadMediaLibrary();
                break;
            case 'design':
                await this.loadDesignEditor();
                break;
            case 'navigation':
                await this.loadNavigationEditor();
                break;
            case 'bulk':
                await this.loadBulkOperations();
                break;
            case 'settings':
                await this.loadSettings();
                break;
            default:
                await this.loadDashboard();
                break;
        }
    }

    async loadInitialData() {
        try {
            // Load pages list
            const pages = await this.apiCall('/pages');
            this.populatePageSelector(pages);
            
            // Load statistics
            await this.updateStats();
            
            // Load recent activity
            await this.loadRecentActivity();
        } catch (error) {
            console.error('Failed to load initial data:', error);
            this.showToast('Failed to load initial data', 'error');
        }
    }

    async updateStats() {
        try {
            const stats = await this.apiCall('/stats');
            document.getElementById('stats-pages').textContent = stats.totalPages || 0;
            document.getElementById('stats-elements').textContent = stats.totalElements || 0;
            document.getElementById('stats-changes').textContent = stats.recentChanges || 0;
        } catch (error) {
            console.error('Failed to load stats:', error);
        }
    }

    async loadContentEditor() {
        console.log('Loading content editor...');
        // Content editor will be populated when a page is selected
    }

    async loadPageContent(pageSlug) {
        if (!pageSlug) return;

        this.showLoading(true);
        try {
            const content = await this.apiCall(`/content/${pageSlug}`);
            this.displayContentList(content);
            this.currentPage = pageSlug;
        } catch (error) {
            console.error('Failed to load page content:', error);
            this.showToast('Failed to load page content', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    displayContentList(contentItems) {
        const contentList = document.getElementById('content-list');
        
        if (!contentItems || contentItems.length === 0) {
            contentList.innerHTML = `
                <div class="text-center text-gray-400 py-8">
                    <i class="fas fa-inbox text-4xl mb-4"></i>
                    <p>No editable content found for this page.</p>
                </div>
            `;
            return;
        }

        contentList.innerHTML = contentItems.map(item => this.createContentItemHtml(item)).join('');
        
        // Setup edit buttons
        contentList.querySelectorAll('.edit-content-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const itemId = e.target.closest('.content-item').dataset.itemId;
                this.editContentItem(itemId);
            });
        });
    }

    createContentItemHtml(item) {
        const iconMap = {
            text: 'fas fa-font',
            image: 'fas fa-image',
            icon: 'fas fa-icons',
            link: 'fas fa-link',
            data: 'fas fa-chart-bar',
            color: 'fas fa-palette'
        };

        const icon = iconMap[item.content_type] || 'fas fa-edit';
        const preview = item.current_value ? 
            (item.current_value.length > 50 ? item.current_value.substring(0, 50) + '...' : item.current_value) : 
            'No content';

        return `
            <div class="content-item bg-gray-700 p-4 rounded-lg hover:bg-gray-600 transition-colors" data-item-id="${item.id}">
                <div class="flex items-center justify-between">
                    <div class="flex items-center space-x-3">
                        <i class="${icon} text-blue-400"></i>
                        <div>
                            <h4 class="font-semibold">${item.description || item.element_key}</h4>
                            <p class="text-sm text-gray-400">${item.section || 'General'} • ${item.content_type}</p>
                            <p class="text-sm text-gray-300 mt-1">${preview}</p>
                        </div>
                    </div>
                    <div class="flex space-x-2">
                        <button class="edit-content-btn bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded text-sm transition-colors">
                            <i class="fas fa-edit mr-1"></i>Edit
                        </button>
                        <button class="bg-gray-600 hover:bg-gray-500 px-3 py-1 rounded text-sm transition-colors">
                            <i class="fas fa-eye mr-1"></i>Preview
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    async editContentItem(itemId) {
        try {
            const item = await this.apiCall(`/content/item/${itemId}`);
            this.showContentEditModal(item);
        } catch (error) {
            console.error('Failed to load content item:', error);
            this.showToast('Failed to load content item', 'error');
        }
    }

    showContentEditModal(item) {
        const modalHtml = `
            <div class="fixed inset-0 modal-backdrop z-50 flex items-center justify-center">
                <div class="bg-gray-800 p-6 rounded-lg max-w-2xl w-full mx-4 max-h-screen overflow-y-auto">
                    <div class="flex items-center justify-between mb-6">
                        <h3 class="text-xl font-semibold">Edit Content</h3>
                        <button id="close-edit-modal" class="text-gray-400 hover:text-white">
                            <i class="fas fa-times text-xl"></i>
                        </button>
                    </div>
                    
                    <div class="space-y-4">
                        <div>
                            <label class="block text-sm font-medium mb-2">Description</label>
                            <input type="text" value="${item.description || ''}" 
                                   class="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2"
                                   id="edit-description">
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium mb-2">Content</label>
                            ${this.getContentEditor(item.content_type, item.current_value)}
                        </div>
                        
                        <div class="flex items-center space-x-2">
                            <input type="checkbox" id="edit-visible" ${item.is_visible ? 'checked' : ''}>
                            <label for="edit-visible" class="text-sm">Visible on website</label>
                        </div>
                        
                        <div class="flex justify-end space-x-4 pt-4">
                            <button id="cancel-edit" class="bg-gray-600 hover:bg-gray-700 px-4 py-2 rounded-lg transition-colors">
                                Cancel
                            </button>
                            <button id="save-edit" class="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg transition-colors"
                                    data-item-id="${item.id}">
                                <i class="fas fa-save mr-2"></i>Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Add modal to DOM
        const modalElement = document.createElement('div');
        modalElement.innerHTML = modalHtml;
        document.body.appendChild(modalElement.firstElementChild);

        // Setup modal event listeners
        document.getElementById('close-edit-modal').addEventListener('click', this.closeEditModal);
        document.getElementById('cancel-edit').addEventListener('click', this.closeEditModal);
        document.getElementById('save-edit').addEventListener('click', (e) => {
            this.saveContentItem(e.target.dataset.itemId);
        });
    }

    getContentEditor(contentType, currentValue) {
        switch (contentType) {
            case 'text':
                return `<textarea class="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 h-32" 
                               id="edit-content">${currentValue || ''}</textarea>`;
            case 'image':
                return `
                    <div class="space-y-2">
                        <input type="url" value="${currentValue || ''}" placeholder="Image URL" 
                               class="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2" id="edit-content">
                        <div class="flex space-x-2">
                            <button class="bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded text-sm">Choose File</button>
                            <button class="bg-purple-600 hover:bg-purple-700 px-3 py-1 rounded text-sm">Media Library</button>
                        </div>
                    </div>
                `;
            case 'color':
                return `<input type="color" value="${currentValue || '#000000'}" 
                               class="w-full h-12 bg-gray-700 border border-gray-600 rounded-lg" id="edit-content">`;
            case 'link':
                return `<input type="url" value="${currentValue || ''}" placeholder="https://example.com" 
                               class="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2" id="edit-content">`;
            default:
                return `<input type="text" value="${currentValue || ''}" 
                               class="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2" id="edit-content">`;
        }
    }

    closeEditModal() {
        const modal = document.querySelector('.modal-backdrop');
        if (modal) {
            modal.remove();
        }
    }

    async saveContentItem(itemId) {
        const content = document.getElementById('edit-content').value;
        const description = document.getElementById('edit-description').value;
        const isVisible = document.getElementById('edit-visible').checked;

        try {
            await this.apiCall(`/content/item/${itemId}`, 'PUT', {
                current_value: content,
                description: description,
                is_visible: isVisible
            });

            this.showToast('Content saved successfully!', 'success');
            this.closeEditModal();
            
            // Refresh content list
            if (this.currentPage) {
                await this.loadPageContent(this.currentPage);
            }
        } catch (error) {
            console.error('Failed to save content:', error);
            this.showToast('Failed to save content', 'error');
        }
    }

    async openVisualEditor() {
        if (!this.currentPage) {
            this.showToast('Please select a page first', 'warning');
            return;
        }

        // Open the actual website page in visual edit mode
        const pageUrl = `../${this.currentPage}.html?cms_edit=true`;
        window.open(pageUrl, '_blank');
    }

    populatePageSelector(pages) {
        const selector = document.getElementById('page-selector');
        selector.innerHTML = '<option value="">Select a page to edit...</option>';
        
        pages.forEach(page => {
            const option = document.createElement('option');
            option.value = page.slug;
            option.textContent = `${page.title} (${page.slug})`;
            selector.appendChild(option);
        });
    }

    filterContent(searchTerm) {
        const contentItems = document.querySelectorAll('.content-item');
        contentItems.forEach(item => {
            const text = item.textContent.toLowerCase();
            if (text.includes(searchTerm.toLowerCase())) {
                item.style.display = 'block';
            } else {
                item.style.display = 'none';
            }
        });
    }

    filterContentByType(contentType) {
        const contentItems = document.querySelectorAll('.content-item');
        contentItems.forEach(item => {
            const typeSpan = item.querySelector('.text-gray-400');
            if (!contentType || typeSpan.textContent.includes(contentType)) {
                item.style.display = 'block';
            } else {
                item.style.display = 'none';
            }
        });
    }

    setupMediaUpload() {
        const uploadZone = document.getElementById('media-upload-zone');
        const uploadInput = document.getElementById('media-upload-input');

        uploadZone.addEventListener('click', () => {
            uploadInput.click();
        });

        uploadZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadZone.classList.add('border-blue-400');
        });

        uploadZone.addEventListener('dragleave', () => {
            uploadZone.classList.remove('border-blue-400');
        });

        uploadZone.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadZone.classList.remove('border-blue-400');
            this.handleFileUpload(e.dataTransfer.files);
        });

        uploadInput.addEventListener('change', (e) => {
            this.handleFileUpload(e.target.files);
        });
    }

    async handleFileUpload(files) {
        if (!files || files.length === 0) return;

        this.showLoading(true);
        try {
            const formData = new FormData();
            Array.from(files).forEach(file => {
                formData.append('files[]', file);
            });

            const result = await this.apiCall('/media/upload', 'POST', formData, false);
            this.showToast(`Successfully uploaded ${files.length} file(s)`, 'success');
            
            // Refresh media library if we're on that section
            if (!document.getElementById('section-media').classList.contains('hidden')) {
                await this.loadMediaLibrary();
            }
        } catch (error) {
            console.error('Upload failed:', error);
            this.showToast('File upload failed', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async loadMediaLibrary() {
        try {
            const media = await this.apiCall('/media');
            this.displayMediaGallery(media);
        } catch (error) {
            console.error('Failed to load media library:', error);
        }
    }

    displayMediaGallery(mediaItems) {
        const gallery = document.getElementById('media-gallery');
        if (!mediaItems || mediaItems.length === 0) {
            gallery.innerHTML = `
                <div class="col-span-full text-center text-gray-400 py-8">
                    <i class="fas fa-images text-4xl mb-4"></i>
                    <p>No media files found. Upload some files to get started!</p>
                </div>
            `;
            return;
        }

        gallery.innerHTML = mediaItems.map(item => `
            <div class="media-item bg-gray-700 p-2 rounded-lg hover:bg-gray-600 transition-colors cursor-pointer">
                <div class="aspect-square bg-gray-600 rounded mb-2 overflow-hidden">
                    ${this.getMediaPreview(item)}
                </div>
                <p class="text-xs text-center truncate">${item.original_filename}</p>
                <div class="flex justify-center space-x-1 mt-2">
                    <button class="bg-blue-600 hover:bg-blue-700 px-2 py-1 rounded text-xs">Use</button>
                    <button class="bg-red-600 hover:bg-red-700 px-2 py-1 rounded text-xs">Delete</button>
                </div>
            </div>
        `).join('');
    }

    getMediaPreview(mediaItem) {
        if (mediaItem.mime_type.startsWith('image/')) {
            return `<img src="${mediaItem.file_path}" alt="${mediaItem.alt_text}" class="w-full h-full object-cover">`;
        } else if (mediaItem.mime_type.startsWith('video/')) {
            return `<video class="w-full h-full object-cover"><source src="${mediaItem.file_path}"></video>`;
        } else {
            return `<div class="w-full h-full flex items-center justify-center">
                        <i class="fas fa-file text-2xl text-gray-400"></i>
                    </div>`;
        }
    }

    async loadPagesManager() {
        // Placeholder for pages management
        console.log('Loading pages manager...');
    }

    async loadDesignEditor() {
        // Placeholder for design editor
        console.log('Loading design editor...');
    }

    async loadNavigationEditor() {
        // Placeholder for navigation editor
        console.log('Loading navigation editor...');
    }

    async loadBulkOperations() {
        // Placeholder for bulk operations
        console.log('Loading bulk operations...');
    }

    async loadSettings() {
        // Placeholder for settings
        console.log('Loading settings...');
    }

    async loadDashboard() {
        await this.updateStats();
        await this.loadRecentActivity();
    }

    async loadRecentActivity() {
        try {
            const activity = await this.apiCall('/activity/recent');
            this.displayRecentActivity(activity);
        } catch (error) {
            console.error('Failed to load recent activity:', error);
        }
    }

    displayRecentActivity(activities) {
        const container = document.getElementById('recent-activity');
        if (!activities || activities.length === 0) return;

        const activityHtml = activities.map(activity => `
            <div class="flex items-center space-x-4 p-3 bg-gray-700 rounded-lg">
                <div class="w-2 h-2 bg-${this.getActivityColor(activity.action)} rounded-full"></div>
                <div class="flex-1">
                    <p class="text-sm">${activity.description}</p>
                    <p class="text-xs text-gray-400">${this.formatDate(activity.created_at)}</p>
                </div>
            </div>
        `).join('');

        container.innerHTML = activityHtml;
    }

    getActivityColor(action) {
        const colors = {
            'create': 'green-400',
            'update': 'blue-400',
            'delete': 'red-400',
            'upload': 'purple-400'
        };
        return colors[action] || 'gray-400';
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    }

    toggleBulkEditMode() {
        // Toggle bulk edit mode
        console.log('Toggling bulk edit mode...');
        this.showToast('Bulk edit mode toggled', 'info');
    }

    previewSite() {
        window.open('../index.html', '_blank');
    }

    async saveAllChanges() {
        if (this.unsavedChanges.length === 0) {
            this.showToast('No changes to save', 'info');
            return;
        }

        this.showLoading(true);
        try {
            await this.apiCall('/content/batch-save', 'POST', {
                changes: this.unsavedChanges
            });
            
            this.unsavedChanges = [];
            this.showToast('All changes saved successfully!', 'success');
        } catch (error) {
            console.error('Failed to save changes:', error);
            this.showToast('Failed to save changes', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async autoSave() {
        if (this.unsavedChanges.length === 0) return;
        
        try {
            await this.apiCall('/content/auto-save', 'POST', {
                changes: this.unsavedChanges
            });
            console.log('Auto-save completed');
        } catch (error) {
            console.error('Auto-save failed:', error);
        }
    }

    async apiCall(endpoint, method = 'GET', data = null, isJson = true) {
        const options = {
            method,
            headers: {}
        };

        if (data) {
            if (isJson) {
                options.headers['Content-Type'] = 'application/json';
                options.body = JSON.stringify(data);
            } else {
                options.body = data;
            }
        }

        const response = await fetch(`${this.apiBase}${endpoint}`, options);
        
        if (!response.ok) {
            throw new Error(`API call failed: ${response.status}`);
        }

        return response.json();
    }

    showLoading(show) {
        const overlay = document.getElementById('loading-overlay');
        if (show) {
            overlay.classList.remove('hidden');
        } else {
            overlay.classList.add('hidden');
        }
    }

    showToast(message, type = 'info') {
        const toast = document.getElementById('toast');
        const messageElement = document.getElementById('toast-message');
        
        // Set message
        messageElement.textContent = message;
        
        // Set color based on type
        toast.className = 'toast';
        switch (type) {
            case 'success':
                toast.classList.add('bg-green-600');
                break;
            case 'error':
                toast.classList.add('bg-red-600');
                break;
            case 'warning':
                toast.classList.add('bg-yellow-600');
                break;
            default:
                toast.classList.add('bg-blue-600');
        }
        
        // Show toast
        toast.classList.add('show');
        
        // Hide after 3 seconds
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }
}

// Global function to load sections (called from HTML)
function loadSection(sectionName) {
    if (window.cmsInstance) {
        window.cmsInstance.loadSection(sectionName);
    }
}

// Initialize CMS when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.cmsInstance = new RedsRacingCMS();
});