// UI renderer module for customer-order.js
import { domElements } from './dom-elements.js';
import {
    getFilteredOrders,
    getSelectedOrder,
    setSelectedOrder,
    calculateOrderTotal,
    formatPrice
} from './order-service.js';
import {
    getStatusClass,
    formatDate,
    formatRelativeTime,
    truncateString,
    capitalizeFirstLetter,
    getStatusLabel,
    formatItemPrice,
    getEstimatedTimeDescription,
    getTrackingSteps
} from './ui-utils.js';

/**
 * Render the order list
 */
function renderOrderList() {
    const { orderList, emptyOrderMessage } = domElements;
    if (!orderList) return;
    
    const filteredOrders = getFilteredOrders();
    
    // Clear current list
    orderList.innerHTML = '';
    
    // Show empty message if no orders
    if (filteredOrders.length === 0) {
        if (emptyOrderMessage) {
            emptyOrderMessage.classList.remove('hidden');
        }
        return;
    }
    
    // Hide empty message
    if (emptyOrderMessage) {
        emptyOrderMessage.classList.add('hidden');
    }
    
    // Sort orders by creation date (newest first)
    filteredOrders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
    // Create and append order elements
    filteredOrders.forEach(order => {
        orderList.appendChild(createOrderElement(order));
    });
}

/**
 * Create an order element for the list
 * @param {Object} order - The order object
 * @returns {HTMLElement} - The created element
 */
function createOrderElement(order) {
    const orderElement = document.createElement('div');
    orderElement.className = 'bg-white rounded-lg shadow-md p-4 mb-4 cursor-pointer hover:bg-gray-50 transition duration-150';
    orderElement.setAttribute('data-order-id', order.order_id);
    
    // Calculate the total price
    const totalPrice = calculateOrderTotal(order);
    
    // Format creation date
    const formattedDate = formatRelativeTime(order.created_at);
    
    // Count items
    const itemCount = order.items ? order.items.length : 0;
    
    // Create the HTML content
    orderElement.innerHTML = `
        <div class="flex justify-between items-start">
            <div>
                <h3 class="text-lg font-semibold">Table ${order.table_id}</h3>
                <p class="text-sm text-gray-600">${formattedDate}</p>
            </div>
            <div>
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusClass(order.status)}">
                    ${getStatusLabel(order.status)}
                </span>
            </div>
        </div>
        <div class="mt-2">
            <p class="text-sm"><span class="font-medium">Order ID:</span> ${truncateString(order.order_id, 12)}</p>
            <p class="text-sm"><span class="font-medium">Items:</span> ${itemCount}</p>
            <p class="text-sm"><span class="font-medium">Total:</span> ${formatPrice(totalPrice)}</p>
        </div>
        ${order.special_instructions ? `
        <div class="mt-2 bg-yellow-50 p-2 rounded-md text-sm">
            <p class="font-medium">Special Instructions:</p>
            <p>${truncateString(order.special_instructions, 50)}</p>
        </div>
        ` : ''}
    `;
    
    // Add click event to select the order
    orderElement.addEventListener('click', () => {
        selectOrder(order);
    });
    
    return orderElement;
}

/**
 * Select an order and show its details
 * @param {Object} order - The order to select
 */
function selectOrder(order) {
    // Update selected order
    setSelectedOrder(order);
    
    // Highlight the selected order in the list
    highlightSelectedOrder(order.order_id);
    
    // Show the order details
    renderOrderDetails();
    
    // Show the details panel
    showOrderDetails();
}

/**
 * Highlight the selected order in the list
 * @param {string} orderId - The ID of the selected order
 */
function highlightSelectedOrder(orderId) {
    // Remove highlight from all orders
    document.querySelectorAll('[data-order-id]').forEach(element => {
        element.classList.remove('ring-2', 'ring-blue-500');
        element.classList.add('hover:bg-gray-50');
    });
    
    // Add highlight to selected order
    const selectedElement = document.querySelector(`[data-order-id="${orderId}"]`);
    if (selectedElement) {
        selectedElement.classList.add('ring-2', 'ring-blue-500');
        selectedElement.classList.remove('hover:bg-gray-50');
    }
}

