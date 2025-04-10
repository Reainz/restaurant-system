// DOM Elements for kitchen-order.js

// Export DOM element references
export const domElements = {
    // Queue and filters
    orderQueue: document.getElementById('orderQueue'),
    orderDetailPanel: document.getElementById('orderDetailPanel'),
    statusFilter: document.getElementById('statusFilter'),
    
    // Summary stats
    avgWaitTime: document.getElementById('avgWaitTime'),
    newOrdersCount: document.getElementById('newOrdersCount'),
    inProgressCount: document.getElementById('inProgressCount'),
    readyCount: document.getElementById('readyCount'),
    completedCount: document.getElementById('completedCount'),
    delayedCount: document.getElementById('delayedCount'),
    
    // Order detail elements
    orderTimeElement: document.getElementById('orderTime'),
    orderIdElement: document.getElementById('orderId'),
    tableNumberElement: document.getElementById('tableNumber'),
    orderStatusElement: document.getElementById('orderStatus'),
    orderItemsElement: document.getElementById('orderItems'),
    specialInstructionsElement: document.getElementById('specialInstructions'),
    kitchenNotesElement: document.getElementById('kitchenNotes'),
    
    // Order action buttons
    startAllBtn: document.getElementById('startAllBtn'),
    markReadyBtn: document.getElementById('markReadyBtn'),
    pauseOrderBtn: document.getElementById('pauseOrderBtn'),
    cancelOrderBtn: document.getElementById('cancelOrderBtn'),
    
    // Containers
    orderQueueContainer: document.getElementById('orderQueueContainer'),
    orderHistoryContainer: document.getElementById('orderHistoryContainer'),
    
    // History toggle button
    historyBtn: document.getElementById('historyBtn'),
    
    // Save notes button
    saveNotesBtn: document.getElementById('saveNotesBtn')
}; 