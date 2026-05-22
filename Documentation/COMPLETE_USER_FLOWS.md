# COMPLETE USER FLOWS & WORKFLOWS
## UCCA Inventory Management System

**Document Purpose**: Detailed step-by-step workflows for all user roles  
**Last Updated**: April 12, 2026

---

## TABLE OF CONTENTS
1. [Borrower Workflows](#borrower-workflows)
2. [Staff Workflows](#staff-workflows)
3. [Admin Workflows](#admin-workflows)
4. [System-Wide Workflows](#system-wide-workflows)

---

## BORROWER WORKFLOWS

### 1. REGISTRATION & LOGIN FLOW

**Step-by-Step Process**:

```
1. User visits application
   └─ Sees "Get Started" landing page with call-to-action

2. Click "Create Account" → Registration page
   ├─ Enter: name, email (@carsu.edu.ph or @gmail.com)
   ├─ Enter: phone number, password (min 6 chars)
   └─ Click "Register"

3. Backend validates email domain
   ├─ If invalid domain → Show error "Email must be @carsu.edu.ph or @gmail.com"
   └─ If valid → Create user account (role: borrower)

4. Verification email sent
   └─ Email contains 6-digit verification code

5. Redirect to verification page
   ├─ User enters code from email
   ├─ Enter code → Click "Verify"
   ├─ If correct → Account activated
   └─ If incorrect → Show error, allow retry

6. Redirect to login page
   ├─ User logs in with email + password
   ├─ Credentials verified
   ├─ JWT token generated
   ├─ Token saved in localStorage + cookies
   └─ Redirect to dashboard

7. Dashboard displays
   ├─ Welcome message: "Hello [Name]"
   ├─ Recent borrowing statistics
   ├─ Quick action buttons
   └─ Navigation sidebar
```

**UI Flow Diagram**:
```
[Landing Page] 
    ↓
[Register Form] → Validate email domain
    ↓
[Verification Email Sent]
    ↓
[Verify Code Form] → Check code
    ↓
[Login Page] → Authenticate
    ↓
[Borrower Dashboard]
```

### 2. BROWSING & SEARCHING INVENTORY

**Step-by-Step Process**:

```
1. Click "Available Items" in sidebar
   └─ Navigates to /available-items

2. Browse inventory page displays
   ├─ Search bar (search by name)
   ├─ Filter buttons: Category (Costume, Instrument, Accessories)
   ├─ Filter buttons: Group (Dulimbay, Budjong, Kayam)
   └─ Item grid showing all available items

3. Apply filters (optional)
   ├─ Click category filter (e.g., "Instrument")
   ├─ Items update in real-time
   ├─ Click group filter (e.g., "Dulimbay")
   └─ Results narrow further

4. Search by name (optional)
   ├─ Type in search box (e.g., "Violin")
   ├─ As you type, results filter
   ├─ Click X to clear search
   └─ Search icons

5. View item details
   ├─ Item card shows:
   │  ├─ Item image
   │  ├─ Name
   │  ├─ Category
   │  ├─ Group/Division
   │  ├─ Description
   │  ├─ Available units (per size)
   │  ├─ Condition status
   │  └─ "Add to Cart" button
   └─ Click item card for full details modal

6. Performance recommendations (special cases)
   ├─ If user in scheduled performance
   ├─ View "Recommended Items" badge
   ├─ Quick-add from recommendations
   └─ Recommended items highlighted
```

**Search & Filter Algorithm**:
```javascript
filters.forEach(filter => {
  items = items.filter(item => {
    category match?  && group match? && search match?
  });
});
// Display filtered items in grid
```

### 3. ADDING ITEMS TO CART

**Step-by-Step Process**:

```
1. On available items page
   ├─ Find desired item
   ├─ Click "Add to Cart" button
   └─ → AddToCartModal opens

2. AddToCartModal displays
   ├─ Shows:
   │  ├─ Item image
   │  ├─ Item name
   │  ├─ Available sizes (Small, Medium, Large, No Size)
   │  ├─ Quantity selector (+ / - buttons)
   │  ├─ Required quantity input
   │  └─ "Add to Cart" button
   ├─ User selects:
   │  ├─ Size preference
   │  └─ Quantity to borrow
   └─ Click "Add to Cart"

3. Backend inventory check
   ├─ Query available units matching:
   │  ├─ Item ID
   │  ├─ Selected size
   │  └─ Quantity needed
   ├─ If units available:
   │  └─ Reserve units with status: "reserved"
   └─ If units unavailable:
      └─ Show error "Not enough units available"

4. Item added to cart (BorrowingContext)
   ├─ Cart state updated: [...items, newItem]
   ├─ Cart persisted to:
   │  ├─ React state (BorrowingContext)
   │  ├─ localStorage (JSON)
   │  └─ Backend database
   └─ Toast notification: "Item added to cart"

5. Item appears in BorrowCart
   ├─ Cart consolidates by name/category/size
   ├─ Shows:
   │  ├─ Item info (name, size, category)
   │  ├─ Quantity (with +/- adjusters)
   │  ├─ Individual units list
   │  └─ Remove button
   └─ User can continue shopping or checkout
```

**Cart State Structure**:
```javascript
// BorrowingContext cart
cart = [
  {
    unitId: "unit-123",
    itemId: 456,
    name: "Suyam",
    category: "instrument",
    size: "medium",
    quantity: 1,
    status: "reserved",
    image_url: "/uploads/suyam.jpg",
    unit_number: "SUYAM-M-1"
  },
  // ... more items
]
```

### 4. MANAGING SHOPPING CART

**Adjust Quantity**:
```
Current cart has: Suyam (quantity: 1)

Option A: Using +/- buttons
├─ Click "+" → Quantity becomes 2
│  └─ Backend reserves 1 additional unit
├─ Click "-" → Quantity becomes 1
│  └─ Backend releases 1 unit
└─ Toast shows: "Quantity updated"

Option B: Direct quantity edit
├─ Click quantity field
├─ Enter new number (e.g., 3)
├─ Press Enter
└─ Backend reserves/releases units as needed
```

**Remove Item**:
```
├─ Find item in cart
├─ Click "Delete" icon (trash can)
├─ Confirmation: "Remove all units of this item?"
├─ Click "Confirm"
└─ Item removed, units released back to inventory

Intent: Clear entire consolidated item
Result: All units of that item removed from request
```

**View Item Details**:
```
├─ Click on item card in cart
├─ Modal shows:
│  ├─ Full item description
│  ├─ All reserved individual units
│  ├─ Unit numbers (e.g., "SUYAM-M-1")
│  ├─ Condition status
│  └─ Care instructions
└─ Close modal to return to cart
```

**Cart Persistence**:
```
When item added/removed/quantity changed:
1. Update BorrowingContext state
2. Save to localStorage (JSON)
3. POST to /api/borrow/cart (backend)
4. Backend saves to database
5. userId linked to request
6. If request exists: Add to existing
   Else: Create new request "reserved"
```

### 5. CHECKOUT & SUBMITTING BORROW REQUEST

**Pre-Submission Validation**:

```
Before user can submit:
✅ Cart has at least 1 item
✅ All quantities valid (≥ 1)
✅ Selected items in stock
✅ User verified email
✅ User has borrower role

If fails: Show toast error with reason
```

**Submission Flow**:

```
1. Click "Submit Request" button in cart
   └─ Opens review/confirmation page

2. Confirmation page shows
   ├─ Summary:
   │  ├─ Item list to borrow
   │  ├─ Total units
   │  ├─ Due date (auto-calculated: +30 days)
   │  └─ Request ID (if existing)
   ├─ Photo capture section
   │  ├─ Take photos of items (optional but recommended)
   │  └─ Photo preview
   └─ "Confirm & Submit" button

3. Optional: Capture photos
   ├─ Click "Take Photo"
   ├─ Camera opens in BorrowPhotoCaptureModal
   ├─ Point camera at items
   ├─ Click shutter to capture
   ├─ Photo displayed in preview
   ├─ Retake or confirm
   └─ Photo attached to request

4. Click "Confirm & Submit"
   ├─ Disable button (prevent double-submission)
   ├─ Show loading spinner
   ├─ POST to /api/borrow/add-to-cart with:
   │  ├─ request_date: now()
   │  ├─ due_date: now() + 30 days
   │  ├─ items: [itemId, quantity] array
   │  ├─ photos: base64 image data (if any)
   │  └─ borrower_id: user.id
   └─ Wait for response

5. Backend creates borrow request
   ├─ Status set to: "pending" (awaiting approval)
   ├─ Items linked to request
   ├─ Units marked: "reserved" → "pending"
   ├─ Photos saved to /public/uploads/borrow-photos/{userId}/
   ├─ Email sent to staff: "[Name] requests [items]"
   └─ Return new requestId

6. Success response
   ├─ Clear cart (localStorage + state)
   ├─ Show success toast: "Request submitted! Reference: #REQ-123"
   ├─ Save request ID to state (for future updates)
   ├─ Redirect to MyBorrowedItems
   └─ Display request with status "pending"
```

**Borrow Request Status Lifecycle**:

```
reserved (in cart)
    ↓
pending (submitted, awaiting approval)
    ├─→ approved (staff/admin approved)
    │     ├─→ pickup ready
    │     └─→ pending_return (student ready to return)
    │           ├─→ returning (processing return)
    │           └─→ returned (completed)
    │
    └─→ declined (staff rejected)
        └─ [End] Items released back to inventory
```

### 6. TRACKING BORROWED ITEMS

**View My Borrowed Items Page**:

```
1. Click "My Borrowed Items" in sidebar
   └─ Navigate to /my-borrowed-items

2. Page displays
   ├─ Filters: Status (All, Pending, Approved, Pending Return)
   ├─ Search bar (search by item name)
   ├─ Request cards showing:
   │  ├─ Request ID
   │  ├─ Status badge (color-coded)
   │  ├─ Request date
   │  ├─ Due date (with overdue warning if past)
   │  ├─ Items borrowed (count)
   │  ├─ Status timeline visual
   │  └─ Action buttons
   └─ No requests message if empty

3. Status Meanings
   ├─ pending (⏳): Waiting for staff approval
   ├─ approved (✅): Staff approved, ready to pickup
   ├─ pending_return (🔄): Borrowed, now ready to return
   ├─ declined (❌): Request was rejected
   └─ returned (✓): Successfully returned

4. Click on request card
   ├─ Expands to show:
   │  ├─ Full item list with details
   │  ├─ Individual unit numbers
   │  ├─ Approval date
   │  ├─ Expected due date
   │  ├─ Status timeline (visual)
   │  ├─ Photos taken during borrow
   │  └─ Return options button

5. Filtering by status
   ├─ Click status filter (e.g., "Pending")
   ├─ List updates to show only matching requests
   └─ Can combine with search

6. Search items in requests
   ├─ Type item name in search
   ├─ Only requests with matching items shown
   ├─ Case-insensitive search
   └─ Clear search to reset
```

### 7. RETURNING BORROWED ITEMS

**Return Initiation**:

```
1. In "My Borrowed Items" page
   ├─ Find request with status: "pending_return"
   ├─ Click "Initiate Return" button
   └─ InitiateReturnModal opens

2. InitiateReturnModal
   ├─ Shows:
   │  ├─ Items currently borrowed
   │  ├─ Checkboxes for each item
   │  ├─ Option to return all at once
   │  ├─ "Return Selected" button
   │  └─ "Capture Photos" option
   ├─ User selects:
   │  ├─ Which items to return (full request or partial)
   │  └─ Click "Proceed"
   └─ → ReturnPhotoCaptureModal opens

3. Optional: Capture return photos
   ├─ Camera opens
   ├─ Capture photos of returned items
   ├─ Ensures item condition documented
   ├─ Photos attached to return record
   └─ Click "Continue"

4. Return confirmation
   ├─ Summary:
   │  ├─ Items being returned
   │  ├─ Return condition assessment
   │  ├─ Photos attachment status
   │  └─ "Confirm Return" button
   ├─ Click "Confirm Return"
   └─ POST to /api/borrow/return with return data

5. Backend processes return
   ├─ Find all units being returned
   ├─ Update units status: "returned"
   ├─ Update request status: "returned" (if all items)
   ├─ Partial return: Update returned_quantity
   ├─ Save return photos
   ├─ Inventory units available again
   └─ Email staff: "[Name] returned items from #REQ-123"

6. Success
   ├─ Toast: "Items returned successfully!"
   ├─ Redirect to MyBorrowedItems
   ├─ Request status updates to "returned"
   └─ Items removed from "Current Borrowings"
```

**Return Photographie Documentation**:
```
When borrower returns items, they should photograph:
1. All items being returned
2. Overall condition (state of packaging/items)
3. Individual units if significant wear visible

Photos stored in: /public/uploads/return-photos/{userId}/{requestId}/
Format: JPEG
Visible to: Staff during processing
Purpose: Damage assessment, condition tracking
```

### 8. VIEWING BORROWING HISTORY

**History Page**:

```
1. Click "History" in sidebar
   └─ Navigate to /borrow-history

2. Page displays
   ├─ Filters: Status (All, Pending, Approved, Returned, Declined)
   ├─ Date range picker (optional)
   ├─ Search by item name
   └─ Request list (oldest first or newest first)

3. History cards show
   ├─ Request ID
   ├─ Date requested
   ├─ Items borrowed (count)
   ├─ Duration (request date - return date)
   ├─ Final status
   ├─ Staff notes (if any)
   └─ "View Details" link

4. View full request details
   ├─ Click request card
   ├─ Modal/page shows:
   │  ├─ All items with unit numbers
   │  ├─ Request timeline (dates and status changes)
   │  ├─ Approval information
   │  ├─ Photos of items
   │  ├─ Any staff notes
   │  └─ Return confirmation
   └─ Close to return to history

5. Export history (optional)
   ├─ Button to download as CSV
   ├─ Includes all request details
   └─ Suitable for records/portfolio
```

### 9. PERFORMANCE RECOMMENDATIONS WORKFLOW

**View Recommended Items for Performance**:

```
1. System notifies user
   ├─ Email: "You're included in [Performance Name]"
   ├─ App notification: "Check recommended items"
   └─ Sidebar badge: "1 Performance"

2. Navigate to "Performances" (if available)
   ├─ OR View recommendations in AvailableItems
   ├─ Items marked with "Recommended for [Event]" badge
   └─ Filter to show recommendations only

3. View details
   ├─ Click recommended item
   ├─ Shows:
   │  ├─ Item details
   │  ├─ Quantity needed
   │  ├─ Specific size required
   │  ├─ Performance it's for
   │  ├─ Pickup/return dates
   │  └─ Quick "Add to Cart" button
   └─ Staff provided alternatives if size unavailable

4. Quick borrow from recommendation
   ├─ Click "Quick Borrow" or add to regular cart
   ├─ Item automatically sized to recommendation
   ├─ Quantity set to recommended amount
   ├─ Follow normal checkout flow
   └─ Submit with performance context
```

---

## STAFF WORKFLOWS

### 1. STAFF LOGIN & DASHBOARD

**Login Process** (Same as Borrower):
```
1. Go to /login
2. Enter staff email + password
3. System verifies role = "staff"
4. Redirect to /staff dashboard (DashboardStaff.jsx)
```

**Staff Dashboard**:
```
Displays:
├─ Welcome message: "Hello [Staff Name]"
├─ Quick Stats:
│  ├─ Pending Approvals (count)
│  ├─ Overdue Items (count)
│  ├─ Total Requests Today (count)
│  └─ Available Items (count)
├─ Quick action tiles:
│  ├─ "View Pending Requests"
│  ├─ "Manage Inventory"
│  ├─ "Schedule Performance"
│  ├─ "Master List Configuration"
│  └─ "View Reports"
└─ Recent activity feed
```

### 2. APPROVING BORROW REQUESTS

**Approval Workflow**:

```
1. Click "Pending Requests" or "Manage Requests"
   └─ Navigate to /staff/manage-requests

2. Request queue displays
   ├─ Filter: Status (Pending, Approved, Declined)
   ├─ Search: By borrower name
   ├─ Sort: By date or borrower name
   └─ Request list showing:
      ├─ Borrower name
      ├─ Items requested (with quantities)
      ├─ Request date
      ├─ Photos attached
      └─ Action buttons (Approve/Decline)

3. Review request details
   ├─ Click request card to expand
   ├─ View:
   │  ├─ All items with unit numbers
   │  ├─ Item conditions (from photos)
   │  ├─ Borrower name and ID
   │  ├─ Requested quantities
   │  └─ Any notes
   └─ Decide: Approve, Decline, or Request More Info

4. Approve request
   ├─ Click "Approve" button
   ├─ Optional: Add approval notes
   ├─ Click "Confirm Approve"
   ├─ Backend updates:
   │  ├─ Request status: "approved"
   │  ├─ Units status: "approved"
   │  ├─ Approval timestamp: NOW
   │  ├─ approved_by: staff user ID
   │  └─ Send email to borrower: "Request approved! Pick up by [date]"
   └─ Request removed from pending queue

5. Decline request
   ├─ Click "Decline" button
   ├─ Show reason selector:
   │  ├─ "Item not available"
   │  ├─ "Quantity exceeds limit"
   │  ├─ "Borrower has overdue items"
   │  ├─ "Custom reason"
   │  └─ Free-text notes field
   ├─ Click "Confirm Decline"
   ├─ Backend updates:
   │  ├─ Request status: "declined"
   │  ├─ Units released back to inventory
   │  ├─ decline_reason: saved
   │  └─ Email borrower: "Request denied: [reason]"
   └─ Request marked as declined

6. View photographic evidence
   ├─ Photos taken by borrower shown
   ├─ Can zoom/full-screen view
   ├─ Helps assess item condition
   └─ Attached to approval record
```

### 3. MANAGING ITEM RETURNS

**Return Processing**:

```
1. Click "Return Items" or "Pending Returns"
   └─ Navigate to /staff/return-items

2. Returns queue displays
   ├─ Items awaiting return processing
   ├─ Shows:
   │  ├─ Borrower name
   │  ├─ Items being returned
   │  ├─ Return photos
   │  ├─ Submission date
   │  └─ "Process Return" button

3. Review return
   ├─ Click return record
   ├─ View:
   │  ├─ Original items borrowed
   │  ├─ Return photos from borrower
   │  ├─ Condition assessment
   │  └─ Staff inspection area
   └─ Decide: Approve Return or Flag Issue

4. Process return (normal case)
   ├─ Inspect all returned items
   ├─ Verify condition vs. photos
   ├─ Take additional photos if needed (StaffReturnPhotoCaptureModal)
   ├─ Click "Confirm Return Accepted"
   ├─ Backend updates:
   │  ├─ Units status: "returned"
   │  ├─ Request status: "returned"
   │  ├─ Available quantity: incremented
   │  └─ Email borrower: "Return confirmed, items received"
   └─ Return completed

5. Flag damage/issues
   ├─ If item damaged during borrow:
   │  ├─ Click "Report Damage"
   │  ├─ Select item(s) affected
   │  ├─ Describe damage: [text]
   │  ├─ Rate severity: Minor/Moderate/Major
   │  ├─ Attach photos of damage
   │  └─ Submit
   ├─ Damage record created
   ├─ Item flagged in inventory
   ├─ Finance notified if repair needed
   └─ Borrower may be charged if gross negligence
```

### 4. MANAGING INVENTORY

**Inventory Management Page**:

```
1. Click "Manage Inventory" 
   └─ Navigate to /staff/manage-inventory

2. Inventory page displays
   ├─ List of all inventory items
   ├─ Search by item name
   ├─ Filter by category (Costume, Instrument, Accessory)
   ├─ Filter by group (Dulimbay, Budjong, Kayam)
   ├─ Each item shows:
   │  ├─ Name, image, category
   │  ├─ Total units
   │  ├─ Available units
   │  ├─ Reserved units
   │  ├─ Condition status
   │  ├─ Action buttons
   │  └─ "Edit" / "View Units" / "Delete"
   └─ "Add New Item" button

3. Add new inventory item
   ├─ Click "Add New Item"
   ├─ Form fields:
   │  ├─ Item name (required)
   │  ├─ Category dropdown (costume, instrument, accessory)
   │  ├─ Group/Division (Dulimbay, Budjong, Kayam)
   │  ├─ Description
   │  ├─ Upload image (JPG/PNG, max 2MB)
   │  ├─ Specify quantities per size:
   │  │  ├─ Small: __ units
   │  │  ├─ Medium: __ units
   │  │  └─ Large: __ units
   │  ├─ Condition initial status
   │  ├─ Date acquired
   │  ├─ Origin/indigenous group
   │  └─ Special notes/care instructions
   ├─ Click "Create Item"
   ├─ Backend:
   │  ├─ Creates inventory_items record
   │  ├─ Generates UUID for item ID
   │  ├─ Creates N inventory_units records (one per unit)
   │  ├─ Generates QR code for each unit
   │  ├─ Saves image to /public/uploads/inventory/
   │  └─ Returns item ID
   └─ Success: "Item created! #ITEM-123"

4. Edit inventory item
   ├─ Click "Edit" on item
   ├─ Modal opens with current data
   ├─ Can modify:
   │  ├─ Description, notes
   │  ├─ Condition status
   │  ├─ Image
   │  └─ Metadata (date acquired, origin)
   ├─ Click "Save Changes"
   └─ Item updated immediately

5. Manage units
   ├─ Click "View Units" on item
   ├─ Shows all individual units:
   │  ├─ Unit ID
   │  ├─ Unit number (e.g., SUYAM-M-1)
   │  ├─ Size
   │  ├─ Status (available, reserved, borrowed)
   │  ├─ QR code (view/reprint)
   │  └─ Actions (edit, delete)
   ├─ Can mark unit as:
   │  ├─ Maintenance (unavailable)
   │  ├─ Damaged (flagged)
   │  └─ Available (restore)
   └─ Delete lost/damaged units

6. Generate QR codes
   ├─ Each unit has unique QR code
   ├─ QR encodes: item_id + unit_number
   ├─ Print QR codes for physical labeling
   ├─ Click "Print QR" to get PDF
   └─ Scan with QR scanner to quickly add to cart

7. Delete item
   ├─ Click "Delete" (soft delete)
   ├─ Item marked as inactive
   ├─ Can be restored from archive
   ├─ Physical units archived
   └─ No longer appears in borrower view
```

### 5. SCHEDULING PERFORMANCES

**Performance Creation Workflow**:

```
1. Click "Schedule Performance"
   └─ Navigate to /staff/schedule

2. Click "New Schedule" button
   └─ Performance form opens (multi-step wizard)

3. STEP 1: Performance Details
   ├─ Form fields:
   │  ├─ Title: [text] (required)
   │  ├─ Location: [text]
   │  ├─ Date: [calendar picker] (required)
   │  ├─ Start time: [time dropdown] (required)
   │  └─ End time: [time dropdown] (required)
   ├─ Validation:
   │  ├─ Date must be in future
   │  ├─ End time > Start time
   │  └─ All required fields filled
   ├─ Click "Next" to proceed
   └─ Or "Save Draft" to continue later

4. STEP 2: Assign Performers
   ├─ FILTER BY DIVISION (NEW! All | Dulimbay | Budjong | Kayam)
   ├─ Shows list of available borrowers
   ├─ Each borrower has checkbox + name + email + division
   ├─ Select performers who will attend
   ├─ Multi-select allowed
   ├─ Minimum: 1 performer required
   ├─ Shows selected count: "3 performers selected"
   ├─ Click "Next" to proceed

5. STEP 3: Suggest Items
   ├─ Search items by name
   ├─ Shows all inventory items
   ├─ Select items to recommend
   ├─ Can suggest multiple sizes/quantities
   ├─ Minimum: 0 items (optional)
   ├─ Shows selected count: "5 items selected"
   ├─ Click "Next" to proceed

6. STEP 4: Review & Confirm
   ├─ Summary shows:
   │  ├─ Performance title, location
   │  ├─ Date and time
   │  ├─ List of performers
   │  ├─ List of suggested items
   │  └─ "Save Performance" button
   ├─ If correct, click "Save"
   ├─ Backend:
   │  ├─ Creates performances record
   │  ├─ Links performance_borrowers
   │  ├─ Links performance_items
   │  ├─ Sends notifications to performers:
   │  │  ├─ Email: "You're assigned to [Performance] on [date]"
   │  │  ├─ App notification
   │  │  └─ Items recommended
   │  └─ Returns performance ID
   ├─ Success: "Performance created! #PERF-123"
   └─ Redirect to performance details

7. View scheduled performances
   ├─ Calendar view of all performances
   ├─ Color-coded by status
   ├─ Filter by date range
   ├─ Search by title
   ├─ Click performance for details/edit/delete
   └─ See performance status and participation
```

**Performance Status Workflow**:
```
Before Date: "Upcoming"
    ├─ Performers can view recommended items
    └─ Quick borrow from recommendations

On/After Date: "In Progress" → "Completed"
    ├─ Items borrowed for performance
    ├─ Return tracking
    └─ Historical record
```

### 6. MASTER LIST CONFIGURATION

**Master List Access**:

```
1. Click "Master List Configuration" or Settings
   └─ Navigate to /staff/master-list

2. Tab-based interface appears
   ├─ Tabs: Units | Positions | Terms | Rules | Events | Categories | Settings | Slideshow
   └─ Content changes based on selected tab

3. UNITS TAB (Divisions/Organizational Units)
   ├─ Shows all divisions:
   │  ├─ Name: Dulimbay, Budjong, Kayam, Admin, Students
   │  ├─ Description
   │  ├─ Status: Active/Inactive
   │  ├─ Edit button, Delete button
   │  └─ View members (users in unit)
   ├─ Add new unit:
   │  ├─ Click "Add Unit"
   │  ├─ Form: Name, Description
   │  ├─ Click "Create"
   │  └─ Unit appears in list
   ├─ Edit unit:
   │  ├─ Click "Edit"
   │  ├─ Modify name/description
   │  ├─ Click "Save"
   │  └─ Updated immediately
   └─ Delete (soft): Mark as Inactive

4. POSITIONS TAB (Job Roles)
   ├─ Shows all positions:
   │  ├─ Position name
   │  ├─ Description
   │  ├─ Max holders (1 or more)
   │  ├─ Is shared role? (global vs. unit-specific)
   │  ├─ Status: Active/Inactive
   │  └─ Edit/Delete buttons
   ├─ Add new position: Form → Create
   ├─ Edit/Delete: Similar to units
   └─ Assign permissions per position

5. TERMS TAB (Academic Periods)
   ├─ Shows academic terms:
   │  ├─ Name: "2026-2027", "First Semester 2026"
   │  ├─ Start date, End date
   │  ├─ Status: Active/Inactive
   │  └─ Edit/Delete buttons
   ├─ Supports multiple active terms
   ├─ Used for: Org structure versioning
   └─ Add/Edit/Delete: Standard CRUD

6. OTHERS TABS (Rules, Events, Categories)
   ├─ Similar CRUD interface
   ├─ Rules: Organization conduct/borrowing rules
   ├─ Event Types: Performance categories
   ├─ Categories: Costume, Instrument, Accessory
   └─ Add/Edit/Delete operations

7. SLIDESHOW TAB (GetStarted Images)
   ├─ Shows carousel images for landing page
   ├─ Each image shows:
   │  ├─ Thumbnail preview
   │  ├─ Title
   │  ├─ Display order
   │  └─ Edit/Delete buttons
   ├─ Add new image:
   │  ├─ Click "Add Image"
   │  ├─ Upload file (JPG/PNG, max 5MB)
   │  ├─ Enter title/description
   │  ├─ Set display order
   │  └─ Click "Save"
   ├─ Edit: Modify title, order, image
   └─ Delete: Remove from slideshow

8. Settings TAB (System Configuration)
   ├─ Default borrow duration: 30 days
   ├─ Max overdue items: 2
   ├─ Notification settings
   ├─ Email server configuration
   └─ Backup/restore options
```

### 7. STAFF HISTORY & REPORTING

**Staff History Page**:

```
1. Click "History" in staff sidebar
   └─ Navigate to /staff/history

2. View all borrowing requests
   ├─ System-wide view (not just own)
   ├─ Filters:
   │  ├─ Status: All, Pending, Approved, Returned, Declined
   │  ├─ Date range picker
   │  ├─ Borrower name search
   │  └─ Item name search
   ├─ Results show:
   │  ├─ Request ID
   │  ├─ Borrower name
   │  ├─ Items (count)
   │  ├─ Request date
   │  ├─ Status
   │  └─ Staff notes
   └─ Click for full details

3. Analytics displayed
   ├─ Total requests this month
   ├─ Approved vs. Declined rate
   ├─ Most borrowed items
   ├─ Avg request duration
   └─ Overdue statistics

4. Export as Report
   ├─ Generate CSV download
   ├─ Includes all request details
   ├─ Suitable for analysis
   └─ Fire-and-forget download
```

---

## ADMIN WORKFLOWS

### 1. ADMIN LOGIN & DASHBOARD

**Dashboard**:

```
Displays:
├─ Welcome: "Hello [Admin Name]"
├─ System Statistics:
│  ├─ Total users (borrower, staff, admin counts)
│  ├─ Total items in inventory
│  ├─ Total requests this month
│  ├─ Overdue items count
│  └─ System health status
├─ Quick actions:
│  ├─ "Manage Users"
│  ├─ "View Reports"
│  ├─ "Master List Config"
│  └─ "System Settings"
└─ Recent activity log
```

### 2. USER MANAGEMENT

**User Management Page**:

```
1. Click "Manage Users"
   └─ Navigate to /admin/users

2. User list displays
   ├─ Search by name/email
   ├─ Filter: Role (All, Borrower, Staff, Admin)
   ├─ Filter: Status (Active, Inactive)
   ├─ Sort: By date joined, alphab

etically
   ├─ Table shows:
   │  ├─ Name, Email
   │  ├─ Role (with edit dropdown)
   │  ├─ Division
   │  ├─ Join date
   │  ├─ Last login
   │  ├─ Status (Active/Inactive)
   │  ├─ Action buttons
   │  └─ "Edit User" link
   └─ "Add New User" button (admin creates account)

3. View user profile
   ├─ Click user row
   ├─ Shows detail page:
   │  ├─ Basic info (name, email, phone, division)
   │  ├─ Account status
   │  ├─ Role
   │  ├─ Joined date
   │  ├─ Recent borrowing activity
   │  ├─ Outstanding requests
   │  └─ Edit/Deactivate buttons
   └─ Close to return to list

4. Edit user role
   ├─ Click role dropdown in user row
   ├─ Options: Borrower → Staff → Admin
   ├─ Click to change
   ├─ Confirmation: "Change [Name]'s role to [Role]?"
   ├─ Click "Confirm"
   ├─ Backend updates: users.role
   ├─ Email sent to user: "Your role updated to [Role]"
   └─ User must re-login for changes to take effect

5. Assign division
   ├─ Click division column
   ├─ Dropdown with all divisions
   ├─ Select appropriate division
   ├─ Save immediately
   └─ Used for filtering/organization

6. Deactivate user
   ├─ Click "Deactivate" button
   ├─ Confirmation dialog
   ├─ User account suspended
   ├─ Cannot login
   ├─ Can be reactivated later
   └─ Borrowing requests unchanged (historical record)

7. Delete user (permanent)
   ├─ Admin only, requires confirmation
   ├─ User account permanently deleted
   ├─ All borrowing requests deleted
   ├─ Profile photos deleted
   ├─ CANNOT BE UNDONE
   └─ Use sparingly (use deactivate instead)

8. Add new user (admin-created)
   ├─ Click "Add New User"
   ├─ Form:
   │  ├─ Name, Email, Phone
   │  ├─ Initial Role: Borrower/Staff/Admin
   │  ├─ Division assignment
   │  └─ "Create Account" button
   ├─ Backend:
   │  ├─ Creates users record
   │  ├─ Generates temporary password
   │  ├─ Sends email with login link
   │  └─ User sets real password on first login
   └─ User account activated
```

### 3. ADVANCED REPORTING

**Reports Page**:

```
1. Click "View Reports" / "Reports" in admin sidebar
   └─ Navigate to /admin/reports

2. Report selection interface
   ├─ Options:
   │  ├─ Monthly Report (current/previous months)
   │  ├─ Borrower Report (per borrower)
   │  ├─ Inventory Report (stock levels)
   │  ├─ Performance Report (event attendance)
   │  └─ System Health (uptime, errors)
   └─ Select report type

3. Monthly Report Generation
   ├─ Choose month/year
   ├─ Click "Generate Report"
   ├─ System processes:
   │  ├─ Counts total requests
   │  ├─ Calculates return rates
   │  ├─ Identifies overdue items
   │  ├─ Tracks inventory changes
   │  └─ Compiles statistics
   ├─ Report displays:
   │  ├─ Summary statistics
   │  ├─ Requests breakdown by status
   │  ├─ Top borrowed items
   │  ├─ Overdue/damaged items
   │  ├─ Staff approval rates
   │  ├─ Charts/graphs visualizing trends
   │  └─ Detailed item list
   ├─ Export options:
   │  ├─ Download CSV
   │  ├─ Download PDF
   │  └─ Generate plaintext printable version
   └─ Reports saved to database for history

4. Borrower Report
   ├─ Select borrower from dropdown
   ├─ Shows their complete history:
   │  ├─ All requests with items
   │  ├─ Return status
   │  ├─ Approval dates
   │  ├─ Any damage reports
   │  ├─ Overdue count
   │  └─ Borrowing frequency
   ├─ Export as PDF (portfolio piece)
   └─ Verification tool for verification requests

5. Inventory Report
   ├─ Current stock levels:
   │  ├─ Total units per item
   │  ├─ Available units
   │  ├─ Reserved units
   │  ├─ Items needing maintenance
   │  └─ Missing/damaged units
   ├─ Item health:
   │  ├─ Condition assessments
   │  ├─ Repair needs
   │  └─ Expected replacement timeline
   ├─ Reports usage patterns:
   │  ├─ Most borrowed items
   │  ├─ Seasonal trends
   │  └─ Utilization rates
   └─ Helps with acquisition planning

6. System Health Report
   ├─ Shows:
   │  ├─ Database size & performance
   │  ├─ API response times
   │  ├─ File storage usage
   │  ├─ Error logs summary
   │  ├─ Service uptime %
   │  └─ Notification delivery rate
   └─ Identifies issues needing attention
```

### 4. MASTER LIST ADMINISTRATION

*Same as Staff tab interface, but Admin can:*
- Manage all entries (Staff can only view/suggest)
- Create system-wide configurations
- Archive old entries
- View audit trail of changes
- Reset to defaults

### 5. SYSTEM ADMINISTRATION

**Advanced Settings (Admin Only)**:

```
1. System Configuration
   ├─ Borrow duration: [days] (default 30)
   ├─ Max items per request: [number]
   ├─ Overdue grace period: [days]
   ├─ Notification reminders: [days before due]
   └─ Email configuration: SMTP settings

2. File Management
   ├─ Upload limits (JPG/PNG/PDF sizes)
   ├─ Storage quota management
   ├─ Cleanup old files/photos
   └─ Backup/restore functions

3. Security Settings
   ├─ Password policy: Min length, special chars
   ├─ Session timeout: [minutes]
   ├─ 2FA requirement: Mandatory/Optional
   ├─ API rate limiting
   └─ CORS whitelist configuration

4. Email Server Configuration
   ├─ SMTP host, port, credentials
   ├─ Sender email address
   ├─ Test email send
   └─ Email template customization

5. Notification Settings
   ├─ Push notification enabled/disabled
   ├─ VAPID keys management
   ├─ Notification queue status
   └─ Resend mechanism configuration

6. Database Maintenance
   ├─ Backup schedule
   ├─ Dataset size analyzer
   ├─ Query performance monitor
   ├─ Index maintenance
   └─ Data integrity checks

7. Activity Logs
   ├─ View audit trail:
   │  ├─ User logins
   │  ├─ Permission changes
   │  ├─ Master list edits
   │  ├─ Report generation
   │  └─ Data deletions
   └─ Export audit log
```

### 6. ADMIN HISTORY & SYSTEM AUDIT

```
1. Navigate to /admin/history
2. System-wide activity log
3. Filter by: User, Action, Date range
4. Search: Result details
5. View audit trail for compliance
```

---

## SYSTEM-WIDE WORKFLOWS

### 1. EMAIL VERIFICATION SYSTEM

```
User registers with email
    ↓
System generates random 6-digit code
    ↓
Nodemailer sends email with code
Subject: "Verify your UCCA account"
    ├─ Code: XXXXXX
    ├─ Expires in: 15 minutes
    ├─ Valid for single-use only
    └─ Link: [baseurl]/verify-email

User opens email
    ↓
Click link or open verification page
    ↓
Enter 6-digit code
    ↓
Backend verifies:
├─ Code exists in email_verification_tokens table
├─ Not yet used (is_used = FALSE)
├─ Not expired (created_at > NOW - 15 min)
├─ Belongs to user's email
    ↓
If valid:
├─ Set verified_at = NOW
├─ Set is_used = TRUE
├─ Update users.is_verified = TRUE
├─ Allow login/access
└─ Delete token from table

If invalid:
├─ Show error
├─ Allow retry
└─ Option to resend code
```

### 2. PUSH NOTIFICATION SYSTEM

```
Browser Support Check:
├─ "serviceWorker" in navigator?
├─ "PushManager" in window?
└─ HTTPS enabled?

If supported:
    ├─ User enables notifications
    ├─ Request browser permission
    └─ Browser shows: "Allow [App] to send notifications?"

If permitted:
    ├─ Register service worker (/public/service-worker.js)
    ├─ Generate VAPID key pair
    ├─ Subscribe user to push:
    │  ├─ Endpoint: [unique URL from browser]
    │  ├─ p256dh: [encryption key]
    │  └─ auth: [auth secret]
    ├─ Save subscription to:
    │  ├─ Database: push_subscriptions table
    │  └─ localStorage (for offline detection)
    └─ Mark: notifications_enabled = TRUE

When event occurs server-side:
    ├─ Create notification payload:
    │  ├─ title: "Request Approved"
    │  ├─ body: "Your request #123 approved"
    │  ├─ icon: [app icon URL]
    │  ├─ data: {requestId: 123, path: "/my-borrowed"}
    │  └─ tag: "request-123" (prevent duplicates)
    ├─ Send via web-push library:
    │  ├─ POST to subscription.endpoint
    │  ├─ Encrypted with p256dh + auth
    │  ├─ VAPID header for identification
    │  └─ Include app public key
    └─ Browser receives → Service worker intercepts

Service Worker Handles:
    ├─ Show desktop notification
    ├─ Play sound (if configured)
    ├─ Set badge count
    └─ Add to notification center

User Clicks Notification:
    ├─ Service worker catches 'click' event
    ├─ Extract data.path from notification
    ├─ If app already open:
    │  └─ navigate() to path internally (SPA)
    ├─ If app closed:
    │  └─ Open app + navigate to path
    └─ Route shows relevant page
```

### 3. INACTIVITY TIMEOUT SYSTEM

```
User logs in
    ├─ Set inactivity timer: [configurable, default 30 min]
    ├─ Start tracking user actions
    └─ Connect EventListener: mousemove, click, keypress

On each user action:
    ├─ Clear old timeout
    ├─ Reset timer
    └─ Countdown begins again

If timer expires (inactivity):
    ├─ Show warning dialog:
    │  ├─ "Your session is expiring due to inactivity"
    │  ├─ Countdown: 5 minutes remaining
    │  ├─ "Continue Session" button
    │  └─ "Logout" button
    ├─ If user clicks "Continue":
    │  ├─ Reset timer
    │  └─ Close dialog
    ├─ If user clicks "Logout" OR timer expires:
    │  ├─ Clear JWT token
    │  ├─ Clear localStorage (partial or full)
    │  ├─ Redirect to /login
    │  └─ Show message: "Session expired"
    └─ User must re-login

Session Recovery (optional feature):
    ├─ If server has session record:
    ├─ User can "Resume Session"
    ├─ Redirects back to where they were
    └─ No need to re-login
```

### 4. PERFORMANCE RECOMMENDATION ENGINE

```
When new performance created:
    ├─ Staff selects date + performers + suggested items
    ├─ System creates performance record
    └─ Calculates recommendation per borrower

For each borrower in performance:
    ├─ Look up suggested items
    ├─ Determine quantity & size needed:
    │  ├─ E.g., "Suyam size Medium x 2"
    │  ├─ E.g., "Tapis size Large x 1"
    │  └─ E.g.,"Pandavas no size x 3"
    ├─ Create performance_recommendations record
    │  ├─ Unique: (performance_id, borrower_id, item_id, size)
    │  ├─ is_viewed = FALSE initially
    │  └─ created_at = NOW
    └─ Mark: "is_viewed" = FALSE

When borrower views recommendations:
    ├─ Fetch all performance_recommendations where borrower_id = user.id
    ├─ Display in upcoming performance section
    ├─ Show:
    │  ├─ Performance name + date
    │  ├─ Recommended items with quantity/size
    │  ├─ "Quick Borrow" button per item
    │  └─ "View Full Performance" link
    ├─ When borrower clicks:
    │  └─ Set is_viewed = TRUE
    └─ Mark as read

Quick Borrow from Recommendation:
    ├─ Click "Quick Borrow" on recommended item
    ├─ Item automatically added to cart with:
    │  ├─ Quantity = recommendation.quantity
    │  ├─ Size = recommendation.size
    │  └─ Context = performance.id
    ├─ Follow normal checkout flow
    └─ Request links back to performance
```

### 5. IMAGE & FILE UPLOAD WORKFLOW

```
User selects image to upload:
1. File validation:
   ├─ Format: JPG, JPEG, PNG (exclude GIF, BMP)
   ├─ Size: < 2MB for inventory, < 5MB for profiles
   └─ If invalid → Show error, abort

2. Frontend:
   ├─ Convert file to base64 or FormData
   ├─ Include metadata: filename, mimetype, size
   ├─ POST to /api/[upload-endpoint]
   └─ Show progress bar (if file > 1MB)

3. Backend multer middleware:
   ├─ Validate file again
   ├─ Generate unique filename:
   │  ├─ Format: {Date.now()}-{randomString}-{originalName}
   │  ├─ Prevents name conflicts
   │  └─ Creates safe filesystem path
   ├─ Save to /public/uploads/{category}/{userId}/
   │  ├─ Categories: inventory, profiles, borrow-photos, return-photos, slideshow
   │  ├─ Organized by user for access control
   │  └─ Prevents directory traversal attacks
   └─ Store filename in database

4. Optional image processing (Sharp):
   ├─ Resize to max width: 1200px
   ├─ Optimize compression
   ├─ Convert to progressive JPEG
   └─ Reduce file size for storage

5. Database record:
   ├─ Save file metadata:
   │  ├─ image_url: /uploads/category/userId/filename
   │  ├─ image_filename: original filename
   │  ├─ file_size: bytes
   │  ├─ mime_type: image/jpeg
   │  └─ uploaded_at: NOW
   └─ Link to parent record (inventory, user, request, etc.)

6. Frontend:
   ├─ Receive response with image_url
   ├─ Display image:
   │  ├─ Thumbnail preview in modal
   │  ├─ Full-size in lightbox
   │  └─ Download option
   └─ On deletion → DELETE /api/upload/{imageId}

7. Cleanup (when deleting parent record):
   ├─ Find all images linked to record
   ├─ Delete from filesystem (via fs.unlink)
   ├─ Delete database records
   └─ Free up storage space
```

### 6. QR CODE GENERATION & SCANNING

```
QR Code Generation (per inventory unit):

1. When unit created:
   ├─ Generate unique code:
   │  ├─ Format: "{item_id}_{unit_number}"
   │  ├─ Example: "123e4567_SUYAM_M_1"
   │  └─ Contains item and unit info
   ├─ Encode as QR using qrcode library
   └─ Save as image: /public/qr_codes/{unit_id}.png

2. Print QR codes:
   ├─ Staff can print QR code per unit
   ├─ Stick physical label on item
   ├─ QR remains throughout item lifecycle
   └─ Provides quick access

QR Code Scanning (borrower/staff):

1. Click "Scan QR" in app
   └─ Navigate to /scan

2. ScanQR.jsx initializes:
   ├─ Request camera permission
   ├─ Open camera feed
   ├─ html5-qrcode activates scanner
   └─ Camera preview displayed

3. Point camera at QR code:
   ├─ Scanner detects QR in video feed
   ├─ Decode string: "{item_id}_{unit_number}"
   ├─ Parse to extract:
   │  ├─ item_id = 123e4567
   │  └─ unit_number = SUYAM_M_1
   └─ Call API: /api/inventory/unit/{unit_id}

4. Backend lookup:
   ├─ Find inventory_unit where unit_id = scanned_id
   ├─ Get linked inventory_item
   ├─ Check unit status:
   │  ├─ If available → Can borrow
   │  ├─ If reserved/borrowed → Already taken
   │  └─ If maintenance → Unavailable
   └─ Return item details

5. Frontend displays:
   ├─ Item found! [name]
   ├─ Item image
   ├─ Details (category, group, condition)
   ├─ Unit info (size, unit number)
   ├─ "Add to Cart" button
   └─ "Scan Another" button

6. Add to cart:
   ├─ Click "Add to Cart"
   ├─ Item added with full unit details
   ├─ Quantity defaults to 1
   └─ Proceed to checkout

7. Error handling:
   ├─ QR code not recognized:
   │  └─ "Unable to scan. Try again or enter manually"
   ├─ Unit not found:
   │  └─ "Item not found in system"
   ├─ Unit unavailable:
   │  └─ "Item currently unavailable"
   └─ Camera permission denied:
      └─ "Camera access required to scan"
```

---

**Document Continues in Separate Files**  
For complete details, see:
- API_REFERENCE.md - All endpoints
- SCANNER_DOCUMENTATION.md - QR & AI scanners
- FEATURE_DOCUMENTATION.md - Detailed features

---

**Last Updated**: April 12, 2026
**Document Version**: 1.0.0
**For Capstone Project**: University Cultural Center Association Inventory Management System
