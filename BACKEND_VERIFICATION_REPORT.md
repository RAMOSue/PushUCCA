# Backend Verification Report - ManageBorrowRequests Timeline Implementation

**Status**: ⚠️ **PARTIALLY READY** - Endpoints exist but need field enhancements

**Date**: April 11, 2026
**Scope**: Verify endpoints for ManageBorrowRequests staff view with timeline design

---

## ✅ ENDPOINTS VERIFIED

### 1. **GET /api/borrow/requests** - Staff View All Requests
**Status**: ✅ EXISTS and FUNCTIONAL  
**Location**: `server/controllers/borrowController.js:774-838`  
**Authorization**: None required (accessible to all roles)

**Current Response Structure**:
```javascript
[
  {
    id: 1,
    borrower_id: 5,
    borrower_name: "John Smith",      // ✅ YES
    borrower_email: "john@example.com", // ✅ YES
    status: "pending" | "approved" | "declined" | "pending_return" | "returned",
    request_date: "2025-10-01T10:00:00.000Z",  // ✅ created_at
    due_date: "2025-10-08T00:00:00.000Z",      // ✅ YES
    returned_at: "2025-10-15T14:00:00.000Z",   // ✅ YES
    quantity: 5,
    item_count: 3,
    submitted_at: "2025-10-01T10:05:00.000Z",
    items: [
      {
        item_id: "uuid-string",
        item_name: "Royal Blue Gown",
        garment_type: "costume",
        category: "formal",
        instrument_classification: null,
        instrument_type: null,
        unit_ids: [
          { unit_id: 1, unit_status: "borrowed", size: "M" },
          { unit_id: 2, unit_status: "available", size: "L" }
        ],
        returned_quantity: 1,  // Units returned
        borrowed_quantity: 2   // Units borrowed
      }
    ]
  }
]
```

**⚠️ MISSING FIELDS FOR TIMELINE** (Need Backend Update):
- ❌ `approved_at`: Timestamp when staff approved (critical for timeline)
- ❌ `return_decline_reason`: Reason staff declined return
- ❌ `declined_at`: Timestamp when declined
- ❌ `borrower_division_id`: Department info (used in filters)

---

### 2. **PUT /api/borrow/requests/:id/approve** - Approve Request
**Status**: ✅ EXISTS and FUNCTIONAL  
**Location**: `server/controllers/borrowController.js:839-901`

**Request Payload**:
```javascript
{
  staff_id: 1,              // Required: Staff member ID
  due_date: "2025-10-15"    // Required: ISO date string
}
```

**Response**:
```javascript
{
  success: true,
  message: "Request approved"
}
```

**What It Does**:
- ✅ Updates status to 'approved'
- ✅ Sets `approved_at` = NOW()  **← Critical for timeline!**
- ✅ Sets `due_date` to provided value
- ✅ Updates unit statuses to 'borrowed'
- ✅ Sends push notification to borrower
- ✅ Sets `staff_id` (tracks who approved)

**⚠️ NOTE**: Backend sets `approved_at` timestamp but `getAllBorrowRequests` doesn't return it!

---

### 3. **PUT /api/borrow/requests/:id/decline** - Decline Request
**Status**: ✅ EXISTS (needs enhancement for staff return-decline)  
**Location**: `server/controllers/borrowController.js:932-1010`

**Current Implementation**:
- Marks request as declined
- Restores inventory items back to available
- Restores inventory item quantities
- Sends notification to borrower
- ⚠️ **BUT: Does NOT accept `decline_reason` parameter**

**⚠️ LIMITATION**: No way to store decline reason for return rejection  
**Need**: Endpoint to decline a RETURN with reason (currently only declines pending requests)

---

## 🔄 Database Schema Status

### Current Columns in `borrowing_requests` Table
```sql
✅ id
✅ borrower_id
✅ status (enum: pending, approved, declined, pending_return, returned)
✅ created_at / request_date
✅ approved_at           -- EXISTS but NOT RETURNED by getAllBorrowRequests
✅ due_date
✅ returned_at
✅ return_decline_reason -- EXISTS (added via migration) but NOT RETURNED
✅ declined_at           -- EXISTS but NOT RETURNED
✅ submitted_at
✅ quantity
✅ item_count
✅ staff_id              -- Tracks approving staff
❌ borrower_division_id  -- MISSING (need to add for division filtering)
```

**Migration Status**: `add_return_decline_reason.sql` has already been applied
- ✅ `return_decline_reason` column exists in DB
- ✅ `declined_at` column exists in DB

---

## ✅ Working Timeline Fields (from getBorrowHistory)

The **borrower-side** timeline already returns all needed fields:
```javascript
{
  request_id,
  status,
  created_at,
  request_date,
  approved_at,        // ✅ PRESENT in getBorrowHistory
  due_date,
  returned_at,
  return_decline_reason, // ✅ PRESENT in getBorrowHistory
  declined_at,         // ✅ PRESENT in getBorrowHistory
  is_overdue,          // Calculated backend convenience
  days_until_due,      // Calculated backend convenience
  items
}
```

**Source**: `server/controllers/borrowController.js:654-723`

---

## 🔧 Required Backend Enhancements

### Priority 1: Add Missing Fields to getAllBorrowRequests (CRITICAL)

**File**: `server/controllers/borrowController.js:774`

