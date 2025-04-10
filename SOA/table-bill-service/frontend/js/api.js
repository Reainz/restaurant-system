/**
 * API Service for Table & Bill Management
 * Provides centralized API communication for the frontend
 */

// API Configuration
const API_CONFIG = {
    BASE_URL: 'http://localhost:8003/api',
    ORDER_SERVICE_URL: 'http://localhost:8002',
    MENU_SERVICE_URL: 'http://localhost:8000',
    DEFAULT_HEADERS: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    },
    TIMEOUT: 30000,
    RETRY_COUNT: 2,
    RETRY_DELAY: 1000
};

// Make API_CONFIG globally available
window.API_CONFIG = API_CONFIG;

/**
 * Helper function to build a full API URL
 * @param {string} endpoint - API endpoint
 * @param {Object} params - URL parameters
 * @param {string} service - Optional service name ('order', 'menu', or default for table-bill service)
 * @returns {string} - Full API URL
 */
function buildApiUrl(endpoint, params = {}, service = null) {
    let baseUrl;
    
    // Determine the base URL based on the service
    if (service === 'order') {
        baseUrl = `${API_CONFIG.ORDER_SERVICE_URL}/api`;
    } else if (service === 'menu') {
        baseUrl = `${API_CONFIG.MENU_SERVICE_URL}/api`;
    } else {
        baseUrl = API_CONFIG.BASE_URL;
    }
    
    // Create the full URL
    let url;
    if (service === 'order' || service === 'menu') {
        // For external services, we need the full URL
        url = new URL(`${baseUrl}${endpoint}`);
    } else {
        // For our own service, we can use a relative URL
        url = new URL(`${baseUrl}${endpoint}`, window.location.origin);
    }
    
    // Add URL parameters
    Object.keys(params).forEach(key => {
        if (params[key] !== undefined && params[key] !== null) {
            url.searchParams.append(key, params[key]);
        }
    });
    
    return url.toString();
}

/**
 * Sleep function for delays between retries
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise} - Promise that resolves after the delay
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Enhanced API request function with retry capability
 * @param {string} url - The API URL to call
 * @param {Object} options - Fetch options
 * @param {string} serviceType - Optional service type for logging
 * @param {number} retryCount - Number of retries left
 * @returns {Promise} - Promise with the API response
 */
async function enhancedFetch(url, options, serviceType = 'table-bill', retryCount = API_CONFIG.RETRY_COUNT) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.TIMEOUT);
    
    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        // Handle response based on status
        if (response.ok) {
            // For DELETE requests that don't return content
            if (response.status === 204) {
                return { success: true };
            }
            
            return await response.json();
        }
        
        // Handle specific error status codes
        const errorBody = await response.text();
        let errorData;
        try {
            errorData = JSON.parse(errorBody);
        } catch (e) {
            errorData = { detail: errorBody };
        }
        
        // For 404 errors, don't retry
        if (response.status === 404) {
            throw new Error(errorData.detail || `Resource not found: ${response.url}`);
        }
        
        // For other client errors, don't retry
        if (response.status >= 400 && response.status < 500) {
            throw new Error(errorData.detail || `Client error: ${response.status}`);
        }
        
        // For server errors, retry if we have retries left
        if (retryCount > 0) {
            console.warn(`${serviceType} service error (${response.status}), retrying... (${retryCount} attempts left)`);
            await sleep(API_CONFIG.RETRY_DELAY);
            return enhancedFetch(url, options, serviceType, retryCount - 1);
        }
        
        // No more retries, throw the error
        throw new Error(errorData.detail || `Service error: ${response.status}`);
    } catch (error) {
        clearTimeout(timeoutId);
        
        // Handle timeout error
        if (error.name === 'AbortError') {
            if (retryCount > 0) {
                console.warn(`${serviceType} service request timed out, retrying... (${retryCount} attempts left)`);
                await sleep(API_CONFIG.RETRY_DELAY);
                return enhancedFetch(url, options, serviceType, retryCount - 1);
            }
            throw new Error(`Request timeout after ${API_CONFIG.TIMEOUT}ms`);
        }
        
        // Handle network errors with retry
        if (error.message.includes('NetworkError') || error.message.includes('network error')) {
            if (retryCount > 0) {
                console.warn(`${serviceType} service network error, retrying... (${retryCount} attempts left)`);
                await sleep(API_CONFIG.RETRY_DELAY);
                return enhancedFetch(url, options, serviceType, retryCount - 1);
            }
        }
        
        // Other errors just get thrown
        throw error;
    }
}