/**
 * Show the order details panel
 */
function showOrderDetails() {
    const { orderDetails } = domElements;
    if (orderDetails) {
        orderDetails.classList.remove('hidden');
    }
}

/**
 * Hide the order details panel
 */
function hideOrderDetails() {
    const { orderDetails } = domElements;
    if (orderDetails) {
        orderDetails.classList.add('hidden');
    }
    
    // Clear selected order
    setSelectedOrder(null);
    
    // Remove highlight from all orders
    document.querySelectorAll('[data-order-id]').forEach(element => {
        element.classList.remove('ring-2', 'ring-blue-500');
        element.classList.add('hover:bg-gray-50');
    });
}

/**
 * Render order details
 */
function renderOrderDetails() {
    const order = getSelectedOrder();
    const orderItemsContainer = document.getElementById('orderItems');
    const orderTotalElement = document.getElementById('orderTotal');
    const specialInstructionsElement = document.getElementById('specialInstructions');
    
    if (!order) {
        console.warn('No order selected to render details');
        // Show a placeholder or empty state
        if (orderItemsContainer) {
            orderItemsContainer.innerHTML = '<p class="text-gray-500">No items added to order yet.</p>';
        }
        if (orderTotalElement) {
            orderTotalElement.textContent = '₫0.000';
        }
        return;
    }
    
    console.log('Rendering details for order:', order);
    
    // Render order items
    if (orderItemsContainer) {
        if (order.items && order.items.length > 0) {
            // Clear any existing content
            orderItemsContainer.innerHTML = '';
            
            // Create elements for each item
            order.items.forEach(item => {
                const itemElement = document.createElement('div');
                itemElement.className = 'flex justify-between items-center border-b border-gray-200 py-3';
                
                const itemPrice = item.price || 0;
                const itemTotal = itemPrice * item.quantity;
                
                itemElement.innerHTML = `
                    <div>
                        <h3 class="font-medium">${item.name}</h3>
                        <p class="text-sm text-gray-600">
                            ${formatPrice(itemPrice)} × ${item.quantity}
                            ${item.notes ? `<span class="text-gray-500 italic"> - ${item.notes}</span>` : ''}
                        </p>
                    </div>
                    <div class="text-right">
                        <span class="font-medium">${formatPrice(itemTotal)}</span>
                        <span class="inline-flex items-center px-2 py-0.5 ml-2 rounded-full text-xs font-medium ${getStatusClass(item.status)}">
                            ${getStatusLabel(item.status)}
                        </span>
                    </div>
                `;
                
                orderItemsContainer.appendChild(itemElement);
            });
        } else {
            orderItemsContainer.innerHTML = '<p class="text-gray-500">No items in this order.</p>';
        }
    }
    
    // Update total price
    if (orderTotalElement) {
        const totalPrice = calculateOrderTotal(order);
        orderTotalElement.textContent = formatPrice(totalPrice);
    }
    
    // Update special instructions
    if (specialInstructionsElement) {
        specialInstructionsElement.value = order.special_instructions || '';
    }
    
    // Update order status in progress bar if the function exists
    if (typeof updateProgressBar === 'function') {
        updateProgressBar(order.status);
    }
}

/**
 * Format currency amount in Vietnamese Dong
 * @param {number} amount - The amount to format
 * @returns {string} - The formatted amount
 */
function formatCurrency(amount) {
    if (amount === undefined || amount === null) return '₫0';
    return `₫${Number(amount).toLocaleString()}`;
}

/**
 * Render tracking modal content for an order
 * @param {Object} order - The order
 * @param {Object} trackingData - The tracking data
 */
