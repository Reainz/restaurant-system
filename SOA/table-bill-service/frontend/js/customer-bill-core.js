/**
 * Customer Bill View Core Functionality
 */

import { fetchBillDetails, refreshBillFromServices } from './customer-bill-api.js';
import { renderBillDetails, showErrorContainer, toggleLoading } from './customer-bill-ui.js';

// Constants
const BILLS_ENDPOINT = '/api/bills';

// Initialize when document is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('Customer Bill View JS loaded');
    initializeCustomerBillEvents();
    loadBillDetails();
});

/**
 * Initialize customer bill page events
 */
function initializeCustomerBillEvents() {
    // Request payment button click event
    const paymentBtn = document.getElementById('paymentButton');
    if (paymentBtn) {
        paymentBtn.addEventListener('click', requestPayment);
    }
}

/**
 * Load bill details from API
 */
async function loadBillDetails() {
    try {
        // Show loading indicator
        toggleLoading(true);
        
        // Hide error container
        document.getElementById('errorContainer').classList.add('hidden');
        
        // Show bill container
        document.getElementById('billContainer').classList.remove('hidden');
        
        // Get URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const tableId = urlParams.get('table_id');
        const orderId = urlParams.get('order_id');
        const billId = urlParams.get('bill_id');
        
        console.log('URL params:', { tableId, orderId, billId });
        
        // If no parameters are provided, show input form to get table number or order ID
        if (!tableId && !orderId && !billId) {
            // Hide loading indicator
            toggleLoading(false);
            
            // Hide bill container and show a form to input table number or order ID
            document.getElementById('billContainer').classList.add('hidden');
            
            // Create a form element if it doesn't exist
            if (!document.getElementById('tableInputForm')) {
                const formContainer = document.createElement('div');
                formContainer.id = 'tableInputForm';
                formContainer.className = 'bg-white rounded-lg shadow-lg p-6 text-center';
                formContainer.innerHTML = `
                    <div class="text-center mb-4">
                        <span class="inline-block p-3 rounded-full bg-blue-100 text-blue-600 mb-3">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                        </span>
                        <h2 class="text-2xl font-bold text-gray-800 mb-2">View Your Bill</h2>
                    </div>
                    <p class="text-gray-600 mb-6">Please enter your table number to view your bill</p>
                    <div class="mb-6 max-w-xs mx-auto">
                        <label for="tableNumberInput" class="block text-left text-sm font-medium text-gray-700 mb-1">Table Number</label>
                        <input type="text" id="tableNumberInput" placeholder="Enter table number" 
                            class="px-4 py-3 border border-gray-300 rounded-lg w-full text-center text-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                        <p class="text-xs text-gray-500 mt-1 text-left">The table number is usually displayed on your table or you can ask your server.</p>
                    </div>
                    <button id="submitTableButton" 
                        class="bg-blue-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-blue-700 transition duration-200 w-full max-w-xs">
                        View Bill
                    </button>
                    <p class="text-xs text-gray-500 mt-4">If you're having trouble, please ask a staff member for assistance.</p>
                `;
                
                // Insert the form before the bill container
                document.querySelector('.container').insertBefore(
                    formContainer, 
                    document.getElementById('billContainer')
                );
                
                // Add event listener for the submit button
                document.getElementById('submitTableButton').addEventListener('click', function() {
                    const tableNumber = document.getElementById('tableNumberInput').value.trim();
                    if (tableNumber) {
                        // Redirect to the same page with the table number as a parameter
                        window.location.href = `?table_id=${tableNumber}`;
                    } else {
                        // Show error if no table number is entered
                        alert('Please enter a valid table number');
                    }
                });
                
                // Add event listener for the enter key
                document.getElementById('tableNumberInput').addEventListener('keyup', function(event) {
                    if (event.key === 'Enter') {
                        document.getElementById('submitTableButton').click();
                    }
                });
            } else {
                // Show the form if it already exists
                document.getElementById('tableInputForm').classList.remove('hidden');
            }
            
            return;
        }
        
        // Fetch the bill details
        const billDetails = await fetchBillDetails(tableId, orderId, billId);
        
        if (!billDetails) {
            throw new Error('No bill found');
        }
        
        // Render the bill details
        renderBillDetails(billDetails);
        
    } catch (error) {
        console.error('Error loading bill details:', error);
        showErrorContainer('Unable to load bill details. ' + error.message);
    } finally {
        toggleLoading(false);
    }
}

/**
 * Update URL with bill ID for better sharing and refreshing
 * @param {string} billId - Bill ID
 */
function updateUrlWithBillId(billId) {
    // Don't change the URL if it already contains the bill ID
    if (window.location.search.includes(`bill_id=${billId}`)) return;
    
    // Build new URL with bill ID
    const newUrl = `${window.location.pathname}?bill_id=${billId}`;
    // Update browser URL without refreshing the page
    window.history.replaceState({}, '', newUrl);
}

/**
 * Handle payment request
 */
async function requestPayment() {
    try {
        // Get bill ID from URL or from data attribute
        const urlParams = new URLSearchParams(window.location.search);
        const billId = urlParams.get('bill_id') || document.getElementById('billDetails').dataset.billId;
        
        if (!billId) {
            throw new Error('No bill ID found');
        }
        
        // Show loading
        toggleLoading(true);
        
        // First, refresh the bill to make sure we have the latest data
        await refreshBillFromServices(billId);
        
        // Mark the bill as final
        const response = await fetch(`/api/bills/${billId}/status?status=final`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`Failed to update bill status: ${response.status}`);
        }
        
        // Get the updated bill
        const updatedBill = await fetch(`/api/bills/${billId}`).then(res => res.json());
        
        // Show payment confirmation
        const billContainer = document.getElementById('billContainer');
        const paymentButton = document.getElementById('paymentButton');
        
        if (paymentButton) {
            paymentButton.disabled = true;
            paymentButton.textContent = 'Payment Requested';
            paymentButton.classList.remove('bg-blue-600', 'hover:bg-blue-700');
            paymentButton.classList.add('bg-green-600');
        }
        
        // Show a confirmation message
        const confirmationMessage = document.createElement('div');
        confirmationMessage.className = 'mt-6 p-4 bg-green-100 text-green-800 rounded-md flex items-center';
        confirmationMessage.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
            <div>
                <p class="font-medium">Payment request sent!</p>
                <p class="text-sm">A server will come to your table to process your payment.</p>
            </div>
        `;
        
        // Add the confirmation message to the page
        billContainer.appendChild(confirmationMessage);
        
        // Scroll to the confirmation message
        confirmationMessage.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        
    } catch (error) {
        console.error('Error requesting payment:', error);
        showErrorContainer('Failed to request payment. Please call a server for assistance.');
    } finally {
        toggleLoading(false);
    }
}

// Export functions for use in other modules
export {
    initializeCustomerBillEvents,
    loadBillDetails,
    updateUrlWithBillId,
    requestPayment
}; 