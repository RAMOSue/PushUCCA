# ⏱️ Status Timeline - Quick Reference Card

## 🎯 At a Glance

**What:** Timeline visualization showing when borrow requests progress through status stages
**Where:** MyBorrowedItems page - visible on each request card
**When:** Always visible (collapsed) + expanded view
**Who:** Borrowers trace their request lifecycle
**Why:** Clear visibility of request progression with exact dates/times

---

## 🎨 Timeline Visual

```
●────────●────────●────────●
REQ     APPR     DUE      RET
Oct 7   Oct 8   Oct 11   Oct 11
2:45PM  10:20AM         3:15PM
```

| Dot Color | Status | Meaning |
|-----------|--------|---------|
| 🔵 Blue | Active/Done | Stage completed |
| 🟠 Orange | Warning | Due date milestone |
| 🟢 Green | Success | Returned ✓ |
| ⚫ Gray | Pending | Waiting for action |
| 🔴 Red | Error | Declined/Overdue |

---

## 📦 Implementation Summary

### Files Created
```
✅ server/migrations/add_approved_at_timestamp.sql
✅ client/src/components/modals/StatusTimeline.jsx
✅ TIMELINE_*_*.md (documentation)
```

### Files Modified
```
✅ server/controllers/borrowController.js
   • getBorrowHistory() - added timestamp fields
   • approveBorrowRequest() - added approved_at = NOW()

✅ client/src/pages/Borrower/MyBorrowedItems.jsx
   • Added StatusTimeline import
   • Integrated in expanded + collapsed views
```

---

## 🔄 Request Lifecycle

### Status Flow with Timestamps

| # | Status | Timestamp | Display |
|---|--------|-----------|---------|
| 1 | reserved | created_at | REQ ● |
| 2 | pending | request_date | REQ ● |
| 3 | approved | **approved_at** ✨ NEW | APPR ● |
| 4 | approved | due_date | DUE ● |
| 5 | pending_return | (no new timestamp) | RET ◐ |
| 6 | returned | returned_at | RET ● ✓ |

**Key Addition:** `approved_at` timestamp now captured when staff approves

---

## 💾 Database Changes

### New Column
```sql
ALTER TABLE borrowing_requests
ADD COLUMN approved_at TIMESTAMP DEFAULT NULL;

CREATE INDEX idx_borrowing_requests_approved_at
ON borrowing_requests(approved_at);
```

### API Response Now Includes
```javascript
{
  created_at,      // When request created
  request_date,    // When submitted to pending
  approved_at,     // ✨ When approved (NEW)
  due_date,        // When due back
  returned_at,     // When returned
  status
}
```

---

## 🎨 Component Props

```jsx
<StatusTimeline
  createdAt={string}      // ISO timestamp - request creation
  requestDate={string}    // ISO timestamp - submit to pending
  approvedAt={string}     // ISO timestamp - approval (NEW)
  dueDate={string}        // ISO timestamp - due date
  returnedAt={string}     // ISO timestamp - return completion
  status={string}         // 'pending'|'approved'|'returned'|'declined'
/>
```

---

## 🔍 Status Examples

### Pending Approval
```
●────◐
REQ APPR (Pending)
Oct 7  —
2:45PM
```

### Approved (Not Yet Due)
```
●────●────●────◐
REQ APPR DUE RET (Pending)
Oct 7 Oct 8 Oct 11 —
```

### Completed (Returned)
```
●────●────●────●
REQ APPR DUE RET
Oct 7 Oct 8 Oct 11 Oct 11
      10:20AM     3:15PM
```

### Declined
```
●
DECLINED
Oct 7
2:45PM
```

### Overdue
```
●────●────●────◐
REQ APPR DUE RET (OVERDUE!)
Oct 7 Oct 8 Oct 11 +5 days
```

---

## ✅ Verification Checklist

After deployment, verify:

