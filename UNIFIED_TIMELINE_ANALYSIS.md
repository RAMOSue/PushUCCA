# Unified Staff Borrow Timeline - Complete Analysis & Implementation Plan

**Vision**: Merge `ManageBorrowRequests` + `ReturnItems` into ONE unified page with barline timeline  
**Goal**: Staff sees complete request lifecycle: Pending → Approved → In Office (Pending Return) → Returned

---

## 📊 Current State (Two-Page System)

### Page 1: ManageBorrowRequests
**URL**: `/staff/manage-requests`  
**Shows**: Pending & approved requests  
**Actions**: Approve or Decline pending requests

```
Statuses shown:  pending  →  approved  →  declined ❌
Data fetched: GET /api/borrow/requests
Actions:
  - pendingRequest → approve → PUT /api/borrow/requests/:id/approve
  - pendingRequest → decline → PUT /api/borrow/requests/:id/decline
```

**Current Structure**:
```javascript
{
  id, borrower_id, borrower_name, borrower_email, status,
  request_date, due_date, returned_at, quantity, item_count, items
}
```

### Page 2: ReturnItems
**URL**: `/staff/return-items`  
**Shows**: Approved & pending_return & returned requests  
**Actions**: Approve return, decline return, manual return

```
Statuses shown:  approved  →  pending_return  →  returned
Data fetched: GET /api/borrow/requests (filters for return statuses)
Actions:
  - approvedRequest → borrower submits → pending_return → approve → POST /api/borrow/return/approve
  - approvedRequest → can also manually return → POST /api/borrow/return/manual
  - pending_return → decline → POST /api/borrow/return/decline (moves back to approved)
```

---

## 🎯 Proposed State (Unified Timeline System)

### Single Page: StaffBorrowTimeline (or BorrowManager)
**URL**: `/staff/manage-borrows` or keep as `/staff/manage-requests` (consolidate)  
**Shows**: ALL requests in 4-stage timeline  
**Timeline**: Pending (25%) → Approved (50%) → In Office (75%) → Returned (100%)

```
┌─────────────────────────────────────────────────────────────┐
│ PENDING (25%) → APPROVED (50%) → IN OFFICE (75%) → RETURNED (100%)│
└─────────────────────────────────────────────────────────────┘

Stage 1: PENDING
└─ Actions: Approve, Decline

Stage 2: APPROVED
└─ Actions: Auto-Approve Return (staff receives), Manual Return (staff captures photos)

Stage 3: PENDING_RETURN (In Office)
└─ Status: Borrower submitted return for approval
└─ Actions: Approve Return, Decline Return (move back to approved)

Stage 4: RETURNED
└─ Status: Fully completed
└─ Actions: View Photos

Sections (by urgency):
1. 🔴 OVERDUE (approved + past due date)
2. 🟡 DUE TODAY (due today)
3. 🟠 DUE SOON (due in 1-2 days)
4. 🔵 TO RETURN (approved + >2 days away)
5. ⚪ PENDING APPROVAL (pending status)
6. ⚫ PENDING REVIEW (pending_return status)
7. 🟢 COMPLETED (returned status)
```

---

## 📋 Data Flow Comparison

### Current: Two Separate Fetches
```javascript
// ManageBorrowRequests page:
GET /api/borrow/requests
└─ Returns all statuses
└─ Frontend filters: pending & approved

// ReturnItems page:
GET /api/borrow/requests
└─ Returns all statuses
└─ Frontend filters: approved & pending_return & returned
```

### Proposed: Single Fetch + Smart Display
```javascript
// Unified Timeline page:
GET /api/borrow/requests
└─ Returns all statuses (same endpoint!)
└─ Frontend filters by urgency + status
└─ Single data source for entire lifecycle
```

**✅ NO NEW ENDPOINTS NEEDED** - Use existing `/api/borrow/requests`!

---

## 🔄 Complete Status Lifecycle (4 Stages)

```
START
  ↓
pending ━━━━━━━━━━━━━━━━━━━━━━━━┓
  │                             ↓
  │ (Staff approves)      declineReturn
  ↓                             ↓
approved ━━━━━━━━━━━━━━━━━━━━━→ approved (again)
  │                             ↑
  │ (Borrower submits return)   │
  ↓                             │
pending_return                  │
  │                             │
  ├─→ (Staff approves return)→ returned
  │
  └─→ (Staff declines return)→ approved (again)
```