/**
 * API class to handle all API requests
 */
class TableBillAPI {
    /**
     * Get all tables
     * @returns {Promise} Promise with the API response
     */
    static async getTables() {
        return this.get('/tables');
    }
    
    /**
     * Get a specific table by ID
     * @param {string} tableId - The ID of the table
     * @returns {Promise} Promise with the API response
     */
    static async getTable(tableId) {
        return this.get(`/tables/${tableId}`);
    }
    
    /**
     * Update table status
     * @param {string} tableId - The ID of the table
     * @param {string} status - The new status
     * @returns {Promise} Promise with the API response
     */
    static async updateTableStatus(tableId, status) {
        return this.put(`/tables/${tableId}/status`, { status });
    }
    
    /**
     * Create a new table
     * @param {Object} tableData - The table data
     * @returns {Promise} Promise with the API response
     */
    static async createTable(tableData) {
        return this.post('/tables', tableData);
    }
    
    /**
     * Get all bills
     * @param {Object} filters - Optional filters (table_id, date, status, payment_status)
     * @param {boolean} autoRefresh - Whether to refresh bill data from external services
     * @returns {Promise} Promise with the API response
     */
    static async getBills(filters = {}, autoRefresh = true) {
        const queryParams = new URLSearchParams();
        
        if (filters.tableId) queryParams.append('table_id', filters.tableId);
        if (filters.date) queryParams.append('date', filters.date);
        if (filters.status) queryParams.append('status', filters.status);
        if (filters.paymentStatus) queryParams.append('payment_status', filters.paymentStatus);
        queryParams.append('auto_refresh', autoRefresh);
        
        const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';
        return this.get(`/bills${queryString}`);
    }
    
    /**
     * Get a specific bill by ID
     * @param {string} billId - The ID of the bill
     * @param {boolean} autoRefresh - Whether to refresh bill data from external services
     * @returns {Promise} Promise with the API response
     */
    static async getBill(billId, autoRefresh = true) {
        return this.get(`/bills/${billId}?auto_refresh=${autoRefresh}`);
    }
    
    /**
     * Get bills for a specific table
     * @param {string} tableId - The ID of the table
     * @param {boolean} autoRefresh - Whether to refresh bill data from external services
     * @returns {Promise} Promise with the API response
     */
    static async getTableBills(tableId, autoRefresh = true) {
        return this.get(`/bills/table/${tableId}?auto_refresh=${autoRefresh}`);
    }
    
    /**
     * Create a new bill
     * @param {Object} billData - The bill data
     * @returns {Promise} Promise with the API response
     */
    static async createBill(billData) {
        return this.post('/bills', billData);
    }
    
    /**
     * Update bill
     * @param {string} billId - The ID of the bill
     * @param {Object} billData - The updated bill data
     * @returns {Promise} Promise with the API response
     */
    static async updateBill(billId, billData) {
        return this.put(`/bills/${billId}`, billData);
    }
    
    /**
     * Update bill status
     * @param {string} billId - The ID of the bill
     * @param {string} status - The new status
     * @returns {Promise} Promise with the API response
     */
    static async updateBillStatus(billId, status) {
        return this.put(`/bills/${billId}/status`, { status });
    }
    
    /**
     * Update bill payment status
     * @param {string} billId - The ID of the bill
     * @param {string} paymentStatus - The new payment status
     * @returns {Promise} Promise with the API response
     */
    static async updatePaymentStatus(billId, paymentStatus) {
        // Construct URL with payment_status as a query parameter
        const endpoint = `/bills/${billId}/payment-status`;
        const params = { payment_status: paymentStatus };
        const url = buildApiUrl(endpoint, params); // Use buildApiUrl to add query param
        
        // Call enhancedFetch directly for PUT request with NO body
        return enhancedFetch(url, {
            method: 'PUT',
            headers: API_CONFIG.DEFAULT_HEADERS,
            // No body should be sent for this request
        }, 'table-bill');
    }
    
    /**
     * Get order details for bill generation (from Order Service)
     * @param {string} orderId - The ID of the order
     * @returns {Promise} Promise with the API response
     */
    static async getOrderDetails(orderId) {
        return this.get(`/orders/${orderId}`, {}, 'order');
    }
    
    /**
     * Get menu item details (from Menu Service)
     * @param {string} itemId - The ID of the menu item
     * @returns {Promise} Promise with the API response
     */
    static async getMenuItem(itemId) {
        return this.get(`/menu-items/${itemId}`, {}, 'menu');
    }
    
