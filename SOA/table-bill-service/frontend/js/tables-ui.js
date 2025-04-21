/**
 * Table Management UI Functions
 */

import { updateTableStatus, createTable } from './tables-api.js';
import { showTableDetails } from './tables-actions.js';

/**
 * Renders tables to the UI
 * @param {Array} tables - Tables to render
 */
function renderTables(tables) {
    // Select the grid container where tables should be rendered
    const tablesContainer = document.querySelector('.grid'); // Use the correct selector
    const loadingPlaceholder = document.getElementById('loading-placeholder');

    if (!tablesContainer) {
        console.error('Tables grid container (.grid) not found in the DOM');
        return;
    }

    // Clear previous tables (except the placeholder if it exists)
    tablesContainer.querySelectorAll('.table-card').forEach(card => card.remove());

    // Hide loading placeholder if it exists
    if (loadingPlaceholder) {
        loadingPlaceholder.style.display = 'none';
    }

    if (!tables || tables.length === 0) {
        // Show a message if no tables are found
        if (!tablesContainer.querySelector('.no-tables-message')) {
            const noTablesMsg = document.createElement('div');
            noTablesMsg.className = 'col-span-full p-6 text-center text-gray-500 no-tables-message'; // Adjusted span
            noTablesMsg.textContent = 'No tables found.';
            tablesContainer.appendChild(noTablesMsg);
        }
        return; // Exit if no tables
    } else {
        // Remove no tables message if it exists
         const noTablesMsg = tablesContainer.querySelector('.no-tables-message');
         if (noTablesMsg) noTablesMsg.remove();
    }
    
    // Update tables count
    const tableCountElement = document.querySelector('.table-count');
    if (tableCountElement) {
        tableCountElement.textContent = `${tables.length} Tables`;
    }
    
    // Clear existing tables or create initial skeleton
    if (tablesContainer.querySelector('.table-card')) {
        // Update existing table cards
        tables.forEach(table => {
            const existingTableCard = document.querySelector(`.table-card[data-id="${table.table_id}"]`);
            if (existingTableCard) {
                // Update the existing card
                updateTableElement(existingTableCard, table);
            } else {
                // If this table doesn't exist in the DOM yet, create it
                const tableElement = createTableElement(table);
                tablesContainer.appendChild(tableElement);
            }
        });
        
        // Remove any table cards that no longer exist in the data
        const existingTableCards = document.querySelectorAll('.table-card');
        existingTableCards.forEach(tableCard => {
            const tableId = tableCard.dataset.id;
            if (!tables.some(table => table.table_id === tableId)) {
                tableCard.remove();
            }
        });
    } else {
        // First time rendering, create all table cards
        tables.forEach(table => {
            const tableElement = createTableElement(table);
            tablesContainer.appendChild(tableElement);
        });
    }
}

/**
 * Creates a table card element
 * @param {Object} table - Table data
 * @returns {HTMLElement} The table card element
 */