---

## 🎨 UI Layout: Unified Timeline

### Visual Structure
```
┌─────────────────────────────────────────────────────────┐
│ STAFF BORROW MANAGEMENT                                 │
│ [Total] [Pending] [Approved] [In Review] [Completed]   │
├─────────────────────────────────────────────────────────┤
│ [Search] [Filters] [Status Dropdown]                    │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ 🔴 OVERDUE (X)                                          │
│ ├─ [Card 1] PENDING(25%)→APPROVED(50%)→IN OFFICE(75%)│
│ │           Date submitted | Date approved | Due:  |
│ │  [Approve] [Decline]     [Manual Return]|       |
│ │                                          |       |
│ │  [Photos] [Items List]                  |       |
│ │                                                  |
│ ├─ [Card 2] APPROVED(50%)→IN OFFICE(75%)→RETURNED|
│ │           Date approved | Due: 3 days
│ │  [Mark Received] [Manual Return]
│ │  [Item 1] x2   [Item 2] x1
│ │
│ 🟡 DUE TODAY (X)
│ ├─ [Card 3]...
│
│ 🟠 DUE SOON (X)
│ ├─ [Card 4]...
│
│ 🔵 TO RETURN (X)
│ ├─ [Card 5]...
│
│ ⚪ PENDING APPROVAL (X)
│ ├─ [Card 6]...
│
│ ⚫ PENDING REVIEW (X) - NEW!
│ ├─ [Card 7] PENDING_RETURN(75%)→RETURNED(100%)
│ │           Date returned | Due: Oct 15
│ │  [Approve Return] [Decline Return]
│ │  [Photos Submitted] [Items Verified]
│
│ 🟢 COMPLETED (X)
│ ├─ [Card 8]...
│
└─────────────────────────────────────────────────────────┘
```

---

## 🔧 Backend Requirements Analysis

### ✅ Good News: All Endpoints Exist!

#### Request Approval Flow
```
1. GET /api/borrow/requests
   └─ Returns: id, status, request_date, due_date, items[], etc.

2. PUT /api/borrow/requests/:id/approve
   Payload: { staff_id, due_date }
   └─ Updates: status → "approved", sets approved_at

3. PUT /api/borrow/requests/:id/decline
   └─ Updates: status → "declined"
```

#### Return Approval Flow
```
1. POST /api/borrow/return/approve
   Payload: { borrowing_request_id }
   └─ Updates: status → "returned", returned_at = NOW()

2. POST /api/borrow/return/decline
   Payload: { borrowing_request_id, reason? }
   └─ Updates: status → "approved" (moves back for resubmission)

3. POST /api/borrow/return/manual
   Payload: { borrowing_request_id }
   └─ Updates: status → "returned" (staff marks without photos)

4. POST /api/borrow/return/manual-with-photos
   Files: photos[] (multipart)
   └─ Updates: status → "returned" (staff marks with photo proof)
```

### ⚠️ Critical Issue: Missing Fields in getAllBorrowRequests

**Current SQL SELECT**:
```sql
SELECT 
  br.id, br.borrower_id, u.name AS borrower_name,
  br.status, br.created_at AS request_date,
  br.due_date, br.returned_at, br.quantity, br.item_count,
  br.submitted_at
  ❌ MISSING: approved_at
  ❌ MISSING: return_decline_reason
  ❌ MISSING: declined_at
```

**Required for timeline**:
```sql
SELECT 
  br.id, br.borrower_id, u.name AS borrower_name, u.email,
  br.status, br.created_at AS request_date, br.approved_at,
  ✅ br.approved_at          -- When status became "approved"
  ✅ br.return_decline_reason -- Why staff declined return
  ✅ br.declined_at           -- When return was declined
  ✅ br.due_date, br.returned_at
```

---

## 📝 Stage-Specific UI & Actions

### Stage 1: PENDING (25%)
**Status**: Request submitted, awaiting staff review  
**Display**: Request date  
**Actions**:
- ✅ Approve: Open due-date picker → PUT `/api/borrow/requests/:id/approve`
- ❌ Decline: YES/NO confirmation → PUT `/api/borrow/requests/:id/decline`
- 📸 View: Photos submitted by borrower (if any)

