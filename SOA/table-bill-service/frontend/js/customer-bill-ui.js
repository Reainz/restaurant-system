/**
 * Customer Bill View UI Functions
 */

/**
 * Toggle loading indicator
 * @param {boolean} isLoading - Whether loading is in progress
 */
function toggleLoading(isLoading) {
    const loader = document.getElementById('loadingIndicator');
    if (loader) {
        if (isLoading) {
            loader.classList.remove('hidden');
        } else {
            loader.classList.add('hidden');
        }
    }
}

/**
 * Show error container with message
 * @param {string} message - Error message to display
 */
function showErrorContainer(message) {
    // Hide bill container
    const billContainer = document.getElementById('billContainer');
    const tableInputForm = document.getElementById('tableInputForm');
    
    if (billContainer) billContainer.classList.add('hidden');
    if (tableInputForm) tableInputForm.classList.add('hidden');
    
    // Show error container
    const errorContainer = document.getElementById('errorContainer');
    if (errorContainer) {
        errorContainer.classList.remove('hidden');
        
        // Set error message
        const errorMessage = errorContainer.querySelector('.error-message');
        if (errorMessage) {
            errorMessage.textContent = message;
        }
        
        // Add retry button if not exists
        if (!errorContainer.querySelector('.retry-button')) {
            const retryButton = document.createElement('button');
            retryButton.className = 'retry-button mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition';
            retryButton.textContent = 'Try Again';
            retryButton.addEventListener('click', () => {
                // Reload the page
                window.location.reload();
            });
            errorContainer.appendChild(retryButton);
        }
    } else {
        // Fallback to alert if no error container
        alert(message);
    }
}

/**
 * Show notification
 * @param {string} message - Message to display
 * @param {string} type - 'success', 'error', or 'info'
 */
function showNotification(message, type = 'success') {
    // Create notification element if it doesn't exist
    let notification = document.getElementById('notification');
    if (!notification) {
        notification = document.createElement('div');
        notification.id = 'notification';
        notification.className = 'fixed top-4 right-4 max-w-md p-4 rounded-lg shadow-lg transform transition-all duration-300 translate-y-0 z-50';
        document.body.appendChild(notification);
    }
    
    // Set type-specific classes
    if (type === 'success') {
        notification.className = 'fixed top-4 right-4 max-w-md p-4 bg-green-100 text-green-800 rounded-lg shadow-lg transform transition-all duration-300 translate-y-0 z-50';
    } else if (type === 'error') {
        notification.className = 'fixed top-4 right-4 max-w-md p-4 bg-red-100 text-red-800 rounded-lg shadow-lg transform transition-all duration-300 translate-y-0 z-50';
    } else {
        notification.className = 'fixed top-4 right-4 max-w-md p-4 bg-blue-100 text-blue-800 rounded-lg shadow-lg transform transition-all duration-300 translate-y-0 z-50';
    }
    
    // Set message
    notification.textContent = message;
    
    // Show notification
    notification.classList.remove('translate-y-[-100%]');
    notification.classList.add('translate-y-0');
    
    // Hide after 3 seconds
    setTimeout(() => {
        notification.classList.remove('translate-y-0');
        notification.classList.add('translate-y-[-100%]');
    }, 3000);
}

// Add utility function directly here until file creation works
/**
 * Formats a number as Vietnamese Dong (₫) without decimal places.
 * 
 * @param {number|string} price - The price to format.
 * @returns {string} The formatted price string (e.g., "₫320,000") or 'N/A' if input is invalid.
 */
function formatPriceVND(price) {
    const number = Number(price);
    if (isNaN(number)) {
        console.warn(`Invalid input for formatPriceVND: ${price}`);
        return 'N/A';
    }

    return new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND',
        minimumFractionDigits: 0, // No decimal places for VND
        maximumFractionDigits: 0
    }).format(number);
}
// --- End of added utility function ---

/**
 * Render bill details in the UI
 * @param {Object} billDetails - Bill details to render
 */