function createTableElement(table) {
    const tableCard = document.createElement('div');
    // Added Tailwind classes for card styling
    tableCard.className = 'table-card bg-white rounded-lg shadow-md p-4 flex flex-col border'; 
    tableCard.dataset.id = table.table_id;
    tableCard.dataset.status = table.status;
    
    // Add border color based on status
    let statusColorClasses = 'border-gray-300'; // Default border
    let statusBadgeClasses = 'bg-gray-200 text-gray-700'; // Default badge
    if (table.status === 'available') {
        statusColorClasses = 'border-green-500';
        statusBadgeClasses = 'bg-green-100 text-green-700';
    } else if (table.status === 'occupied') {
        statusColorClasses = 'border-blue-500';
        statusBadgeClasses = 'bg-blue-100 text-blue-700';
    } else if (table.status === 'reserved') {
        statusColorClasses = 'border-yellow-500';
        statusBadgeClasses = 'bg-yellow-100 text-yellow-700';
    }
    tableCard.classList.add(statusColorClasses);

    // Add table content with Tailwind classes
    tableCard.innerHTML = `
        <div class="flex justify-between items-center mb-2">
            <h3 class="font-bold text-lg text-gray-800">Table ${table.table_number}</h3>
            <span class="table-status ${statusBadgeClasses} px-2 py-0.5 rounded-full text-xs font-medium capitalize">${table.status}</span>
        </div>

        <div class="table-image-container flex justify-center my-3">
            <img class="table-image w-24 h-24 object-contain" src="${table.status === 'available' ? '/static/images/table_on.png' : '/static/images/table_off.png'}" alt="${table.status === 'available' ? 'Available Table' : 'Occupied Table'}">
        </div>

        <div class="text-sm text-gray-600 space-y-1 mb-3 flex-grow">
            <div class="flex items-center space-x-1">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-gray-500">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                    <circle cx="9" cy="7" r="4"></circle>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
                <span>${table.capacity} Seats</span>
            </div>
            ${table.status === 'occupied' ? `
                ${table.occupiedDuration ? `
                    <div class="flex items-center space-x-1">
                         <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-gray-500">
                            <circle cx="12" cy="12" r="10"></circle>
                            <polyline points="12 6 12 12 16 14"></polyline>
                        </svg>
                        <span>Occupied for ${table.occupiedDuration}</span>
                    </div>
                ` : ''}
            ` : ''}
        </div>
        <div class="table-actions flex space-x-2 justify-end items-center">
             <!-- Standardized button styles -->
             <button class="btn-details bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm font-medium py-1 px-3 rounded" data-table-id="${table.table_id}">
                Details
            </button>
            ${table.status === 'available' ? `
                <button class="btn-book bg-yellow-500 hover:bg-yellow-600 text-white text-sm font-medium py-1 px-3 rounded" data-table-id="${table.table_id}">
                    Book
                </button>
                <button class="btn-occupy bg-green-600 hover:bg-green-700 text-white text-sm font-medium py-1 px-3 rounded" data-table-id="${table.table_id}">
                    Occupy
                </button>
            ` : table.status === 'occupied' ? `
                <button class="btn-clear bg-red-500 hover:bg-red-600 text-white text-sm font-medium py-1 px-3 rounded" data-table-id="${table.table_id}">
                    Clear Table
                </button>
            ` : table.status === 'reserved' ? `
                 <button class="btn-cancel-reservation bg-gray-500 hover:bg-gray-600 text-white text-sm font-medium py-1 px-3 rounded" data-table-id="${table.table_id}">
                    Cancel Booking
                </button>
            ` : ''} 
        </div>
    `;
    
    // Add event listeners
    tableCard.querySelector('.btn-details').addEventListener('click', () => {
        showTableDetails(table);
    });
    
    const occupyBtn = tableCard.querySelector('.btn-occupy');
    if (occupyBtn) {
        occupyBtn.addEventListener('click', async () => {
            try {
                await updateTableStatus(table.table_id, 'occupied');
                tableCard.dataset.status = 'occupied';
                tableCard.classList.remove('available');
                tableCard.classList.add('occupied');
                
                // Reload the table data
                window.loadTableData();
            } catch (error) {
                console.error('Error occupying table:', error);
                showError('Failed to update table status');
            }
        });
    }
    
    const clearBtn = tableCard.querySelector('.btn-clear');
    if (clearBtn) {
        clearBtn.addEventListener('click', async () => {
            if (confirm('Are you sure you want to clear this table? This will mark any active bills as closed.')) {
                try {
                    await updateTableStatus(table.table_id, 'available');
                    tableCard.dataset.status = 'available';
                    tableCard.classList.remove('occupied');
                    tableCard.classList.add('available');
                    
                    // Reload the table data
                    window.loadTableData();
                } catch (error) {
                    console.error('Error clearing table:', error);
                    showError('Failed to update table status');
                }
            }
        });
    }
    
    const bookBtn = tableCard.querySelector('.btn-book');
    if (bookBtn) {
        bookBtn.addEventListener('click', async () => {
             if (confirm('Reserve this table?')) {
                try {
                    await updateTableStatus(table.table_id, 'reserved');
                    tableCard.dataset.status = 'reserved';
                    tableCard.classList.remove('available');
                    tableCard.classList.add('reserved');
                    
                    // Reload the table data
                    window.loadTableData();
                } catch (error) {
                    console.error('Error reserving table:', error);
                    showError('Failed to reserve table');
                }
            }
        });
    }

    const cancelBtn = tableCard.querySelector('.btn-cancel-reservation');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', async () => {
             if (confirm('Cancel reservation for this table?')) {
                try {
                    await updateTableStatus(table.table_id, 'available');
                    tableCard.dataset.status = 'available';
                    tableCard.classList.remove('reserved');
                    tableCard.classList.add('available');
                    
                    // Reload the table data
                    window.loadTableData();
                } catch (error) {
                    console.error('Error cancelling reservation:', error);
                    showError('Failed to cancel reservation');
                }
            }
        });
    }
    
    return tableCard;
}

