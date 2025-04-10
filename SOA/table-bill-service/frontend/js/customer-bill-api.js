/**
 * Customer Bill View API Functions
 */

// Constants
const BILLS_ENDPOINT = '/api/bills';

/**
 * Perform API fetch with retry logic
 * @param {string} url - The URL to fetch
 * @param {Object} options - Fetch options
 * @param {number} retries - Number of retries (default 2)
 * @returns {Promise} - Fetch response promise
 */
async function fetchWithRetry(url, options = {}, retries = 2) {
    let lastError;
    
    for (let i = 0; i <= retries; i++) {
        try {
            const response = await fetch(url, options);
            
            if (!response.ok) {
                // If we get a 404, don't retry - it won't suddenly exist
                if (response.status === 404) {
                    throw new Error(`Resource not found (404): ${url}`);
                }
                
                // For other errors, retry
                throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
            }
            
            return response;
        } catch (error) {
            console.warn(`Attempt ${i + 1}/${retries + 1} failed:`, error.message);
            lastError = error;
            
            if (i < retries) {
                // Wait with exponential backoff before retrying (300ms, 900ms, etc.)
                const delay = 300 * Math.pow(3, i);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    
    throw lastError;
}

/**
 * Fetch bill details based on available parameters
 * @param {string} tableId - Table ID
 * @param {string} orderId - Order ID
 * @param {string} billId - Bill ID
 * @returns {Promise<Object>} Bill details
 */
async function fetchBillDetails(tableId, orderId, billId) {
    try {
        // Configure service URLs
        const orderServiceUrl = window.API_CONFIG ? window.API_CONFIG.ORDER_SERVICE_URL : 'http://localhost:8002';
        const menuServiceUrl = window.API_CONFIG ? window.API_CONFIG.MENU_SERVICE_URL : 'http://localhost:8000';
        
        let billDetails;
        
        // Case 1: We have a bill ID
        if (billId) {
            console.debug(`Fetching bill details for bill_id: ${billId}`);
            const apiUrl = `/api/bills/${billId}`;
            console.log(`Attempting to fetch from URL: ${window.location.origin}${apiUrl}`); // Log the full URL
            const response = await fetchWithRetry(apiUrl);
            
            // Check content type before parsing JSON
            const contentType = response.headers.get("content-type");
            if (contentType && contentType.indexOf("application/json") !== -1) {
                billDetails = await response.json();
                console.debug(`Initial bill details fetched:`, billDetails);

                // Force a refresh from services to get the latest data
                console.debug(`Refreshing bill details for ${billId} from services...`);
                await refreshBillFromServices(billId);
                
                // Get the updated bill
                console.debug(`Fetching refreshed bill details for ${billId}...`);
                const refreshedResponse = await fetchWithRetry(`/api/bills/${billId}`);
                const refreshedContentType = refreshedResponse.headers.get("content-type");
                if (refreshedContentType && refreshedContentType.indexOf("application/json") !== -1) {
                    billDetails = await refreshedResponse.json();
                    console.debug(`Refreshed bill details fetched:`, billDetails);
                } else {
                    console.error(`Refreshed bill response was not JSON. Content-Type: ${refreshedContentType}`);
                    const textResponse = await refreshedResponse.text();
                    console.error(`Refreshed bill response text: ${textResponse}`);
                    throw new Error("Received non-JSON response when fetching refreshed bill details.");
                }
            } else {
                console.error(`Initial bill response was not JSON. Content-Type: ${contentType}`);
                const textResponse = await response.text();
                console.error(`Initial bill response text: ${textResponse}`);
                throw new Error("Received non-JSON response when fetching initial bill details.");
            }
        }
        // Case 2: We have an order ID, try to find the bill for it
        else if (orderId) {
            // First check if there's already a bill for this order
            const billsResponse = await fetchWithRetry(`/api/bills?order_id=${orderId}`);
            const billsData = await billsResponse.json();
            
            if (billsData.bills && billsData.bills.length > 0) {
                // Get the most recent bill
                billDetails = billsData.bills[0];
                
                // Force refresh to get latest data
                await refreshBillFromServices(billDetails.bill_id);
                
                // Get updated bill
                const refreshedResponse = await fetchWithRetry(`/api/bills/${billDetails.bill_id}`);
                billDetails = await refreshedResponse.json();
                
                // Update URL with bill ID for future reference
                updateUrlWithBillId(billDetails.bill_id);
            } else {
                // Try to create a bill from the order ID
                try {
                    const createResponse = await fetchWithRetry(`/api/bills`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            order_id: orderId
                        })
                    });
                    
                    billDetails = await createResponse.json();
                    
                    // Update URL with bill ID
                    updateUrlWithBillId(billDetails.bill_id);
                } catch (error) {
                    // If we can't create a bill, try to get the order details directly
                    console.warn('Failed to create bill from order, falling back to order details:', error);
                    
                    const orderResponse = await fetchWithRetry(`${orderServiceUrl}/api/orders/${orderId}`);
                    const orderData = await orderResponse.json();
                    
                    if (!orderData) {
                        throw new Error(`Order not found: ${orderId}`);
                    }
                    
                    throw new Error('No bill found for this order yet');
                }
            }
        }
        // Case 3: We have a table ID, try to find the active bill for it
        else if (tableId) {
            // Check if there's an active bill for this table
            const tableIdParam = isNaN(tableId) ? `table_id=${tableId}` : `table_number=${tableId}`;
            const billsResponse = await fetchWithRetry(`/api/bills?${tableIdParam}&status=open,final`);
            const billsData = await billsResponse.json();
            
            if (billsData.bills && billsData.bills.length > 0) {
                // Get the most recent bill
                billDetails = billsData.bills[0];
                
                // Force refresh to get latest data
                await refreshBillFromServices(billDetails.bill_id);
                
                // Get updated bill
                const refreshedResponse = await fetchWithRetry(`/api/bills/${billDetails.bill_id}`);
                billDetails = await refreshedResponse.json();
                
                // Update URL with bill ID for future reference
                updateUrlWithBillId(billDetails.bill_id);
            } else {
                throw new Error(`No active bill found for table ${tableId}`);
            }
        }
        
        if (!billDetails) {
            throw new Error('No bill found');
        }
        
        return billDetails;
        
    } catch (error) {
        console.error('Error fetching bill details:', error);
        throw error;
    }
}

