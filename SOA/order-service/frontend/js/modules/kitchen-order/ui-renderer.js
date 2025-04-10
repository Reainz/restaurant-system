// UI Renderer module for kitchen-order.js
import { domElements } from './dom-elements.js';
import { 
    getStatusColorClass, 
    getItemStatusButtonClass, 
    capitalizeFirstLetter, 
    calculateWaitTime,
    formatDate,
    isItemDelayed,
    getLocalStorageData
} from './ui-utils.js';
import { 
    getAllOrders, 
    getSelectedOrder, 
    getActiveStatusFilter,
    getShowHistory,
    setSelectedOrder
} from './order-service.js';

/**
 * Render the order queue
 * @param {Array} orders - The orders to render (defaults to all orders)
 */
function renderOrderQueue(orders = getAllOrders()) {
    if (!orders) return;
    
    const { orderQueue, statusFilter } = domElements;
    if (!orderQueue) return;
    
    const activeFilter = statusFilter ? statusFilter.value : getActiveStatusFilter();
    orderQueue.innerHTML = '';
    
    // Get lists of paused and cancelled orders from localStorage
    const pausedOrders = getLocalStorageData('pausedOrders', []);
    const cancelledOrders = getLocalStorageData('cancelledOrders', []);
    const cancelledOrderIds = cancelledOrders.map(order => order.orderId);
    
    // Filter orders based on current filter and exclusions
    let filteredOrders = [...orders].filter(order => {
        // For active filter, show all non-ready/non-completed orders
        if (activeFilter === 'active') {
            return order.status !== 'ready' && order.status !== 'completed' && order.status !== 'delivered';
        }
        
        // For specific status filter
        if (activeFilter !== 'all') {
            return order.status === activeFilter;
        }
        
        // 'all' filter shows everything
        return true;
    });
    
    // Special handling for cancelled/paused orders in UI-only mode
    if (activeFilter === 'all' || activeFilter === 'active') {
        // Remove in-progress orders that are marked as cancelled in localStorage
        filteredOrders = filteredOrders.filter(order => {
            if (order.status === 'in-progress' && cancelledOrderIds.includes(order.order_id)) {
                // Create a copy of the order with visual status of 'cancelled'
                const cancelledOrder = {...order, visualStatus: 'cancelled'};
                return false; // Remove from normal filter results
            }
            return true;
        });
    }
    
    // Sort orders by creation time (newest first)
    filteredOrders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
    // Render each order in the queue
    filteredOrders.forEach(order => {
        orderQueue.appendChild(createOrderElement(order));
    });
    
    // Update the header counts and summary
    updateOrderQueueSummary();
}

/**
 * Render the order history
 */
function renderOrderHistory() {
    const { orderHistoryContainer } = domElements;
    if (!orderHistoryContainer) return;
    
    orderHistoryContainer.innerHTML = '';
    
    // Show only ready orders in history
    const historyOrders = getAllOrders().filter(order => order.status === 'ready');
    
    if (historyOrders.length === 0) {
        orderHistoryContainer.innerHTML = '<p class="text-gray-500 text-center py-4">No order history found</p>';
        return;
    }
    
    historyOrders.forEach(order => {
        const orderElement = createOrderElement(order);
        orderHistoryContainer.appendChild(orderElement);
    });
}

/**
 * Create an order element for the queue
 * @param {Object} order - The order to create an element for
 * @returns {HTMLElement} - The created element
 */
