// client/src/context/userContext.jsx
import axios from "axios";
import { createContext, useEffect, useState } from "react";
import { notificationService } from "../src/services/notifications";

export const UserContext = createContext({});

// ✅ Global axios defaults
axios.defaults.baseURL = "http://localhost:8000";
axios.defaults.withCredentials = true;

export function UserContextProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // ✅ Global Dark Mode State (persists in localStorage)
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem("darkMode");
    return saved ? JSON.parse(saved) : false;
  });

  // ✅ Fetch user profile once when the app loads
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const { data } = await axios.get("/api/auth/profile", {
          withCredentials: true,
        });

        if (data && data.id) {
          setUser({
            ...data,
            id: data.id ? parseInt(data.id, 10) : null,
          });
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
        }
      } catch (err) {
        if (err.response?.status === 401) {
          setUser(null); // Not logged in
        } else {
          console.error("Profile fetch error:", err.response?.data || err.message);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
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
      const { data } = await axios.put(
        "/api/auth/change-password",
        { currentPassword, newPassword },
        { withCredentials: true }
      );

      return { success: true, message: data.message || "Password changed successfully" };
    } catch (err) {
      console.error("Change password error:", err.response?.data || err.message);
      return {
        success: false,
        message: err.response?.data?.message || "Failed to change password",
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
        toggleDarkMode,
        changePassword,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}
