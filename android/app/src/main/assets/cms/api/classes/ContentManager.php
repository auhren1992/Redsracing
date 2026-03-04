<?php

class ContentManager {
    private $db;
    
    public function __construct($database) {
        $this->db = $database;
    }
    
    // Statistics methods
    public function getTotalPages() {
        $stmt = $this->db->prepare("SELECT COUNT(*) as total FROM pages WHERE is_active = 1");
        $stmt->execute();
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        return (int)$result['total'];
    }
    
    public function getTotalElements() {
        $stmt = $this->db->prepare("SELECT COUNT(*) as total FROM content_elements WHERE is_editable = 1");
        $stmt->execute();
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        return (int)$result['total'];
    }
    
    public function getRecentChangesCount() {
        $stmt = $this->db->prepare("
            SELECT COUNT(*) as total 
            FROM content_versions 
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        ");
        $stmt->execute();
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        return (int)$result['total'];
    }
    
    public function getLastUpdateTime() {
        $stmt = $this->db->prepare("
            SELECT MAX(updated_at) as last_update 
            FROM content_elements
        ");
        $stmt->execute();
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        return $result['last_update'];
    }
    
    // Page management
    public function getAllPages() {
        $stmt = $this->db->prepare("
            SELECT id, slug, title, description, file_path, is_mobile_app, is_active, 
                   priority, created_at, updated_at 
            FROM pages 
            ORDER BY priority DESC, title ASC
        ");
        $stmt->execute();
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
    
    public function getPage($slug) {
        $stmt = $this->db->prepare("
            SELECT * FROM pages 
            WHERE slug = ? OR id = ?
        ");
        $stmt->execute([$slug, $slug]);
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }
    
    public function createPage($data) {
        $stmt = $this->db->prepare("
            INSERT INTO pages (slug, title, description, file_path, is_mobile_app, is_active, priority) 
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $data['slug'],
            $data['title'],
            $data['description'] ?? '',
            $data['file_path'],
            $data['is_mobile_app'] ?? false,
            $data['is_active'] ?? true,
            $data['priority'] ?? 0
        ]);
        
        $pageId = $this->db->lastInsertId();
        $this->logActivity('create', 'page', $pageId, 'Page created: ' . $data['title']);
        return $pageId;
    }
    
    public function updatePage($pageId, $data) {
        $stmt = $this->db->prepare("
            UPDATE pages 
            SET title = ?, description = ?, file_path = ?, is_mobile_app = ?, 
                is_active = ?, priority = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE id = ? OR slug = ?
        ");
        $stmt->execute([
            $data['title'],
            $data['description'] ?? '',
            $data['file_path'],
            $data['is_mobile_app'] ?? false,
            $data['is_active'] ?? true,
            $data['priority'] ?? 0,
            $pageId,
            $pageId
        ]);
        
        $this->logActivity('update', 'page', $pageId, 'Page updated: ' . $data['title']);
    }
    
    public function deletePage($pageId) {
        $stmt = $this->db->prepare("DELETE FROM pages WHERE id = ? OR slug = ?");
        $stmt->execute([$pageId, $pageId]);
        
        $this->logActivity('delete', 'page', $pageId, 'Page deleted');
    }
    
    // Content management
    public function getAllContent() {
        $stmt = $this->db->prepare("
            SELECT ce.*, p.title as page_title, p.slug as page_slug, 
                   ct.name as content_type, ct.icon as content_type_icon
            FROM content_elements ce
            JOIN pages p ON ce.page_id = p.id
            JOIN content_types ct ON ce.content_type_id = ct.id
            WHERE ce.is_editable = 1 AND p.is_active = 1
            ORDER BY p.title, ce.section, ce.priority
        ");
        $stmt->execute();
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
    
    public function getPageContent($pageSlug) {
        $stmt = $this->db->prepare("
            SELECT ce.*, ct.name as content_type, ct.icon as content_type_icon
            FROM content_elements ce
            JOIN pages p ON ce.page_id = p.id
            JOIN content_types ct ON ce.content_type_id = ct.id
            WHERE (p.slug = ? OR p.id = ?) AND ce.is_editable = 1 AND p.is_active = 1
            ORDER BY ce.section, ce.priority
        ");
        $stmt->execute([$pageSlug, $pageSlug]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
    
    public function getContentItem($itemId) {
        $stmt = $this->db->prepare("
            SELECT ce.*, ct.name as content_type, ct.icon as content_type_icon,
                   p.title as page_title, p.slug as page_slug
            FROM content_elements ce
            JOIN content_types ct ON ce.content_type_id = ct.id
            JOIN pages p ON ce.page_id = p.id
            WHERE ce.id = ?
        ");
        $stmt->execute([$itemId]);
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }
    
    public function createContentItem($data) {
        // Get or create content type
        $contentTypeId = $this->getOrCreateContentType($data['content_type']);
        
        // Get page ID
        $pageId = $this->getPageId($data['page_slug']);
        
        $stmt = $this->db->prepare("
            INSERT INTO content_elements 
            (page_id, content_type_id, element_key, selector, current_value, 
             default_value, description, section, priority, is_editable, is_visible, metadata) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $pageId,
            $contentTypeId,
            $data['element_key'],
            $data['selector'] ?? '',
            $data['current_value'] ?? '',
            $data['default_value'] ?? $data['current_value'] ?? '',
            $data['description'] ?? '',
            $data['section'] ?? 'general',
            $data['priority'] ?? 0,
            $data['is_editable'] ?? true,
            $data['is_visible'] ?? true,
            json_encode($data['metadata'] ?? [])
        ]);
        
        $itemId = $this->db->lastInsertId();
        $this->createContentVersion($itemId, $data['current_value'] ?? '', 'Content created');
        $this->logActivity('create', 'content', $itemId, 'Content item created: ' . $data['description']);
        
        return $itemId;
    }
    
    public function updateContentItem($itemId, $data) {
        // Get current value for version tracking
        $currentItem = $this->getContentItem($itemId);
        $oldValue = $currentItem['current_value'];
        
        $stmt = $this->db->prepare("
            UPDATE content_elements 
            SET current_value = ?, description = ?, is_visible = ?, metadata = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        ");
        $stmt->execute([
            $data['current_value'],
            $data['description'] ?? $currentItem['description'],
            $data['is_visible'] ?? $currentItem['is_visible'],
            json_encode($data['metadata'] ?? json_decode($currentItem['metadata'] ?? '[]', true)),
            $itemId
        ]);
        
        // Create version if value changed
        if ($oldValue !== $data['current_value']) {
            $this->createContentVersion($itemId, $data['current_value'], 'Content updated');
        }
        
        $this->logActivity('update', 'content', $itemId, 'Content updated: ' . ($data['description'] ?? $currentItem['description']));
    }
    
    public function deleteContentItem($itemId) {
        $stmt = $this->db->prepare("DELETE FROM content_elements WHERE id = ?");
        $stmt->execute([$itemId]);
        
        $this->logActivity('delete', 'content', $itemId, 'Content item deleted');
    }
    
    // Visual editor saves
    public function saveVisualChanges($data) {
        $pageSlug = basename($data['page'], '.html'); // Extract page name from path
        $changes = $data['changes'];
        $pageId = $this->getPageId($pageSlug);
        
        if (!$pageId) {
            // Create page if it doesn't exist
            $pageId = $this->createPage([
                'slug' => $pageSlug,
                'title' => ucfirst($pageSlug),
                'file_path' => $data['page'],
                'is_active' => true
            ]);
        }
        
        $savedCount = 0;
        foreach ($changes as $change) {
            // Find existing content element by selector
            $stmt = $this->db->prepare("
                SELECT id FROM content_elements 
                WHERE page_id = ? AND selector = ?
            ");
            $stmt->execute([$pageId, $change['selector']]);
            $existingItem = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if ($existingItem) {
                // Update existing item
                $this->updateContentItem($existingItem['id'], [
                    'current_value' => $change['newValue'],
                    'description' => $change['description'] ?? 'Visual editor change'
                ]);
            } else {
                // Create new content item
                $contentTypeId = $this->getOrCreateContentType($change['contentType']);
                $this->createContentItem([
                    'page_slug' => $pageSlug,
                    'content_type' => $change['contentType'],
                    'element_key' => $this->generateElementKey($change['selector']),
                    'selector' => $change['selector'],
                    'current_value' => $change['newValue'],
                    'description' => $change['description'] ?? 'Visual editor content'
                ]);
            }
            $savedCount++;
        }
        
        return [
            'message' => "Successfully saved {$savedCount} changes",
            'saved_count' => $savedCount,
            'page' => $pageSlug
        ];
    }
    
    // Batch operations
    public function batchSaveContent($data) {
        $changes = $data['changes'];
        $savedCount = 0;
        
        foreach ($changes as $change) {
            try {
                if (isset($change['id'])) {
                    $this->updateContentItem($change['id'], $change);
                } else {
                    $this->createContentItem($change);
                }
                $savedCount++;
            } catch (Exception $e) {
                // Log error but continue processing other items
                error_log("Batch save error: " . $e->getMessage());
            }
        }
        
        return [
            'message' => "Batch save completed",
            'saved_count' => $savedCount,
            'total_count' => count($changes)
        ];
    }
    
    public function autoSaveContent($data) {
        // Similar to batch save but with auto-save flag
        $changes = $data['changes'];
        $savedCount = 0;
        
        foreach ($changes as $change) {
            try {
                // Mark as auto-saved version
                $change['auto_saved'] = true;
                if (isset($change['id'])) {
                    $this->updateContentItem($change['id'], $change);
                }
                $savedCount++;
            } catch (Exception $e) {
                error_log("Auto save error: " . $e->getMessage());
            }
        }
        
        return [
            'message' => "Auto-save completed",
            'saved_count' => $savedCount
        ];
    }
    
    // Activity and versioning
    public function getRecentActivity() {
        $stmt = $this->db->prepare("
            SELECT al.*, au.username as user_name
            FROM audit_log al
            LEFT JOIN admin_users au ON al.user_id = au.id
            ORDER BY al.created_at DESC
            LIMIT 20
        ");
        $stmt->execute();
        $activities = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Format activities for display
        return array_map(function($activity) {
            return [
                'action' => $activity['action'],
                'description' => $activity['description'] ?: $this->formatActivityDescription($activity),
                'user' => $activity['user_name'] ?: 'System',
                'created_at' => $activity['created_at']
            ];
        }, $activities);
    }
    
    public function createContentVersion($contentElementId, $value, $description = '') {
        // Get next version number
        $stmt = $this->db->prepare("
            SELECT COALESCE(MAX(version_number), 0) + 1 as next_version 
            FROM content_versions 
            WHERE content_element_id = ?
        ");
        $stmt->execute([$contentElementId]);
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        $versionNumber = $result['next_version'];
        
        // Create version
        $stmt = $this->db->prepare("
            INSERT INTO content_versions (content_element_id, version_number, value, change_description, changed_by) 
            VALUES (?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $contentElementId,
            $versionNumber,
            $value,
            $description,
            'admin' // TODO: Get actual user
        ]);
        
        // Clean up old versions (keep only last 10)
        $stmt = $this->db->prepare("
            DELETE FROM content_versions 
            WHERE content_element_id = ? 
            AND version_number < (
                SELECT version_number FROM (
                    SELECT version_number 
                    FROM content_versions 
                    WHERE content_element_id = ? 
                    ORDER BY version_number DESC 
                    LIMIT 1 OFFSET 9
                ) as temp
            )
        ");
        $stmt->execute([$contentElementId, $contentElementId]);
    }
    
    // Backup operations
    public function createBackup() {
        $backupName = 'backup_' . date('Y-m-d_H-i-s');
        $backupPath = '../backups/' . $backupName . '.sql';
        
        // Create backup directory if it doesn't exist
        if (!is_dir('../backups')) {
            mkdir('../backups', 0755, true);
        }
        
        // Export database
        $tables = ['pages', 'content_elements', 'content_versions', 'media_library'];
        $sql = "-- RedsRacing CMS Backup - " . date('Y-m-d H:i:s') . "\n\n";
        
        foreach ($tables as $table) {
            $stmt = $this->db->prepare("SELECT * FROM {$table}");
            $stmt->execute();
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            if (!empty($rows)) {
                $sql .= "-- Table: {$table}\n";
                $columns = array_keys($rows[0]);
                $sql .= "INSERT INTO {$table} (" . implode(', ', $columns) . ") VALUES\n";
                
                $values = [];
                foreach ($rows as $row) {
                    $escapedValues = array_map(function($value) {
                        return "'" . str_replace("'", "''", $value) . "'";
                    }, $row);
                    $values[] = "(" . implode(', ', $escapedValues) . ")";
                }
                
                $sql .= implode(",\n", $values) . ";\n\n";
            }
        }
        
        file_put_contents($backupPath, $sql);
        $fileSize = filesize($backupPath);
        
        // Save backup record
        $stmt = $this->db->prepare("
            INSERT INTO content_backups (backup_name, description, file_path, file_size, backup_type) 
            VALUES (?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $backupName,
            'Automated backup',
            $backupPath,
            $fileSize,
            'manual'
        ]);
        
        return [
            'backup_name' => $backupName,
            'file_path' => $backupPath,
            'file_size' => $fileSize,
            'message' => 'Backup created successfully'
        ];
    }
    
    public function getBackups() {
        $stmt = $this->db->prepare("
            SELECT id, backup_name, description, file_path, file_size, backup_type, created_at
            FROM content_backups 
            ORDER BY created_at DESC
        ");
        $stmt->execute();
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
    
    public function restoreBackup($backupId) {
        $stmt = $this->db->prepare("SELECT * FROM content_backups WHERE id = ?");
        $stmt->execute([$backupId]);
        $backup = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$backup || !file_exists($backup['file_path'])) {
            throw new Exception('Backup file not found');
        }
        
        // Execute backup SQL
        $sql = file_get_contents($backup['file_path']);
        $statements = explode(';', $sql);
        
        foreach ($statements as $statement) {
            $statement = trim($statement);
            if (!empty($statement) && !str_starts_with($statement, '--')) {
                $this->db->exec($statement);
            }
        }
        
        $this->logActivity('restore', 'backup', $backupId, 'Backup restored: ' . $backup['backup_name']);
        
        return [
            'message' => 'Backup restored successfully',
            'backup_name' => $backup['backup_name']
        ];
    }
    
    // Helper methods
    private function getOrCreateContentType($typeName) {
        $stmt = $this->db->prepare("SELECT id FROM content_types WHERE name = ?");
        $stmt->execute([$typeName]);
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($result) {
            return $result['id'];
        }
        
        // Create new content type
        $stmt = $this->db->prepare("INSERT INTO content_types (name, description) VALUES (?, ?)");
        $stmt->execute([$typeName, ucfirst($typeName) . ' content']);
        return $this->db->lastInsertId();
    }
    
    private function getPageId($pageSlug) {
        $stmt = $this->db->prepare("SELECT id FROM pages WHERE slug = ?");
        $stmt->execute([$pageSlug]);
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        return $result ? $result['id'] : null;
    }
    
    private function generateElementKey($selector) {
        // Generate a unique key from the CSS selector
        return 'elem_' . md5($selector);
    }
    
    private function logActivity($action, $resourceType, $resourceId, $description) {
        $stmt = $this->db->prepare("
            INSERT INTO audit_log (action, resource_type, resource_id, description, ip_address, user_agent) 
            VALUES (?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $action,
            $resourceType,
            $resourceId,
            $description,
            $_SERVER['REMOTE_ADDR'] ?? 'unknown',
            $_SERVER['HTTP_USER_AGENT'] ?? 'unknown'
        ]);
    }
    
    private function formatActivityDescription($activity) {
        $actionMap = [
            'create' => 'Created',
            'update' => 'Updated',
            'delete' => 'Deleted',
            'restore' => 'Restored'
        ];
        
        $action = $actionMap[$activity['action']] ?? ucfirst($activity['action']);
        $resource = ucfirst($activity['resource_type']);
        
        return "{$action} {$resource} (ID: {$activity['resource_id']})";
    }
}

?>