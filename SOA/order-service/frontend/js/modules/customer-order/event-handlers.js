// Event handlers module for customer-order.js
import { domElements } from './dom-elements.js';
import {
    loadOrders,
    getAllOrders,
    getSelectedOrder,
    setSelectedOrder,
    getActiveStatusFilter,
    setActiveStatusFilter,
    getSearchQuery,
    setSearchQuery,
    cancelOrder,
    getOrderTracking,
    getOrderCounts
} from './order-service.js';
import {
    renderOrderList,
    hideOrderDetails,
    renderTrackingModal,
    showTrackingModal,
    hideTrackingModal,
    updateOrderCountSummary
} from './ui-renderer.js';
import { showNotification } from '../../utils/notifications.js';

/**
 * Initialize all event listeners
 */
function setupEventListeners() {
    const {
        statusFilter,
        searchInput,
        submitOrderBtn,
        cancelOrderBtn,
        trackOrderBtn,
        closeDetailsBtn,
        refreshBtn,
        closeTrackingModalBtn
    } = domElements;
    
    // Status filter change event
    if (statusFilter) {
        statusFilter.addEventListener('change', handleStatusFilterChange);
    }
    
    // Search input event
    if (searchInput) {
        searchInput.addEventListener('input', handleSearchInput);
    }
    
    // Submit order button click event
    if (submitOrderBtn) {
        submitOrderBtn.addEventListener('click', handleSubmitOrder);
    }
    
    // Cancel order button click event
    if (cancelOrderBtn) {
        cancelOrderBtn.addEventListener('click', handleCancelOrder);
    }
    
    // Track order button click event
    if (trackOrderBtn) {
        trackOrderBtn.addEventListener('click', handleTrackOrder);
    }
    
    // Close details button click event
    if (closeDetailsBtn) {
        closeDetailsBtn.addEventListener('click', handleCloseDetails);
    }
    
    // Refresh button click event
    if (refreshBtn) {
        refreshBtn.addEventListener('click', handleRefreshOrders);
    }
    
    // Close tracking modal button click event
    if (closeTrackingModalBtn) {
        closeTrackingModalBtn.addEventListener('click', handleCloseTrackingModal);
    }
    
    // Set up automatic refresh (every 30 seconds)
    setInterval(handleRefreshOrders, 30000);
}

/**
 * Handle status filter change
 * @param {Event} event - The change event
 */
function handleStatusFilterChange(event) {
    const status = event.target.value;
    
    // Update the filter state
    setActiveStatusFilter(status);
    
    // Re-render the order list
    renderOrderList();
}

/**
 * Handle search input
 * @param {Event} event - The input event
 */
function handleSearchInput(event) {
    const query = event.target.value.trim();
    
    // Update the search query state
    setSearchQuery(query);
    
    // Re-render the order list
    renderOrderList();
}

/**
 * Handle submit order button click
 */