**Change Required**:
```sql
-- Current SELECT (incomplete):
SELECT 
  br.id,
  br.borrower_id,
  u.name AS borrower_name,
  u.email AS borrower_email,
  br.status,
  br.created_at AS request_date,
  br.due_date,
  br.returned_at,
  br.quantity,

-- ADD THESE (missing):
  br.approved_at,              -- ✅ When was it approved
  br.return_decline_reason,    -- ✅ Why was return declined
  br.declined_at,              -- ✅ When was it declined
  u.borrower_division_id       -- ✅ For division filter (if column exists in users)
```

**Impact**: Enables timeline visualization (getDaysFromToday, progress %, status dates)

---

### Priority 2: Add Decline Return endpoint (IMPORTANT)

**New Endpoint Needed**:
```javascript
PUT /api/borrow/requests/:id/decline-return
Payload: {
  decline_reason: "Size doesn't fit",
  new_due_date: "2025-10-22" (optional)
}
Response: { success: true }
```

**Why**: For staff to decline a RETURN with reason (different from declining initial request)

**Database**: Schema already supports this - just need controller & route

---

### Priority 3: Add borrower_division_id Field (NICE-TO-HAVE)

For the pre-existing division filter to work with `/api/borrow/requests`:
```sql
-- Check if this column exists in users table:
SELECT column_name FROM information_schema.columns 
WHERE table_name='users' AND column_name='borrower_division_id';

-- If not, add it:
ALTER TABLE users ADD COLUMN borrower_division_id INT;
```

---

## 📋 Data Flow Verification

### Current Implementation (MyBorrowedItems → Works ✅)
```
Frontend: GET /api/borrow/history/{userId}
  ↓
Backend: Returns with approved_at, return_decline_reason, etc.
  ↓
Frontend: Uses timeline logic (getDaysFromToday, getProgress, etc.)
  ↓
Result: Beautiful timeline working perfectly ✅
```

### Proposed Implementation (ManageBorrowRequests → Needs Fix ⚠️)
```
Frontend: GET /api/borrow/requests
  ↓
Backend: Returns WITHOUT approved_at, return_decline_reason ❌
  ↓
Frontend: Tries getDaysFromToday but missing key fields 💔
  ↓
Result: Timeline partially broken ❌
```

---

## 🛑 Blockers & Workarounds

### Blocker 1: Missing Fields in getAllBorrowRequests
**Severity**: 🔴 CRITICAL - Timeline won't work without approved_at  
**Workaround**: Can still use `created_at` as request_date, but won't match MyBorrowedItems timeline

**Time to Fix**: 5 minutes (1 SQL query update)

---

### Blocker 2: No Decline Return Endpoint
**Severity**: 🟡 MEDIUM - Staff can approve but can't decline returns  
**Workaround**: Use existing decline endpoint (loses return_decline_reason)

**Time to Fix**: 15-20 minutes (new controller function + test)

---

### Blocker 3: Missing Division Field
**Severity**: 🟡 MEDIUM - Division filter won't work  
**Workaround**: Filter by all divisions, UI handles subset filtering

**Time to Fix**: 5 minutes (if column exists) or 15 minutes (if need to add)

---

## ✅ Status Summary

| Feature | Status | Frontend Ready | Backend Ready |
|---------|--------|---|---|
| Fetch all requests | ✅ | ✅ | ⚠️ Missing fields |
| Approve request | ✅ | ✅ | ✅ |
| Decline request | ✅ | ⚠️ No UI yet | ⚠️ Limited |
| Decline return | ❌ | ❌ | ❌ |
| Timeline progress (%) | ❌ | ✅ Ready | ⚠️ Missing approved_at |
| Timeline dates | ⚠️ Partial | ✅ Ready | ⚠️ Missing fields |
| Borrower info | ✅ | ✅ | ✅ |
| Division filter | ⚠️ Partial | ✅ Ready | ⚠️ Missing field |

---

## 🚀 Recommended Implementation Path

### Phase 0: Backend Quick Fixes (10 minutes)
1. **Update getAllBorrowRequests** to include:
   - `br.approved_at`
   - `br.return_decline_reason`
   - `br.declined_at`
   - Division field if available

### Phase 1: Build ManageBorrowRequests Frontend (WITHOUT blocker fixes)
- Use available fields: `status`, `created_at`, `due_date`, `returned_at`
- Copy logic from MyBorrowedItems
- Timeline will work with request_date instead of approved_at
- Can still show 7 sections (won't be 100% identical but functional)

### Phase 2: Add Decline Return Endpoint (Optional)
- If staff needs to decline returns with reason
- Otherwise, use simplified decline flow

---

## 📝 Next Steps

**Recommendation: Proceed with Frontend - Apply Backend Fixes First (10 min)**

1. ✅ Update `getAllBorrowRequests` SQL query (add missing fields)
2. ✅ Test endpoint returns correct data
3. ✅ Build ManageBorrowRequests component
4. ⏳ Add decline-return endpoint later if needed

---

## 🔍 Code References

- **getAllBorrowRequests**: Line 774
- **getBorrowHistory** (reference implementation): Line 654
- **approveBorrowRequest**: Line 839
- **declineBorrowRequest**: Line 932
- **borrowRoutes.js**: `/api/borrow/requests`, `/api/borrow/requests/:id/approve`, `/api/borrow/requests/:id/decline`

