// client/src/context/userContext.jsx
import axios from "axios";
import { createContext, useEffect, useState } from "react";
import notificationService from "../src/services/notifications";
import { INACTIVITY_CONFIG } from "../src/config/inactivityConfig";
import tokenManager from "../src/utils/tokenManager"; // ✅ Multi-user testing

export const UserContext = createContext({});

// ✅ Global axios defaults
axios.defaults.baseURL = "http://localhost:8000";
axios.defaults.withCredentials = true;

/**
 * 🔧 Axios interceptor to inject active user token from tokenManager
 * This allows switching between multiple logged-in users
 */
axios.interceptors.request.use(
  (config) => {
    const activeToken = tokenManager.getActiveTokenString();
    if (activeToken) {
      config.headers.Authorization = `Bearer ${activeToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
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
          // Expected for logged-out users or missing profiles - don't log as error
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
      try {
        // ✅ Check if there's an active token in tokenManager (multi-user testing)
        const activeTokenUser = tokenManager.getActiveUser();
        if (activeTokenUser) {
          console.log(`✅ [Profile] Using active user from tokenManager: ${activeTokenUser.email}`);
          setUser(activeTokenUser);
          setLoading(false);
          return;
        }

        // Otherwise, fetch from API
        const { data } = await axios.get("/api/profiles/me", {
          withCredentials: true,
        });

        if (data && data.id) {
          const userData = {
            ...data,
            id: data.id ? parseInt(data.id, 10) : null,
          };
          setUser(userData);

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
        } else {
          setUser(null);
          if (INACTIVITY_CONFIG.PERSIST_SESSION) {
            localStorage.removeItem(INACTIVITY_CONFIG.SESSION_KEY);
          }
        }
      } catch (err) {
        if (err.response?.status === 401 || err.response?.status === 404) {
          // Expected for logged-out users or missing profiles - don't log as error
          setUser(null);
          if (INACTIVITY_CONFIG.PERSIST_SESSION) {
            localStorage.removeItem(INACTIVITY_CONFIG.SESSION_KEY);
          }
        } else {
          console.error("Profile fetch error:", err.response?.data || err.message);
        }
      } finally {
        setLoading(false);
      }
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
