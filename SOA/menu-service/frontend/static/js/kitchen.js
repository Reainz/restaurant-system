// API endpoints
const API_BASE = '/api/v1';
const MENU_ITEMS_ENDPOINT = `/api/menu-items`;
const MENU_ITEMS_WITH_IMAGE_ENDPOINT = `/api/menu-items-with-image`;
const MENU_CATEGORIES_ENDPOINT = `/api/menu-categories`;
const MENU_TYPES_ENDPOINT = `/api/menu-types`;

// Cache DOM Elements
const editModal = document.getElementById('editModal');
const editForm = document.getElementById('editForm');
const menuItemsTable = document.getElementById('menuItemsTable');
const buffetPackagesTable = document.getElementById('buffetPackagesTable');
const addItemBtn = document.getElementById('addItemBtn');
const addPackageBtn = document.getElementById('addPackageBtn');
const modalTitle = document.querySelector('#editModal h3');

// State management
let currentEditItem = null;
let isEditingBuffet = false;
let isAddingNew = false;
let loadingData = false;

// Debounce function for performance optimization
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Initialize page
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Check for placeholder image
        await createPlaceholderImageIfNotExists();
        
        await loadMenuItems();
        setupEventListeners();
    } catch (error) {
        showError('Failed to initialize page: ' + error.message);
    }
});

function setupEventListeners() {
    // Add new item button
    addItemBtn.addEventListener('click', () => {
        isAddingNew = true;
        isEditingBuffet = false;
        modalTitle.textContent = 'Add New Menu Item';
        showModal();
        resetForm();
    });

    // Image preview
    const imageInput = document.getElementById('image');
    const imagePreview = document.getElementById('imagePreview');
    const previewImg = document.getElementById('previewImg');

    imageInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                previewImg.src = e.target.result;
                imagePreview.classList.remove('hidden');
            };
            reader.readAsDataURL(file);
        } else {
            imagePreview.classList.add('hidden');
            previewImg.src = '';
        }
    });

    // Form submission
    editForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (loadingData) return;
        loadingData = true;
        
        try {
            const formData = new FormData(editForm);
            
            // Check if we have an image file
            const imageFile = formData.get('image');
            const hasImageFile = imageFile && imageFile.size > 0;
            
            // Convert status to available boolean
            const isAvailable = formData.get('status') === 'available';
            formData.set('available', isAvailable.toString()); // Convert boolean to string 'true'/'false'
            
            // Set menu_type explicitly for form data
            formData.set('menu_type', 'a-la-carte');
            
            let responseData;
            
            if (hasImageFile) {
                // Use FormData approach with multipart/form-data for file upload
                try {
                    let response;
                    if (isAddingNew) {
                        // Create new item with image
                        response = await fetch(MENU_ITEMS_WITH_IMAGE_ENDPOINT, {
                            method: 'POST',
                            body: formData
                        });
                    } else {
                        // Update existing item with image
                        response = await fetch(`${MENU_ITEMS_WITH_IMAGE_ENDPOINT}/${currentEditItem.id}`, {
                            method: 'PUT',
                            body: formData
                        });
                    }
                    
                    // For non-2xx responses
                    if (!response.ok) {
                        const errorText = await response.text();
                        try {
                            // Try to parse as JSON
                            const errorJson = JSON.parse(errorText);
                            throw new Error(errorJson.detail || `Server error (${response.status})`);
                        } catch (jsonError) {
                            // If not JSON, use the raw text
                            throw new Error(`Server error (${response.status}): ${errorText}`);
                        }
                    }
                    
                    // Parse the response JSON
                    responseData = await response.json();
                    
                } catch (fetchError) {
                    console.error('Fetch error:', fetchError);
                    throw fetchError;
                }
            } else {
                // No file selected, use regular JSON endpoints
                // Prepare data for regular JSON submission
                const data = {
                    name: formData.get('name'),
                    description: formData.get('description') || "",
                    price: parseFloat(formData.get('price')),
                    category: formData.get('category'),
                    available: isAvailable,
                    menu_type: 'a-la-carte',
                    image_url: currentEditItem?.image_url || null
                };
                
                if (isAddingNew) {
                    responseData = await createMenuItem(data);
                } else {
                    responseData = await updateMenuItem(currentItemId, data);
                }
            }
            
            hideModal();
            await loadMenuItems();
            showSuccess(isAddingNew ? 'Item created successfully' : 'Changes saved successfully');
        } catch (error) {
            console.error('Error in form submission:', error);
            showError(error.message || 'An unknown error occurred');
        } finally {
            loadingData = false;
        }
    });
}

