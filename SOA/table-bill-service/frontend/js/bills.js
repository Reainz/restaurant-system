/**
 * Bill Management functionality
 */

// Constants
const BILLS_ENDPOINT = '/api/bills';
const TABLES_ENDPOINT = '/api/tables';

// Initialize when document is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('Bill Management JS loaded');
    initializeBillEvents();
    loadBills();
    
    // Set up periodic refresh every 30 seconds
    setInterval(() => {
        console.log('Running periodic bill refresh');
        loadBills(true);
    }, 30000);
});

/**
 * Initialize event listeners for bill management
 */
function initializeBillEvents() {
    // Event listeners for filter buttons using class names
    document.querySelector('.all-bills')?.addEventListener('click', () => {
        console.log('Clearing all filters (status and date)');
        // Clear date filter
        currentDateFilter = null;
        // Reload bills without filters
        loadBills();
        // Highlight the 'All Bills' button
        setActiveFilterButton('.all-bills'); 
    });
    document.querySelector('.filter-pending')?.addEventListener('click', () => {
        filterBills('pending');
        setActiveFilterButton('.filter-pending');
    });
    document.querySelector('.filter-completed')?.addEventListener('click', () => {
        filterBills('completed');
        setActiveFilterButton('.filter-completed');
    });

    // Event listener for date filter
    const dateFilter = document.querySelector('.filter-by-date');
    if (dateFilter) {
        dateFilter.addEventListener('click', function() {
            showDateFilterModal();
        });
    }
}

/**
 * Filter the displayed bills based on payment status
 * @param {string|null} paymentStatus - The status to filter by ('pending', 'completed') or null for all
 */
function filterBills(paymentStatus) {
    console.log(`Filtering bills by status: ${paymentStatus}`);
    
    // Update button active states (optional but good UX)
    document.querySelectorAll('.flex.space-x-2.mb-4 button').forEach(btn => {
        btn.classList.remove('ring-2', 'ring-offset-2', 'ring-blue-500'); // Example active style
    });
    if (paymentStatus === null) {
        document.querySelector('.all-bills')?.classList.add('ring-2', 'ring-offset-2', 'ring-blue-500');
    } else if (paymentStatus === 'pending') {
        document.querySelector('.filter-pending')?.classList.add('ring-2', 'ring-offset-2', 'ring-blue-500');
    } else if (paymentStatus === 'completed') {
        document.querySelector('.filter-completed')?.classList.add('ring-2', 'ring-offset-2', 'ring-blue-500');
    }
    
    // Get the full list of bills stored globally
    const allBills = window.restaurantBills || [];
    if (!allBills || allBills.length === 0) {
        console.warn('No bills available to filter.');
        renderBills([]); // Render empty state
        return;
    }
    
    let filteredBills;
    if (paymentStatus === null) {
        // Show all bills
        filteredBills = allBills;
    } else {
        // Filter by the specified payment status
        filteredBills = allBills.filter(bill => bill.payment_status === paymentStatus);
    }
    
    console.log(`Rendering ${filteredBills.length} filtered bills.`);
    renderBills(filteredBills);
}

// Store the current date filter globally
let currentDateFilter = null;

/**
 * Load bills from API, optionally applying current filters
 * @param {boolean} forceRefresh - Whether to force refresh from external services
 */
