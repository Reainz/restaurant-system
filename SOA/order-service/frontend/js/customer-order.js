// Main customer-order.js file - Now only for viewing existing orders
import { showNotification } from './utils/notifications.js'; // Import the function

document.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing customer order view page...');
    initCustomerOrderViewPage();
});

function initCustomerOrderViewPage() {
    const urlParams = new URLSearchParams(window.location.search);
    const orderId = urlParams.get('order_id');
    const tableId = urlParams.get('table_id'); // Keep tableId for context if needed

    console.log(`URL Parameters - order_id: ${orderId}, table_id: ${tableId}`);

    if (!orderId) {
        console.error('No order_id found in URL. Cannot display order details.');
        // Optionally redirect or show an error message on the page
        document.body.innerHTML = '<p class="text-red-500 p-4">Error: No Order ID specified.</p>';
        return;
    }

    // Fetch and display the specific order
    fetchOrderDetails(orderId);

    // Setup event listener ONLY for the cancel button (if needed)
    setupCancelButtonListener(orderId);
    
    console.log('Customer order view page initialized successfully');
}

async function fetchOrderDetails(orderId) {
    try {
        const url = window.buildApiUrl(`orders/${orderId}`);
        console.log(`Fetching order details from: ${url}`);
        
        const response = await fetch(url, {
            method: 'GET',
            headers: window.API_CONFIG.DEFAULT_HEADERS
        });

        if (!response.ok) {
            if (response.status === 404) {
                throw new Error(`Order with ID ${orderId} not found.`);
            }
            throw new Error(`API request failed with status ${response.status}`);
        }

        const order = await response.json();
        console.log('Successfully fetched order details:', order);
        
        // Update UI with fetched data
        displayOrderDetails(order);
        updateOrderStatusUI(order.status); // Use a more specific function name
        updateStatusTracker(order.status);

    } catch (err) {
        console.error(`Failed to fetch order ${orderId}:`, err);
        // Display error on the page
        document.getElementById('orderItems').innerHTML = 
            `<p class="text-red-500 py-4">Error loading order details: ${err.message}</p>`;
        document.getElementById('orderStatus').textContent = 'Error';
        document.getElementById('orderStatus').className = 'px-3 py-1 rounded-full text-sm font-semibold bg-red-100 text-red-800';
    }
}

// Helper function to display order details (adapted for view-only)
function displayOrderDetails(order) {
    console.log("Inside displayOrderDetails. Order object received:", order); // DEBUG: Log the whole order object
    console.log("Order ID from object:", order.order_id); // DEBUG: Log the specific field
    
    document.getElementById('tableNumber').textContent = order.table_id || 'N/A';
    
    const orderIdElement = document.getElementById('displayOrderId');
    console.log("Element with id 'displayOrderId':", orderIdElement); // DEBUG: Log the found element
    if (orderIdElement) {
        orderIdElement.textContent = order.order_id || 'Not Provided'; // Set text, provide fallback
    } else {
        console.error("Could not find element with id 'displayOrderId'");
    }

    document.getElementById('orderTime').textContent = 
        order.created_at ? new Date(order.created_at).toLocaleString() : 'N/A';
    
    const orderItemsContainer = document.getElementById('orderItems');
    orderItemsContainer.innerHTML = '';
    
    let total = 0;
    
    if (order.items && order.items.length > 0) {
        order.items.forEach(item => {
            const itemPrice = parseFloat(item.price) || 0; // Use parseFloat for currency
            const itemTotal = itemPrice * (item.quantity || 0);
            total += itemTotal;
            
            const itemElement = document.createElement('div');
            itemElement.className = 'py-4 flex justify-between';
            itemElement.innerHTML = `
                <div>
                    <h3 class="font-medium">${item.name || 'Unknown Item'} (ID: ${item.item_id})</h3>
                    <p class="text-sm text-gray-600">₫${itemPrice.toLocaleString()} × ${item.quantity || 0}</p>
                    ${item.notes ? `<p class="text-xs text-gray-500 italic">Notes: ${item.notes}</p>` : ''}
                </div>
                <div class="text-right">
                    <span class="font-medium">₫${itemTotal.toLocaleString()}</span>
                </div>
            `;
            orderItemsContainer.appendChild(itemElement);
        });
    } else {
        orderItemsContainer.innerHTML = '<p class="text-gray-500 py-4">No items found in this order.</p>';
    }
    
    document.getElementById('orderTotal').textContent = `₫${total.toLocaleString()}`;

    // Disable cancel button if order status is not 'received' (or already completed/cancelled)
    const cancelButton = document.getElementById('cancelOrderBtn');
    const currentStatusLower = order.status ? order.status.toLowerCase() : 'unknown';

    if (cancelButton) {
        if (currentStatusLower !== 'received') {
            cancelButton.disabled = true;
            cancelButton.classList.add('opacity-50', 'cursor-not-allowed');
            // Provide more specific text based on status
            if (currentStatusLower === 'completed' || currentStatusLower === 'cancelled') {
                 cancelButton.textContent = `Order ${currentStatusLower}`;
            } else {
                 cancelButton.textContent = 'Cannot Cancel (Not Received)';
            }
        } else {
            // Ensure button is enabled if status *is* received
            cancelButton.disabled = false;
            cancelButton.classList.remove('opacity-50', 'cursor-not-allowed');
            cancelButton.textContent = 'Cancel Order';
        }
    }
}

