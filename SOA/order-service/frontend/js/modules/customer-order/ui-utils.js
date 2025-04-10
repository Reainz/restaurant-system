// UI utilities module for customer-order.js

/**
 * Get the CSS class for a status badge
 * @param {string} status - The order status
 * @returns {string} - The CSS class
 */
function getStatusClass(status) {
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
}

/**
 * Format a date for display
 * @param {string} dateString - The date string
 * @returns {string} - The formatted date
 */
function formatDate(dateString) {
    const date = new Date(dateString);
    
    // Format as: "Jan 1, 2023, 10:30 AM"
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });
}

/**
 * Format a date as a relative time (e.g., "5 minutes ago")
 * @param {string} dateString - The date string
 * @returns {string} - The relative time
 */
function formatRelativeTime(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    
    // Convert to seconds
    const diffSec = Math.floor(diffMs / 1000);
    
    if (diffSec < 60) {
        return `${diffSec} second${diffSec === 1 ? '' : 's'} ago`;
    }
    
    // Convert to minutes
    const diffMin = Math.floor(diffSec / 60);
    
    if (diffMin < 60) {
        return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`;
    }
    
    // Convert to hours
    const diffHour = Math.floor(diffMin / 60);
    
    if (diffHour < 24) {
        return `${diffHour} hour${diffHour === 1 ? '' : 's'} ago`;
    }
    
    // Convert to days
    const diffDay = Math.floor(diffHour / 24);
    
    if (diffDay < 30) {
        return `${diffDay} day${diffDay === 1 ? '' : 's'} ago`;
    }
    
    // For older dates, return formatted date
    return formatDate(dateString);
}

/**
 * Truncate a string to a maximum length
 * @param {string} str - The string to truncate
 * @param {number} maxLength - The maximum length
 * @returns {string} - The truncated string
 */
function truncateString(str, maxLength = 50) {
    if (!str || str.length <= maxLength) {
        return str;
    }
    
    return str.substring(0, maxLength - 3) + '...';
}

/**
 * Capitalize the first letter of a string
 * @param {string} str - The string to capitalize
 * @returns {string} - The capitalized string
 */
function capitalizeFirstLetter(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Get a user-friendly status label
 * @param {string} status - The order status
 * @returns {string} - The user-friendly label
 */
function getStatusLabel(status) {
    switch (status) {
        case 'received':
            return 'Order Received';
        case 'in-progress':
            return 'In Kitchen';
        case 'ready':
            return 'Ready for Pickup';
        case 'delivered':
            return 'Delivered';
        case 'completed':
            return 'Completed';
        case 'cancelled':
            return 'Cancelled';
        default:
            return capitalizeFirstLetter(status);
    }
}

/**
 * Format an item price for display
 * @param {number} price - The price
 * @param {number} quantity - The quantity
 * @returns {string} - The formatted price string
 */
function formatItemPrice(price, quantity = 1) {
    const formatter = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    });
    
    if (quantity === 1) {
        return formatter.format(price);
    } else {
        const unitPrice = formatter.format(price);
        const totalPrice = formatter.format(price * quantity);
        return `${unitPrice} x ${quantity} = ${totalPrice}`;
    }
}

/**
 * Get a description of estimated time based on status
 * @param {string} status - The order status
 * @returns {string} - The estimated time description
 */
function getEstimatedTimeDescription(status) {
    switch (status) {
        case 'received':
            return 'Your order has been received. Estimated preparation time: 15-20 minutes.';
        case 'in-progress':
            return 'Your order is being prepared in our kitchen. It should be ready in 10-15 minutes.';
        case 'ready':
            return 'Your order is ready for pickup!';
        case 'delivered':
        case 'completed':
            return 'Your order has been completed. Thank you for dining with us!';
        case 'cancelled':
            return 'This order has been cancelled.';
        default:
            return 'Status unknown. Please contact restaurant for details.';
    }
}

/**
 * Get the tracking steps for an order
 * @param {Object} order - The order
 * @returns {Array} - The tracking steps
 */
function getTrackingSteps(order) {
    const steps = [
        { 
            label: 'Order Placed',
            status: 'completed',
            time: order.created_at
        },
        { 
            label: 'Order Confirmed',
            status: order.status !== 'cancelled' ? 'completed' : 'cancelled',
            time: order.updated_at || order.created_at
        },
        { 
            label: 'Preparation Started',
            status: ['in-progress', 'ready', 'delivered', 'completed'].includes(order.status) 
                ? 'completed' 
                : (order.status === 'cancelled' ? 'cancelled' : 'pending'),
            time: order.prep_start_time || null
        },
        { 
            label: 'Ready for Pickup',
            status: ['ready', 'delivered', 'completed'].includes(order.status) 
                ? 'completed' 
                : (order.status === 'cancelled' ? 'cancelled' : 'pending'),
            time: order.ready_time || null
        },
        { 
            label: 'Order Completed',
            status: ['delivered', 'completed'].includes(order.status) 
                ? 'completed' 
                : (order.status === 'cancelled' ? 'cancelled' : 'pending'),
            time: order.completed_time || null
        }
    ];
    
    return steps;
}

// Export all utility functions
export {
    getStatusClass,
    formatDate,
    formatRelativeTime,
    truncateString,
    capitalizeFirstLetter,
    getStatusLabel,
    formatItemPrice,
    getEstimatedTimeDescription,
    getTrackingSteps
}; 