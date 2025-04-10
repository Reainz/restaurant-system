// Event handlers module for service-order.js
import { domElements } from './dom-elements.js';
import { showNotification } from '../../utils/notifications.js';
import { filterOrders, saveToCSV } from './utils.js';
import { 
    loadOrders, 
    getOrderById, 
    cancelOrder, 
    markOrderDelivered, 
    completeOrder, 
    createOrder, 
    getAllOrders, 
    getSelectedOrder, 
    generateOrderReport, 
    exportOrdersToCSV 
} from './order-service.js';
import { 
    getSelectedItems, 
    clearSelectedItems 
} from './menu-service.js';
import { 
    generateBill 
} from './table-service.js';
import { 
    renderOrders, 
    showOrderDetails, 
    resetOrderForm 
} from './ui-renderer.js';

/**
 * Set up event listeners
 */
function setupEventListeners() {
    const { 
        statusFilter, 
        tableFilter, 
        timeFilter, 
        searchInput, 
        closeCreateOrderBtn, 
        createOrderModal, 
        closeDetailBtn, 
        orderDetailPanel, 
        createOrderForm, 
        cancelCreateBtn,
        menuItemsList,
        selectedItemsList,
        generateReportBtn,
        exportOrdersBtn,
        assistCustomerBtn,
        markDeliveredBtn,
        completeOrderBtn,
        cancelOrderBtn,
        generateBillBtn
    } = domElements;
    
    // Service-wide report button at the bottom of the page
    if (generateReportBtn) {
        console.log("[setupEventListeners] Found Generate Report button, adding click listener...");
        generateReportBtn.addEventListener('click', handleGenerateReport);
    } else {
        console.error("[setupEventListeners] COULD NOT FIND Generate Report button element!");
    }
    exportOrdersBtn?.addEventListener('click', handleExportOrders);
    
    menuItemsList?.addEventListener('click', handleMenuItemClick);
    selectedItemsList?.addEventListener('click', handleSelectedItemClick);
    
    closeCreateOrderBtn?.addEventListener('click', () => {
        createOrderModal.classList.add('hidden');
    });
    
    closeDetailBtn?.addEventListener('click', () => {
        orderDetailPanel.classList.add('hidden');
    });
    
    createOrderForm?.addEventListener('submit', (e) => {
        e.preventDefault();
        handleCreateOrder();
    });
    
    cancelCreateBtn?.addEventListener('click', () => {
        createOrderModal.classList.add('hidden');
        resetOrderForm();
    });
    
    // Filters
    statusFilter?.addEventListener('change', handleFilterChange);
    tableFilter?.addEventListener('change', handleFilterChange);
    timeFilter?.addEventListener('change', handleFilterChange);
    searchInput?.addEventListener('input', handleFilterChange);
    
    // Order detail buttons
    assistCustomerBtn?.addEventListener('click', handleAssistCustomer);
    markDeliveredBtn?.addEventListener('click', handleMarkDelivered);
    completeOrderBtn?.addEventListener('click', handleCompleteOrder);
    cancelOrderBtn?.addEventListener('click', handleCancelOrder);
    generateBillBtn?.addEventListener('click', handleGenerateBill);
}

/**
 * Handle filter change
 * @param {Event} e - The event object
 */
async function handleFilterChange(e) {
    const { statusFilter, tableFilter, timeFilter, searchInput } = domElements;
    
    // Get the filter values
    const filters = {
        status: statusFilter ? statusFilter.value : null,
        tableId: tableFilter ? tableFilter.value : null,
        timePeriod: timeFilter ? timeFilter.value : null,
        searchTerm: searchInput ? searchInput.value : null
    };
    
    // Get all orders
    const orders = getAllOrders();
    
    // Apply filters
    const filteredOrders = filterOrders(orders, filters);
    
    // Render filtered orders
    renderOrders(filteredOrders);
}

/**
 * Handle menu item click
 * @param {Event} e - The event object
 */
function handleMenuItemClick(e) {
    // This is handled in renderMenuItems through event delegation
}

/**
 * Handle selected item click
 * @param {Event} e - The event object
 */
function handleSelectedItemClick(e) {
    // This is handled in renderSelectedItems through event delegation
}

/**
 * Handle create order
 */
