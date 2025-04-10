// UI Renderer module for service-order.js
import { domElements } from './dom-elements.js';
import { getStatusClass, formatPrice, formatDateTime } from './utils.js';
import { getSelectedOrder, getAllOrders, setSelectedOrder } from './order-service.js';
import { getMenuItems, getSelectedItems, getOrderTotal } from './menu-service.js';
import { getAllTables } from './table-service.js';

/**
 * Render orders list
 * @param {Array} orders - Orders to render
 */
function renderOrders(orders = getAllOrders()) {
    console.log("[renderOrders] Received orders:", orders); // Log received orders

    // Correctly reference ordersList from domElements
    const ordersContainer = domElements.ordersList; 
    
    if (!ordersContainer) {
        console.error('Orders list container (ordersList) not found in domElements');
        return;
    }
    
    // Clear container
    console.log("[renderOrders] Clearing orders container...");
    ordersContainer.innerHTML = '';
    
    if (!Array.isArray(orders) || orders.length === 0) { // Added check for array type
        console.log("[renderOrders] No orders to display or orders is not an array.");
        ordersContainer.innerHTML = '<tr><td colspan="6" class="py-4 text-center text-gray-500">No orders found matching filters</td></tr>';
        return;
    }
    
    console.log(`[renderOrders] Rendering ${orders.length} orders...`);

    // Create table rows
    orders.forEach((order, index) => {
        try { // Add try...catch block
            console.log(`[renderOrders] Processing order index ${index}, ID: ${order.order_id}`);
            const row = document.createElement('tr');
            row.className = 'hover:bg-gray-50 cursor-pointer';
            row.dataset.orderId = order.order_id;
            
            // Calculate total for summary (might be different from bill total)
            let orderTotal = 0;
            // Add checks for item price and quantity validity
            if (Array.isArray(order.items)) {
                order.items.forEach(item => {
                    const price = parseFloat(item.price || 0);
                    const quantity = parseInt(item.quantity || 0);
                     if (!isNaN(price) && !isNaN(quantity)) { 
                        orderTotal += (price * quantity);
                    }
                });
            }
            
            // Create summary text
            const summaryText = order.items && order.items.length > 0 
                ? `${order.items[0].name}${order.items.length > 1 ? ` + ${order.items.length - 1} more` : ''}`
                : 'No items';

            // Use helper functions safely
            const statusBadge = getStatusClass(order.status, 'badge');
            const formattedTime = formatDateTime(order.created_at);

            row.innerHTML = `
                <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-900">${order.order_id ? order.order_id.substr(0, 8) : 'N/A'}...</td>
                <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">${order.table_id || 'N/A'}</td>
                <td class="px-4 py-3 whitespace-nowrap">
                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusBadge}">
                        ${order.status ? order.status.toUpperCase() : 'UNKNOWN'}
                    </span>
                </td>
                <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">${formattedTime}</td>
                <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500 truncate max-w-xs">${summaryText}</td>
            `;
            
            // Add click event to view order details
            row.addEventListener('click', (event) => {
                // Prevent button clicks from triggering row click
                if (event.target.tagName === 'BUTTON') return;
                showOrderDetails(order);
            });
            
            // Attach event to button separately if needed, though row click might be sufficient
            const detailsButton = row.querySelector('.view-details-btn');
            if (detailsButton) {
                detailsButton.addEventListener('click', () => showOrderDetails(order));
            }

            console.log(`[renderOrders] Appending row for order ID: ${order.order_id}`);
            ordersContainer.appendChild(row);

        } catch (error) { // Catch errors during row creation/appending
             console.error(`[renderOrders] Error processing order index ${index}, ID: ${order.order_id}:`, error);
        }
    });
    console.log("[renderOrders] Finished rendering orders.");
}

/**
 * Show order details
 * @param {Object} order - The order to show details for
 */
