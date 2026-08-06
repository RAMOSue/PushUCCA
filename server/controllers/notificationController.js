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

// Debounce map: track recently-triggered resend operations to avoid rapid duplicates
// Key: userId, Value: timestamp of last resend trigger
const _resendDebounce = new Map();
const _RESEND_DEBOUNCE_MS = 3 * 1000; // 3 seconds — prevent resend within 3 seconds of last trigger

// Periodically clean old entries from debounce map
setInterval(() => {
  const now = Date.now();
  for (const [userId, ts] of _resendDebounce.entries()) {
    if (now - ts > _RESEND_DEBOUNCE_MS * 2) _resendDebounce.delete(userId);
  }
}, 30 * 1000);

const isPushEnabledForEnvironment = () => {
  const env = (process.env.NODE_ENV || "").toLowerCase();
  const isProductionLike = env === "production" || process.env.RENDER === "true" || process.env.VERCEL === "true";
  return isProductionLike || process.env.PUSH_NOTIFICATIONS_ENABLED === "true";
};

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

      // Immediately insert/update the subscription (non-blocking)
      const result = await db.query(
        `
        INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, created_at, last_seen)
        VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT (endpoint) DO UPDATE SET
          last_seen = CURRENT_TIMESTAMP,
          user_id = COALESCE(EXCLUDED.user_id, push_subscriptions.user_id)
        RETURNING id, user_id, endpoint
      `,
        [userId, endpoint, keys.p256dh, keys.auth]
      );

      const savedSub = result.rows[0];
      console.log(
        `✅ Subscription saved for user ${userId}: endpoint=${endpoint.substring(0, 50)}...`
      );

      // Return response immediately (don't wait for resend)
      if (res) {
        res.json({
          success: true,
          message: "Subscription saved successfully",
          subscriptionId: savedSub?.id,
        });
      }

      // Trigger resend asynchronously with debounce to prevent rapid duplicate triggers
      // This happens AFTER the response is sent, so it doesn't delay the client
      (async () => {
        try {
          const now = Date.now();
          const lastResend = _resendDebounce.get(userId);
          
          // Check if we recently triggered a resend for this user (within debounce window)
          if (lastResend && (now - lastResend) < _RESEND_DEBOUNCE_MS) {
            console.log(`⏱️ Resend for user ${userId} already triggered ${now - lastResend}ms ago, skipping (debounce)`);
            return;
          }

          // Mark this resend as triggered
          _resendDebounce.set(userId, now);

          // Perform resend in background (non-blocking)
          const resendResult = await notificationController.resendPendingForUser(userId);
          console.log(`🔁 Resend after subscribe result for user ${userId}:`, resendResult && resendResult.resent !== undefined ? `${resendResult.resent} resent` : resendResult);
        } catch (rrErr) {
          console.error(`❌ Error while resending pending notifications after subscribe for user ${userId}:`, rrErr && rrErr.message ? rrErr.message : rrErr);
        }
      })();

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

      // Deduplicate subscriptions by endpoint to avoid sending the same
      // payload multiple times when duplicate rows exist for the same device.
      const rawSubs = subResult.rows || [];
      const subsByEndpoint = new Map(rawSubs.map((s) => [s.endpoint, s]));
      const subscriptions = Array.from(subsByEndpoint.values());
      if (rawSubs.length !== subscriptions.length) {
        console.log(`🔍 Found ${rawSubs.length} subscription rows, deduped to ${subscriptions.length} unique endpoint(s) for user ${userId}`);
      } else {
        console.log(`🔍 Found ${subscriptions.length} subscription(s) for user ${userId}`);
      }

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

      if (!isPushEnabledForEnvironment()) {
        console.log(`🚫 Push notifications disabled for environment ${process.env.NODE_ENV || "unknown"}; skipping delivery for notification ${notificationId}`);
        await db.query(
          `UPDATE notifications SET is_delivered = true WHERE id = $1`,
          [notificationId]
        );
        return {
          success: false,
          successCount: 0,
          failureCount: 0,
          notificationId,
          skipped: true,
          reason: "push-disabled-for-environment",
        };
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
            console.log(`➡️ Sending to subscription ${sub.id}:`);
            console.log(`   - Endpoint: ${sub.endpoint.substring(0, 80)}...`);
            console.log(`   - Keys valid: p256dh=${!!sub.p256dh}, auth=${!!sub.auth}`);
            console.log(`   - Payload: ${payload.substring(0, 300)}...`);
          } catch (e) {}

          // TTL: 24 hours — allows offline users to receive push when they reconnect
          const options = { TTL: 60 * 60 * 24 };

          console.log(`📤 [CRITICAL] About to call webpush.sendNotification() for sub ${sub.id}`);

          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            payload,
            options
          );

          console.log(`✅ Push sent to subscription ${sub.id} - SUCCESS`);
          successCount++;
        } catch (error) {
          console.error(
            `❌ Push send FAILED for subscription ${sub.id}: ${error && error.message ? error.message : error}`
          );
          console.error(`   Status Code: ${error?.statusCode}`);
          console.error(`   Error Name: ${error?.name}`);
          console.error(`   Body: ${error?.body}`);
          try {
            console.error('   Full error object:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
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

          // Get all active subscriptions for this user and dedupe by endpoint
          const subs = await db.query(
            "SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1",
            [userId]
          );

          const subsRows = subs.rows || [];
          const subsByEndpoint = new Map(subsRows.map((s) => [s.endpoint, s]));
          const uniqueSubs = Array.from(subsByEndpoint.values());
          console.log(`🔍 Resend: found ${subsRows.length} subscription rows, deduped to ${uniqueSubs.length} endpoint(s) for user ${userId} while resending notification ${notif.id}`);
          try {
            const endpoints = uniqueSubs.map(s => s.endpoint);
            console.log(`🔗 Resend endpoints for user ${userId}:`, endpoints);
          } catch (e) {}

          if (uniqueSubs.length === 0) {
            results.push({ id: notif.id, sent: false, reason: 'no_subscriptions' });
            // nothing to send to; continue to next pending notification
            continue;
          }

          let wasSent = false;

          for (const sub of uniqueSubs) {
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
              console.log(`✅ Resend: Push sent to subscription ${sub.id} for notification ${notif.id}`);
            } catch (err) {
              console.error(`❌ Resend: push send failed for subscription ${sub.id} (notif ${notif.id}):`, err && err.message ? err.message : err);
              try {
                console.error('   Full err:', err);
              } catch (e) {}
              // Remove invalid/expired subscriptions
              if (err && (err.statusCode === 410 || err.statusCode === 404)) {
                console.log(`🗑️ Resend: Removing expired subscription ${sub.id} (HTTP ${err.statusCode})`);
                try {
                  await db.query(
                    "DELETE FROM push_subscriptions WHERE id = $1",
                    [sub.id]
                  );
                } catch (delErr) {
                  console.error('Failed to delete subscription during resend:', delErr && delErr.message ? delErr.message : delErr);
                }
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
         WHERE user_id = $1 AND message IS NOT NULL AND message != ''
         ORDER BY created_at DESC 
         LIMIT 100`,
        [userId]
      );

      // Normalize timestamps to ISO strings so the client can reliably parse them
      const normalized = result.rows.map((r) => ({
        ...r,
        created_at: r.created_at ? new Date(r.created_at).toISOString() : null,
      }));

      res.json(normalized);
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
   * ✅ Mark all notifications as read for a user
   */
  markAllAsRead: async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      await db.query(
        `UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false`,
        [userId]
      );

      res.json({ success: true, message: "All notifications marked as read" });
    } catch (error) {
      console.error("Mark all as read error:", error.message || error);
      res.status(500).json({ error: "Server error" });
    }
  },

  /**
   * ✅ Delete a notification
   */
  deleteNotification: async (req, res) => {
    try {
      const userId = req.user?.id;
      const { id } = req.body;
      if (!userId || !id) return res.status(400).json({ error: "Invalid request" });

      const result = await db.query(
        `DELETE FROM notifications WHERE id = $1 AND user_id = $2 RETURNING id`,
        [id, userId]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ error: "Notification not found" });
      }

      res.json({ success: true, message: "Notification deleted" });
    } catch (error) {
      console.error("Delete notification error:", error.message || error);
      res.status(500).json({ error: "Server error" });
    }
  },

  /**
   * ✅ Delete all read notifications for a user
   */
  deleteAllReadNotifications: async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const result = await db.query(
        `DELETE FROM notifications WHERE user_id = $1 AND is_read = true`,
        [userId]
      );

      res.json({ success: true, message: `Deleted ${result.rowCount} read notifications` });
    } catch (error) {
      console.error("Delete all read notifications error:", error.message || error);
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
