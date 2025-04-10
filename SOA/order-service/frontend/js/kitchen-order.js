// kitchen-order.js - Entry point for kitchen order functionality
// This file now works in a non-module context

// Initialize the page when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing kitchen order page...');
    
    // Use global functions loaded via script tags
    initKitchenPage();
});

// Main initialization function
function initKitchenPage() {
    console.log('Initializing kitchen dashboard...');
    
    // Load initial data based on the default filter ('active')
    fetchAndDisplayOrders();
    
    // Set up periodic refresh based on the current filter
    setInterval(fetchAndDisplayOrders, 15000); // Refresh every 15 seconds
    
    // Add listener for the status filter dropdown
    const statusFilter = document.getElementById('statusFilter');
    if (statusFilter) {
        statusFilter.addEventListener('change', fetchAndDisplayOrders); // Fetch when filter changes
    }
    
    console.log('Kitchen order page initialized successfully');
    
    // Add listeners for bottom action buttons
    setupBottomActionButtons();
}

// Function to set up bottom action button listeners
function setupBottomActionButtons() {
    const startBtn = document.getElementById('startAllBtn'); // Renaming for clarity, assumed this means start cooking for the selected order
    const readyBtn = document.getElementById('markReadyBtn');
    const pauseBtn = document.getElementById('pauseOrderBtn'); // Assuming pause functionality exists or needs adding
    const cancelBtn = document.getElementById('cancelOrderBtn'); // Assuming cancel functionality exists or needs adding

    if (startBtn) {
        startBtn.addEventListener('click', () => {
            const selectedOrderId = getSelectedOrderId();
            if (selectedOrderId) {
                console.log(`Start Cooking button clicked for order: ${selectedOrderId}`);
                updateOrderStatus(selectedOrderId, 'in-progress');
            } else {
                displayError('No order selected to start cooking.');
            }
        });
    }

    if (readyBtn) {
        readyBtn.addEventListener('click', () => {
            const selectedOrderId = getSelectedOrderId();
            if (selectedOrderId) {
                console.log(`Mark Ready button clicked for order: ${selectedOrderId}`);
                updateOrderStatus(selectedOrderId, 'ready');
            } else {
                displayError('No order selected to mark as ready.');
            }
        });
    }

    if (pauseBtn) {
        pauseBtn.addEventListener('click', () => {
            const selectedOrderId = getSelectedOrderId();
            if (selectedOrderId) {
                console.warn(`Pause Order functionality now implemented for order: ${selectedOrderId}`);
                updateOrderStatus(selectedOrderId, 'paused');
            } else {
                displayError('No order selected to pause.');
            }
        });
    }

    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            const selectedOrderId = getSelectedOrderId();
            if (selectedOrderId) {
                console.warn(`Cancel Order functionality now implemented for order: ${selectedOrderId}`);
                updateOrderStatus(selectedOrderId, 'cancelled');
            } else {
                displayError('No order selected to cancel.');
            }
        });
    }
    
    // Initially disable all buttons until an order is selected
    setBottomActionButtonsState(null);
}

// Helper function to get the currently displayed order ID from the details panel
function getSelectedOrderId() {
    const orderIdEl = document.getElementById('orderId');
    // We store the full ID on the panel itself as data attribute for easier retrieval
    const panel = document.getElementById('orderDetailPanel'); 
    return panel ? panel.getAttribute('data-current-order-id') : null;
}