async function loadBills(forceRefresh = false) {
    try {
        showLoading();
        console.log(`Fetching bills from API... Date filter: ${currentDateFilter}`);
        
        // Prepare filters object
        const filters = {};
        if (currentDateFilter) {
            filters.date = currentDateFilter;
        }

        let bills = null;
        let retryCount = 0;
        const maxRetries = 3;
        
        // Fetch bills with filters
        while (retryCount < maxRetries && bills === null) {
            try {
                // Pass filters to getBills
                const response = await TableBillAPI.getBills(filters, false);
                if (response && response.bills) {
                    bills = response.bills;
                    console.log(`Successfully loaded ${bills.length} bills on attempt ${retryCount + 1}`);
                    break;
                } else {
                    console.error('Invalid response format from API:', response);
                    retryCount++;
                    if (retryCount < maxRetries) {
                        console.log(`Retrying bills fetch (${retryCount}/${maxRetries})...`);
                        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retry
                    }
                }
            } catch (fetchError) {
                console.error('Error fetching bills:', fetchError);
                retryCount++;
                if (retryCount < maxRetries) {
                    console.log(`Retrying bills fetch (${retryCount}/${maxRetries})...`);
                    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retry
                }
            }
        }
        
        // If we still don't have bills after retries, show error
        if (!bills) {
            throw new Error('Failed to load bills after multiple attempts');
        }
        
        // Filter the locally stored list if date filter applied (for UI responsiveness)
        if (currentDateFilter) {
           renderBills(bills.filter(b => b.created_at.startsWith(currentDateFilter)));
        } else {
            renderBills(bills);
        }

        // Store potentially filtered bills in window object?
        // Or always store all fetched bills?
        window.restaurantBills = bills; // Store all fetched bills for filtering
        
        hideLoading();
        
        console.log('Bills loaded and rendered successfully');
        return bills;
    } catch (error) {
        console.error('Fatal error loading bills:', error);
        hideLoading();
        
        // Show error message in the UI
        const billsContainer = document.querySelector('.space-y-4');
        if (billsContainer) {
            billsContainer.innerHTML = `
                <div class="bg-red-100 border border-red-200 text-red-800 p-4 rounded-lg">
                    <div class="flex items-center">
                        <i class="fas fa-exclamation-triangle text-xl mr-2"></i>
                        <span class="font-medium">Error loading bills:</span> ${error.message || 'Unknown error'}
                    </div>
                    <div class="mt-2">
                        <button id="retry-bills-btn" class="bg-blue-500 hover:bg-blue-600 text-white py-1 px-3 rounded text-sm">
                            <i class="fas fa-sync mr-1"></i> Retry
                        </button>
                    </div>
                </div>
            `;
            
            // Add retry event listener
            document.getElementById('retry-bills-btn')?.addEventListener('click', () => loadBills(false));
        }
        
        // Show user-friendly error notification
        showError(`Failed to load bills: ${error.message || 'Unknown error'}`);
        
        return [];
    }
}

/**
 * Render bills in the UI
 * @param {Array} bills - Array of bill objects
 */
function renderBills(bills) {
    const billsContainer = document.querySelector('.space-y-4');
    if (!billsContainer) {
        console.error('Bills container not found');
        return;
    }
    
    // Clear existing content
    billsContainer.innerHTML = '';
    
    if (bills.length === 0) {
        billsContainer.innerHTML = '<div class="p-6 bg-gray-100 rounded-lg text-center">No bills found</div>';
        return;
    }
    
    // Sort bills by date (newest first)
    bills.sort((a, b) => {
        return new Date(b.created_at) - new Date(a.created_at);
    });
    
    // Add each bill to the container
    bills.forEach(bill => {
        const billElement = createBillElement(bill);
        billsContainer.appendChild(billElement);
    });
}

/**
 * Create HTML element for a bill
 * @param {Object} bill - Bill object
 * @returns {HTMLElement} - Bill element
 */
