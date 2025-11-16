# Push Notification System Setup & Debugging Guide

## Overview
This guide helps you set up and debug push notifications for the UCCA Borrowing System.

## Architecture
```
User Logs In (Client)
    ↓
App.jsx & Navbar.jsx initialize NotificationService
    ↓
Service Worker registers + User grants permission
    ↓
notificationService.subscribe() sends subscription to server
    ↓
Server saves in push_subscriptions table
    ↓
When staff/borrower sends test notification:
    - Server queries push_subscriptions table
    - Sends web push via web-push library
    - Browser receives push in service worker
    - Service worker displays desktop/mobile notification
```

## Step-by-Step Setup

### 1. Environment Variables
Make sure your `.env` file has these variables:

```env
# Server
VAPID_SUBJECT=mailto:your-email@example.com
VAPID_PUBLIC_KEY=your_public_key_here
VAPID_PRIVATE_KEY=your_private_key_here

# Client (.env.local or .env)
VITE_VAPID_PUBLIC_KEY=your_public_key_here
```

**Generate VAPID keys if you don't have them:**
```bash
cd server
npm install -g web-push
web-push generate-vapid-keys
```

### 2. Restart Server & Client

```bash
# Terminal 1: Server
cd server
npm start

# Terminal 2: Client
cd client
npm run dev
```

Watch for these console messages:
- Server: `✅ Database connected successfully`
- Client: `✅ Service Worker registered successfully`

### 3. Test the Flow

#### Step 1: Login as Borrower (User A)
1. Open `http://localhost:5173` in a browser tab
2. Login with a borrower account
3. Watch console for:
   - `✅ Service Worker registered successfully`
   - `🔔 NotificationBadge: Starting initialization`
   - Permission request popup → Click **Allow**
   - `📲 Subscribing user X to push notifications...`
   - `✅ Subscription saved on server`

#### Step 2: Login as Staff (User B)
1. Open `http://localhost:5173` in a **different browser tab or private window**
2. Login with a staff account
3. Go through the same permission flow as above
4. Verify subscription is saved

#### Step 3: Send Test Notifications

**From Staff Tab:**
1. Find "Notification Testing Panel"
2. Click **"Send Test Notification"**
3. Watch server console:
   ```
   📢 staff (ID: 2) sending test notification
   ✅ Found 2 target users: user1(borrower), admin1(admin)
     ✅ Notification sent to user1 (ID: 1)
     ✅ Notification sent to admin1 (ID: 3)
   📊 Test notification result: 2/2 successful
   ```

**In Borrower Tab:**
- Desktop notification appears at top-right
- Click to navigate to dashboard

---

## Debugging

### Check 1: Verify Subscriptions Are Saved

**From any logged-in user:**

```
GET /api/test-notifications/debug/subscriptions
```

**Example Response:**
```json
{
  "user": {
    "id": 1,
    "name": "John Doe",
    "role": "borrower"
  },
  "subscriptions": [
    {
      "id": 1,
      "user_id": 1,
      "endpoint": "https://wns2-bl2p.notify.windows.com/w/?token=...",
      "p256dh": "BJFGepkb6DlsokMX5Td_5EKMfWzhBK4MKKxl...",
      "auth": "PhF_u_5BZ9fILzJ-SFvCnw",
      "created_at": "2025-11-12T10:30:45Z",
      "last_seen": "2025-11-12T10:30:45Z"
    }
  ],
  "count": 1
}
```

**If `count: 0` or `subscriptions: []`:**
- Check browser console: Does it say `✅ Subscription saved on server`?
- Check if permission was granted: `Notification.permission === 'granted'`
- Check network tab in DevTools → Look for POST `/api/notifications/subscribe` → Check response status

### Check 2: View All Subscriptions (Admin Only)

```
GET /api/test-notifications/debug/all-subscriptions
```

**Example Response:**
```json
{
  "total": 3,
  "byRole": {
    "borrower": [
      {
        "user_id": 1,
        "name": "John Doe",
        "endpoint": "https://wns2-bl2p...",
        "created_at": "2025-11-12T10:30:45Z",
        "last_seen": "2025-11-12T10:30:45Z"
      }
    ],
    "staff": [
      {
        "user_id": 2,
        "name": "Jane Smith",
        "endpoint": "https://fcm.googleapis.com/...",
        "created_at": "2025-11-12T10:35:20Z",
        "last_seen": "2025-11-12T10:35:20Z"
      }
    ]
  }
}
```

### Check 3: Browser Console Logging

**All these should appear:**

```
✅ Service Worker registered successfully
✅ Service Worker is ready
🔔 NotificationBadge: Starting initialization
Current permission: granted
✅ Notification service initialized: true
📲 Subscribing user 1 to push notifications...
✅ New subscription created: {endpoint: "...", keys: {...}}
✅ Subscription saved on server: {success: true, message: "..."}
```

### Check 4: Network Tab in DevTools

**Look for POST requests:**

