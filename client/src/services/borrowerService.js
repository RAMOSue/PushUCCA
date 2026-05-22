/**
 * borrowerService.js
 * Centralized API service for borrower-related operations
 * Handles all API calls for borrowing, cart management, history, and profiles
 */

import axios from "axios";

// ============================================================================
// 🛒 CART MANAGEMENT
// ============================================================================

/**
 * Save a single item to borrower's cart
 * @param {string} itemId - Item UUID
 * @param {string} itemName - Item name
 * @param {string|null} size - Size of the item (null for no size)
 * @param {string} category - Item category (costume, instrument, accessories)
 * @param {string} imageUrl - URL of item image
 * @param {number} quantity - Quantity to reserve (default 1)
 * @returns {Promise<Object>} Response with reserved units
 */
export const saveToCart = async (itemId, itemName, size, category, imageUrl, quantity = 1) => {
  const res = await axios.post("/api/borrow/cart", {
    item_id: itemId,
    item_name: itemName,
    size: size,
    category: category,
    image_url: imageUrl,
    quantity: quantity,
  });
  return res.data;
};

/**
 * Remove an item from the cart
 * @param {string} itemId - Item ID to remove
 * @param {string} requestId - Current request ID
 * @returns {Promise<Object>} Updated cart response
 */
export const removeFromCart = async (itemId, requestId) => {
  const res = await axios.post("/api/borrow/cart/remove", {
    item_id: itemId,
    request_id: requestId,
  });
  return res.data;
};

/**
 * Add specific units to the cart
 * @param {Array} units - Array of unit IDs to add
 * @param {string} itemId - Item ID
 * @param {string} itemName - Item name
 * @param {string|null} size - Size
 * @param {string} category - Category
 * @param {string} imageUrl - Image URL
 * @returns {Promise<Object>} Response with added units
 */
export const addUnitsToCart = async (units, itemId, itemName, size, category, imageUrl) => {
  const res = await axios.post("/api/borrow/cart/add-units", {
    units: units,
    item_id: itemId,
    item_name: itemName,
    size: size,
    category: category,
    image_url: imageUrl,
  });
  return res.data;
};

/**
 * Update the quantity of items in cart
 * @param {string} itemId - Item ID
 * @param {number} newQuantity - New quantity
 * @param {string} requestId - Current request ID
 * @returns {Promise<Object>} Response with updated quantity
 */
export const saveCartQuantity = async (itemId, newQuantity, requestId) => {
  const res = await axios.post("/api/borrow/cart/save-quantity", {
    item_id: itemId,
    quantity: newQuantity,
    request_id: requestId,
  });
  return res.data;
};

/**
 * Submit the borrow request to staff for approval
 * @param {Array} photos - Optional photos from device camera
 * @returns {Promise<Object>} Response with request ID and status
 */
export const submitBorrowRequest = async (photos = null) => {
  const res = await axios.post("/api/borrow/submit-cart", {
    photos: photos,
  });
  return res.data;
};

// ============================================================================
// 📦 BORROW HISTORY & REQUESTS
// ============================================================================

/**
 * Fetch the user's borrow history (both active and past requests)
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Array of borrow requests with status, items, dates
 */
export const getBorrowHistory = async (userId) => {
  const res = await axios.get(`/api/borrow/history/${userId}`);
  return res.data;
};

/**
 * Get reserved units for a user (active cart)
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Response with reserved items and request ID
 */
export const getReservedRequest = async (userId) => {
  const res = await axios.get(`/api/borrow/reserved/${userId}`);
  return res.data;
};

/**
 * Delete a borrow history record
 * @param {string} requestId - Request ID to delete
 * @returns {Promise<Object>} Deletion confirmation
 */
export const deleteBorrowHistory = async (requestId) => {
  const res = await axios.delete(`/api/borrow/history/${requestId}`, {
    withCredentials: true,
  });
  return res.data;
};

/**
 * Fetch photos taken during item return process
 * @param {string} requestId - Request ID
 * @returns {Promise<Object>} Response with photos array
 */
export const getReturnPhotos = async (requestId) => {
  const res = await axios.get(`/api/borrow/return/photos/${requestId}`);
  return res.data;
};

// ============================================================================
// 🔍 INVENTORY & AVAILABILITY
// ============================================================================

/**
 * Get all available items for borrowing
 * @returns {Promise<Array>} Array of available items with quantities
 */
export const getAvailableItems = async () => {
  const res = await axios.get("/api/inventory/available");
  return res.data;
};

/**
 * Scan QR code and retrieve item details
 * @param {string} qrCodeText - QR code text/content
 * @returns {Promise<Object>} Item details from QR scan
 */
export const scanQRCode = async (qrCodeText) => {
  const res = await axios.get(
    `/api/inventory/scan/text/${encodeURIComponent(qrCodeText)}`
  );
  return res.data;
};

// ============================================================================
// 👤 PROFILE & PERSONAL INFORMATION
// ============================================================================

/**
 * Get current user's profile information
 * @returns {Promise<Object>} User profile data
 */
export const getUserProfile = async () => {
  const res = await axios.get("/api/profiles/me", { withCredentials: true });
  return res.data;
};

/**
 * Upload profile documents (ID, birth certificate, class schedule, etc.)
 * @param {FormData} formData - Form data with file uploads
 * @returns {Promise<Object>} Upload confirmation response
 */
