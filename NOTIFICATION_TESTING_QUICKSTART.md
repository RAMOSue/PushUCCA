# 🚀 Quick Start - Run the Fixed Notification System

## Prerequisites
- PostgreSQL running locally
- Node.js and npm installed
- Server running on port 5000
- Client running on port 5173

---

## Step 1: Apply Database Migration (REQUIRED FIRST!)

Open terminal in project root and run:

```bash
psql -U postgres -d ucca -f DB_MIGRATION_NOTIFICATIONS.sql
```

**Expected Output:**
```
CREATE TABLE
CREATE INDEX
CREATE INDEX
ALTER TABLE
CREATE INDEX
CREATE INDEX
```

**Verify:** Open pgAdmin or psql and run:
```sql
SELECT * FROM push_subscriptions LIMIT 1;
-- Should show columns: id, user_id, endpoint, p256dh, auth, created_at, last_seen

SELECT * FROM notifications LIMIT 1;
-- Should show columns: id, user_id, message, type, is_delivered, delivered_at, is_read, channel, created_at
```

---

## Step 2: Start the Server

```bash
cd server
npm install
npm run start
```

**Expected Server Logs:**
```
✅ Database connected
🚀 Server running on http://localhost:5000
📦 Dependencies loaded: web-push, express, etc.
```

**Verify:** Open http://localhost:5000 in browser
- You should get a 404 (expected, this is API endpoint)
- Check console for any errors (should be none)

---

## Step 3: Start the Client

In a new terminal:

```bash
cd client
npm install
npm run dev
```

**Expected Client Logs:**
```
  VITE v5.x.x  ready in x ms
  ➜  Local:   http://localhost:5173/
  ➜  press h to show help
```

**Verify:** Open http://localhost:5173 in browser
- App should load without errors
- You should see Login page

---

## Step 4: Test Scenario 1 - Multi-Device Subscriptions

### Step 4a: Browser 1 (Borrower)
```
1. Open http://localhost:5173
2. Click "Create an account" if needed, or Log in as borrower
3. When prompted: ALLOW notifications permission
4. Check browser console (F12):
   - Should see: "✅ Subscription saved for user X"
   - Should see: "🔄 Fetching pending notifications..."
   - Should see: "✅ Pending notifications resend result"
```

### Step 4b: Verify Database
```bash
# In terminal or pgAdmin, run:
SELECT id, user_id, endpoint FROM push_subscriptions WHERE user_id = 4;
# Should show 1 row for Browser 1's subscription
```

### Step 4c: Browser 2 (Same Borrower, Different Device)
```
1. Open second private/incognito window: http://localhost:5173
2. Log in as the SAME borrower user
3. When prompted: ALLOW notifications permission
4. Check browser console (F12):
   - Should see same subscription logs as Browser 1
```

### Step 4d: Verify Multiple Subscriptions in Database
```bash
SELECT id, user_id, endpoint FROM push_subscriptions WHERE user_id = 4;
# Should now show 2 rows (same user_id, different endpoints)
# NOT 1 row that changed user_id
```

**✅ Test Passed:** If you see 2 different endpoints for same user_id, subscriptions are working!

---

## Step 5: Test Scenario 2 - Send Notification to Multiple Devices

### Step 5a: Send Test Notification
```bash
# In terminal, run curl command:
curl -X POST http://localhost:5000/api/notifications/test-notification \
  -H "Content-Type: application/json" \
  -d '{"userId": 4, "testMessage": "Test multi-device notification"}'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Notification sent successfully",
  "successCount": 2,
  "totalSubscriptions": 2,
  "notificationId": 42
}
```

### Step 5b: Both Borrower Browsers Should Receive Push
```
Browser 1 & Browser 2:
- Both should show desktop push notification pop-up
- Both notification bells should show the message
- Both browsers' notification lists should show it
```

### Step 5c: Verify is_delivered in Database
```bash
SELECT id, user_id, message, is_delivered, delivered_at FROM notifications 
WHERE user_id = 4 AND is_delivered = true
LIMIT 1;
# Should show is_delivered = true with a recent delivered_at timestamp
```

**✅ Test Passed:** If both devices got push simultaneously, multi-device is working!

---

## Step 6: Test Scenario 3 - Offline Notification Delivery

