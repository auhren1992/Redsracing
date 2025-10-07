-- RedsRacing CMS Database Schema
-- Comprehensive content management system for website and mobile app

-- Content Types Table
CREATE TABLE content_types (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    icon VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Insert default content types
INSERT INTO content_types (name, description, icon) VALUES
('text', 'Text content including headers, paragraphs, and labels', 'fas fa-font'),
('image', 'Images, photos, and graphics', 'fas fa-image'),
('icon', 'Icons and symbolic elements', 'fas fa-icons'),
('color', 'Color schemes and theme colors', 'fas fa-palette'),
('link', 'Links and navigation elements', 'fas fa-link'),
('media', 'Videos, audio, and multimedia content', 'fas fa-video'),
('layout', 'Layout sections and component structures', 'fas fa-th-large'),
('data', 'Dynamic data like stats, scores, and numbers', 'fas fa-chart-bar'),
('meta', 'Meta information like titles, descriptions', 'fas fa-tags'),
('style', 'CSS styles and design properties', 'fas fa-paint-brush');

-- Pages Table
CREATE TABLE pages (
    id INT PRIMARY KEY AUTO_INCREMENT,
    slug VARCHAR(255) NOT NULL UNIQUE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    file_path VARCHAR(500) NOT NULL,
    is_mobile_app BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    priority INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Content Elements Table - Main content storage
CREATE TABLE content_elements (
    id INT PRIMARY KEY AUTO_INCREMENT,
    page_id INT NOT NULL,
    content_type_id INT NOT NULL,
    element_key VARCHAR(255) NOT NULL, -- Unique identifier for the element
    selector VARCHAR(500), -- CSS selector to find the element
    current_value TEXT, -- Current content value
    default_value TEXT, -- Original/default value
    description TEXT,
    section VARCHAR(100), -- Page section (header, footer, main, etc.)
    priority INT DEFAULT 0,
    is_editable BOOLEAN DEFAULT TRUE,
    is_visible BOOLEAN DEFAULT TRUE,
    metadata JSON, -- Additional metadata (classes, attributes, etc.)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE CASCADE,
    FOREIGN KEY (content_type_id) REFERENCES content_types(id),
    UNIQUE KEY unique_element (page_id, element_key)
);

-- Content Versions Table - Version control
CREATE TABLE content_versions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    content_element_id INT NOT NULL,
    version_number INT NOT NULL,
    value TEXT,
    changed_by VARCHAR(255),
    change_description TEXT,
    is_published BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (content_element_id) REFERENCES content_elements(id) ON DELETE CASCADE,
    UNIQUE KEY unique_version (content_element_id, version_number)
);

-- Media Library Table
CREATE TABLE media_library (
    id INT PRIMARY KEY AUTO_INCREMENT,
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size INT,
    mime_type VARCHAR(100),
    width INT,
    height INT,
    alt_text TEXT,
    caption TEXT,
    tags TEXT, -- Comma-separated tags for searching
    is_optimized BOOLEAN DEFAULT FALSE,
    uploaded_by VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Templates Table - Page templates and layouts
CREATE TABLE templates (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    template_file VARCHAR(500),
    preview_image VARCHAR(500),
    category VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Template Sections Table - Sections within templates
CREATE TABLE template_sections (
    id INT PRIMARY KEY AUTO_INCREMENT,
    template_id INT NOT NULL,
    section_name VARCHAR(100) NOT NULL,
    section_key VARCHAR(100) NOT NULL,
    description TEXT,
    is_editable BOOLEAN DEFAULT TRUE,
    default_content TEXT,
    allowed_content_types JSON, -- Array of allowed content type IDs
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE CASCADE,
    UNIQUE KEY unique_section (template_id, section_key)
);

-- Color Schemes Table
CREATE TABLE color_schemes (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    primary_color VARCHAR(10),
    secondary_color VARCHAR(10),
    accent_color VARCHAR(10),
    background_color VARCHAR(10),
    text_color VARCHAR(10),
    success_color VARCHAR(10),
    warning_color VARCHAR(10),
    error_color VARCHAR(10),
    is_active BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Insert default color scheme
INSERT INTO color_schemes (name, description, primary_color, secondary_color, accent_color, background_color, text_color, success_color, warning_color, error_color, is_active) VALUES
('RedsRacing Default', 'Default RedsRacing color scheme', '#3b82f6', '#1e293b', '#fbbf24', '#0f172a', '#ffffff', '#22c55e', '#f59e0b', '#ef4444', TRUE);

-- User Roles Table
CREATE TABLE user_roles (
    id INT PRIMARY KEY AUTO_INCREMENT,
    role_name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    permissions JSON, -- JSON object with permissions
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default roles
INSERT INTO user_roles (role_name, description, permissions) VALUES
('super_admin', 'Full access to all CMS features', '{"all": true}'),
('content_editor', 'Edit content but no system settings', '{"edit_content": true, "manage_media": true, "preview": true}'),
('designer', 'Edit design elements and layouts', '{"edit_design": true, "edit_colors": true, "manage_templates": true, "manage_media": true}'),
('moderator', 'Limited editing access', '{"edit_content": true, "preview": true}');

-- Admin Users Table
CREATE TABLE admin_users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(100) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role_id INT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (role_id) REFERENCES user_roles(id)
);

-- Audit Log Table - Track all changes
CREATE TABLE audit_log (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100), -- 'content', 'media', 'template', etc.
    resource_id INT,
    old_value TEXT,
    new_value TEXT,
    description TEXT,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES admin_users(id) ON DELETE SET NULL
);

-- Content Collections Table - Group related content
CREATE TABLE content_collections (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(100), -- 'gallery', 'menu', 'stats', etc.
    settings JSON,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Collection Items Table - Items within collections
CREATE TABLE collection_items (
    id INT PRIMARY KEY AUTO_INCREMENT,
    collection_id INT NOT NULL,
    content_element_id INT,
    media_id INT,
    title VARCHAR(255),
    description TEXT,
    sort_order INT DEFAULT 0,
    metadata JSON,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (collection_id) REFERENCES content_collections(id) ON DELETE CASCADE,
    FOREIGN KEY (content_element_id) REFERENCES content_elements(id) ON DELETE SET NULL,
    FOREIGN KEY (media_id) REFERENCES media_library(id) ON DELETE SET NULL
);

-- Navigation Menus Table
CREATE TABLE navigation_menus (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    location VARCHAR(100), -- 'header', 'footer', 'sidebar', etc.
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Navigation Items Table
CREATE TABLE navigation_items (
    id INT PRIMARY KEY AUTO_INCREMENT,
    menu_id INT NOT NULL,
    parent_id INT NULL, -- For dropdown/nested menus
    title VARCHAR(255) NOT NULL,
    url VARCHAR(500),
    icon VARCHAR(100),
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    target VARCHAR(20) DEFAULT '_self', -- '_self', '_blank', etc.
    css_class VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (menu_id) REFERENCES navigation_menus(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES navigation_items(id) ON DELETE CASCADE
);

-- Bulk Operations Table - Track bulk editing operations
CREATE TABLE bulk_operations (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    operation_type VARCHAR(100) NOT NULL, -- 'find_replace', 'mass_update', etc.
    parameters JSON, -- Operation parameters
    affected_count INT DEFAULT 0,
    status ENUM('pending', 'processing', 'completed', 'failed') DEFAULT 'pending',
    error_message TEXT,
    started_at TIMESTAMP NULL,
    completed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES admin_users(id)
);

-- Content Backups Table - Regular backups of content
CREATE TABLE content_backups (
    id INT PRIMARY KEY AUTO_INCREMENT,
    backup_name VARCHAR(255) NOT NULL,
    description TEXT,
    file_path VARCHAR(500) NOT NULL,
    file_size INT,
    backup_type ENUM('manual', 'automatic') DEFAULT 'automatic',
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES admin_users(id) ON DELETE SET NULL
);

-- Settings Table - Global CMS settings
CREATE TABLE cms_settings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    setting_key VARCHAR(100) NOT NULL UNIQUE,
    setting_value TEXT,
    description TEXT,
    is_system BOOLEAN DEFAULT FALSE, -- System settings vs user preferences
    updated_by INT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (updated_by) REFERENCES admin_users(id) ON DELETE SET NULL
);

-- Insert default settings
INSERT INTO cms_settings (setting_key, setting_value, description, is_system) VALUES
('site_title', 'RedsRacing #8', 'Default site title', FALSE),
('auto_backup_interval', '24', 'Hours between automatic backups', TRUE),
('max_file_size', '50', 'Maximum file upload size in MB', TRUE),
('allowed_file_types', '["jpg","jpeg","png","gif","webp","svg","mp4","mov","pdf"]', 'Allowed file extensions for uploads', TRUE),
('enable_versioning', 'true', 'Enable content versioning', TRUE),
('max_versions', '10', 'Maximum number of versions to keep per content item', TRUE),
('preview_mode', 'iframe', 'Preview mode: iframe or popup', FALSE),
('editor_theme', 'light', 'Editor theme: light or dark', FALSE);

-- Indexes for performance
CREATE INDEX idx_content_elements_page ON content_elements(page_id);
CREATE INDEX idx_content_elements_type ON content_elements(content_type_id);
CREATE INDEX idx_content_elements_key ON content_elements(element_key);
CREATE INDEX idx_content_versions_element ON content_versions(content_element_id);
CREATE INDEX idx_audit_log_user ON audit_log(user_id);
CREATE INDEX idx_audit_log_resource ON audit_log(resource_type, resource_id);
CREATE INDEX idx_media_library_filename ON media_library(filename);
CREATE INDEX idx_collection_items_collection ON collection_items(collection_id);
CREATE INDEX idx_navigation_items_menu ON navigation_items(menu_id);

-- Views for common queries
CREATE VIEW v_editable_content AS
SELECT 
    ce.id,
    ce.element_key,
    ce.current_value,
    ce.description,
    ce.section,
    p.title AS page_title,
    p.slug AS page_slug,
    ct.name AS content_type,
    ct.icon AS content_type_icon,
    ce.updated_at
FROM content_elements ce
JOIN pages p ON ce.page_id = p.id
JOIN content_types ct ON ce.content_type_id = ct.id
WHERE ce.is_editable = TRUE AND p.is_active = TRUE;

CREATE VIEW v_recent_changes AS
SELECT 
    cv.id,
    ce.element_key,
    p.title AS page_title,
    ct.name AS content_type,
    cv.value,
    cv.changed_by,
    cv.change_description,
    cv.created_at
FROM content_versions cv
JOIN content_elements ce ON cv.content_element_id = ce.id
JOIN pages p ON ce.page_id = p.id
JOIN content_types ct ON ce.content_type_id = ct.id
ORDER BY cv.created_at DESC
LIMIT 100;