function createOrderElement(order) {
    const orderElement = document.createElement('div');
    
    // Determine if this is a delayed order
    const orderCreatedAt = new Date(order.created_at);
    const waitTimeMinutes = calculateWaitTime(orderCreatedAt);
    const isDelayed = waitTimeMinutes > 20 && order.status !== 'completed' && order.status !== 'ready';
    
    // Determine special status classes
    let specialStatusClass = '';
    if (order.visualStatus === 'cancelled') {
        specialStatusClass = 'border-red-500 bg-red-50';
    } else if (order.visualStatus === 'paused') {
        specialStatusClass = 'border-orange-500 bg-orange-50';
    } else if (isDelayed) {
        specialStatusClass = 'border-orange-500 bg-orange-50';
    } else {
        specialStatusClass = `border-${getStatusColorClass(order.status).replace('bg-', '')}`;
    }
    
    // Base class is always applied, special status may add more
    orderElement.className = `p-4 mb-4 rounded-lg shadow border-l-4 bg-white cursor-pointer ${specialStatusClass}`;
    orderElement.setAttribute('data-order-id', order.order_id);
    
    // Format the time since order was placed
    const formattedTime = formatDate(order.created_at);
    
    // Count items with their statuses
    const itemStatusCounts = {};
    order.items.forEach(item => {
        if (!item.status) item.status = 'received'; // Default status
        itemStatusCounts[item.status] = (itemStatusCounts[item.status] || 0) + 1;
    });
    
    // Create HTML content for the order
    orderElement.innerHTML = `
        <div class="flex justify-between items-start">
            <div>
                <h3 class="text-lg font-semibold">Table ${order.table_id}</h3>
                <p class="text-sm text-gray-600">Order #${order.order_id.substring(0, 8)}</p>
                <p class="text-xs text-gray-500">${formattedTime} (${waitTimeMinutes} min ago)</p>
            </div>
            <div>
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColorClass(order.status)} text-white">
                    ${capitalizeFirstLetter(order.visualStatus || order.status)}
                </span>
                ${isDelayed ? `
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-500 text-white ml-1">
                        Delayed
                    </span>
                ` : ''}
            </div>
        </div>
        
        <div class="mt-2">
            <p class="font-medium">Items:</p>
            <div class="flex flex-wrap gap-1 mt-1">
                ${Object.entries(itemStatusCounts).map(([status, count]) => `
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColorClass(status)} text-white">
                        ${capitalizeFirstLetter(status)}: ${count}
                    </span>
                `).join('')}
            </div>
        </div>
        
        ${order.special_instructions ? `
            <div class="mt-2 bg-yellow-50 p-2 rounded text-sm">
                <p class="font-medium">Special Instructions:</p>
                <p>${order.special_instructions}</p>
            </div>
        ` : ''}
    `;
    
    // Add click event listener
    orderElement.addEventListener('click', () => {
        // Get the updated order from the data store (in case it changed)
        selectOrder(order);
    });
    
    return orderElement;
}

/**
 * Update the order queue summary statistics
 */
function updateOrderQueueSummary() {
    const { 
        newOrdersCount, 
        inProgressCount, 
        readyCount, 
        completedCount, 
        delayedCount, 
        avgWaitTime 
    } = domElements;
    
    const allOrders = getAllOrders();
    
    // Count orders by status
    const receivedCount = allOrders.filter(order => order.status === 'received').length;
    const inProgressOrdersCount = allOrders.filter(order => order.status === 'in-progress').length;
    const readyOrdersCount = allOrders.filter(order => order.status === 'ready').length;
    const completedOrdersCount = allOrders.filter(order => order.status === 'completed').length;
    
    // Count delayed orders (not completed/ready and over 20 minutes old)
    const delayedOrdersCount = allOrders.filter(order => {
        if (order.status === 'completed' || order.status === 'ready') return false;
        return calculateWaitTime(order.created_at) > 20;
    }).length;
    
    // Calculate average wait time for non-completed orders
    const activeOrders = allOrders.filter(order => 
        order.status !== 'completed' && order.status !== 'cancelled'
    );
    
    let totalWaitTime = 0;
    activeOrders.forEach(order => {
        totalWaitTime += calculateWaitTime(order.created_at);
    });
    
    const averageWaitTime = activeOrders.length > 0 
        ? Math.round(totalWaitTime / activeOrders.length) 
        : 0;
    
    // Update DOM elements if they exist
    if (newOrdersCount) newOrdersCount.textContent = receivedCount;
    if (inProgressCount) inProgressCount.textContent = inProgressOrdersCount;
    if (readyCount) readyCount.textContent = readyOrdersCount;
    if (completedCount) completedCount.textContent = completedOrdersCount;
    if (delayedCount) delayedCount.textContent = delayedOrdersCount;
    if (avgWaitTime) avgWaitTime.textContent = `${averageWaitTime} min`;
}

