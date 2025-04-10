// Main kitchen order module
import { domElements } from './dom-elements.js';
import { 
    setupEventListeners,
    handleRefresh
} from './event-handlers.js';
import {
    renderOrderQueue,
    updateOrderQueueSummary
} from './ui-renderer.js';
import { 
    getLocalStorageData,
    getAllOrders,
    loadInitialOrders
} from './order-service.js';

/**
 * Initialize the kitchen order page
 */
async function initKitchenPage() {
    // Set up DOM elements references
    const { 
        statusFilter,
        showHistoryBtn,
        orderHistoryContainer
    } = domElements;
    
    // Set up event listeners for all interactive elements
    setupEventListeners();
    
    // Load orders from localStorage or API
    await loadInitialOrders();
    
    // Apply saved filter preference
    if (statusFilter) {
        const savedFilter = localStorage.getItem('kitchenStatusFilter') || 'active';
        statusFilter.value = savedFilter;
    }
    
    // Apply saved history preference
    const showHistory = localStorage.getItem('kitchenShowHistory') === 'true';
    if (showHistoryBtn && orderHistoryContainer) {
        if (showHistory) {
            orderHistoryContainer.classList.remove('hidden');
            showHistoryBtn.textContent = 'Hide History';
        } else {
            orderHistoryContainer.classList.add('hidden');
            showHistoryBtn.textContent = 'Show History';
        }
    }
    
    // Render orders initially
    renderOrderQueue();
    
    // Update summary statistics
    updateOrderQueueSummary();
    
    // Log initialization
    console.log('Kitchen Order Page initialized');
}

// Exports
export { 
    initKitchenPage
}; 