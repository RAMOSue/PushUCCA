# Multi-Item Grouped Borrow Request - Visual Flow Diagram

## 1. BORROWER FLOW: Add to Cart → Submit Grouped Request

```
┌─────────────────────────────────────────────────────────────────┐
│                    BORROWER: AvailableItems                     │
│  Browse costumes, instruments, accessories                      │
│  Click "Add to Cart" for each item (can add multiple times)     │
└─────────────────────┬───────────────────────────────────────────┘
                      │ SELECT MULTIPLE ITEMS
                      ↓
┌─────────────────────────────────────────────────────────────────┐
│                    BORROWER: BorrowCart                          │
│  ✓ 1x Costume "Red Dress" (Size M)                             │
│  ✓ 2x Violin (Quantity-based)                                  │
│  ✓ 1x Flute (Quantity-based)                                   │
│                                                                 │
│  Total: 4 units/items                                          │
│  [Submit Request Button]                                       │
└─────────────────────┬───────────────────────────────────────────┘
                      │ POST /api/borrow/submit-cart
                      │ (borrower_id, request_id)
                      ↓
┌─────────────────────────────────────────────────────────────────┐
│              SERVER: Create/Update Borrow Request               │
│  • Find reserved request or create new one                      │
│  • Transition: reserved → pending                              │
│  • Query item details for all units                            │
│  • Result: 4 total items in ONE request                        │
└─────────────────────┬───────────────────────────────────────────┘
                      │ GET item count = 4
                      ↓
┌─────────────────────────────────────────────────────────────────┐
│           NOTIFICATION: Send to ALL Staff                       │
│  Grouped Message: "Ramos has requested to borrow: 4 units"    │
│  Data: {                                                        │
│    requestId: 123,                                             │
│    borrowerName: "Ramos",                                      │
│    itemCount: 4,                                               │
│    url: "/staff/manage-requests?openRequestId=123"             │
│  }                                                              │
└─────────────────────┬───────────────────────────────────────────┘
                      │ NOTIFY ALL STAFF
                      ↓
        ┌─────────────────────────┐
        │ STAFF 1 receives notif  │
        │ [Open Request] button   │
        └──────────┬──────────────┘
                   │
                   └─→ navigate to /staff/manage-requests?openRequestId=123
```

---

## 2. STAFF FLOW: ManageBorrowRequests (Grouped View)

```
┌──────────────────────────────────────────────────────────────────┐
│              STAFF: Manage Borrow Requests                       │
│                                                                  │
│  [Pending: 5] [Approved: 12] [Declined: 3] [Returned: 28]      │
│   ▲ ACTIVE TAB (yellow)                                         │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Borrower: Ramos                                          │   │
│  │ Status: PENDING (yellow badge)                           │   │
│  │ Requested: Nov 13, 2025 • 2:30 PM                        │   │
│  │                                                          │   │
│  │ Items in this request:                                   │   │
│  │ • Red Dress (Size M) - Costume                           │   │
│  │ • Violin - Instrument x2                                 │   │
│  │ • Flute - Instrument x1                                  │   │
│  │                                                          │   │
│  │ [Date Picker: Select Due Date]                           │   │
│  │ [Approve Button] [Decline Button]                        │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Borrower: Maya                                           │   │
│  │ Status: PENDING                                          │   │
│  │ Items: Accessory x3, Instrument x1                       │   │
│  │ [Date Picker] [Approve] [Decline]                        │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ... more pending requests ...                                  │
└─────────────────────┬──────────────────────────────────────────┘
                      │
    ┌─────────────────┴─────────────────┐
    │                                   │
    ↓ APPROVE                            ↓ DECLINE
    │                                   │
┌───────────────────────────┐   ┌───────────────────────────┐
│ PUT /approve              │   │ PUT /decline              │
│ {staff_id, due_date}      │   │ {reason}                  │
│                           │   │                           │
│ Update status: approved   │   │ Update status: declined   │
│ Set units: borrowed       │   │ Restore units: available  │
└───────────┬───────────────┘   └───────────┬───────────────┘
            │                               │
            ↓ Query item details            ↓ Query item details
            │                               │
    ┌───────────────────────────┐   ┌───────────────────────────┐
    │ SEND NOTIFICATION         │   │ SEND NOTIFICATION         │
    │ ✅ "Your request to       │   │ ❌ "Your request to       │
    │ borrow 4 items has been   │   │ borrow 4 items was        │
    │ approved!"                │   │ declined. Reason: [X]"    │
    │ (GREEN indicator)         │   │ (RED indicator)           │
    │ url: /my-borrowed-items   │   │ url: /my-borrowed-items   │
    └───────────┬───────────────┘   └───────────┬───────────────┘
                │                               │
                ↓ BORROWER RECEIVES NOTIF      ↓ BORROWER RECEIVES NOTIF
```

---

## 3. STAFF FLOW: ReturnItems (Calendar + Two Columns)