// Helper function to enable/disable bottom buttons based on order status
function setBottomActionButtonsState(status) {
    const startBtn = document.getElementById('startAllBtn');
    const readyBtn = document.getElementById('markReadyBtn');
    const pauseBtn = document.getElementById('pauseOrderBtn');
    const cancelBtn = document.getElementById('cancelOrderBtn');
    
    // Disable all by default if no status or null status
    if (startBtn) startBtn.disabled = true;
    if (readyBtn) readyBtn.disabled = true;
    if (pauseBtn) pauseBtn.disabled = true;
    if (cancelBtn) cancelBtn.disabled = true;

    if (!status) return; // No order selected or status unknown

    // Enable based on status
    if (status === 'received') {
        if (startBtn) startBtn.disabled = false;
        if (cancelBtn) cancelBtn.disabled = false;
    }
    if (status === 'in-progress') {
        if (readyBtn) readyBtn.disabled = false;
        if (pauseBtn) pauseBtn.disabled = false;
        if (cancelBtn) cancelBtn.disabled = false;
    }
    if (status === 'paused') {
        // When paused, allow resuming (Start becomes Resume) or cancelling
        if (startBtn) {
             startBtn.textContent = 'Resume Order'; // Change button text
             startBtn.disabled = false; 
        }
        if (cancelBtn) cancelBtn.disabled = false;
    } else {
        // Reset Start button text if not paused
        if (startBtn) startBtn.textContent = 'Start All Items';
    }
    // If status is 'ready', 'cancelled', 'delivered', 'completed', all kitchen actions likely disabled
}

// Fetch and display orders based on the selected filter
async function fetchAndDisplayOrders() {
    const statusFilterElement = document.getElementById('statusFilter');
    const selectedFilterValue = statusFilterElement ? statusFilterElement.value : 'active'; // Default to 'active'

    let statuses = [];
    let fetchAll = false;

    switch (selectedFilterValue) {
        case 'active':
            statuses = ['received', 'in-progress', 'ready'];
            break;
        case 'all':
            fetchAll = true;
            break;
        case 'received':
        case 'in-progress':
        case 'paused':
        case 'ready':
        case 'cancelled':
            statuses = [selectedFilterValue];
            break;
        default:
            console.warn(`Unknown filter value: ${selectedFilterValue}, defaulting to active.`);
            statuses = ['received', 'in-progress', 'ready'];
            break;
    }

    try {
        // Build the base URL
        const baseUrl = window.buildApiUrl('orders');
        let url;

        if (fetchAll) {
            url = baseUrl; // Fetch all orders without status filter
        } else {
            // Create URLSearchParams object for specific statuses
            const params = new URLSearchParams();
            statuses.forEach(status => params.append('status', status));
            url = `${baseUrl}?${params.toString()}`;
        }
        
        console.log(`Fetching orders from: ${url}`);
        
        const response = await fetch(url, {
            method: 'GET',
            headers: window.API_CONFIG.DEFAULT_HEADERS
        });
        
        if (!response.ok) {
            throw new Error(`API request failed with status ${response.status}`);
        }
        
        const data = await response.json();
        if (data && data.orders) {
            displayOrders(data.orders);
            updateOrderCounts(data.orders); // Update counts based on fetched orders
        } else {
            displayNoOrdersMessage(selectedFilterValue); // Pass filter to potentially customize message
        }
    } catch (error) {
        console.error('Error loading orders:', error);
        displayError('Failed to load orders. Please try again.');
    }
}

