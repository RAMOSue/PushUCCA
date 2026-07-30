// client/src/context/userContext.jsx
import axios from "axios";
import { createContext, useEffect, useState } from "react";
import notificationService from "../src/services/notifications";
import { INACTIVITY_CONFIG } from "../src/config/inactivityConfig";
import tokenManager from "../src/utils/tokenManager"; // ✅ Multi-user testing

export const UserContext = createContext({});

// ✅ Global axios defaults - use environment variable for production
const apiURL = import.meta.env.VITE_API_URL || window.location.origin;
axios.defaults.baseURL = apiURL;
axios.defaults.withCredentials = true;

/**
 * 🔧 Axios interceptor to inject active user token from tokenManager
 * This allows switching between multiple logged-in users
 */
axios.interceptors.request.use(
  (config) => {
    const activeToken = tokenManager.getActiveTokenString();
    const activeUser = tokenManager.getActiveUser();
    
    if (activeToken) {
      config.headers.Authorization = `Bearer ${activeToken}`;
      // ✅ Debug logging
      if (config.url.includes('/api/profiles/me') || config.url.includes('/api/borrow')) {
        console.log(`📡 [axios] ${config.method.toUpperCase()} ${config.url} - Token present for: ${activeUser?.email || 'unknown'}`);
      }
    } else {
      // ✅ Debug logging when token is missing
      console.warn(`⚠️ [axios] ${config.method.toUpperCase()} ${config.url} - No token available (activeUser: ${activeUser?.email || 'none'})`);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

/**
 * 🔧 Axios response interceptor to handle 401 errors gracefully
 * During OAuth redirect, some 401 errors are expected and transient
 */
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    // ✅ FIX: Don't auto-logout on 401 during component initialization
    // Components should handle 401 gracefully instead of crashing
    if (error.response?.status === 401) {
      // Log but don't throw - let the component handle it
      console.debug("🔐 [Axios] Received 401 - component will handle auth retry");
    }
    return Promise.reject(error);
  }
);

export function UserContextProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // ✅ Global Dark Mode State (persists in localStorage)
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem("darkMode");
    return saved ? JSON.parse(saved) : false;
  });

  // ✅ Session Persistence - recover session from localStorage on app load
  useEffect(() => {
    const recoverSession = async () => {
      // ✅ FIRST: Check if we're coming back from Google OAuth with a token in URL
      const params = new URLSearchParams(window.location.search);
      const tokenFromURL = params.get("token");
      const userFromURL = params.get("user");

      if (tokenFromURL) {
        console.log("🔑 [OAuth] Token received from Google OAuth callback");
        // Store token in tokenManager so axios interceptor can use it
        try {
          const userData = userFromURL ? JSON.parse(decodeURIComponent(userFromURL)) : null;
          
          if (!userData?.id) {
            console.error("❌ [OAuth] No user ID in OAuth response");
            return;
          }
          
          // ✅ FIX: Clear all old tokens when logging in with new account
          // This prevents token confusion when switching between accounts
          tokenManager.clearAll();
          console.log("🔄 [OAuth] Cleared old tokens for fresh login");
          
          // Store NEW token
          tokenManager.addToken(userData.id, userData.email, tokenFromURL, userData);
          tokenManager.setActiveToken(userData.id);
          console.log(`✅ [OAuth] Token stored for user: ${userData.email} (ID: ${userData.id})`);
          
          // Store user
          setUser({
            id: userData?.id,
            email: userData?.email,
            name: userData?.name,
            role: userData?.role,
          });
          
          // Mark loading as complete
          setLoading(false);
          
          // Remove token from URL for security
          window.history.replaceState({}, document.title, window.location.pathname);
          console.log("✅ [OAuth] Token stored, proceeding with authenticated session");
          return; // Token is now set, proceed normally
        } catch (err) {
          console.error("❌ [OAuth] Failed to process OAuth token:", err);
        }
      }

      if (!INACTIVITY_CONFIG.PERSIST_SESSION) {
        return;
      }

      try {
        // Check if valid session exists by fetching profile
        const { data } = await axios.get("/api/profiles/me", {
          withCredentials: true,
        });

        if (data && data.id) {
          setUser({
            ...data,
            id: data.id ? parseInt(data.id, 10) : null,
          });
          console.log("✅ [Session] Recovered session for:", data.email);
        } else {
          setUser(null);
          localStorage.removeItem(INACTIVITY_CONFIG.SESSION_KEY);
        }
      } catch (err) {
        if (err.response?.status === 401 || err.response?.status === 404) {
          // ✅ Expected for logged-out users - silently clear session without logging
          setUser(null);
          localStorage.removeItem(INACTIVITY_CONFIG.SESSION_KEY);
        } else {
          console.error("Session recovery error:", err.response?.data || err.message);
        }
      }
    };

    recoverSession();
  }, []);

  // ✅ Fetch user profile once when the app loads
  // Also listen for changes to active user in tokenManager (multi-user support)
  useEffect(() => {
    const fetchProfile = async () => {
      let retries = 0;
      const MAX_RETRIES = 3;
      const RETRY_DELAY = 500; // 500ms between retries

      const attemptFetch = async () => {
        try {
          // ✅ Check if there's an active token in tokenManager (multi-user testing)
          const activeTokenUser = tokenManager.getActiveUser();
          if (activeTokenUser) {
            console.log(`✅ [Profile] Using active user from tokenManager: ${activeTokenUser.email}`);
            setUser(activeTokenUser);
            setLoading(false);
            return true; // Success
          }

          // Otherwise, fetch from API
          console.log(`⏳ [Profile] Fetching profile from API (attempt ${retries + 1}/${MAX_RETRIES + 1})...`);
          const { data } = await axios.get("/api/profiles/me", {
            withCredentials: true,
          });

          if (data && data.id) {
            const userData = {
              ...data,
              id: data.id ? parseInt(data.id, 10) : null,
            };
            setUser(userData);
            console.log(`✅ [Profile] Profile loaded successfully: ${userData.email}`);

            // ✅ Store session token for persistence
            if (INACTIVITY_CONFIG.PERSIST_SESSION) {
              localStorage.setItem(
                INACTIVITY_CONFIG.SESSION_KEY,
                JSON.stringify({
                  userId: userData.id,
                  email: userData.email,
                  role: userData.role,
                  timestamp: Date.now(),
                })
              );
            }

            // Initialize notifications service and auto-subscribe on login
            try {
              // Init service worker
              await notificationService.init();
              // Request permission and subscribe (will only subscribe if granted)
              if (Notification.permission === 'granted') {
                await notificationService.subscribe(data.id);
                // After subscribing, ask server to resend any pending notifications for this user
                try {
                  const pendingResp = await notificationService.resendPending();
                  console.log('🔔 Pending notifications resend result:', pendingResp);
                  // Notify any UI listeners to refresh notification lists
                  try { window.dispatchEvent(new Event('notifications:updated')); } catch(e){}
                } catch(e) {
                  console.warn('⚠️ Failed to fetch pending notifications after subscribe:', e?.message || e);
                }
              } else {
                // Request permission once (non-blocking)
                notificationService.requestPermission(data.id);
              }
            } catch (e) {
              console.warn('Notification init error:', e.message || e);
            }

            return true; // Success
          } else {
            console.warn('⚠️ [Profile] No user data in response');
            setUser(null);
            if (INACTIVITY_CONFIG.PERSIST_SESSION) {
              localStorage.removeItem(INACTIVITY_CONFIG.SESSION_KEY);
            }
            return true; // Success but no user
          }
        } catch (err) {
          if (err.response?.status === 401 || err.response?.status === 404) {
            // ✅ 401/404 errors might be temporary during OAuth redirect
            console.warn(`⏳ [Profile] Auth error ${err.response?.status}: ${err.response?.data?.error || 'Unknown error'}`);
            if (retries < MAX_RETRIES) {
              console.log(`⏳ [Profile] Auth may not be ready yet, retrying... (${retries + 1}/${MAX_RETRIES})`);
              return false; // Retry
            } else {
              // After all retries, assume user is not authenticated
              console.log("✅ [Profile] No user authenticated (401 after all retries)");
              setUser(null);
              if (INACTIVITY_CONFIG.PERSIST_SESSION) {
                localStorage.removeItem(INACTIVITY_CONFIG.SESSION_KEY);
              }
              return true; // Stop retrying
            }
          } else {
            console.error("❌ [Profile] Unexpected error:", err.response?.data || err.message);
            return true; // Stop retrying on other errors
          }
        }
      };

      // Retry loop
      while (retries <= MAX_RETRIES) {
        const success = await attemptFetch();
        if (success) break;
        
        retries++;
        if (retries <= MAX_RETRIES) {
          console.log(`⏳ [Profile] Waiting ${RETRY_DELAY}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
        }
      }

      setLoading(false);
    };

    fetchProfile();

    // ✅ Listen for changes to active user in tokenManager (multi-user testing)
    const handleStorageChange = (e) => {
      if (e.key === tokenManager.ACTIVE_TOKEN_KEY || e.key === tokenManager.STORAGE_KEY) {
        console.log("🔄 [Profile] Active user changed, refetching...");
        fetchProfile();
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  // ✅ Automatically apply dark mode class to the <html> element
  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem("darkMode", JSON.stringify(darkMode));
  }, [darkMode]);

  // ✅ Toggle dark mode globally
  const toggleDarkMode = () => {
    setDarkMode((prev) => !prev);
  };

  // ✅ Dynamic Change Password (connected to backend)
  const changePassword = async (currentPassword, newPassword) => {
    try {
      const { data } = await axios.post(
        "/api/auth/change-password",
        { currentPassword, newPassword },
        { withCredentials: true }
      );

      return { 
        success: true, 
        message: data.message || "✅ Password changed successfully" 
      };
    } catch (err) {
      console.error("Change password error:", err.response?.data || err.message);
      
      // Extract error message from various response structures
      const errorMessage = 
        err.response?.data?.message || 
        err.response?.data?.error || 
        err.message || 
        "Failed to change password";
      
      return {
        success: false,
        message: errorMessage,
      };
    }
  };

  // ✅ Context value shared across the entire app
  return (
    <UserContext.Provider
      value={{
        user,
        setUser,
        loading,
        darkMode,
        setDarkMode,
        toggleDarkMode,
        changePassword,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}
