// Notification system for user feedback

/**
 * Shows a notification message to the user
 * @param {string} message - The message to display
 * @param {string} type - The notification type ('success', 'error', 'warning', 'info')
 */
function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 max-w-md p-4 rounded shadow-md transform transition-opacity duration-300 ${getNotificationClass(type)}`;
    notification.innerHTML = `
        <div class="flex">
            <div class="py-1">
                <svg class="w-6 h-6 mr-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                </svg>
            </div>
            <div>
                <p>${message}</p>
            </div>
        </div>
    `;
    document.body.appendChild(notification);
    
    // Remove after 3 seconds
    setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}

/**
 * Gets the CSS class for a notification type
 * @param {string} type - The notification type
 * @returns {string} - The CSS class for the notification
 */
function getNotificationClass(type) {
    switch (type) {
        case 'success':
            return 'bg-green-100 border-l-4 border-green-500 text-green-700';
        case 'error':
            return 'bg-red-100 border-l-4 border-red-500 text-red-700';
        case 'warning':
            return 'bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700';
        case 'info':
            return 'bg-blue-100 border-l-4 border-blue-500 text-blue-700';
        default:
            return 'bg-green-100 border-l-4 border-green-500 text-green-700';
    }
}

// Export the functions
export { showNotification, getNotificationClass }; 