function renderTrackingModal(order, trackingData = null) {
    const { trackingModalContent, trackingTimelineContainer } = domElements;
    if (!trackingModalContent || !order) return;
    
    // Order status information
    const statusInfo = getEstimatedTimeDescription(order.status);
    
    // Create tracking content with timeline
    trackingModalContent.innerHTML = `
        <h3 class="text-lg font-semibold mb-2">Order #${truncateString(order.order_id, 8)}</h3>
        <p class="text-sm mb-4">${statusInfo}</p>
        
        <div class="mb-4">
            <h4 class="font-medium mb-2">Order Details</h4>
            <p class="text-sm"><span class="font-medium">Table:</span> ${order.table_id}</p>
            <p class="text-sm"><span class="font-medium">Placed:</span> ${formatDate(order.created_at)}</p>
            <p class="text-sm"><span class="font-medium">Status:</span> 
                <span class="inline-flex items-center px-2 py-0.5 rounded text-xs ${getStatusClass(order.status)}">
                    ${getStatusLabel(order.status)}
                </span>
            </p>
        </div>
    `;
    
    // Render the timeline
    if (trackingTimelineContainer) {
        renderTrackingTimeline(order, trackingTimelineContainer, trackingData);
    }
}

/**
 * Render tracking timeline
 * @param {Object} order - The order
 * @param {HTMLElement} container - The container element
 * @param {Object} trackingData - The tracking data
 */
function renderTrackingTimeline(order, container, trackingData = null) {
    if (!container) return;
    
    container.innerHTML = '';
    
    // Generate steps based on order data and tracking data
    const steps = getTrackingSteps(order);
    
    // Create timeline elements
    steps.forEach((step, index) => {
        const stepElement = document.createElement('div');
        stepElement.className = 'flex items-start mb-4 last:mb-0';
        
        // Determine status color
        let statusColor = 'gray';
        if (step.status === 'completed') {
            statusColor = 'green';
        } else if (step.status === 'cancelled') {
            statusColor = 'red';
        }
        
        // Create HTML content
        stepElement.innerHTML = `
            <div class="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${step.status === 'completed' ? `bg-${statusColor}-100 text-${statusColor}-500` : `bg-gray-100 text-gray-400`}">
                ${step.status === 'completed' ? 
                    '<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path></svg>' :
                    (step.status === 'cancelled' ? 
                     '<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path></svg>' :
                     `${index + 1}`)}
            </div>
            <div class="ml-4 flex-1">
                <h3 class="text-sm font-medium">${step.label}</h3>
                ${step.time ? 
                    `<p class="text-xs text-gray-500">${formatDate(step.time)}</p>` :
                    `<p class="text-xs text-gray-500">${step.status === 'cancelled' ? 'Cancelled' : 'Pending'}</p>`}
            </div>
        `;
        
        container.appendChild(stepElement);
    });
}

/**
 * Show the tracking modal
 */
function showTrackingModal() {
    const { trackingModal } = domElements;
    if (trackingModal) {
        trackingModal.classList.remove('hidden');
    }
}

/**
 * Hide the tracking modal
 */
function hideTrackingModal() {
    const { trackingModal } = domElements;
    if (trackingModal) {
        trackingModal.classList.add('hidden');
    }
}

/**
 * Update the order count summary
 * @param {Object} counts - The counts object
 */
function updateOrderCountSummary(counts) {
    const { 
        totalOrdersCount,
        pendingCount,
        completedCount,
        cancelledCount
    } = domElements;
    
    if (totalOrdersCount) totalOrdersCount.textContent = counts.total;
    if (pendingCount) pendingCount.textContent = counts.pending;
    if (completedCount) completedCount.textContent = counts.completed;
    if (cancelledCount) cancelledCount.textContent = counts.cancelled;
}

// Export the functions
export {
    renderOrderList,
    hideOrderDetails,
    renderTrackingModal,
    showTrackingModal,
    hideTrackingModal,
    updateOrderCountSummary,
    renderOrderDetails,
    showOrderDetails,
    highlightSelectedOrder,
    formatCurrency
}; 