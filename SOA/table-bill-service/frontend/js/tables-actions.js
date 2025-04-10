/**
 * Table Management Action Functions
 */

import { 
    fetchBillsForTable, 
    fetchOrdersForTable, 
    createBill, 
    updateTableStatus 
} from './tables-api.js';
import { showError, showNotification, showDetailsModalLoading, populateTableDetailsModal, showDetailsModalError } from './tables-ui.js';

/**
 * Shows the table details modal
 * @param {Object} table - Table data
 */
async function showTableDetails(table) {
    if (!table || !table.table_id) {
        console.error('Invalid table data provided to showTableDetails');
        showDetailsModalError('Invalid table data.'); // Use modal error display
        return;
    }
    
    console.log(`Showing details for table: ${table.table_id}`);

    // 1. Show the modal in loading state immediately
    showDetailsModalLoading(table.table_number); 

    try {
        // 2. Fetch bills and orders concurrently
        const [bills, orders] = await Promise.all([
            fetchBillsForTable(table.table_id),
            fetchOrdersForTable(table.table_id)
        ]);

        console.log('Fetched Bills:', bills);
        console.log('Fetched Orders:', orders);

        // 3. Populate the modal with the fetched data
        populateTableDetailsModal(table, bills, orders);

            } catch (error) {
        console.error(`Error fetching details for table ${table.table_id}:`, error);
        // 4. Show error in the modal
        showDetailsModalError(`Failed to load details. ${error.message}`);
    }
}

// Export necessary functions
export {
    showTableDetails
    // renderTableBills, // Removed
    // renderTableOrders // Removed
}; 