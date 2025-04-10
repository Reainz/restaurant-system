// service-order.js - Entry point for service-order functionality
// This file now works in a non-module context

// Initialize the page when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing service order page...');
    
    // We'll use global functions loaded via script tags
    if (typeof window.initServicePage === 'function') {
        window.initServicePage();
    } else {
        // Initialize manually if the module isn't loaded properly
        initServicePage();
    }
});

// Fallback implementation if modules don't load
function initServicePage() {
    console.log('Initializing service dashboard...');
    
    // Load initial data
    loadActiveOrders();
    
    // Set up event listeners
    setupEventListeners();
    
    // Set up periodic refresh
    setInterval(loadActiveOrders, 30000); // Refresh every 30 seconds
    
    console.log('Service order page initialized successfully');
}

// Load active orders
async function loadActiveOrders() {
    try {
        // Use direct fetch with buildApiUrl
        const url = window.buildApiUrl('orders');
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
            updateOrderStats(data.orders);
        } else {
            displayOrders([]);
        }
    } catch (error) {
        console.error('Error loading orders:', error);
        displayError('Failed to load orders. Please try again.');
    }
}

// Display orders in the UI
function displayOrders(orders) {
    const orderTableBody = document.getElementById('ordersList');
    if (!orderTableBody) {
        console.error("Could not find element with ID 'ordersList'");
        return;
    }
    
    // Sort orders by date (newest first)
    orders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
    // Reset loading indicator
    if (orders.length === 0) {
        orderTableBody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-gray-500">No orders found</td></tr>';
        return;
    }
    
    // Generate table rows
    const rows = orders.map(order => {
        const createdDate = new Date(order.created_at);
        const formattedDate = createdDate.toLocaleString();
        const itemCount = order.items ? order.items.length : 0;
        const summary = order.items && order.items.length > 0 ? 
                        `${order.items[0].name}${order.items.length > 1 ? ` + ${order.items.length - 1} more` : ''}` 
                        : 'No items';
        
        return `
            <tr class="hover:bg-gray-50 cursor-pointer" data-order-id="${order.order_id}">
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${order.order_id.substring(0, 8)}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">T${order.table_id}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm">
                    <span class="px-2 py-1 rounded-full text-xs font-semibold ${getStatusClass(order.status)}">
                        ${formatStatus(order.status)}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${formattedDate}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${summary}</td>
            </tr>
        `;
    }).join('');
    
    orderTableBody.innerHTML = rows;
    
    // Add click handlers for rows to show order details
    document.querySelectorAll('#ordersList tr[data-order-id]').forEach(row => {
        row.addEventListener('click', () => {
            const orderId = row.getAttribute('data-order-id');
            loadOrderDetails(orderId);
        });
    });
    
    // Add click handlers for action buttons
    document.querySelectorAll('#ordersList [data-action]').forEach(button => {
        button.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent triggering the parent click handler
            
            const action = button.getAttribute('data-action');
            const orderId = button.closest('tr').getAttribute('data-order-id');
            
            if (action === 'deliver') {
                updateOrderStatus(orderId, 'delivered');
            } else if (action === 'complete') {
                updateOrderStatus(orderId, 'completed');
            } else if (action === 'bill') {
                generateBill(orderId);
            }
        });
    });
}

// Load order details
async function loadOrderDetails(orderId) {
    try {
        // Use direct fetch with buildApiUrl
        const url = window.buildApiUrl(`orders/${orderId}`);
        console.log(`Fetching order details from: ${url}`);
        
        const response = await fetch(url, {
            method: 'GET',
            headers: window.API_CONFIG.DEFAULT_HEADERS
        });
        
        if (!response.ok) {
            throw new Error(`API request failed with status ${response.status}`);
        }
        
        const order = await response.json();
        if (order) {
            displayOrderDetails(order);
        }
    } catch (error) {
        console.error(`Error loading order details for ${orderId}:`, error);
        displayError(`Failed to load order details: ${error.message}`);
    }
}

