# Status Timeline - Visual Guide & Examples

## 📊 Timeline Examples by Status

### ✅ Returned (Complete Timeline)
```
┌──────────────────────────────────────────┐
│ Status Timeline                          │
├──────────────────────────────────────────┤
│  ●────────●────────●────────●           │
│  │        │        │        │           │
│ REQ      APPR      DUE      RET         │
│ Oct 7    Oct 8    Oct 11   Oct 11      │
│ 2:45 PM  10:20 AM (date)  3:15 PM     │
│                                         │
│ Color: BLUE → GREEN (complete flow)    │
└──────────────────────────────────────────┘
```
**Indicators:**
- Requested ●: Blue (creation date)
- Approved ●: Blue (when staff approved)
- Due ●: Orange (date due)
- Returned ●: Green (completion with timestamp)

---

### ⏳ Pending Approval (Partial Timeline)
```
┌──────────────────────────────────────────┐
│ Status Timeline                          │
├──────────────────────────────────────────┤
│  ●────────◐                             │
│  │        │                             │
│ REQ     APPR                            │
│ Oct 7   Pending                        │
│ 2:45 PM                                │
│                                         │
│ Color: BLUE → GRAY (awaiting approval) │
└──────────────────────────────────────────┘
```
**Indicators:**
- Requested ●: Blue (completed)
- Approved ◐: Gray hollow (not yet happened)

---

### 🔄 In-Progress Return (Most Common)
```
┌──────────────────────────────────────────┐
│ Status Timeline                          │
├──────────────────────────────────────────┤
│  ●────────●────────●────────◐           │
│  │        │        │        │           │
│ REQ     APPR      DUE      RET          │
│ Oct 7   Oct 8    Oct 11   In Progress  │
│ 2:45 PM 10:20 AM (date)               │
│                                         │
│ Color: BLUE → BLUE → ORANGE → GRAY     │
└──────────────────────────────────────────┘
```
**Indicators:**
- Requested ●: Blue (done)
- Approved ●: Blue (done)
- Due ●: Orange (date specified)
- Returned ◐: Gray hollow (in progress)

---

### ❌ Declined Request
```
┌──────────────────────────────────────────┐
│ Status Timeline                          │
├──────────────────────────────────────────┤
│  ●                                       │
│  │                                       │
│ DECLINED                                │
│ Oct 7                                  │
│ 2:45 PM                                │
│                                         │
│ Color: RED (request rejected)           │
└──────────────────────────────────────────┘
```
**Indicators:**
- Declined ●: Red (request was rejected)

---

### ⚠️ Overdue (With Days Past Due)
```
┌──────────────────────────────────────────┐
│ Status Timeline                          │
├──────────────────────────────────────────┤
│  ●────────●────────●────────◐           │
│  │        │        │        │           │
│ REQ     APPR      DUE      RET          │
│ Oct 7   Oct 8    Oct 11   OVERDUE!    │
│ 2:45 PM 10:20 AM         (4 days late) │
│                                         │
│ Color: RED TEXT on DUE (overdue warning)│
└──────────────────────────────────────────┘
```
**Indicators:**
- Due date shows in RED if overdue
- Day counter shows how many days past due

---

## 🎨 Color Legend

| Color | Status | Meaning |
|-------|--------|---------|
| 🔵 Blue | Active/Complete | Stage reached and validated |
| 🟠 Orange | Warning/Due | Date-based milestone, caution needed |
| 🟢 Green | Success/Returned | Items successfully returned |
| ⚫ Gray | Pending/Inactive | Awaiting action, not yet reached |
| 🔴 Red | Error/Overdue | Request declined or past due date |

---

## 📱 Responsive Layout

### Mobile (< 640px)
```
Timeline compresses vertically, maintains readability
Smaller circles: w-3 h-3
Smaller text: text-[9px] and text-[10px]
Full width card with padding
```

