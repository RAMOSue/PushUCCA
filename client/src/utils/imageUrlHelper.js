/**
 * imageUrlHelper.js
 * ✅ Utility for constructing full image URLs from relative paths
 * Uses axios baseURL (which is set from VITE_API_URL in production)
 */

import axios from "axios";

/**
 * Convert relative image path to full URL
 * @param {string} imagePath - Relative path (e.g., "/uploads/image.jpg")
 * @returns {string} Full URL using the configured API base
 */
export const getFullImageUrl = (imagePath) => {
  if (!imagePath) return "";

  // If already a full URL, return as-is
  if (imagePath.startsWith("http://") || imagePath.startsWith("https://")) {
    return imagePath;
  }

  // Get API base from axios defaults
  const apiBase = axios.defaults.baseURL || window.location.origin;

  // Ensure path starts with /
  const normalizedPath = imagePath.startsWith("/") ? imagePath : `/${imagePath}`;

  return `${apiBase}${normalizedPath}`;
};

export default getFullImageUrl;
