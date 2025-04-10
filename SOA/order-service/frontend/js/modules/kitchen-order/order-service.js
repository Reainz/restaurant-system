// Order Service module for kitchen-order.js
import { API_CONFIG } from '../../config.js';
import { showNotification } from '../../utils/notifications.js';

// State
let orders = [];
let selectedOrder = null;
let activeStatusFilter = 'active'; // Default filter - only show active orders
let showHistory = false;

/**
 * Load orders from the backend
 * @returns {Promise<Array>} - The loaded orders
 */
async function loadOrders() {
    try {
        console.log('Fetching orders from API...');
        
        // Fetch orders from the API
        const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.ORDERS}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Error response:', errorText);
            throw new Error(`Failed to load orders: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Orders data received:', data);
        
        // Store the orders in state
        orders = data.orders || [];
        
        return orders;
    } catch (error) {
        console.error('Error loading orders:', error);
        showNotification(`Error loading orders: ${error.message}`, 'error');
        throw error;
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
 * Update order status
 * @param {string} orderId - The order ID to update
 * @param {string} status - The new status
 * @returns {Promise<Object>} - The updated order
 */
async function updateOrderStatus(orderId, newStatus) {
    console.log(`Updating order ${orderId} status to ${newStatus}`);
    
    try {
        const response = await fetch(`${API_CONFIG.BASE_URL}/orders/${orderId}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ status: newStatus })
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Error updating status: ${response.status}`, errorText);
            throw new Error(`Failed to update status: ${response.status}`);
        }
        
        const updatedOrder = await response.json();
        console.log('Order status updated:', updatedOrder);
        
        // Update order in the orders array
        const orderIndex = orders.findIndex(o => o.order_id === orderId);
        if (orderIndex !== -1) {
            orders[orderIndex] = updatedOrder;
        }
        
        // If this was the selected order, update selectedOrder
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
 * Update an order item's status
 * @param {string} orderId - The order ID
 * @param {string} itemId - The item ID to update
 * @param {string} newStatus - The new status
 * @returns {Promise<Object>} - The updated order
 */
async function updateOrderItemStatus(orderId, itemId, newStatus) {
    console.log(`Updating item ${itemId} of order ${orderId} to status ${newStatus}`);
    
    try {
        const response = await fetch(`${API_CONFIG.BASE_URL}/orders/${orderId}/items/${itemId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ status: newStatus })
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Error updating item status: ${response.status}`, errorText);
            throw new Error(`Failed to update item status: ${response.status}`);
        }
        
        const updatedOrder = await response.json();
        console.log('Order item status updated:', updatedOrder);
        
        // Update order in the orders array
        const orderIndex = orders.findIndex(o => o.order_id === orderId);
        if (orderIndex !== -1) {
            orders[orderIndex] = updatedOrder;
        }
        
        // If this was the selected order, update selectedOrder
        if (selectedOrder && selectedOrder.order_id === orderId) {
            selectedOrder = updatedOrder;
        }
        
        return updatedOrder;
    } catch (error) {
        console.error('Error updating item status:', error);
        showNotification(`Error updating item status: ${error.message}`, 'error');
        throw error;
    }
}

/**
 * Get all orders
 * @returns {Array} - All orders
 */
function getAllOrders() {
    return orders;
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
 * Mark an order as ready
 * @param {string} orderId - The order ID to mark as ready
 * @returns {Promise<Object>} - The updated order
 */
async function markOrderReady(orderId) {
    return updateOrderStatus(orderId, 'ready');
}

/**
 * Start working on an order (in-progress)
 * @param {string} orderId - The order ID to start working on
 * @returns {Promise<Object>} - The updated order
 */
async function startOrder(orderId) {
    return updateOrderStatus(orderId, 'in-progress');
}

/**
 * Cancel an order
 * @param {string} orderId - The order ID to cancel
 * @returns {Promise<Object>} - The cancelled order
 */
async function cancelOrder(orderId) {
    try {
        // First, try the API cancellation if available
        try {
            const response = await fetch(`${API_CONFIG.BASE_URL}/orders/${orderId}/cancel`, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json'
                }
            });
            
            if (response.ok) {
                const cancelledOrder = await response.json();
                
                // Update order in the orders array
                const orderIndex = orders.findIndex(o => o.order_id === orderId);
                if (orderIndex !== -1) {
                    orders[orderIndex] = cancelledOrder;
                }
                
                // If this was the selected order, update selectedOrder
                if (selectedOrder && selectedOrder.order_id === orderId) {
                    selectedOrder = cancelledOrder;
                }
                
                return cancelledOrder;
            }
        } catch (apiError) {
            console.warn('API cancel endpoint not available, falling back to status update', apiError);
        }
        
        // If the cancel endpoint fails or isn't available, use status update
        return updateOrderStatus(orderId, 'cancelled');
    } catch (error) {
        console.error('Error cancelling order:', error);
        showNotification(`Error cancelling order: ${error.message}`, 'error');
        throw error;
    }
}

/**
 * Start all items in an order
 * @param {string} orderId - The order ID
 * @returns {Promise<Object>} - The updated order
 */
async function startAllItems(orderId) {
    const order = getOrderById(orderId);
    if (!order) {
        throw new Error(`Order ${orderId} not found`);
    }
    
    // Update the order status to in-progress first
    await updateOrderStatus(orderId, 'in-progress');
    
    // Then update each item's status
    const updatePromises = order.items.map(item => 
        updateOrderItemStatus(orderId, item.item_id, 'in-progress')
    );
    
    try {
        // Wait for all item updates to complete
        await Promise.all(updatePromises);
        
        // Refresh the order data
        return getOrderById(orderId);
    } catch (error) {
        console.error('Error starting all items:', error);
        showNotification(`Error starting all items: ${error.message}`, 'error');
        throw error;
    }
}

/**
 * Save kitchen notes for an order
 * @param {string} orderId - The order ID
 * @param {string} notes - The kitchen notes
 * @returns {Promise<Object>} - The updated order
 */
async function saveKitchenNotes(orderId, notes) {
    try {
        const response = await fetch(`${API_CONFIG.BASE_URL}/orders/${orderId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ kitchen_notes: notes })
        });
        
        if (!response.ok) {
            throw new Error(`Failed to save notes: ${response.status}`);
        }
        
        const updatedOrder = await response.json();
        
        // Update order in the orders array
        const orderIndex = orders.findIndex(o => o.order_id === orderId);
        if (orderIndex !== -1) {
            orders[orderIndex] = updatedOrder;
        }
        
        // If this was the selected order, update selectedOrder
        if (selectedOrder && selectedOrder.order_id === orderId) {
            selectedOrder = updatedOrder;
        }
        
        showNotification('Kitchen notes saved successfully', 'success');
        return updatedOrder;
    } catch (error) {
        console.error('Error saving kitchen notes:', error);
        showNotification(`Error saving kitchen notes: ${error.message}`, 'error');
        throw error;
    }
}

/**
 * Set the active status filter
 * @param {string} filter - The filter to set
 */
function setActiveStatusFilter(filter) {
    activeStatusFilter = filter;
}

/**
 * Get the active status filter
 * @returns {string} - The active status filter
 */
function getActiveStatusFilter() {
    return activeStatusFilter;
}

/**
 * Set whether to show history
 * @param {boolean} show - Whether to show history
 */
function setShowHistory(show) {
    showHistory = show;
}

/**
 * Get whether to show history
 * @returns {boolean} - Whether to show history
 */
function getShowHistory() {
    return showHistory;
}

// Export functions and state
export {
    loadOrders,
    getOrderById,
    updateOrderStatus,
    updateOrderItemStatus,
    getAllOrders,
    setSelectedOrder,
    getSelectedOrder,
    markOrderReady,
    startOrder,
    cancelOrder,
    startAllItems,
    saveKitchenNotes,
    setActiveStatusFilter,
    getActiveStatusFilter,
    setShowHistory,
    getShowHistory
}; 