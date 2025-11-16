# 🏗️ Notification System - Architecture Overview

## High-Level Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    CLIENT BROWSER                               │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ React App (userContext.jsx)                              │  │
│  │ - On Login: Call notificationService.subscribe(userId)   │  │
│  │ - After Subscribe: Call notificationService.resendPending │  │
│  │ - Dispatch 'notifications:updated' event                 │  │
│  └───────────────────────┬──────────────────────────────────┘  │
│                          │                                       │
│                          ↓                                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Notification Service (notifications.js)                  │  │
│  │ - subscribe(userId)                                      │  │
│  │ - resendPending()     ← NEW                              │  │
│  │ - getNotifications()                                     │  │
│  │ - markAsRead()                                           │  │
│  │ - setupMessageListener()                                 │  │
│  └──────────┬───────────────────┬──────────────────────────┘  │
│             │                   │                               │
│      API Call: POST            API Call: GET                   │
│      /subscribe                /pending      ← NEW              │
│             │                   │                               │
│             ↓                   ↓                               │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Notification Bell UI (NotificationBell.jsx)              │  │
│  │ - Listen for 'notifications:updated' event               │  │
│  │ - Refresh notification list on event                     │  │
│  │ - Show unread count badge                                │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Service Worker (service-worker.js)                       │  │
│  │ - Receive push messages                                  │  │
│  │ - Display notifications                                  │  │
│  │ - Handle notification clicks                             │  │
│  │ - Post messages to client                                │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                   │
└─────────────────┬──────────────────────────────────────────────┘
                  │
                  │ HTTPS/WebPush
                  │
         ┌────────↓─────────┐
         │ Web Push Service │  (Browser's push service)
         │ (e.g., FCM, etc) │
         └─────────────────┘
                  ↑
                  │ WebPush API
                  │
┌─────────────────┴──────────────────────────────────────────────┐
│                    SERVER (Node.js/Express)                    │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Notification Routes (notificationRoutes.js)              │  │
│  │ - POST   /subscribe         → saveSubscription()         │  │
│  │ - GET    /pending           → resendPendingForUser()    │  │
│  │ - GET    /                  → getNotifications()         │  │
│  │ - POST   /mark-read         → markAsRead()              │  │
│  │ - GET    /unread-count      → getUnreadCount()          │  │
│  │ - POST   /test-notification → sendTestNotification()    │  │
│  └──────────────┬──────────────────────────────────────────┘  │
│                 │                                               │
│                 ↓                                               │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Notification Controller (notificationController.js)       │  │
│  │                                                            │  │
│  │ saveSubscription(userId, subscription)                   │  │
│  │   - INSERT ON CONFLICT (endpoint) DO UPDATE             │  │
│  │   - Allows multiple subscriptions per user              │  │
│  │   - Returns subscriptionId                              │  │
│  │                                                            │  │
│  │ sendPushToUser({userId, title, message, ...})           │  │
│  │   1. INSERT notification with is_delivered=false        │  │
│  │   2. Query ALL subscriptions for user                   │  │
│  │   3. LOOP through each subscription                     │  │
│  │      - Try webpush.sendNotification()                   │  │
│  │      - If 410/404: DELETE subscription (expired)        │  │
│  │      - Count success/failure                            │  │
│  │   4. If ANY succeeded: UPDATE is_delivered=true         │  │
│  │   5. If ALL failed: Notification stays queued           │  │
│  │   6. Return {success, successCount, failureCount}       │  │
│  │                                                            │  │
│  │ resendPendingForUser(userId) ← NEW                      │  │
│  │   1. Query notifications WHERE is_delivered=false       │  │
│  │   2. For each pending notification:                     │  │
│  │      - Try sendPushToUser() for ALL subscriptions       │  │
│  │   3. Return list of pending and results                 │  │
│  │                                                            │  │
│  │ [Other methods: getNotifications, markAsRead, etc.]      │  │
│  └──────────────┬──────────────────────────────────────────┘  │
│                 │                                               │
│                 ↓                                               │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ PostgreSQL Database                                      │  │
│  │                                                            │  │
│  │ push_subscriptions                                       │  │
│  │ ├─ id (PK)                                              │  │
│  │ ├─ user_id (FK) ← Multiple rows per user               │  │
│  │ ├─ endpoint (UNIQUE) ← One per device                  │  │
│  │ ├─ p256dh                                               │  │
│  │ ├─ auth                                                 │  │
│  │ ├─ created_at                                           │  │
│  │ └─ last_seen                                            │  │
│  │                                                            │  │
│  │ notifications                                            │  │
│  │ ├─ id (PK)                                              │  │
│  │ ├─ user_id (FK)                                         │  │
│  │ ├─ message                                              │  │
│  │ ├─ type                                                 │  │
│  │ ├─ is_delivered ← Track delivery status                │  │
│  │ ├─ delivered_at ← When delivered                        │  │
│  │ ├─ is_read ← User read it                              │  │
│  │ ├─ channel (push/email/sms)                            │  │
│  │ └─ created_at                                           │  │
│  │                                                            │  │
│  │ Indexes:                                                │  │
│  │ ├─ push_subscriptions(user_id)                         │  │
│  │ ├─ push_subscriptions(endpoint)                        │  │
│  │ ├─ notifications(user_id, is_delivered)               │  │
│  │ └─ notifications(created_at DESC)                      │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

---

## Key Data Flow Scenarios

### Scenario A: User Logs In on New Device

```
Step 1: Login Flow
┌─ Client requests /auth/login with credentials
└─ Server returns JWT token and user data

Step 2: Subscribe for Push
┌─ userContext.jsx calls notificationService.subscribe(userId)
├─ Client gets PushManager subscription from browser
├─ Client POSTs to /api/notifications/subscribe with:
│  └─ { userId, endpoint, keys: {p256dh, auth} }
├─ Server: INSERT INTO push_subscriptions ... ON CONFLICT DO UPDATE
│  └─ Creates or updates row by endpoint (not user_id)
└─ Result: First device (endpoint1) added to user 4's subscriptions

Step 3: Subscribe on Second Device
┌─ Same user logs in on laptop in incognito window
├─ userContext.jsx calls notificationService.subscribe(userId)
├─ Browser generates DIFFERENT PushManager subscription
├─ Client POSTs to /api/notifications/subscribe with:
│  └─ { userId, endpoint: endpoint2, keys: {...} }
├─ Server: INSERT ... ON CONFLICT (endpoint2) DO UPDATE
│  └─ Creates NEW row with endpoint2 (doesn't overwrite endpoint1)
└─ Result: Now 2 rows in push_subscriptions for user 4

Database State:
┌─────────────────────────────────────────────┐
│ push_subscriptions:                         │
│ ┌──┬────────┬──────────────┐               │
│ │id│user_id │endpoint      │               │
│ ├──┼────────┼──────────────┤               │
│ │ 1│   4    │endpoint1.... │               │
│ │ 2│   4    │endpoint2.... │               │
│ └──┴────────┴──────────────┘               │
└─────────────────────────────────────────────┘
✅ SUCCESS: No overwriting, both subscriptions exist
```

---

### Scenario B: Send Notification to Multi-Device User

```
Step 1: Staff Sends Notification
┌─ Staff clicks "Send Borrow Request" to borrower (user_id=4)
└─ Backend calls notificationController.sendPushToUser({
     userId: 4,
     title: "New Borrow Request",
     message: "Requested your guitar",
     type: "borrow_request"
   })

Step 2: Persistent Queue - Save to DB First
┌─ INSERT INTO notifications (...) 
│  VALUES (..., is_delivered=FALSE)
│  RETURNING id 42
└─ Notification 42 is now in DB, safe from loss

Step 3: Query All Subscriptions
┌─ SELECT * FROM push_subscriptions WHERE user_id=4
│  Result:
│  ├─ Row 1: id=1, endpoint=endpoint1, p256dh=..., auth=...
│  └─ Row 2: id=2, endpoint=endpoint2, p256dh=..., auth=...
└─ Found 2 subscriptions for this user

Step 4: Send to Each Subscription
┌─ Loop 1: Try webpush.sendNotification(endpoint1, payload)
│  └─ Success: Browser 1 receives push ✅
├─ Loop 2: Try webpush.sendNotification(endpoint2, payload)
│  └─ Success: Browser 2 receives push ✅
└─ Success count: 2/2

Step 5: Mark as Delivered
┌─ UPDATE notifications SET is_delivered=TRUE WHERE id=42
└─ Notification now marked as delivered in DB

Step 6: Return Response
└─ {
    success: true,
    successCount: 2,
    totalSubscriptions: 2,
    notificationId: 42
  }

Database State After:
┌─────────────────────────────────────────────────────────┐
│ notifications:                                          │
│ ┌────┬────────┬─────────────┬────────────┐             │
│ │id  │user_id │message      │is_delivered│             │
│ ├────┼────────┼─────────────┼────────────┤             │
│ │ 42 │   4    │New Borrow...│ TRUE       │             │
│ └────┴────────┴─────────────┴────────────┘             │
└─────────────────────────────────────────────────────────┘
✅ SUCCESS: Both devices got notification, DB marked delivered
```

---

### Scenario C: Offline User Receives Notification

```
Step 1: User Goes Offline
┌─ Browser 1 (Phone): User puts phone in flight mode
└─ User now has NO active push subscriptions (browser offline)

Step 2: Staff Sends Notification (Browser Offline)
┌─ notificationController.sendPushToUser({userId: 4, ...})
├─ Step 1: Save to DB
│  └─ INSERT notification with is_delivered=FALSE
├─ Step 2: Query subscriptions for user 4
│  └─ FOUND: endpoint1 and endpoint2
├─ Step 3: Try to send via webpush
│  └─ Both send attempts fail (device offline, no connection)
├─ Step 4: Check if ANY succeeded
│  └─ No (0 successes, 2 failures)
└─ Step 5: Leave notification as is_delivered=FALSE
   └─ Notification stays in DB for later retry!

Database State After Send (User Still Offline):
┌─────────────────────────────────────────────────────────────┐
│ notifications:                                              │
│ ┌────┬────────┬─────────────┬────────────┐                 │
│ │id  │user_id │message      │is_delivered│                 │
│ ├────┼────────┼─────────────┼────────────┤                 │
│ │ 42 │   4    │New Borrow...│ FALSE      │ ← Still queued! │
│ └────┴────────┴─────────────┴────────────┘                 │
└─────────────────────────────────────────────────────────────┘

Step 3: User Comes Back Online
┌─ User opens phone and logs in to app
├─ Browser registers push subscription again
├─ Client calls notificationService.resendPending()
├─ Client POSTs to /api/notifications/pending
└─ Server calls resendPendingForUser(userId=4)

Step 4: Server Retries Pending Notifications
┌─ Query: SELECT * FROM notifications WHERE user_id=4 AND is_delivered=FALSE
│  └─ Found notification 42 (the one from step 2!)
├─ For each pending:
│  ├─ Query all active subscriptions for user 4
│  ├─ Send to each subscription (now user is online)
│  └─ Both succeed! ✅
└─ Update: is_delivered=TRUE, delivered_at=NOW()

Step 5: User Receives Push on Device
┌─ Device now online, receives push notification
├─ Desktop notification pop-up appears
├─ Service worker posts message to client
└─ Notification bell shows message ✅

Database State After Resend:
┌─────────────────────────────────────────────────────────────────┐
│ notifications:                                                  │
│ ┌────┬────────┬─────────────┬────────────┬────────────────────┐ │
│ │id  │user_id │message      │is_delivered│delivered_at        │ │
│ ├────┼────────┼─────────────┼────────────┼────────────────────┤ │
│ │ 42 │   4    │New Borrow...│ TRUE       │2025-11-13 10:05 AM│ │
│ └────┴────────┴─────────────┴────────────┴────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
✅ SUCCESS: Offline message not lost, delivered when user came online
```

---

### Scenario D: Failed Subscription Cleaned Up

```
Step 1: Send to User with Expired Subscription
┌─ User's subscription endpoint has expired (e.g., account deleted)
├─ webpush.sendNotification(expired_endpoint, payload) throws error
└─ Error status code: 410 (Gone)

Step 2: Check Error Status
┌─ if (err.statusCode === 410 || err.statusCode === 404)
├─ This means endpoint is permanently invalid
└─ Should remove this subscription (but keep notification!)

Step 3: Clean Up Subscription (Not Notification)
┌─ DELETE FROM push_subscriptions WHERE id=1
│  └─ Remove expired subscription, don't try to use it again
├─ Notification stays in DB as is_delivered=FALSE (if all failed)
└─ Next attempt will skip this dead endpoint

Step 4: Result
┌─ push_subscriptions table updated (rows removed for expired)
├─ notifications table UNCHANGED (notifications never deleted)
└─ On next user login, new subscription created automatically
   └─ Notification can now be retried to new subscription

Database State After:
┌─────────────────────────────────────────────┐
│ push_subscriptions:                         │
│ ┌──┬────────┬──────────────┐               │
│ │id│user_id │endpoint      │               │
│ ├──┼────────┼──────────────┤               │
│ │   (EMPTY - expired one removed)          │
│ └──┴────────┴──────────────┘               │
│                                             │
│ notifications: (unchanged)                 │
│ ┌────┬────────┬─────────────────────┐     │
│ │id  │user_id │is_delivered         │     │
│ ├────┼────────┼─────────────────────┤     │
│ │ 42 │   4    │ FALSE (still there!)│     │
│ └────┴────────┴─────────────────────┘     │
└─────────────────────────────────────────────┘
✅ SUCCESS: Only expired subscription removed, notification preserved
```

---

## Request/Response Examples

### POST /api/notifications/subscribe
**Client Request:**
```json
{
  "userId": 4,
  "subscription": {
    "endpoint": "https://fcm.googleapis.com/...",
    "keys": {
      "p256dh": "base64encodedkey...",
      "auth": "base64encodedauth..."
    }
  }
}
```

**Server Response:**
```json
{
  "success": true,
  "message": "Subscription saved",
  "subscriptionId": 42
}
```

**Database Result:**
```sql
-- New row inserted with unique endpoint
INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
VALUES (4, 'https://fcm.googleapis.com/...', 'base64...', 'base64...')
ON CONFLICT (endpoint) DO UPDATE SET last_seen = CURRENT_TIMESTAMP;
```

---

### GET /api/notifications/pending
**Client Request:**
```bash
GET /api/notifications/pending
Authorization: Bearer JWT_TOKEN
```

**Server Response:**
```json
{
  "success": true,
  "pending": [
    {
      "id": 42,
      "userId": 4,
      "message": "New Borrow Request",
      "type": "borrow_request",
      "createdAt": "2025-11-13T10:00:00Z"
    },
    {
      "id": 43,
      "userId": 4,
      "message": "Item Returned",
      "type": "return_notification",
      "createdAt": "2025-11-13T10:05:00Z"
    }
  ],
  "resent": 2,
  "results": [
    { "notificationId": 42, "success": true, "successCount": 2 },
    { "notificationId": 43, "success": true, "successCount": 2 }
  ]
}
```

**Database Result:**
```sql
-- All pending notifications marked as delivered
UPDATE notifications SET is_delivered = TRUE 
WHERE user_id = 4 AND id IN (42, 43);
```

---

### sendPushToUser Controller Call
**Input:**
```javascript
{
  userId: 4,
  title: "New Borrow Request",
  message: "Staff requested your items",
  type: "borrow_request",
  data: { url: "/my-borrowed-items" }
}
```

**Process:**
```
1. INSERT notification (is_delivered=false)
2. SELECT all subscriptions for user 4
3. LOOP through subscriptions:
   - Try webpush.sendNotification()
4. If ANY success: UPDATE is_delivered=true
5. If ALL fail: Leave as is_delivered=false
```

**Output:**
```javascript
{
  success: true,           // At least one succeeded
  successCount: 2,         // Successful sends
  failureCount: 0,         // Failed sends
  notificationId: 42
}
```

---

## Summary of Changes by Component

| Component | Change | Impact |
|-----------|--------|--------|
| Database Schema | Added is_delivered, delivered_at, is_read columns | Enables persistent queue and delivery tracking |
| push_subscriptions | Added endpoint UNIQUE constraint | Prevents duplicate subscriptions from same device |
| sendPushToUser | Always save notification first | Prevents message loss when offline |
| sendPushToUser | Loop through ALL subscriptions | Supports multiple devices per user |
| sendPushToUser | Remove only on 410/404 | Keeps notifications queued for retry |
| resendPendingForUser | NEW function | Retries undelivered notifications |
| /api/notifications/pending | NEW endpoint | Triggers resend on client login |
| userContext.jsx | Call resendPending after subscribe | Auto-triggers offline notification delivery |
| NotificationBell.jsx | Listen for 'notifications:updated' | UI refreshes without page reload |

---

## Performance Characteristics

### Subscription Lookup
- **Query:** `SELECT * FROM push_subscriptions WHERE user_id = ?`
- **Index:** `idx_push_subscriptions_user_id`
- **Speed:** O(log n) - milliseconds for thousands of subscriptions

### Pending Notification Query
- **Query:** `SELECT * FROM notifications WHERE user_id = ? AND is_delivered = false`
- **Index:** `idx_notifications_user_is_delivered`
- **Speed:** O(log n) - milliseconds even with millions of notifications

### Send to Multiple Devices
- **Time:** ~100ms per device (network-dependent)
- **Parallel:** Independent webpush calls (can be parallelized in future)
- **Backpressure:** None; notifications queued in DB if all fail

### Database Size Estimate
- **Subscriptions:** ~1 KB per row → 1MB for 1M subscriptions
- **Notifications:** ~500 bytes per row → 500MB for 1M notifications
- **Retention:** Indefinite (old notifications can be archived in future)
- **Indexes:** ~10% of table size

---

## Error Scenarios & Recovery

| Scenario | Behavior | Recovery |
|----------|----------|----------|
| User offline when notification sent | Notification queued in DB (is_delivered=false) | Delivered on login via /pending |
| Push endpoint expired (410/404) | Endpoint deleted from DB | Subscription recreated on next login |
| Web push service temporarily unavailable | Notification stays queued | Retried on next send attempt or user login |
| User denies notification permission | No subscription created | Can still receive via other channels (future) |
| Service worker fails to register | No push capability | User notified, can still see notifications in bell |
| Database connection lost | Operation fails with error | Retry logic in client/server handles gracefully |

---

## Timeline & Deployment

```
Pre-Deployment Checks:
  ├─ Run DB migration
  ├─ Verify schema created
  └─ Test local subscriptions

Deployment:
  ├─ Deploy server code
  ├─ Deploy client code
  ├─ Monitor logs for errors
  └─ Test with 2+ browsers

Post-Deployment:
  ├─ Run full test suite
  ├─ Monitor notification success rate
  ├─ Monitor database growth
  └─ Verify no lost notifications
```

---

**Ready to deploy! 🚀**

For step-by-step testing: See `NOTIFICATION_TESTING_QUICKSTART.md`
For technical details: See `NOTIFICATION_SYSTEM_COMPLETE.md`
For implementation checklist: See `IMPLEMENTATION_CHECKLIST.md`
