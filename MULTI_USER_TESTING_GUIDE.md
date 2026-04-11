# Multi-User Testing Implementation Guide

## 🎯 Overview

Your application now supports **logging in multiple users simultaneously** within the same browser for easier testing and development. This guide explains what was implemented and how to use it.

## 📦 What Was Implemented

### 1. **Token Manager** (`client/src/utils/tokenManager.js`)
- Centralized system for managing multiple user tokens
- Stores tokens in localStorage with user metadata
- Allows switching between active users
- Provides methods to add, remove, and manage tokens

**Key Methods:**
```javascript
tokenManager.addToken(userId, email, token, userData)    // Store a new user's token
tokenManager.setActiveToken(userId)                      // Switch to a user
tokenManager.getActiveToken()                            // Get current user's token
tokenManager.getActiveTokenString()                      // Get token string only
tokenManager.getActiveUser()                             // Get current user's data
tokenManager.removeToken(userId)                         // Remove a user
tokenManager.getAllUsers()                               // List all stored users
tokenManager.clearAll()                                  // Clear all tokens
tokenManager.debug()                                     // Print debug info
```

### 2. **Test User Switcher Component** (`client/src/components/TestUserSwitcher.jsx`)
- Floating button in bottom-right corner (development mode only)
- Shows all logged-in users
- Quick-switch between users with one click
- Remove individual users or clear all
- Displays user role, email, and login time

**Only visible in:**
- Development environment (`NODE_ENV === 'development'`)
- When at least 2 users are logged in

### 3. **Enhanced Login Flow** (`client/src/pages/Auth/Login.jsx`)
- Automatically stores tokens in TokenManager on successful login
- Allows sequential logins without logging out
- Persists all tokens across page refreshes

### 4. **Global Axios Interceptor** (`client/context/userContext.jsx`)
- Automatically injects active user's token into all API requests
- Switches token when user is switched in TestUserSwitcher
- Fallback to cookie-based auth if no active token

### 5. **UserContext Enhancement** (`client/context/userContext.jsx`)
- Listens for tokenManager changes
- Updates user context when switching users
- Syncs across browser tabs/windows

## 🚀 How to Use It

### **Scenario 1: Test Multiple Users in Same Tab**

1. **Login first user:**
   - Navigate to `/login`
   - Enter email (e.g., `borrower@carsu.edu.ph`)
   - Enter password
   - Click Login
   - You're logged in as Borrower

