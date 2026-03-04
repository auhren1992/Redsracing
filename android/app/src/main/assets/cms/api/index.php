<?php
/**
 * RedsRacing CMS API
 * Main API endpoint that handles all CMS operations
 */

// Enable CORS for cross-origin requests
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json; charset=UTF-8");

// Handle preflight OPTIONS requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Database configuration
define('DB_HOST', 'localhost');
define('DB_NAME', 'redsracing_cms');
define('DB_USER', 'root'); // Change as needed
define('DB_PASS', ''); // Change as needed

// Include required files
require_once 'config.php';
require_once 'classes/Database.php';
require_once 'classes/ContentManager.php';
require_once 'classes/MediaManager.php';
require_once 'classes/UserManager.php';

class CMSApi {
    private $db;
    private $contentManager;
    private $mediaManager;
    private $userManager;
    
    public function __construct() {
        try {
            $this->db = new Database();
            $this->contentManager = new ContentManager($this->db);
            $this->mediaManager = new MediaManager($this->db);
            $this->userManager = new UserManager($this->db);
        } catch (Exception $e) {
            $this->sendError('Database connection failed: ' . $e->getMessage(), 500);
        }
    }
    
    public function handleRequest() {
        try {
            $method = $_SERVER['REQUEST_METHOD'];
            $uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
            $path = str_replace('/cms/api', '', $uri);
            $segments = array_filter(explode('/', $path));
            
            // Route requests to appropriate handlers
            $resource = $segments[1] ?? '';
            $action = $segments[2] ?? '';
            $id = $segments[3] ?? '';
            
            switch ($resource) {
                case 'stats':
                    $this->handleStats();
                    break;
                case 'pages':
                    $this->handlePages($method, $action, $id);
                    break;
                case 'content':
                    $this->handleContent($method, $action, $id);
                    break;
                case 'media':
                    $this->handleMedia($method, $action, $id);
                    break;
                case 'activity':
                    $this->handleActivity($method, $action, $id);
                    break;
                case 'users':
                    $this->handleUsers($method, $action, $id);
                    break;
                case 'backup':
                    $this->handleBackup($method, $action, $id);
                    break;
                default:
                    $this->sendError('Invalid API endpoint', 404);
            }
        } catch (Exception $e) {
            $this->sendError('API Error: ' . $e->getMessage(), 500);
        }
    }
    
    private function handleStats() {
        try {
            $stats = [
                'totalPages' => $this->contentManager->getTotalPages(),
                'totalElements' => $this->contentManager->getTotalElements(),
                'recentChanges' => $this->contentManager->getRecentChangesCount(),
                'mediaFiles' => $this->mediaManager->getTotalMediaFiles(),
                'lastUpdate' => $this->contentManager->getLastUpdateTime()
            ];
            $this->sendResponse($stats);
        } catch (Exception $e) {
            $this->sendError('Failed to fetch stats: ' . $e->getMessage());
        }
    }
    
    private function handlePages($method, $action, $id) {
        switch ($method) {
            case 'GET':
                if ($action) {
                    // Get specific page
                    $page = $this->contentManager->getPage($action);
                    $this->sendResponse($page);
                } else {
                    // Get all pages
                    $pages = $this->contentManager->getAllPages();
                    $this->sendResponse($pages);
                }
                break;
            case 'POST':
                $data = $this->getJsonInput();
                $pageId = $this->contentManager->createPage($data);
                $this->sendResponse(['id' => $pageId, 'message' => 'Page created successfully']);
                break;
            case 'PUT':
                $data = $this->getJsonInput();
                $this->contentManager->updatePage($action, $data);
                $this->sendResponse(['message' => 'Page updated successfully']);
                break;
            case 'DELETE':
                $this->contentManager->deletePage($action);
                $this->sendResponse(['message' => 'Page deleted successfully']);
                break;
            default:
                $this->sendError('Method not allowed', 405);
        }
    }
    
    private function handleContent($method, $action, $id) {
        switch ($method) {
            case 'GET':
                if ($action === 'item' && $id) {
                    // Get specific content item
                    $item = $this->contentManager->getContentItem($id);
                    $this->sendResponse($item);
                } elseif ($action) {
                    // Get content for specific page
                    $content = $this->contentManager->getPageContent($action);
                    $this->sendResponse($content);
                } else {
                    // Get all content
                    $content = $this->contentManager->getAllContent();
                    $this->sendResponse($content);
                }
                break;
            case 'POST':
                $data = $this->getJsonInput();
                if ($action === 'visual-save') {
                    // Handle visual editor saves
                    $result = $this->contentManager->saveVisualChanges($data);
                    $this->sendResponse($result);
                } elseif ($action === 'batch-save') {
                    // Handle batch saves
                    $result = $this->contentManager->batchSaveContent($data);
                    $this->sendResponse($result);
                } elseif ($action === 'auto-save') {
                    // Handle auto-save
                    $result = $this->contentManager->autoSaveContent($data);
                    $this->sendResponse($result);
                } else {
                    // Create new content item
                    $itemId = $this->contentManager->createContentItem($data);
                    $this->sendResponse(['id' => $itemId, 'message' => 'Content created successfully']);
                }
                break;
            case 'PUT':
                if ($action === 'item' && $id) {
                    $data = $this->getJsonInput();
                    $this->contentManager->updateContentItem($id, $data);
                    $this->sendResponse(['message' => 'Content updated successfully']);
                } else {
                    $this->sendError('Invalid content update request', 400);
                }
                break;
            case 'DELETE':
                if ($action === 'item' && $id) {
                    $this->contentManager->deleteContentItem($id);
                    $this->sendResponse(['message' => 'Content deleted successfully']);
                } else {
                    $this->sendError('Invalid content delete request', 400);
                }
                break;
            default:
                $this->sendError('Method not allowed', 405);
        }
    }
    