function showOrderDetails(order) {
    const { 
        orderDetailPanel, 
        orderDetail, 
        // Get references to the static buttons
        assistCustomerBtn, 
        markDeliveredBtn, 
        completeOrderBtn, 
        cancelOrderBtn, 
        generateBillBtn, 
        // Removed generateReportBtn from destructuring as it's removed from panel
        // generateReportBtn 
    } = domElements;
    
    // Ensure the panel and detail elements exist
    if (!orderDetailPanel || !orderDetail) {
        console.error('Order detail panel or content area not found');
        return;
    }

    // Update selected order in the store
    setSelectedOrder(order);
    
    // Calculate total
    let orderTotal = 0;
    order.items.forEach(item => {
        // Ensure price and quantity are numbers
        const price = parseFloat(item.price || 0);
        const quantity = parseInt(item.quantity || 0);
        if (!isNaN(price) && !isNaN(quantity)) {
            orderTotal += price * quantity;
        }
    });
    
    // Generate items list HTML
    const itemsHtml = order.items.map(item => {
        const itemPrice = parseFloat(item.price || 0);
        const itemQuantity = parseInt(item.quantity || 0);
        const itemTotal = (!isNaN(itemPrice) && !isNaN(itemQuantity)) ? itemPrice * itemQuantity : 0;
        
        return `
            <div class="border-b py-2">
                <div class="flex justify-between">
                    <div>
                        <span class="font-semibold">${item.name || 'N/A'}</span>
                        <span class="text-gray-600 ml-2">x${itemQuantity}</span>
                    </div>
                    <span>₫${itemTotal.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                </div>
                ${item.notes ? `<p class="text-sm text-gray-600 mt-1">${item.notes}</p>` : ''}
            </div>
        `;
    }).join('');
    
    // Update order detail content (excluding the buttons section)
    orderDetail.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-lg">
            <div class="flex justify-between items-center mb-4">
                <h2 class="text-xl font-bold">Order Details</h2>
                <span class="px-3 py-1 rounded-full text-sm font-semibold ${getStatusClass(order.status, 'badge')}">
                    ${order.status ? order.status.toUpperCase() : 'UNKNOWN'}
                </span>
            </div>
            
            <div class="mb-4">
                <p class="text-gray-700"><span class="font-medium">Order ID:</span> ${order.order_id || 'N/A'}</p>
                <p class="text-gray-700"><span class="font-medium">Table:</span> ${order.table_id || 'N/A'}</p>
                <p class="text-gray-700"><span class="font-medium">Created At:</span> ${formatDateTime(order.created_at)}</p>
                <p class="text-gray-700"><span class="font-medium">Updated At:</span> ${formatDateTime(order.updated_at)}</p>
            </div>
            
            ${order.special_instructions ? `
                <div class="mb-4 p-3 bg-yellow-50 border-l-4 border-yellow-400">
                    <p class="font-medium">Special Instructions:</p>
                    <p>${order.special_instructions}</p>
                </div>
            ` : ''}
            
            <div class="mb-4">
                <h3 class="font-semibold mb-2">Items</h3>
                <div class="border rounded-lg overflow-hidden">
                    ${itemsHtml || '<p class="p-2 text-gray-500">No items found</p>'}
                    <div class="py-2 px-3 bg-gray-50 font-semibold flex justify-between">
                        <span>Total</span>
                        <span>₫${orderTotal.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                    </div>
                </div>
            </div>
            
            <!-- Button section removed from here, handled statically -->
        </div>
    `;
    
    // --- Update state of the static buttons --- 
    const isCompleted = order.status === 'completed';
    const isCancelled = order.status === 'cancelled';
    const isReady = order.status === 'ready';
    const isDelivered = order.status === 'delivered';

    // Disable buttons if they exist
    if (assistCustomerBtn) assistCustomerBtn.disabled = isCompleted || isCancelled;
    if (cancelOrderBtn) cancelOrderBtn.disabled = isCompleted || isCancelled;
    if (markDeliveredBtn) markDeliveredBtn.disabled = !isReady;
    if (completeOrderBtn) completeOrderBtn.disabled = !isDelivered;
    // Enable generate bill ONLY when completed
    if (generateBillBtn) generateBillBtn.disabled = !isCompleted; 
    // Removed logic for the details panel generateReportBtn
    // if (generateReportBtn) generateReportBtn.disabled = false; 
    // --- End button state update ---

    // Show the order detail panel by removing the 'hidden' class
    orderDetailPanel.classList.remove('hidden'); 
}

/**
 * Render menu items
 * @param {Array} items - Menu items to render
 */
function renderMenuItems(items = getMenuItems()) {
    const { menuItemsList } = domElements;
    
    menuItemsList.innerHTML = '';
    
    if (items.length === 0) {
        menuItemsList.innerHTML = '<p class="text-gray-500 text-center py-4">No menu items found</p>';
        return;
    }
    
    // Group items by category
    const itemsByCategory = {};
    items.forEach(item => {
        // Skip unavailable items
        if (item.hasOwnProperty('available') && !item.available) {
            return;
        }
        
        if (!itemsByCategory[item.category]) {
            itemsByCategory[item.category] = [];
        }
        itemsByCategory[item.category].push(item);
    });
    
    // Create category sections
    for (const category in itemsByCategory) {
        const categorySection = document.createElement('div');
        categorySection.className = 'mb-4';
        
        categorySection.innerHTML = `
            <h3 class="font-semibold text-gray-700 mb-2">${category}</h3>
            <div class="grid grid-cols-1 gap-2">
                ${itemsByCategory[category].map(item => `
                    <div class="p-2 border rounded-md hover:bg-gray-50 cursor-pointer menu-item" data-id="${item.item_id}">
                        <div class="flex justify-between items-center">
                            <div>
                                <span class="font-medium">${item.name}</span>
                                <p class="text-sm text-gray-600">${item.description || ''}</p>
                            </div>
                            <span class="text-gray-700">₫${formatPrice(item.price)}</span>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        
        menuItemsList.appendChild(categorySection);
    }
    
    // Add click events to menu items
    const menuItemElements = menuItemsList.querySelectorAll('.menu-item');
    menuItemElements.forEach(element => {
        element.addEventListener('click', () => {
            const itemId = element.dataset.id;
            const item = items.find(i => i.item_id === itemId);
            if (item) {
                addSelectedItem(item);
                renderSelectedItems();
            }
        });
    });
}

/**
 * Render selected items
 * @param {Array} items - Selected items to render
 */
function renderSelectedItems(items = getSelectedItems()) {
    const { selectedItemsList, orderTotalElement } = domElements;
    
    selectedItemsList.innerHTML = '';
    
    if (items.length === 0) {
        selectedItemsList.innerHTML = '<p class="text-gray-500 text-center py-4">No items selected</p>';
        orderTotalElement.textContent = '₫0';
        return;
    }
    
    items.forEach(item => {
        const itemElement = document.createElement('div');
        itemElement.className = 'p-2 border rounded-md mb-2 bg-white';
        itemElement.innerHTML = `
            <div class="flex justify-between items-center">
                <div>
                    <span class="font-medium">${item.name}</span>
                    <div class="flex items-center mt-1">
                        <button class="decrement-btn px-2 py-1 border rounded-l bg-gray-100 hover:bg-gray-200">-</button>
                        <input type="number" class="quantity-input w-12 text-center border-t border-b" value="${item.quantity}" min="1">
                        <button class="increment-btn px-2 py-1 border rounded-r bg-gray-100 hover:bg-gray-200">+</button>
                    </div>
                </div>
                <div class="text-right">
                    <span class="text-gray-700">₫${formatPrice(item.price * item.quantity)}</span>
                    <button class="remove-btn ml-2 text-red-500 hover:text-red-700">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                    </button>
                </div>
            </div>
        `;
        
        // Add event listeners
        const decrementBtn = itemElement.querySelector('.decrement-btn');
        const incrementBtn = itemElement.querySelector('.increment-btn');
        const quantityInput = itemElement.querySelector('.quantity-input');
        const removeBtn = itemElement.querySelector('.remove-btn');
        
        decrementBtn.addEventListener('click', () => {
            if (item.quantity > 1) {
                updateItemQuantity(item.item_id, item.quantity - 1);
                renderSelectedItems();
            } else {
                removeSelectedItem(item.item_id);
                renderSelectedItems();
            }
        });
        
        incrementBtn.addEventListener('click', () => {
            updateItemQuantity(item.item_id, item.quantity + 1);
            renderSelectedItems();
        });
        
        quantityInput.addEventListener('change', (e) => {
            const quantity = parseInt(e.target.value, 10);
            if (quantity > 0) {
                updateItemQuantity(item.item_id, quantity);
                renderSelectedItems();
            }
        });
        
        removeBtn.addEventListener('click', () => {
            removeSelectedItem(item.item_id);
            renderSelectedItems();
        });
        
        selectedItemsList.appendChild(itemElement);
    });
    
    // Update order total
    orderTotalElement.textContent = `₫${formatPrice(getOrderTotal())}`;
}

/**
 * Render table options in the filter dropdown
 * @param {Array} tables - Tables to render
 */
function renderTables(tables = getAllTables()) {
    // Use tableFilter from domElements, not tablesContainer
    const tableFilterDropdown = domElements.tableFilter; 
    
    if (!tableFilterDropdown) {
        // Updated error message for clarity
        console.error('Table filter dropdown (tableFilter) not found in domElements');
        return;
    }
    
    // Clear existing options except the first one ("All Tables")
    while (tableFilterDropdown.options.length > 1) {
        tableFilterDropdown.remove(1);
    }
    
    // Sort tables by number
    tables.sort((a, b) => {
        const numA = parseInt(a.table_number || 0);
        const numB = parseInt(b.table_number || 0);
        return numA - numB;
    });
    
    // Add new options
    tables.forEach(table => {
        const option = document.createElement('option');
        option.value = table.table_id;
        option.textContent = `Table ${table.table_number}`;
        tableFilterDropdown.appendChild(option);
    });
}

/**
 * Update order summary statistics
 * @param {Array} orders - Orders to update summary for
 */
function updateOrderSummary(orders = getAllOrders()) {
    const { totalOrdersElement, totalRevenueElement, pendingOrdersElement, avgOrderValueElement } = domElements;
    
    // Count total orders
    totalOrdersElement.textContent = orders.length;
    
    // Count pending orders (received, in-progress, ready)
    const pendingStatuses = ['received', 'in-progress', 'ready'];
    const pendingCount = orders.filter(order => pendingStatuses.includes(order.status)).length;
    pendingOrdersElement.textContent = pendingCount;
    
    // Calculate total revenue
    let totalRevenue = 0;
    orders.forEach(order => {
        order.items.forEach(item => {
            totalRevenue += (item.price * item.quantity);
        });
    });
    totalRevenueElement.textContent = `₫${formatPrice(totalRevenue)}`;
    
    // Calculate average order value
    const avgOrderValue = orders.length > 0 ? totalRevenue / orders.length : 0;
    avgOrderValueElement.textContent = `₫${formatPrice(avgOrderValue)}`;
}

/**
 * Reset order form
 */
function resetOrderForm() {
    const { createOrderForm, orderSpecialInstructions } = domElements;
    
    if (createOrderForm) {
        createOrderForm.reset();
    }
    
    if (orderSpecialInstructions) {
        orderSpecialInstructions.value = '';
    }
    
    // Clear selected items
    clearSelectedItems();
    renderSelectedItems();
}

// Export UI render functions
export {
    renderOrders,
    showOrderDetails,
    renderMenuItems,
    renderSelectedItems,
    renderTables,
    updateOrderSummary,
    resetOrderForm
}; 