// Menu state management
let menuItems = [];
let cart = [];

// Fetch menu items from backend
async function fetchMenuItems() {
    try {
        const response = await fetch('/api/menu-items');
        if (!response.ok) throw new Error('Failed to fetch menu items');
        menuItems = await response.json();
        renderMenuItems();
    } catch (error) {
        showError('Failed to load menu items. Please try again.');
    }
}

// Render menu items by category
function renderMenuItems() {
    const categories = ['main-dishes', 'desserts', 'drinks'];
    categories.forEach(category => {
        const sectionItems = menuItems.filter(item => 
            item.category.toLowerCase() === category.replace('-', ' '));
        const container = document.querySelector(`#${category} .grid`);
        if (container) {
            container.innerHTML = sectionItems.map(item => `
                <div class="menu-item bg-white rounded-lg shadow-md overflow-hidden">
                    <img src="${item.image_url ? `/static/images/${item.image_url}` : 'https://via.placeholder.com/300x200'}" 
                         alt="${item.name}" 
                         class="w-full h-48 object-cover"
                         onerror="this.onerror=null; this.src='https://via.placeholder.com/300x200';">
                    <div class="p-4">
                        <div class="flex justify-between items-start mb-2">
                            <h3 class="text-lg font-semibold">${item.name}</h3>
                            <span class="text-green-600 font-semibold">${formatPrice(item.price)}</span>
                        </div>
                        <p class="text-gray-600 text-sm mb-4">${item.description}</p>
                        <div class="flex justify-between items-center">
                            <span class="text-sm ${item.available ? 'text-green-600' : 'text-red-600'}">
                                ${item.available ? 'Available' : 'Unavailable'}
                            </span>
                            <button 
                                onclick="addToCart(${JSON.stringify(item)})" 
                                class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 ${!item.available ? 'opacity-50 cursor-not-allowed' : ''}"
                                ${!item.available ? 'disabled' : ''}
                            >
                                Add to Cart
                            </button>
                        </div>
                    </div>
                </div>
            `).join('');
        }
    });
}

// Cart management
function addToCart(item) {
    const existingItem = cart.find(cartItem => cartItem.id === item.id);
    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({ ...item, quantity: 1 });
    }
    updateCartUI();
}

function removeFromCart(itemId) {
    const index = cart.findIndex(item => item.id === itemId);
    if (index !== -1) {
        if (cart[index].quantity > 1) {
            cart[index].quantity -= 1;
        } else {
            cart.splice(index, 1);
        }
    }
    updateCartUI();
}

function updateCartUI() {
    const cartContainer = document.querySelector('.space-y-4');
    if (!cartContainer) return;

    cartContainer.innerHTML = cart.map(item => `
        <div class="flex justify-between items-start">
            <div>
                <h3 class="font-semibold">${item.name}</h3>
                <p class="text-gray-600">${formatPrice(item.price)}</p>
            </div>
            <div class="flex items-center space-x-2">
                <button onclick="removeFromCart('${item.id}')" class="w-8 h-8 bg-gray-200 rounded-full hover:bg-gray-300">-</button>
                <span>${item.quantity}</span>
                <button onclick="addToCart(${JSON.stringify(item)})" class="w-8 h-8 bg-gray-200 rounded-full hover:bg-gray-300">+</button>
            </div>
        </div>
    `).join('');

    updateTotal();
}

function updateTotal() {
    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const totalElement = document.querySelector('.font-semibold:last-child');
    if (totalElement) {
        totalElement.textContent = formatPrice(total);
    }
}

// Helper functions
function formatPrice(price) {
    return new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND'
    }).format(price);
}

function showError(message) {
    // Implement error notification UI
    alert(message);
}