/**
 * Updates an existing table element with new data
 * @param {HTMLElement} tableElement - Existing table element
 * @param {Object} table - New table data
 */
function updateTableElement(tableElement, table) {
    // Update status badge and border color
    const statusSpan = tableElement.querySelector('.table-status');
    let statusColorClasses = 'border-gray-300'; // Default border
    let statusBadgeClasses = 'bg-gray-200 text-gray-700'; // Default badge
    if (table.status === 'available') {
        statusColorClasses = 'border-green-500';
        statusBadgeClasses = 'bg-green-100 text-green-700';
    } else if (table.status === 'occupied') {
        statusColorClasses = 'border-blue-500';
        statusBadgeClasses = 'bg-blue-100 text-blue-700';
    } else if (table.status === 'reserved') {
        statusColorClasses = 'border-yellow-500';
        statusBadgeClasses = 'bg-yellow-100 text-yellow-700';
    }
    
    // Remove old border classes and add new one
    tableElement.classList.remove('border-gray-300', 'border-green-500', 'border-blue-500', 'border-yellow-500');
    tableElement.classList.add(statusColorClasses);

    if (statusSpan) {
         // Remove old badge classes and add new ones
        statusSpan.className = `table-status ${statusBadgeClasses} px-2 py-0.5 rounded-full text-xs font-medium capitalize`; 
        statusSpan.textContent = table.status;
    }
    
    // Update dataset status
    tableElement.dataset.status = table.status;
    
    // Regenerate the inner content to reflect potential changes in info/actions
    const tempDiv = document.createElement('div');
    const newCardContent = createTableElement(table); 
    tempDiv.innerHTML = newCardContent.innerHTML;
    
    const tableImage = tableElement.querySelector('.table-image');
    if (tableImage) {
        tableImage.src = table.status === 'available' ? '/static/images/table_on.png' : '/static/images/table_off.png';
        tableImage.alt = table.status === 'available' ? 'Available Table' : 'Occupied Table';
    }

    // Replace relevant sections reliably
    const currentHeader = tableElement.querySelector('.flex.justify-between.items-center');
    const newHeader = tempDiv.querySelector('.flex.justify-between.items-center');
    if (currentHeader && newHeader) currentHeader.replaceWith(newHeader);

    const currentInfo = tableElement.querySelector('.text-sm.text-gray-600');
    const newInfo = tempDiv.querySelector('.text-sm.text-gray-600');
    if (currentInfo && newInfo) currentInfo.replaceWith(newInfo);

    const currentActions = tableElement.querySelector('.table-actions');
    const newActions = tempDiv.querySelector('.table-actions');
    if (currentActions && newActions) currentActions.replaceWith(newActions);

    // Re-attach *all* necessary event listeners for the updated content
    tableElement.querySelector('.btn-details')?.addEventListener('click', () => {
        showTableDetails(table);
    });
    
    tableElement.querySelector('.btn-occupy')?.addEventListener('click', async () => {
        try {
            await updateTableStatus(table.table_id, 'occupied');
            window.loadTableData(); 
        } catch (error) {
            console.error('Error occupying table:', error);
            showError('Failed to update table status');
        }
    });
    
    tableElement.querySelector('.btn-clear')?.addEventListener('click', async () => {
        if (confirm('Are you sure you want to clear this table? This will close any active bills.')) {
            try {
                await updateTableStatus(table.table_id, 'available');
                window.loadTableData();
            } catch (error) {
                console.error('Error clearing table:', error);
                showError('Failed to update table status');
            }
        }
    });
    
    tableElement.querySelector('.btn-book')?.addEventListener('click', async () => {
        if (confirm('Reserve this table?')) {
            try {
                await updateTableStatus(table.table_id, 'reserved');
                window.loadTableData(); 
            } catch (error) {
                console.error('Error reserving table:', error);
                showError('Failed to reserve table');
            }
        }
    });

    tableElement.querySelector('.btn-cancel-reservation')?.addEventListener('click', async () => {
        if (confirm('Cancel reservation for this table?')) {
            try {
                await updateTableStatus(table.table_id, 'available');
                window.loadTableData();
            } catch (error) {
                console.error('Error cancelling reservation:', error);
                showError('Failed to cancel reservation');
            }
        }
    });
}

