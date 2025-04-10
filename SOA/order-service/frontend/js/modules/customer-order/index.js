// Main customer order module
import { domElements } from './dom-elements.js';
import { loadOrders, getOrderCounts, getOrderById, setSelectedOrder } from './order-service.js';
import { renderOrderList, updateOrderCountSummary, renderOrderDetails, showOrderDetails, highlightSelectedOrder } from './ui-renderer.js';
import { setupEventListeners } from './event-handlers.js';

/**
 * Initialize the customer order page
 */
async function initCustomerPage() {
    console.log('Initializing customer order page...');
    
    // Set up event listeners
    setupEventListeners();
    
    try {
        // Get URL parameters for table_id and order_id
        const urlParams = new URLSearchParams(window.location.search);
        const tableId = urlParams.get('table_id');
        const orderId = urlParams.get('order_id');
        
        console.log(`URL Parameters - table_id: ${tableId}, order_id: ${orderId}`);
        
        // Update the table number in the UI
        if (tableId) {
            console.log(`Table ID found in URL: ${tableId}`);
            document.getElementById('tableNumber').textContent = tableId;
        } else {
            console.log('No table ID found in URL, displaying default');
            document.getElementById('tableNumber').textContent = 'Unknown';
        }
        
        // Load orders for this table
        console.log(`Loading orders...`);
        await loadOrders();
        
        // Check if we have an order_id parameter
        if (orderId) {
            console.log(`Order ID found in URL: ${orderId}, selecting this order...`);
            
            // Get the order by ID from the loaded orders
            let order = getOrderById(orderId);
            
            if (!order) {
                // If not found in loaded orders, try loading it directly
                console.log(`Order ID ${orderId} not found in loaded orders. Attempting direct fetch...`);
                try {
                    const response = await fetch(`/api/orders/${orderId}`);
                    if (response.ok) {
                        order = await response.json();
                        console.log(`Successfully fetched order directly:`, order);
                    } else {
                        console.error(`Failed to fetch order ${orderId}: ${response.status}`);
                    }
                } catch (fetchError) {
                    console.error(`Error fetching order ${orderId}:`, fetchError);
                }
            }
            
            if (order) {
                console.log(`Order found, displaying details:`, order);
                // Select this order and show its details
                setSelectedOrder(order);
                renderOrderDetails();
                
                // Update order time if available
                if (order.created_at) {
                    document.getElementById('orderTime').textContent = new Date(order.created_at).toLocaleString();
                }
                
                // Update order status
                const orderStatusElement = document.getElementById('orderStatus');
                if (orderStatusElement && order.status) {
                    orderStatusElement.textContent = order.status.charAt(0).toUpperCase() + order.status.slice(1);
                    
                    // Update status style based on current status
                    const statusClasses = {
                        'received': 'bg-blue-100 text-blue-800',
                        'in-progress': 'bg-yellow-100 text-yellow-800',
                        'ready': 'bg-green-100 text-green-800',
                        'delivered': 'bg-purple-100 text-purple-800',
                        'completed': 'bg-gray-100 text-gray-800',
                        'cancelled': 'bg-red-100 text-red-800'
                    };
                    
                    // Remove all status classes
                    Object.values(statusClasses).forEach(cls => {
                        const classes = cls.split(' ');
                        classes.forEach(c => orderStatusElement.classList.remove(c));
                    });
                    
                    // Add appropriate status class
                    const statusClass = statusClasses[order.status.toLowerCase()] || statusClasses['received'];
                    statusClass.split(' ').forEach(c => orderStatusElement.classList.add(c));
                }
                
                // Update progress bar
                updateProgressBar(order.status);
                
                // Show the order ID message if it exists
                const orderIdMessageElement = document.getElementById('orderIdMessage');
                const displayOrderIdElement = document.getElementById('displayOrderId');
                
                if (orderIdMessageElement && displayOrderIdElement) {
                    displayOrderIdElement.textContent = orderId;
                    orderIdMessageElement.classList.remove('hidden');
                }
            } else {
                console.warn(`Order ID ${orderId} not found`);
            }
        } else {
            console.log('No order ID found in URL parameters');
        }
        
        console.log('Customer order page initialized successfully');
    } catch (error) {
        console.error('Error initializing customer order page:', error);
    }
}

/**
 * Update the progress bar based on order status
 */
function updateProgressBar(status) {
    const progressBar = document.getElementById('statusProgress');
    const statusSteps = document.querySelectorAll('.flex.justify-between.mt-4 .text-center .w-4');
    
    if (!progressBar || statusSteps.length === 0) {
        console.warn('Progress bar elements not found');
        return;
    }
    
    // Default to 'new' (20%)
    let progressWidth = '20%';
    let activeIndex = 0;
    
    switch(status?.toLowerCase()) {
        case 'received':
            progressWidth = '40%';
            activeIndex = 1;
            break;
        case 'in-progress':
            progressWidth = '60%';
            activeIndex = 2;
            break;
        case 'ready':
            progressWidth = '80%';
            activeIndex = 3;
            break;
        case 'delivered':
        case 'completed':
            progressWidth = '100%';
            activeIndex = 4;
            break;
        default:
            progressWidth = '20%';
            activeIndex = 0;
    }
    
    // Update progress bar width
    progressBar.style.width = progressWidth;
    
    // Update status indicators
    statusSteps.forEach((step, index) => {
        if (index <= activeIndex) {
            step.classList.remove('bg-gray-200');
            step.classList.add('bg-blue-500');
        } else {
            step.classList.remove('bg-blue-500');
            step.classList.add('bg-gray-200');
        }
    });
}

// Export the initialization function
export { initCustomerPage };