// Display orders (minor update to handle different container logic if needed)
function displayOrders(orders) {
    console.log('Received orders for display based on filter:', orders); 
    
    // Clear existing order cards first
    const pendingOrdersContainer = document.getElementById('pendingOrders');
    const preparedOrdersContainer = document.getElementById('preparedOrders');
    // Consider adding a dedicated container for Paused/Cancelled/Completed if needed,
    // or just display all in one list when not using 'active' filter.
    // For simplicity now, we'll use the pending container for most non-ready statuses.

    if (!pendingOrdersContainer || !preparedOrdersContainer) {
        console.error('Error: Could not find order container elements!');
        return;
    }

    pendingOrdersContainer.innerHTML = ''; // Clear previous pending/other orders
    preparedOrdersContainer.innerHTML = ''; // Clear previous prepared orders

    if (orders.length === 0) {
        displayNoOrdersMessage(document.getElementById('statusFilter').value);
        updateOrderCounts([]); // Ensure counts reset if no orders match
        return;
    }
    
    // Sort orders by creation time (newest first)
    try {
        orders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    } catch (e) {
        console.error('Error sorting orders:', e, orders);
    }
    
    // Display orders in appropriate sections (simplified logic)
    let hasPending = false;
    let hasPrepared = false;
    orders.forEach(order => {
        const orderCard = createOrderCard(order);
        if (order.status === 'ready') { // Only 'ready' goes to prepared
            preparedOrdersContainer.appendChild(orderCard);
            hasPrepared = true;
        } else { // All others (received, in-progress, paused, cancelled, completed if fetched) go to pending/main list
            pendingOrdersContainer.appendChild(orderCard);
            hasPending = true;
        }
    });

    // Show messages if sections are empty after filtering
    if (!hasPending) {
         pendingOrdersContainer.innerHTML = '<p class="text-gray-500 text-center py-4">No orders match this status.</p>';
    }
     if (!hasPrepared && document.getElementById('statusFilter').value === 'active') { // Only show prepared message if active filter
         preparedOrdersContainer.innerHTML = '<p class="text-gray-500 text-center py-4">No prepared orders.</p>';
     } else if (!hasPrepared) {
         // Hide or clear the prepared container if the filter isn't active and there are no ready orders
         preparedOrdersContainer.innerHTML = ''; 
     }
    
    // Select the first order in the list if available
    if (orders.length > 0) {
        const firstOrderCard = pendingOrdersContainer.querySelector('.order-card') || preparedOrdersContainer.querySelector('.order-card');
        if (firstOrderCard) {
             const firstOrderId = firstOrderCard.dataset.orderId;
             // Find the corresponding order object to pass to displayOrderDetails
             const firstOrder = orders.find(o => o.order_id === firstOrderId);
             if(firstOrder) {
                displayOrderDetails(firstOrder);
                firstOrderCard.classList.add('selected-order'); // Highlight the first card
             } 
        }
    } else {
        // Clear details panel if no orders
        displayOrderDetails(null); 
    }
}

// Create HTML for an order card
function createOrderCard(order) {
    const card = document.createElement('div');
    card.className = 'order-card p-3 border rounded-lg cursor-pointer hover:bg-gray-100 transition-colors'; // Base classes
    card.dataset.orderId = order.order_id;

    // Add selected class if this order is currently shown in details
    const currentDetailId = getSelectedOrderId();
    if (order.order_id === currentDetailId) {
        card.classList.add('selected-order');
    }

    const statusBadgeClass = getStatusBadgeClass(order.status);
    const formattedStatus = formatStatus(order.status);
    const timeAgo = calculateTimeAgo(order.created_at);

    card.innerHTML = `
        <div class="flex justify-between items-center mb-1">
            <span class="font-semibold text-sm">Order #${order.order_id.substring(0, 8)}</span>
            <span class="text-xs text-gray-500">${timeAgo}</span>
        </div>
        <div class="text-xs text-gray-600 mb-2">Table: ${order.table_id || 'N/A'}</div>
        <div class="flex justify-between items-center">
            <span class="${statusBadgeClass} px-2 py-0.5 rounded text-xs font-medium">${formattedStatus}</span>
        </div>
    `;

    // Add click listener to display details
    card.addEventListener('click', () => {
        // Remove selected class from previously selected card
        const currentlySelected = document.querySelector('.selected-order');
        if (currentlySelected) {
            currentlySelected.classList.remove('selected-order');
        }
        // Add selected class to this card
        card.classList.add('selected-order');
        displayOrderDetails(order);
    });

    return card;
}

// Update order status via API
async function updateOrderStatus(orderId, status) {
    if (!orderId) {
        displayError('Cannot update status: No order selected.');
        return;
    }
    console.log(`Updating order ${orderId} to status: ${status}`);

    try {
        const url = window.buildApiUrl(`orders/${orderId}/status`);
        const response = await fetch(url, {
            method: 'PUT',
            headers: window.API_CONFIG.DEFAULT_HEADERS,
            body: JSON.stringify({ status: status })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ detail: 'Failed to update status. Unknown error.' }));
            throw new Error(errorData.detail || `API request failed with status ${response.status}`);
        }

        const updatedOrder = await response.json();
        console.log('Order status updated successfully:', updatedOrder);
        displaySuccess(`Order ${orderId.substring(0,8)} status updated to ${formatStatus(status)}.`);
        
        // Refresh the order list based on the current filter
        fetchAndDisplayOrders(); 
        
        // Update details panel if the updated order is the one being shown
        const currentDetailId = getSelectedOrderId();
        if (updatedOrder && updatedOrder.order_id === currentDetailId) {
            displayOrderDetails(updatedOrder); // Refresh details panel
        }

    } catch (error) {
        console.error('Error updating order status:', error);
        displayError(`Failed to update status: ${error.message}`);
    }
}