- [ ] Timeline appears on MyBorrowedItems page
- [ ] Dates display in format: "Oct 7, 26"
- [ ] Times display in format: "2:45 PM"
- [ ] Circles are colored appropriately
- [ ] Connector lines show state
- [ ] Dark mode looks correct
- [ ] Mobile layout is responsive
- [ ] All status types show correctly
- [ ] Null timestamps handled gracefully
- [ ] No console errors

---

## 🚀 Quick Start

### For Users
1. Go to "My Borrowed Items"
2. View any request card
3. See timeline showing progression
4. Color indicates current stage

### For Developers
1. Restart backend server
2. Check `/api/borrow/history/:userId` response
3. Verify new fields in API response:
   - ✅ `created_at`
   - ✅ `request_date`
   - ✅ `approved_at` (NEW)
   - ✅ `due_date`
   - ✅ `returned_at`

### To Test
1. Create a new borrow request
2. Submit it (watch timeline update)
3. Have staff approve it (see approved_at populate)
4. Return items (see completed timeline)

---

## 📊 Color Meaning

| Color | Stage | Action |
|-------|-------|--------|
| 🔵 | Requested | View request details |
| 🔵 | Approved | Awaiting due date |
| 🟠 | Due Date | Time to return soon |
| 🟢 | Returned | ✓ Complete & closed |
| ⚫ | Pending | Awaiting status change |
| 🔴 | Declined | ✗ Request rejected |

---

## 📱 Layout Overview

```
┌─────────────────────┐
│  Request Card       │
├─────────────────────┤
│ [Image] Item Name   │
│ Progress Bar ████░░ │
├─────────────────────┤
│ [if expanded]       │
│ Items List          │
│ Receipt Total       │
├─────────────────────┤
│ 📅 TIMELINE ✨      │
│ ●─────●─────●─────●│
│ STATUS PROGRESSION  │
├─────────────────────┤
│ [Return] [Photos]   │
└─────────────────────┘
```

Timeline appears in **both expanded AND collapsed views**

---

## 🔧 Technical Details

### Timestamp Format
- **Database:** PostgreSQL TIMESTAMP
- **API:** ISO 8601 (e.g., "2026-10-08T10:20:00Z")
- **Display:** "Oct 8, 26" at "10:20 AM"

### Performance
- Indexed for fast queries: `idx_borrowing_requests_approved_at`
- Single database query returns all data
- JSON_AGG for efficient item fetching

### Compatibility
- ✅ Dark mode supported
- ✅ Mobile responsive
- ✅ Null-safe (missing timestamps handled)
- ✅ All modern browsers

---

## 📞 Support

**Documentation Files:**
- **TIMELINE_IMPLEMENTATION_COMPLETE.md** - Overview
- **TIMELINE_FEATURE_DOCUMENTATION.md** - Technical docs
- **TIMELINE_VISUAL_GUIDE.md** - Examples & testing
- **TIMELINE_ARCHITECTURE.md** - System design

**Code Files:**
- **StatusTimeline.jsx** - Component source
- **MyBorrowedItems.jsx** - Integration points
- **borrowController.js** - Backend logic

---

## ⚡ Common Tasks

### Check if Timeline is Working
```javascript
// In browser console, on MyBorrowedItems page:
fetch('/api/borrow/history/45')
  .then(r => r.json())
  .then(d => console.log(d[0].approved_at))
  // Should show ISO timestamp if approved
```

### View All Timestamps for a Request
```javascript
const req = borrowHistory[0];
console.log({
  created_at: req.created_at,
  request_date: req.request_date,
  approved_at: req.approved_at,     // ← NEW
  due_date: req.due_date,
  returned_at: req.returned_at
});
```

### Check Database Column Exists
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name='borrowing_requests' 
AND column_name LIKE '%approved%';
```

---

## 🎓 Key Concepts

**Timeline** - Visual representation of request progression through stages
**Status** - Current state (pending, approved, returned, etc.)
**Timestamp** - Exact date/time when status changed
**Stage** - One milestone in the request lifecycle
**Connector** - Line showing progression between stages
**Indicator** - Colored circle showing stage completion

---

**Quick Reference Card**
**Created:** April 10, 2026
**Status:** ✅ Ready for Use