// Display order details in the UI
function displayOrderDetails(order) {
    // Update order ID
    document.getElementById('summaryOrderId').textContent = order.order_id.substring(0, 8);
    
    // Update table number
    document.getElementById('summaryTableNumber').textContent = order.table_id;
    
    // Update status
    document.getElementById('summaryStatus').textContent = formatStatus(order.status);
    document.getElementById('summaryStatus').className = `px-2 py-1 rounded-full text-xs font-semibold ${getStatusClass(order.status)}`;
    
    // Update time
    const createdDate = new Date(order.created_at);
    document.getElementById('summaryTime').textContent = createdDate.toLocaleString();
    
    // Update items
    const itemsContainer = document.getElementById('summaryItems');
    if (order.items && order.items.length > 0) {
        const itemsList = order.items.map(item => {
            const itemTotal = item.price * item.quantity;
            const formattedItemTotal = new Intl.NumberFormat('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(itemTotal);
            return `
                <div class="py-2 border-b border-gray-200 last:border-b-0">
                    <div class="flex justify-between">
                        <div>
                            <span class="font-medium">${item.quantity}x ${item.name}</span>
                            ${item.notes ? `<div class="text-xs text-gray-500">${item.notes}</div>` : ''}
                        </div>
                        <span class="font-medium">₫${formattedItemTotal}</span>
                    </div>
                </div>
            `;
        }).join('');
        
        itemsContainer.innerHTML = itemsList;
    } else {
        itemsContainer.innerHTML = '<div class="py-4 text-gray-500">No items in this order</div>';
    }
    
    // Update special instructions
    document.getElementById('summaryInstructions').textContent = order.special_instructions || 'No special instructions';
    
    // Update total
    const total = calculateOrderTotal(order);
    const formattedTotal = new Intl.NumberFormat('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(total);
    document.getElementById('summaryTotal').textContent = `₫${formattedTotal}`;
    
    // Update action buttons
    const actionsContainer = document.getElementById('summaryActions');
    actionsContainer.innerHTML = getDetailActionButtons(order);
    
    // Add event listeners to action buttons
    document.querySelectorAll('#summaryActions [data-action]').forEach(button => {
        button.addEventListener('click', () => {
            const action = button.getAttribute('data-action');
            
            if (action === 'deliver') {
                updateOrderStatus(order.order_id, 'delivered');
            } else if (action === 'complete') {
                updateOrderStatus(order.order_id, 'completed');
            } else if (action === 'bill') {
                generateBill(order.order_id);
            }
        });
    });
}

// Update order status
async function updateOrderStatus(orderId, status) {
    try {
        // Use direct fetch with buildApiUrl
        const url = window.buildApiUrl(`orders/${orderId}/status`);
        console.log(`Updating order status at: ${url}`);
        
        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ status })
        });
        
        if (!response.ok) {
            throw new Error(`API request failed with status ${response.status}`);
        }
        
        const data = await response.json();
        
        // Display success message
        displaySuccess(`Order ${orderId.substring(0, 8)} updated to ${formatStatus(status)}`);
        
        // Reload orders to reflect the change
        loadActiveOrders();
        
        // If we have order details open, reload them
        if (document.getElementById('summaryOrderId').textContent === orderId.substring(0, 8)) {
            loadOrderDetails(orderId);
        }
        
        return data;
    } catch (error) {
        console.error(`Error updating order ${orderId} to ${status}:`, error);
        displayError(`Failed to update order: ${error.message}`);
    }
}

// Generate bill for an order
async function generateBill(orderId) {
    try {
        // Normally this would call the Table & Bill service API
        // But for now we'll simulate it
        console.log(`Generating bill for order: ${orderId}`);
        
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Display success message
        displaySuccess(`Bill generated for order ${orderId.substring(0, 8)}`);
        
        // For now, just mark the order as completed
        updateOrderStatus(orderId, 'completed');
    } catch (error) {
        console.error(`Error generating bill for ${orderId}:`, error);
        displayError(`Failed to generate bill: ${error.message}`);
    }
}