function createBillElement(bill) {
    const billDiv = document.createElement('div');
    billDiv.className = 'bg-white p-6 rounded-lg shadow-sm border border-gray-100';
    billDiv.dataset.billId = bill.bill_id;
    billDiv.dataset.paymentStatus = bill.payment_status;
    
    // Format date
    const billDate = new Date(bill.created_at);
    const formattedDate = billDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    
    // Determine payment status class and icon
    let statusClass = 'bg-yellow-100 text-yellow-600';
    let statusIcon = 'fas fa-hourglass-half';
    let statusText = 'Pending';
    
    if (bill.payment_status === 'paid') {
        statusClass = 'bg-green-100 text-green-600';
        statusIcon = 'fas fa-check';
        statusText = 'Paid';
    }
    
    billDiv.innerHTML = `
        <div class="flex justify-between items-start">
            <div>
                <div class="flex items-center mb-2">
                    <h3 class="text-xl font-bold mr-3">Table ${bill.table_id}</h3>
                    <span class="${statusClass} px-2 py-1 rounded-full text-xs font-medium">
                        <i class="${statusIcon} mr-1"></i> ${statusText}
                    </span>
                </div>
                <p class="text-gray-600 text-sm mb-1">${formattedDate}</p>
                <p class="text-lg font-medium text-gray-800">${formatPriceVND(bill.total_amount)}</p>
            </div>
            <div class="flex flex-col space-y-2">
                <!-- Payment Button: Show "Mark as Paid" only if pending -->
                ${bill.payment_status === 'pending' ? `
                <button class="bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded-md text-sm flex items-center justify-center mark-paid-button" data-bill-id="${bill.bill_id}">
                    <i class="fas fa-check-circle mr-2"></i> Mark as Paid
                </button>
                ` : `
                <button class="bg-gray-300 text-gray-500 py-2 px-4 rounded-md text-sm flex items-center justify-center cursor-not-allowed" disabled>
                    <i class="fas fa-check mr-2"></i> Paid
                </button>
                `}
                <!-- Print Button (Functionality: Export CSV) -->
                <button class="bg-gray-100 hover:bg-gray-200 text-gray-600 py-2 px-4 rounded-md text-sm flex items-center justify-center print-button" data-bill-id="${bill.bill_id}">
                    <i class="fas fa-print mr-2"></i> Print
                </button>
            </div>
        </div>
    `;

    // Add event listeners for the dynamically created buttons
    const markPaidBtn = billDiv.querySelector('.mark-paid-button');
    if (markPaidBtn) {
        markPaidBtn.addEventListener('click', (event) => {
            const button = event.currentTarget;
            const billId = button.dataset.billId;
            markBillAsPaid(billId, button); // Pass button for UI updates
        });
    }

    // Changed selector back to .print-button
    const printBtn = billDiv.querySelector('.print-button');
    if (printBtn) {
        printBtn.addEventListener('click', (event) => {
            const billId = event.currentTarget.dataset.billId;
            // Changed function call back to printBill
            printBill(billId);
        });
    }

    return billDiv;
}

// Helper functions

function showLoading() {
    // Create or show loading indicator
    let loading = document.getElementById('loading-indicator');
    if (!loading) {
        loading = document.createElement('div');
        loading.id = 'loading-indicator';
        loading.className = 'fixed top-0 left-0 w-full h-full flex items-center justify-center bg-black bg-opacity-50 z-50';
        loading.innerHTML = '<div class="bg-white p-4 rounded-lg shadow-lg"><i class="fas fa-spinner fa-spin mr-2"></i>Loading...</div>';
        document.body.appendChild(loading);
    } else {
        loading.style.display = 'flex';
    }
}

function hideLoading() {
    const loading = document.getElementById('loading-indicator');
    if (loading) {
        loading.style.display = 'none';
    }
}

function showError(message) {
    // Create or update error message
    let errorEl = document.getElementById('error-message');
    if (!errorEl) {
        errorEl = document.createElement('div');
        errorEl.id = 'error-message';
        errorEl.className = 'fixed top-4 right-4 bg-red-500 text-white px-4 py-2 rounded shadow-lg z-50';
        document.body.appendChild(errorEl);
    }
    
    errorEl.textContent = message;
    errorEl.style.display = 'block';
    
    // Hide after 3 seconds
    setTimeout(() => {
        errorEl.style.display = 'none';
    }, 3000);
}

