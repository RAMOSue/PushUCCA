// client/src/config/axios.js
/**
 * ✅ Global Axios Configuration
 * Sets up axios with credentials and base URL for API requests
 * Includes JWT token injection from localStorage
 */

import axios from "axios";
import tokenManager from "../utils/tokenManager";

// Get API URL from env or default to current origin
const apiURL = import.meta.env.VITE_API_URL || window.location.origin;

// Configure axios globally
axios.defaults.baseURL = apiURL;
axios.defaults.withCredentials = true;

// ✅ REQUEST INTERCEPTOR: Add JWT token to Authorization header
axios.interceptors.request.use(
  (config) => {
    // Inject JWT token from tokenManager if available
    const activeToken = tokenManager?.getActiveTokenString?.();
    if (activeToken) {
      config.headers.Authorization = `Bearer ${activeToken}`;
    }
    
    console.log(`📡 [axios] ${config.method.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    console.error("❌ [axios request] Error:", error);
    return Promise.reject(error);
  }
);

// ✅ RESPONSE INTERCEPTOR: Handle errors and unauthorized access
axios.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      console.warn("⚠️ [axios] Unauthorized (401) - user may need to login");
      // Don't auto-logout here - let components handle it gracefully
    }
    return Promise.reject(error);
  }
);

export default axios;