// Set up event listeners
function setupEventListeners() {
    // Refresh button
    const refreshButton = document.getElementById('refreshButton');
    if (refreshButton) {
        refreshButton.addEventListener('click', loadActiveOrders);
    }
    
    // Status filter buttons
    document.querySelectorAll('[data-status-filter]').forEach(button => {
        button.addEventListener('click', () => {
            const status = button.getAttribute('data-status-filter');
            document.querySelectorAll('[data-status-filter]').forEach(btn => {
                btn.classList.remove('bg-indigo-100', 'text-indigo-800');
                btn.classList.add('bg-gray-100', 'text-gray-800');
            });
            button.classList.remove('bg-gray-100', 'text-gray-800');
            button.classList.add('bg-indigo-100', 'text-indigo-800');
            
            filterOrdersByStatus(status);
        });
    });
    
    // Table filter
    const tableFilter = document.getElementById('tableFilter');
    if (tableFilter) {
        tableFilter.addEventListener('change', () => {
            const tableId = tableFilter.value;
            filterOrdersByTable(tableId);
        });
    }
    
    // Time filter
    const timeFilter = document.getElementById('timeFilter');
    if (timeFilter) {
        timeFilter.addEventListener('change', () => {
            const timeFrame = timeFilter.value;
            filterOrdersByTime(timeFrame);
        });
    }
    
    // Search input
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            const query = searchInput.value.trim().toLowerCase();
            searchOrders(query);
        });
    }
}

// Helper functions
function getStatusClass(status) {
    switch (status) {
        case 'received': return 'bg-blue-100 text-blue-800';
        case 'in-progress': return 'bg-yellow-100 text-yellow-800';
        case 'ready': return 'bg-green-100 text-green-800';
        case 'delivered': return 'bg-purple-100 text-purple-800';
        case 'completed': return 'bg-gray-100 text-gray-800';
        case 'cancelled': return 'bg-red-100 text-red-800';
        default: return 'bg-gray-100 text-gray-800';
    }
}

function formatStatus(status) {
    return status.charAt(0).toUpperCase() + status.slice(1);
}

function getActionButtons(order) {
    if (order.status === 'ready') {
        return `<button data-action="deliver" class="text-blue-600 hover:text-blue-900">Deliver</button>`;
    } else if (order.status === 'delivered') {
        return `<button data-action="bill" class="text-green-600 hover:text-green-900">Bill</button>`;
    } else if (order.status === 'in-progress') {
        return `<button disabled class="text-gray-400">Cooking</button>`;
    }
    return '';
}

function getDetailActionButtons(order) {
    let buttons = '';
    
    if (order.status === 'ready') {
        buttons += `<button data-action="deliver" class="bg-blue-500 text-white px-4 py-2 rounded">Mark as Delivered</button>`;
    } else if (order.status === 'delivered') {
        buttons += `<button data-action="bill" class="bg-green-500 text-white px-4 py-2 rounded">Generate Bill</button>`;
    } else if (order.status === 'in-progress') {
        buttons += `<button disabled class="bg-gray-300 text-gray-500 px-4 py-2 rounded cursor-not-allowed">Cooking</button>`;
    }
    
    return buttons;
}

function calculateOrderTotal(order) {
    if (!order.items || order.items.length === 0) {
        return 0;
    }
    
    return order.items.reduce((total, item) => {
        return total + (item.price * item.quantity);
    }, 0);
}

function updateOrderStats(orders) {
    // Calculate stats
    const totalOrders = orders.length;
    const pendingOrders = orders.filter(o => o.status !== 'completed' && o.status !== 'cancelled').length;
    const totalRevenue = orders
        .filter(o => o.status === 'completed')
        .reduce((sum, order) => sum + calculateOrderTotal(order), 0);
    
    let avgOrderValue = 0;
    const completedOrders = orders.filter(o => o.status === 'completed');
    if (completedOrders.length > 0) {
        avgOrderValue = totalRevenue / completedOrders.length;
    }
    
    // Update UI - check if elements exist first
    const totalOrdersElement = document.getElementById('totalOrders');
    const pendingOrdersElement = document.getElementById('pendingOrders');
    const totalRevenueElement = document.getElementById('totalRevenue');
    const avgOrderValueElement = document.getElementById('avgOrderValue');
    
    if (totalOrdersElement) totalOrdersElement.textContent = totalOrders;
    if (pendingOrdersElement) pendingOrdersElement.textContent = pendingOrders;
    if (totalRevenueElement) totalRevenueElement.textContent = `₫${Math.round(totalRevenue).toLocaleString()}`;
    if (avgOrderValueElement) avgOrderValueElement.textContent = `₫${Math.round(avgOrderValue).toLocaleString()}`;
}

