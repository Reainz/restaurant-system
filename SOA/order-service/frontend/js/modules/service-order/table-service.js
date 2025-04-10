// Table Service module for service-order.js
// Access config via window object
// import { API_CONFIG } from '../../config.js';
import { showNotification } from '../../utils/notifications.js';

// State
let tables = [];

/**
 * Load table numbers from the Table & Bill service
 * @returns {Promise<Array>} - The loaded tables
 */
async function loadTableNumbers() {
    try {
        // Use window.API_CONFIG and correct endpoint path
        const url = `${window.API_CONFIG.TABLE_BILL_SERVICE_URL}/api/${window.API_CONFIG.ENDPOINTS.TABLES}`;
        console.log('Fetching tables from API:', url);
        
        const response = await fetch(url, {
            method: 'GET',
            headers: window.API_CONFIG.DEFAULT_HEADERS // Use global config
        });
        
        if (!response.ok) {
            throw new Error(`Failed to load tables: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Tables data received:', data);
        
        if (!data || !Array.isArray(data.tables)) {
            console.error('Invalid data format received:', data);
            throw new Error('Invalid response format from server');
        }
        
        tables = data.tables || [];
        console.log(`Successfully loaded ${tables.length} tables`);
        
        return tables;
    } catch (error) {
        console.error('Error loading tables:', error);
        showNotification('Could not load table information. Some features may be limited.', 'warning');
        throw error;
    }
}

/**
 * Get a table by ID
 * @param {string} tableId - The table ID to get
 * @returns {Object|null} - The table or null if not found
 */
function getTableById(tableId) {
    return tables.find(table => table.table_id === tableId) || null;
}

/**
 * Update table status
 * @param {string} tableId - The table ID to update
 * @param {string} status - The new status
 * @returns {Promise<Object>} - The updated table
 */
async function updateTableStatus(tableId, status) {
    try {
        // Use window.API_CONFIG
        const response = await fetch(`${window.API_CONFIG.TABLE_BILL_SERVICE_URL}/api/${window.API_CONFIG.ENDPOINTS.TABLES}/${tableId}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ status })
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || `Failed to update table status: ${response.status}`);
        }
        
        const updatedTable = await response.json();
        
        // Update table in the local array
        const index = tables.findIndex(table => table.table_id === tableId);
        if (index !== -1) {
            tables[index] = updatedTable;
        }
        
        return updatedTable;
    } catch (error) {
        console.error('Error updating table status:', error);
        showNotification(`Error updating table status: ${error.message}`, 'error');
        throw error;
    }
}

/**
 * Generate a bill for an order
 * @param {string} orderId - The order ID to generate a bill for
 * @returns {Promise<Object>} - The generated bill
 */
async function generateBill(orderId) {
    try {
        // Use window.API_CONFIG
        const response = await fetch(`${window.API_CONFIG.TABLE_BILL_SERVICE_URL}/api/${window.API_CONFIG.ENDPOINTS.BILLS}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ order_id: orderId })
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || `Failed to generate bill: ${response.status}`);
        }
        
        const bill = await response.json();
        return bill;
    } catch (error) {
        console.error('Error generating bill:', error);
        showNotification(`Error generating bill: ${error.message}`, 'error');
        throw error;
    }
}

/**
 * Get all bills for a table
 * @param {string} tableId - The table ID to get bills for
 * @returns {Promise<Array>} - The bills for the table
 */
async function getTableBills(tableId) {
    try {
        // Use window.API_CONFIG
        const response = await fetch(`${window.API_CONFIG.TABLE_BILL_SERVICE_URL}/api/${window.API_CONFIG.ENDPOINTS.BILLS}/table/${tableId}`, {
            method: 'GET',
            headers: window.API_CONFIG.DEFAULT_HEADERS // Use global config
        });
        
        if (!response.ok) {
            throw new Error(`Failed to get table bills: ${response.status}`);
        }
        
        const data = await response.json();
        return data.bills || [];
    } catch (error) {
        console.error('Error getting table bills:', error);
        showNotification(`Error getting table bills: ${error.message}`, 'error');
        throw error;
    }
}

/**
 * Get all tables
 * @returns {Array} - All tables
 */
function getAllTables() {
    return tables;
}

/**
 * Get available tables (those with status 'available')
 * @returns {Array} - Available tables
 */
function getAvailableTables() {
    return tables.filter(table => table.status === 'available');
}

/**
 * Get occupied tables (those with status 'occupied')
 * @returns {Array} - Occupied tables
 */
function getOccupiedTables() {
    return tables.filter(table => table.status === 'occupied');
}

// Export functions and state
export {
    loadTableNumbers,
    getTableById,
    updateTableStatus,
    generateBill,
    getTableBills,
    getAllTables,
    getAvailableTables,
    getOccupiedTables
}; 