1. **`/api/notifications/subscribe`**
   - Status: `200 OK`
   - Request body:
     ```json
     {
       "endpoint": "https://...",
       "keys": { "p256dh": "...", "auth": "..." }
     }
     ```
   - Response: `{ "success": true, "message": "Subscription saved successfully" }`

2. **`/api/test-notifications/test-notification`**
   - Status: `200 OK`
   - Response:
     ```json
     {
       "success": true,
       "message": "Test notification sent to 2/2 users.",
       "targetCount": 2,
       "successCount": 2
     }
     ```

### Check 5: Server Console Logs

**When sending notification, you should see:**

```
📢 staff (ID: 2) sending test notification
✅ Found 2 target users: John Doe(borrower), Admin User(admin)
  ✅ Notification sent to John Doe (ID: 1)
  ✅ Notification sent to Admin User (ID: 3)
📊 Test notification result: 2/2 successful
```

**If you see ❌ instead of ✅:**
```
❌ No push subscription found for user 1
```

This means the subscription wasn't saved. Check steps above.

---

## Common Issues & Solutions

### Issue 1: "No push subscription found"
**Cause:** User didn't grant notification permission or subscription failed to save

**Solution:**
1. Check browser console for `✅ Subscription saved on server`
2. Clear browser cache: `Ctrl+Shift+Delete` → Clear all
3. Reload page and grant permission again
4. Check `/api/test-notifications/debug/subscriptions`

### Issue 2: Permission popup doesn't appear
**Cause:** Already denied, blocked by browser, or dismissed previously

**Solution:**
1. Chrome: Settings → Privacy → Site settings → Notifications → Find localhost → Remove
2. Firefox: Preferences → Privacy → Permissions → Clear exceptions for localhost
3. Edge: Settings → Privacy → Site permissions → Notifications → Manage → Remove localhost
4. Reload page and try again

### Issue 3: Notification sent but doesn't show
**Cause:** Service Worker issue or notification permission is "denied"

**Solution:**
1. Check if Service Worker is active:
   - DevTools → Application → Service Workers → Should show "active and running"
2. Check Notification permission:
   ```javascript
   // In browser console
   console.log(Notification.permission); // Should be "granted"
   ```
3. Restart browser completely (close all tabs)
4. Verify VAPID keys are correct in `.env`

### Issue 4: Multiple windows/tabs not receiving notifications
**Cause:** Each tab/window needs separate subscription if using private/incognito

**Solution:**
- Use regular tabs (not incognito) for staff
- Use regular tabs (not incognito) for borrower
- Ensure each login is in a separate browser tab/window

---

## Testing Checklist

- [ ] Server running and database connected
- [ ] Client running (`npm run dev`)
- [ ] `.env` files have correct VAPID keys
- [ ] User 1 (borrower) logged in, permission granted
- [ ] User 2 (staff) logged in, permission granted
- [ ] Check subscriptions saved: `/api/test-notifications/debug/subscriptions`
- [ ] Staff sends test notification
- [ ] Borrower receives desktop notification
- [ ] Click notification → Navigate to dashboard
- [ ] Borrower sends test notification
- [ ] Staff receives desktop notification
- [ ] Send due-soon notification → Also works

---

## Flow Diagram

```
Staff Dashboard                    Borrower Dashboard
    |                                   |
    +---> [Send Test Notification]     |
           |                            |
           v                            |
    POST /api/test-notifications       |
    /test-notification                 |
           |                            |
           v                            |
    Server finds all borrowers         |
           |                            |
           v                            |
    sendPushIfAvailable()              |
           |                            |
           v                            |
    Check push_subscriptions table     |
           |                            |
           v                            |
    Send via web-push library          |
           |                            |
           v                            |
    Browser receives push event        |
           |                            |
           v                            |
    Service Worker 'push' listener     |
           |                            |
           v                            |
    showNotification()                 |
           |                            |
           +----------> DESKTOP NOTIFICATION <--+
                        (top-right corner)       |
                                            Borrower sees it!
```

---

## Advanced Testing

### Test with Multiple Users

1. Create 3+ test accounts (mix of roles)
2. Login as each in separate browser windows
3. Send notifications from each
4. Verify all others receive them

### Test with Different Browsers

- Chrome/Chromium
- Firefox
- Edge
- Safari (if on Mac)

Each browser has different notification APIs and subscription endpoints.

### Monitor Push Events in Service Worker

Add to `client/public/service-worker.js`:

```javascript
self.addEventListener('push', function(event) {
  console.log('🔔 PUSH EVENT RECEIVED!', event.data.json());
  // ... existing code
});
```

Then check DevTools → Application → Service Workers → Messages

---

## Next Steps

Once basic notifications work:

1. Implement automatic due-date notifications in `cron/notificationScheduler.js`
2. Add notification preferences UI (user can opt-in/out)
3. Add notification history page
4. Implement notification actions (approve/decline from notification)

---

## Questions?

Check:
1. Browser console for `❌ Error` messages
2. Server console for `❌ Error` messages
3. Network tab for failed requests
4. `/api/test-notifications/debug/` endpoints for current state