/**
 * Updates a table UI with bill data
 * @param {string} tableId - Table ID
 * @param {Object} bill - Bill data
 */
function updateTableWithBillData(tableId, bill) {
    const tableCard = document.querySelector(`.table-card[data-id="${tableId}"]`);
    if (!tableCard) return;
    
    const tableInfo = tableCard.querySelector('.table-info');
    if (!tableInfo) return;
    
    // Update or add bill indicator
    let billIndicator = tableInfo.querySelector('.bill-indicator');
    if (!billIndicator) {
        billIndicator = document.createElement('div');
        billIndicator.className = 'bill-indicator';
        tableInfo.appendChild(billIndicator);
    }
    
    billIndicator.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
            <line x1="1" y1="10" x2="23" y2="10"></line>
        </svg>
        Bill #${bill.bill_id.substring(0, 6)}... ($${bill.total_amount.toFixed(2)})
    `;
    
    // Add created time if present
    if (bill.created_at) {
        const createdAt = new Date(bill.created_at);
        let timeIndicator = tableInfo.querySelector('.time-indicator');
        
        if (!timeIndicator) {
            timeIndicator = document.createElement('div');
            timeIndicator.className = 'time-indicator';
            tableInfo.appendChild(timeIndicator);
        }
        
        const timeDiff = getTimeDifference(createdAt, new Date());
        timeIndicator.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            ${timeDiff}
        `;
    }
}

/**
 * Shows the add table modal
 */
function showAddTableModal() {
    // Create modal if it doesn't exist
    let modal = document.getElementById('add-table-modal');
    
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'add-table-modal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <span class="close">&times;</span>
                <h2>Add New Table</h2>
                <form id="add-table-form">
                    <div class="form-group">
                        <label for="table-number">Table Number</label>
                        <input type="number" id="table-number" required min="1">
                    </div>
                    <div class="form-group">
                        <label for="table-capacity">Capacity (seats)</label>
                        <input type="number" id="table-capacity" required min="1">
                    </div>
                    <div class="form-group">
                        <label for="table-status">Status</label>
                        <select id="table-status">
                            <option value="available">Available</option>
                            <option value="reserved">Reserved</option>
                        </select>
                    </div>
                    <button type="submit" class="btn btn-primary">Add Table</button>
                </form>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Add event listener for close button
        modal.querySelector('.close').addEventListener('click', () => {
            modal.style.display = 'none';
        });
        
        // Add event listener for form submission
        modal.querySelector('#add-table-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const tableNumber = document.getElementById('table-number').value;
            const capacity = document.getElementById('table-capacity').value;
            const status = document.getElementById('table-status').value;
            
            try {
                await createTable({
                    table_number: parseInt(tableNumber),
                    capacity: parseInt(capacity),
                    status: status
                });
                
                modal.style.display = 'none';
                // Reload table data
                window.loadTableData();
                
                // Show success message
                showNotification(`Table ${tableNumber} has been added successfully.`);
            } catch (error) {
                console.error('Error adding table:', error);
                showError('Failed to add table. Please try again.');
            }
        });
    }
    
    // Show the modal
    modal.style.display = 'block';
}

