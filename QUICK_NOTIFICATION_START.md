# Quick Start: Push Notifications Testing

## 1. Verify VAPID Keys

Check your `.env` file in the server directory:

```bash
# server/.env
VAPID_SUBJECT=mailto:your-email@example.com
VAPID_PUBLIC_KEY=<your public key>
VAPID_PRIVATE_KEY=<your private key>
```

Check your `.env.local` or `.env` file in the client directory:

```bash
# client/.env.local
VITE_VAPID_PUBLIC_KEY=<same as server public key>
```

**Don't have VAPID keys?** Generate them:

```bash
cd server
npm install -g web-push
web-push generate-vapid-keys
```

Copy the output to your `.env` files.

## 2. Restart Everything

```bash
# Terminal 1: Kill existing processes (Ctrl+C)
# Then restart server
cd server
npm start

# Terminal 2: Kill existing processes (Ctrl+C)  
# Then restart client
cd client
npm run dev
```

Wait for these messages:
- Server: `🚀 Server running at http://localhost:8000`
- Server: `✅ Database connected successfully`
- Client: (browser) Console shows `✅ Service Worker registered successfully`

## 3. Test the Notifications

**Terminal 3: Open your browser's DevTools**

```
F12 → Console
```

### Login as Borrower (Tab 1)

1. Open `http://localhost:5173` in browser
2. Login as a **borrower** account
3. **Grant notification permission** when prompted
4. Watch console for:
   ```
   ✅ Service Worker registered successfully
   🔔 NotificationBadge: Starting initialization
   📲 Subscribing user 1 to push notifications...
   ✅ Subscription saved on server
   ```

If you don't see `✅ Subscription saved on server`:
- Check if permission was granted: `Notification.permission` in console should be `"granted"`
- Check Network tab → Look for `POST /api/notifications/subscribe` → Should be 200 OK
- Check the response to see the error

### Login as Staff (Tab 2)

1. Open `http://localhost:5173` in a **new tab or private window**
2. Login as a **staff** account
3. **Grant notification permission** when prompted
4. Wait for subscription confirmation in console

### Send Test Notification (Staff Tab)

1. In staff dashboard, find "**Notification Testing Panel**"
2. Click **"Send Test Notification"** button
3. Watch console for:
   ```
   📢 staff (ID: 2) sending test notification
   ✅ Found 2 target users: john(borrower), admin1(admin)
   📊 Test notification result: 2/2 successful
   ```

### Receive Notification (Borrower Tab)

In the **borrower tab**, you should see:
- Desktop notification at **top-right corner** with bell icon 🔔
- Message: "This is a test notification from a staff account."
- Click it → Navigates to dashboard

## 4. Debug If Not Working

### Check if subscriptions are saved:

In **any logged-in user's console tab**, open:

```
http://localhost:8000/api/test-notifications/debug/subscriptions
```

You should see:

```json
{
  "user": { "id": 1, "name": "John", "role": "borrower" },
  "subscriptions": [
    {
      "endpoint": "https://...",
      "created_at": "2025-11-12T...",
      "last_seen": "2025-11-12T..."
    }
  ],
  "count": 1
}
```

If `count: 0` → **Subscription not saved**. Check:
- Did you grant permission? (`Notification.permission === 'granted'`)
- Check network tab for errors on POST `/api/notifications/subscribe`

### Check all subscriptions (Admin):

If you're logged in as admin, open:

```
http://localhost:8000/api/test-notifications/debug/all-subscriptions
```

Shows all users and their subscription status.

### View Server Logs

Watch the **server console** when clicking "Send Test Notification":

```
📢 staff (ID: 2) sending test notification
✅ Found 2 target users: john(borrower), admin(admin)
  ✅ Notification sent to john (ID: 1)
  ✅ Notification sent to admin (ID: 3)
📊 Test notification result: 2/2 successful
```

❌ If you see:
```
⚠️ No push subscription found for user 1
```

Then user 1 didn't save their subscription. Go back and grant permission.

## 5. Test Due Soon Notification

1. In staff tab, click **"Send Due Soon Notification"**
2. In borrower tab, you should receive notification with message about items due in 3 days
3. In borrower tab, click **"Send Due Soon Notification"**
4. In staff tab, you should receive notification about borrower's items due soon

## 6. Common Fixes

### Fix: "Permission popup doesn't appear"
- Chrome: Settings → Privacy → Site settings → Notifications → Find `localhost` → Delete
- Firefox: Settings → Privacy → Permissions → Clear exceptions
- Reload page and try again

### Fix: "Notification received but doesn't show up"
- Clear browser cache: `Ctrl+Shift+Delete`
- Close and reopen browser completely
- Verify Service Worker is running: DevTools → Application → Service Workers

### Fix: "Subscription save fails (400 Bad Request)"
- Check Network tab → POST `/api/notifications/subscribe`
- Should send: `{ "endpoint": "...", "keys": { "p256dh": "...", "auth": "..." } }`
- If sending wrong format, restart browser

## 7. You're Done! 🎉

All notifications should now work with:
- ✅ Desktop notifications on Windows/Mac/Linux
- ✅ Mobile notifications on Android (Chrome)
- ✅ Cross-role notifications (staff ↔ borrowers)
- ✅ Test notifications working
- ✅ Due soon notifications working

For complete debugging guide, see: `NOTIFICATION_SETUP.md`

