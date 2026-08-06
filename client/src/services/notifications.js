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
    this._messageCallbacks = new Set();
    this._clickCallbacks = new Set();
    this._messageHandler = null;
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
        // Include userId so the server knows which user to associate this with
        const subJSON = existingSub.toJSON();
        const payload = { ...subJSON, userId };
        try {
          const response = await axios.post(
            "/api/notifications/subscribe",
            payload,
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

      // Send full subscription JSON to backend with userId
      const payload = { ...subJSON, userId };
      const response = await axios.post(
        "/api/notifications/subscribe",
        payload,
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

  normalizeNotification(notification) {
    const raw = notification || {};
    const timestamp =
      raw.timestamp ||
      raw.created_at ||
      raw.createdAt ||
      raw.data?.createdAt ||
      raw.data?.timestamp ||
      new Date().toISOString();

    const normalizedTimestamp =
      typeof timestamp === "string" ? timestamp : new Date(timestamp).toISOString();
    const fallbackId = `${raw.title || raw.type || "notification"}-${normalizedTimestamp}`;

    const sanitizeText = (value) => {
      if (typeof value !== "string") return "";
      const cleaned = value.trim();
      if (!cleaned) return "";
      if (/^notification$/i.test(cleaned)) return "";
      return cleaned;
    };

    const title = sanitizeText(raw.title || raw.data?.title);
    const message = sanitizeText(raw.message || raw.body || raw.data?.message || raw.data?.body);

    return {
      ...raw,
      id: raw.id ?? raw.notificationId ?? raw.data?.notificationId ?? fallbackId,
      title,
      message,
      data: raw.data || {},
      is_read: Boolean(raw.is_read),
      timestamp: normalizedTimestamp,
    };
  }

  normalizeNotifications(notifications) {
    const list = Array.isArray(notifications) ? notifications : [];
    const deduped = [];
    const seen = new Set();

    list
      .map((item) => this.normalizeNotification(item))
      .filter(Boolean)
      .forEach((item) => {
        const key = item.id ? `id:${item.id}` : `sig:${item.title}|${item.message}|${item.timestamp}`;
        if (seen.has(key)) return;
        seen.add(key);
        deduped.push(item);
      });

    return deduped.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  // Retrieve all notifications
  async getNotifications() {
    try {
      const response = await axios.get("/api/notifications", {
        withCredentials: true // ✅ CRITICAL: Ensure cookies are sent
      });
      return this.normalizeNotifications(response.data || []);
    } catch (error) {
      // ✅ FIX: Gracefully handle 401 during OAuth initialization
      if (error.response?.status === 401) {
        console.warn("🔐 [Notifications] Auth not ready yet (401)");
        return [];
      }
      console.error("❌ Failed to fetch notifications:", error.message || error);
      return [];
    }
  }

  // Get count of unread notifications
  async getUnreadCount() {
    try {
      const response = await axios.get("/api/notifications/unread-count", {
        withCredentials: true // ✅ CRITICAL: Ensure cookies are sent
      });
      const payload = response.data || {};
      const count = Number(payload.count ?? payload.unreadCount ?? 0);
      const list = this.normalizeNotifications(Array.isArray(payload.notifications) ? payload.notifications : (Array.isArray(payload) ? payload : []));
      return count > 0 ? count : list.filter((item) => !item.is_read).length;
    } catch (error) {
      // ✅ FIX: Gracefully handle 401 during OAuth initialization
      if (error.response?.status === 401) {
        console.warn("🔐 [Notifications] Auth not ready yet (401)");
        return 0;
      }
      console.error("❌ Failed to fetch unread count:", error.message || error);
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

  // Mark all notifications as read
  async markAllAsRead() {
    try {
      await axios.post("/api/notifications/mark-all-read");
      return true;
    } catch (error) {
      console.error("❌ Failed to mark all as read:", error);
      return false;
    }
  }

  // Delete a notification
  async deleteNotification(notificationId) {
    try {
      await axios.post("/api/notifications/delete", { id: notificationId });
      return true;
    } catch (error) {
      console.error("❌ Failed to delete notification:", error);
      return false;
    }
  }

  // Delete all read notifications
  async deleteAllReadNotifications() {
    try {
      await axios.post("/api/notifications/delete-all-read");
      return true;
    } catch (error) {
      console.error("❌ Failed to delete all read notifications:", error);
      return false;
    }
  }

  // 🔍 Diagnostic: Check notification system status
  async diagnoseNotifications() {
    const diagnostics = {
      timestamp: new Date().toISOString(),
      checks: {}
    };

    // Check 1: ServiceWorker API support
    diagnostics.checks.serviceWorkerSupported = "serviceWorker" in navigator;

    // Check 2: PushManager support
    diagnostics.checks.pushManagerSupported = "PushManager" in window;

    // Check 3: Notification API support
    diagnostics.checks.notificationSupported = "Notification" in window;

    // Check 4: Service worker registration
    try {
      const reg = await navigator.serviceWorker?.getRegistration();
      diagnostics.checks.serviceWorkerRegistered = !!reg;
      if (reg) {
        diagnostics.checks.serviceWorkerScope = reg.scope;
      }
    } catch (e) {
      diagnostics.checks.serviceWorkerRegistered = false;
      diagnostics.checks.serviceWorkerError = e.message;
    }

    // Check 5: Notification permission
    diagnostics.checks.notificationPermission = Notification?.permission || 'not available';

    // Check 6: Push subscription
    try {
      const reg = await navigator.serviceWorker?.getRegistration();
      const sub = await reg?.pushManager?.getSubscription?.();
      diagnostics.checks.pushSubscriptionExists = !!sub;
      if (sub) {
        diagnostics.checks.subscriptionEndpoint = sub.endpoint?.substring(0, 100) + '...';
      }
    } catch (e) {
      diagnostics.checks.pushSubscriptionError = e.message;
    }

    // Check 7: VAPID key
    diagnostics.checks.vapidKeyAvailable = !!this.vapidPublicKey;

    // Check 8: Verify Service Worker is ACTIVE (not just installed)
    if (this.swRegistration) {
      diagnostics.checks.serviceWorkerActive = !!this.swRegistration.active;
      diagnostics.checks.serviceWorkerWaiting = !!this.swRegistration.waiting;
      diagnostics.checks.serviceWorkerInstalling = !!this.swRegistration.installing;
      if (this.swRegistration.active) {
        diagnostics.checks.serviceWorkerState = 'ACTIVE';
      } else if (this.swRegistration.waiting) {
        diagnostics.checks.serviceWorkerState = 'WAITING (needs update)';
      } else if (this.swRegistration.installing) {
        diagnostics.checks.serviceWorkerState = 'INSTALLING';
      } else {
        diagnostics.checks.serviceWorkerState = 'UNKNOWN';
      }
    }

    // Check 9: Try to show a test system notification (if permission granted)
    if (Notification?.permission === 'granted') {
      try {
        const testNotif = new Notification('[TEST] System Notification API Works', {
          body: 'This is a test system notification. If you see this, the Notification API is working correctly.',
          icon: '/icon-192x192.png',
          badge: '/badge-96x96.png',
          tag: 'test-notification',
          requireInteraction: false
        });
        diagnostics.checks.systemNotificationTest = 'success - notification shown';
        // Close the test notification after a short delay
        setTimeout(() => { testNotif.close(); }, 3000);
      } catch (e) {
        diagnostics.checks.systemNotificationTest = `failed: ${e.message}`;
      }
    } else {
      diagnostics.checks.systemNotificationTest = `skipped: permission is ${Notification?.permission || 'not available'}`;
    }

    console.log("🔍 [Notifications] Diagnostic Report:", diagnostics);
    return diagnostics;
  }

  // Listen for messages from the service worker
  // callback will be called with payload for PUSH_RECEIVED
  setupMessageListener(callback) {
    if (typeof callback !== "function") {
      return;
    }

    this._messageCallbacks.add(callback);

    if (!("serviceWorker" in navigator)) {
      console.warn("⚠️ [Client] serviceWorker not available in navigator");
      return;
    }

    try {
      if (this._messageHandler) {
        return;
      }

      this._messageHandler = (event) => {
        try {
          if (!event || !event.data) {
            return;
          }

          const { type, payload } = event.data;
          const messagePayload = payload || event.data?.notification || event.data;

          if (type === "PUSH_RECEIVED") {
            console.log("📨 [Client] ✅ Received PUSH_RECEIVED message from service worker:", messagePayload);

            this._messageCallbacks.forEach((listener) => {
              try {
                listener(messagePayload);
              } catch (err) {
                console.error("❌ [Client] Error in PUSH_RECEIVED callback:", err);
              }
            });
          } else if (type === "NOTIFICATION_CLICK") {
            console.log("📨 [Client] Received NOTIFICATION_CLICK message:", messagePayload);
            this._clickCallbacks.forEach((listener) => {
              try {
                listener(messagePayload);
              } catch (err) {
                console.error("❌ [Client] Error in NOTIFICATION_CLICK callback:", err);
              }
            });
          } else {
            console.log("📨 [Client] Received unknown message type:", type);
          }
        } catch (err) {
          console.error("❌ [Client] Error processing service worker message:", err);
        }
      };

      navigator.serviceWorker.addEventListener("message", this._messageHandler);
      console.log("✅ [Client] Message listener attached to service worker");
    } catch (err) {
      console.error("❌ [Client] Failed to setup message listener:", err);
    }
  }

  // Listen for notification click events forwarded from the service worker
  setupClickListener(callback) {
    if (typeof callback !== "function") {
      return;
    }

    this._clickCallbacks.add(callback);
    if (!("serviceWorker" in navigator)) {
      return;
    }

    if (this._messageHandler) {
      return;
    }

    this.setupMessageListener(() => {});
  }

  // Remove previously attached message listener (if any)
  removeMessageListener(callback) {
    if (typeof callback === "function") {
      this._messageCallbacks.delete(callback);
    } else {
      this._messageCallbacks.clear();
    }

    try {
      if (this._messageCallbacks.size === 0 && this._messageHandler && "serviceWorker" in navigator) {
        navigator.serviceWorker.removeEventListener("message", this._messageHandler);
        this._messageHandler = null;
      }
    } catch (e) {
      // ignore removal errors
    }
  }

  removeClickListener(callback) {
    if (typeof callback === "function") {
      this._clickCallbacks.delete(callback);
    } else {
      this._clickCallbacks.clear();
    }
  }

  // Test method: Trigger a test push notification from the backend
  async testNotification() {
    try {
      console.log("🧪 Requesting test notification from backend...");
      const response = await axios.post(
        "/api/notifications/send-test",
        {},
        { withCredentials: true }
      );
      console.log("✅ Test notification triggered:", response.data);
      return response.data;
    } catch (error) {
      console.error("❌ Failed to trigger test notification:", error.response?.data || error.message);
      return null;
    }
  }
}

export const notificationService = new NotificationService();
export default notificationService;