```
┌──────────────────────────────────────────────────────────────────┐
│              STAFF: Manage Return Items                          │
│                                                                  │
│  ┌────────────────────────┐                                      │
│  │   CALENDAR VIEW        │                                      │
│  │  (Red dots on dates    │                                      │
│  │   with pending returns)│                                      │
│  │                        │                                      │
│  │  Su Mo Tu We Th Fr Sa  │                                      │
│  │  ... (Nov calendar)    │                                      │
│  │  13 ●  14  15  16  17  │ ● = Request due                     │
│  │  ... more dates ...    │                                      │
│  └────────────────────────┘                                      │
│                                                                  │
│  Click date → Modal shows requests due on that date              │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘

                            ↓ BELOW CALENDAR

┌──────────────────────────────────────────────────────────────────┐
│                  TWO-COLUMN LAYOUT                               │
│                                                                  │
│  LEFT COLUMN (Green)           RIGHT COLUMN (Red)               │
│  ✓ Approved Requests           ✗ Declined Requests              │
│  (Waiting for Return)          (Cannot Process)                  │
│                                                                  │
│  ┌─────────────────────────┐  ┌─────────────────────────┐       │
│  │ Ramos                   │  │ Maya                    │       │
│  │ Due: Nov 15, 2025       │  │ Requested: Nov 12, 2025 │       │
│  │ Items:                  │  │ Items:                  │       │
│  │ • Red Dress x1          │  │ • Accessory x3          │       │
│  │ • Violin x2             │  │ • Flute x1              │       │
│  │ • Flute x1              │  │                         │       │
│  │                         │  │ [Declined]              │       │
│  │ [Process Return]        │  │                         │       │
│  └─────────────────────────┘  └─────────────────────────┘       │
│                                                                  │
│  ┌─────────────────────────┐  ┌─────────────────────────┐       │
│  │ John                    │  │ (No declined requests)  │       │
│  │ Due: Nov 16, 2025       │  │                         │       │
│  │ Items: Instrument x4    │  │                         │       │
│  │ [Process Return]        │  │                         │       │
│  └─────────────────────────┘  └─────────────────────────┘       │
│                                                                  │
│  Scrollable if many items...   Scrollable if many items...      │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘

              Click [Process Return] on approved item
                            ↓

┌──────────────────────────────────────────────────────────────────┐
│              RETURN FORM MODAL                                   │
│  Return Items for Ramos                                          │
│                                                                  │
│  Red Dress (Size M)                                              │
│  Borrowed: 1 • Returned: 0 • Remaining: 1                        │
│  [−] [1] [+]  ← Staff selects quantity to return                 │
│                                                                  │
│  Violin                                                          │
│  Borrowed: 2 • Returned: 0 • Remaining: 2                        │
│  [−] [2] [+]  ← Staff selects quantity to return                 │
│                                                                  │
│  Flute                                                           │
│  Borrowed: 1 • Returned: 0 • Remaining: 1                        │
│  [−] [0] [+]  ← Staff can partially return                       │
│                                                                  │
│  [Return Selected Items Button]                                  │
│                                                                  │
└──────────────────────┬───────────────────────────────────────────┘
                       │ POST /api/borrow/return
                       │ {request_id, unit_ids[], quantities[]}
                       ↓
        ┌──────────────────────────────┐
        │ Update inventory units:      │
        │ Set status: available        │
        │ Update request status:       │
        │ If all returned → returned   │
        │ If partial → pending_return  │
        └──────────────┬───────────────┘
                       │
                       ↓ SEND NOTIFICATION
        ┌──────────────────────────────┐
        │ ✅ BORROWER receives:        │
        │ "Your items have been       │
        │ returned. Thank you for     │
        │ returning them on time!"    │
        │ (BLUE indicator)            │
        └──────────────────────────────┘
```

---

## 4. NOTIFICATION BELL: Grouped Notifications

```
┌─────────────────────────────────────────────────────────┐
│  🔔 NOTIFICATION BELL (Unread count: 3)                │
│  ┌───────────────────────────────────────────────────┐ │
│  │ NOTIFICATIONS                                     │ │
│  │ [Enable Push Notifications]                       │ │
│  ├───────────────────────────────────────────────────┤ │
│  │ TODAY                                             │ │
│  ├───────────────────────────────────────────────────┤ │
│  │ ● Approved (green dot)                            │ │
│  │ Ramos                                             │ │
│  │ Your request to borrow 4 items has been         │ │
│  │ approved!                                         │ │
│  │ 2 hours ago                                       │ │
│  │ [Mark read]  [Open Request]                       │ │
│  ├───────────────────────────────────────────────────┤ │
│  │ ● New Request (gray dot)                          │ │
│  │ Maya                                              │ │
│  │ Maya has requested to borrow: 3 units           │ │
│  │ 1 hour ago                                        │ │
│  │ [Mark read]  [Open Request]                       │ │
│  ├───────────────────────────────────────────────────┤ │
│  │ ● Declined (red dot)                              │ │
│  │ John                                              │ │
│  │ Your request to borrow 2 items was declined.    │ │
│  │ Reason: Insufficient stock                       │ │
│  │ 30 minutes ago                                    │ │
│  │ [Mark read]  [Open Request]                       │ │
│  ├───────────────────────────────────────────────────┤ │
│  │ ALL EARLIER                                       │ │
│  ├───────────────────────────────────────────────────┤ │
│  │ ● Returned (blue dot)                             │ │
│  │ Your 4 items have been returned. Thank you for  │ │
│  │ returning them on time!                          │ │
│  │ Nov 12, 2025                                      │ │
│  │ [Open]                                            │ │
│  └───────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘

Type-Based Color Indicators:
  🟢 Green  = request_approved
  🔴 Red    = request_declined
  🔵 Blue   = return_approved
  ⚪ Gray   = borrow_request (new request)

Each notification includes:
  • requestId (for deep-linking)
  • itemCount (6 items, not individual names!)
  • borrowerName (for staff view)
  • url (navigates to relevant page with requestId)
```

