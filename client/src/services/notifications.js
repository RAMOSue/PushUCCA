// client/src/services/notifications.js
import axios from "axios";

// Always send cookies (JWT in cookie) for authenticated API requests
axios.defaults.withCredentials = true;

// Utility: convert Base64 VAPID key to UInt8 array
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

class NotificationService {
  constructor() {
    this.vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
    this.swRegistration = null;
    this.isSubscribed = false;
  }

  // Initialize service worker
  async init() {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      console.warn("❌ Push notifications not supported in this browser");
      return false;
    }

    try {
      // If VAPID key not set at build-time, fetch it from the server
      if (!this.vapidPublicKey) {
        try {
          const resp = await axios.get('/api/notifications/vapid-public-key');
          this.vapidPublicKey = resp.data?.publicKey || null;
          if (!this.vapidPublicKey) {
            console.warn('⚠️ VAPID public key not available from server');
          }
        } catch (err) {
          console.warn('⚠️ Failed to fetch VAPID key from server:', err.message || err);
        }
      }

      const existingReg = await navigator.serviceWorker.getRegistration();
      if (existingReg) {
        console.log("✅ Found existing service worker");
        this.swRegistration = existingReg;

        const existingSub = await existingReg.pushManager.getSubscription();
        if (existingSub) {
          console.log("🔔 Found existing push subscription");
          this.isSubscribed = true;
          return true;
        }
      }

      this.swRegistration = await navigator.serviceWorker.register(
        "/service-worker.js"
      );
      console.log("✅ Service Worker registered successfully");

      await navigator.serviceWorker.ready;
      console.log("✅ Service Worker ready");
      return true;
    } catch (error) {
      console.error("❌ Service Worker registration failed:", error);
      return false;
    }
  }

  // Request user permission for notifications
  async requestPermission(userId) {
    try {
      console.log("🔔 Requesting notification permission...");
      const permission = await Notification.requestPermission();

      console.log("Permission result:", permission);
      if (permission === "granted") {
        const subscribed = await this.subscribe(userId);
        if (subscribed) {
          console.log("✅ Successfully subscribed after permission grant");
          return true;
        }
      } else {
        console.warn("⚠️ Notification permission denied or dismissed");
      }
      return false;
    } catch (error) {
      console.error("❌ Permission request error:", error);
      return false;
    }
  }

  // Subscribe user to push notifications
  async subscribe(userId) {
    try {
      console.log(`📲 Subscribing user ${userId} to push notifications...`);
      
      if (!this.swRegistration) {
        console.warn(
          "⚠️ No Service Worker registration found — did you call init()?"
        );
        return false;
      }

      const existingSub = await this.swRegistration.pushManager.getSubscription();
      if (existingSub) {
        console.log("✅ User already has an active subscription, updating on server...");
        this.isSubscribed = true;
        
        // Send existing subscription to server to ensure it's registered
        // NOTE: Server uses INSERT ON CONFLICT so each device gets its own row
        const subJSON = existingSub.toJSON();
        try {
          const response = await axios.post(
            "/api/notifications/subscribe",
            subJSON,
            { withCredentials: true }
          );
          console.log("✅ Existing subscription registered on server:", response.data);
        } catch (serverErr) {
          console.error("⚠️ Failed to register existing subscription on server:", serverErr.message);
        }
        return true;
      }

      console.log("📲 Creating new push subscription...");
      if (!this.vapidPublicKey) {
        // Attempt to fetch again before creating subscription
        try {
          const resp = await axios.get('/api/notifications/vapid-public-key');
          this.vapidPublicKey = resp.data?.publicKey || null;
        } catch (err) {
          console.warn('⚠️ Failed to fetch VAPID key from server before subscribe:', err.message || err);
        }
      }

      if (!this.vapidPublicKey) {
        console.error('❌ VAPID public key missing — cannot subscribe');
        return false;
      }

      const applicationServerKey = urlBase64ToUint8Array(this.vapidPublicKey);
      const subscription = await this.swRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });

      const subJSON = subscription.toJSON();
      console.log("✅ New subscription created:", subJSON);

      // Send full subscription JSON to backend
      // NOTE: Server will INSERT ON CONFLICT so multiple devices per user are supported
      const response = await axios.post(
        "/api/notifications/subscribe",
        subJSON,
        { withCredentials: true }
      );

      console.log("✅ Subscription saved on server:", response.data);
      this.isSubscribed = true;
      return true;
    } catch (error) {
      console.error(
        "❌ Failed to subscribe:",
        error.response?.data || error.message || error
      );
      return false;
    }
  }

  // ✅ Fetch and trigger resend of pending notifications
  // Called after login to deliver any queued messages
  async resendPending() {
    try {
      console.log("🔄 Fetching pending notifications...");
      const response = await axios.get("/api/notifications/pending", {
        withCredentials: true
      });
      console.log("✅ Pending notifications resend result:", response.data);
      return response.data;
    } catch (error) {
      console.error("❌ Failed to resend pending:", error.message || error);
      return { success: false, pending: [] };
    }
  }

  // Retrieve all notifications
  async getNotifications() {
    try {
      const response = await axios.get("/api/notifications");
      return response.data;
    } catch (error) {
      console.error("❌ Failed to fetch notifications:", error);
      return [];
    }
  }

  // Get count of unread notifications
  async getUnreadCount() {
    try {
      const response = await axios.get("/api/notifications/unread-count");
      return response.data.count;
    } catch (error) {
      console.error("❌ Failed to fetch unread count:", error);
      return 0;
    }
  }

  // Mark notification as read
  async markAsRead(notificationId) {
    try {
      await axios.post("/api/notifications/mark-read", { id: notificationId });
      return true;
    } catch (error) {
      console.error("❌ Failed to mark as read:", error);
      return false;
    }
  }

  // Listen for messages from the service worker
  // Listen for messages from the service worker
  // callback will be called with payload for PUSH_RECEIVED
  setupMessageListener(callback) {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("message", (event) => {
        if (!event.data) return;
        const { type, payload } = event.data;
        if (type === "PUSH_RECEIVED") {
          callback(payload);
        }
      });
    }
  }

  // Listen for notification click events forwarded from the service worker
  setupClickListener(callback) {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("message", (event) => {
        if (!event.data) return;
        const { type, payload } = event.data;
        if (type === "NOTIFICATION_CLICK") {
          callback(payload);
        }
      });
    }
  }
}

export const notificationService = new NotificationService();
export default notificationService;
