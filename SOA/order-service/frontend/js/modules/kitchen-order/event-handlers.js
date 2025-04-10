// Event Handlers module for kitchen-order.js
import { domElements } from './dom-elements.js';
import { 
    getAllOrders,
    getSelectedOrder,
    setSelectedOrder,
    setOrderStatus,
    updateItemStatus,
    setAllItemsStatus,
    saveKitchenNotes,
    saveLocalData,
    getLocalStorageData
} from './order-service.js';
import {
    renderOrderQueue,
    renderOrderHistory,
    renderOrderItems,
    renderOrderDetails,
    updateOrderQueueSummary
} from './ui-renderer.js';
import { showNotification } from '../../utils/notifications.js';

/**
 * Initialize event listeners
 */
function setupEventListeners() {
    const {
        statusFilter,
        startAllBtn,
        markReadyBtn,
        pauseOrderBtn,
        cancelOrderBtn,
        kitchenNotesElement,
        saveNotesBtn,
        orderItemsElement,
        refreshBtn,
        showHistoryBtn,
        orderDetailCloseBtn
    } = domElements;

    // Filter change event
    if (statusFilter) {
        statusFilter.addEventListener('change', handleFilterChange);
    }

    // Action button events
    if (startAllBtn) {
        startAllBtn.addEventListener('click', handleStartAllItems);
    }

    if (markReadyBtn) {
        markReadyBtn.addEventListener('click', handleMarkOrderReady);
    }

    if (pauseOrderBtn) {
        pauseOrderBtn.addEventListener('click', handlePauseOrder);
    }

    if (cancelOrderBtn) {
        cancelOrderBtn.addEventListener('click', handleCancelOrder);
    }

    // Kitchen notes events
    if (kitchenNotesElement && saveNotesBtn) {
        saveNotesBtn.addEventListener('click', handleSaveNotes);
    }

    // Order items events - using event delegation for item status buttons
    if (orderItemsElement) {
        orderItemsElement.addEventListener('click', handleItemStatusChange);
    }

    // Refresh button
    if (refreshBtn) {
        refreshBtn.addEventListener('click', handleRefresh);
    }

    // History toggle
    if (showHistoryBtn) {
        showHistoryBtn.addEventListener('click', handleToggleHistory);
    }

    // Close order detail panel
    if (orderDetailCloseBtn) {
        orderDetailCloseBtn.addEventListener('click', handleCloseOrderDetails);
    }

    // Poll for updates every 30 seconds
    setInterval(handleRefresh, 30000);
}

/**
 * Handle filter change
 * @param {Event} event - The change event
 */
function handleFilterChange(event) {
    // Store the filter value
    localStorage.setItem('kitchenStatusFilter', event.target.value);
    
    // Re-render orders with the new filter
    renderOrderQueue();
}

/**
 * Handle refresh button click or automatic refresh
 */
async function handleRefresh() {
    try {
        const response = await apiRequest('GET', '/api/orders');
        if (response && response.data) {
            // Update the orders in the state
            updateOrders(response.data);
            
            // Re-render the UI
            renderOrderQueue();
            
            // If an order is selected, refresh its details
            const selectedOrder = getSelectedOrder();
            if (selectedOrder) {
                // Find the updated version of the selected order
                const updatedOrder = response.data.find(order => 
                    order.order_id === selectedOrder.order_id
                );
                
                if (updatedOrder) {
                    setSelectedOrder(updatedOrder);
                    renderOrderDetails();
                }
            }
            
            showNotification('Orders refreshed', 'success');
        }
    } catch (error) {
        console.error('Error refreshing orders:', error);
        showNotification('Failed to refresh orders', 'error');
    }
}

/**
 * Handle starting all items in an order
 */
async function handleStartAllItems() {
    const order = getSelectedOrder();
    if (!order) return;
    
    try {
        // Update all items to in-progress
        await setAllItemsStatus(order, 'in-progress');
        
        // Update the order status if needed
        if (order.status === 'received') {
            await setOrderStatus(order, 'in-progress');
        }
        
        showNotification('All items started', 'success');
        
        // Re-render the UI
        renderOrderItems();
        renderOrderQueue();
    } catch (error) {
        console.error('Error starting all items:', error);
        showNotification('Failed to start items', 'error');
    }
}

/**
 * Handle marking an order as ready
 */
async function handleMarkOrderReady() {
    const order = getSelectedOrder();
    if (!order) return;
    
    try {
        // Check if all items are ready
        const allItemsReady = order.items.every(item => item.status === 'ready');
        
        if (!allItemsReady) {
            // Update all items to ready
            await setAllItemsStatus(order, 'ready');
        }
        
        // Update the order status
        await setOrderStatus(order, 'ready');
        
        showNotification('Order marked as ready', 'success');
        
        // Re-render the UI
        renderOrderDetails();
        renderOrderQueue();
    } catch (error) {
        console.error('Error marking order as ready:', error);
        showNotification('Failed to mark order as ready', 'error');
    }
}

/**
 * Handle pausing an order
 */
function handlePauseOrder() {
    const order = getSelectedOrder();
    if (!order) return;
    
    try {
        // Store the paused order in localStorage
        const pausedOrders = getLocalStorageData('pausedOrders', []);
        
        // Check if this order is already paused
        const alreadyPaused = pausedOrders.some(p => p.orderId === order.order_id);
        
        if (!alreadyPaused) {
            pausedOrders.push({
                orderId: order.order_id,
                pausedAt: new Date().toISOString()
            });
            
            saveLocalData('pausedOrders', pausedOrders);
            
            // Update order in UI
            order.visualStatus = 'paused';
            showNotification('Order paused', 'success');
            
            // Re-render the UI
            renderOrderDetails();
            renderOrderQueue();
        }
    } catch (error) {
        console.error('Error pausing order:', error);
        showNotification('Failed to pause order', 'error');
    }
}