    private function handleMedia($method, $action, $id) {
        switch ($method) {
            case 'GET':
                if ($id) {
                    // Get specific media item
                    $media = $this->mediaManager->getMediaItem($id);
                    $this->sendResponse($media);
                } else {
                    // Get all media
                    $media = $this->mediaManager->getAllMedia();
                    $this->sendResponse($media);
                }
                break;
            case 'POST':
                if ($action === 'upload') {
                    // Handle file uploads
                    $result = $this->mediaManager->handleUpload();
                    $this->sendResponse($result);
                } else {
                    $this->sendError('Invalid media request', 400);
                }
                break;
            case 'PUT':
                if ($id) {
                    $data = $this->getJsonInput();
                    $this->mediaManager->updateMediaItem($id, $data);
                    $this->sendResponse(['message' => 'Media updated successfully']);
                } else {
                    $this->sendError('Invalid media update request', 400);
                }
                break;
            case 'DELETE':
                if ($id) {
                    $this->mediaManager->deleteMediaItem($id);
                    $this->sendResponse(['message' => 'Media deleted successfully']);
                } else {
                    $this->sendError('Invalid media delete request', 400);
                }
                break;
            default:
                $this->sendError('Method not allowed', 405);
        }
    }
    
    private function handleActivity($method, $action, $id) {
        if ($method === 'GET') {
            if ($action === 'recent') {
                $activities = $this->contentManager->getRecentActivity();
                $this->sendResponse($activities);
            } else {
                $this->sendError('Invalid activity request', 400);
            }
        } else {
            $this->sendError('Method not allowed', 405);
        }
    }
    
    private function handleUsers($method, $action, $id) {
        switch ($method) {
            case 'GET':
                if ($action === 'current') {
                    $user = $this->userManager->getCurrentUser();
                    $this->sendResponse($user);
                } else {
                    // Require authentication for user management
                    $this->requireAuth();
                    $users = $this->userManager->getAllUsers();
                    $this->sendResponse($users);
                }
                break;
            case 'POST':
                if ($action === 'login') {
                    $data = $this->getJsonInput();
                    $result = $this->userManager->login($data['username'], $data['password']);
                    $this->sendResponse($result);
                } elseif ($action === 'create') {
                    $this->requireAuth();
                    $data = $this->getJsonInput();
                    $userId = $this->userManager->createUser($data);
                    $this->sendResponse(['id' => $userId, 'message' => 'User created successfully']);
                }
                break;
            default:
                $this->sendError('Method not allowed', 405);
        }
    }
    
    private function handleBackup($method, $action, $id) {
        $this->requireAuth();
        
        switch ($method) {
            case 'GET':
                if ($action === 'create') {
                    $backup = $this->contentManager->createBackup();
                    $this->sendResponse($backup);
                } elseif ($action === 'list') {
                    $backups = $this->contentManager->getBackups();
                    $this->sendResponse($backups);
                } else {
                    $this->sendError('Invalid backup request', 400);
                }
                break;
            case 'POST':
                if ($action === 'restore' && $id) {
                    $result = $this->contentManager->restoreBackup($id);
                    $this->sendResponse($result);
                } else {
                    $this->sendError('Invalid restore request', 400);
                }
                break;
            default:
                $this->sendError('Method not allowed', 405);
        }
    }
    
    private function requireAuth() {
        // Simple authentication check - implement proper JWT/session handling
        $headers = getallheaders();
        $authHeader = $headers['Authorization'] ?? '';
        
        if (!$authHeader || !$this->userManager->validateAuth($authHeader)) {
            $this->sendError('Authentication required', 401);
        }
    }
    
    private function getJsonInput() {
        $input = file_get_contents('php://input');
        $data = json_decode($input, true);
        
        if (json_last_error() !== JSON_ERROR_NONE) {
            $this->sendError('Invalid JSON input', 400);
        }
        
        return $data;
    }
    
    private function sendResponse($data, $code = 200) {
        http_response_code($code);
        echo json_encode([
            'success' => true,
            'data' => $data,
            'timestamp' => time()
        ]);
        exit;
    }
    
    private function sendError($message, $code = 400) {
        http_response_code($code);
        echo json_encode([
            'success' => false,
            'error' => $message,
            'code' => $code,
            'timestamp' => time()
        ]);
        exit;
    }
}

// Initialize and handle the API request
$api = new CMSApi();
$api->handleRequest();
?>