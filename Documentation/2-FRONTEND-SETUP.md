# 🎨 Frontend Setup Guide - Step by Step

Complete step-by-step guide to set up the React frontend for the Music Instrument Borrowing System.

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Project Structure](#project-structure)
3. [Step 1: Ensure Backend is Running](#step-1-ensure-backend-is-running)
4. [Step 2: Navigate to Client Directory](#step-2-navigate-to-client-directory)
5. [Step 3: Install Frontend Dependencies](#step-3-install-frontend-dependencies)
6. [Step 4: Configure Environment Variables](#step-4-configure-environment-variables)
7. [Step 5: Start the Frontend Server](#step-5-start-the-frontend-server)
8. [Step 6: Verify Frontend is Running](#step-6-verify-frontend-is-running)
9. [Step 7: Test the Complete System](#step-7-test-the-complete-system)
10. [Troubleshooting](#troubleshooting)

---

## ✅ Prerequisites

Before starting, ensure:

- ✅ **Backend is running** on http://localhost:8000
  - See [Backend Setup Guide](1-BACKEND-SETUP.md) if not set up
- ✅ **Node.js v16+** installed
- ✅ **npm 7+** installed
- ✅ **PostgreSQL** running with database `ucca` created
- ✅ **5173 port** is available (or willing to change it)

---

## 📁 Project Structure

The client directory structure:

```
client/
├── src/
│   ├── pages/                    # Page components (29 pages)
│   │   ├── Login.jsx            # Login page
│   │   ├── Register.jsx         # Registration page
│   │   ├── Dashboard.jsx        # Main dashboard
│   │   ├── AvailableItems.jsx   # Browse instruments
│   │   ├── BorrowCart.jsx       # User borrowing cart
│   │   ├── StaffBorrowCart.jsx  # Staff borrowing operations
│   │   ├── MyBorrowedItems.jsx  # View borrowed items
│   │   ├── BorrowerHistory.jsx  # View borrow history
│   │   ├── ReturnItems.jsx      # Return items page
│   │   ├── ScanQR.jsx           # QR code scanner
│   │   ├── MusicInstrumentScanner.jsx # Photo upload scanner
│   │   ├── AdminUserManagement.jsx    # User management
│   │   ├── ManageInventory.jsx       # Inventory control
│   │   ├── AdminReports.jsx          # Analytics & reports
│   │   └── ... (15 more pages)
│   │
│   ├── components/              # Reusable React components
│   │   ├── Navbar.jsx           # Navigation bar
│   │   ├── AddToCartModal.jsx   # Add item modal
│   │   ├── BorrowPhotoCaptureModal.jsx
│   │   ├── ReturnPhotoCaptureModal.jsx
│   │   ├── SchoolIDVerificationModal.jsx
│   │   └── ... (10+ more components)
│   │
│   ├── context/                 # React Context (State Management)
│   │   ├── userContext.jsx      # User & auth state
│   │   └── borrowingContext.jsx # Cart & borrowing state
│   │
│   ├── services/                # API Communication
│   │   ├── api.js               # Axios instance & base config
│   │   ├── auth.js              # Auth API calls
│   │   ├── borrow.js            # Borrow API calls
│   │   ├── inventory.js         # Inventory API calls
│   │   ├── notifications.js     # Notification API calls
│   │   └── ... (more services)
│   │
│   ├── assets/                  # Images & static files
│   ├── lib/                     # Utility functions
│   ├── App.jsx                  # Main app component
│   ├── main.jsx                 # React DOM entry point
│   └── index.css                # Global styles
│
├── public/                      # Static files
├── .env                         # Environment variables
├── vite.config.js               # Vite build config
├── tailwind.config.js           # Tailwind CSS config
├── eslint.config.js             # ESLint rules
├── postcss.config.js            # PostCSS config
├── package.json                 # Dependencies
└── package-lock.json
```

---

## ✅ Step 1: Ensure Backend is Running

The frontend needs the backend API to function.

### Check Backend is Running

```bash
# Open a new terminal and test backend
curl http://localhost:8000/api/auth/test

# Or in your browser:
# http://localhost:8000/api/auth/test
# 
# Should return: {"message":"test is working"}
```

### If Backend Isn't Running

```bash
# Terminal 1: Start Backend
cd server
npm start
# Wait for: "✅ Database connected successfully"
# Then: "🚀 Server running on port 8000"
```

✅ **Proceed only after backend is confirmed working!**

---

## Step 2: Navigate to Client Directory

```bash
# From LOGINAUTH root directory
cd client

# Verify location
pwd  # macOS/Linux
cd   # Windows

# Should show: .../LOGINAUTH/client
```

---

## Step 3: Install Frontend Dependencies

### Install All Dependencies

```bash
# Install packages from package.json
npm install
```

**This will install:**
- `react` - UI framework
- `react-router-dom` - Page routing
- `axios` - HTTP client
- `vite` - Build tool
- `tailwindcss` - Styling
- `html5-qrcode` - QR code scanning
- `@tensorflow/tfjs` - ML models
- `recharts` - Charts & graphs
- And many more...

### Expected Output

```
added XXX packages in X.XXs
```

### Verify Installation

```bash
# Check key dependencies
npm list react axios vite tailwindcss

# Or simply list all
npm list
```

---

## Step 4: Configure Environment Variables

Environment variables tell the frontend where the backend API is located.

### Step 4.1: Check if .env Exists

```bash
# In client directory
ls -la | grep .env
# or on Windows:
dir | findstr .env
```

The file `client/.env` should exist with minimal content.

### Step 4.2: Edit .env File

Open `client/.env` and ensure it contains:

```env
# Frontend Environment Variables

# ==========================================
# API CONFIGURATION
# ==========================================
VITE_API_URL=http://localhost:8000

# ==========================================
# WEB PUSH NOTIFICATIONS
# ==========================================
VITE_VAPID_PUBLIC_KEY=BJC7m2pOnIK_hJLUYM29QwhO6AVyHZgqJITDqZR_438KCamUZ-vh2IC5-0iVPT1VRtRIQIvFlXXNfzJoV5BoCH8
```

### Step 4.3: Verify Axios Configuration

The frontend's axios configuration is in `src/services/api.js`. It should already be set to:

```javascript
// Located in: client/src/App.jsx
axios.defaults.baseURL = "http://localhost:8000";
axios.defaults.withCredentials = true;
```

If needed, you can modify this file to change the API URL.

---

## Step 5: Start the Frontend Server

### Option A: Using npm (Recommended)

```bash
# In client directory
npm run dev

# Expected output:
#   VITE v7.0.0  ready in XXX ms
#   ➜  Local:   http://localhost:5173/
#   ➜  press h to show help
```

### Option B: Specify a Different Port

If port 5173 is already in use:

```bash
# Run on port 5174
npm run dev -- --port 5174
```

### ✅ Success Indicators

You should see:
```
✓ 123 modules transformed.

➜  Local:   http://localhost:5173/
➜  Network: http://192.168.x.x:5173/
```

---

## Step 6: Verify Frontend is Running

### Test 1: Open in Browser

```
http://localhost:5173/
```

You should see:
- Login page with email and password fields
- Register button
- Responsive design

### Test 2: Check Console

Press `F12` in browser to open Developer Tools:

1. Go to **Console** tab
2. You should see **NO red error messages**
3. You may see info messages about React or Vite (OK)
4. If you see connection errors, backend might not be running

### Test 3: Check Network

In Developer Tools, go to **Network** tab:

1. Try clicking "Test API" or login button
2. You should see requests to `http://localhost:8000/api/...`
3. Responses should be JSON with `200` status

### Test 4: Console Logs

The frontend logs should include:
```
🔔 [App.jsx] Starting notification setup
✅ [App.jsx] Service Worker initialized
```

---

## Step 7: Test the Complete System

### Test 1: Register a New Account

1. Go to http://localhost:5173/
2. Click **"Don't have an account? Register"**
3. Fill in:
   - Name: `Test User`
   - Email: `test@carsu.edu.ph` (must end with @carsu.edu.ph or @gmail.com)
   - Password: `Test123456`
   - Phone: `09123456789`
4. Click **Register**

**Expected:**
- "Registration successful! Check your email..."
- Email should be sent (check spam folder)

### Test 2: Login

1. Go back to Login page
2. Enter:
   - Email: `admin@carsu.edu.ph` (from sample data)
   - Password: `admin123456` (update based on your .env)
3. Click **Login**

**Expected:**
- Redirected to Dashboard
- User info shown in navbar
- No error messages in console

### Test 3: Navigate Pages

1. Click **Browse Instruments** → Should show list of instruments
2. Click **My Borrowed Items** → Should show borrowing history
3. Click **Dashboard** → Should show overview

### Test 4: API Communication

In Browser DevTools (F12) → Network tab:

1. Go to Browse Instruments page
2. You should see network requests like:
   - `GET http://localhost:8000/api/inventory/get-items`
   - Response: 200 OK with instrument data

### Test 5: Add Item to Cart

1. Go to **Browse Instruments**
2. Find an instrument and click **Add to Cart**
3. Toast notification should show: "Added to cart"
4. Item should appear in cart count

---

## 🎯 Verification Checklist

- [ ] Frontend loads without errors
- [ ] Can navigate between pages
- [ ] API calls are successful (check Network tab)
- [ ] Can register new account
- [ ] Can login with credentials
- [ ] Can browse instruments
- [ ] Can add items to cart
- [ ] No red errors in console
- [ ] Backend and frontend communicate properly

---

## 💻 Development Commands

```bash
# In client directory:

# Start development server
npm run dev

# Build for production
npm build

# Preview production build
npm preview

# Run linting
npm run lint

# Format code
npm run lint -- --fix
```

---

## 🔧 Troubleshooting

### Issue: "Cannot connect to backend"

**Symptoms:**
- Red error in console: "Failed to fetch"
- Network requests show errors
- 503 or connection refused

**Solution:**
```bash
# Check if backend is running
curl http://localhost:8000/api/auth/test

# If not, start backend
cd server
npm start

# Wait for: "✅ Database connected successfully"
```

### Issue: Port 5173 already in use

**Solution:**
```bash
# Run on different port
npm run dev -- --port 5174

# Or kill process using port 5173
# Windows:
netstat -ano | findstr :5173
taskkill /PID <PID> /F

# macOS/Linux:
lsof -i :5173
kill -9 <PID>
```

### Issue: "Cannot find module" errors

**Solution:**
```bash
# Reinstall dependencies
rm -rf node_modules
npm install
```

### Issue: Page keeps refreshing or crashing

**Solutions:**
1. Clear browser cache: `Ctrl+Shift+Delete`
2. Hard refresh: `Ctrl+Shift+R`
3. Check console for specific error message
4. Restart frontend: `Ctrl+C` in terminal, then `npm run dev`

### Issue: Blank white page

**Checklist:**
- [ ] Check browser console (F12) for errors
- [ ] Is backend running?
- [ ] Is API URL correct in .env?
- [ ] Are there any network errors?

**Solution:**
```bash
# Check the console for specific errors
# Note the error message and search documentation
# Or restart both frontend and backend
```

### Issue: Cannot upload photos / QR scanning not working

**Solutions:**
- Browser needs camera permission
- Click "Allow" when browser asks for camera access
- Check that backend is running
- Ensure file upload limits are set (already in .env)

### Issue: Email not sending (registration fails)

**This is a backend issue - see Backend Setup Guide**

---

## 🚀 Quick Reference Commands

```bash
# Terminal 1: Backend
cd server && npm start

# Terminal 2: Frontend
cd client && npm run dev

# Terminal 3: (Optional) Monitor logs
# Just watch the terminal outputs

# To stop servers:
# Press Ctrl+C in each terminal

# To restart:
# Stop (Ctrl+C), then restart npm command
```

---

## 📚 Related Guides

- [Backend Setup Guide](1-BACKEND-SETUP.md)
- [Database Setup Guide](3-DATABASE-SETUP.md)
- [System Architecture](4-SYSTEM-ARCHITECTURE.md)
- [API Reference](5-API-REFERENCE.md)
- [Troubleshooting Guide](../TROUBLESHOOTING.md)

---

## ✅ Next Steps

**Frontend is now running!**

1. **Learn the system** → [System Architecture](4-SYSTEM-ARCHITECTURE.md)
2. **Understand APIs** → [API Reference](5-API-REFERENCE.md)
3. **Explore features** → [Features Guide](6-FEATURES-GUIDE.md)
4. **Run tests** → [Testing Guide](7-TESTING-VERIFICATION.md)

---

**Status:** ✅ Ready for Development

You now have both backend and frontend running! 🎉
