/**
 * API Configuration
 * 
 * This file contains the configuration for the API endpoints used in the restaurant management system.
 * You can modify these settings based on your environment.
 */

// Access the API_CONFIG from the global window object
// No import needed since config.js is loaded first in the HTML

// Extend the API_CONFIG
if (window.API_CONFIG) {
    // Debug mode to log API calls
    window.API_CONFIG.DEBUG = true;
    
    // External service URLs (override if needed)
    window.API_CONFIG.MENU_SERVICE_URL = 'http://localhost:8000';
    window.API_CONFIG.TABLE_BILL_SERVICE_URL = 'http://localhost:8003';
    
    // Default headers for all requests
    window.API_CONFIG.DEFAULT_HEADERS = {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    };
    
    // Helper function to get the current table ID from URL
    window.API_CONFIG.getTableId = function() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('table_id') || urlParams.get('table') || '1';
    };
    
    // Helper function to get the current order ID from URL
    window.API_CONFIG.getOrderId = function() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('order_id');
    };
} else {
    console.error('API_CONFIG not found. Make sure config.js is loaded before api-config.js');
    window.API_CONFIG = {
            BASE_URL: 'http://localhost:8002/api',
            DEBUG: true,
            MENU_SERVICE_URL: 'http://localhost:8000',
            TABLE_BILL_SERVICE_URL: 'http://localhost:8003',
        DEFAULT_HEADERS: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }
    };
}

// Log configuration if debug mode is enabled
if (window.API_CONFIG.DEBUG) {
    console.log('API Configuration:', window.API_CONFIG);
}

// Helper function to normalize API endpoints
function normalizeEndpoint(endpoint) {
    // Remove /api/ prefix if present and any leading slash
    endpoint = endpoint.replace(/^\/?api\//, '');
    // Remove any trailing slashes
    endpoint = endpoint.replace(/\/*$/, '');
    return endpoint;
}

// Build API URL function
function buildApiUrl(endpoint, params = {}, service = null) {
    // Normalize the endpoint to remove any existing /api/ prefix
    const normalizedEndpoint = normalizeEndpoint(endpoint);
    
    let baseUrl;
    
    // Determine the base URL based on the service
    if (service === 'menu') {
        baseUrl = window.API_CONFIG.MENU_SERVICE_URL;
    } else if (service === 'table-bill') {
        baseUrl = window.API_CONFIG.TABLE_BILL_SERVICE_URL;
    } else {
        baseUrl = window.API_CONFIG.BASE_URL;
    }
    
    // Build URL without doubling the api path
    // This is the key fix - we're no longer adding '/api/' in this function
    const url = new URL(`${baseUrl}${normalizedEndpoint.startsWith('/') ? '' : '/'}${normalizedEndpoint}`, window.location.origin);
    
    // Add URL parameters
    if (params) {
        Object.keys(params).forEach(key => {
            if (params[key] !== undefined && params[key] !== null) {
                url.searchParams.append(key, params[key]);
            }
        });
    }
    
    if (window.API_CONFIG.DEBUG) {
        console.log('Built URL:', url.toString());
    }
    
    return url.toString();
}

// API Request function
async function apiRequest(endpoint, options = {}, service = null) {
    try {
        // Construct the URL
        const url = buildApiUrl(endpoint, options.params || {}, service);
        
        // Remove params from options as they're already in the URL
        const { params, ...fetchOptions } = options;
        
        const finalOptions = {
            method: options.method || 'GET',
            headers: {
                ...window.API_CONFIG.DEFAULT_HEADERS,
                ...(options.headers || {})
            },
            ...fetchOptions
        };
        
        if (window.API_CONFIG.DEBUG) {
            console.log('API Request:', {
                url,
                options: finalOptions
            });
        }
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), window.API_CONFIG.TIMEOUT);
        
        const response = await fetch(url, {
            ...finalOptions,
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || errorData.message || `API request failed with status ${response.status}`);
        }
        
        // For DELETE requests that don't return content
        if (response.status === 204) {
            return { success: true };
        }
        
        const data = await response.json();
        
        if (window.API_CONFIG.DEBUG) {
            console.log('API Response:', data);
        }
        
        return data;
    } catch (error) {
        if (error.name === 'AbortError') {
            throw new Error(`Request timeout after ${window.API_CONFIG.TIMEOUT}ms`);
        }
        
        // Enhanced error handling for service unavailability
        if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
            const serviceName = service === 'menu' ? 'Menu Service' : 
                                service === 'table-bill' ? 'Table & Bill Service' : 
                                'Order Service';
            console.error(`${serviceName} is unavailable: ${error.message}`);
            throw new Error(`${serviceName} is currently unavailable. Please try again later.`);
        }
        
        console.error('API request error:', error);
        throw error;
    }
}

// Make functions available globally
window.normalizeEndpoint = normalizeEndpoint;
window.buildApiUrl = buildApiUrl;
window.apiRequest = apiRequest;