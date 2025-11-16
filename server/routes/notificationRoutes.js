const express = require("express");
const router = express.Router();
const notificationController = require("../controllers/notificationController");
const { ensureAuth } = require("../helpers/auth");
const db = require("../db"); // PostgreSQL connection

/**
 * ✅ Helper: Send push if user has subscription
 */
const sendPushIfAvailable = async ({ userId, title, message, type, data }) => {
  try {
    const subResult = await db.query(
      "SELECT * FROM push_subscriptions WHERE user_id = $1",
      [userId]
    );

    if (subResult.rows.length === 0) {
      console.warn(`⚠️ No push subscription found for user ${userId}`);
      return null;
    }

    await notificationController.sendPushToUser({
      userId,
      title,
      message,
      type,
      data,
    });

    return true;
  } catch (err) {
    console.error("❌ Error sending push:", err);
    return false;
  }
};

/**
 * ✅ Save push subscription
 * Frontend sends: { endpoint, keys: { p256dh, auth } }
 */
router.post("/subscribe", ensureAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const subscription = req.body;

    if (
      !subscription ||
      !subscription.endpoint ||
      !subscription.keys ||
      !subscription.keys.p256dh ||
      !subscription.keys.auth
    ) {
      console.warn("❌ Invalid subscription request:", subscription);
      return res.status(400).json({ error: "Invalid request" });
    }

    await notificationController.saveSubscription(userId, subscription);
    res.json({ success: true, message: "Subscription saved successfully" });
  } catch (err) {
    console.error("❌ Failed to save subscription:", err);
    res.status(500).json({ error: "Failed to save subscription" });
  }
});

/**
 * GET VAPID PUBLIC KEY
 * The client may request this so the VAPID key can be served at runtime
 */
router.get('/vapid-public-key', (req, res) => {
  try {
    const key = process.env.VAPID_PUBLIC_KEY || null;
    if (!key) return res.status(500).json({ error: 'VAPID key not configured' });
    res.json({ publicKey: key });
  } catch (err) {
    console.error('❌ VAPID key error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * ✅ Get user's notifications
 */
router.get("/", ensureAuth, notificationController.getNotifications);

/**
 * ✅ Resend pending notifications for logged-in user (called after login/subscribe)
 */
router.get('/pending', ensureAuth, notificationController.resendPendingForUserEndpoint);

// NOTE: The '/pending' route is handled above by resendPendingForUserEndpoint

/**
 * ✅ Mark notification as read
 */
router.post("/mark-read", ensureAuth, notificationController.markAsRead);

/**
 * ✅ Get unread count
 */
router.get("/unread-count", ensureAuth, notificationController.getUnreadCount);

// Test endpoints removed from production routes

module.exports = router;
