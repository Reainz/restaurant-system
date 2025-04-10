// DOM elements module for customer-order.js
// Centralized place to store references to DOM elements

/**
 * DOM elements for the customer order page
 */
export const domElements = {
    // Order containers
    orderList: document.getElementById('orderList'),
    orderDetails: document.getElementById('orderDetails'),
    emptyOrderMessage: document.getElementById('emptyOrderMessage'),
    
    // Order filters
    statusFilter: document.getElementById('statusFilter'),
    searchInput: document.getElementById('searchInput'),
    
    // Order details sections
    orderIdElement: document.getElementById('orderId'),
    orderDateElement: document.getElementById('orderDate'),
    orderStatusElement: document.getElementById('orderStatus'),
    tableNumberElement: document.getElementById('tableNumber'),
    totalPriceElement: document.getElementById('totalPrice'),
    itemsContainer: document.getElementById('itemsContainer'),
    specialInstructionsElement: document.getElementById('specialInstructions'),
    
    // Action buttons
    cancelOrderBtn: document.getElementById('cancelOrderBtn'),
    trackOrderBtn: document.getElementById('trackOrderBtn'),
    closeDetailsBtn: document.getElementById('closeDetailsBtn'),
    refreshBtn: document.getElementById('refreshBtn'),
    
    // Modals
    trackingModal: document.getElementById('trackingModal'),
    trackingModalContent: document.getElementById('trackingModalContent'),
    closeTrackingModalBtn: document.getElementById('closeTrackingModal'),
    trackingTimelineContainer: document.getElementById('trackingTimeline'),
    
    // Notification area
    notification: document.getElementById('notification'),
    notificationMessage: document.getElementById('notificationMessage'),
    
    // Order Summary Elements
    totalOrdersCount: document.getElementById('totalOrdersCount'),
    pendingCount: document.getElementById('pendingCount'),
    completedCount: document.getElementById('completedCount'),
    cancelledCount: document.getElementById('cancelledCount'),
    
    // Order details elements
    orderTimeElement: document.getElementById('orderTime'),
    orderItemsContainer: document.getElementById('orderItems'),
    orderTotalElement: document.getElementById('orderTotal'),
    
    // Order controls
    submitOrderBtn: document.getElementById('submitOrderBtn'),
    
    // Order status tracker
    statusProgress: document.getElementById('statusProgress'),
    
    // Order ID message
    orderIdMessage: document.getElementById('orderIdMessage'),
    displayOrderId: document.getElementById('displayOrderId'),
    
    // Menu modal
    menuModal: document.getElementById('menuModal'),
    closeMenuBtn: document.getElementById('closeMenuBtn'),
    menuSearch: document.getElementById('menuSearch'),
    menuItems: document.getElementById('menuItems')
}; 