// Order service module for customer-order.js
import { apiRequest } from '../../utils/api.js';
import { showNotification } from '../../utils/notifications.js';

// State management
let allOrders = [];
let selectedOrder = null;
let activeStatusFilter = 'all';
let searchQuery = '';

/**
 * Load orders from the API
 * @returns {Promise<Array>} - The loaded orders
 */
async function loadOrders() {
    try {
        const tableId = new URLSearchParams(window.location.search).get('table_id');
        const orderId = new URLSearchParams(window.location.search).get('order_id');
        
        console.log(`Loading orders with params - Table ID: ${tableId}, Order ID: ${orderId}`);
        
        // First try to get all orders for the table if specified
        if (tableId) {
            // Use the table_id in the request if available
            console.log(`Fetching orders for table ${tableId}`);
            try {
                // Use the direct fetch with proper URL construction to avoid path duplication
                const url = `${window.API_CONFIG.BASE_URL}/orders${tableId ? `?table_id=${tableId}` : ''}`;
                console.log(`Fetching orders from endpoint: ${url}`);
                
                const response = await fetch(url, {
                    method: 'GET',
                    headers: window.API_CONFIG.DEFAULT_HEADERS
                });
                
                if (!response.ok) {
                    throw new Error(`API request failed with status ${response.status}`);
                }
                
                const data = await response.json();
                if (data && data.orders) {
                    console.log(`Successfully loaded ${data.orders.length} orders for table ${tableId}`);
                    allOrders = data.orders;
                }
            } catch (tableOrdersError) {
                console.error(`Error loading orders for table ${tableId}:`, tableOrdersError);
                // Continue to try getting specific order if requested
            }
        } else {
            // If no table_id, get all orders
            console.log(`Fetching all orders`);
            try {
                // Use the direct fetch with proper URL construction
                const url = `${window.API_CONFIG.BASE_URL}/orders`;
                console.log(`Fetching orders from endpoint: ${url}`);
                
                const response = await fetch(url, {
                    method: 'GET',
                    headers: window.API_CONFIG.DEFAULT_HEADERS
                });
                
                if (!response.ok) {
                    throw new Error(`API request failed with status ${response.status}`);
                }
                
                const data = await response.json();
                if (data && data.orders) {
                    console.log(`Successfully loaded ${data.orders.length} orders`);
                    allOrders = data.orders;
                }
            } catch (allOrdersError) {
                console.error('Error loading all orders:', allOrdersError);
                showNotification('Failed to load orders', 'error');
            }
        }
        
        // If orderId is specified, check if we already have it or need to fetch it separately
        if (orderId) {
            console.log(`Looking for specific order ID ${orderId}`);
            const orderExists = allOrders.some(order => order.order_id === orderId);
            
            if (!orderExists) {
                // If not found, try to fetch the specific order
                console.log(`Order ID ${orderId} not found in bulk results, fetching directly`);
                try {
                    // Use the direct fetch with proper URL construction
                    const url = `${window.API_CONFIG.BASE_URL}/orders/${orderId}`;
                    console.log(`Fetching order from endpoint: ${url}`);
                    
                    const response = await fetch(url, {
                        method: 'GET',
                        headers: window.API_CONFIG.DEFAULT_HEADERS
                    });
                    
                    if (!response.ok) {
                        throw new Error(`API request failed with status ${response.status}`);
                    }
                    
                    const orderResponse = await response.json();
                    if (orderResponse) {
                        console.log('Successfully fetched individual order:', orderResponse);
                        
                        // Add to the orders array if not already there
                        if (!allOrders.some(o => o.order_id === orderResponse.order_id)) {
                            allOrders.push(orderResponse);
                        }
                    }
                } catch (orderError) {
                    console.error(`Failed to fetch specific order ${orderId}:`, orderError);
                }
            } else {
                console.log(`Found order ${orderId} in loaded orders`);
            }
        }
        
        // Log the final state of orders
        console.log(`Final orders array contains ${allOrders.length} orders:`, allOrders);
        return allOrders;
    } catch (error) {
        console.error('Error loading orders:', error);
        showNotification('Failed to load orders', 'error');
        return [];
    }
}

/**
 * Get all orders
 * @returns {Array} - All orders
 */
function getAllOrders() {
    return allOrders;
}

/**
 * Set orders
 * @param {Array} orders - The orders to set
 */
function setOrders(orders) {
    allOrders = orders;
}

/**
 * Get the selected order
 * @returns {Object|null} - The selected order or null
 */
function getSelectedOrder() {
    return selectedOrder;
}

/**
 * Set the selected order
 * @param {Object|null} order - The order to select or null
 */
function setSelectedOrder(order) {
    selectedOrder = order;
}

/**
 * Get the active status filter
 * @returns {string} - The active status filter
 */