### Stage 2: APPROVED (50%)
**Status**: Staff approved, item ready for pickup  
**Display**: Approval date, Due date  
**Actions**:
- ✅ "Mark as Received": Set status to returned manually → POST `/api/borrow/return/manual`
- ✅ "Receive with Photos": Capture return photos → POST `/api/borrow/return/manual-with-photos`
- ⏰ Show due date and days remaining
- 🔴 Show overdue warning if past due

### Stage 3: PENDING_RETURN (75%) - NEW Section!
**Status**: Borrower submitted return, staff reviewing verification  
**Display**: Return submission date, Due date  
**Actions**:
- ✅ Approve Return: Mark items as received → POST `/api/borrow/return/approve`
- ❌ Decline Return: Request re-submission → POST `/api/borrow/return/decline`
- 📸 View return photos submitted by borrower
- 📋 Verify item quantities vs. submitted return

### Stage 4: RETURNED (100%)
**Status**: Item successfully returned and accepted  
**Display**: Return date (returned_at)  
**Actions**:
- 📸 View return photos
- 👀 Read-only mode

---

## ✅ Backend Updates Required

### CRITICAL - Priority 1: Fix getAllBorrowRequests SQL (5 min)

**File**: `server/controllers/borrowController.js:774`  
**Change**: Add 3 missing SELECT fields

```diff
const getAllBorrowRequests = async (req, res) => {
  const requestsRes = await pool.query(
    `SELECT 
       br.id,
       br.borrower_id,
       u.name AS borrower_name,
       u.email AS borrower_email,
       br.status,
       br.created_at AS request_date,
+      br.approved_at,              -- ✅ ADD THIS
       br.due_date,
       br.returned_at,
+      br.return_decline_reason,    -- ✅ ADD THIS
+      br.declined_at,              -- ✅ ADD THIS
       br.quantity,
       br.item_count,
       br.submitted_at
     FROM borrowing_requests br
     JOIN users u ON u.id = br.borrower_id
     ORDER BY br.created_at DESC`
  );
```

**Impact**: All timeline progress calculations will work correctly

---

### IMPORTANT - Priority 2: Return Decline Should Store Reason (Optional but recommended)

**Current**: `POST /api/borrow/return/decline` doesn't accept or store decline_reason  
**Fix Location**: `server/controllers/borrowController.js:2385`

```javascript
const declineReturn = async (req, res) => {
  const { borrowing_request_id, reason } = req.body;  // ✅ Accept reason
  
  // ... validation code ...
  
  // Update with reason stored
  await client.query(
    `UPDATE borrowing_requests 
     SET status = 'approved', 
+        return_decline_reason = $1,
+        declined_at = NOW()
     WHERE id = $2`,
-    [borrowing_request_id]
+    [reason || null, borrowing_request_id]
  );
```

**Impact**: Staff can document WHY return was rejected (for audit trail)

---

## 📱 Frontend Updates Required

### CRITICAL - Priority 1: Create Unified Timeline Component

**New File**: `client/src/pages/Staff/StaffBorrowTimeline.jsx`  
(or replace ManageBorrowRequests with extended version)

**Structure**:
```javascript
// 1. Copy helper functions from MyBorrowedItems (adapt for staff context)
- formatDate()
- getDaysFromToday()
- getStatusConfig()
- getProgress() → 25, 50, 75, 100
- isOverdue()
- formatRelativeDays()

// 2. Data fetching
- fetchRequests() → GET /api/borrow/requests (all statuses)
- fetchPhotos(requestId) → GET /api/borrow/photos/:requestId

// 3. Organization logic (7 sections by urgency)
- renderOverdue()
- renderDueToday()
- renderDueSoon()
- renderToReturn()
- renderPendingApproval()
- renderPendingReview() ← NEW: pending_return status
- renderCompleted()

// 4. Action handlers
- handleApprove(id) → PUT /api/borrow/requests/:id/approve
- handleDecline(id) → PUT /api/borrow/requests/:id/decline
- handleApproveReturn(id) → POST /api/borrow/return/approve
- handleDeclineReturn(id) → POST /api/borrow/return/decline
- handleManualReturn(id) → POST /api/borrow/return/manual
- handleManualReturnWithPhotos(id) → POST /api/borrow/return/manual-with-photos

// 5. Timeline rendering (same as MyBorrowedItems)
- Dashed progress line
- Solid progress line (colored by stage)
- Status dot with date
- Progress percentage label
```

