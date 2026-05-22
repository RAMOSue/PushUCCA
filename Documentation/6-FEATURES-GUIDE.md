# ✨ Features & User Workflows Guide

Complete guide to all features in the Music Instrument Borrowing System and how to use them.

---

## 📋 Table of Contents

1. [User Roles & Permissions](#user-roles--permissions)
2. [Borrower Features](#borrower-features)
3. [Staff Features](#staff-features)
4. [Admin Features](#admin-features)
5. [Common Workflows](#common-workflows)

---

## 👥 User Roles & Permissions

### Role Hierarchy

```
Admin (Full System Access)
  │
  ├─→ Can manage users
  ├─→ Can manage inventory
  ├─→ Can view all reports
  ├─→ Can approve/reject borrows
  ├─→ Can process returns
  └─→ Can access staff features
  
Staff (Approve/Process Operations)
  │
  ├─→ Can view pending borrow requests
  ├─→ Can approve/reject borrows
  ├─→ Can process returns with photos
  ├─→ Can manage own schedule
  ├─→ Can view reports
  └─→ Can perform bulk borrow operations
  
Borrower (Browse & Borrow)
  │
  ├─→ Can browse instruments
  ├─→ Can add to cart
  ├─→ Can submit borrow requests
  ├─→ Can view own borrowed items
  ├─→ Can view own borrow history
  ├─→ Can return items
  └─→ Can receive notifications
```

---

## 🎵 Borrower Features

### Feature 1: User Registration & Email Verification

**What It Does:**
- New users create accounts with email verification
- Only @carsu.edu.ph or @gmail.com emails allowed
- Email verification required before first login

**How to Use:**

1. Go to Registration page
2. Fill in:
   - Name: Your full name
   - Email: @carsu.edu.ph or @gmail.com
   - Password: At least 6 characters
   - Phone: Contact number

3. Click "Register"
4. Check email for 6-digit verification code
5. Enter code to verify account
6. Now can login

**Behind the Scenes:**
- Password hashed with bcrypt
- Verification token sent via email
- Email service (Nodemailer) handles sending
- Token expires after 15 minutes

---

### Feature 2: Browse Available Instruments

**What It Does:**
- View all instruments available for borrowing
- Filter by category (String, Brass, Percussion, etc.)
- Search by instrument name
- See quantity available

**How to Use:**

1. Login to dashboard
2. Click "Browse Instruments"
3. Browse all available instruments
   - Each shows name, description, quantity available
   - Green = available, Red = not available

4. Filter by category (optional)
   - Click "String", "Brass", "Percussion", etc.

5. Search (optional)
   - Type instrument name in search box
   - Results update in real-time

6. Click on instrument card for more details

**UI Elements:**
```
┌─────────────────────────────────────┐
│  🎵 Browse Instruments              │
├─────────────────────────────────────┤
│                                     │
│  Filter:  [String] [Brass] [Perc] │
│  Search:  [___Guitar____]          │
│                                     │
│  ┌─────────────┐  ┌─────────────┐ │
│  │ Guitar      │  │ Violin      │ │
│  │ Available: 3│  │ Available: 2│ │
│  │ [Add Cart]  │  │ [Add Cart]  │ │
│  └─────────────┘  └─────────────┘ │
│                                     │
└─────────────────────────────────────┘
```

---

### Feature 3: Add Items to Cart

**What It Does:**
- Select specific units of instruments to borrow
- Choose quantity and specific unit numbers
- Maintains cart across page refreshes

**How to Use:**

1. On Browse Instruments page
2. Click "Add to Cart" on any instrument
3. Modal appears asking:
   - How many units? (e.g., 2)
   - Which specific units? (e.g., Unit 1, Unit 2)

4. Click "Add"
5. Item added to cart (toast notification shows)
6. Cart count updates in navbar

**Cart Persistence:**
- Cart saved in localStorage
- Persists after closing browser
- Clears after successful borrow submission

---

### Feature 4: Submit Borrow Request

**What It Does:**
- Submit formal borrow request with photo documentation
- Attach photos for each item
- Set expected return date

**How to Use:**

1. Add items to cart (Feature 3)
2. Click "View Cart" or go to BorrowCart page
3. Review items in cart
4. For each item:
   - Click "Take Photo"
   - Use camera to capture image
   - Or upload existing photo

5. Set expected return date (calendar picker)
6. Click "Submit Borrow Request"
7. Confirmation shows: "Request submitted, pending approval"

**Photo Requirements:**
- At least 1 photo required
- Photos must show instruments clearly
- Used for identification and condition documentation
- Stored in database with timestamp

**Behind the Scenes:**
- Frontend converts photos to base64
- Backend saves photos to disk
- Creates borrow record (status = "pending")
- Reduces quantity_available in instruments table
- Sends email to staff
- Creates notification in database

---

### Feature 5: Track Borrowed Items

**What It Does:**
- View all currently borrowed items
- See due dates and status
- Take return photos
- Initiate return process

**How to Use:**

1. Login to dashboard
2. Click "My Borrowed Items"
3. See all active borrows:
   - Item name and unit numbers
   - Borrow date and due date
   - Current status (pending/approved/borrowed)
   - Days until due date

4. To return items:
   - Click "Return Items" button
   - Confirm items in good condition
   - Take return photos
   - Submit return

---

### Feature 6: View Borrow History

**What It Does:**
- Complete history of all past borrows
- Details about each transaction
- Return dates and conditions
- Photos of borrows and returns

**How to Use:**

1. Login to dashboard
2. Click "Borrow History"
3. See all past borrows (newest first)
   - Date borrowed and returned
   - Items borrowed and quantities
   - Status (returned, rejected, etc.)
   - Condition when returned

4. Click on any borrow to view:
   - All items in that borrow
   - Borrow photos
   - Return information
   - Return photos

---

### Feature 7: QR Code Scanning

**What It Does:**
- Quick borrow using QR code scan
- Scan instrument QR codes for fast borrowing
- No manual item selection needed

**How to Use:**

1. Go to Dashboard
2. Click "Scan QR Code"
3. Allow camera access when browser asks
4. Point camera at instrument QR code
5. Automatic detection:
   - Identifies instrument
   - Scans quantity if available
   - Adds to cart automatically

6. Confirm items
7. Take photos
8. Submit borrow request

**Technical Details:**
- Uses html5-qrcode library
- Decodes QR code format: `INSTRUMENT_ID|QUANTITY`
- Example: `1|2` = Instrument 1, Quantity 2

---

### Feature 8: Photo Upload & Recognition (ML)

**What It Does:**
- Upload photos of instruments
- AI automatically detects instruments in photo
- Adds detected items to cart

**How to Use:**

1. Go to Dashboard
2. Click "Music Instrument Scanner"
3. Upload a photo (or take with camera)
4. System processes with ML model (TensorFlow.js):
   - Analyzes image
   - Identifies instruments
   - Detects quantity if multiple
   - Shows detected items

5. Confirm detected items
6. Items added to cart
7. Proceed to checkout

**Behind the Scenes:**
- Uses TensorFlow.js pretrained model
- Model trained on instrument images
- Returns confidence scores
- Filters results above 60% confidence

---

### Feature 9: Notifications

**What It Does:**
- Real-time notifications for borrow updates
- In-app notification bell
- Push notifications (browser)
- Email notifications

**Types of Notifications:**
1. Borrow Approved - When staff approves request
2. Borrow Rejected - When staff rejects request
3. Due Soon - Reminder when return date approaching
4. Return Confirmed - When return processed
5. New Message - Staff communication

**How to Access:**
1. Click bell icon in navbar
2. Dropdown shows recent notifications
3. Click to mark as read
4. Some notifications also appear as toast alerts

---

## 👨‍💼 Staff Features

### Feature 1: View Pending Borrow Requests

**What It Does:**
- See all borrow requests awaiting approval
- Review photos and item details
- Approve or reject requests

**How to Use:**

1. Login as staff user
2. Go to Dashboard
3. See "Pending Requests" widget showing count
4. Click "Manage Borrow Requests"
5. See list of all pending requests:
   - Borrower name
   - Items requested
   - Submission date
   - Photos attached

6. Click on request to view full details

---

### Feature 2: Approve/Reject Borrow Requests

**What It Does:**
- Review and approve pending borrow requests
- Reject with reason if needed
- Automatic notifications sent to borrower

**How to Use (Approve):**

1. In Manage Requests page
2. Click on pending request
3. Review:
   - Borrower details
   - Items requested
   - Photos provided

4. Click "Approve" button
5. Optional: Add approval notes
6. Click "Confirm Approval"

**Actions Performed:**
- Updates borrow status to "approved"
- Sends email to borrower
- Creates notification for borrower
- Items ready for pickup

**How to Use (Reject):**

1. In Manage Requests page
2. Click on pending request
3. Click "Reject" button
4. Provide reason (required)
5. Click "Confirm Rejection"

**Actions Performed:**
- Updates status to "rejected"
- Restores item quantities (not reserved anymore)
- Sends email with rejection reason
- Creates notification for borrower

---

### Feature 3: Process Returns

**What It Does:**
- Mark items as returned
- Document return condition
- Store return photos

**How to Use:**

1. Borrower brings items to counter
2. Click "Process Return"
3. Enter or scan borrow ID
4. Verify items returned:
   - Check item names
   - Verify unit numbers
   - Confirm quantities

5. Inspect items and select condition:
   - Good - No damage
   - Fair - Minor wear
   - Poor - Significant damage

6. Take return photos (optional)
7. Add notes if needed
8. Click "Process Return"

**Behind the Scenes:**
- Creates return record in database
- Updates quantities back to available
- Marks borrow as "returned"
- Sends confirmation email
- Creates notification

---

### Feature 4: Staff Scheduling

**What It Does:**
- Set available working hours
- Manage own schedule
- Coordinate with other staff

**How to Use:**

1. Go to Staff Dashboard
2. Click "My Schedule"
3. View your schedule:
   - Days of week
   - Working hours (start/end time)
   - Available/unavailable status

4. To edit:
   - Click day to edit
   - Set start time
   - Set end time
   - Toggle available/unavailable
   - Click "Save"

---

## 🔐 Admin Features

### Feature 1: User Management

**What It Does:**
- Create, edit, delete user accounts
- Assign roles (borrower, staff, admin)
- View user details and activity

**How to Use:**

1. Login as admin
2. Go to "Admin Dashboard"
3. Click "User Management"
4. See list of all users with:
   - Name
   - Email
   - Role
   - Status
   - Join date

5. To create user:
   - Click "Add User"
   - Fill in details
   - Assign role
   - Click "Create"
   - System generates temporary password (sent via email)

6. To edit user:
   - Click "Edit" next to user
   - Modify details/role
   - Click "Save"

7. To delete user:
   - Click "Delete"
   - Confirm deletion
   - All user data archived

---

### Feature 2: Inventory Management

**What It Does:**
- Add/edit instrument information
- Update quantities
- Manage categories and conditions

**How to Use:**

1. Go to Admin Dashboard
2. Click "Manage Inventory"
3. See all instruments

4. To add new instrument:
   - Click "Add Instrument"
   - Fill in:
     - Name
     - Description
     - Total quantity
     - Category
     - Condition
     - Image
   - Click "Add"

5. To edit instrument:
   - Click instrument
   - Modify details
   - Can't directly edit quantity (tracked through borrows)
   - Click "Save"

6. To generate QR code:
   - Click "Generate QR Code"
   - System creates and displays QR
   - Can print for physical instruments

---

### Feature 3: Reports & Analytics

**What It Does:**
- View system statistics
- Analyze borrowing trends
- Generate custom reports

**Available Reports:**

1. **Borrow Statistics:**
   - Total borrows (today/week/month/all-time)
   - By status (pending, approved, returned)
   - Most borrowed instruments
   - Average borrow duration

2. **User Activity:**
   - Most active borrowers
   - Active users (last 30 days)
   - User roles distribution

3. **Inventory Status:**
   - Items in stock
   - Items on loan
   - Items needing service
   - Condition distribution

4. **Custom Reports:**
   - Date range selection
   - Filter by category
   - Export to CSV/PDF

**How to Use:**

1. Go to Admin Dashboard
2. Click "Reports"
3. See dashboard with key metrics
4. Click any section for details
5. Use filters:
   - Date range
   - Category
   - User/item
6. Click "Export" to download CSV/PDF

---

### Feature 4: System Settings

**What It Does:**
- Configure system behavior
- Set policies and rules

**Available Settings:**

1. **Email Configuration:**
   - Sender email
   - SMTP settings
   - Email templates

2. **Borrow Policies:**
   - Max borrow days
   - Max items per request
   - Late fees (if applicable)

3. **Notification Settings:**
   - When to send notifications
   - Reminder timing
   - Escalation rules

4. **System Maintenance:**
   - Database backup schedule
   - Log retention
   - File cleanup

---

## 🔄 Common Workflows

### Workflow 1: Complete Borrow-Return Cycle

```
Day 1 - BORROWING
│
├─→ Borrower logs in
├─→ Browses instruments
├─→ Adds Guitar (Unit 1,2) and Violin (Unit 1) to cart
├─→ Takes photos of instruments
├─→ Submits borrow request
│   └─→ Status: PENDING
│
├─→ Email sent to staff
├─→ Toast shows: "Request submitted"
│
└─→ Quantities updated:
    - Guitar: 5 → 3 available
    - Violin: 3 → 2 available

Day 2 - APPROVAL
│
├─→ Staff receives notification
├─→ Reviews borrow request
├─→ Approves request
│   └─→ Status: APPROVED
│
├─→ Email sent to borrower
├─→ Borrower can pick up items
│
└─→ System shows "Ready for Pickup"

Day 9 - RETURN (Before Due Date)
│
├─→ Borrower brings items to counter
├─→ Staff scans QR or enters borrow ID
├─→ Takes photos of returned items
├─→ Notes condition: "Good"
├─→ Clicks "Process Return"
│   └─→ Status: RETURNED
│
├─→ Quantities restored:
│   - Guitar: 3 → 5 available
│   - Violin: 2 → 3 available
│
├─→ Email confirmation sent
│   └─→ "Items successfully returned"
│
└─→ Notification created
    └─→ "Thank you for returning items"
```

---

### Workflow 2: Handling a Rejection

```
Step 1 - SUBMISSION
│
└─→ Borrower submits 5 guitars
    └─→ Status: PENDING

Step 2 - REVIEW
│
└─→ Staff checks inventory
    └─→ Only 3 guitars available
    └─→ Approvals can't approve

Step 3 - REJECTION
│
├─→ Staff clicks "Reject"
├─→ Provides reason: "Only 3 units available, need 5"
├─→ Clicks "Confirm"
│
├─→ Status: REJECTED
│
├─→ Email sent with reason
├─→ Notification created
│
└─→ Quantities NOT reduced
    └─→ Automatic rollback
    └─→ Items still available

Step 4 - RESUBMISSION (Optional)
│
└─→ Borrower sees notification
    ├─→ Understands why rejected
    ├─→ Modifies request to 3 guitars
    ├─→ Resubmits
    └─→ Repeats approval process
```

---

### Workflow 3: Multi-Unit Detection

```
Scenario: One guitar has multiple units (Guitar 1, 2, 3, 4, 5)

User Experience:
│
├─→ User scans guitar QR code
│   └─→ Shows: "Guitar - 5 available units"
│
├─→ User clicks "Add to Cart"
│   └─→ Modal: "How many units? [5]"
│   └─→ "Which units? [1] [2] [3] [4] [5] or [All]"
│
├─→ User selects:
│   - Quantity: 2
│   - Units: 1, 2
│
├─→ Item added to cart shows:
│   "Guitar x2 (Units 1,2)"
│
└─→ On submission:
    └─→ unit_numbers="1,2" stored in database
    └─→ Can track exactly which physical units

Staff can later identify:
    ├─→ Guitar Unit 1 is with John (since 2026-03-10)
    ├─→ Guitar Unit 2 is with Sarah (since 2026-03-10)
    └─→ Easy to locate specific instruments
```

---

## 📱 Mobile Responsive Features

All features work on:
- 📱 Mobile phones (iOS/Android)
- 💻 Tablets
- 🖥️ Desktop computers

**Mobile Optimizations:**
- Touch-friendly buttons
- Camera integration
- Responsive layouts
- Bottom navigation bar
- Simplified modals

---

## 🌙 Dark Mode

**Feature:** Toggle dark/light theme

**How to Use:**
1. Click theme toggle in navbar (sun/moon icon)
2. System remembers preference
3. All pages update to dark theme
4. Reduces eye strain in low light

---

**Next Steps:**
- [Testing Guide](7-TESTING-VERIFICATION.md) - How to test features
- [System Architecture](4-SYSTEM-ARCHITECTURE.md) - How it all works
- [API Reference](5-API-REFERENCE.md) - For developers

---

**Last Updated:** March 2026  
**Version:** 1.0  
**Status:** ✅ All Features Documented
