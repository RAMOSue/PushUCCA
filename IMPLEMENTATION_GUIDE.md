# Backend & Frontend Implementation - Step by Step

## 🎯 PHASE 1: BACKEND CRITICAL FIX (10 minutes)

### Step 1: Update getAllBorrowRequests SQL Query

**File**: `server/controllers/borrowController.js`  
**Line**: 774-792  
**Action**: Add 3 missing fields to SELECT statement

**Current Code**:
```javascript
const getAllBorrowRequests = async (req, res) => {
  try {
    const requestsRes = await pool.query(
      `SELECT 
         br.id,
         br.borrower_id,
         u.name AS borrower_name,
         u.email AS borrower_email,
         br.status,
         br.created_at AS request_date,
         br.due_date,
         br.returned_at,
         br.quantity,
         br.item_count,
         br.submitted_at
       FROM borrowing_requests br
       JOIN users u ON u.id = br.borrower_id
       ORDER BY br.created_at DESC`
    );
```

**Updated Code** (ADD THESE 3 LINES):
```javascript
const getAllBorrowRequests = async (req, res) => {
  try {
    const requestsRes = await pool.query(
      `SELECT 
         br.id,
         br.borrower_id,
         u.name AS borrower_name,
         u.email AS borrower_email,
         br.status,
         br.created_at AS request_date,
         br.approved_at,              -- ✅ ADD THIS
         br.due_date,
         br.returned_at,
         br.return_decline_reason,    -- ✅ ADD THIS
         br.declined_at,              -- ✅ ADD THIS
         br.quantity,
         br.item_count,
         br.submitted_at
       FROM borrowing_requests br
       JOIN users u ON u.id = br.borrower_id
       ORDER BY br.created_at DESC`
    );
```

**Why**: Timeline calculations need `approved_at` to determine progress %, and `return_decline_reason` & `declined_at` for showing decline reasons

**Test**:
```bash
curl http://localhost:8000/api/borrow/requests
# Check response includes: approved_at, return_decline_reason, declined_at fields
```

---

### Step 2: (Optional) Update Return Decline to Store Reason

**File**: `server/controllers/borrowController.js`  
**Line**: 2385-2450  
**Action**: Accept and store decline reason

**Current Code** (line 2436):
```javascript
await client.query(
  `UPDATE borrowing_requests 
   SET status = $1
   WHERE id = $2::int`,
  [id]
);
```

**Updated Code**:
```javascript
// Accept reason from request body
const { borrowing_request_id, reason } = req.body;

// ... validation code ...

await client.query(
  `UPDATE borrowing_requests 
   SET status = 'approved',
       return_decline_reason = $1,
       declined_at = NOW()
   WHERE id = $2::int`,
  [reason || null, borrowing_request_id]
);
```

**Why**: Allows staff to document why a return is being rejected (audit trail)

---

### Step 3: Test Backend Changes

**Endpoint**: `GET /api/borrow/requests`

**Expected Response**:
```javascript
{
  id: 1,
  borrower_id: 5,
  borrower_name: "John Smith",
  borrower_email: "john@example.com",
  status: "approved",
  request_date: "2025-10-01T10:00:00Z",
  approved_at: "2025-10-02T14:30:00Z",         // ✅ NOW PRESENT
  due_date: "2025-10-10T00:00:00Z",
  returned_at: null,
  return_decline_reason: null,                  // ✅ NOW PRESENT
  declined_at: null,                            // ✅ NOW PRESENT
  quantity: 5,
  item_count: 3,
  submitted_at: "2025-10-01T10:05:00Z",
  items: [...]
}
```

---

## 📱 PHASE 2: FRONTEND IMPLEMENTATION (2-3 hours)

### Step 1: Create New Component File

**File**: `client/src/pages/Staff/StaffBorrowTimeline.jsx`  
**Based on**: Copy structure from MyBorrowedItems.jsx (but extend for staff actions)