    /**
     * Get menu item details for bill generation (from Menu Service)
     * @param {string} itemId - The ID of the menu item
     * @returns {Promise} Promise with the API response
     */
    static async getMenuItemDetails(itemId) {
        return this.get(`/menu-items/${itemId}`, {}, 'menu');
    }
    
    /**
     * Refresh a bill to get latest data from other services
     * @param {string} billId - Bill ID
     * @returns {Promise<Object>} - Updated bill object
     */
    static async refreshBill(billId) {
        try {
            const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.BILLS}/${billId}/refresh`, {
                method: 'POST'
            });
            
            if (!response.ok) {
                throw new Error(`Failed to refresh bill: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            throw new Error(`Error refreshing bill: ${error.message}`);
        }
    }
    
    /**
     * Make a GET request
     * @param {string} endpoint - API endpoint
     * @param {Object} params - URL parameters
     * @param {string} service - Optional service name ('order', 'menu', or default for table-bill service)
     * @returns {Promise} Promise with the API response
     */
    static async get(endpoint, params = {}, service = null) {
        const url = buildApiUrl(endpoint, params, service);
        const serviceType = service || 'table-bill';
        
        return enhancedFetch(url, {
            method: 'GET',
            headers: API_CONFIG.DEFAULT_HEADERS
        }, serviceType);
    }
    
    /**
     * Make a POST request
     * @param {string} endpoint - API endpoint
     * @param {Object} data - Request body data
     * @param {string} service - Optional service name ('order', 'menu', or default for table-bill service)
     * @returns {Promise} Promise with the API response
     */
    static async post(endpoint, data, service = null) {
        const url = buildApiUrl(endpoint, {}, service);
        const serviceType = service || 'table-bill';
        
        return enhancedFetch(url, {
            method: 'POST',
            headers: API_CONFIG.DEFAULT_HEADERS,
            body: JSON.stringify(data)
        }, serviceType);
    }
    
    /**
     * Make a PUT request
     * @param {string} endpoint - API endpoint
     * @param {Object} data - Request body data
     * @param {string} service - Optional service name ('order', 'menu', or default for table-bill service)
     * @returns {Promise} Promise with the API response
     */
    static async put(endpoint, data, service = null) {
        const url = buildApiUrl(endpoint, {}, service);
        const serviceType = service || 'table-bill';
        
        return enhancedFetch(url, {
            method: 'PUT',
            headers: API_CONFIG.DEFAULT_HEADERS,
            body: JSON.stringify(data)
        }, serviceType);
    }
    
    /**
     * Make a DELETE request
     * @param {string} endpoint - API endpoint
     * @param {string} service - Optional service name ('order', 'menu', or default for table-bill service)
     * @returns {Promise} Promise with the API response
     */
    static async delete(endpoint, service = null) {
        const url = buildApiUrl(endpoint, {}, service);
        const serviceType = service || 'table-bill';
        
        return enhancedFetch(url, {
            method: 'DELETE',
            headers: API_CONFIG.DEFAULT_HEADERS
        }, serviceType);
    }
    
    /**
     * Helper function to get the current table ID from URL
     * @returns {string} Table ID from URL or default
     */
    static getTableId() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('table_id') || urlParams.get('table') || '1';
    }
    
    /**
     * Check health of all services
     * Returns health status of table-bill, order, and menu services
     * @returns {Promise} Promise with health check results
     */
    static async checkServicesHealth() {
        try {
            const results = {
                tableBillService: { status: 'unknown' },
                orderService: { status: 'unknown' },
                menuService: { status: 'unknown' }
            };
            
            // Check table-bill service health
            try {
                results.tableBillService = await this.get('/health');
            } catch (e) {
                results.tableBillService = { 
                    status: 'error', 
                    error: e.message 
                };
            }
            
            // Check order service health
            try {
                results.orderService = await this.get('/health', {}, 'order');
            } catch (e) {
                results.orderService = { 
                    status: 'error', 
                    error: e.message 
                };
            }
            
            // Check menu service health
            try {
                results.menuService = await this.get('/health', {}, 'menu');
            } catch (e) {
                results.menuService = { 
                    status: 'error', 
                    error: e.message 
                };
            }
            
            return results;
        } catch (e) {
            console.error('Error checking services health:', e);
            throw e;
        }
    }
}

// Export the API service
window.TableBillAPI = TableBillAPI; 