function showDateFilterModal() {
    console.log('Showing date filter modal');
    const modal = document.getElementById('dateFilterModal');
    const dateInput = document.getElementById('filterDate');
    const cancelBtn = document.getElementById('cancelDateFilter');
    const applyBtn = document.getElementById('applyDateFilter');

    if (!modal || !dateInput || !cancelBtn || !applyBtn) {
        console.error("Date filter modal elements not found!");
        return;
    }

    // Set current date if filter is active
    dateInput.value = currentDateFilter || '';

    // Show modal
    modal.classList.remove('hidden');

    // Apply filter handler
    const applyHandler = () => {
        const selectedDate = dateInput.value; // Format YYYY-MM-DD
        console.log("Applying date filter:", selectedDate);
        currentDateFilter = selectedDate || null; // Store globally or clear if empty
        modal.classList.add('hidden');
        loadBills(); // Reload bills with the new date filter
        removeListeners(); // Clean up listeners
    };

    // Cancel filter handler
    const cancelHandler = () => {
        console.log("Cancelling date filter modal");
        modal.classList.add('hidden');
        removeListeners(); // Clean up listeners
    };
    
    // Function to remove listeners
    const removeListeners = () => {
        applyBtn.removeEventListener('click', applyHandler);
        cancelBtn.removeEventListener('click', cancelHandler);
    }

    // Add listeners (remove previous ones if any)
    removeListeners(); // Ensure no duplicate listeners
    applyBtn.addEventListener('click', applyHandler);
    cancelBtn.addEventListener('click', cancelHandler);
}

/**
 * Trigger HTML receipt download for a bill by navigating to the receipt endpoint
 * @param {string} billId - The ID of the bill to export
 */
function printBill(billId) {
    console.log('Triggering HTML receipt download for bill:', billId);
    // Point to the new HTML receipt endpoint
    const receiptUrl = `/api/bills/${billId}/receipt`;
    // Simply navigate to the URL; browser will handle download based on headers
    window.location.href = receiptUrl;
}

/**
 * Update bill status
 * @param {string} billId - ID of the bill
 * @param {string} status - New status
 */
