// Menu Service module for service-order.js
// Access config via window object
// import { API_CONFIG } from '../../config.js';
import { showNotification } from '../../utils/notifications.js';

// State
let menuItems = [];
let selectedItems = [];
let orderTotal = 0;

/**
 * Load menu items from the backend
 * @returns {Promise<Array>} - The loaded menu items
 */
async function loadMenuItems() {
    try {
        // Use window.API_CONFIG
        const url = `${window.API_CONFIG.MENU_SERVICE_URL}/api/${window.API_CONFIG.ENDPOINTS.MENU_ITEMS}`;
        
        const response = await fetch(url, {
            method: 'GET',
            headers: window.API_CONFIG.DEFAULT_HEADERS
        });
        
        if (!response.ok) {
            throw new Error(`Failed to load menu items: ${response.status}`);
        }
        
        const data = await response.json();
        // Update the module-level menuItems array directly
        menuItems = data || []; // Assuming API returns array directly
        console.log(`[menu-service] Loaded ${menuItems.length} menu items into state.`); // Added log
        
        // Return the loaded items (optional)
        return menuItems; 
    } catch (error) {
        console.error('Error loading menu items:', error);
        showNotification('Could not load menu items. Order creation might be affected.', 'warning');
        menuItems = []; // Reset state on error
        return [];
    }
}

/**
 * Add an item to the selected items list
 * @param {Object} item - The menu item to add
 * @param {number} quantity - The quantity to add
 */
function addSelectedItem(item, quantity = 1) {
    // Check if item already exists in selected items
    const existingItem = selectedItems.find(selectedItem => selectedItem.item_id === item.item_id);
    
    if (existingItem) {
        // Update quantity
        existingItem.quantity += quantity;
    } else {
        // Add new item
        selectedItems.push({
            ...item,
            quantity
        });
    }
    
    // Update order total
    updateOrderTotal();
}

/**
 * Remove an item from the selected items list
 * @param {string} itemId - The item ID to remove
 */
function removeSelectedItem(itemId) {
    selectedItems = selectedItems.filter(item => item.item_id !== itemId);
    updateOrderTotal();
}

/**
 * Update the quantity of an item in the selected items list
 * @param {string} itemId - The item ID to update
 * @param {number} quantity - The new quantity
 */
function updateItemQuantity(itemId, quantity) {
    const item = selectedItems.find(item => item.item_id === itemId);
    
    if (item) {
        if (quantity <= 0) {
            // Remove item if quantity is 0 or negative
            removeSelectedItem(itemId);
        } else {
            // Update quantity
            item.quantity = quantity;
            updateOrderTotal();
        }
    }
}

/**
 * Update the order total based on selected items
 */
function updateOrderTotal() {
    orderTotal = selectedItems.reduce((total, item) => {
        return total + (item.price * item.quantity);
    }, 0);
}

/**
 * Get all menu items
 * @returns {Array} - All menu items
 */
function getMenuItems() {
    return menuItems;
}

/**
 * Get selected items
 * @returns {Array} - Selected items
 */
function getSelectedItems() {
    return selectedItems;
}

/**
 * Get the current order total
 * @returns {number} - The order total
 */
function getOrderTotal() {
    return orderTotal;
}

/**
 * Clear all selected items
 */
function clearSelectedItems() {
    selectedItems = [];
    orderTotal = 0;
}

/**
 * Get a menu item by ID
 * @param {string} itemId - The item ID to get
 * @returns {Object|null} - The menu item or null if not found
 */
function getMenuItemById(itemId) {
    return menuItems.find(item => item.item_id === itemId) || null;
}

/**
 * Set the selected items and recalculate order total
 * @param {Array} items - The items to set
 */
function setSelectedItems(items) {
    selectedItems = items;
    updateOrderTotal();
}

// Export functions and state
export {
    loadMenuItems,
    addSelectedItem,
    removeSelectedItem,
    updateItemQuantity,
    getMenuItems,
    getSelectedItems,
    getOrderTotal,
    clearSelectedItems,
    getMenuItemById,
    setSelectedItems
}; 