export const uploadProfileDocuments = async (formData) => {
  const res = await axios.post("/api/profiles/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
    withCredentials: true,
  });
  return res.data;
};

/**
 * Get all borrower profiles (for staff/admin view)
 * @returns {Promise<Array>} Array of borrower profiles
 */
export const getAllBorrowerProfiles = async () => {
  const res = await axios.get("/api/profiles/all", {
    withCredentials: true,
  });
  return res.data;
};

// ============================================================================
// ✅ RETURN MANAGEMENT
// ============================================================================

/**
 * Mark items as returned and update request status
 * @param {string} requestId - Request ID
 * @param {Array} returnedItems - Array of returned item details
 * @param {Array} photos - Optional photos of returned items
 * @returns {Promise<Object>} Return confirmation
 */
export const submitReturn = async (requestId, returnedItems, photos = null) => {
  const res = await axios.post(`/api/borrow/return/${requestId}`, {
    items: returnedItems,
    photos: photos,
  });
  return res.data;
};

/**
 * Get details of a specific borrow request
 * @param {string} requestId - Request ID
 * @returns {Promise<Object>} Request details with all borrowed items
 */
export const getBorrowRequestDetails = async (requestId) => {
  const res = await axios.get(`/api/borrow/requests/${requestId}`);
  return res.data;
};

// ============================================================================
// 📊 BORROWER STATISTICS & SETTINGS
// ============================================================================

/**
 * Get borrower's borrowing statistics
 * @returns {Promise<Object>} Stats including total borrowed, returned, overdue, etc.
 */
export const getBorrowingStats = async () => {
  const res = await axios.get("/api/borrow/stats");
  return res.data;
};

/**
 * Update borrower notification preferences
 * @param {Object} preferences - Notification preferences object
 * @returns {Promise<Object>} Updated preferences
 */
export const updateNotificationPreferences = async (preferences) => {
  const res = await axios.put("/api/borrower/notifications/preferences", preferences);
  return res.data;
};

/**
 * Get borrower settings (all user preferences)
 * @returns {Promise<Object>} Current borrower settings
 */
export const getUserSettings = async () => {
  const res = await axios.get("/api/settings/me", {
    withCredentials: true,
  });
  return res.data;
};

/**
 * Update multiple user settings at once
 * @param {Object} settings - Settings object with fields to update
 * @returns {Promise<Object>} Updated settings
 */
export const updateUserSettings = async (settings) => {
  const res = await axios.put("/api/settings/me", settings, {
    withCredentials: true,
  });
  return res.data;
};

/**
 * Update a single setting field
 * @param {string} fieldName - Name of the field to update
 * @param {*} fieldValue - New value for the field
 * @returns {Promise<Object>} Updated settings
 */
export const updateSingleSetting = async (fieldName, fieldValue) => {
  const res = await axios.patch("/api/settings/field", {
    fieldName,
    fieldValue,
  }, {
    withCredentials: true,
  });
  return res.data;
};

/**
 * Reset all user settings to defaults
 * @returns {Promise<Object>} Reset settings
 */
export const resetUserSettings = async () => {
  const res = await axios.post("/api/settings/reset", {}, {
    withCredentials: true,
  });
  return res.data;
};

/**
 * Get borrower settings (legacy method name)
 * @returns {Promise<Object>} Current borrower settings
 */
export const getBorrowerSettings = async () => {
  return getUserSettings();
};

/**
 * Update borrower settings (legacy method name)
 * @param {Object} settings - Settings to update
 * @returns {Promise<Object>} Updated settings
 */
export const updateBorrowerSettings = async (settings) => {
  return updateUserSettings(settings);
};

// ============================================================================
// 📊 ACTIVITY & LOGS
// ============================================================================

/**
 * Get user's activity logs
 * @returns {Promise<Array>} Array of activity log records
 */
export const getActivityLogs = async () => {
  const res = await axios.get("/api/user/activity-logs", {
    withCredentials: true,
  });
  return res.data;
};

/**
 * Get user's login history
 * @returns {Promise<Array>} Array of login history records
 */
export const getLoginHistory = async () => {
  const res = await axios.get("/api/user/login-history", {
    withCredentials: true,
  });
  return res.data;
};

/**
 * Download activity logs as CSV
 * @returns {Promise<string>} CSV data
 */
export const downloadActivityLogsCSV = async () => {
  const res = await axios.get("/api/user/activity-logs/download", {
    withCredentials: true,
    responseType: "text",
  });
  return res.data;
};

export default {
  // Cart Management
  saveToCart,
  removeFromCart,
  addUnitsToCart,
  saveCartQuantity,
  submitBorrowRequest,

  // Borrow History & Requests
  getBorrowHistory,
  getReservedRequest,
  deleteBorrowHistory,
  getReturnPhotos,
  getBorrowRequestDetails,

  // Inventory & Availability
  getAvailableItems,
  scanQRCode,

  // Profile & Personal Information
  getUserProfile,
  uploadProfileDocuments,
  getAllBorrowerProfiles,

  // Return Management
  submitReturn,

  // Statistics & Settings
  getBorrowingStats,
  updateNotificationPreferences,
  
  // User Settings (New)
  getUserSettings,
  updateUserSettings,
  updateSingleSetting,
  resetUserSettings,
  getBorrowerSettings,
  updateBorrowerSettings,

  // Activity & Logs
  getActivityLogs,
  getLoginHistory,
  downloadActivityLogsCSV,
};