async function handleCreateOrder() {
    const { tableNumber, orderSpecialInstructions, createOrderModal } = domElements;
    
    try {
        const selectedItems = getSelectedItems();
        
        if (selectedItems.length === 0) {
            showNotification('Please select at least one item', 'error');
            return;
        }
        
        if (!tableNumber.value) {
            showNotification('Please select a table', 'error');
            return;
        }
        
        // Create order object
        const orderData = {
            table_id: tableNumber.value,
            items: selectedItems.map(item => ({
                item_id: item.item_id,
                name: item.name,
                price: item.price,
                quantity: item.quantity
            })),
            special_instructions: orderSpecialInstructions.value || ''
        };
        
        // Create order
        await createOrder(orderData);
        
        // Show success message
        showNotification('Order created successfully', 'success');
        
        // Reset form and close modal
        resetOrderForm();
        createOrderModal.classList.add('hidden');
        
        // Reload orders
        await loadOrders();
        renderOrders();
    } catch (error) {
        console.error('Error creating order:', error);
        showNotification(`Error creating order: ${error.message}`, 'error');
    }
}

/**
 * Handle assist customer
 */
function handleAssistCustomer() {
    const order = getSelectedOrder();
    
    if (!order) {
        showNotification('No order selected', 'error');
        return;
    }
    
    showNotification(`Assisting customer at Table ${order.table_id}`, 'info');
}

/**
 * Handle mark delivered
 */
async function handleMarkDelivered() {
    const order = getSelectedOrder();
    
    if (!order) {
        showNotification('No order selected', 'error');
        return;
    }
    
    if (order.status !== 'ready') {
        showNotification('Order is not ready for delivery', 'error');
        return;
    }
    
    try {
        // Update order status
        const updatedOrder = await markOrderDelivered(order.order_id);
        
        // Show success message
        showNotification('Order marked as delivered', 'success');
        
        // Update order details view
        showOrderDetails(updatedOrder);
        
        // Reload orders
        await loadOrders();
        renderOrders();
    } catch (error) {
        console.error('Error marking order as delivered:', error);
        showNotification(`Error: ${error.message}`, 'error');
    }
}

/**
 * Handle complete order
 */
async function handleCompleteOrder() {
    const order = getSelectedOrder();
    
    if (!order) {
        showNotification('No order selected', 'error');
        return;
    }
    
    if (order.status !== 'delivered') {
        showNotification('Order is not delivered yet', 'error');
        return;
    }
    
    try {
        // Update order status
        const updatedOrder = await completeOrder(order.order_id);
        
        // Show success message
        showNotification('Order completed successfully', 'success');
        
        // Update order details view
        showOrderDetails(updatedOrder);
        
        // Reload orders
        await loadOrders();
        renderOrders();
    } catch (error) {
        console.error('Error completing order:', error);
        showNotification(`Error: ${error.message}`, 'error');
    }
}

/**
 * Handle cancel order
 */
async function handleCancelOrder() {
    const order = getSelectedOrder();
    
    if (!order) {
        showNotification('No order selected', 'error');
        return;
    }
    
    if (order.status === 'completed' || order.status === 'cancelled') {
        showNotification('Cannot cancel a completed or already cancelled order', 'error');
        return;
    }
    
    try {
        // Update order status
        const updatedOrder = await cancelOrder(order.order_id);
        
        // Show success message
        showNotification('Order cancelled successfully', 'success');
        
        // Update order details view
        showOrderDetails(updatedOrder);
        
        // Reload orders
        await loadOrders();
        renderOrders();
    } catch (error) {
        console.error('Error cancelling order:', error);
        showNotification(`Error: ${error.message}`, 'error');
    }
}

/**
 * Handle generate bill
 */
async function handleGenerateBill() {
    const order = getSelectedOrder();
    
    if (!order) {
        showNotification('No order selected', 'error');
        return;
    }
    
    if (order.status !== 'completed') {
        showNotification('Can only generate bill for completed orders', 'error');
        return;
    }
    
    try {
        console.log(`[handleGenerateBill] Attempting to generate bill for order: ${order.order_id}`);
        // Generate bill - this function now calls the backend POST /api/bills
        const bill = await generateBill(order.order_id); 
        console.log("[handleGenerateBill] Bill generation response received:", bill);
        
        if (!bill || !bill.bill_id || !bill.table_id) {
            console.error("[handleGenerateBill] Invalid bill data received from API:", bill);
            throw new Error("Failed to retrieve valid bill details after generation.");
        }
        
        // Show success message (optional, as we are redirecting)
        showNotification(`Bill ${bill.bill_id} generated successfully. Redirecting...`, 'success');
        
        // Construct the redirect URL
        // Use the configured TABLE_BILL_SERVICE_URL and add the customer-bill path + query params
        const redirectUrl = `${window.API_CONFIG.TABLE_BILL_SERVICE_URL}/customer-bill?bill_id=${encodeURIComponent(bill.bill_id)}&table_id=${encodeURIComponent(bill.table_id)}`;
        console.log(`[handleGenerateBill] Redirecting to: ${redirectUrl}`);

        // Redirect the browser in a new tab
        window.open(redirectUrl, '_blank');
        
    } catch (error) {
        console.error('[handleGenerateBill] Error generating bill:', error);
        // Provide a more informative error message to the user
        const errorMessage = error.message.includes("not found") || error.message.includes("404") 
                           ? "Order not found or bill service endpoint unavailable."
                           : error.message.includes("not completed")
                           ? "Order must be completed to generate a bill."
                           : `Error generating bill: ${error.message}`;
        showNotification(errorMessage, 'error');
    }
}