### Timeline Data Structure (Per Request)
```javascript
{
  id: 1,
  borrower_id: 5,
  borrower_name: "John Smith",
  borrower_email: "john@example.com",
  status: "pending" | "approved" | "pending_return" | "returned" | "declined",
  
  // Timeline dates (CRITICAL)
  created_at: "2025-10-01T10:00:00Z",        // Request created
  request_date: "2025-10-01T10:00:00Z",      // Same as created_at
  approved_at: "2025-10-02T14:30:00Z",       // When approved (NULL if not approved)
  due_date: "2025-10-10T00:00:00Z",          // Due date set at approval
  returned_at: "2025-10-12T16:45:00Z",       // When marked returned
  declined_at: "2025-10-02T15:00:00Z",       // When return was declined (NULL if not)
  return_decline_reason: "Items incomplete", // Why return was declined
  
  // Stats
  quantity: 5,
  item_count: 3,
  
  // Items array
  items: [
    {
      item_id: "uuid",
      item_name: "Royal Blue Gown",
      borrowed_quantity: 2,
      returned_quantity: 1,
      unit_ids: [
        { unit_id: 1, unit_status: "borrowed", size: "M" }
      ]
    }
  ]
}
```

### Progress Calculation (Same as MyBorrowedItems)
```javascript
function getProgress(status) {
  return {
    "pending": 25,
    "approved": 50,
    "pending_return": 75,
    "returned": 100,
    "declined": 0  // Show as incomplete
  }[status];
}
```

### Action Button Visibility
```javascript
if (status === "pending") {
  show: [Approve] [Decline]
}
if (status === "approved") {
  show: [Mark as Received] [Capture Return Photos]
  if (overdue) show: ⚠️ Overdue badge
}
if (status === "pending_return") {
  show: [Approve Return] [Decline Return]
  show: [Return Photos]
}
if (status === "returned") {
  show: [View Photos]
}
if (status === "declined") {
  show: Read-only with decline reason
}
```

---

### IMPORTANT - Priority 2: Update Route Configuration

**File**: `client/src/App.jsx`

```javascript
// Change from two routes:
<Route path="manage-requests" element={<ManageBorrowRequests />} />
<Route path="return-items" element={<ReturnItems />} />

// To single unified route:
<Route path="manage-requests" element={<StaffBorrowTimeline />} />
<Route path="return-items" element={<StaffBorrowTimeline />} /> // Redirect or same component

// Or better: Create single canonical URL
<Route path="borrow-management" element={<StaffBorrowTimeline />} />
<Route path="manage-requests" element={<Navigate to="borrow-management" />} />
<Route path="return-items" element={<Navigate to="borrow-management" />} />
```

---

### NICE-TO-HAVE - Priority 3: Deprecate Old Pages

After unified timeline is live:
- Move ManageBorrowRequests → ManageBorrowRequests.old.jsx
- Move ReturnItems → ReturnItems.old.jsx
- Update all navigation links to point to new unified page

---

## 📊 Summary Table: Before vs After

| Aspect | Before (2 Pages) | After (1 Timeline) |
|--------|---|---|
| **Pages** | ManageBorrowRequests + ReturnItems | StaffBorrowTimeline |
| **API Calls** | GET requests twice | GET requests once |
| **Data Redundancy** | YES (both fetch same endpoint) | NO (single fetch) |
| **Status Display** | Fragmented across pages | Unified 4-stage timeline |
| **Pending Return** | Hidden in ReturnItems | Visible as stage 3 section |
| **User Navigation** | Switch between 2 pages | All info on 1 page |
| **Mobile Experience** | Horizontal scrolling between tabs | Vertical scroll single timeline |
| **Staff Efficiency** | Must coordinate between pages | Single view of full lifecycle |

---

## 🚀 Implementation Roadmap

