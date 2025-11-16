# 🚀 Quick Start Commands

## 1. Restart Everything

```bash
# Terminal 1: Stop server (Ctrl+C if running)
cd server
npm start

# Watch for: ✅ Database connected successfully
# Watch for: 🚀 Server running at http://localhost:8000
```

```bash
# Terminal 2: Stop client (Ctrl+C if running)
cd client
npm run dev

# Watch for: (in browser console) ✅ Service Worker registered successfully
```

---

## 2. Test via Setup Page

```bash
# Open in browser:
http://localhost:5173/notification-setup.html

# You should see:
# ✅ Service Worker: Active
# ❌ Permission: Default
# ❌ Current User: Not logged in
```

---

## 3. Login & Grant Permission

**In setup.html:**
- Click [Refresh Status]
- See "Current User: Not logged in"

**Open new tab:**
```bash
http://localhost:5173
# Login as any user (staff, borrower, or admin)
# Stay logged in
```

**Back to setup.html:**
- Click [Refresh Status]
- Now see your name and role

**Request Permission:**
- Click [🔔 Request Permission]
- Browser shows popup → Click "Allow"
- Console shows: ✅ Permission GRANTED

**Check Subscription:**
- Click [👤 My Subscription]
- See subscription details in console

---

## 4. Bulk Subscribe All Users (Admin Only)

**If logged in as Admin:**
```bash
# In setup.html, click:
[📌 Bulk Demo Subscribe (Admin)]

# Console shows:
# 🔔 [ADMIN] Starting bulk demo subscription for testing...
# ✅ Found 4 users to subscribe
# ✅ Subscription created for John (borrower, ID: 1)
# ✅ Subscription created for Jane (staff, ID: 7)
# 📊 Bulk subscription complete: 4/4 successful
```

---

## 5. Send Test Notifications

**In setup.html:**
```bash
# Click:
[🧪 Send Test Notification]

# Console shows:
# 📢 staff (ID: 7) sending test notification
# ✅ Found 2 target users: borrower, admin
#   ✅ Notification sent to borrower (ID: 4)
#   ✅ Notification sent to admin (ID: 1)
# 📊 Test notification result: 2/2 successful
```

**Or:**
```bash
# Click:
[⚠️ Send Due Soon]

# Same process but with due-soon message
```

---

## 6. Check All Subscriptions (Admin)

```bash
# In setup.html, click:
[👥 All Subscriptions (Admin)]

# Console shows JSON with all users and subscription status:
# {
#   "total": 4,
#   "byRole": {
#     "borrower": [{user_id: 1, name: "John", ...}],
#     "staff": [{user_id: 7, name: "Jane", ...}],
#     "admin": [{user_id: 1, name: "Admin", ...}]
#   }
# }
```

---

## 7. Direct API Calls (Advanced)

### Check Your Subscription
```bash
curl -X GET http://localhost:8000/api/test-notifications/debug/subscriptions \
  --cookie "your_auth_cookie"

# Returns:
# {
#   "user": { "id": 7, "name": "Jane", "role": "staff" },
#   "subscriptions": [{ "endpoint": "...", "created_at": "..." }],
#   "count": 1
# }
```

### Check All Subscriptions (Admin)
```bash
curl -X GET http://localhost:8000/api/test-notifications/debug/all-subscriptions \
  --cookie "your_auth_cookie"

# Returns all users' subscriptions by role
```

### Send Test Notification
```bash
curl -X POST http://localhost:8000/api/test-notifications/test-notification \
  --cookie "your_auth_cookie" \
  -H "Content-Type: application/json"

# Returns:
# {
#   "success": true,
#   "message": "Test notification sent to 2/2 users.",
#   "targetCount": 2,
#   "successCount": 2
# }
```