// Update the counts in the summary boxes
function updateOrderCounts(orders) {
    const counts = {
        received: 0,
        'in-progress': 0,
        ready: 0,
        completed: 0, // Assuming completed might be fetched with 'all'
        paused: 0,
        cancelled: 0,
        delayed: 0 // Placeholder, logic not implemented
    };

    orders.forEach(order => {
        if (counts.hasOwnProperty(order.status)) {
            counts[order.status]++;
        } else {
            console.warn(`Unknown status found in orders: ${order.status}`);
        }
    });

    document.getElementById('newOrdersCount').textContent = counts.received;
    document.getElementById('inProgressCount').textContent = counts['in-progress'];
    document.getElementById('readyCount').textContent = counts.ready;
    document.getElementById('completedCount').textContent = counts.completed;
    // Update counts for paused/cancelled if needed in UI (currently only delayed shown)
    // document.getElementById('pausedCount').textContent = counts.paused;
    // document.getElementById('cancelledCount').textContent = counts.cancelled;
    document.getElementById('delayedCount').textContent = counts.delayed; // Keep as 0 for now
    
    // Calculate and update average wait time (placeholder)
    // updateAverageWaitTime(orders);
}

// Display a message when no orders match the filter
function displayNoOrdersMessage(filterValue) {
    const pendingContainer = document.getElementById('pendingOrders');
    const preparedContainer = document.getElementById('preparedOrders');
    let message = 'No orders match the current filter.';

    if (filterValue === 'active') {
        message = 'No active orders found.';
    }
    
    if(pendingContainer) pendingContainer.innerHTML = `<p class="text-gray-500 text-center py-4">${message}</p>`;
    if(preparedContainer && filterValue === 'active') { // Only clear prepared if active filter shows nothing
        preparedContainer.innerHTML = '<p class="text-gray-500 text-center py-4">No prepared orders.</p>';
    } else if (preparedContainer) {
         preparedContainer.innerHTML = ''; // Hide prepared if filter isn't active
    }
    
    // Clear details panel
    displayOrderDetails(null);
    // Reset counts
    updateOrderCounts([]);
}

// Show a success notification
function displaySuccess(message) {
    const notification = document.getElementById('notification');
    const messageElement = document.getElementById('notificationMessage');
    if (!notification || !messageElement) return;

    messageElement.textContent = message;
    notification.classList.remove('opacity-0', 'pointer-events-none');
    notification.classList.add('opacity-100');

    // Hide after 3 seconds
    setTimeout(() => {
        notification.classList.remove('opacity-100');
        notification.classList.add('opacity-0', 'pointer-events-none');
    }, 3000);
}

// Show an error notification (similar structure to success)
function displayError(message) {
     // Reuse notification element, change style for error
    const notification = document.getElementById('notification');
    const messageElement = document.getElementById('notificationMessage');
    const notificationContent = notification ? notification.querySelector('div[class*="bg-"]') : null; // Get the colored div

    if (!notification || !messageElement || !notificationContent) return;

    messageElement.textContent = message;
    // Change colors for error
    notificationContent.className = 'bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded shadow-md'; 
    
    notification.classList.remove('opacity-0', 'pointer-events-none');
    notification.classList.add('opacity-100');

    // Hide after 5 seconds for errors
    setTimeout(() => {
        notification.classList.remove('opacity-100');
        notification.classList.add('opacity-0', 'pointer-events-none');
        // Reset to success colors after hiding
         setTimeout(() => {
            notificationContent.className = 'bg-green-100 border-l-4 border-green-500 text-green-700 p-4 rounded shadow-md';
         }, 500); // Delay reset slightly
    }, 5000);
}