/**
 * Select an order and show its details
 * @param {Object} order - The order to select
 */
function selectOrder(order) {
    // Update selected order
    setSelectedOrder(order);
    
    // Highlight selected order in the queue
    document.querySelectorAll('[data-order-id]').forEach(el => {
        el.classList.remove('ring-2', 'ring-blue-500');
    });
    
    const selectedElement = document.querySelector(`[data-order-id="${order.order_id}"]`);
    if (selectedElement) {
        selectedElement.classList.add('ring-2', 'ring-blue-500');
    }
    
    // Render order details
    renderOrderDetails();
    
    // Show order detail panel
    const { orderDetailPanel } = domElements;
    if (orderDetailPanel) {
        orderDetailPanel.classList.remove('hidden');
    }
}

/**
 * Render order details
 */
function renderOrderDetails() {
    const { 
        orderTimeElement,
        orderIdElement,
        tableNumberElement,
        orderStatusElement,
        specialInstructionsElement,
        kitchenNotesElement
    } = domElements;
    
    const order = getSelectedOrder();
    if (!order) return;
    
    // Update order details in the UI
    if (orderTimeElement) {
        const orderTime = new Date(order.created_at);
        const waitTime = calculateWaitTime(orderTime);
        orderTimeElement.textContent = `${formatDate(order.created_at)} (${waitTime} min ago)`;
    }
    
    if (orderIdElement) orderIdElement.textContent = order.order_id;
    if (tableNumberElement) tableNumberElement.textContent = order.table_id;
    
    if (orderStatusElement) {
        orderStatusElement.textContent = capitalizeFirstLetter(order.status);
        orderStatusElement.className = `px-2 py-1 rounded text-white text-sm ${getStatusColorClass(order.status)}`;
    }
    
    if (specialInstructionsElement) {
        specialInstructionsElement.textContent = order.special_instructions || 'None';
    }
    
    if (kitchenNotesElement) {
        kitchenNotesElement.value = order.kitchen_notes || '';
    }
    
    // Render order items
    renderOrderItems();
    
    // Update action buttons based on order status
    updateActionButtons();
}

/**
 * Render order items
 */
function renderOrderItems() {
    const { orderItemsElement } = domElements;
    if (!orderItemsElement) return;
    
    const order = getSelectedOrder();
    if (!order || !order.items) return;
    
    orderItemsElement.innerHTML = '';
    
    // Render each item with status controls
    order.items.forEach(item => {
        const itemElement = document.createElement('div');
        itemElement.className = 'p-3 border rounded mb-2 flex justify-between items-center';
        itemElement.setAttribute('data-item-id', item.item_id);
        
        // Check if item is delayed
        const isDelayed = isItemDelayed(item);
        
        // Create HTML content for the item
        itemElement.innerHTML = `
            <div>
                <div class="flex items-center">
                    <span class="font-medium">${item.name}</span>
                    <span class="text-gray-600 ml-2">× ${item.quantity}</span>
                    ${isDelayed ? `
                        <span class="ml-2 bg-orange-100 text-orange-800 text-xs px-2 py-0.5 rounded">
                            Delayed
                        </span>
                    ` : ''}
                </div>
                ${item.notes ? `<p class="text-sm text-gray-600 mt-0.5">${item.notes}</p>` : ''}
            </div>
            
            <div class="flex space-x-1">
                <button
                    class="px-2 py-1 text-xs rounded ${getItemStatusButtonClass('received')} ${item.status === 'received' ? 'ring-2 ring-blue-500' : ''}"
                    data-status="received"
                    data-item-id="${item.item_id}"
                >
                    Received
                </button>
                <button
                    class="px-2 py-1 text-xs rounded ${getItemStatusButtonClass('in-progress')} ${item.status === 'in-progress' ? 'ring-2 ring-yellow-500' : ''}"
                    data-status="in-progress"
                    data-item-id="${item.item_id}"
                >
                    In Progress
                </button>
                <button
                    class="px-2 py-1 text-xs rounded ${getItemStatusButtonClass('ready')} ${item.status === 'ready' ? 'ring-2 ring-green-500' : ''}"
                    data-status="ready"
                    data-item-id="${item.item_id}"
                >
                    Ready
                </button>
            </div>
        `;
        
        orderItemsElement.appendChild(itemElement);
    });
}

