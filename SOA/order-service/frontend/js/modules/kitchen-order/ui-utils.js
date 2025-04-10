// UI utilities for kitchen-order.js

/**
 * Get CSS color class for a status
 * @param {string} status - The status
 * @returns {string} - The color class for the status
 */
function getStatusColorClass(status) {
    switch (status) {
        case 'received':
            return 'bg-blue-500';
        case 'in-progress':
            return 'bg-yellow-500';
        case 'ready':
            return 'bg-green-500';
        case 'delivered':
            return 'bg-purple-500';
        case 'completed':
            return 'bg-gray-500';
        case 'cancelled':
            return 'bg-red-500';
        case 'delayed':
            return 'bg-orange-500';
        case 'paused':
            return 'bg-orange-300';
        default:
            return 'bg-gray-500';
    }
}

/**
 * Get CSS class for item status button
 * @param {string} status - The status
 * @returns {string} - The CSS class for the button
 */
function getItemStatusButtonClass(status) {
    switch (status) {
        case 'received':
            return 'bg-blue-100 text-blue-700 hover:bg-blue-200';
        case 'in-progress':
            return 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200';
        case 'ready':
            return 'bg-green-100 text-green-700 hover:bg-green-200';
        default:
            return 'bg-gray-100 text-gray-700 hover:bg-gray-200';
    }
}

/**
 * Capitalize first letter of a string
 * @param {string} string - The string to capitalize
 * @returns {string} - The capitalized string
 */
function capitalizeFirstLetter(string) {
    if (!string) return '';
    return string.charAt(0).toUpperCase() + string.slice(1);
}

/**
 * Calculate wait time in minutes from a timestamp
 * @param {string} startTime - The start time
 * @returns {number} - The wait time in minutes
 */
function calculateWaitTime(startTime) {
    const start = new Date(startTime);
    const now = new Date();
    const diffMs = now - start;
    const diffMinutes = Math.floor(diffMs / 60000);
    return diffMinutes;
}

/**
 * Format a date for display
 * @param {string} dateString - The date string
 * @returns {string} - The formatted date
 */
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString();
}

/**
 * Check if an item is delayed
 * @param {Object} item - The order item
 * @param {number} threshold - The threshold in minutes
 * @returns {boolean} - Whether the item is delayed
 */
function isItemDelayed(item, threshold = 15) {
    if (item.status === 'ready' || item.status === 'completed') {
        return false;
    }
    
    const waitTime = calculateWaitTime(item.created_at || item.updated_at);
    return waitTime > threshold;
}

/**
 * Get local storage data
 * @param {string} key - The key to get
 * @param {*} defaultValue - The default value
 * @returns {*} - The stored data or default value
 */
function getLocalStorageData(key, defaultValue = []) {
    try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : defaultValue;
    } catch (error) {
        console.error(`Error reading ${key} from localStorage:`, error);
        return defaultValue;
    }
}

/**
 * Save data to local storage
 * @param {string} key - The key to save under
 * @param {*} data - The data to save
 */
function saveToLocalStorage(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
        console.error(`Error saving to localStorage:`, error);
    }
}

// Export UI utilities
export {
    getStatusColorClass,
    getItemStatusButtonClass,
    capitalizeFirstLetter,
    calculateWaitTime,
    formatDate,
    isItemDelayed,
    getLocalStorageData,
    saveToLocalStorage
};