const webpush = require("web-push");
const db = require("../db");
const dotenv = require("dotenv");
dotenv.config();

// Configure web-push with VAPID keys
webpush.setVapidDetails(
  process.env.VAPID_SUBJECT,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

const notificationController = {
  /**
   * ✅ Save a new push subscription from the client
   * NOTE: Uses INSERT ON CONFLICT DO NOTHING to allow multiple subscriptions per user
   * Each device has a unique endpoint, so we never overwrite other devices
   */
  saveSubscription: async (reqOrUserId, maybeSubscription, maybeRes) => {
    try {
      let userId, subscription, res;

      if (typeof reqOrUserId === "object" && reqOrUserId.body) {
        // Called from route: (req, res)
        const req = reqOrUserId;
        res = maybeSubscription;
        userId = req.user?.id;
        subscription = req.body;
      } else {
        // Called directly: (userId, subscription)
        userId = reqOrUserId;
        subscription = maybeSubscription;
        res = maybeRes || null;
      }

      // Validate input
      if (
        !userId ||
        !subscription ||
        !subscription.endpoint ||
        !subscription.keys ||
        !subscription.keys.p256dh ||
        !subscription.keys.auth
      ) {
        console.warn("❌ Invalid subscription data:", subscription);
        if (res) return res.status(400).json({ error: "Invalid request" });
        return false;
      }

      const { endpoint, keys } = subscription;

      // NOTE: Using INSERT ON CONFLICT DO NOTHING to ensure we don't overwrite subscriptions from other devices
      // Each endpoint is unique, so same device re-subscribing won't create duplicates
      // But different devices for the same user create separate rows
      const result = await db.query(
        `
        INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, created_at, last_seen)
        VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT (endpoint) DO UPDATE SET
          last_seen = CURRENT_TIMESTAMP
        RETURNING id, user_id, endpoint
      `,
        [userId, endpoint, keys.p256dh, keys.auth]
      );

      const savedSub = result.rows[0];
      console.log(
        `✅ Subscription saved for user ${userId}: endpoint=${endpoint.substring(0, 50)}...`
      );

      if (res)
        return res.json({
          success: true,
          message: "Subscription saved successfully",
          subscriptionId: savedSub?.id,
        });

      return true;
    } catch (error) {
      console.error("❌ Save subscription error:", error.message || error);
      if (maybeRes)
        return maybeRes.status(500).json({ error: "Server error" });
      return false;
    }
  },

  /**
   * ✅ Send push notification to a specific user
   * This function:
   * 1. Saves the notification to DB with is_delivered = false
   * 2. Queries all subscriptions for the target user
   * 3. Attempts to send to each subscription (supports multiple devices)
   * 4. Removes expired subscriptions (410/404) 
   * 5. Updates notification is_delivered based on success
   * 
   * If user is offline/no subscriptions, notification stays queued in DB
   */
  sendPushToUser: async ({
    userId,
    title,
    message,
    type,
    data = {},
    relatedRequest = null,
  }) => {
    try {
      // Step 1: Always save notification to DB first (persistent queue)
      const insertRes = await db.query(
        `
        INSERT INTO notifications (user_id, type, message, channel, data, related_request, is_delivered, created_at)
        VALUES ($1, $2, $3, 'push', $4, $5, false, CURRENT_TIMESTAMP)
        RETURNING id
      `,
        [userId, type, message, JSON.stringify(data), relatedRequest]
      );

      const notificationId = insertRes.rows[0]?.id;
      console.log(
        `📝 Notification created: ID=${notificationId}, User=${userId}, Type=${type}`
      );

      // Step 2: Query all subscriptions for this user (NOTE: multiple devices per user)
      const subResult = await db.query(
        `SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1`,
        [userId]
      );

      const subscriptions = subResult.rows;
      console.log(
        `🔍 Found ${subscriptions.length} subscription(s) for user ${userId}`
      );

      // Debug: list endpoints to help trace delivery failures
      try {
        const endpoints = subscriptions.map((s) => s.endpoint);
        console.log(`🔗 Subscription endpoints for user ${userId}:`, endpoints);
      } catch (e) {}

      // Step 3: If no subscriptions, notification will be retried when user subscribes later
      if (subscriptions.length === 0) {
        console.warn(
          `⚠️ No push subscription found for user ${userId} — notification queued for later delivery`
        );
        // Notification stays in DB with is_delivered=false for later retry
        return { success: false, queued: true, notificationId };
      }

      // Step 4: Send to each subscription
      let successCount = 0;
      let failureCount = 0;

      for (const sub of subscriptions) {
        try {
          const payload = JSON.stringify({
            notificationId,
            title,
            message,
            type,
            data,
          });

          // Debug: log payload and target subscription id
          try {
            console.log(`➡️ Sending payload to subscription ${sub.id} (user ${userId}) - payload snippet:`, payload.substring(0, 400));
          } catch (e) {}

          // TTL: 24 hours — allows offline users to receive push when they reconnect
          const options = { TTL: 60 * 60 * 24 };

          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            payload,
            options
          );

          console.log(`✅ Push sent to subscription ${sub.id}`);
          successCount++;
        } catch (error) {
          console.error(
            `❌ Push send failed for subscription ${sub.id}: ${error && error.message ? error.message : error}`
          );
          try {
            console.error('   Full error:', error);
          } catch (e) {}
          failureCount++;

          // Remove invalid/expired subscriptions (410/404 = endpoint no longer valid)
          if (error.statusCode === 410 || error.statusCode === 404) {
            console.log(
              `🗑️ Removing expired subscription ${sub.id} (HTTP ${error.statusCode})`
            );
            try {
              await db.query(
                "DELETE FROM push_subscriptions WHERE id = $1",
                [sub.id]
              );
            } catch (delErr) {
              console.error("Failed to delete subscription:", delErr.message);
            }
          }
        }
      }

      // Step 5: Update notification delivery status
      if (successCount > 0) {
        // Mark as delivered if at least one push succeeded
        try {
          await db.query(
            `UPDATE notifications 
             SET is_delivered = true, delivered_at = CURRENT_TIMESTAMP 
             WHERE id = $1`,
            [notificationId]
          );
          console.log(`✅ Notification ${notificationId} marked as delivered`);
        } catch (e) {
          console.error("Failed to update notification delivered status:", e.message);
        }
      } else if (failureCount > 0) {
        // All attempts failed but subscriptions exist — stay queued
        console.log(
          `⚠️ All delivery attempts failed for notification ${notificationId} — will retry later`
        );
      }

      return {
        success: successCount > 0,
        successCount,
        failureCount,
        notificationId,
      };
    } catch (error) {
      console.error("Send push notification error:", error.message || error);
      return { success: false, error: error.message };
    }
  },

  /**
   * ✅ Resend pending notifications for a user
   * Called when user logs in or subscribes to trigger delivery of queued messages
   */
  resendPendingForUser: async (userId) => {
    try {
      console.log(`🔄 Checking for pending notifications for user ${userId}...`);

      // Query notifications that haven't been delivered yet
      const result = await db.query(
        `SELECT id, user_id, type, message, data, created_at 
         FROM notifications
         WHERE user_id = $1 AND is_delivered = false
         ORDER BY created_at ASC
         LIMIT 100`,
        [userId]
      );

      const pending = result.rows;
      console.log(`📌 Found ${pending.length} pending notification(s) for user ${userId}`);

      if (pending.length === 0) {
        return { success: true, pending: [], resent: 0 };
      }

      let resentCount = 0;
      const results = [];

      // Try to send each pending notification
      for (const notif of pending) {
        try {
          const payload = JSON.stringify({
            notificationId: notif.id,
            title: "Pending Notification",
            message: notif.message,
            type: notif.type,
            data: notif.data || {},
          });

          // Get all active subscriptions for this user
          const subs = await db.query(
            "SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1",
            [userId]
          );

          let wasSent = false;

          for (const sub of subs.rows) {
            try {
              const options = { TTL: 60 * 60 * 24 };
              await webpush.sendNotification(
                {
                  endpoint: sub.endpoint,
                  keys: { p256dh: sub.p256dh, auth: sub.auth },
                },
                payload,
                options
              );
              wasSent = true;
            } catch (err) {
              if (err.statusCode === 410 || err.statusCode === 404) {
                await db.query(
                  "DELETE FROM push_subscriptions WHERE id = $1",
                  [sub.id]
                );
              }
            }
          }

          // Mark notification as delivered if at least one push succeeded
          if (wasSent) {
            await db.query(
              "UPDATE notifications SET is_delivered = true, delivered_at = CURRENT_TIMESTAMP WHERE id = $1",
              [notif.id]
            );
            resentCount++;
            results.push({ id: notif.id, sent: true });
            console.log(`✅ Resent pending notification ${notif.id}`);
          } else {
            results.push({ id: notif.id, sent: false });
          }
        } catch (err) {
          console.error(`❌ Error resending notification ${notif.id}:`, err.message);
          results.push({ id: notif.id, sent: false, error: err.message });
        }
      }

      console.log(`📊 Resend result: ${resentCount}/${pending.length} notifications sent`);
      return { success: true, pending, resent: resentCount, results };
    } catch (error) {
      console.error("Error in resendPendingForUser:", error.message || error);
      return { success: false, error: error.message };
    }
  },

  /**
   * ✅ API endpoint: Resend pending notifications for logged-in user
   * Called by frontend after login to trigger delivery
   */
  resendPendingForUserEndpoint: async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const result = await notificationController.resendPendingForUser(userId);
      res.json(result);
    } catch (error) {
      console.error("resendPendingForUserEndpoint error:", error.message || error);
      res.status(500).json({ error: "Server error" });
    }
  },

  /**
   * ✅ Get all notifications for logged-in user
   */
  getNotifications: async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const result = await db.query(
        `SELECT id, type, message, data, is_delivered, is_read, created_at 
         FROM notifications 
         WHERE user_id = $1 
         ORDER BY created_at DESC 
         LIMIT 100`,
        [userId]
      );

      res.json(result.rows);
    } catch (error) {
      console.error("Get notifications error:", error.message || error);
      res.status(500).json({ error: "Server error" });
    }
  },

  /**
   * ✅ Mark notification as read
   */
  markAsRead: async (req, res) => {
    try {
      const userId = req.user?.id;
      const { id } = req.body;
      if (!userId || !id)
        return res.status(400).json({ error: "Invalid request" });

      await db.query(
        `UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2`,
        [id, userId]
      );

      res.json({ success: true });
    } catch (error) {
      console.error("Mark as read error:", error.message || error);
      res.status(500).json({ error: "Server error" });
    }
  },

  /**
   * ✅ Get unread count
   */
  getUnreadCount: async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const result = await db.query(
        `SELECT COUNT(*) as count FROM notifications 
         WHERE user_id = $1 AND is_read = false`,
        [userId]
      );

      res.json({ count: parseInt(result.rows[0].count) || 0 });
    } catch (error) {
      console.error("Get unread count error:", error.message || error);
      res.status(500).json({ error: "Server error" });
    }
  },

  /**
   * 🧪 TEST: Send a test notification to current user
   */
  sendTestNotification: async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const result = await notificationController.sendPushToUser({
        userId,
        title: "🧪 Test Notification",
        message: "This is a test notification from the system.",
        type: "test",
        data: { test: true, url: "/dashboard" },
      });

      res.json(result);
    } catch (error) {
      console.error("Test notification error:", error.message || error);
      res.status(500).json({ error: "Server error" });
    }
  },

  /**
   * 🧪 TEST: Send a test 'due soon' notification
   */
  sendDueSoonNotification: async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const result = await notificationController.sendPushToUser({
        userId,
        title: "⏰ Items Due Soon",
        message: "Your borrowed items are due in 3 days. Please return them on time.",
        type: "due_soon",
        data: { action: "reminder", url: "/my-borrowed-items" },
      });

      res.json(result);
    } catch (error) {
      console.error("Due soon notification error:", error.message || error);
      res.status(500).json({ error: "Server error" });
    }
  },
};

module.exports = notificationController;