/**
 * Handle generate report
 */
function handleGenerateReport() {
    console.log("[handleGenerateReport] Starting report generation..."); // Log start
    try {
        // Generate report
        console.log("[handleGenerateReport] Calling generateOrderReport...");
        const report = generateOrderReport();
        console.log("[handleGenerateReport] Report data received:", report); // Log report data
        
        if (!report) {
             console.error("[handleGenerateReport] generateOrderReport returned null or undefined.");
             showNotification('Failed to generate report data.', 'error');
             return;
        }

        // Format the report for display
        const reportHtml = `
            <div class="bg-white p-6 rounded-lg shadow-md max-w-4xl mx-auto my-8">
                <h2 class="text-2xl font-bold mb-4">Service Report</h2>
                
                <div class="grid grid-cols-2 gap-4 mb-6">
                    <div class="bg-blue-50 p-4 rounded">
                        <h3 class="text-lg font-semibold mb-2">Orders Summary</h3>
                        <p><span class="font-medium">Total Orders:</span> ${report.totalOrders}</p>
                        <p><span class="font-medium">Total Revenue:</span> ₫${report.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}</p>
                        <p><span class="font-medium">Average Order Value:</span> ₫${report.avgOrderValue.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}</p>
                    </div>
                    
                    <div class="bg-purple-50 p-4 rounded">
                        <h3 class="text-lg font-semibold mb-2">Order Status</h3>
                        <p><span class="font-medium">Received:</span> ${report.statusCounts?.received ?? 0}</p>
                        <p><span class="font-medium">In Progress:</span> ${report.statusCounts?.['in-progress'] ?? 0}</p>
                        <p><span class="font-medium">Ready:</span> ${report.statusCounts?.ready ?? 0}</p>
                        <p><span class="font-medium">Delivered:</span> ${report.statusCounts?.delivered ?? 0}</p>
                        <p><span class="font-medium">Completed:</span> ${report.statusCounts?.completed ?? 0}</p>
                        <p><span class="font-medium">Cancelled:</span> ${report.statusCounts?.cancelled ?? 0}</p>
                    </div>
                </div>
                
                <div class="text-right mt-4">
                    <button id="closeReportBtn" class="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700">
                        Close Report
                    </button>
                </div>
            </div>
        `;
        
        // Create a modal for the report
        console.log("[handleGenerateReport] Creating modal element...");
        const reportModal = document.createElement('div');
        reportModal.className = 'fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50';
        reportModal.innerHTML = reportHtml;
        
        console.log("[handleGenerateReport] Appending modal to body...");
        document.body.appendChild(reportModal);
        
        // Add event listener to close button
        const closeBtn = reportModal.querySelector('#closeReportBtn');
        if (closeBtn) {
             console.log("[handleGenerateReport] Adding close button listener...");
            closeBtn.addEventListener('click', () => {
                console.log("[handleGenerateReport] Close button clicked, removing modal.");
                document.body.removeChild(reportModal);
            });
        } else {
             console.error("[handleGenerateReport] Close button (#closeReportBtn) not found in modal HTML.");
        }
        console.log("[handleGenerateReport] Report modal displayed.");

    } catch (error) {
        console.error('[handleGenerateReport] Error generating report:', error);
        showNotification(`Error generating report: ${error.message}`, 'error');
    }
}

/**
 * Handle export orders
 */
function handleExportOrders() {
    try {
        // Get the CSV content
        const csvContent = exportOrdersToCSV();
        
        // Get the date for the filename
        const date = new Date().toISOString().split('T')[0];
        const filename = `orders_export_${date}.csv`;
        
        // Save to CSV
        saveToCSV(csvContent, filename);
        
        // Show success message
        showNotification('Orders exported successfully', 'success');
    } catch (error) {
        console.error('Error exporting orders:', error);
        showNotification(`Error: ${error.message}`, 'error');
    }
}

// Export functions
export {
    setupEventListeners,
    handleFilterChange,
    handleCreateOrder,
    handleAssistCustomer,
    handleMarkDelivered,
    handleCompleteOrder,
    handleCancelOrder,
    handleGenerateBill,
    handleGenerateReport,
    handleExportOrders
}; 