// Setup event listener for Cancel Button
function setupCancelButtonListener(orderId) {
    const cancelButton = document.getElementById('cancelOrderBtn');
    if (cancelButton) {
        cancelButton.addEventListener('click', () => {
            console.log(`Attempting to cancel order: ${orderId}`);
            // Add confirmation dialog here?
            if (confirm('Are you sure you want to attempt to cancel this order?')) {
                 cancelOrder(orderId);
            }
        });
    }
}

// Function to handle order cancellation API call
async function cancelOrder(orderId) {
    // Use the dedicated POST endpoint for cancellation
    const url = window.buildApiUrl(`orders/${orderId}/cancel`); // Append /cancel to the URL
    console.log(`Sending POST request to cancel: ${url}`);
    try {
        const response = await fetch(url, {
            method: 'POST', // Use POST method
            headers: window.API_CONFIG.DEFAULT_HEADERS
            // No body needed for this endpoint
        });

        if (!response.ok) {
            let errorData;
            try {
                errorData = await response.json();
            } catch (e) {
                 errorData = { detail: `Cancellation request failed with status ${response.status}` };
            }
             throw new Error(errorData.detail || `Cancellation request failed with status ${response.status}`);
        }

        const updatedOrder = await response.json(); // Expect the updated order object
        console.log('Order cancellation successful, updated order:', updatedOrder);
        showNotification('Order cancelled successfully!', 'success');
        
        // Update the UI with the new order details (status will be 'cancelled')
        displayOrderDetails(updatedOrder);
        updateOrderStatusUI(updatedOrder.status);
        updateStatusTracker(updatedOrder.status);

    } catch (error) {
        console.error('Error cancelling order:', error);
        showNotification(`Failed to cancel order: ${error.message}`, 'error');
    }
}


// Helper function to update the order status text and badge style
function updateOrderStatusUI(status) {
    const orderStatusElement = document.getElementById('orderStatus');
    if (!orderStatusElement) return;

    status = status ? status.toLowerCase() : 'unknown';
    let statusText = status.charAt(0).toUpperCase() + status.slice(1);
    let bgColor = 'bg-gray-100';
    let textColor = 'text-gray-800';

    switch (status) {
        case 'received':
            bgColor = 'bg-blue-100'; textColor = 'text-blue-800'; break;
        case 'submitted': // Assuming submitted might be a state
             bgColor = 'bg-cyan-100'; textColor = 'text-cyan-800'; break;
        case 'in-progress':
            bgColor = 'bg-yellow-100'; textColor = 'text-yellow-800'; break;
        case 'ready':
            bgColor = 'bg-purple-100'; textColor = 'text-purple-800'; break;
        case 'delivered':
            bgColor = 'bg-indigo-100'; textColor = 'text-indigo-800'; break;
        case 'completed':
            bgColor = 'bg-green-100'; textColor = 'text-green-800'; break;
        case 'cancelled':
            bgColor = 'bg-red-100'; textColor = 'text-red-800'; break;
        default:
             statusText = 'Unknown'; // Handle unknown status
    }
    
    orderStatusElement.textContent = statusText;
    orderStatusElement.className = `px-3 py-1 rounded-full text-sm font-semibold ${bgColor} ${textColor}`;
}

