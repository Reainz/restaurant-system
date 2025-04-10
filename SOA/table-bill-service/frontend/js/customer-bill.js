/**
 * Customer Bill View - Main Entry Point
 * 
 * This file serves as the entry point for the customer bill view functionality.
 * It imports and initializes all required modules.
 */

// Import functions from modules
import {
    initializeCustomerBillEvents,
    loadBillDetails,
    updateUrlWithBillId,
    requestPayment
} from './customer-bill-core.js';

import {
    fetchWithRetry,
    fetchBillDetails,
    refreshBillFromServices,
    fetchOrderDetails,
    fetchMenuItemDetails
} from './customer-bill-api.js';

import {
    toggleLoading,
    showErrorContainer,
    showNotification,
    renderBillDetails
} from './customer-bill-ui.js';

// Export essential functions for global access
window.loadBillDetails = loadBillDetails;
window.requestPayment = requestPayment;
window.showErrorContainer = showErrorContainer;
window.refreshBillFromServices = refreshBillFromServices;

// Customer bill functionality is now organized into the following modules:
// - customer-bill-core.js: Core functionality and initialization
// - customer-bill-api.js: API interaction functions
// - customer-bill-ui.js: UI display functions 