### Tablet (640px - 1024px)
```
Timeline with moderate spacing
Circles: w-3 h-3
Text: text-[10px]
```

### Desktop (> 1024px)
```
Timeline with generous spacing
Full detail with dates and times
All information clearly visible
```

---

## 🔄 Status Progression Flow

```
START
  │
  ├─ User creates request (reserved status)
  │  → created_at = NOW()
  │
  ├─ User submits items (reserved → pending)
  │  → request_date = NOW()
  │
  ├─ Staff approves (pending → approved)  ← NEW: approved_at = NOW()
  │  → due_date = approval_date + 3 days
  │
  ├─ Items are due (just a date milestone)
  │  → due_date = specified date
  │
  └─ Items returned (approved/pending_return → returned)
     → returned_at = NOW()
     END
```

---

## 💾 Data Storage Example

### Database Record for Complete Request
```sql
SELECT * FROM borrowing_requests WHERE id = 123;

id           | 123
borrower_id  | 45
status       | 'returned'
created_at   | 2026-10-07 14:45:00
request_date | 2026-10-07 14:45:00
approved_at  | 2026-10-08 10:20:00    ← NEW FIELD
due_date     | 2026-10-11
returned_at  | 2026-10-11 15:15:00
staff_id     | 12
```

### Timeline Rendering
```
1. created_at (2026-10-07 14:45:00)    → "Oct 7, 26" "2:45 PM"
2. approved_at (2026-10-08 10:20:00)   → "Oct 8, 26" "10:20 AM"  
3. due_date (2026-10-11)               → "Oct 11, 26"
4. returned_at (2026-10-11 15:15:00)   → "Oct 11, 26" "3:15 PM"
```

---

## 🧪 Testing Scenarios

### Scenario 1: New Request (Not Yet Approved)
- **Status:** pending
- **Timeline Shows:**
  - Requested ● Oct 7, 14:45
  - Approved ◐ Pending
  - Connector: Solid → Faded

### Scenario 2: Approved Request (Not Yet Due)
- **Status:** approved
- **Timeline Shows:**
  - Requested ● Oct 7, 14:45
  - Approved ● Oct 8, 10:20
  - Due ● Oct 11
  - Returned ◐ Pending
  - Connectors: Solid → Solid → Solid → Faded

### Scenario 3: Returned Request
- **Status:** returned
- **Timeline Shows:**
  - All ● filled circles
  - All connectors solid
  - All dates/times visible
  - Complete progression

### Scenario 4: Overdue Item
- **Status:** pending_return or approved (overdue)
- **Color Change:** Due date text turns RED
- **Warning:** "⚠️ OVERDUE" badge on card header

### Scenario 5: Declined Request
- **Status:** declined
- **Timeline Shows:** Special declined-only layout
  - Single red ● circle
  - "Declined" label
  - Request creation date/time

---

## 🔧 Configuration Options

The StatusTimeline component accepts these props:

```javascript
<StatusTimeline
  createdAt={ISO_STRING}        // When request was created
  requestDate={ISO_STRING}      // When moved to pending (optional)
  approvedAt={ISO_STRING}       // When moved to approved (NEW)
  dueDate={ISO_STRING}          // Date items are due
  returnedAt={ISO_STRING}       // When items were returned
  status={STRING}               // pending|approved|pending_return|returned|declined
/>
```

All timestamps should be ISO 8601 format strings (returned by PostgreSQL automatically).

---

## 🚀 Production Checklist

Before deploying:

- [x] Migration applied to production database
- [x] `approved_at` column exists on borrowing_requests
- [x] Backend API returns all 5 timestamp fields
- [x] StatusTimeline component handles null values
- [x] Dark mode colors tested
- [x] Mobile responsiveness verified
- [x] All status types tested
- [x] Date formatting displays correctly

---

**Last Updated:** April 10, 2026
**Feature Status:** Ready for User Testing ✅
