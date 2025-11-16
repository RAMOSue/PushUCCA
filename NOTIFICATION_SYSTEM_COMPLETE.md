# 🔔 Notification System - Complete Implementation Summary

## Overview
This document explains the fixes made to the web push notification system to support:
- ✅ Multiple subscriptions per user (one per device)
- ✅ Persistent notification queue for offline users
- ✅ Automatic resend of pending notifications on login
- ✅ No overwriting of subscriptions from other devices
- ✅ Automatic subscription after login (no manual button required)

---

## Root Causes Fixed

### Problem 1: Subscriptions Being Overwritten
**Before:** Only 1 row in `push_subscriptions` table per user; logging in from another device overwrote the existing subscription.
**After:** Each endpoint is UNIQUE in DB; INSERT ON CONFLICT ensures same device doesn't create duplicates but different devices get separate rows.

### Problem 2: Notifications Lost When Offline
**Before:** If user was offline when notification was sent, it was never retried; the user lost it forever.
**After:** ALL notifications are saved to DB with `is_delivered = false`. When user logs back in, `GET /api/notifications/pending` triggers resend of undelivered notifications.

### Problem 3: No Multi-Device Support
**Before:** System only supported one subscription per user; multiple devices were not considered.
**After:** Schema allows multiple `push_subscriptions` rows per user_id; sendPushToUser loops through ALL subscriptions and sends to each device.

### Problem 4: No Retry Mechanism
**Before:** No way to retry notifications for users who came back online.
**After:** Client calls `notificationService.resendPending()` after login, which calls `GET /api/notifications/pending` and server retries all undelivered notifications.

---

## Database Schema Changes

### Migration SQL
File: `DB_MIGRATION_NOTIFICATIONS.sql`

**Key Changes:**
```sql
-- 1. Ensure push_subscriptions allows multiple rows per user
-- endpoint UNIQUE prevents exact duplicate subscriptions
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT UNIQUE NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Add indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_endpoint ON push_subscriptions(endpoint);

-- 3. Add delivery tracking columns to notifications table
ALTER TABLE IF EXISTS notifications
  ADD COLUMN IF NOT EXISTS is_delivered BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE;

-- 4. Add indexes for pending notification queries
CREATE INDEX IF NOT EXISTS idx_notifications_user_is_delivered 
  ON notifications(user_id, is_delivered);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
```

**How to Run:**
```bash
psql -U postgres -d ucca -f DB_MIGRATION_NOTIFICATIONS.sql
```

---

## Backend Code Changes

### File 1: `server/controllers/notificationController.js`

#### Key Methods:

##### `saveSubscription(userId, subscription)`
- **What it does:** Saves a push subscription from the client
- **Key Fix:** Uses `INSERT ON CONFLICT (endpoint) DO UPDATE SET` to allow multiple subscriptions per user without duplicates
- **Logs:** Shows when subscription is created/updated and which device

##### `sendPushToUser({ userId, title, message, type, data })`
- **What it does:** Sends a notification to a specific user
- **Key Steps:**
  1. ALWAYS save notification to DB with `is_delivered = false`
  2. Query ALL subscriptions for the user (multiple devices)
  3. Send to each subscription via webpush
  4. Remove 410/404 expired subscriptions (but keep notification in DB)
  5. Update notification `is_delivered = true` if ANY send succeeded
  6. If ALL fail or no subscriptions: notification stays in DB as undelivered for later retry
- **Key Fix:** Sends to ALL subscriptions, not just one; marks notification undelivered if all fail
- **Logs:** Shows how many subscriptions found, success/fail counts per device

##### `resendPendingForUser(userId)`
- **What it does:** Retries delivery of undelivered notifications for a user
- **Called When:** User logs in or subscribes (via client calling `/api/notifications/pending`)
- **Key Fix:** Finds all undelivered notifications and tries each again to all current subscriptions
- **Returns:** Count of successfully resent, list of pending notifications
- **Logs:** Shows how many pending notifications found and how many successfully resent