async function createMenuItem(data) {
    try {
        const response = await fetch(MENU_ITEMS_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to create item');
        }
        
        return await response.json();
    } catch (error) {
        console.error('Error in createMenuItem:', error);
        throw error;
    }
}

async function updateMenuItem(id, data) {
    const response = await fetch(`${MENU_ITEMS_ENDPOINT}/${id}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to update item');
    }
    
    return await response.json();
}

async function toggleAvailability(id) {
    const response = await fetch(`${MENU_ITEMS_ENDPOINT}/${id}/availability`, {
        method: 'PUT'
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to toggle availability');
    }
    
    // Get the updated item from the response
    const updatedItem = await response.json();
    
    // Reload the menu items to reflect the changes
    await loadMenuItems();
    
    return updatedItem;
}

async function loadMenuItems() {
    if (loadingData) return;
    loadingData = true;
    
    try {
        const response = await fetch(MENU_ITEMS_ENDPOINT);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const items = await response.json();
        renderMenuItems(items);
    } catch (error) {
        showError('Failed to load menu items: ' + error.message);
        throw error;
    } finally {
        loadingData = false;
    }
}

function renderMenuItems(items) {
    const tbody = menuItemsTable.querySelector('tbody');
    tbody.innerHTML = '';
    
    if (items.length === 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td colspan="6" class="px-6 py-4 text-center text-gray-500">
                No menu items found. Add some items to get started.
            </td>
        `;
        tbody.appendChild(tr);
        return;
    }
    
    items.forEach(item => {
        const tr = document.createElement('tr');
        
        // Create image element with proper error handling
        let imgHTML = '';
        if (item.image_url) {
            // Debug the image path
            const imagePath = `/static/images/${escapeHtml(item.image_url)}`;
            imgHTML = `
                <img src="${imagePath}" 
                     alt="${escapeHtml(item.name)}" 
                     class="w-16 h-16 object-cover rounded mr-3"
                     onerror="this.onerror=null; this.src='/static/images/placeholder.png'; console.log('Image load error, using placeholder for ${escapeHtml(item.name)}');">
            `;
        } else {
            imgHTML = `<div class="w-16 h-16 bg-gray-200 rounded flex items-center justify-center mr-3"><span class="text-gray-400">No image</span></div>`;
        }
        
        tr.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex items-center">
                    ${imgHTML}
                    <div>
                        <div class="text-sm font-medium text-gray-900">${escapeHtml(item.name)}</div>
                        <div class="text-sm text-gray-500">${item.description ? escapeHtml(item.description) : ''}</div>
                    </div>
                </div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm text-gray-900">${escapeHtml(item.category)}</div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm text-gray-900">${formatPrice(item.price)}</div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${item.available ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
                    ${item.available ? 'Available' : 'Unavailable'}
                </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <button 
                    onclick="editItem('${item.id}')"
                    class="text-indigo-600 hover:text-indigo-900 mr-3">
                    Edit
                </button>
                <button 
                    onclick="toggleAvailability('${item.id}')"
                    class="text-blue-600 hover:text-blue-900 mr-3">
                    ${item.available ? 'Disable' : 'Enable'}
                </button>
                <button 
                    onclick="confirmDelete('${item.id}', '${escapeHtml(item.name)}')"
                    class="text-red-600 hover:text-red-900">
                    Delete
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

async function editItem(id) {
    try {
        const response = await fetch(`${MENU_ITEMS_ENDPOINT}/${id}`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const item = await response.json();
        currentEditItem = item;
        isAddingNew = false;
        isEditingBuffet = false;
        
        modalTitle.textContent = 'Edit Menu Item';
        populateEditForm(item);
        showModal();
    } catch (error) {
        showError('Failed to load item details: ' + error.message);
    }
}

function populateEditForm(item) {
    const form = document.getElementById('editForm');
    form.name.value = item.name;
    form.description.value = item.description || '';
    form.price.value = item.price;
    form.category.value = item.category;
    form.status.value = item.available ? 'available' : 'unavailable';
}

function showModal() {
    editModal.classList.remove('hidden');
}

function hideModal() {
    editModal.classList.add('hidden');
    resetForm();
}

function resetForm() {
    editForm.reset();
    currentEditItem = null;
}

function formatPrice(price) {
    return new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND'
    }).format(price);
}

function showError(message) {
    const notification = createNotification(message, 'error');
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 5000);
}

function showSuccess(message) {
    const notification = createNotification(message, 'success');
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
}

function createNotification(message, type) {
    const div = document.createElement('div');
    div.className = `fixed top-4 right-4 p-4 rounded-lg ${
        type === 'error' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
    }`;
    div.textContent = message;
    return div;
}

function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Delete menu item
async function deleteMenuItem(id) {
    try {
        const response = await fetch(`${MENU_ITEMS_ENDPOINT}/${id}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to delete item');
        }
        
        // Remove the item from the DOM
        const itemRow = document.getElementById(`item-${id}`);
        if (itemRow) {
            itemRow.remove();
        }
        
        // Reload the menu items to reflect the changes
        await loadMenuItems();
        showSuccess('Menu item deleted successfully');
    } catch (error) {
        showError('Failed to delete item: ' + error.message);
    }
}

// Confirm deletion with the user
function confirmDelete(id, name) {
    if (confirm(`Are you sure you want to delete "${name}"? This cannot be undone.`)) {
        deleteMenuItem(id);
    }
}

// Export functions for global access
window.editItem = editItem;
window.hideModal = hideModal;
window.toggleAvailability = toggleAvailability;
window.confirmDelete = confirmDelete;

// Edit package
async function editPackage(id) {
    if (loadingData) return;
    loadingData = true;
    
    try {
        // For now, we don't have a BUFFET_PACKAGES_ENDPOINT defined
        // This function needs to be fixed or removed until that functionality is implemented
        console.error("Buffet package editing not yet implemented");
        loadingData = false;
        return;
        
        /*
        const response = await fetch(`${BUFFET_PACKAGES_ENDPOINT}/${id}`);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to fetch package details');
        }
        
        currentEditItem = await response.json();
        isEditingBuffet = true;
        isAddingNew = false;
        modalTitle.textContent = 'Edit Buffet Package';
        populateEditForm(currentEditItem);
        showModal();
        hideCategoryField();
        */
    } catch (error) {
        showError('Failed to load package details: ' + error.message);
    } finally {
        loadingData = false;
    }
}

// Populate edit form
function populateEditForm(item) {
    editForm.name.value = item.name || '';
    editForm.price.value = item.price || '';
    editForm.description.value = item.description || '';
    editForm.status.value = item.status || 'available';
    if (!isEditingBuffet && editForm.category) {
        editForm.category.value = item.category || 'MAIN_DISHES';
    }
}

// Show/hide category field
function showCategoryField() {
    const categoryField = document.getElementById('categoryField');
    if (!categoryField) {
        const statusField = editForm.querySelector('[for="status"]').parentElement;
        const categoryHtml = `
            <div class="mb-4" id="categoryField">
                <label class="block text-gray-700 text-sm font-bold mb-2" for="category">Category</label>
                <select id="category" name="category" class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700">
                    <option value="MAIN_DISHES">Main Dishes</option>
                    <option value="APPETIZERS">Appetizers</option>
                    <option value="DESSERTS">Desserts</option>
                    <option value="BEVERAGES">Beverages</option>
                </select>
            </div>
        `;
        statusField.insertAdjacentHTML('beforebegin', categoryHtml);
    }
}

function hideCategoryField() {
    const categoryField = document.getElementById('categoryField');
    if (categoryField) {
        categoryField.remove();
    }
}

// Helper function to handle image loading errors
function handleImageError(img) {
    img.onerror = null;
    img.src = '/static/images/placeholder.png';
    img.classList.add('border', 'border-red-300');
}

// Update placeholder image creation function
async function createPlaceholderImageIfNotExists() {
    try {
        // Check if placeholder exists
        const response = await fetch('/static/images/placeholder.png', { method: 'HEAD' });
        if (!response.ok) {
            console.log('Placeholder image not found, will use default');
        } else {
            console.log('Placeholder image exists');
        }
    } catch (error) {
        console.error('Error checking placeholder image:', error);
    }
}

// Add helper function to validate image URLs
function validateImageUrl(url) {
    if (!url) return null;
    // Make sure the URL is properly formatted for the static directory
    if (url.startsWith('http') || url.startsWith('/static/')) {
        return url;
    } else {
        return `/static/images/${url}`;
    }
}