### Step 6a: Setup (2 Browsers Still Open)
```
Browser 1: http://localhost:5173 (Borrower logged in)
Browser 2: http://localhost:5173 (Borrower logged in)
```

### Step 6b: Close Browser 1 (Simulate Offline)
```
Browser 1: Close the tab or navigate away (simulate user going offline)
Browser 2: Keep open (simulate other device still online)
```

### Step 6c: Send Notification
```bash
curl -X POST http://localhost:5000/api/notifications/test-notification \
  -H "Content-Type: application/json" \
  -d '{"userId": 4, "testMessage": "Offline test message"}'
```

**Expected Response:**
```json
{
  "success": true,
  "successCount": 1,
  "totalSubscriptions": 2,
  "notificationId": 43
}
```

(Only Browser 2 got it; Browser 1 is closed)

### Step 6d: Verify Notification is Queued in Database
```bash
SELECT id, user_id, is_delivered, delivered_at FROM notifications 
WHERE user_id = 4 AND id = 43;

# Before Browser 1 comes back online, should show:
# id=43, is_delivered=true (because Browser 2 got it)
```

### Step 6e: Bring Browser 1 Back Online
```
Browser 1: Open http://localhost:5173 again and log in
```

**Expected:**
- Browser 1 should immediately receive the offline notification as push
- Browser 1's notification bell should show the message
- Browser 1's console should show resend logs

### Step 6f: Verify Database
```bash
SELECT id, user_id, is_delivered FROM notifications 
WHERE user_id = 4 AND id = 43;
# Should still show is_delivered = true (message was already queued and delivered)
```

**✅ Test Passed:** If Browser 1 got the message after coming back online, queuing works!

---

## Step 7: Test Scenario 4 - Pending Notification on First Login

### Step 7a: Manually Insert Pending Notification
```bash
# Using psql or pgAdmin:
INSERT INTO notifications (user_id, message, type, is_delivered, channel, created_at)
VALUES (4, 'Pending message inserted manually', 'test', false, 'push', NOW());

# Get the notification ID
SELECT id FROM notifications WHERE message = 'Pending message inserted manually';
# Note the id (e.g., 50)
```

### Step 7b: Close All Borrower Browsers
```
Browser 1 & Browser 2: Close both tabs
```

### Step 7c: Clear Browser Storage (Simulate Fresh Device)
```bash
# In Chrome DevTools:
# Settings → Application → Storage → Clear site data
```

### Step 7d: Log Back In as Borrower
```
1. Open http://localhost:5173
2. Log in as borrower (user_id = 4)
3. Allow notifications permission
```

**Expected:**
- Browser console should show: "🔄 Fetching pending notifications..."
- Browser should receive push notification for the manually inserted message
- Notification bell should show the message
- Browser console should show: "✅ Pending notifications resend result: ... resent: 1"

### Step 7e: Verify is_delivered Updated
```bash
SELECT id, is_delivered, delivered_at FROM notifications 
WHERE id = 50;  # The manually inserted one
# Should now show is_delivered = true with recent delivered_at timestamp
```

**✅ Test Passed:** If pending notifications are automatically delivered on login, queuing works!

---

## Step 8: Verify No Subscription Overwriting

### Step 8a: Check Current State
```bash
SELECT user_id, COUNT(*) as sub_count FROM push_subscriptions 
GROUP BY user_id;
# Should show 2 subscriptions for user 4 (from Tests 1-7)
```

### Step 8b: Log Out and Log Back In as Borrower
```
Browser 1: 
1. Click Settings → Logout
2. Wait 2 seconds
3. Log back in as same borrower
4. Allow notifications permission again
```

### Step 8c: Check Database Again
```bash
SELECT user_id, COUNT(*) as sub_count FROM push_subscriptions 
GROUP BY user_id;
# Should STILL show 2 subscriptions for user 4
# NOT reduced to 1
# The new subscription updated the existing row (same endpoint), not created duplicate
```

**✅ Test Passed:** If subscription count remained same, no overwriting occurred!

---

## Step 9: Full E2E Test with Staff

### Step 9a: Setup
```
Browser 1: Borrower logged in and subscribed (user_id = 4)
Browser 2: Staff logged in (user_id = 2)
```