##### `resendPendingForUserEndpoint(req, res)`
- **What it does:** Express route handler for `/api/notifications/pending`
- **Called by:** Frontend after login to trigger pending resend

#### Code Highlights:
```javascript
// NOTE: Using INSERT ON CONFLICT to allow multiple subscriptions per user
// Different devices (different endpoints) create separate rows
// Same device re-subscribing updates the existing row (last_seen)
INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
VALUES ($1, $2, $3, $4)
ON CONFLICT (endpoint) DO UPDATE SET last_seen = CURRENT_TIMESTAMP;

// NOTE: Send to ALL subscriptions for the user (multiple devices)
for (const sub of subscriptions) {
  try {
    await webpush.sendNotification(...);
    successCount++;
  } catch(err) {
    if (err.statusCode === 410 || 404) {
      // Only remove expired subscriptions
      DELETE FROM push_subscriptions WHERE id = $1;
    }
  }
}

// NOTE: Update is_delivered based on success (not all or nothing)
if (successCount > 0) {
  UPDATE notifications SET is_delivered = true;
} else if (subscriptions.length > 0) {
  // Subscriptions exist but all failed - stay queued for retry
}
```

### File 2: `server/routes/notificationRoutes.js`

**New Endpoint Added:**
```javascript
// GET /api/notifications/pending
// Triggers resend of undelivered notifications for logged-in user
// Called by client after login or subscription
router.get('/pending', ensureAuth, notificationController.resendPendingForUserEndpoint);
```

**Existing Endpoints (Updated):**
- POST `/api/notifications/subscribe` — Unchanged (still upserts with INSERT ON CONFLICT)
- GET `/api/notifications` — Now returns `is_delivered, is_read` fields
- POST `/api/notifications/mark-read` — Uses `is_read` column
- GET `/api/notifications/unread-count` — Counts where `is_read = false`

---

## Frontend Code Changes

### File 1: `client/src/services/notifications.js`

#### New Method:
```javascript
async resendPending() {
  // Called after login to trigger server to resend undelivered notifications
  // Returns { success, pending: [...], resent, results: [...] }
  const response = await axios.get("/api/notifications/pending");
  return response.data;
}
```

#### Key Changes in `subscribe()`:
- Added comment explaining INSERT ON CONFLICT behavior on server
- Ensures VAPID key is fetched from server if not available at build-time

### File 2: `client/context/userContext.jsx`

#### Change in Login Flow:
```javascript
// After successful auto-subscribe, also resend pending
await notificationService.subscribe(data.id);

// NEW: Trigger resend of queued notifications
const pendingResp = await notificationService.resendPending();
window.dispatchEvent(new Event('notifications:updated')); // Notify UI to refresh
```

### File 3: `client/src/components/NotificationBell.jsx`

#### Change in Initialization:
```javascript
// Listen for 'notifications:updated' event from userContext
const onPendingUpdate = () => {
  fetchNotifications();
  fetchUnreadCount();
};
window.addEventListener('notifications:updated', onPendingUpdate);
```

---

## How It Works - End-to-End Flow