function getActiveStatusFilter() {
    return activeStatusFilter;
}

/**
 * Set the active status filter
 * @param {string} filter - The status filter to set
 */
function setActiveStatusFilter(filter) {
    activeStatusFilter = filter;
}

/**
 * Get the search query
 * @returns {string} - The search query
 */
function getSearchQuery() {
    return searchQuery;
}

/**
 * Set the search query
 * @param {string} query - The search query to set
 */
function setSearchQuery(query) {
    searchQuery = query;
}

/**
 * Filter orders based on status and search query
 * @returns {Array} - The filtered orders
 */
function getFilteredOrders() {
    let filtered = [...allOrders];
    
    // Apply status filter
    if (activeStatusFilter !== 'all') {
        filtered = filtered.filter(order => order.status === activeStatusFilter);
    }
    
    // Apply search filter if there's a search query
    if (searchQuery) {
        const lowerQuery = searchQuery.toLowerCase();
        filtered = filtered.filter(order => {
            // Search by order ID
            if (order.order_id.toLowerCase().includes(lowerQuery)) {
                return true;
            }
            
            // Search by table number
            if (order.table_id.toString().includes(lowerQuery)) {
                return true;
            }
            
            // Search by items
            if (order.items && order.items.some(item => 
                item.name.toLowerCase().includes(lowerQuery)
            )) {
                return true;
            }
            
            // Search by special instructions
            if (order.special_instructions && 
                order.special_instructions.toLowerCase().includes(lowerQuery)) {
                return true;
            }
            
            return false;
        });
    }
    
    return filtered;
}

/**
 * Get order by ID
 * @param {string} orderId - The order ID to find
 * @returns {Object|null} - The order or null if not found
 */
function getOrderById(orderId) {
    return allOrders.find(order => order.order_id === orderId) || null;
}

/**
 * Calculate the total price of an order
 * @param {Object} order - The order to calculate total for
 * @returns {number} - The total price
 */
function calculateOrderTotal(order) {
    if (!order || !order.items || order.items.length === 0) {
        return 0;
    }
    
    return order.items.reduce((total, item) => {
        return total + (item.price * item.quantity);
    }, 0);
}

/**
 * Format price as currency
 * @param {number} price - The price to format
 * @returns {string} - The formatted price
 */
function formatPrice(price) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(price);
}

/**
 * Cancel an order
 * @param {string} orderId - The ID of the order to cancel
 * @returns {Promise<Object>} - The updated order
 */
async function cancelOrder(orderId) {
    try {
        const response = await apiRequest(`orders/${orderId}/cancel`, {
            method: 'POST'
        });
        
        if (response && response.success) {
            // Update the order in the local state
            const orderIndex = allOrders.findIndex(o => o.order_id === orderId);
            if (orderIndex !== -1) {
                allOrders[orderIndex].status = 'cancelled';
                
                // If this is the selected order, update it
                if (selectedOrder && selectedOrder.order_id === orderId) {
                    selectedOrder.status = 'cancelled';
                }
            }
            
            showNotification('Order cancelled successfully', 'success');
            return response.data;
        } else {
            throw new Error(response.message || 'Failed to cancel order');
        }
    } catch (error) {
        console.error('Error cancelling order:', error);
        showNotification(`Failed to cancel order: ${error.message}`, 'error');
        throw error;
    }
}

/**
 * Get order tracking information
 * @param {string} orderId - The ID of the order to track
 * @returns {Promise<Object>} - The tracking information
 */
async function getOrderTracking(orderId) {
    try {
        const response = await apiRequest(`orders/${orderId}/tracking`);
        
        if (response && response.success) {
            return response.data;
        } else {
            throw new Error(response.message || 'Failed to get tracking information');
        }
    } catch (error) {
        console.error('Error getting order tracking:', error);
        showNotification(`Failed to get tracking information: ${error.message}`, 'error');
        throw error;
    }
}

/**
 * Get counts of orders by status
 * @returns {Object} - The counts object
 */
function getOrderCounts() {
    const counts = {
        total: allOrders.length,
        pending: 0,
        completed: 0,
        cancelled: 0
    };
    
    allOrders.forEach(order => {
        if (order.status === 'cancelled') {
            counts.cancelled++;
        } else if (order.status === 'completed' || order.status === 'delivered') {
            counts.completed++;
        } else {
            counts.pending++;
        }
    });
    
    return counts;
}

// Export the functions
export {
    loadOrders,
    getAllOrders,
    setOrders,
    getSelectedOrder,
    setSelectedOrder,
    getActiveStatusFilter,
    setActiveStatusFilter,
    getSearchQuery,
    setSearchQuery,
    getFilteredOrders,
    getOrderById,
    calculateOrderTotal,
    formatPrice,
    cancelOrder,
    getOrderTracking,
    getOrderCounts
}; 