async function updateBillStatus(billId, status) {
    try {
        const response = await fetch(`/api/bills/${billId}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status })
        });
        
        if (!response.ok) {
            throw new Error('Failed to update bill status');
        }
        
        // Refresh bill display
        loadBills();
    } catch (error) {
        console.error('Error updating bill status:', error);
        // Display error message to user
    }
}

/**
 * Refresh bill data from external services
 * @param {string} billId - The ID of the bill to refresh
 */
async function refreshBillData(billId) {
    const refreshButton = document.querySelector(`.refresh-bill-btn[data-bill-id="${billId}"]`);
    const refreshIcon = refreshButton ? refreshButton.querySelector('i') : null;
    const statusMessage = document.querySelector(`#bill-refresh-status-${billId}`);

    try {
        if (refreshButton) {
            refreshButton.disabled = true;
            refreshButton.classList.add('opacity-70');
            if (refreshIcon) {
                refreshIcon.classList.add('animate-spin');
            }
        }
        
        // Create or update status message element if it doesn't exist
        if (!statusMessage) {
            const container = document.querySelector(`.bill-item[data-bill-id="${billId}"]`);
            if (container) {
                const statusEl = document.createElement('div');
                statusEl.id = `bill-refresh-status-${billId}`;
                statusEl.className = 'text-xs mt-1 text-gray-600 italic';
                statusEl.textContent = 'Refreshing data from Order and Menu services...';
                container.appendChild(statusEl);
            }
        } else {
            statusMessage.className = 'text-xs mt-1 text-gray-600 italic';
            statusMessage.textContent = 'Refreshing data from Order and Menu services...';
        }

        console.log(`Refreshing bill ${billId} data...`);
        const response = await TableBillAPI.refreshBillData(billId);
        console.log('Refresh response:', response);
        
        // Get updated bill data after refresh
        const billData = await TableBillAPI.getBill(billId, true);
        
        // Find and update the bill in the DOM
        const billElement = document.querySelector(`.bill-item[data-bill-id="${billId}"]`);
        if (billElement) {
            // Update amount
            const amountElement = billElement.querySelector('.bill-amount');
            if (amountElement && billData) {
                amountElement.textContent = `$${billData.total_amount.toFixed(2)}`;
            }
            
            // Update status message
            if (response && response.updates_applied) {
                if (statusMessage) {
                    statusMessage.className = 'text-xs mt-1 text-green-600 italic';
                    statusMessage.textContent = 'Bill data successfully updated from external services';
                    // Automatically clear the message after 5 seconds
                    setTimeout(() => {
                        statusMessage.textContent = '';
                    }, 5000);
                }
            } else {
                if (statusMessage) {
                    statusMessage.className = 'text-xs mt-1 text-gray-600 italic';
                    statusMessage.textContent = 'Bill data is already up to date';
                    // Automatically clear the message after 5 seconds
                    setTimeout(() => {
                        statusMessage.textContent = '';
                    }, 5000);
                }
            }
        }
        
        // Reload bills to show updated data
        loadBills();
        
    } catch (error) {
        console.error('Error refreshing bill data:', error);
        
        if (statusMessage) {
            statusMessage.className = 'text-xs mt-1 text-red-600 italic';
            statusMessage.textContent = `Error: ${error.message || 'Failed to refresh bill data'}`;
        }
        
        // Show an error notification
        showError(`Failed to refresh bill ${billId}: ${error.message || 'Unknown error'}`);
    } finally {
        // Reset refresh button state
        if (refreshButton) {
            refreshButton.disabled = false;
            refreshButton.classList.remove('opacity-70');
            if (refreshIcon) {
                refreshIcon.classList.remove('animate-spin');
            }
        }
    }
}

/**
 * Adds a refresh button to bill details
 * @param {HTMLElement} container - The container to add the button to
 * @param {string} billId - The ID of the bill
 */
function addRefreshButton(container, billId) {
    const refreshButtonGroup = document.createElement('div');
    refreshButtonGroup.className = 'mt-4';
    
    const refreshButton = document.createElement('button');
    refreshButton.className = 'bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-md';
    refreshButton.innerHTML = '<i class="fas fa-sync-alt mr-2"></i>Refresh from Services';
    refreshButton.onclick = async () => {
        try {
            refreshButton.disabled = true;
            refreshButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Refreshing...';
            await refreshBillData(billId);
        } finally {
            refreshButton.disabled = false;
            refreshButton.innerHTML = '<i class="fas fa-sync-alt mr-2"></i>Refresh from Services';
        }
    };
    
    refreshButtonGroup.appendChild(refreshButton);
    container.appendChild(refreshButtonGroup);
}

// Add the refresh button to bill details when loaded
document.addEventListener('DOMContentLoaded', () => {
    // ... existing event listeners ...
    
    // Hook into the displayBillDetails function if it exists
    const originalDisplayBillDetails = window.displayBillDetails || function() {};
    window.displayBillDetails = function(bill, container) {
        // Call the original function
        originalDisplayBillDetails(bill, container);
        
        // Add the refresh button
        if (bill && bill.bill_id) {
            addRefreshButton(container, bill.bill_id);
        }
    };
});

// --- Add formatPriceVND function (as we can't create utils.js) ---
function formatPriceVND(price) {
    const number = Number(price);
    if (isNaN(number)) return 'N/A';
    return new Intl.NumberFormat('vi-VN', {
        style: 'currency', currency: 'VND', minimumFractionDigits: 0, maximumFractionDigits: 0
    }).format(number);
}
// --- End formatPriceVND ---

// --- Add showNotification function (Copied from customer-bill-ui.js) ---
/**
 * Show a temporary notification message
 * @param {string} message - The message to display
 * @param {boolean} isError - Whether the message is an error (true) or success (false)
 */
function showNotification(message, isError = false) {
    const notificationElement = isError ? document.getElementById('errorMessage') : document.getElementById('successMessage');
    if (!notificationElement) return;

    notificationElement.textContent = message;
    notificationElement.classList.remove('hidden');
    requestAnimationFrame(() => {
        notificationElement.classList.remove('translate-y-full', 'opacity-0');
        notificationElement.classList.add('translate-y-0', 'opacity-100');
    });

    // Hide after 3 seconds
    setTimeout(() => {
        notificationElement.classList.remove('translate-y-0', 'opacity-100');
        notificationElement.classList.add('translate-y-full', 'opacity-0');
        // Use transitionend event for smoother hiding if needed, but timeout is simpler
        setTimeout(() => notificationElement.classList.add('hidden'), 300); // Wait for transition
    }, 3000);
}
// --- End showNotification ---

/**
 * Mark a bill as paid by calling the API
 * @param {string} billId - The ID of the bill to mark as paid
 * @param {HTMLElement} buttonElement - The button that was clicked
 */
async function markBillAsPaid(billId, buttonElement) {
    console.log(`Attempting to mark bill ${billId} as paid...`);
    
    // Disable button during processing
    buttonElement.disabled = true;
    buttonElement.innerHTML = `<i class="fas fa-spinner fa-spin mr-2"></i> Processing...`;

    try {
        const response = await TableBillAPI.updatePaymentStatus(billId, 'paid');
        
        if (response) { // Assuming API returns the updated bill or success indicator
            console.log(`Successfully marked bill ${billId} as paid.`);
            // Use showNotification for success
            showNotification(`Bill ${billId.substring(0,6)}... marked as paid.`, false);
            
            // Update the UI for this specific bill row
            const billRow = buttonElement.closest('[data-bill-id]');
            if (billRow) {
                // Update status badge
                const statusSpan = billRow.querySelector('.text-xs.font-medium');
                if (statusSpan) {
                    statusSpan.className = 'bg-green-100 text-green-600 px-2 py-1 rounded-full text-xs font-medium';
                    statusSpan.innerHTML = `<i class="fas fa-check mr-1"></i> Paid`;
                }
                // Update payment status data attribute
                billRow.dataset.paymentStatus = 'completed';
                // Replace the button with a disabled 'Paid' indicator
                buttonElement.outerHTML = `
                <button class="bg-gray-300 text-gray-500 py-2 px-4 rounded-md text-sm flex items-center justify-center cursor-not-allowed" disabled>
                    <i class="fas fa-check mr-2"></i> Paid
                </button>`;
            }
        } else {
             throw new Error("API did not return a successful response.");
        }
    } catch (error) {
        console.error(`Error marking bill ${billId} as paid:`, error);
        // Use showNotification for error
        showNotification(`Failed to mark bill as paid: ${error.message || 'Unknown error'}`, true);
        // Re-enable the button if the call failed
        buttonElement.disabled = false;
        buttonElement.innerHTML = `<i class="fas fa-check-circle mr-2"></i> Mark as Paid`;
    }
}

/**
 * Helper function to visually indicate the active filter button
 * @param {string} selector - CSS selector for the button to activate
 */
function setActiveFilterButton(selector) {
    // Remove active style from all filter buttons
    document.querySelectorAll('.mb-6 .flex.space-x-2.mb-4 button').forEach(btn => {
        btn.classList.remove('ring-2', 'ring-offset-2', 'ring-blue-500'); // Adjust based on actual active style used
    });
    // Add active style to the specified button
    const activeButton = document.querySelector(selector);
    if (activeButton) {
        activeButton.classList.add('ring-2', 'ring-offset-2', 'ring-blue-500'); // Adjust based on actual active style used
    }
} 