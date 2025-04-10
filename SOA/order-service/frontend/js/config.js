/**
 * Global Configuration
 * 
 * This file contains global configuration variables used across the application.
 */

// Define API_CONFIG as a global variable
var API_CONFIG = {
    // Base URL for API requests - must include /api for backend routing
    BASE_URL: '/api',
    
    // External service URLs
    MENU_SERVICE_URL: 'http://localhost:8001',
    TABLE_BILL_SERVICE_URL: 'http://localhost:8003',
    
    // API Endpoints - these should NOT include /api prefix
    ENDPOINTS: {
        // Orders
        ORDERS: 'orders',
        
        // Menu Items
        MENU_ITEMS: 'menu-items',
        
        // Tables
        TABLES: 'tables',

        // Bills (Added)
        BILLS: 'bills'
    },
    
    // Default timeout
    TIMEOUT: 30000
};

// Assign to window to ensure global access
window.API_CONFIG = API_CONFIG;

// Configuration for the local environment
const CONFIG = {
    // Application name
    APP_NAME: 'Restaurant Management System',
    
    // Default pagination settings
    PAGINATION: {
        ITEMS_PER_PAGE: 10,
        MAX_PAGES_SHOWN: 5
    },
    
    // Default notification settings
    NOTIFICATION: {
        AUTO_DISMISS: true,
        DISMISS_TIMEOUT: 5000 // 5 seconds
    },
    
    // Debug mode flag
    DEBUG: true,
    
    // Theme settings
    THEME: {
        COLOR_SCHEME: 'light',
        PRIMARY_COLOR: '#4F46E5'
    }
};

// Assign CONFIG to window as well for consistency
window.CONFIG = CONFIG;