function renderBillDetails(billDetails) {
    console.log('Rendering bill details:', billDetails);

    // Hide loading
    toggleLoading(false);

    // Get main bill container element using the correct ID
    const billContainerElement = document.getElementById('billContainer');
    if (!billContainerElement) {
        console.error('Bill container element not found');
        return;
    }
    
    // Define taxRate here so it's available for tax and total
    const taxRate = 0.07;

    // Set bill ID as data attribute on the container
    billContainerElement.dataset.billId = billDetails.bill_id;

    // Format created date & time separately
    const createdDate = new Date(billDetails.created_at);
    const formattedDate = new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    }).format(createdDate);
    const formattedTime = new Intl.DateTimeFormat('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true // Use AM/PM
    }).format(createdDate);

    // Update header fields directly
    const tableNumEl = document.getElementById('tableNumber');
    const orderIdEl = document.getElementById('orderId');
    const billDateEl = document.getElementById('billDate');
    const billTimeEl = document.getElementById('billTime');
    const paymentStatusEl = document.getElementById('paymentStatus');

    // --- Get Table Number --- 
    // Display table_id directly if it exists, otherwise show '--'
    let tableNumberDisplay = billDetails.table_id ? String(billDetails.table_id).replace('table-', '') : '--';
    // --- End Table Number ---

    if (tableNumEl) tableNumEl.textContent = tableNumberDisplay;
    if (orderIdEl) orderIdEl.textContent = billDetails.order_id.substring(0, 6) || '------'; // Show first 6 chars of order ID
    if (billDateEl) billDateEl.textContent = formattedDate;
    if (billTimeEl) billTimeEl.textContent = formattedTime;
    if (paymentStatusEl) {
        paymentStatusEl.textContent = billDetails.payment_status || 'pending';
        // Optional: Update class based on status if needed
        paymentStatusEl.className = `px-2 py-1 rounded-full text-xs font-medium status-${billDetails.payment_status || 'pending'}`;
    }

    // Render bill items
    const billItemsContainer = document.getElementById('billItems');
    if (billItemsContainer && billDetails.items && billDetails.items.length > 0) {
        let itemsHTML = '';
        
        billDetails.items.forEach(item => {
            // Use formatPriceVND for item price and subtotal
            const formattedItemPrice = formatPriceVND(item.price);
            const itemSubtotal = item.price * item.quantity;
            const formattedItemSubtotal = formatPriceVND(itemSubtotal);
            
            itemsHTML += `
                <div class="bill-item">
                    <div class="flex justify-between mb-1">
                        <div class="font-medium">${item.name}</div>
                        <div class="text-right font-medium">${formattedItemSubtotal}</div>
                    </div>
                    <div class="flex justify-between text-sm text-gray-600">
                        <div>${item.quantity} × ${formattedItemPrice}</div>
                    </div>
                </div>
            `;
        });
        
        billItemsContainer.innerHTML = itemsHTML;
    } else if (billItemsContainer) {
        billItemsContainer.innerHTML = '<p class="text-gray-500">No items found.</p>';
    }
    
    // Update bill summary
    const subtotalElement = document.getElementById('subtotal');
    const taxElement = document.getElementById('tax');
    const totalElement = document.getElementById('total');
    
    if (subtotalElement) {
        // Calculate subtotal from items
        const subtotal = billDetails.items ? 
            billDetails.items.reduce((sum, item) => sum + (item.price * item.quantity), 0) : 
            billDetails.total_amount; // Fallback
        
        // Use formatPriceVND for subtotal
        subtotalElement.textContent = formatPriceVND(subtotal);

        // --- REMOVE Tax Calculation and Display ---
        /*
        if (taxElement) {
            // taxRate is already defined above
            const taxAmount = subtotal * taxRate;
            taxElement.textContent = formatPriceVND(taxAmount);
        }
        */
       // Hide the tax element row if it exists
       if (taxElement) {
           taxElement.closest('div.flex').style.display = 'none'; // Hide the parent row
       }
        
        // --- Calculate and format total (Now just the subtotal) ---
        if (totalElement) {
             // totalAmount is now just the subtotal
             const totalAmount = subtotal;
             totalElement.textContent = formatPriceVND(totalAmount);
            
            // Log comparison if backend total differs (it should match subtotal now)
            if (Math.abs(totalAmount - billDetails.total_amount) > 0.01) { 
                console.warn(`Subtotal (${formatPriceVND(totalAmount)}) differs from backend total_amount (${formatPriceVND(billDetails.total_amount)}). Using subtotal.`);
            }
        }
    }
    
    // Update payment button state based on bill status
    const paymentButton = document.getElementById('paymentButton');
    if (paymentButton) {
        // Check for completed payment status OR closed bill status
        if (billDetails.payment_status === 'completed' || billDetails.status === 'closed' || billDetails.status === 'cancelled') {
            paymentButton.disabled = true;
            paymentButton.textContent = (billDetails.status === 'cancelled') ? 'Bill Cancelled' : 'Bill Paid'; // Show Cancelled or Paid
            paymentButton.classList.remove('bg-blue-600', 'hover:bg-blue-700', 'bg-green-600');
            paymentButton.classList.add('bg-gray-400');
        } else if (billDetails.status === 'final') {
            paymentButton.disabled = true;
            paymentButton.textContent = 'Payment Requested';
            paymentButton.classList.remove('bg-blue-600', 'hover:bg-blue-700', 'bg-gray-400');
            paymentButton.classList.add('bg-green-600');
        } else { // Default case (likely status 'open')
            paymentButton.disabled = false;
            paymentButton.textContent = 'Request Payment';
            paymentButton.classList.remove('bg-gray-400', 'bg-green-600');
            paymentButton.classList.add('bg-blue-600', 'hover:bg-blue-700');
        }
    }
    
    // Show the bill container
    const billContainer = document.getElementById('billContainer');
    if (billContainer) {
        billContainer.classList.remove('hidden');
    }
    
    // Hide the table input form if it exists
    const tableInputForm = document.getElementById('tableInputForm');
    if (tableInputForm) {
        tableInputForm.classList.add('hidden');
    }
}

// Export functions for use in other modules
export {
    toggleLoading,
    showErrorContainer,
    showNotification,
    renderBillDetails
}; 