/**
 * Handle cancelling an order
 */
function handleCancelOrder() {
    const order = getSelectedOrder();
    if (!order) return;
    
    try {
        // Store the cancelled order in localStorage
        const cancelledOrders = getLocalStorageData('cancelledOrders', []);
        
        // Check if this order is already cancelled
        const alreadyCancelled = cancelledOrders.some(c => c.orderId === order.order_id);
        
        if (!alreadyCancelled) {
            cancelledOrders.push({
                orderId: order.order_id,
                cancelledAt: new Date().toISOString()
            });
            
            saveLocalData('cancelledOrders', cancelledOrders);
            
            // Update order in UI
            order.visualStatus = 'cancelled';
            showNotification('Order cancelled', 'warning');
            
            // Re-render the UI
            renderOrderDetails();
            renderOrderQueue();
        }
    } catch (error) {
        console.error('Error cancelling order:', error);
        showNotification('Failed to cancel order', 'error');
    }
}

/**
 * Handle saving kitchen notes
 */
async function handleSaveNotes() {
    const { kitchenNotesElement } = domElements;
    if (!kitchenNotesElement) return;
    
    const order = getSelectedOrder();
    if (!order) return;
    
    const notes = kitchenNotesElement.value.trim();
    
    try {
        await saveKitchenNotes(order, notes);
        showNotification('Kitchen notes saved', 'success');
    } catch (error) {
        console.error('Error saving kitchen notes:', error);
        showNotification('Failed to save kitchen notes', 'error');
    }
}

/**
 * Handle item status change
 * @param {Event} event - The click event
 */
async function handleItemStatusChange(event) {
    const button = event.target.closest('button[data-status][data-item-id]');
    if (!button) return;
    
    const itemId = button.getAttribute('data-item-id');
    const newStatus = button.getAttribute('data-status');
    
    const order = getSelectedOrder();
    if (!order) return;
    
    // Find the item in the order
    const item = order.items.find(i => i.item_id === itemId);
    if (!item) return;
    
    // If the item is already in this status, do nothing
    if (item.status === newStatus) return;
    
    try {
        await updateItemStatus(order, itemId, newStatus);
        
        showNotification(`Item status updated to ${newStatus}`, 'success');
        
        // Check if we need to update the order status
        const allItemsStatus = order.items.every(i => i.status === newStatus);
        
        if (allItemsStatus && order.status !== newStatus) {
            await setOrderStatus(order, newStatus);
        }
        
        // Re-render the UI
        renderOrderItems();
        renderOrderQueue();
    } catch (error) {
        console.error('Error updating item status:', error);
        showNotification('Failed to update item status', 'error');
    }
}

/**
 * Handle toggling history view
 */
function handleToggleHistory() {
    const { orderHistoryContainer, showHistoryBtn } = domElements;
    if (!orderHistoryContainer || !showHistoryBtn) return;
    
    const isShowing = orderHistoryContainer.classList.contains('hidden');
    
    if (isShowing) {
        // Show history
        orderHistoryContainer.classList.remove('hidden');
        showHistoryBtn.textContent = 'Hide History';
        
        // Save preference
        localStorage.setItem('kitchenShowHistory', 'true');
        
        // Render the history orders
        renderOrderHistory();
    } else {
        // Hide history
        orderHistoryContainer.classList.add('hidden');
        showHistoryBtn.textContent = 'Show History';
        
        // Save preference
        localStorage.setItem('kitchenShowHistory', 'false');
    }
}

/**
 * Handle closing order details panel
 */
function handleCloseOrderDetails() {
    const { orderDetailPanel } = domElements;
    if (!orderDetailPanel) return;
    
    orderDetailPanel.classList.add('hidden');
    setSelectedOrder(null);
    
    // Remove highlight from any selected order
    document.querySelectorAll('[data-order-id]').forEach(el => {
        el.classList.remove('ring-2', 'ring-blue-500');
    });
}

/**
 * Handle updating orders (after refresh or initial load)
 * @param {Array} orders - The new orders data
 */
function updateOrders(orders) {
    // Check if we have local changes that need to be preserved
    const pausedOrders = getLocalStorageData('pausedOrders', []);
    const cancelledOrders = getLocalStorageData('cancelledOrders', []);
    
    // Apply any UI-side status changes
    orders.forEach(order => {
        // Apply paused status
        const isPaused = pausedOrders.some(p => p.orderId === order.order_id);
        if (isPaused) {
            order.visualStatus = 'paused';
        }
        
        // Apply cancelled status
        const isCancelled = cancelledOrders.some(c => c.orderId === order.order_id);
        if (isCancelled) {
            order.visualStatus = 'cancelled';
        }
    });
    
    // Store the updated orders
    localStorage.setItem('kitchenOrders', JSON.stringify(orders));
    return orders;
}

// Export the event handler functions
export {
    setupEventListeners,
    handleFilterChange,
    handleRefresh,
    handleStartAllItems,
    handleMarkOrderReady,
    handlePauseOrder,
    handleCancelOrder,
    handleSaveNotes,
    handleItemStatusChange,
    handleToggleHistory,
    handleCloseOrderDetails,
    updateOrders
}; 