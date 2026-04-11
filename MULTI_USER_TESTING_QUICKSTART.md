# 🚀 Multi-User Testing - Quick Start

## What Changed?
You can now **login multiple users in the same browser** without logging out each time.

## ✅ How to Test It Right Now

### Step 1: Login First User
```
1. Go to http://localhost:5173/login
2. Enter: borrower@carsu.edu.ph / password123
3. Click Login
```

### Step 2: Login Second User (Same Tab)
```
1. Go to http://localhost:5173/login again (yes, same tab is fine)
2. Enter: staff@carsu.edu.ph / password123
3. Click Login
4. Look bottom-right corner... see the blue "2 Users" button!
```

### Step 3: Switch Between Users
```
1. Click the "2 Users" button
2. See both users listed
3. Click a user name to switch instantly
4. Current user is marked with a blue dot (●)
5. The app updates immediately
```

### Step 4: Test Real-Time
```
✅ Login as Staff → see staff dashboard
✅ Switch to Borrower → see borrower dashboard
✅ Switch back to Staff → staff dashboard again
✅ Refresh page → both users still logged in!
```

## 🆘 Issues?

**Button not showing?**
- You need at least 1 logged-in user
- Must be in development mode
- Try: `tokenManager.debug()` in browser console

**Need to clear everything?**
- Open browser console (F12)
- Type: `tokenManager.clearAll()`
- Refreshes, all users cleared

**Which user is active?**
- Open console and type: `tokenManager.getActiveUser()`

## 📝 What Works

✅ Login multiple users  
✅ Switch users instantly  
✅ All API calls use correct user's token  
✅ Data persists on page refresh  
✅ Works across browser tabs  
✅ Each user's session is isolated  

## 🎯 Common Test Scenarios

### Scenario A: Borrower → Staff Workflow
```
1. Login as Borrower (john@carsu.edu.ph)
2. Create borrow request
3. Keep Borrower logged in
4. LOGIN as Staff (staff@carsu.edu.ph) 
5. See new borrow request in Staff timeline
6. Approve it
7. Switch back to Borrower
8. Confirm receipt
9. Switch to Staff → mark as returned
```

### Scenario B: Test Different Roles
```
Tab 1: http://localhost:5173/available-items
- Login Borrower
- Click profile → see borrower profile

Tab 2: http://localhost:5173/staff
- Login Staff  
- Click profile → see staff profile

Tab 3: http://localhost:5173/admin
- Login Admin
- Different UI for admins
```

### Scenario C: Test Notifications
```
1. Login Borrower + Staff (same browser)
2. Switch to Borrower
3. Create borrow request
4. Switch to Staff
5. Check if staff sees notification
6. Switch back to Borrower
7. Test from other direction
```

## 💾 What's Stored

In your browser's `localStorage`:
- `multi_user_tokens` - All logged-in user tokens
- `active_user_id` - Which user is currently active

Delete them anytime with: `tokenManager.clearAll()`

## ✨ Features

| Feature | Available | Details |
|---------|-----------|---------|
| Login multiple users | ✅ Yes | No logout needed |
| Switch users | ✅ Yes | One click |
| Persist tokens | ✅ Yes | Survives refresh |
| Multiple tabs | ✅ Yes | Synced across tabs |
| Remove single user | ✅ Yes | X button on each |
| Clear all | ✅ Yes | "Clear All Users" button |
| Dev mode only | ✅ Yes | Hidden in production |

## 🔍 Debug Commands

```javascript
// View all logged-in users
tokenManager.debug()

// Get current active user
tokenManager.getActiveUser()

// Get all users
tokenManager.getAllUsers()

// Switch to user ID "1"
tokenManager.setActiveToken(1)

// Remove user ID "1"
tokenManager.removeToken(1)

// Clear everything
tokenManager.clearAll()

// Count users
tokenManager.count()
```

## ❓ FAQ

**Q: Will this log out when I refresh?**  
A: No! Tokens stay in localStorage. You'll still be logged in as all users.

**Q: Can I use different browsers?**  
A: Each browser has its own localStorage, so you'd need to login separately.

**Q: Is this secure?**  
A: It's for DEVELOPMENT ONLY. Don't use in production. Tokens in localStorage are less secure than httpOnly cookies.

**Q: How many users can I login?**  
A: As many as you want! But practically, 3-5 is easiest to manage.

**Q: Do I need to change backend?**  
A: No! All backend code works as-is. This is pure frontend magic.

---

## 🎓 Additional Resources

See [MULTI_USER_TESTING_GUIDE.md](./MULTI_USER_TESTING_GUIDE.md) for detailed architecture and more examples.

**Ready to test?** Start with Step 1 above! 🚀
