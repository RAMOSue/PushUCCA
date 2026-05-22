# ✅ Testing & Verification Guide

Complete guide to testing the Music Instrument Borrowing System after setup.

---

## 📋 Table of Contents

1. [Pre-Testing Checklist](#pre-testing-checklist)
2. [Backend Testing](#backend-testing)
3. [Frontend Testing](#frontend-testing)
4. [Integration Testing](#integration-testing)
5. [Feature Testing](#feature-testing)
6. [Performance Testing](#performance-testing)
7. [Security Testing](#security-testing)

---

## ✅ Pre-Testing Checklist

Before testing, verify everything is set up:

- [ ] PostgreSQL running
- [ ] Database `ucca` created
- [ ] Backend running on http://localhost:8000
- [ ] Frontend running on http://localhost:5173
- [ ] No errors in console
- [ ] Network tab shows successful API calls
- [ ] Sample data loaded in database

**Quick Verification:**

```bash
# Terminal 1: Check backend
curl http://localhost:8000/api/auth/test
# Should return: {"message":"test is working"}

# Terminal 2: Check database
psql -U postgres -d ucca -c "SELECT COUNT(*) FROM users;"
# Should show: count: 3 (or more)

# Terminal 3: Check frontend
# Open http://localhost:5173 in browser
# Should load without errors
```

---

## 🔧 Backend Testing

### Test 1: Database Connectivity

**Test If:**
- Backend can connect to PostgreSQL
- All tables exist
- Sample data is present

**Steps:**

```bash
# 1. Check backend logs
# Should see: "✅ Database connected successfully"

# 2. Verify tables exist
psql -U postgres -d ucca -c "\dt"

# Should list all tables:
# - users
# - instruments
# - borrows
# - etc.

# 3. Count sample data
psql -U postgres -d ucca -c "SELECT COUNT(*) FROM users;"
# Should show: count ≥ 3
```

**Expected Result:** ✅ All tables exist with sample data

---

### Test 2: Authentication Endpoints

**Test If:**
- Register endpoint works
- Login endpoint works
- Email verification works
- JWT tokens are valid

**Test: Register New User**

```bash
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@carsu.edu.ph",
    "password": "Test123456",
    "phone": "09123456789"
  }'

# Expected Response (200):
# {
#   "message": "Registration successful! Check your email...",
#   "userId": 4,
#   "expiresIn": "15 minutes"
# }
```

**Test: Login**

```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@carsu.edu.ph",
    "password": "admin123456"
  }'

# Expected Response (200):
# {
#   "user": {
#     "id": 1,
#     "name": "Admin User",
#     "email": "admin@carsu.edu.ph",
#     "role": "admin"
#   },
#   "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
# }
```

**Copy the token and use it for next tests**

---

### Test 3: Inventory Endpoints

**Test If:**
- Can retrieve all instruments
- Can search instruments
- Quantities are correct

**Test: Get All Instruments**

```bash
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."  # From login above

curl -X GET http://localhost:8000/api/inventory/get-items \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"

# Expected Response (200):
# {
#   "instruments": [
#     {
#       "id": 1,
#       "name": "Classical Guitar",
#       "quantity_available": 5,
#       "category": "String"
#     },
#     ...
#   ],
#   "total": 6
# }
```

**Verify:** All 6 sample instruments returned

---

### Test 4: Borrow Endpoints

**Test If:**
- Can submit borrow request
- Can retrieve borrow history
- Quantities update correctly

**Test: Submit Borrow Request**

```bash
curl -X POST http://localhost:8000/api/borrow/submit-borrow \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {
        "instrument_id": 1,
        "quantity": 1,
        "unit_numbers": "1"
      }
    ],
    "expected_return_date": "2026-03-17",
    "photos": [
      "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEA..."
    ]
  }'

# Expected Response (201):
# {
#   "message": "Borrow request submitted successfully",
#   "borrow_id": 1,
#   "status": "pending"
# }
```

**Verify:** 
- Borrow created with status "pending"
- Quantity of Guitar decreased by 1

---

## 🎨 Frontend Testing

### Test 1: Page Load & Navigation

**Test If:**
- Frontend loads without errors
- All pages accessible
- Navigation works

**Steps:**

1. Open http://localhost:5173
2. Should see Login page
3. Press F12 → Console tab
4. Should have NO red error messages
5. Click links to navigate
6. All pages should load

**Pages to Test:**
- Login ✓
- Register ✓
- Dashboard ✓
- Browse Instruments ✓
- My Borrowed Items ✓
- Borrow History ✓
- Return Items ✓
- Scan QR ✓
- Settings ✓

---

### Test 2: User Registration & Login

**Test: Register**

1. On Login page, click "Register"
2. Fill form:
   - Name: Test User
   - Email: test123@carsu.edu.ph
   - Password: Test123456
   - Phone: 09123456789
3. Click Register
4. Should show: "Registration successful!"
5. Check browser DevTools → Network tab
   - POST /api/auth/register should be 200

---

### Test: Login

1. Return to Login page
2. Enter credentials:
   - Email: admin@carsu.edu.ph
   - Password: admin123456
3. Click Login
4. Should redirect to Dashboard
5. Navbar shows: "Welcome, Admin User"
6. DevTools Network tab shows:
   - POST /api/auth/login (200)
   - Response includes token

---

### Test 3: Browse & Add to Cart

**Steps:**

1. After login, click "Browse Instruments"
2. Should show list of 6 instruments
3. Each instrument shows:
   - Name ✓
   - Quantity available ✓
   - Add to Cart button ✓

4. Click "Add to Cart" on Guitar
5. Modal appears asking quantity & units
6. Select:
   - Quantity: 1
   - Unit: 1
7. Click Add
8. Toast shows: "Added to cart" ✓
9. Cart count in navbar increases ✓

---

### Test 4: Photo Capture

**Steps:**

1. In Browse page, click "Camera" icon (if visible)
2. Grant camera permission
3. Take a photo
4. Image appears in preview
5. Can upload or retake

**Alternative (File Upload):**

1. Click upload icon
2. Select image from computer
3. Image loads and displays

---

## 🔗 Integration Testing

### Test 1: Complete Borrow-Return Flow

**Step 1: Submit Borrow Request**

1. Browse instruments
2. Add Guitar to cart
3. Go to cart
4. Take photos
5. Set return date
6. Click "Submit"
7. Toast: "Request submitted"
8. DevTools Network: POST /api/borrow/submit-borrow (201)

**Step 2: Check Quantity Update**

1. Go back to Browse
2. Guitar quantity should decrease by 1
3. Previously: 5 available → Now: 4 available

**Step 3: Approve Request (As Staff)**

1. Logout
2. Login as staff@carsu.edu.ph / password
3. Go to "Manage Borrow Requests"
4. Should see pending request
5. Click to view details
6. Click "Approve"
7. Submit approval

**Step 4: Return Items (As Staff)**

1. Click "Process Return"
2. Enter borrow ID from earlier
3. Take return photos
4. Select condition: "Good"
5. Click "Process Return"
6. Toast: "Return processed"

**Step 5: Verify Quantity Restored**

1. Login as admin
2. Go to Browse
3. Guitar should be back to 5 available

**Result:** ✅ Complete cycle works!

---

### Test 2: Search & Filter

**Test Search:**

1. Go to Browse Instruments
2. In search box, type "Guitar"
3. Results should filter to only guitars
4. Clear search → All items return

**Test Filter:**

1. Click category filter "String"
2. Only String instruments show
3. Click category filter "Brass"
4. Only Brass instruments show

---

## ✨ Feature Testing

### Feature: QR Code Scanning

**Setup:** Generate QR code for an instrument
```bash
# In psql
SELECT qr_code FROM instruments WHERE id = 1 LIMIT 1;
# Will show base64 encoded QR code
```

**Test:**

1. Go to "Scan QR" page
2. Click camera
3. Hold QR code to camera
4. Should detect automatically
5. Item added to cart

---

### Feature: Email Verification

**Test:**

1. Register new account with email
2. Check email spam folder
3. Find verification code email
4. Copy code
5. Go back to app and enter code
6. Email verified ✓

**Note:** Email might take 1-2 minutes

---

### Feature: Notifications

**Test Push Notifications:**

1. Go to Settings
2. Click "Enable Notifications"
3. Browser asks permission
4. Click "Allow"
5. Perform action (e.g., submit borrow)
6. Browser should show notification

---

### Feature: Dark Mode

**Test:**

1. Click theme toggle (sun/moon icon)
2. Page changes to dark theme
3. All text readable ✓
4. Click again → Light theme
5. Preference saved across page reload

---

## 📊 Performance Testing

### Test 1: Page Load Time

**Using Browser DevTools:**

1. Open http://localhost:5173
2. Press F12 → Network tab
3. Reload page
4. Check load time (target: < 3 seconds)
5. Check bundle size

**Metrics to Check:**
- Page load time: < 3s ✓
- Images loading: < 2s ✓
- API calls responding: < 1s ✓

---

### Test 2: API Response Time

**Using Terminal:**

```bash
# Measure API response time
time curl http://localhost:8000/api/inventory/get-items \
  -H "Authorization: Bearer $TOKEN"

# Should complete in < 500ms

# For search with filters
time curl 'http://localhost:8000/api/inventory/search?q=guitar' \
  -H "Authorization: Bearer $TOKEN"

# Should complete in < 500ms
```

**Expected:**
- Simple queries: < 200ms
- With joins: < 500ms
- With aggregations: < 1s

---

### Test 3: Database Query Performance

```sql
-- Test slow queries
EXPLAIN ANALYZE SELECT * FROM borrows 
WHERE borrower_id = 1 AND status = 'pending';

-- Check index usage
EXPLAIN SELECT * FROM borrows WHERE status = 'pending';
-- Should show: using Index Scan

-- Monitor active queries
SELECT pid, query, state FROM pg_stat_activity;
```

---

## 🔒 Security Testing

### Test 1: Authentication Required

**Test 1a: Access API without token**

```bash
curl http://localhost:8000/api/borrow/my-borrows

# Expected (401):
# {
#   "error": "No token provided"
# }
```

**Result:** ✅ API protected

---

**Test 1b: Access with invalid token**

```bash
curl http://localhost:8000/api/borrow/my-borrows \
  -H "Authorization: Bearer invalid_token_here"

# Expected (401):
# {
#   "error": "Invalid or expired token"
# }
```

**Result:** ✅ Invalid tokens rejected

---

### Test 2: Password Hashing

**Test:**

1. Register user with password "Test123456"
2. Check database:

```sql
SELECT email, password FROM users WHERE email = 'test@carsu.edu.ph';
```

3. Password should show as hash like:
```
$2b$10$YIjlrJwVeWc8x7.D8xE2BO6...
```

**NOT:** plain text

**Result:** ✅ Passwords hashed

---

### Test 3: Email Domain Validation

**Test: Try invalid email**

```bash
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test",
    "email": "test@yahoo.com",
    "password": "Test123456",
    "phone": "09123456789"
  }'

# Expected (400):
# {
#   "error": "Only @carsu.edu.ph or @gmail.com email addresses are allowed"
# }
```

**Result:** ✅ Invalid emails rejected

---

### Test 4: Role-Based Access Control

**Test: Staff accessing admin features**

1. Login as staff@carsu.edu.ph
2. Try to access /admin/users
3. Should be redirected or see "Access Denied"
4. Only admin can access admin pages

---

## 📋 Verification Checklist

Use this checklist to verify everything:

### Setup ✅
- [ ] PostgreSQL running
- [ ] Database created
- [ ] Backend running
- [ ] Frontend running
- [ ] Sample data loaded

### Backend ✅
- [ ] Database connects
- [ ] All tables exist
- [ ] Register works
- [ ] Login works
- [ ] Get instruments works
- [ ] Submit borrow works
- [ ] Process return works

### Frontend ✅
- [ ] Loads without errors
- [ ] Can navigate pages
- [ ] Can register/login
- [ ] Can browse items
- [ ] Can add to cart
- [ ] Can submit borrow
- [ ] Can view history

### Integration ✅
- [ ] Full borrow cycle works
- [ ] Quantities update correctly
- [ ] Approvals/rejections work
- [ ] Returns processed correctly
- [ ] Photos save correctly
- [ ] Emails sent correctly
- [ ] Notifications created

### Performance ✅
- [ ] Pages load < 3 seconds
- [ ] API < 1 second response
- [ ] No console errors
- [ ] Smooth interactions

### Security ✅
- [ ] Auth required for APIs
- [ ] Invalid tokens rejected
- [ ] Passwords hashed
- [ ] Email validation works
- [ ] Role restrictions enforced

---

## 🎯 Test Data Reference

### Sample Users Created

| Email | Password | Role |
|-------|----------|------|
| admin@carsu.edu.ph | admin123456 | admin |
| staff@carsu.edu.ph | admin123456 | staff |
| borrower@carsu.edu.ph | admin123456 | borrower |

### Sample Instruments Created

| ID | Name | Quantity |
|----|------|----------|
| 1 | Classical Guitar | 5 |
| 2 | Violin | 3 |
| 3 | Trumpet | 4 |
| 4 | Drums | 2 |
| 5 | Flute | 6 |
| 6 | Piano Keyboard | 2 |

---

## 🐛 Common Test Issues

### Issue: "Cannot connect to backend"

**Solution:**
```bash
# Check backend running
curl http://localhost:8000/api/auth/test

# If fails, restart backend
cd server
npm start
```

---

### Issue: "Database empty"

**Solution:**
```bash
# Load sample data
psql -U postgres -d ucca -f server/sample-data.sql

# Verify
psql -U postgres -d ucca -c "SELECT COUNT(*) FROM users;"
```

---

### Issue: "Token expired"

**Solution:**
- Tokens expire after 24 hours
- Login again to get new token
- Use new token in headers

---

## 📚 Next Steps

1. **Have problems?** → [Troubleshooting Guide](../TROUBLESHOOTING.md)
2. **Want more details?** → [API Reference](5-API-REFERENCE.md)
3. **Need architecture info?** → [System Architecture](4-SYSTEM-ARCHITECTURE.md)

---

**Status:** ✅ Comprehensive Testing Guide  
**Last Updated:** March 2026  
**Version:** 1.0
