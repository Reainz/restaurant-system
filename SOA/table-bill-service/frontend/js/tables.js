/**
 * Table Management - Main Entry Point
 * 
 * This file serves as the entry point for the table management functionality.
 * It imports and initializes all required modules.
 */

// Import functions from modules
import { 
    loadTableData, 
    initializeTableEvents,
    filterTables,
    enrichTablesWithBillData
} from './tables-core.js';

import {
    fetchTables,
    fetchBillsForTable,
    updateTableStatus,
    createTable,
    assignTable,
    createBill,
    fetchOrdersForTable
} from './tables-api.js';

import {
    renderTables,
    createTableElement,
    updateTableElement,
    updateTableWithBillData,
    showLoading,
    hideLoading,
    showError,
    showNotification,
    getTimeDifference
} from './tables-ui.js';

import {
    showTableDetails
} from './tables-actions.js';

// Export all functions for global access
window.loadTableData = loadTableData;
window.filterTables = filterTables;
window.showTableDetails = showTableDetails;
window.updateTableStatus = updateTableStatus;
window.createBill = createBill;
window.showError = showError;
window.showNotification = showNotification;

// Table management is now organized into the following modules:
// - tables-core.js: Core functionality and initialization
// - tables-api.js: API interaction functions
// - tables-ui.js: UI rendering functions
// - tables-actions.js: Table action functions 