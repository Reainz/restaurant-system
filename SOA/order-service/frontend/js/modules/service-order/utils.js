// Utility functions for service-order.js

/**
 * Get CSS class for order status
 * @param {string} status - The order status
 * @param {string} type - The type of class to return (default or badge)
 * @returns {string} - CSS class for the status
 */
function getStatusClass(status, type = 'default') {
    if (type === 'badge') {
        switch (status) {
            case 'received':
                return 'bg-blue-100 text-blue-800';
            case 'in-progress':
                return 'bg-yellow-100 text-yellow-800';
            case 'ready':
                return 'bg-green-100 text-green-800';
            case 'delivered':
                return 'bg-purple-100 text-purple-800';
            case 'completed':
                return 'bg-gray-100 text-gray-800';
            case 'cancelled':
                return 'bg-red-100 text-red-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    } else {
        switch (status) {
            case 'received':
                return 'border-blue-500';
            case 'in-progress':
                return 'border-yellow-500';
            case 'ready':
                return 'border-green-500';
            case 'delivered':
                return 'border-purple-500';
            case 'completed':
                return 'border-gray-500';
            case 'cancelled':
                return 'border-red-500';
            default:
                return 'border-gray-500';
        }
    }
}

/**
 * Format a price for display
 * @param {number} price - The price to format
 * @returns {string} - Formatted price
 */
function formatPrice(price) {
    // Ensure price is a number
    const numericPrice = Number(price);
    if (isNaN(numericPrice)) {
        console.warn(`Invalid price value received: ${price}`);
        return 'N/A'; // Or return 0 or an error string
    }
    // Format as integer (no decimal places)
    return numericPrice.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

/**
 * Format a date and time for display
 * @param {string} dateTimeString - The date time string to format
 * @returns {string} - Formatted date and time
 */
function formatDateTime(dateTimeString) {
    const date = new Date(dateTimeString);
    return date.toLocaleString();
}

/**
 * Filter orders based on filters
 * @param {Array} orders - Orders to filter
 * @param {Object} filters - Filter criteria
 * @returns {Array} - Filtered orders
 */
function filterOrders(orders, filters) {
    let filteredOrders = [...orders];
    
    // Filter by table
    if (filters.tableId && filters.tableId !== 'all') {
        filteredOrders = filteredOrders.filter(order => order.table_id === filters.tableId);
    }
    
    // Filter by status
    if (filters.status && filters.status !== 'all') {
        filteredOrders = filteredOrders.filter(order => order.status === filters.status);
    }
    
    // Filter by search term
    if (filters.searchTerm) {
        const searchLower = filters.searchTerm.toLowerCase();
        filteredOrders = filteredOrders.filter(order => 
            order.order_id.toLowerCase().includes(searchLower) ||
            order.table_id.toLowerCase().includes(searchLower) ||
            order.items.some(item => item.name.toLowerCase().includes(searchLower))
        );
    }
    
    // Filter by time period
    if (filters.timePeriod) {
        const now = new Date();
        let startDate;
        
        switch (filters.timePeriod) {
            case 'today':
                startDate = new Date(now.setHours(0, 0, 0, 0));
                break;
            case 'week':
                startDate = new Date(now.setDate(now.getDate() - now.getDay()));
                startDate.setHours(0, 0, 0, 0);
                break;
            case 'month':
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                break;
            default:
                startDate = null;
        }
        
        if (startDate) {
            filteredOrders = filteredOrders.filter(order => new Date(order.created_at) >= startDate);
        }
    }
    
    return filteredOrders;
}

/**
 * Save data to a CSV file
 * @param {string} csvContent - CSV content to save
 * @param {string} filename - Filename for the CSV
 */
function saveToCSV(csvContent, filename) {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    // Create a URL for the blob
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

/**
 * Generate a unique ID
 * @returns {string} - Unique ID
 */
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

/**
 * Parse URL parameters
 * @returns {Object} - URL parameters as an object
 */
function parseUrlParams() {
    const params = {};
    const queryString = window.location.search.substring(1);
    const pairs = queryString.split('&');
    
    for (let i = 0; i < pairs.length; i++) {
        const pair = pairs[i].split('=');
        if (pair[0]) {
            params[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1] || '');
        }
    }
    
    return params;
}

// Export utility functions
export {
    getStatusClass,
    formatPrice,
    formatDateTime,
    filterOrders,
    saveToCSV,
    generateId,
    parseUrlParams
}; 