### Step 9b: Staff Sends Borrow Request
```bash
# From Browser 2 (Staff):
# 1. Go to "Available Items" or similar
# 2. Borrow an item
# 3. Confirm request sent
```

**Expected:**
- Browser 1 (Borrower) should receive push notification
- Notification bell shows new borrow request
- Notification stays in DB

### Step 9c: Borrower Approves/Denies
```
Browser 1 (Borrower):
1. Click notification or go to "Borrow Requests"
2. Approve or deny the request
```

**Expected:**
- Staff should be notified (if approval notification is sent)
- No errors in console

**✅ Test Passed:** If full business logic works with new notification system, integration is complete!

---

## Troubleshooting During Testing

### Issue: No push notification appears
**Cause:** Service worker not registered or permission not granted
**Fix:** 
```bash
# In browser DevTools Console:
navigator.serviceWorker.getRegistrations().then(r => console.log(r));
# Should show 1 active ServiceWorkerRegistration
```

### Issue: "No push subscription found" error in server logs
**Cause:** Database migration not run or subscription endpoint is null
**Fix:**
```bash
# Verify migration:
psql -U postgres -d ucca -c "\d push_subscriptions"
# Should show all columns including endpoint

# Check if user has subscriptions:
SELECT * FROM push_subscriptions WHERE user_id = 4;
# If empty, user hasn't subscribed (permission not granted)
```

### Issue: Notification appears only once, not on both devices
**Cause:** Second device subscription not saved
**Fix:**
```bash
# Verify both subscriptions exist:
SELECT id, user_id, endpoint FROM push_subscriptions WHERE user_id = 4;
# Should show 2 rows before sending test notification
```

### Issue: is_delivered always remains false
**Cause:** Web push service failing silently; subscription may be expired
**Fix:**
```bash
# Check server logs for detailed errors
# Manually test web push (requires valid VAPID keys in .env):
npm run test-push  # If available

# Regenerate VAPID keys:
npx web-push generate-vapid-keys
# Copy to .env and restart server
```

### Issue: Resend pending doesn't work
**Cause:** `/api/notifications/pending` endpoint not available or not called
**Fix:**
```bash
# Test endpoint directly:
curl http://localhost:5000/api/notifications/pending \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
# Should return { success: true, pending: [...], resent: N }

# Check client logs:
# Browser DevTools Console → filter for "Pending"
# Should see: "🔄 Fetching pending notifications..."
```

---

## Summary of Expected Database State After All Tests

```bash
# Should have:
SELECT COUNT(*) FROM push_subscriptions WHERE user_id = 4;
# Result: 2 subscriptions for borrower (2 devices)

SELECT COUNT(*) FROM notifications WHERE is_delivered = true;
# Result: Multiple notifications with timestamps

SELECT COUNT(*) FROM notifications WHERE is_delivered = false AND created_at < NOW() - INTERVAL '1 hour';
# Result: 0 (all pending should have been retried)
```

---

## Cleanup After Testing

```bash
# To reset for fresh testing:

# Option 1: Delete test subscriptions
DELETE FROM push_subscriptions WHERE user_id = 4;

# Option 2: Delete all test notifications
DELETE FROM notifications WHERE user_id = 4 AND created_at > NOW() - INTERVAL '1 hour';

# Option 3: Reset entire tables (use with caution)
TRUNCATE TABLE notifications, push_subscriptions, users CASCADE;
```

---

## Next: Advanced Testing (Optional)

Once basic tests pass, try:

1. **Test with Real Notifications** (from business logic)
   - Create borrow request, approve item, etc.
   - Verify corresponding notifications appear

2. **Test Multiple Users**
   - Create 3+ users with subscriptions
   - Send notification to one, verify others don't receive it

3. **Test Service Worker Offline**
   - Use Chrome DevTools → Application → Service Workers → Offline
   - Send notification while simulated offline
   - Verify notification still queued in DB

4. **Test Different Browsers**
   - Repeat tests with Firefox, Safari, Edge
   - Each browser's endpoint is unique

5. **Load Test**
   - Send 100+ notifications to same user
   - Verify all queued and delivered correctly
   - Check database performance (indexes should help)

---

**✅ All tests passing? Your notification system is production-ready!**

For detailed technical documentation, see: `NOTIFICATION_SYSTEM_COMPLETE.md`