// Complete order
async function completeOrder() {
    if (cart.length === 0) {
        showError('Your cart is empty');
        return;
    }

    try {
        // Get table_id from URL
        const urlParams = new URLSearchParams(window.location.search);
        const tableIdFromUrl = urlParams.get('table_id');
        console.log(`[customer-menu.js] Initial table_id from URL: ${tableIdFromUrl}`); // Log initial

        if (!tableIdFromUrl) {
            showError('Table ID is missing from URL. Cannot complete order.');
            return;
        }

        // --- START: Simplified and Logged Formatting ---
        let formattedTableId = tableIdFromUrl;
        // If it doesn't start with 'T' AND it consists only of digits...
        if (!formattedTableId.startsWith('T') && /^[0-9]+$/.test(formattedTableId)) {
             formattedTableId = `T${formattedTableId}`; // Prepend 'T'
             console.log(`[customer-menu.js] Prepended 'T'. Formatted table_id is now: ${formattedTableId}`); // Log formatted
        } 
        // Check if the format is now correct (T followed by digits) or if it was invalid initially
        else if (!formattedTableId.startsWith('T') || !/^[0-9]+$/.test(formattedTableId.substring(1))) {
             console.error(`[customer-menu.js] Invalid table_id format found: ${tableIdFromUrl}`);
             showError(`Invalid Table ID format in URL: ${tableIdFromUrl}. Expected format like '12' or 'T12'.`);
             return;
        } else {
             // Already correctly formatted (e.g., "T12")
             console.log(`[customer-menu.js] table_id already correctly formatted: ${formattedTableId}`); 
        }
        // --- END: Simplified and Logged Formatting ---

        console.log(`[customer-menu.js] Using table_id for payload: ${formattedTableId}`); // Log final used value

        // Get special instructions (optional)
        const specialInstructions = ""; // Assuming no special instructions input for now

        const orderPayload = {
            table_id: formattedTableId,
            items: cart.map(item => ({
                item_id: item.id,         // Use item.id (assuming this is the correct menu item ID)
                name: item.name,           // Include item name
                quantity: item.quantity,
                price: item.price,         // Keep price if needed by backend (though not in OrderCreate)
                notes: "",                 // Add empty notes if required
                status: "pending"          // Add default status if required
            })),
            special_instructions: specialInstructions
            // Do NOT include the 'total' field, it's not in OrderCreate
        };

        // Define the correct Order Service API URL
        const orderServiceUrl = 'http://localhost:8002/api/orders'; // Target port 8002

        console.log(`[customer-menu.js] Preparing to send order to ${orderServiceUrl}`);
        console.log(`[customer-menu.js] Payload:`, JSON.stringify(orderPayload, null, 2));

        try {
            console.log("[customer-menu.js] Calling fetch...");
            const response = await fetch(orderServiceUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json' // Added Accept header
                },
                body: JSON.stringify(orderPayload)
            });
            console.log(`[customer-menu.js] Fetch response received. Status: ${response.status}`);

            if (!response.ok) {
                let errorDetail = `API request failed with status ${response.status}`;
                try {
                    const errorData = await response.json();
                    console.error("[customer-menu.js] API Error Response Body:", errorData);
                    errorDetail = errorData.detail || errorDetail;
                } catch(e) {
                    console.error("[customer-menu.js] Could not parse error response body", e);
                }
                throw new Error(errorDetail);
            }

            const createdOrder = await response.json();
            console.log("[customer-menu.js] Raw Order API response object:", JSON.stringify(createdOrder, null, 2));

            // Clear cart after successful order
            cart = [];
            updateCartUI();
            // showNotification('Order placed successfully!', 'success'); // Use notification instead of alert

            // Redirect to the customer order view page (Order Service Frontend)
            console.log("[customer-menu.js] ID used for redirection:", createdOrder ? createdOrder.order_id : 'undefined');
            if (createdOrder && createdOrder.order_id) { // Check createdOrder exists
                window.location.href = `http://localhost:8002/customer?table_id=${formattedTableId}&order_id=${createdOrder.order_id}`;
            } else {
                console.error("[customer-menu.js] Order created, but response lacked order_id:", createdOrder);
                showError("Order created, but failed to get Order ID for redirection.");
            }

        } catch (fetchError) {
            // Catch errors specifically from the fetch or response handling
            console.error('[customer-menu.js] Error during fetch/response processing:', fetchError);
            showError(`Failed during order submission: ${fetchError.message}`);
        }

    } catch (outerError) {
        // Catch errors from setting up the request (e.g., getting tableId)
        console.error('[customer-menu.js] Error setting up order:', outerError);
        showError(`Failed to submit order: ${outerError.message}`);
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    fetchMenuItems();

    // Add event listener for complete order button
    const completeOrderBtn = document.querySelector('button.w-full.bg-blue-600');
    if (completeOrderBtn) {
        completeOrderBtn.addEventListener('click', completeOrder);
    }

    // Add an error handler for all images
    document.addEventListener('error', function(e) {
        // Only handle image errors
        if (e.target.tagName.toLowerCase() === 'img') {
            // Replace with a placeholder or no-image-available graphic
            e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KIDwhLS0gQ3JlYXRlZCB3aXRoIFN2Z0NvbnZlcnQuY29tIC0tPgogPGc+CiAgPHRpdGxlPkJhY2tncm91bmQ8L3RpdGxlPgogIDxyZWN0IGZpbGw9IiNlNWU1ZTUiIGlkPSJjYW52YXNfYmFja2dyb3VuZCIgaGVpZ2h0PSIyMDAiIHdpZHRoPSIyMDAiIHk9IjAiIHg9IjAiLz4KICA8ZyBkaXNwbGF5PSJub25lIiBpZD0iY2FudmFzR3JpZCI+CiAgIDxnIGRpc3BsYXk9ImlubGluZSI+CiAgICA8bGluZSB5Mj0iMTAiIHkyPSIxMCIgeDE9IjAiIHkxPSIxMCIgc3Ryb2tlLXdpZHRoPSIwLjI1IiBzdHJva2U9IiNmZmYiLz4KICAgPC9nPgogIDwvZz4KIDxnIGZvbnQtc2l6ZT0iMTgiIG9wYWNpdHk9IjAuOSI+CiAgPHRleHQgZm9udC1mYW1pbHk9IlNhbnMtc2VyaWYiIGZvbnQtc3R5bGU9Im5vcm1hbCIgZm9udC13ZWlnaHQ9Im5vcm1hbCIgc3Ryb2tlPSIjMDAwIiBzdHJva2Utd2lkdGg9IjAiIHN0cm9rZS1kYXNoYXJyYXk9Im51bGwiIHN0cm9rZS1saW5lam9pbj0ibnVsbCIgc3Ryb2tlLWxpbmVjYXA9Im51bGwiIGZpbGw9IiM2NjY2NjYiIHg9IjUwIiB5PSIxMDAiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZvbnQtc2l6ZT0iMTgiPk5vIEltYWdlPC90ZXh0PgogIDx0ZXh0IGZvbnQtZmFtaWx5PSJTYW5zLXNlcmlmIiBmb250LXN0eWxlPSJub3JtYWwiIGZvbnQtd2VpZ2h0PSJub3JtYWwiIHN0cm9rZT0iIzAwMCIgc3Ryb2tlLXdpZHRoPSIwIiBzdHJva2UtZGFzaGFycmF5PSJudWxsIiBzdHJva2UtbGluZWpvaW49Im51bGwiIHN0cm9rZS1saW5lY2FwPSJudWxsIiBmaWxsPSIjNjY2NjY2IiB4PSI1MCIgeT0iMTIwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LXNpemU9IjE4Ij5BdmFpbGFibGU8L3RleHQ+CiA8L2c+Cjwvc3ZnPg==';
            
            // Add a class for custom styling
            e.target.classList.add('image-error');
        }
    }, true);
});