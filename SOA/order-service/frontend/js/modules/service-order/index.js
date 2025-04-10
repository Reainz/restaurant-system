// Main entry point for service-order.js
// Access config via window object
// import { API_CONFIG } from '../../config.js'; 
import { showNotification } from '../../utils/notifications.js';
// Removed domElements import as it's handled within specific modules if needed
import { loadOrders, getAllOrders } from './order-service.js';
import { loadMenuItems, getMenuItems } from './menu-service.js';
import { loadTableNumbers, getAllTables } from './table-service.js';
import { renderOrders, renderMenuItems, renderTables, updateOrderSummary } from './ui-renderer.js';
import { setupEventListeners } from './event-handlers.js';
// Removed data-loader import as logic is restored here
// import { loadInitialData } from './data-loader.js';

/**
 * Main initialization function for the Service Staff Order Management page
 */
async function initializeServicePage() {
    console.log('Initializing Service Staff page data...');
    try {
        // Load initial data (orders, tables, menu items) using Promise.all
        console.log('Starting initial data load...');
        const ordersPromise = loadOrders();
        const menuItemsPromise = loadMenuItems();
        const tablesPromise = loadTableNumbers();
        
        // Wait for all essential data to load
        const [/*ordersResult*/, /*menuItemsResult*/, tablesResult] = await Promise.all([
            ordersPromise, 
            menuItemsPromise, 
            tablesPromise
        ]);
        console.log('Initial data promises resolved.');

        // Use the functions to get the latest state after loading
        const currentOrders = getAllOrders();
        const currentMenuItems = getMenuItems();
        const currentTables = getAllTables(); // Use the result directly or getAllTables

        console.log(`Rendering initial UI with ${currentOrders.length} orders, ${currentMenuItems.length} menu items, ${currentTables.length} tables.`);
        // Render the initial UI
        renderOrders(currentOrders);
        renderMenuItems(currentMenuItems); // Render menu items if needed for modals etc.
        renderTables(currentTables); // Render tables into the filter dropdown
        updateOrderSummary(currentOrders); // Update dashboard stats
        
        console.log('Initial data loaded and rendered.');
        
    } catch (error) {
        console.error('Error loading initial data:', error);
        showNotification('Error loading initial page data. Some features might not work.', 'error');
    }
}

// Set up event listeners *after* the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM fully loaded and parsed. Setting up event listeners...');
    setupEventListeners();
    console.log('Event listeners set up.');
});

// Load data and render the initial UI as soon as the script runs
initializeServicePage(); 