function filterOrdersByStatus(status) {
    const rows = document.querySelectorAll('#ordersList tr[data-order-id]');
    
    rows.forEach(row => {
        const statusCell = row.querySelector('td:nth-child(3) span');
        const rowStatus = statusCell.textContent.trim().toLowerCase();
        
        if (status === 'all' || rowStatus === status.toLowerCase()) {
            row.classList.remove('hidden');
        } else {
            row.classList.add('hidden');
        }
    });
}

function filterOrdersByTable(tableId) {
    if (!tableId) {
        // Show all tables
        document.querySelectorAll('#ordersList tr[data-order-id]').forEach(row => {
            row.classList.remove('hidden');
        });
        return;
    }
    
    document.querySelectorAll('#ordersList tr[data-order-id]').forEach(row => {
        const tableCellText = row.querySelector('td:nth-child(2)').textContent.trim();
        
        if (tableCellText === tableId) {
            row.classList.remove('hidden');
        } else {
            row.classList.add('hidden');
        }
    });
}

function filterOrdersByTime(timeFrame) {
    const now = new Date();
    let cutoffDate = new Date();
    
    switch (timeFrame) {
        case 'today':
            cutoffDate.setHours(0, 0, 0, 0);
            break;
        case 'week':
            cutoffDate.setDate(now.getDate() - 7);
            break;
        case 'month':
            cutoffDate.setMonth(now.getMonth() - 1);
            break;
        default:
            // Show all time periods
            document.querySelectorAll('#ordersList tr[data-order-id]').forEach(row => {
                row.classList.remove('hidden');
            });
            return;
    }
    
    document.querySelectorAll('#ordersList tr[data-order-id]').forEach(row => {
        const dateCellText = row.querySelector('td:nth-child(4)').textContent.trim();
        const orderDate = new Date(dateCellText);
        
        if (orderDate >= cutoffDate) {
            row.classList.remove('hidden');
        } else {
            row.classList.add('hidden');
        }
    });
}

function searchOrders(query) {
    if (!query) {
        // Show all orders
        document.querySelectorAll('#ordersList tr[data-order-id]').forEach(row => {
            row.classList.remove('hidden');
        });
        return;
    }
    
    document.querySelectorAll('#ordersList tr[data-order-id]').forEach(row => {
        const orderId = row.getAttribute('data-order-id').toLowerCase();
        const tableId = row.querySelector('td:nth-child(2)').textContent.trim().toLowerCase();
        
        if (orderId.includes(query) || tableId.includes(query)) {
            row.classList.remove('hidden');
        } else {
            row.classList.add('hidden');
        }
    });
}

function displaySuccess(message) {
    const notification = document.getElementById('notification');
    if (!notification) return;
    
    notification.innerHTML = `
        <div class="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 rounded shadow-md">
            <div class="flex">
                <div class="flex-shrink-0">
                    <svg class="h-5 w-5 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                    </svg>
                </div>
                <div class="ml-3">
                    <p class="text-sm">${message}</p>
                </div>
            </div>
        </div>
    `;
    
    notification.classList.remove('hidden');
    
    // Auto-hide after 3 seconds
    setTimeout(() => {
        notification.classList.add('hidden');
    }, 3000);
}

function displayError(message) {
    const notification = document.getElementById('notification');
    if (!notification) return;
    
    notification.innerHTML = `
        <div class="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded shadow-md">
            <div class="flex">
                <div class="flex-shrink-0">
                    <svg class="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
                    </svg>
                </div>
                <div class="ml-3">
                    <p class="text-sm">${message}</p>
                </div>
            </div>
        </div>
    `;
    
    notification.classList.remove('hidden');
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        notification.classList.add('hidden');
    }, 5000);
}

// Make functions available globally for non-module use
window.initServicePage = initServicePage;
window.loadActiveOrders = loadActiveOrders;
window.loadOrderDetails = loadOrderDetails;
window.updateOrderStatus = updateOrderStatus;
window.setupEventListeners = setupEventListeners;