// Get Tailwind class for status badge
function getStatusBadgeClass(status) {
    switch (status) {
        case 'received': return 'bg-blue-100 text-blue-800';
        case 'in-progress': return 'bg-yellow-100 text-yellow-800';
        case 'paused': return 'bg-gray-100 text-gray-800';
        case 'ready': return 'bg-green-100 text-green-800';
        case 'delivered': return 'bg-purple-100 text-purple-800';
        case 'completed': return 'bg-indigo-100 text-indigo-800';
        case 'cancelled': return 'bg-red-100 text-red-800';
        default: return 'bg-gray-100 text-gray-800';
    }
}

// Format status string for display
function formatStatus(status) {
    if (!status) return 'Unknown';
    return status.replace('-', ' ').split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

// Display details of a selected order
function displayOrderDetails(order) {
    const panel = document.getElementById('orderDetailPanel');
    const orderIdEl = document.getElementById('orderId');
    const tableNumberEl = document.getElementById('tableNumber');
    const orderStatusEl = document.getElementById('orderStatus');
    const orderTimeEl = document.getElementById('orderTime');
    const orderItemsEl = document.getElementById('orderItems');
    const specialInstructionsEl = document.getElementById('specialInstructions');
    const kitchenNotesEl = document.getElementById('kitchenNotes');

    if (!order) {
        // Clear details if no order is selected
        orderIdEl.textContent = '---';
        tableNumberEl.textContent = '--';
        orderStatusEl.textContent = '---';
        orderStatusEl.className = 'font-semibold ml-1 px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-800';
        orderTimeEl.textContent = '--:--';
        orderItemsEl.innerHTML = '<p class="text-gray-500">Select an order to view items</p>';
        specialInstructionsEl.textContent = 'No special instructions';
        kitchenNotesEl.value = '';
        panel.removeAttribute('data-current-order-id'); // Clear stored ID
        setBottomActionButtonsState(null); // Disable buttons
        return;
    }

    // Store the current order ID on the panel
    panel.setAttribute('data-current-order-id', order.order_id);

    // Populate details
    orderIdEl.textContent = order.order_id.substring(0, 8);
    tableNumberEl.textContent = order.table_id || 'N/A';
    orderStatusEl.textContent = formatStatus(order.status);
    orderStatusEl.className = `font-semibold ml-1 px-2 py-0.5 rounded text-xs ${getStatusBadgeClass(order.status)}`;
    orderTimeEl.textContent = new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    // Populate items
    if (order.items && order.items.length > 0) {
        orderItemsEl.innerHTML = order.items.map(item => `
            <div class="p-2 border-b last:border-b-0">
                <div class="flex justify-between items-center">
                    <span class="font-medium text-sm">${item.name || 'Unknown Item'} (x${item.quantity})</span>
                    <span class="text-xs ${getStatusBadgeClass(item.status)}">${formatStatus(item.status || 'pending')}</span>
                </div>
                ${item.notes ? `<p class="text-xs text-gray-600 mt-1">Notes: ${item.notes}</p>` : ''}
            </div>
        `).join('');
    } else {
        orderItemsEl.innerHTML = '<p class="text-gray-500">No items in this order.</p>';
    }

    // Populate special instructions
    specialInstructionsEl.textContent = order.special_instructions || 'No special instructions';
    
    // Populate kitchen notes (if available, otherwise clear)
    // Assuming notes are stored directly on the order object - adjust if stored elsewhere
    kitchenNotesEl.value = order.kitchen_notes || ''; 
    
    // Update button states based on the selected order's status
    setBottomActionButtonsState(order.status);
}

// Utility function to calculate time ago
function calculateTimeAgo(timestamp) {
    const now = new Date();
    const past = new Date(timestamp);
    const diffInSeconds = Math.floor((now - past) / 1000);
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    const diffInHours = Math.floor(diffInMinutes / 60);

    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInHours < 24) return `${diffInHours}h ago`;
    return past.toLocaleDateString();
}