### Phase 1: Backend (10 minutes) ⚡ CRITICAL
1. Update SQL in `getAllBorrowRequests` → add 3 missing fields
2. (Optional) Update `/api/borrow/return/decline` → accept and store reason
3. Test GET /api/borrow/requests returns all required fields
4. ✅ COMPLETE - Ready for frontend

### Phase 2: Frontend Component (2-3 hours)
1. Create `StaffBorrowTimeline.jsx` base structure
2. Copy + adapt helper functions from MyBorrowedItems
3. Implement 7-section organization & sorting logic
4. Implement timeline progress bar visualization
5. Implement expandable request cards with items
6. Add action buttons for each stage
7. Test with real data
8. ✅ COMPLETE - Demo and validate

### Phase 3: Navigation & Cleanup (30 minutes)
1. Update App.jsx routes to use unified page
2. Update sidebar/navigation links
3. (Optional) Archive old page files
4. Update any deep links
5. ✅ COMPLETE - Deploy

### Phase 4: Polish & Testing (1 hour)
1. Test all status transitions
2. Test photo viewing/uploading
3. Test return decline with reason
4. Test overdue calculations
5. Dark mode validation
6. Mobile responsiveness
7. ✅ COMPLETE

---

## 🔑 Key Implementation Details

### Timeline Color Mapping (Keep Consistent)
```javascript
pending:       orange/amber (25%)
approved:      blue (50%)
pending_return: yellow/amber (75%)
returned:      green (100%)
declined:      gray/red
```

### Section Headers (by urgency)
```javascript
1. 🔴 OVERDUE
   Filter: status==="approved" && getDaysFromToday(due_date) < 0
   Color: text-red-600

2. 🟡 DUE TODAY
   Filter: getDaysFromToday(due_date) === 0
   Color: text-yellow-600

3. 🟠 DUE SOON
   Filter: getDaysFromToday(due_date) >= 1 && <= 2
   Color: text-orange-600

4. 🔵 TO RETURN
   Filter: status==="approved" && getDaysFromToday(due_date) > 2
   Color: text-blue-600

5. ⚪ PENDING APPROVAL
   Filter: status==="pending"
   Color: text-gray-600

6. ⚫ PENDING REVIEW          ← NEW!
   Filter: status==="pending_return"
   Color: text-gray-700
   Info: Borrower submitted return, awaiting staff verification

7. 🟢 COMPLETED
   Filter: status==="returned"
   Color: text-green-600
```

### Dark Mode Classes (Use Consistent System)
```javascript
// Root background
dark:bg-[#171717]

// Card background
dark:bg-[#222]

// Secondary background
dark:bg-[#1a1a1a]

// Borders
dark:border-gray-700

// Text colors
dark:text-white (primary)
dark:text-gray-400 (secondary)

// Shadows
dark:shadow-black/40
```

---

## ✨ Success Criteria

- [✅] All requests (pending, approved, pending_return, returned, declined) visible in one view
- [✅] 4-stage timeline visible for each request
- [✅] 7 priority sections automatically organized
- [✅] All actions work: approve, decline, approve return, decline return, manual return
- [✅] Progress bar updates correctly as status changes
- [✅] Photos display for all applicable stages
- [✅] Overdue warnings show
- [✅] Dark mode fully supported
- [✅] Mobile responsive
- [✅] No console errors
- [✅] Performance: Single API call on page load

---

## 🎯 Questions to Confirm

1. **Decline Return Reason**: Should staff be able to document why they declined a return?
   - YES → Include in Phase 2 backend update
   - NO → Skip storing reason

2. **Manual Return without Photos**: Should staff be able to mark items as returned without photos?
   - YES → Include `/api/borrow/return/manual` button
   - NO → Only allow manual-with-photos

3. **Section Names**: Is "Pending Review" a good name for pending_return stage?
   - Suggestion: "In Office", "Awaiting Verification", "Pending Review"
   - Confirm preferred naming

4. **Filter Persistence**: Should selected filters persist on page reload?
   - YES → Use localStorage
   - NO → Reset on reload

5. **Auto-refresh**: Should page auto-refresh for incoming requests?
   - YES → Implement polling every X seconds
   - NO → Manual refresh only