2. **Login second user (DON'T logout):**
   - Open `/login` in a new browser tab (or click login again)
   - Enter different user email (e.g., `staff@carsu.edu.ph`)
   - Enter password
   - Click Login
   - **Now BOTH users are logged in!**

3. **Switch between users:**
   - Notice the blue "2 Users" button in the bottom-right corner
   - Click it to see your authenticated users
   - Click any user to switch instantly
   - The app context updates, and all API calls use the new user's token

4. **View details:**
   - Each user card shows name, email, role, and login timestamp
   - Red X button removes a single user
   - "Clear All Users" removes all stored sessions

### **Scenario 2: Test in Different Tabs**

1. **Tab 1:** Login as User A
2. **Tab 2:** Login as User B  
3. **Switch in Tab 1** using the TestUserSwitcher
4. **Switch in Tab 2** using the TestUserSwitcher
5. Each tab maintains its own active user context (synchronized via localStorage)

### **Scenario 3: Test Different Roles Concurrently**

1. **Tab 1:** Login as Borrower
2. **Tab 2:** Login as Staff (open `/staff` path)
3. **Tab 3:** Login as Admin (open `/admin` path)
4. Each tab shows different UI based on user role
5. Test interactions between different user types

## 📋 Debug & Troubleshooting

### **View All Stored Users (Console)**
```javascript
// Open browser Developer Tools (F12)
// Go to Console tab and run:

tokenManager.debug();
// Output:
// 📋 Stored Users:
//   ID: 1 | borrower@carsu.edu.ph | Role: borrower | Added: 3:45:12 PM
// ✅ ID: 2 | staff@carsu.edu.ph | Role: staff | Added: 3:45:45 PM
// 🔑 Active User: staff@carsu.edu.ph
```

### **Get Specific User Info**
```javascript
// Get all users as array
tokenManager.getAllUsers()

// Get active user's token
tokenManager.getActiveTokenString()

// Check if user exists
tokenManager.hasUser(1)

// Count stored users
tokenManager.count()
```

### **Clear All Users (if stuck)**
```javascript
tokenManager.clearAll()
// Logs out all users and resets the app
```

### **Common Issues**

**Issue: "Can't login 2nd user"**
- Make sure you're NOT clicking logout before logging in the second user
- Just navigate to `/login` and log in as a different user
- The token will be saved, not replace the previous one

**Issue: "Switch button not appearing"**
- You need at least 1 stored user (auto-shows at 2+)
- Make sure you're in development mode (check `NODE_ENV`)
- Open browser console and run: `tokenManager.getAllUsers()`

**Issue: "API calls with wrong user"**
- Check which user is active: `tokenManager.getActiveUser()`
- Switch users using the TestUserSwitcher button
- Check network tab to verify Authorization header is correct

**Issue: "Session lost on page refresh"**
- Tokens are stored in localStorage
- They should persist across refreshes
- Check DevTools > Application > Local Storage
- Look for `multi_user_tokens` and `active_user_id` keys

## 🔒 Security Notes

⚠️ **This feature is for DEVELOPMENT/TESTING ONLY**

- Tokens are stored in localStorage (less secure than httpOnly cookies)
- **Do NOT enable this in production**
- The TestUserSwitcher only shows in development mode
- For production, use proper token refresh mechanisms and secure storage

## 🛠️ Code Changes Summary

### Files Modified:
1. ✅ `client/src/pages/Auth/Login.jsx` - Added tokenManager integration
2. ✅ `client/context/userContext.jsx` - Added axios interceptor & tokenManager sync
3. ✅ `client/src/App.jsx` - Added TestUserSwitcher component

### Files Created:
1. ✅ `client/src/utils/tokenManager.js` - Token management system
2. ✅ `client/src/components/TestUserSwitcher.jsx` - UI component

### Backend:
- **No backend changes required** ✅
- Existing JWT/cookie auth still works
- New Authorization header support added via axios interceptor

## 📊 How It Works (Architecture)

```
┌─────────────────────────────────────────────────────────┐
│                     Browser Storage                      │
│  localStorage: {                                         │
│    'multi_user_tokens': {                                │
│      1: { token: 'jwt...', userData: {...} },           │
│      2: { token: 'jwt...', userData: {...} },           │
│      3: { token: 'jwt...', userData: {...} }            │
│    },                                                     │
│    'active_user_id': '2'                                │
│  }                                                        │
└─────────────────────────────────────────────────────────┘
                            ↓
                  ┌──────────────────┐
                  │  tokenManager    │
                  │  (Singleton)     │
                  │  - addToken()    │
                  │  - getActiveUser │
                  │  - removeToken() │
                  └──────────────────┘
                            ↓
        ┌───────────────────┬────────────────────┐
        ↓                   ↓                    ↓
   Login.jsx        userContext.jsx     Axios Interceptor
   (stores token)   (reads active user) (injects token)
        ↓                   ↓                    ↓
        └───────────────────┼────────────────────┘
                            ↓
                TestUserSwitcher.jsx
                (UI to switch users)
                            ↓
                    ┌────────────────┐
                    │  API Requests  │
                    │ (with correct  │
                    │  user token)   │
                    └────────────────┘
```

## 🎓 Example Use Cases

### Test Case 1: Borrowing Request Workflow
1. **User A (Borrower)** creates borrow request
2. **User B (Staff)** approves the request
3. **User A** confirms item receipt
4. **User B** marks as complete
- Switch between users as you progress through the flow

### Test Case 2: Role-Based Access
1. Login Borrower → verify they see `/available-items`
2. Logout, login Staff → verify they see `/staff/manage-requests`
3. Logout, login Admin → verify they see `/admin`
- All 3 can be done without logout using this system!

### Test Case 3: Concurrent Notifications
1. Login User A (Borrower) and User B (Staff) simultaneously
2. User A makes a borrow request
3. Switch to User B → see notification
4. Test push notifications for multiple users

## ✅ Testing Checklist

- [ ] Login User 1 successfully
- [ ] Login User 2 (different role) without logging out User 1
- [ ] See blue "2 Users" button appear
- [ ] Click button to see both users listed
- [ ] Switch to User 1 → verify context changes
- [ ] Switch to User 2 → verify context changes
- [ ] Check network requests show correct Authorization header
- [ ] Refresh page → users still logged in
- [ ] Open new tab → both users still available
- [ ] Remove User 1 → only User 2 active
- [ ] Clear all users → starts fresh

## 🎯 Next Steps

1. **Test the implementation** using the scenarios above
2. **Report any issues** with specific user roles or features
3. **Consider extending** to support more concurrent users if needed
4. **Plan production migration** (convert to backend session management if needed)

---

**Questions?** Check the debug output in browser console using `tokenManager.debug()`