// Helper function to update the visual status tracker bar and dots
function updateStatusTracker(currentStatus) {
    // Update status list to include 'received' as the first step
    const statuses = ['received', 'submitted', 'in-progress', 'ready', 'delivered', 'completed'];
    const currentStatusLower = currentStatus ? currentStatus.toLowerCase() : '';
    let currentStatusIndex = statuses.indexOf(currentStatusLower);

    // If cancelled, mark all as inactive/red?
    if (currentStatusLower === 'cancelled') {
        // Optionally handle cancelled state visually - e.g., red bar?
         currentStatusIndex = -1; // Indicate no active progress
    }

    const progressPercentage = currentStatusIndex >= 0 ? ((currentStatusIndex + 1) / statuses.length) * 100 : 0;
    
    const progressBar = document.getElementById('statusProgress');
    if (progressBar) {
        progressBar.style.width = `${progressPercentage}%`;
         progressBar.className = `h-2 rounded ${currentStatusLower === 'cancelled' ? 'bg-red-500' : 'bg-blue-500'}`;
    }

    const statusSteps = document.querySelectorAll('.status-step');
    statusSteps.forEach((step, index) => {
        const dot = step.querySelector('.status-dot');
        if (!dot) return;

        const stepStatus = step.dataset.status;
         const stepIndex = statuses.indexOf(stepStatus);

         if (currentStatusLower === 'cancelled') {
             dot.className = 'status-dot w-4 h-4 bg-red-300 rounded-full mx-auto'; // Dim red for cancelled
         } else if (stepIndex <= currentStatusIndex) {
             dot.className = 'status-dot w-4 h-4 bg-blue-500 rounded-full mx-auto'; // Active blue
         } else {
             dot.className = 'status-dot w-4 h-4 bg-gray-200 rounded-full mx-auto'; // Inactive gray
         }
    });
}

// Notification functions (assuming they are in utils/notifications.js or similar)
// Make sure showNotification is globally available or imported if using modules
// Example placeholder if not external:
/*
function showNotification(message, type = 'success') {
    const notification = document.getElementById('notification');
    const notificationMessage = document.getElementById('notificationMessage');
    const notificationContent = document.getElementById('notificationContent');
    const notificationIcon = document.getElementById('notificationIcon');
    const closeBtn = document.getElementById('closeNotificationBtn');

    if (!notification || !notificationMessage || !notificationContent || !notificationIcon || !closeBtn) {
        console.error('Notification elements not found!');
        return;
    }

    notificationMessage.textContent = message;
    notification.classList.remove('opacity-0', 'pointer-events-none');
    notification.classList.add('opacity-100');

    // Style based on type
    let bgColor, borderColor, textColor, iconPath;
    if (type === 'error') {
        bgColor = 'bg-red-100'; borderColor = 'border-red-500'; textColor = 'text-red-700';
        iconPath = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>'; // Error icon
    } else { // Default to success
        bgColor = 'bg-green-100'; borderColor = 'border-green-500'; textColor = 'text-green-700';
        iconPath = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>'; // Check icon
    }
    notificationContent.className = `p-4 rounded shadow-md border-l-4 ${bgColor} ${borderColor} ${textColor}`;
    notificationIcon.innerHTML = iconPath;

    // Auto-hide after 5 seconds
    const timeoutId = setTimeout(() => {
        notification.classList.remove('opacity-100');
        notification.classList.add('opacity-0', 'pointer-events-none');
    }, 5000);

    // Close button
    closeBtn.onclick = () => {
        clearTimeout(timeoutId);
         notification.classList.remove('opacity-100');
        notification.classList.add('opacity-0', 'pointer-events-none');
    };
}
*/