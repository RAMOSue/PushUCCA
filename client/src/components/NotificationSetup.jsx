// client/src/components/NotificationSetup.jsx
import { useEffect, useContext, useState } from "react";
import { UserContext } from "../../context/userContext.jsx"; // correct relative path
import { notificationService } from "../services/notifications.js"; // correct relative path

export default function NotificationSetup() {
  const { user } = useContext(UserContext);
  const [permission, setPermission] = useState(Notification.permission);

  useEffect(() => {
    const initServiceWorker = async () => {
      if (user && user.id) {
        try {
          console.log("🔔 [NotificationSetup] Initializing Service Worker for user:", user.id);

          const swRegistered = await notificationService.init();
          console.log("🔔 [NotificationSetup] Service Worker registered:", swRegistered);

          if (!swRegistered) {
            console.warn("⚠️ [NotificationSetup] Service Worker registration failed. Notifications will not work.");
          }

          // If user already granted permission, ensure subscription exists
          if (Notification.permission === "granted") {
            const sub = await notificationService.subscribe(user.id);
            if (sub) console.log("✅ [NotificationSetup] Existing subscription synced with backend.");
            // After subscribing, ask server to resend any pending notifications
            try {
              const pendingResp = await notificationService.resendPending();
              console.log('🔔 [NotificationSetup] resendPending result:', pendingResp);
              try { window.dispatchEvent(new Event('notifications:updated')); } catch(e){}
            } catch (e) {
              console.warn('⚠️ [NotificationSetup] resendPending failed:', e?.message || e);
            }
          }
        } catch (error) {
          console.error("❌ [NotificationSetup] Error initializing Service Worker:", error);
        }
      }
    };

    initServiceWorker();
  }, [user]);

  // Trigger notification permission in response to user gesture
  const handleEnableNotifications = async () => {
    if (!user || !user.id) return;

    try {
      const granted = await notificationService.requestPermission(user.id);
      setPermission(Notification.permission);
      if (granted) {
        console.log("✅ [NotificationSetup] Notifications enabled for user:", user.id);
      } else {
        console.warn("⚠️ [NotificationSetup] Notifications not granted by user.");
      }
    } catch (error) {
      console.error("❌ [NotificationSetup] Error requesting notification permission:", error);
    }
  };

  // Show button only if permission is default (not granted or denied)
  if (permission === "default") {
    return (
      <button
        onClick={handleEnableNotifications}
        className="px-3 py-1 bg-blue-600 text-white rounded"
      >
        Enable Notifications
      </button>
    );
  }

  return null; // Nothing to render if permission already granted or denied
}