async function handleSubmitOrder() {
    try {
        // Get table ID from URL
        const urlParams = new URLSearchParams(window.location.search);
        const tableId = urlParams.get('table_id');
        
        if (!tableId) {
            showNotification('Table ID is required', 'error');
            return;
        }
        
        // Get special instructions
        const specialInstructions = document.getElementById('specialInstructions')?.value || '';
        
        // Get order items from the UI
        const orderItemsContainer = document.getElementById('orderItems');
        const items = [];
        
        // Get all item elements from the container
        const itemElements = orderItemsContainer.querySelectorAll('.order-item');
        itemElements.forEach(itemEl => {
            const itemId = itemEl.getAttribute('data-item-id');
            const quantity = parseInt(itemEl.querySelector('.item-quantity')?.textContent || '0', 10);
            const name = itemEl.querySelector('.item-name')?.textContent || '';
            const price = parseFloat(itemEl.querySelector('.item-price')?.getAttribute('data-price') || '0');
            
            if (itemId && quantity > 0) {
                items.push({
                    item_id: itemId,
                    name: name,
                    quantity: quantity,
                    price: price
                });
            }
        });
        
        if (items.length === 0) {
            showNotification('Please add items to your order', 'error');
            return;
        }
        
        // Create the order object
        const order = {
            table_id: tableId,
            items: items,
            special_instructions: specialInstructions,
            status: 'received'
        };
        
        // Submit the order using direct fetch with proper URL
        const url = `${window.API_CONFIG.BASE_URL}/orders`;
        console.log(`Submitting order to: ${url}`, order);
        
        const response = await fetch(url, {
            method: 'POST',
            headers: window.API_CONFIG.DEFAULT_HEADERS,
            body: JSON.stringify(order)
        });
        
        if (!response.ok) {
            throw new Error(`API request failed with status ${response.status}`);
        }
        
        const result = await response.json();
        
        // Show success message with order ID
        showNotification('Order submitted successfully!', 'success');
        
        // Display the order ID
        const orderIdMessage = document.getElementById('orderIdMessage');
        const displayOrderId = document.getElementById('displayOrderId');
        if (orderIdMessage && displayOrderId) {
            displayOrderId.textContent = result.order_id;
            orderIdMessage.classList.remove('hidden');
        }
        
        // Update order status
        const orderStatus = document.getElementById('orderStatus');
        if (orderStatus) {
            orderStatus.textContent = 'Received';
            orderStatus.className = 'px-3 py-1 rounded-full text-sm font-semibold bg-blue-100 text-blue-800';
        }
        
        // Update progress bar
        updateProgressBar('received');
        
        // Disable submit button
        const submitBtn = document.getElementById('submitOrderBtn');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.classList.add('opacity-50', 'cursor-not-allowed');
        }
        
        // Refresh orders list
        await handleRefreshOrders();
        
    } catch (error) {
        console.error('Error submitting order:', error);
        showNotification('Failed to submit order: ' + error.message, 'error');
    }
}

/**
 * Handle cancel order button click
 */
async function handleCancelOrder() {
    const order = getSelectedOrder();
    if (!order) return;
    
    // Check if the order can be cancelled
    if (!['received', 'in-progress'].includes(order.status)) {
        showNotification('This order cannot be cancelled', 'error');
        return;
    }
    
    // Confirm the action
    const confirmed = confirm(`Are you sure you want to cancel order #${order.order_id}?`);
    if (!confirmed) return;
    
    try {
        // Call the service function to cancel the order
        await cancelOrder(order.order_id);
        
        // Update the UI
        renderOrderList();
    } catch (error) {
        console.error('Error cancelling order:', error);
    }
}

/**
 * Handle track order button click
 */
async function handleTrackOrder() {
    const order = getSelectedOrder();
    if (!order) return;
    
    try {
        // Get tracking data (if available from API)
        let trackingData = null;
        try {
            trackingData = await getOrderTracking(order.order_id);
        } catch (error) {
            console.warn('Could not fetch tracking data, using order state only', error);
        }
        
        // Render the tracking modal with the order data
        renderTrackingModal(order, trackingData);
        
        // Show the modal
        showTrackingModal();
    } catch (error) {
        console.error('Error tracking order:', error);
        showNotification('Could not load tracking information', 'error');
    }
}

/**
 * Handle close details button click
 */
function handleCloseDetails() {
    hideOrderDetails();
}

/**
 * Handle refresh orders button click
 */
async function handleRefreshOrders() {
    try {
        // Load orders from the API
        await loadOrders();
        
        // Re-render the order list
        renderOrderList();
        
        // Update order counts
        const counts = getOrderCounts();
        updateOrderCountSummary(counts);
        
        showNotification('Orders refreshed', 'success');
    } catch (error) {
        console.error('Error refreshing orders:', error);
        showNotification('Failed to refresh orders', 'error');
    }
}

/**
 * Handle close tracking modal button click
 */
function handleCloseTrackingModal() {
    hideTrackingModal();
}

// Export the event handler functions
export { setupEventListeners }; 