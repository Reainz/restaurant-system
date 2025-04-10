/**
 * Table Management Core Functionality
 */

// Import dependencies
import { fetchTables, fetchBillsForTable } from './tables-api.js';
import { renderTables, updateTableWithBillData, showLoading, hideLoading, showError } from './tables-ui.js';

// Initialize when document is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('Table Management JS loaded');
    initializeTableEvents();
    loadTableData();
    
    // Set up periodic refresh every 30 seconds
    setInterval(() => {
        console.log('Running periodic table data refresh');
        loadTableData();
    }, 30000);
});

/**
 * Initialize event listeners for table management
 */
function initializeTableEvents() {
    // Event listeners for filter buttons using class names
    document.querySelector('.all-tables')?.addEventListener('click', () => filterTables(null));
    document.querySelector('.filter-available')?.addEventListener('click', () => filterTables('available'));
    document.querySelector('.filter-occupied')?.addEventListener('click', () => filterTables('occupied'));
    document.querySelector('.filter-reserved')?.addEventListener('click', () => filterTables('reserved'));
}

/**
 * Loads table data from the API and refreshes the UI
 */
async function loadTableData() {
    try {
        showLoading();
        console.log('Fetching tables from API...');
        
        const tables = await fetchTables();
        renderTables(tables);
        
        hideLoading();
        
        return tables;
    } catch (error) {
        console.error('Error loading tables:', error);
        hideLoading();
        showError('Failed to load tables. Please try again.');
        return [];
    }
}

/**
 * Filter tables based on status
 * @param {string} status - Status to filter by
 */
function filterTables(status) {
    console.log(`Filtering tables by status: ${status || 'all'}`);
    
    // Get all table elements
    const tableElements = document.querySelectorAll('.table-card');
    
    // Handle filter class highlighting
    const filterButtons = document.querySelectorAll('.filter-btn');
    filterButtons.forEach(btn => btn.classList.remove('active'));
    
    if (status === null) {
        document.querySelector('.all-tables').classList.add('active');
    } else {
        document.querySelector(`.filter-${status}`).classList.add('active');
    }
    
    // Show all tables or filter by status
    tableElements.forEach(tableEl => {
        if (!status || tableEl.dataset.status === status) {
            tableEl.classList.remove('hidden');
        } else {
            tableEl.classList.add('hidden');
        }
    });
}

/**
 * Enriches table data with bill information for occupied tables
 * @param {Array} tables List of tables to enrich
 */
async function enrichTablesWithBillData(tables) {
    const occupiedTables = tables.filter(table => table.status === 'occupied');
    
    if (occupiedTables.length === 0) {
        console.log('No occupied tables to enrich');
        return;
    }
    
    try {
        const promises = occupiedTables.map(async (table) => {
            try {
                const bills = await fetchBillsForTable(table.table_id);
                
                if (bills && bills.length > 0) {
                    // Add bill data to table object
                    table.bills = bills;
                    table.activeBillCount = bills.filter(bill => !bill.is_closed).length;
                    table.totalAmount = bills.reduce((total, bill) => total + bill.total_amount, 0);
                    
                    // Calculate time since table was occupied
                    const earliestBill = [...bills].sort((a, b) => 
                        new Date(a.created_at) - new Date(b.created_at)
                    )[0];
                    
                    if (earliestBill) {
                        table.occupiedSince = new Date(earliestBill.created_at);
                        table.occupiedDuration = getTimeDifference(table.occupiedSince, new Date());
                    }
                }
                
                return table;
            } catch (error) {
                console.warn(`Error getting bills for table ${table.table_id}:`, error);
                return table;
            }
        });
        
        const enrichedTables = await Promise.all(promises);
        
        // Sort tables by table number
        enrichedTables.sort((a, b) => {
            const numA = parseInt(a.table_number);
            const numB = parseInt(b.table_number);
            return numA - numB;
        });
        
        // Store tables in window object for reference
        window.restaurantTables = enrichedTables;
        
        // Render tables first with basic data
        renderTables(enrichedTables);
        
    } catch (error) {
        console.error('Error enriching tables with bill data:', error);
    }
}

// Helper function to calculate time difference
function getTimeDifference(startDate, endDate) {
    const diffMs = endDate - startDate;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const remainingMins = diffMins % 60;
    
    if (diffHours > 0) {
        return `${diffHours}h ${remainingMins}m`;
    } else {
        return `${diffMins}m`;
    }
}

// Export functions for use in other modules
export {
    loadTableData,
    initializeTableEvents,
    filterTables,
    enrichTablesWithBillData,
    getTimeDifference
}; 