/**
 * Shows a loading indicator
 */
function showLoading() {
    const loader = document.querySelector('.loader');
    if (loader) {
        loader.classList.remove('hidden');
    }
}

/**
 * Hides the loading indicator
 */
function hideLoading() {
    const loader = document.querySelector('.loader');
    if (loader) {
        loader.classList.add('hidden');
    }
}

/**
 * Shows an error message
 * @param {string} message - Error message
 */
function showError(message) {
    const errorContainer = document.querySelector('.error-container');
    if (errorContainer) {
        errorContainer.textContent = message;
        errorContainer.classList.remove('hidden');
        
        // Hide after 5 seconds
        setTimeout(() => {
            errorContainer.classList.add('hidden');
        }, 5000);
    } else {
        // If no error container exists, show an alert
        alert(message);
    }
}

/**
 * Shows a notification
 * @param {string} message - Notification message
 * @param {string} type - Notification type (success, error, warning)
 */
function showNotification(message, type = 'success') {
    // Create notification element if it doesn't exist
    let notification = document.querySelector('.notification');
    
    if (!notification) {
        notification = document.createElement('div');
        notification.className = 'notification';
        document.body.appendChild(notification);
    }
    
    // Set notification type class
    notification.className = `notification ${type}`;
    
    // Set message
    notification.textContent = message;
    
    // Show notification
    notification.style.display = 'block';
    
    // Hide after 3 seconds
    setTimeout(() => {
        notification.style.display = 'none';
    }, 3000);
}

// Helper function to calculate time difference
function getTimeDifference(startDate, endDate) {
    const diffMs = endDate - startDate;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const remainingMins = diffMins % 60;
    
    if (diffHours > 0) {
        return `${diffHours}h ${remainingMins}m`;
    } else {
        return `${diffMins}m`;
    }
}

// --- START: Added Modal Functions ---

