// Order Service module for service-order.js
// Access config via window object
// import { API_CONFIG } from '../../config.js';
import { showNotification } from '../../utils/notifications.js';

// State
let orders = []; // Module-level state variable
let selectedOrder = null;

/**
 * Load all orders from the backend
 * @param {Object} filters - Optional filters (status, table_id, etc.)
 * @returns {Promise<Array>} - The loaded orders
 */
async function loadOrders(filters = {}) {
    try {
        const params = new URLSearchParams();
        
        // Add filters to URL params
        Object.keys(filters).forEach(key => {
            if (filters[key]) {
                params.append(key, filters[key]);
            }
        });
        
        // Build URL with optional query parameters - Use window.API_CONFIG
        const url = `${window.API_CONFIG.BASE_URL}/${window.API_CONFIG.ENDPOINTS.ORDERS}${params.toString() ? `?${params.toString()}` : ''}`;
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`Failed to fetch orders: ${response.status}`);
        }
        
        const data = await response.json();
        // Update the module-level orders array directly
        orders = data.orders || []; 
        console.log(`[order-service] Loaded ${orders.length} orders into state.`); // Added log
        
        // Return the loaded orders (optional, depends if caller uses return value)
        return orders; 
    } catch (error) {
        showNotification(`Error loading orders: ${error.message}`, 'error');
        orders = []; // Reset state on error
        return [];
    }
}

/**
 * Get order by ID
 * @param {string} orderId - The order ID to get
 * @returns {Object|null} - The order or null if not found
 */
function getOrderById(orderId) {
    return orders.find(order => order.order_id === orderId) || null;
}

/**
 * Create a new order
 * @param {Object} orderData - The order data
 * @returns {Promise<Object>} - The created order
 */
async function createOrder(orderData) {
    try {
        // Use window.API_CONFIG
        const response = await fetch(`${window.API_CONFIG.BASE_URL}/${window.API_CONFIG.ENDPOINTS.ORDERS}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(orderData)
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || `Failed to create order: ${response.status}`);
        }
        
        const newOrder = await response.json();
        orders.unshift(newOrder); // Add to beginning of orders array
        return newOrder;
    } catch (error) {
        console.error('Error creating order:', error);
        showNotification(`Error creating order: ${error.message}`, 'error');
        throw error;
    }
}

/**
 * Update order status
 * @param {string} orderId - The order ID to update
 * @param {string} status - The new status
 * @returns {Promise<Object>} - The updated order
 */
async function updateOrderStatus(orderId, status) {
    try {
        // Use window.API_CONFIG
        const response = await fetch(`${window.API_CONFIG.BASE_URL}/${window.API_CONFIG.ENDPOINTS.ORDERS}/${orderId}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ status })
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || `Failed to update order status: ${response.status}`);
        }
        
        const updatedOrder = await response.json();
        
        // Update order in the local array
        const index = orders.findIndex(order => order.order_id === orderId);
        if (index !== -1) {
            orders[index] = updatedOrder;
        }
        
        // If this is the selected order, update it
        if (selectedOrder && selectedOrder.order_id === orderId) {
            selectedOrder = updatedOrder;
        }
        
        return updatedOrder;
    } catch (error) {
        console.error('Error updating order status:', error);
        showNotification(`Error updating order status: ${error.message}`, 'error');
        throw error;
    }
}

/**
 * Cancel an order
 * @param {string} orderId - The order ID to cancel
 * @returns {Promise<Object>} - The cancelled order
 */
async function cancelOrder(orderId) {
    return updateOrderStatus(orderId, 'cancelled');
}

/**
 * Mark an order as delivered
 * @param {string} orderId - The order ID to mark as delivered
 * @returns {Promise<Object>} - The updated order
 */
async function markOrderDelivered(orderId) {
    return updateOrderStatus(orderId, 'delivered');
}

/**
 * Complete an order
 * @param {string} orderId - The order ID to complete
 * @returns {Promise<Object>} - The completed order
 */
async function completeOrder(orderId) {
    return updateOrderStatus(orderId, 'completed');
}

/**
 * Set the selected order
 * @param {Object} order - The order to select
 */
function setSelectedOrder(order) {
    selectedOrder = order;
}

/**
 * Get the current selected order
 * @returns {Object|null} - The selected order or null
 */
function getSelectedOrder() {
    return selectedOrder;
}

/**
 * Get all orders
 * @returns {Array} - All orders
 */
function getAllOrders() {
    return orders;
}

/**
 * Generate a report of orders
 * @param {Object} filters - Optional filter parameters
 * @returns {Object} - Report data
 */
function generateOrderReport(filters = {}) {
    let filteredOrders = [...orders];
    
    // Apply filters if provided
    if (filters.status) {
        filteredOrders = filteredOrders.filter(order => order.status === filters.status);
    }
    if (filters.tableId) {
        filteredOrders = filteredOrders.filter(order => order.table_id === filters.tableId);
    }
    
    // Calculate statistics
    const totalOrders = filteredOrders.length;
    let totalRevenue = 0;
    
    filteredOrders.forEach(order => {
        order.items.forEach(item => {
            totalRevenue += (item.price * item.quantity);
        });
    });
    
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    
    // Count by status
    const statusCounts = {
        received: 0,
        'in-progress': 0,
        ready: 0,
        delivered: 0,
        completed: 0,
        cancelled: 0
    };
    
    filteredOrders.forEach(order => {
        if (statusCounts.hasOwnProperty(order.status)) {
            statusCounts[order.status]++;
        }
    });
    
    return {
        totalOrders,
        totalRevenue,
        avgOrderValue,
        statusCounts,
        orders: filteredOrders
    };
}

/**
 * Export orders to CSV format
 * @param {Array} ordersToExport - The orders to export
 * @returns {string} - CSV content
 */
function exportOrdersToCSV(ordersToExport = orders) {
    const headers = [
        'Order ID',
        'Table',
        'Status',
        'Created At',
        'Updated At',
        'Items',
        'Total',
        'Special Instructions'
    ];
    
    const rows = ordersToExport.map(order => {
        let total = 0;
        const itemsList = order.items.map(item => {
            const itemTotal = item.price * item.quantity;
            total += itemTotal;
            return `${item.name} (${item.quantity}): ₫${itemTotal.toLocaleString()}`;
        }).join('; ');
        
        return [
            order.order_id,
            order.table_id,
            order.status,
            new Date(order.created_at).toLocaleString(),
            new Date(order.updated_at).toLocaleString(),
            itemsList,
            `₫${total.toLocaleString()}`,
            order.special_instructions || ''
        ];
    });
    
    // Combine headers and rows
    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    return csvContent;
}

// Export functions and state
export {
    loadOrders,
    getOrderById,
    createOrder,
    updateOrderStatus,
    cancelOrder,
    markOrderDelivered,
    completeOrder,
    setSelectedOrder,
    getSelectedOrder,
    getAllOrders,
    generateOrderReport,
    exportOrdersToCSV
}; 