/**
 * Update action buttons based on order status
 */
function updateActionButtons() {
    const { startAllBtn, markReadyBtn, pauseOrderBtn, cancelOrderBtn } = domElements;
    
    const order = getSelectedOrder();
    if (!order) return;
    
    const status = order.status;
    
    // Start All Items button
    if (startAllBtn) {
        const canStart = status === 'received';
        startAllBtn.disabled = !canStart;
        
        if (canStart) {
            startAllBtn.classList.remove('bg-gray-400', 'cursor-not-allowed');
            startAllBtn.classList.add('bg-blue-500', 'hover:bg-blue-600');
        } else {
            startAllBtn.classList.remove('bg-blue-500', 'hover:bg-blue-600');
            startAllBtn.classList.add('bg-gray-400', 'cursor-not-allowed');
        }
    }
    
    // Mark Ready button
    if (markReadyBtn) {
        const canMarkReady = status === 'in-progress';
        markReadyBtn.disabled = !canMarkReady;
        
        if (canMarkReady) {
            markReadyBtn.classList.remove('bg-gray-400', 'cursor-not-allowed');
            markReadyBtn.classList.add('bg-green-500', 'hover:bg-green-600');
        } else {
            markReadyBtn.classList.remove('bg-green-500', 'hover:bg-green-600');
            markReadyBtn.classList.add('bg-gray-400', 'cursor-not-allowed');
        }
    }
    
    // Pause Order button
    if (pauseOrderBtn) {
        const canPause = status === 'in-progress' || status === 'received';
        pauseOrderBtn.disabled = !canPause;
        
        if (canPause) {
            pauseOrderBtn.classList.remove('bg-gray-400', 'cursor-not-allowed');
            pauseOrderBtn.classList.add('bg-orange-500', 'hover:bg-orange-600');
        } else {
            pauseOrderBtn.classList.remove('bg-orange-500', 'hover:bg-orange-600');
            pauseOrderBtn.classList.add('bg-gray-400', 'cursor-not-allowed');
        }
    }
    
    // Cancel Order button
    if (cancelOrderBtn) {
        const canCancel = status !== 'completed' && status !== 'cancelled';
        cancelOrderBtn.disabled = !canCancel;
        
        if (canCancel) {
            cancelOrderBtn.classList.remove('bg-gray-400', 'cursor-not-allowed');
            cancelOrderBtn.classList.add('bg-red-500', 'hover:bg-red-600');
        } else {
            cancelOrderBtn.classList.remove('bg-red-500', 'hover:bg-red-600');
            cancelOrderBtn.classList.add('bg-gray-400', 'cursor-not-allowed');
        }
    }
}

// Export UI render functions
export {
    renderOrderQueue,
    renderOrderHistory,
    createOrderElement,
    updateOrderQueueSummary,
    selectOrder,
    renderOrderDetails,
    renderOrderItems,
    updateActionButtons
}; 