// Function to create the basic modal structure
function createDetailsModal() {
    // Remove existing modal first
    document.getElementById('table-details-modal')?.remove();

    const modal = document.createElement('div');
    modal.id = 'table-details-modal';
    // Basic modal styling using Tailwind (fixed position, overlay, centered content)
    modal.className = 'fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50';
    modal.style.display = 'none'; // Hidden by default

    modal.innerHTML = `
        <div class="relative mx-auto p-5 border w-full max-w-3xl shadow-lg rounded-md bg-white">
            <div class="flex justify-between items-center border-b pb-3 mb-3">
                <h3 class="text-xl font-medium text-gray-900" id="table-details-title">Table Details</h3>
                <button type="button" class="text-gray-400 bg-transparent hover:bg-gray-200 hover:text-gray-900 rounded-lg text-sm p-1.5 ml-auto inline-flex items-center" id="close-details-modal">
                    <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path></svg>
                </button>
            </div>
            <div id="table-details-content" class="text-sm">
                <div class="text-center py-5">
                    <svg class="mx-auto h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p>Loading details...</p>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Add close event listener
    modal.querySelector('#close-details-modal').addEventListener('click', () => {
        modal.style.display = 'none';
    });
    // Close on clicking outside the modal content
    modal.addEventListener('click', (event) => {
        if (event.target.id === 'table-details-modal') {
            modal.style.display = 'none';
        }
    });

    return modal;
}

// Function to show the modal (call this first)
function showDetailsModalLoading(tableNumber) {
    const modal = createDetailsModal(); // Ensure modal exists
    modal.querySelector('#table-details-title').textContent = `Details for Table ${tableNumber}`;
    // Reset content to loading state
    modal.querySelector('#table-details-content').innerHTML = `
        <div class="text-center py-5">
            <svg class="mx-auto h-6 w-6 text-gray-400 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p>Loading details...</p>
        </div>`;
    modal.style.display = 'flex'; // Show modal using flex for centering
}

// Function to populate the modal with data
function populateTableDetailsModal(table, bills, orders) {
    const modal = document.getElementById('table-details-modal');
    if (!modal) return; // Should not happen if showDetailsModalLoading was called

    const content = modal.querySelector('#table-details-content');
    let html = `<div class="space-y-4">`;

    // Table Info
    html += `
        <div>
            <h4 class="font-semibold text-gray-800 mb-1">Table Information</h4>
            <p><strong>Status:</strong> <span class="capitalize">${table.status}</span></p>
            <p><strong>Capacity:</strong> ${table.capacity} Seats</p>
        </div>`;

    // Active Bill Info - Adjusted Filter
    // Show any bill that isn't explicitly marked as closed or cancelled
    const activeBills = bills.filter(b => b.status !== 'closed' && b.status !== 'cancelled');
    if (activeBills.length > 0) {
        html += `
            <div>
                <h4 class="font-semibold text-gray-800 mb-1">Active Bill(s)</h4>`;
        activeBills.forEach(bill => {
             html += `
                <div class="mb-2 p-2 border rounded bg-gray-50">
                    <p><strong>Bill ID:</strong> ${bill.bill_id}</p>
                    <p><strong>Total:</strong> $${(bill.total_amount || 0).toFixed(2)}</p>
                    <p><strong>Status:</strong> <span class="capitalize">${bill.status}</span></p>
                    <p><strong>Created:</strong> ${new Date(bill.created_at).toLocaleString()}</p>
                    ${bill.items && bill.items.length > 0 ? `
                        <ul class="list-disc list-inside text-xs mt-1">
                            ${bill.items.map(item => `<li>${item.quantity} x ${item.name}</li>`).join('')}
                        </ul>
                    ` : '<p class="text-xs text-gray-500">No items listed on bill yet.</p>'}
                </div>`;
        });
        html += `</div>`;
    } else if (table.status === 'occupied') {
         html += `<div><p class="text-gray-500">No active bill found for this occupied table.</p></div>`;
    }


    // Order Info
    const relevantOrders = orders.filter(o => ['received', 'in-progress', 'ready', 'delivered'].includes(o.status)); // Filter relevant orders
     if (relevantOrders.length > 0) {
        html += `
            <div>
                <h4 class="font-semibold text-gray-800 mb-1">Current Order(s)</h4>`;
         relevantOrders.forEach(order => {
            html += `
                <div class="mb-2 p-2 border rounded bg-blue-50">
                    <p><strong>Order ID:</strong> ${order.order_id}</p>
                    <p><strong>Status:</strong> <span class="capitalize">${order.status}</span></p>
                     <p><strong>Created:</strong> ${new Date(order.created_at).toLocaleString()}</p>
                    ${order.special_instructions ? `<p><strong>Notes:</strong> ${order.special_instructions}</p>` : ''}
                    ${order.items && order.items.length > 0 ? `
                        <p class="mt-1 font-medium">Items:</p>
                        <ul class="list-disc list-inside text-xs">
                            ${order.items.map(item => `<li>${item.quantity} x ${item.name || `(Item ID: ${item.item_id})`} ${item.notes ? `(${item.notes})` : ''}</li>`).join('')}
                        </ul>
                    ` : '<p class="text-xs text-gray-500">No items listed in this order.</p>'}
                </div>`;
         });
         html += `</div>`;
    } else {
         html += `<div><p class="text-gray-500">No active orders found for this table.</p></div>`;
    }


    html += `</div>`; // Close space-y-4
    content.innerHTML = html;
}

// Function to show error in modal
function showDetailsModalError(errorMessage) {
     const modal = document.getElementById('table-details-modal');
    if (!modal) return;
    const content = modal.querySelector('#table-details-content');
     content.innerHTML = `
        <div class="text-center py-5 text-red-600">
            <p><strong>Error loading details:</strong></p>
            <p>${errorMessage}</p>
        </div>`;
}

// --- END: Added Modal Functions ---

// Export functions for use in other modules
export {
    renderTables,
    createTableElement,
    updateTableElement,
    updateTableWithBillData,
    showLoading,
    hideLoading,
    showError,
    showNotification,
    getTimeDifference,
    // --- Add modal functions to export ---
    showDetailsModalLoading, 
    populateTableDetailsModal,
    showDetailsModalError    
}; 