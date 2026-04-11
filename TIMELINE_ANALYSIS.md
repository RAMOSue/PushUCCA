# MyBorrowedItems Timeline Design - Analysis & Migration to ManageBorrowRequests

## 📊 TIMELINE DESIGN OVERVIEW

### Timeline Structure (Progressive Journey)
```
┌─────────────────────────────────────────────────────────┐
│ PENDING (25%) → APPROVED (50%) → IN OFFICE (75%) → RETURNED (100%) │
└─────────────────────────────────────────────────────────┘
    ↓
□ Pending         □ Approved         □ Pending Return     □ Returned
  (Requested)       (Approved)         (In Office)         (Completed)
  Oct 1            Oct 2              Oct 7               Oct 15
```

### Visual Components
1. **Dashed Timeline**: Full 100% horizontal line (gray, dashed)
2. **Solid Progress**: Colored line from 0% to current status (blue, orange, yellow, green)
3. **Status Dot**: Circular marker at progress position with shadow
4. **Labels**: Status name above dot, formatted date below
5. **Progress %**: 25% → 50% → 75% → 100%

---

## 🎯 REQUEST ORGANIZATION (7 Priority Sections)

### Sorting Logic
Requests are grouped into 7 sections displayed in priority order:

```
1. 🔴 OVERDUE
   └─ Approved items PAST due date
   └─ Color: red (text-red-600 dark:text-red-400)
   └─ Sort: By days overdue (most overdue first)

2. 🟡 DUE TODAY
   └─ Approved/To Return items with due date = TODAY
   └─ Color: yellow (text-yellow-600 dark:text-yellow-400)
   └─ Sort: By due date

3. 🟠 DUE SOON
   └─ Approved/To Return items due in 1-2 days
   └─ Color: orange (text-orange-600 dark:text-orange-400)
   └─ Sort: By due date (closest first)

4. 🔵 TO RETURN
   └─ Approved items not urgent (>2 days away)
   └─ Color: blue (text-blue-600 dark:text-blue-400)
   └─ Sort: By due date

5. ⚪ PENDING APPROVAL
   └─ status === "pending" OR "pending_return"
   └─ Color: gray (text-gray-600 dark:text-gray-400)
   └─ Sort: Pending items first (by request date), then pending_return (by due date)

6. ⚫ DECLINED
   └─ status === "approved" AND return_decline_reason exists
   └─ Color: dark gray (text-gray-700 dark:text-gray-500)
   └─ Sort: By declined date (most recent first)

7. 🟢 COMPLETED
   └─ status === "returned"
   └─ Color: green (text-green-600 dark:text-green-400)
   └─ Sort: By returned date (most recent first)
```

### Exclusions
- `status === "reserved"` is filtered out
- Declined requests are NOT in "To Return" section (shown separately)

---

## 🔧 CORE LOGIC & HELPER FUNCTIONS

### 1. **formatDate(dateString)**
```javascript
Converts: "2025-10-07T00:00:00Z"
To: "October 7, 2025"
```

### 2. **getDaysFromToday(dueDate)**
```javascript
Returns: Number of days from TODAY to due date
- Negative: Days overdue (past date)
- 0: Due today
- Positive: Days until due
```

### 3. **isOverdue(dueDate, status)**
```javascript
Returns: true if:
  - status !== "returned"
  - dueDate is in the past
  - Current date is after due date
```

### 4. **getStatusConfig(status)**
Returns icon, colors, badge style based on status:
- pending: Clock icon, orange style
- approved: CheckCircle icon, blue style
- pending_return: AlertCircle icon, amber style
- returned: CheckCircle icon, gray/green style

### 5. **getProgress(status)**
Returns progress percentage:
- pending → 25%
- approved → 50%
- pending_return → 75%
- returned → 100%

### 6. **getStatusLabel(status, request)**
Returns human-readable label:
```javascript
pending → "Pending"
approved → "Approved"  (or decline reason if declined)
pending_return → "In office"
returned → "Returned"
```

### 7. **isDeclined(request)**
```javascript
Checks: request.status === "approved" && request.return_decline_reason
Returns: true if return was declined by staff
```

---

## 📱 REQUEST CARD STRUCTURE

### Visual Layout
```
┌─────────────────────────────────────────────────────────────┐
│ [Thumbnail] Item Name ⚠️     ┌─────────────────┐    [3] [▶]│
│              ├─●─────────────┤      Due: 7d     │          │
│              │ Approved      └─────────────────┘           │
│              │ Oct 2                                        │
├─────────────────────────────────────────────────────────────┤
│ [Expanded Items List - Receipt Style]                      │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Item                              Size                 │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ 1. Unit #001                      Medium              │ │
│ │ 2. Unit #002                      Small               │ │
│ │ 3. Unit #003                      Large               │ │
│ │ + 2 more items                                         │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ Total Units: 5                                          │ │
│ └─────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│ [Return Items Button] or [View Photos Button]              │
└─────────────────────────────────────────────────────────────┘
```

### Components
1. **Header**: Click to expand/collapse
   - Thumbnail (12px circle, rounded)
   - Item name (truncated)
   - Overdue warning icon (if needed)
   - Progress bar (inline)
   - Item count badge
   - Expand chevron

2. **Progress Bar**
   - Full dashed line (timeline)
   - Solid colored line (progress)
   - Status dot (colored, 2.5px)
   - Status label above dot
   - Status date below dot
   - Due date display at bottom

3. **Expandable Items List** (when clicked)
   - Receipt-style layout
   - Item name + size columns
   - First 3 items shown
   - "View more" link if >3 items
   - Total units footer

4. **Action Footer**
   - If approved: "↩️ Return Items" button
   - If returned: "📸 View Photos" button

---