/**
 * Force refresh a bill from external services
 * @param {string} billId - Bill ID
 * @returns {Promise<Object>} Refresh result
 */
async function refreshBillFromServices(billId) {
    try {
        const response = await fetchWithRetry(`/api/bills/${billId}/refresh`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        return await response.json();
    } catch (error) {
        console.error(`Error refreshing bill ${billId}:`, error);
        // Non-fatal error, so return a default response
        return { refreshed: false, error: error.message };
    }
}

/**
 * Fetch order details for a given order ID
 * @param {string} orderId - Order ID
 * @returns {Promise<Object>} Order details
 */
async function fetchOrderDetails(orderId) {
    try {
        const orderServiceUrl = window.API_CONFIG ? window.API_CONFIG.ORDER_SERVICE_URL : 'http://localhost:8002';
        const response = await fetchWithRetry(`${orderServiceUrl}/api/orders/${orderId}`);
        return await response.json();
    } catch (error) {
        console.error(`Error fetching order ${orderId}:`, error);
        throw error;
    }
}

/**
 * Fetch menu item details
 * @param {string} itemId - Menu item ID
 * @returns {Promise<Object>} Menu item details
 */
async function fetchMenuItemDetails(itemId) {
    try {
        const menuServiceUrl = window.API_CONFIG ? window.API_CONFIG.MENU_SERVICE_URL : 'http://localhost:8000';
        const response = await fetchWithRetry(`${menuServiceUrl}/api/menu-items/${itemId}`);
        return await response.json();
    } catch (error) {
        console.error(`Error fetching menu item ${itemId}:`, error);
        // Return null for menu item details since it's non-fatal
        return null;
    }
}

// Helper function to update URL with bill ID
function updateUrlWithBillId(billId) {
    if (!billId) return;
    
    // Check if URL already has this bill ID
    if (window.location.search.includes(`bill_id=${billId}`)) return;
    
    // Create new URL with bill ID parameter
    const newUrl = `${window.location.pathname}?bill_id=${billId}`;
    
    // Update URL without refreshing page
    window.history.replaceState(null, '', newUrl);
}

// Export functions for use in other modules
export {
    fetchWithRetry,
    fetchBillDetails,
    refreshBillFromServices,
    fetchOrderDetails,
    fetchMenuItemDetails,
    updateUrlWithBillId
}; 