### Bulk Subscribe (Admin)
```bash
curl -X POST http://localhost:8000/api/test-notifications/bulk-subscribe-demo \
  --cookie "your_auth_cookie" \
  -H "Content-Type: application/json"

# Returns:
# {
#   "success": true,
#   "message": "Mock subscriptions created for 4/4 users",
#   "count": 4,
#   "total": 4
# }
```

---

## 8. View Database

```bash
# Open psql
psql -U postgres -d ucca

# Check subscriptions
SELECT u.id, u.name, u.role, COUNT(ps.id) as subscriptions
FROM users u
LEFT JOIN push_subscriptions ps ON u.id = ps.user_id
GROUP BY u.id, u.name, u.role;

# Check notifications sent
SELECT u.name, n.type, COUNT(*) as count
FROM notifications n
JOIN users u ON n.user_id = u.id
GROUP BY u.name, n.type;

# Delete all subscriptions (if needed)
DELETE FROM push_subscriptions;

# Check with:
SELECT COUNT(*) FROM push_subscriptions;
```

---

## 9. Clear Browser & Restart (If Issues)

```bash
# Terminal 1: Ctrl+C (stop server)
# Terminal 2: Ctrl+C (stop client)

# Browser: Ctrl+Shift+Delete (clear cache)
# Browser: Close completely

# Then:
cd server && npm start
cd client && npm run dev

# Reload: http://localhost:5173
```

---

## 10. Expected Console Output

### Server Console
```
🚀 Server running at http://localhost:8000
✅ Database connected successfully

[When sending notification]
📢 staff (ID: 7) sending test notification
✅ Found 2 target users: [ 'Runard Ramos(admin)', 'borrower(borrower)' ]
  ✅ Notification sent to Runard Ramos (ID: 1)
  ✅ Notification sent to borrower (ID: 4)
📊 Test notification result: 2/2 successful
```

### Browser Console
```
✅ Service Worker registered successfully
✅ Service Worker is ready
🔔 NotificationBadge: Starting initialization
📲 Subscribing user 7 to push notifications...
✅ Subscription saved on server: {success: true}
```

---

## 11. Troubleshooting

### "No push subscription found"
```bash
# Fix 1: Login to setup.html
# Fix 2: Click "Request Permission"
# Fix 3: Click "Bulk Demo Subscribe" (if admin)
# Fix 4: Try sending notification again
```

### "Permission: Default"
```bash
# Fix: Click "Request Permission" button and allow in browser
```

### "Service Worker: Not registered"
```bash
# Fix 1: Hard refresh: Ctrl+Shift+R
# Fix 2: Clear cache: Ctrl+Shift+Delete
# Fix 3: Close browser completely and reopen
```

### "Current User: Not logged in"
```bash
# Fix: Login in another tab first, then refresh setup.html status
```

---

## 12. Success Indicators

✅ Setup is working if you see:
- Status shows current user logged in
- Permission is "Granted" after clicking button
- Subscription details show when clicking "My Subscription"
- Server logs show "✅ Notification sent to X" (not "⚠️ No push subscription")
- "Test notification result: 2/2 successful" (or however many users exist)

---

## Full Test Workflow (5 minutes)

```bash
# 1. Restart (1 min)
cd server && npm start
cd client && npm run dev

# 2. Open setup.html (1 min)
http://localhost:5173/notification-setup.html
Click [Refresh Status] → See service worker active

# 3. Grant permission (2 min)
Click [Request Permission] → Allow in browser
See "Permission: Granted"

# 4. Setup subscriptions (1 min)
As admin: Click [Bulk Demo Subscribe]
See "4/4 users subscribed"

# 5. Send test notification (1 min)
Click [Send Test Notification]
See "Test notification result: 2/2 successful"

# ✅ Done! Notifications working!
```

---

## That's It! 🎉

Run these commands and click those buttons - your notifications will be working in 5-10 minutes!

For detailed information, see: `NOTIFICATION_QUICK_FIX.md` or `NOTIFICATION_ANALYSIS.md`