## 🔄 DATA FLOW

### Fetch & Grouping
```javascript
1. Fetch: GET /api/borrow/history/{userId}
2. Response: Array of requests with items array
3. Group by request_id (merge items for same request)
4. Filter: Remove "reserved" status
5. Apply: Search filter (item name or request ID)
6. Organize: Into 7 sections
7. Sort: Each section by urgency
8. Render: Sections in priority order
```

### Data Structure Expected
```javascript
{
  id: number,
  request_id: string,
  status: "pending" | "approved" | "pending_return" | "returned",
  request_date: ISO datetime,
  approved_at: ISO datetime,
  due_date: ISO datetime,
  returned_at: ISO datetime,
  return_decline_reason: string | null,
  items: [
    {
      id: number,
      unit_id: number,
      unit_number: string,
      item_name: string,
      name: string,
      size: string,
      image_url: string
    }
  ]
}
```

---

## 🔑 DIFFERENCES: MyBorrowedItems vs ManageBorrowRequests

| Feature | MyBorrowedItems | ManageBorrowRequests |
|---------|-----------------|----------------------|
| **Scope** | Borrower's own requests | Staff views all requests |
| **Data Flow** | GET `/api/borrow/history/{user.id}` | GET `/api/borrow/requests` or similar |
| **Filtering** | Own requests only | All borrowers' requests |
| **Additional columns** | None | Borrower name, ID, email |
| **Actions** | Return items, View photos | Approve, Reject, Decline return, Update due date |
| **Search** | Item name, request ID | Item name, request ID, borrower name |
| **Timeline** | SAME 7-section system | SAME 7-section system |
| **Progress bar** | IDENTICAL | IDENTICAL |
| **Expandable cards** | IDENTICAL | IDENTICAL with borrower info |

---

## 🛠️ BACKEND REQUIREMENTS CHECK

### Required Endpoints
1. **GET `/api/borrow/requests`** - Fetch all requests (staff view)
   - Response: Array of request objects with items
   - Filters: status, borrower_id, date_range (optional)

2. **PUT `/api/borrow/requests/{requestId}/status`** - Update request status
   - Payload: { status: "approved" | "pending" | "pending_return" | "returned" }

3. **PUT `/api/borrow/requests/{requestId}/decline-return`** - Decline return
   - Payload: { decline_reason: string, due_date: ISO date }

4. **GET `/api/borrow/return/photos/{requestId}`** - Fetch return photos
   - Response: { photos: [...] }

### Data Fields Required
All same as MyBorrowedItems:
- ✅ id, request_id, status
- ✅ request_date, approved_at, due_date, returned_at
- ✅ return_decline_reason
- ✅ items[] with: unit_id, unit_number, item_name, name, size, image_url
- ⚠️ **NEED TO VERIFY**: borrower_id, borrower_name, borrower_email fields

---

## 📋 IMPLEMENTATION STEPS

### Step 1: Copy & Adapt Logic Functions
Copy from MyBorrowedItems:
- formatDate()
- formatRelativeDays()
- isOverdue()
- getStatusConfig()
- getProgress()
- (Adapt for staff context)

### Step 2: Update Data Fetching
```javascript
// MyBorrowedItems
const res = await axios.get(`/api/borrow/history/${user.id}`)

// ManageBorrowRequests (STAFF VIEW - ALL REQUESTS)
const res = await axios.get(`/api/borrow/requests`) // All requests
// or with filters:
const res = await axios.get(`/api/borrow/requests?status=${filterStatus}`)
```

### Step 3: Add Borrower Information
```javascript
// Add to request card header (ABOVE item name):
<div className="text-[10px] font-bold text-on-surface-variant dark:text-gray-500">
  {request.borrower_name} ({request.borrower_id})
</div>
```

### Step 4: Add Staff Actions
Replace item count badge with action buttons:
```javascript
{request.status === "pending" && (
  <button onClick={() => approveRequest(request.id)}>
    ✅ Approve
  </button>
)}

{request.status === "approved" && (
  <button onClick={() => declineReturnModal(request.id)}>
    ⛔ Decline Return
  </button>
)}
```

### Step 5: Implement Same Timeline UI
- Copy progress bar rendering logic
- Copy expandable items list logic
- Use same color scheme & styling
- Maintain dark mode support

---

## ✅ SUCCESS CRITERIA

When complete, ManageBorrowRequests should:
1. ✅ Display same 7 priority sections as MyBorrowedItems
2. ✅ Use identical timeline visualization (progress bars, dots, dates)
3. ✅ Support expandable request cards with items list
4. ✅ Show borrower information in header
5. ✅ Include staff action buttons (Approve, Decline Return)
6. ✅ Search by item name, request ID, borrower name
7. ✅ Full dark mode styling
8. ✅ No syntax errors

---

## 📝 NOTES

### Dark Mode Classes Used
- Main background: `dark:bg-[#171717]`
- Card background: `dark:bg-[#1a1a1a]`
- Hover: `dark:hover:bg-[#222]`
- Text primary: `dark:text-white`
- Text secondary: `dark:text-gray-400`
- Borders: `dark:border-gray-700`
- Shadow: `dark:shadow-black/40`

### Color Mapping for Sections
```
Overdue:    red-600 (dark:red-400)
Today:      yellow-600 (dark:yellow-400)
Soon:       orange-600 (dark:orange-400)
To Return:  blue-600 (dark:blue-400)
Pending:    gray-600 (dark:gray-400)
Declined:   gray-700 (dark:gray-500)
Completed:  green-600 (dark:green-400)
```

### Timeline Progress Colors
- Pending: orange-400 / amber-400
- Approved: blue-400 / blue-600
- Pending Return: yellow-400 / amber-600
- Returned: green-400 / green-600
