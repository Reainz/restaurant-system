/**
 * Table Management API Functions
 */

// Constants
const TABLES_ENDPOINT = '/api/tables';
const BILLS_ENDPOINT = '/api/bills';
const ORDERS_ENDPOINT = '/api/orders';

/**
 * Fetches tables from the API with retry logic
 * @returns {Promise<Array>} List of tables
 */
async function fetchTables() {
    let retryCount = 0;
    const maxRetries = 3;
    
    while (retryCount < maxRetries) {
        try {
            const response = await fetch(TABLES_ENDPOINT);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            return data.tables || [];
        } catch (error) {
            retryCount++;
            if (retryCount < maxRetries) {
                console.log(`Retrying tables fetch (${retryCount}/${maxRetries})...`);
                await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
            } else {
                throw new Error(`Failed to fetch tables after ${maxRetries} attempts`);
            }
        }
    }
    
    return [];
}

/**
 * Fetches bills for a specific table
 * @param {string} tableId - Table ID
 * @returns {Promise<Array>} List of bills
 */
async function fetchBillsForTable(tableId) {
    try {
        const response = await fetch(`${BILLS_ENDPOINT}?table_id=${tableId}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const billsData = await response.json();
        return billsData.bills || [];
    } catch (error) {
        console.error(`Error fetching bills for table ${tableId}:`, error);
        return [];
    }
}

/**
 * Updates a table's status
 * @param {string} tableId - Table ID
 * @param {string} status - New status
 * @returns {Promise<Object>} Updated table
 */
async function updateTableStatus(tableId, status) {
    try {
        const response = await fetch(`${TABLES_ENDPOINT}/${tableId}/status?status=${status}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error(`Error updating table status:`, error);
        throw error;
    }
}

/**
 * Creates a new table
 * @param {Object} tableData - Table data
 * @returns {Promise<Object>} Created table
 */
async function createTable(tableData) {
    try {
        const response = await fetch(TABLES_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(tableData)
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('Error creating table:', error);
        throw error;
    }
}

/**
 * Assigns a table to an order
 * @param {string} tableId - Table ID
 * @param {string} orderId - Order ID
 * @returns {Promise<Object>} Updated table
 */
async function assignTable(tableId, orderId, status = 'occupied') {
    try {
        const response = await fetch(`${TABLES_ENDPOINT}/assign`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                table_id: tableId,
                order_id: orderId,
                status: status
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('Error assigning table:', error);
        throw error;
    }
}

/**
 * Creates a new bill
 * @param {string} tableId - Table ID
 * @param {string} orderId - Order ID
 * @returns {Promise<Object>} Created bill
 */
async function createBill(tableId, orderId) {
    try {
        // Create a bill with the provided table ID and order ID
        const response = await fetch(BILLS_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                table_id: tableId,
                order_id: orderId
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || `Failed to create bill: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('Error creating bill:', error);
        throw error;
    }
}

/**
 * Fetches orders for a table
 * @param {string} tableId - Table ID
 * @returns {Promise<Array>} List of orders
 */
async function fetchOrdersForTable(tableId) {
    try {
        // Check if orders service is available
        const orderServiceUrl = window.API_CONFIG ? window.API_CONFIG.ORDER_SERVICE_URL : 'http://localhost:8002';
        const response = await fetch(`${orderServiceUrl}/api/orders?table_id=${tableId}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const ordersData = await response.json();
        return ordersData.orders || [];
    } catch (error) {
        console.error(`Error fetching orders for table ${tableId}:`, error);
        return [];
    }
}

// Export functions for use in other modules
export {
    fetchTables,
    fetchBillsForTable,
    updateTableStatus,
    createTable,
    assignTable,
    createBill,
    fetchOrdersForTable
}; 