```javascript
"use client"

import { useEffect, useState, useContext } from "react"
import axios from "axios"
import { UserContext } from "../../../context/userContext"
import toast from "react-hot-toast"
import { 
  CheckCircle, 
  Clock, 
  Package,
  Search,
  ChevronRight,
  AlertCircle,
  FileText,
  Filter
} from "lucide-react"
import PageLayout from "../../components/layout/PageLayout"

export default function StaffBorrowTimeline() {
  const { user } = useContext(UserContext)
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedRequest, setExpandedRequest] = useState(null)
  const [requestPhotos, setRequestPhotos] = useState({})
  const [groupedRequests, setGroupedRequests] = useState([])
  const [filter, setFilter] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [actionLoading, setActionLoading] = useState({})

  // ========== HELPER FUNCTIONS ==========
  // Copy from MyBorrowedItems and adapt

  const formatDate = (dateString) => {
    if (!dateString) return "N/A"
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric"
    })
  }

  const getDaysFromToday = (dueDate) => {
    if (!dueDate) return Number.MAX_VALUE
    const due = new Date(dueDate)
    due.setHours(0, 0, 0, 0)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return Math.floor((due - today) / (1000 * 60 * 60 * 24))
  }

  const isOverdue = (dueDate, status) => {
    if (status === "returned") return false
    if (!dueDate) return false
    return getDaysFromToday(dueDate) < 0
  }

  const getStatusConfig = (status) => {
    const configs = {
      pending: {
        icon: Clock,
        color: "text-orange-600 dark:text-orange-400",
        bgColor: "bg-orange-50 dark:bg-orange-900/20",
        badge: "bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-300"
      },
      approved: {
        icon: CheckCircle,
        color: "text-blue-600 dark:text-blue-400",
        bgColor: "bg-blue-50 dark:bg-blue-900/20",
        badge: "bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300"
      },
      pending_return: {
        icon: AlertCircle,
        color: "text-amber-600 dark:text-amber-400",
        bgColor: "bg-amber-50 dark:bg-amber-900/20",
        badge: "bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300"
      },
      returned: {
        icon: CheckCircle,
        color: "text-green-600 dark:text-green-400",
        bgColor: "bg-green-50 dark:bg-green-900/20",
        badge: "bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300"
      },
      declined: {
        icon: FileText,
        color: "text-red-600 dark:text-red-400",
        bgColor: "bg-red-50 dark:bg-red-900/20",
        badge: "bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300"
      }
    }
    return configs[status] || configs.pending
  }

  const getProgress = (status) => {
    const progress = {
      pending: 25,
      approved: 50,
      pending_return: 75,
      returned: 100,
      declined: 0
    }
    return progress[status] || 0
  }

  const formatRelativeDays = (days) => {
    if (days < 0) return `Overdue: ${Math.abs(days)}d`
    if (days === 0) return "Due: Today"
    if (days === 1) return "Due: Tomorrow"
    return `Due: ${days}d`
  }

  // ========== DATA FETCHING ==========

  const fetchRequests = async () => {
    try {
      setLoading(true)
      const res = await axios.get("/api/borrow/requests")
      // Filter out reserved status
      const visible = res.data.filter(r => r.status !== "reserved")
      setRequests(visible)
      console.log(`✅ Loaded ${visible.length} requests for timeline`)
    } catch (err) {
      console.error("❌ Failed to load requests:", err.message)
      toast.error("Failed to load borrow requests")
    } finally {
      setLoading(false)
    }
  }

  const fetchPhotosForRequest = async (requestId) => {
    try {
      const res = await axios.get(`/api/borrow/photos/${requestId}`)
      const photos = res.data?.photos || []
      setRequestPhotos(prev => ({ ...prev, [requestId]: photos }))
    } catch (err) {
      console.error("❌ Failed to fetch photos:", err.message)
      setRequestPhotos(prev => ({ ...prev, [requestId]: [] }))
    }
  }

  // ========== ACTION HANDLERS ==========

  const handleApprove = async (id) => {
    const today = new Date()
    const dueDate = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
    const dueDateStr = dueDate.toISOString().split("T")[0]

    setActionLoading(prev => ({ ...prev, [id]: true }))
    try {
      await axios.put(`/api/borrow/requests/${id}/approve`, {
        staff_id: user.id,
        due_date: dueDateStr
      })
      toast.success("✅ Request approved")
      fetchRequests()
    } catch (err) {
      console.error("❌ Approve error:", err.message)
      toast.error("Failed to approve request")
    } finally {
      setActionLoading(prev => ({ ...prev, [id]: false }))
    }
  }

  const handleDecline = async (id) => {
    if (!window.confirm("Are you sure you want to decline this request?")) return

    setActionLoading(prev => ({ ...prev, [id]: true }))
    try {
      await axios.put(`/api/borrow/requests/${id}/decline`, {
        reason: "Declined by staff"
      })
      toast.success("✅ Request declined")
      fetchRequests()
    } catch (err) {
      console.error("❌ Decline error:", err.message)
      toast.error("Failed to decline request")
    } finally {
      setActionLoading(prev => ({ ...prev, [id]: false }))
    }
  }

  const handleApproveReturn = async (id) => {
    if (!window.confirm("Approve this return?")) return

    setActionLoading(prev => ({ ...prev, [`return-${id}`]: true }))
    try {
      await axios.post(`/api/borrow/return/approve`, {
        borrowing_request_id: id
      })
      toast.success("✅ Return approved")
      fetchRequests()
    } catch (err) {
      console.error("❌ Approve return error:", err.message)
      toast.error("Failed to approve return")
    } finally {
      setActionLoading(prev => ({ ...prev, [`return-${id}`]: false }))
    }
  }

  const handleDeclineReturn = async (id) => {
    const reason = window.prompt("Enter reason for declining return:", "")
    if (reason === null) return

    setActionLoading(prev => ({ ...prev, [`decline-${id}`]: true }))
    try {
      await axios.post(`/api/borrow/return/decline`, {
        borrowing_request_id: id,
        reason: reason || null
      })
      toast.error("Return declined. Borrower notified to resubmit.")
      fetchRequests()
    } catch (err) {
      console.error("❌ Decline return error:", err.message)
      toast.error("Failed to decline return")
    } finally {
      setActionLoading(prev => ({ ...prev, [`decline-${id}`]: false }))
    }
  }

  // ========== INITIAL LOAD ==========

  useEffect(() => {
    fetchRequests()
  }, [])

  // ========== GROUPING & FILTERING ==========

  useEffect(() => {
    // Filter by status if specified
    let filtered = filter === "all" 
      ? requests 
      : requests.filter(r => r.status === filter)

    // Filter by search query
    if (searchQuery.trim()) {
      const searchLower = searchQuery.toLowerCase()
      filtered = filtered.filter(r =>
        (r.borrower_name || "").toLowerCase().includes(searchLower) ||
        r.items?.some(item => (item.item_name || "").toLowerCase().includes(searchLower))
      )
    }

    // Organize into 7 sections by urgency and status
    const sections = {
      overdue: [],
      dueToday: [],
      dueSoon: [],
      toReturn: [],
      pendingApproval: [],
      pendingReview: [],
      completed: []
    }

    for (const req of filtered) {
      if (req.status === "pending") {
        sections.pendingApproval.push(req)
      } else if (req.status === "pending_return") {
        sections.pendingReview.push(req)
      } else if (req.status === "returned") {
        sections.completed.push(req)
      } else if (req.status === "declined") {
        // Show declined in pending approval section
        sections.pendingApproval.push(req)
      } else if (req.status === "approved") {
        // Organize approved by due date urgency
        const daysUntilDue = getDaysFromToday(req.due_date)
        if (daysUntilDue < 0) {
          sections.overdue.push(req)
        } else if (daysUntilDue === 0) {
          sections.dueToday.push(req)
        } else if (daysUntilDue >= 1 && daysUntilDue <= 2) {
          sections.dueSoon.push(req)
        } else {
          sections.toReturn.push(req)
        }
      }
    }

    // Sort each section by urgency
    sections.overdue.sort((a, b) => getDaysFromToday(a.due_date) - getDaysFromToday(b.due_date))
    sections.dueToday.sort((a, b) => getDaysFromToday(a.due_date) - getDaysFromToday(b.due_date))
    sections.dueSoon.sort((a, b) => getDaysFromToday(a.due_date) - getDaysFromToday(b.due_date))
    sections.toReturn.sort((a, b) => getDaysFromToday(a.due_date) - getDaysFromToday(b.due_date))
    sections.pendingApproval.sort((a, b) => new Date(b.request_date) - new Date(a.request_date))
    sections.pendingReview.sort((a, b) => new Date(b.request_date) - new Date(a.request_date))
    sections.completed.sort((a, b) => new Date(b.returned_at) - new Date(a.returned_at))

    setGroupedRequests(sections)
  }, [filter, requests, searchQuery])

  // ========== RENDER SECTION ==========

  const renderSection = (title, emoji, requests, bgColor) => {
    if (requests.length === 0) return null

    return (
      <div key={title} className="space-y-3">
        {/* Section Header */}
        <div className="flex items-center gap-3 px-2 py-2 sticky top-20 bg-surface-container-lowest dark:bg-[#1a1a1a] z-10">
          <span className="text-lg">{emoji}</span>
          <h3 className={`text-sm font-bold uppercase tracking-wide ${bgColor}`}>
            {title} ({requests.length})
          </h3>
          <div className="flex-1 h-px" style={{backgroundColor: bgColor}}></div>
        </div>

        {/* Request Cards */}
        {requests.map(req => {
          const isExpanded = expandedRequest === req.id
          const statusConfig = getStatusConfig(req.status)
          const progress = getProgress(req.status)
          const isPending = req.status === "pending"
          const isApproved = req.status === "approved"
          const isPendingReturn = req.status === "pending_return"
          const isReturned = req.status === "returned"

          return (
            <div
              key={req.id}
              className="bg-surface-container-low dark:bg-[#222] rounded-xl border border-transparent dark:border-gray-700 hover:border-primary/20 dark:hover:border-primary/30 transition-all shadow-sm dark:shadow-black/40 overflow-hidden"
            >
              {/* Card Header */}
              <button
                onClick={() => {
                  if (!isExpanded && !requestPhotos[req.id]) {
                    fetchPhotosForRequest(req.id)
                  }
                  setExpandedRequest(isExpanded ? null : req.id)
                }}
                className="w-full p-4 flex items-center gap-3 hover:bg-surface-container-high dark:hover:bg-[#2a2a2a] transition-colors text-left"
              >
                {/* Avatar */}
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/15 dark:bg-blue-900/30 flex items-center justify-center">
                  <span className="text-sm font-bold text-primary">
                    {req.borrower_name?.charAt(0) || "?"}
                  </span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-on-surface dark:text-white text-sm">
                      {req.borrower_name || "Unknown"}
                    </p>
                    {isOverdue(req.due_date, req.status) && (
                      <span className="text-xs px-2 py-0.5 bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 rounded-full">
                        ⚠️ Overdue
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-on-surface-variant dark:text-gray-400">
                    {req.quantity} item{req.quantity !== 1 ? "s" : ""}
                  </p>
                </div>

                {/* Status Badge & Expand */}
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${statusConfig.badge}`}>
                    {req.status.replace("_", " ")}
                  </span>
                  <ChevronRight
                    className={`w-5 h-5 text-on-surface-variant dark:text-gray-400 flex-shrink-0 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                  />
                </div>
              </button>

              {/* Timeline Progress Bar */}
              <div className="px-4 py-3 border-t border-outline-variant/20 dark:border-gray-700 bg-surface-container-lowest/50 dark:bg-[#1a1a1a]/80 space-y-1">
                {/* Full dashed timeline */}
                <div className="w-full h-[1px] border-t border-dashed border-gray-300 dark:border-gray-600"></div>

                {/* Solid progress line */}
                <div className="relative h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${statusConfig.color.replace('text-', 'bg-')}`}
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>

                {/* Status labels below timeline */}
                <div className="flex justify-between text-[10px] font-semibold text-on-surface-variant dark:text-gray-500 px-1">
                  <span>Pending (25%)</span>
                  <span>Approved (50%)</span>
                  <span>In Office (75%)</span>
                  <span>Returned (100%)</span>
                </div>

                {/* Due date info */}
                {req.due_date && (
                  <p className="text-xs text-on-surface-variant dark:text-gray-400 pt-2">
                    <strong>Due:</strong> {formatDate(req.due_date)} ({formatRelativeDays(getDaysFromToday(req.due_date))})
                  </p>
                )}
              </div>

              {/* Expanded Content */}
              <div
                className={`overflow-hidden transition-all duration-300 ${isExpanded ? "max-h-full" : "max-h-0"}`}
              >
                <div className="border-t border-outline-variant/20 dark:border-gray-700 p-4 bg-surface-container-lowest/50 dark:bg-[#1a1a1a]/80 space-y-4">
                  
                  {/* Photos */}
                  <div>
                    <p className="text-xs font-bold text-on-surface-variant dark:text-gray-400 uppercase mb-2">Photos</p>
                    {requestPhotos[req.id]?.length > 0 ? (
                      <div className="grid grid-cols-2 gap-2">
                        {requestPhotos[req.id].slice(0, 4).map((photo, idx) => (
                          <img
                            key={idx}
                            src={photo.photo_url}
                            alt="photo"
                            className="w-full h-24 object-cover rounded-lg border border-outline-variant/20 dark:border-gray-700"
                          />
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-on-surface-variant dark:text-gray-400">No photos</p>
                    )}
                  </div>

                  {/* Items */}
                  <div>
                    <p className="text-xs font-bold text-on-surface-variant dark:text-gray-400 uppercase mb-2">Items</p>
                    <div className="space-y-1">
                      {req.items?.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs p-2 rounded-lg bg-surface-container-low/50 dark:bg-[#1a1a1a]/50">
                          <p className="font-medium text-on-surface dark:text-white">
                            {item.item_name}
                          </p>
                          <span className="text-xs font-bold text-primary">×{item.borrowed_quantity || 1}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Actions */}
                  {isPending && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApprove(req.id)}
                        disabled={actionLoading[req.id]}
                        className="flex-1 px-3 py-2 bg-primary dark:bg-blue-600 text-on-primary dark:text-white rounded-lg font-medium text-xs hover:bg-primary-container dark:hover:bg-blue-700 transition-all disabled:opacity-50"
                      >
                        {actionLoading[req.id] ? "Approving..." : "✅ Approve"}
                      </button>
                      <button
                        onClick={() => handleDecline(req.id)}
                        disabled={actionLoading[req.id]}
                        className="flex-1 px-3 py-2 bg-surface-container-low dark:bg-[#2a2a2a] border border-outline-variant/20 dark:border-gray-700 text-on-surface dark:text-white rounded-lg font-medium text-xs hover:bg-surface-container-high dark:hover:bg-[#333] transition-all disabled:opacity-50"
                      >
                        {actionLoading[req.id] ? "Declining..." : "❌ Decline"}
                      </button>
                    </div>
                  )}

                  {isApproved && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApproveReturn(req.id)}
                        disabled={actionLoading[`return-${req.id}`]}
                        className="flex-1 px-3 py-2 bg-primary dark:bg-blue-600 text-on-primary dark:text-white rounded-lg font-medium text-xs hover:bg-primary-container dark:hover:bg-blue-700 transition-all disabled:opacity-50"
                      >
                        {actionLoading[`return-${req.id}`] ? "Processing..." : "👋 Mark Received"}
                      </button>
                    </div>
                  )}

                  {isPendingReturn && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApproveReturn(req.id)}
                        disabled={actionLoading[`return-${req.id}`]}
                        className="flex-1 px-3 py-2 bg-primary dark:bg-blue-600 text-on-primary dark:text-white rounded-lg font-medium text-xs hover:bg-primary-container dark:hover:bg-blue-700 transition-all disabled:opacity-50"
                      >
                        {actionLoading[`return-${req.id}`] ? "Processing..." : "✅ Approve Return"}
                      </button>
                      <button
                        onClick={() => handleDeclineReturn(req.id)}
                        disabled={actionLoading[`decline-${req.id}`]}
                        className="flex-1 px-3 py-2 bg-surface-container-low dark:bg-[#2a2a2a] border border-outline-variant/20 dark:border-gray-700 text-on-surface dark:text-white rounded-lg font-medium text-xs hover:bg-surface-container-high dark:hover:bg-[#333] transition-all disabled:opacity-50"
                      >
                        {actionLoading[`decline-${req.id}`] ? "Processing..." : "❌ Decline"}
                      </button>
                    </div>
                  )}

                  {req.return_decline_reason && (
                    <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                      <p className="text-xs font-semibold text-red-700 dark:text-red-300">Return Declined:</p>
                      <p className="text-xs text-red-600 dark:text-red-400 mt-1">{req.return_decline_reason}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // ========== PAGE RENDER ==========

  if (loading) {
    return (
      <PageLayout>
        <div className="flex items-center justify-center min-h-screen bg-surface dark:bg-[#171717] text-on-surface-variant dark:text-gray-400">
          Loading requests...
        </div>
      </PageLayout>
    )
  }

  return (
    <PageLayout>
      <div className="bg-surface dark:bg-[#171717] transition-colors duration-300">
        {/* Header */}
        <div className="px-6 md:px-8 lg:px-12 pt-8 pb-6 bg-surface dark:bg-[#171717]">
          <div className="flex items-start justify-between gap-6">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-on-surface dark:text-white mb-2">
                Borrow Management
              </h1>
              <p className="text-on-surface-variant dark:text-gray-400 text-sm">
                Track and manage borrowing requests through completion
              </p>
            </div>

            {/* Stats */}
            <div className="flex gap-3 flex-wrap items-center justify-end">
              <div className="px-4 py-2 bg-surface-container-low dark:bg-[#222] rounded-full text-sm font-medium text-on-surface dark:text-white border border-outline-variant/20 dark:border-gray-700 whitespace-nowrap">
                Total: <span className="font-bold text-primary">{requests.length}</span>
              </div>
              <div className="px-4 py-2 bg-surface-container-low dark:bg-[#222] rounded-full text-sm font-medium text-on-surface dark:text-white border border-outline-variant/20 dark:border-gray-700 whitespace-nowrap">
                Pending: <span className="font-bold text-orange-600 dark:text-orange-400">{requests.filter(r => r.status === "pending").length}</span>
              </div>
              <div className="px-4 py-2 bg-surface-container-low dark:bg-[#222] rounded-full text-sm font-medium text-on-surface dark:text-white border border-outline-variant/20 dark:border-gray-700 whitespace-nowrap">
                In Office: <span className="font-bold text-amber-600 dark:text-amber-400">{requests.filter(r => r.status === "pending_return").length}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="px-6 md:px-8 lg:px-12 space-y-4 pb-12">
          {/* Search & Filters */}
          <div className="flex items-center gap-3 bg-surface-container-low dark:bg-[#222] rounded-lg px-4 py-3 border border-transparent dark:border-gray-700 shadow-sm dark:shadow-black/40">
            <Search className="w-5 text-on-surface-variant dark:text-gray-400" />
            <input
              type="text"
              placeholder="Search by borrower name or item..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent focus:outline-none text-sm text-on-surface dark:text-white placeholder-gray-500 dark:placeholder-gray-500"
            />
          </div>

          {/* Request Sections */}
          <div className="space-y-8 mt-8">
            {renderSection("🔴 OVERDUE", "🔴", groupedRequests.overdue, "text-red-600 dark:text-red-400")}
            {renderSection("🟡 DUE TODAY", "🟡", groupedRequests.dueToday, "text-yellow-600 dark:text-yellow-400")}
            {renderSection("🟠 DUE SOON", "🟠", groupedRequests.dueSoon, "text-orange-600 dark:text-orange-400")}
            {renderSection("🔵 TO RETURN", "🔵", groupedRequests.toReturn, "text-blue-600 dark:text-blue-400")}
            {renderSection("⚪ PENDING APPROVAL", "⚪", groupedRequests.pendingApproval, "text-gray-600 dark:text-gray-400")}
            {renderSection("⚫ PENDING REVIEW", "⚫", groupedRequests.pendingReview, "text-gray-700 dark:text-gray-500")}
            {renderSection("🟢 COMPLETED", "🟢", groupedRequests.completed, "text-green-600 dark:text-green-400")}
          </div>

          {/* Empty State */}
          {Object.values(groupedRequests).every(arr => arr.length === 0) && (
            <div className="py-16 text-center">
              <Package className="w-12 h-12 text-on-surface-variant/30 dark:text-gray-600 mx-auto mb-4" />
              <p className="text-on-surface-variant dark:text-gray-400">No requests to manage</p>
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  )
}
```

---

### Step 2: Update Routes in App.jsx

**File**: `client/src/App.jsx`

Replace:
```javascript
<Route path="manage-requests" element={<ManageBorrowRequests />} />
<Route path="return-items" element={<ReturnItems />} />
```

With:
```javascript
<Route path="manage-requests" element={<StaffBorrowTimeline />} />
<Route path="return-items" element={<StaffBorrowTimeline />} /> // Both point to unified page
```

---

## ✅ Testing Checklist

### Backend Testing
- [ ] GET `/api/borrow/requests` returns `approved_at` field
- [ ] GET `/api/borrow/requests` returns `return_decline_reason` field
- [ ] GET `/api/borrow/requests` returns `declined_at` field
- [ ] PUT `/api/borrow/requests/:id/approve` updates `approved_at`
- [ ] POST `/api/borrow/return/approve` works correctly
- [ ] POST `/api/borrow/return/decline` stores reason (if implementing)

### Frontend Testing
- [ ] Page loads without errors
- [ ] All 7 sections render (even if empty)
- [ ] Timeline progress bar shows correct % for each status
- [ ] Approve button works (status → approved)
- [ ] Decline button works (status → declined)
- [ ] Approve Return button works (pending_return → returned)
- [ ] Decline Return button works (pending_return → approved)
- [ ] Overdue items show warning badge
- [ ] Search by borrower name works
- [ ] Filter dropdown works
- [ ] Dark mode works
- [ ] Mobile responsive

---

## 🎉 Success = Unified Timeline Live!

Once complete, staff will see:
- ✅ All requests in one view with 4-stage barline timeline
- ✅ Automatic organization into 7 priority sections
- ✅ Clear visual progress as each request moves through lifecycle
- ✅ All actions available at each stage
- ✅ Complete audit trail with timestamps