### Scenario 1: User Logs In on New Device
1. Client registers service worker and calls `PushManager.subscribe()`
2. Client POSTs subscription to `/api/notifications/subscribe`
3. Server: `INSERT ON CONFLICT (endpoint) DO UPDATE SET user_id=$1` → Creates new row with new endpoint
4. Server stores subscription for this device (old device's subscription still in DB)
5. Client calls `/api/notifications/pending` to resend any queued notifications
6. Server queries undelivered notifications and retries sending to all subscriptions (all devices get them)

### Scenario 2: User is Offline When Notificationis Sent
1. Staff sends notification → Server calls `sendPushToUser(borrowerId)`
2. Server saves notification with `is_delivered = false`
3. User's device has no active subscriptions (offline) → Send returns queued=true
4. Notification stays in DB marked as undelivered
5. User goes online → Logs in → Calls `/api/notifications/pending`
6. Server finds undelivered notifications and retries sending them
7. User's device receives push notification

### Scenario 3: Send to User with Multiple Devices
1. User logs in on Phone, Laptop, Office PC → 3 subscriptions in DB
2. Staff sends notification → `sendPushToUser()` queries all 3 subscriptions
3. Server tries sending to each device via webpush
4. All 3 devices receive push notification independently
5. Notification marked as `is_delivered = true` (if at least 1 succeeded)

---

## Testing Checklist

### ✅ Test 1: Multiple Subscriptions Per User
```bash
# Setup:
# 1. Start server: npm run start
# 2. Open two different browsers (or private windows) for same user
# 3. Log in as borrower in both

# Verify:
# In DB: SELECT * FROM push_subscriptions WHERE user_id=4;
# Should see 2 rows with same user_id but different endpoints
```

### ✅ Test 2: Notifications to Multiple Devices
```bash
# Setup:
# 1. Both browsers logged in as same borrower (2 subscriptions)
# 2. Open staff browser, send test notification to borrower

# Verify:
# - Both borrower browsers receive push pop-up simultaneously
# - Both browsers' notification bells show the new notification
# - DB: SELECT * FROM notifications WHERE user_id=4;
#   Should show is_delivered=true
```

### ✅ Test 3: Offline Notification Delivery
```bash
# Setup:
# 1. Start server and client
# 2. Log in as borrower
# 3. CLOSE browser (simulate offline)
# 4. Open staff browser, send notification to borrower

# Verify:
# - DB: SELECT * FROM notifications WHERE user_id=4 AND is_delivered=false;
#   Should show the notification with is_delivered=false
# 5. Open borrower browser again and log in

# Verify:
# - Borrower receives push notification for the pending message
# - Notification bell shows the message
# - DB: notification now has is_delivered=true
```

### ✅ Test 4: Auto-Subscribe on Login
```bash
# Setup:
# 1. Start server and client
# 2. Clear browser storage (Cmd+Shift+Del → Cookies and Cached Files)
# 3. Log in as user

# Verify:
# - Browser allows notification permission prompt (auto-requested)
# - Permit notifications
# - DB: SELECT * FROM push_subscriptions WHERE user_id=X;
#   Should show new subscription row for this device
# - DevTools Console should show:
#   "✅ Subscription saved on server"
#   "🔔 Pending notifications resend result"
```

### ✅ Test 5: Pending Notification Resend
```bash
# Setup:
# 1. Server running, user logged in
# 2. Manually insert a pending notification:
#    INSERT INTO notifications (user_id, message, type, is_delivered, channel, created_at)
#    VALUES (4, 'Test pending message', 'test', false, 'push', NOW());
# 3. Send test notification from staff to borrower
#    (Confirm it's now is_delivered=false in DB because borrower is not subscribed)
# 4. Now borrower logs in (or re-subscribes)

# Verify:
# - Borrower should receive the pending notification as push
# - Notification bell should show it
# - DB: notification now has is_delivered=true and delivered_at timestamp
```

### ✅ Test 6: No Subscription Overwriting
```bash
# Setup:
# 1. Browser 1: Log in as staff (creates sub_id=1 for staff)
# 2. Browser 2: Log in as borrower (creates sub_id=2 for borrower)
# 3. Browser 1: Log out
# 4. Browser 1: Log in as staff again

# Verify:
# - DB: SELECT * FROM push_subscriptions;
#   Should still have 2 rows (sub_id=1 updated, sub_id=2 unchanged)
#   NOT 1 row with everything switched
# - Both users still receive notifications independently
```

---

## Key Design Decisions

### 1. INSERT ON CONFLICT (endpoint) DO UPDATE
- **Why:** Ensures same device never creates duplicate subscriptions; allows different devices per user
- **Result:** Multiple rows per user, one per endpoint (device)

### 2. Always Save Notifications to DB First
- **Why:** Persistent queue for offline users; no message ever lost
- **Result:** is_delivered tracks whether push was successful; if false, will be retried

### 3. Remove Subscriptions Only on 410/404
- **Why:** Other errors are temporary; don't assume subscription is dead
- **Result:** Reduced false positives when push service is temporarily unavailable

### 4. Auto-Subscribe on Login (No Manual Button)
- **Why:** Better UX; most users want notifications and never explicitly opt in
- **Result:** Users get subscribed automatically once they grant permission

### 5. Client Calls Resend After Subscribe
- **Why:** Ensures pending notifications are delivered as soon as device is online
- **Result:** Notifications appear in bell UI within seconds of login, not hours later

---

## Logging Output - What to Expect

### Server Logs (Successful Flow):
```
📝 Notification created: ID=42, User=4, Type=test
🔍 Found 2 subscription(s) for user 4
✅ Push sent to subscription 1
✅ Push sent to subscription 2
✅ Notification 42 marked as delivered

🔄 Checking for pending notifications for user 4...
📌 Found 3 pending notification(s) for user 4
✅ Resent pending notification 39
✅ Resent pending notification 40
✅ Resent pending notification 41
📊 Resend result: 3/3 notifications sent
```

### Client Logs (Successful Flow):
```
✅ Subscription saved for user 4: endpoint=https://...
🔄 Fetching pending notifications...
✅ Pending notifications resend result: {success: true, pending: [...], resent: 3}
```

---

## Troubleshooting

### Issue: "No push subscription found for user X"
**Cause:** User hasn't subscribed or subscription was deleted (expired).
**Fix:** Ensure user logs in after permission is granted; check `/push_subscriptions` table for user_id rows.

### Issue: Notification doesn't appear in bell UI
**Cause:** `notifications:updated` event not fired or NotificationBell not listening.
**Fix:** Check browser DevTools console for "notifications:updated" events; confirm NotificationBell has listener.

### Issue: Multiple subscriptions not appearing
**Cause:** Endpoints from different devices are somehow identical (unlikely).
**Fix:** Check browser's Service Worker page; ensure each browser has registered a unique SW.

### Issue: Pending notifications not resending
**Cause:** `/api/notifications/pending` endpoint not called or returning empty list.
**Fix:** Check `resendPending()` in client console logs; check DB for undelivered rows.

---

## Summary of Files Changed

| File | Changes | Reason |
|------|---------|--------|
| `DB_MIGRATION_NOTIFICATIONS.sql` | Created | Schema updates for multiple subscriptions and delivery tracking |
| `server/controllers/notificationController.js` | Major rewrite | Send to all subscriptions, resend pending, improved logging |
| `server/routes/notificationRoutes.js` | Added GET /pending | Endpoint to trigger resend on login |
| `client/src/services/notifications.js` | Added resendPending() | Fetch pending after login, better VAPID handling |
| `client/context/userContext.jsx` | Call resendPending after subscribe | Ensure queued notifications are delivered after login |
| `client/src/components/NotificationBell.jsx` | Added event listener | Refresh UI when pending resend is triggered |

---

## Next Steps (Optional Enhancements)

1. **Periodic Resend Cron Job** — Background worker to retry pending notifications every 10 minutes for users not currently online
2. **Admin Debug Dashboard** — View all subscriptions and pending notifications in UI
3. **Delivery Analytics** — Track success rates, failures by device, retry counts
4. **Rate Limiting** — Prevent spam when resending many pending notifications
5. **Selective Retry** — Let users choose which notifications to receive (do not disturb hours, etc.)

---

## Questions & Support

- **"Why not use a message queue like RabbitMQ?"** Simple PostgreSQL queue is sufficient for this use case; avoids external dependency.
- **"Will offline users get notifications?"** Only if they come back online; push service retains messages for ~24h.
- **"Can I test locally without VAPID keys?"** Yes, but push won't work; set fake keys in .env.
- **"How often are pending notifications retried?"** On login and whenever resendPending() is called; optional cron job can add periodic retries.

---

**Last Updated:** November 13, 2025
**Status:** ✅ Ready for Production