---

## 5. URL DEEP-LINKING: Auto-Open Requests

```
SCENARIO 1: Staff clicks "Open Request" in notification
┌─────────────────────────────────────────────────┐
│ NotificationBell component                      │
│ notification.data = {                           │
│   requestId: 123,                               │
│   url: "/staff/manage-requests?openRequestId=..." │
│ }                                               │
│ [Open Request] → navigate(url)                  │
└──────────────┬──────────────────────────────────┘
               │
               ↓ Browser navigates to:
        /staff/manage-requests?openRequestId=123
               │
               ↓
┌─────────────────────────────────────────────────┐
│ ManageBorrowRequests component                  │
│ • Detects ?openRequestId=123 in URL             │
│ • Searches requests array for id=123            │
│ • Switches to that request's status tab         │
│ • Auto-displays the request card                │
│ • Example: if status=pending, shows Pending tab │
└─────────────────────────────────────────────────┘

SCENARIO 2: Borrower clicks "Open Request" for approved request
┌─────────────────────────────────────────────────┐
│ NotificationBell component                      │
│ notification.data = {                           │
│   requestId: 123,                               │
│   url: "/my-borrowed-items?requestId=..."       │
│ }                                               │
│ [Open Request] → navigate(url)                  │
└──────────────┬──────────────────────────────────┘
               │
               ↓ Browser navigates to:
        /my-borrowed-items?requestId=123
               │
               ↓
┌─────────────────────────────────────────────────┐
│ MyBorrowedItems component                       │
│ • Detects ?requestId=123 in URL                 │
│ • Finds request with id=123                     │
│ • Opens modal showing this request              │
│ • Shows all items (4 units in this case)        │
│ • Shows status (Approved/Declined/Returned)     │
└─────────────────────────────────────────────────┘
```

---

## 6. DATABASE RELATIONSHIPS: One Request → Many Items

```
borrowing_requests (1 row per grouped request)
┌─────────────────────────────────────────────┐
│ id: 123                                     │
│ borrower_id: 5 (Ramos)                      │
│ status: approved                            │
│ request_date: 2025-11-13 14:30              │
│ due_date: 2025-11-15 23:59                  │
│ staff_id: 3                                 │
│ created_at: 2025-11-13 14:30                │
└────────────────┬────────────────────────────┘
                 │
    ┌────────────┴────────────┬─────────────┬──────────────┐
    │                         │             │              │
    ↓                         ↓             ↓              ↓
borrowing_items (4 rows: one per unit)
    ┌─────────────────────────────────────────────────────────┐
    │ id: 1, borrowing_id: 123, inventory_unit_id: 100      │
    │ (Red Dress - Unit 1)                                  │
    └─────────────────────────────────────────────────────────┘
    ┌─────────────────────────────────────────────────────────┐
    │ id: 2, borrowing_id: 123, inventory_unit_id: 201      │
    │ (Violin - Unit 1)                                     │
    └─────────────────────────────────────────────────────────┘
    ┌─────────────────────────────────────────────────────────┐
    │ id: 3, borrowing_id: 123, inventory_unit_id: 202      │
    │ (Violin - Unit 2)                                     │
    └─────────────────────────────────────────────────────────┘
    ┌─────────────────────────────────────────────────────────┐
    │ id: 4, borrowing_id: 123, inventory_unit_id: 203      │
    │ (Flute - Unit 1)                                      │
    └─────────────────────────────────────────────────────────┘

Query to get all items in request:
SELECT COUNT(*) as item_count
FROM borrowing_items
WHERE borrowing_id = 123;
Result: 4 items

For notification message:
"Ramos has requested to borrow: 4 units"
```

---

## 7. SUMMARY: Key Differences from Single-Item Model

| Aspect | Single-Item (Old) | Multi-Item (New) |
|--------|-------------------|------------------|
| **Request Structure** | 1 request = 1 item | 1 request = many items |
| **Borrowing Items** | 1 row | Multiple rows (one per unit) |
| **Approval** | Staff approves 1 item | Staff approves entire list at once |
| **Notification** | "Ramos requested: Red Dress" | "Ramos has requested to borrow: 4 units" |
| **Staff View** | One request per card | All items in request shown on one card |
| **Return** | Return 1 item | Return multiple items (any quantity) |
| **Unique Units** | Can be same unit | EVERY unit is unique (no duplicates per request) |

