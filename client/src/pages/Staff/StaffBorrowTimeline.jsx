"use client"

import { useState, useEffect, useContext } from "react"
import axios from "axios"
import toast from "react-hot-toast"
import { Search, ChevronRight, Package, Hand } from "lucide-react"
import dayjs from "dayjs"
import utc from "dayjs/plugin/utc"
import timezone from "dayjs/plugin/timezone"
import PageLayout from "../../components/layout/PageLayout"
import { UserContext } from "../../../context/userContext"
import { BorrowingContext } from "../../../context/borrowingContext"
import StaffReturnPhotoCaptureModal from "../../components/modals/StaffReturnPhotoCaptureModal"

dayjs.extend(utc)
dayjs.extend(timezone)

export default function StaffBorrowTimeline() {
  const { user } = useContext(UserContext)
  const { refreshAfterReturn } = useContext(BorrowingContext)

  // ========== STATE MANAGEMENT ==========
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState({})
  const [groupedRequests, setGroupedRequests] = useState([])
  const [filter, setFilter] = useState("all")
  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false)
  const [filterHovering, setFilterHovering] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [divisions, setDivisions] = useState([])
  const [selectedDivision, setSelectedDivision] = useState(null)
  const [borrowerProfiles, setBorrowerProfiles] = useState({})
  const [dueDates] = useState({})

  // Staff photo capture for manual return
  const [staffPhotoCaptureOpen, setStaffPhotoCaptureOpen] = useState(false)
  const [selectedRequestForPhotos, setSelectedRequestForPhotos] = useState(null)

  // ========== HELPER FUNCTIONS ==========
  const formatDate = (dateString) => {
    if (!dateString) return "N/A"
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    })
  }

  const getDaysFromToday = (dueDate) => {
    if (!dueDate) return null
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const due = new Date(dueDate)
    due.setHours(0, 0, 0, 0)
    const diffTime = due - today
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  const isOverdue = (dueDate, status) => {
    if (!dueDate || status !== "approved" && status !== "pending_return") return false
    return getDaysFromToday(dueDate) < 0
  }

  const getStatusMeta = (status) => {
    const meta = {
      pending: {
        label: "Pending Approval",
        title: "Pending",
        description: "Awaiting staff review",
        badgeClass: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
        dotColor: "#f59e0b",
      },
      approved: {
        label: "Approved",
        title: "Approved",
        description: "Ready for handoff",
        badgeClass: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
        dotColor: "#3b82f6",
      },
      pending_return: {
        label: "Pending Return",
        title: "Pending Return",
        description: "Awaiting return confirmation",
        badgeClass: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
        dotColor: "#8b5cf6",
      },
      returned: {
        label: "Completed",
        title: "Returned",
        description: "Return completed",
        badgeClass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
        dotColor: "#22c55e",
      },
      declined: {
        label: "Declined",
        title: "Declined",
        description: "Request was rejected",
        badgeClass: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
        dotColor: "#dc2626",
      },
    }

    return meta[status] || meta.pending
  }

  const isDeclined = (request) => {
    return request.status === "declined" || (request.status === "pending_return" && request.return_decline_reason)
  }

  const getStatusLabel = (status) => {
    return getStatusMeta(status).label
  }

  // ========== DATA FETCHING ==========
  const fetchBorrowerProfiles = async () => {
    try {
      const { data } = await axios.get("/api/profiles/all", {
        withCredentials: true,
      })
      const profileMap = {}
      data.forEach((profile) => {
        profileMap[profile.borrower_id] = profile.profile_pic_url
      })
      setBorrowerProfiles(profileMap)
    } catch (err) {
      console.error("❌ Failed to fetch borrower profiles:", err.message)
    }
  }

  const fetchRequests = async () => {
    try {
      const res = await axios.get("/api/borrow/requests")
      const normalized = res.data.map((req) => ({
        ...req,
        items: Array.isArray(req.items) ? req.items : [],
      }))
      const visible = normalized.filter((r) => r.status !== "reserved")
      setRequests(visible)
    } catch (err) {
      console.error("❌ Failed to fetch requests:", err.message)
      toast.error("Failed to load borrow requests")
    } finally {
      setLoading(false)
    }
  }

  const fetchDivisions = async () => {
    try {
      const res = await axios.get("/api/master-list/units")
      if (res.data && Array.isArray(res.data)) {
        const activeDivisions = res.data.filter(d => d.status?.toLowerCase() === 'active')
        setDivisions(activeDivisions)
      }
    } catch (err) {
      console.error("Failed to fetch divisions:", err.message)
    }
  }

  useEffect(() => {
    fetchRequests()
    fetchBorrowerProfiles()
    fetchDivisions()
  }, [])

  // ========== FILTERING & GROUPING ==========
  useEffect(() => {
    let filtered = filter === "all" ? requests : requests.filter((r) => r.status === filter)

    // Filter by division if selected
    if (selectedDivision) {
      filtered = filtered.filter((r) => r.division_id === selectedDivision)
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const searchLower = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (r) =>
          (r.borrower_name || "").toLowerCase().includes(searchLower) ||
          (r.borrower_email || "").toLowerCase().includes(searchLower) ||
          (r.borrower_division || "").toLowerCase().includes(searchLower) ||
          r.items?.some((item) => (item.item_name || "").toLowerCase().includes(searchLower))
      )
    }

    setGroupedRequests(groupAndSortRequests(filtered))
  }, [filter, requests, searchQuery, selectedDivision])

  const groupAndSortRequests = (filtered) => {
    const columns = [
      { key: "pending", title: "Pending", description: "Awaiting approval", badgeClass: "bg-amber-500/15 text-amber-700 dark:text-amber-300", dotColor: "#f59e0b", requests: [] },
      { key: "approved", title: "Approved", description: "Ready for release", badgeClass: "bg-sky-500/15 text-sky-700 dark:text-sky-300", dotColor: "#3b82f6", requests: [] },
      { key: "pending_return", title: "Pending Return", description: "Awaiting confirmation", badgeClass: "bg-violet-500/15 text-violet-700 dark:text-violet-300", dotColor: "#8b5cf6", requests: [] },
      { key: "returned", title: "Returned", description: "Completed borrows", badgeClass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300", dotColor: "#22c55e", requests: [] },
      { key: "declined", title: "Declined", description: "Rejected requests", badgeClass: "bg-rose-500/15 text-rose-700 dark:text-rose-300", dotColor: "#dc2626", requests: [] },
    ]

    const columnMap = new Map(columns.map((column) => [column.key, column]))

    for (const req of filtered) {
      const isDeclinedReq = isDeclined(req)

      if (req.status === "declined" || isDeclinedReq) {
        columnMap.get("declined").requests.push(req)
      } else if (req.status === "pending") {
        columnMap.get("pending").requests.push(req)
      } else if (req.status === "approved") {
        columnMap.get("approved").requests.push(req)
      } else if (req.status === "pending_return") {
        columnMap.get("pending_return").requests.push(req)
      } else if (req.status === "returned") {
        columnMap.get("returned").requests.push(req)
      } else {
        columnMap.get("pending").requests.push(req)
      }
    }

    columns.forEach((column) => {
      column.requests.sort((a, b) => {
        const dateA = new Date(a.due_date || a.request_date || a.approved_at || a.created_at || 0).getTime()
        const dateB = new Date(b.due_date || b.request_date || b.approved_at || b.created_at || 0).getTime()
        return dateA - dateB
      })
    })

    return columns.filter((column) => column.requests.length > 0)
  }

  // ========== ACTION HANDLERS ==========
  const calculateDueDate = () => {
    const today = new Date()
    const dueDate = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
    return dueDate.toISOString().split("T")[0]
  }

  const handleApprove = async (id, useAutoDate = false) => {
    const due_date = useAutoDate ? calculateDueDate() : dueDates[id]
    if (!due_date) {
      toast.error("Please set a due date")
      return
    }

    // ✅ OPTIMISTIC UPDATE: Update UI immediately
    const originalRequests = requests
    setRequests((prev) =>
      prev.map((req) =>
        req.id === id
          ? { ...req, status: "approved", due_date }
          : req
      )
    )

    setActionLoading((prev) => ({ ...prev, [id]: true }))
    try {
      await axios.put(
        `/api/borrow/requests/${id}/approve`,
        { staff_id: user.id, due_date },
        { withCredentials: true }
      )
      toast.success("Request approved")
      // Already updated optimistically, no full refetch needed
    } catch (err) {
      // ✅ ROLLBACK on error
      console.error("❌ Failed to approve:", err.message)
      setRequests(originalRequests)
      toast.error(err.response?.data?.error || "Failed to approve request")
    } finally {
      setActionLoading((prev) => ({ ...prev, [id]: false }))
    }
  }

  const handleDecline = async (id) => {
    if (!window.confirm("Are you sure?")) return
    
    // ✅ OPTIMISTIC UPDATE: Update UI immediately
    const originalRequests = requests
    setRequests((prev) =>
      prev.map((req) =>
        req.id === id
          ? { ...req, status: "declined" }
          : req
      )
    )

    setActionLoading((prev) => ({ ...prev, [id]: true }))
    try {
      await axios.put(
        `/api/borrow/requests/${id}/decline`,
        {},
        { withCredentials: true }
      )
      toast.success("Request declined")
      // Already updated optimistically
    } catch (err) {
      // ✅ ROLLBACK on error
      console.error("❌ Failed to decline:", err.message)
      setRequests(originalRequests)
      toast.error(err.response?.data?.error || "Failed to decline request")
    } finally {
      setActionLoading((prev) => ({ ...prev, [id]: false }))
    }
  }

  const handleApproveReturn = async (request) => {
    if (!window.confirm(`Approve return for ${request.borrower_name}?`)) return

    // ✅ OPTIMISTIC UPDATE: Update UI immediately
    const originalRequests = requests
    setRequests((prev) =>
      prev.map((req) =>
        req.id === request.id
          ? { ...req, status: "returned" }
          : req
      )
    )

    setActionLoading((prev) => ({ ...prev, [request.id]: true }))
    try {
      await axios.post(
        `/api/borrow/return/approve`,
        { borrowing_request_id: request.id },
        { withCredentials: true }
      )
      toast.success("Return approved")
      // Already updated optimistically
      if (refreshAfterReturn) refreshAfterReturn()
    } catch (err) {
      // ✅ ROLLBACK on error
      console.error("❌ Failed to approve return:", err.message)
      setRequests(originalRequests)
      toast.error(err.response?.data?.error || "Failed to approve return")
    } finally {
      setActionLoading((prev) => ({ ...prev, [request.id]: false }))
    }
  }

  const handleDeclineReturn = async (request) => {
    const reason = window.prompt(
      `Decline return for ${request.borrower_name}?\n\nEnter reason for declining:`,
      ""
    )
    if (reason === null) return

    // ✅ OPTIMISTIC UPDATE: Update UI immediately
    const originalRequests = requests
    setRequests((prev) =>
      prev.map((req) =>
        req.id === request.id
          ? { ...req, return_decline_reason: reason }
          : req
      )
    )

    setActionLoading((prev) => ({ ...prev, [`decline-${request.id}`]: true }))
    try {
      await axios.post(
        `/api/borrow/return/decline`,
        { borrowing_request_id: request.id, reason },
        { withCredentials: true }
      )
      toast.success("Return declined")
      // Already updated optimistically
      if (refreshAfterReturn) refreshAfterReturn()
    } catch (err) {
      // ✅ ROLLBACK on error
      console.error("❌ Failed to decline return:", err.message)
      setRequests(originalRequests)
      toast.error(err.response?.data?.error || "Failed to decline return")
    } finally {
      setActionLoading((prev) => ({ ...prev, [`decline-${request.id}`]: false }))
    }
  }

  const handleManualReturn = (request) => {
    setSelectedRequestForPhotos(request)
    setStaffPhotoCaptureOpen(true)
  }

  const handleManualReturnComplete = async () => {
    // ✅ Modal already submitted photos - just refresh and close
    if (!selectedRequestForPhotos) return

    try {
      toast.success("Return completed with photos!")
      fetchRequests()
      if (refreshAfterReturn) refreshAfterReturn()
    } catch (err) {
      console.error("❌ Failed to refresh:", err.message)
    } finally {
      setStaffPhotoCaptureOpen(false)
      setSelectedRequestForPhotos(null)
    }
  }

  if (loading) {
    return (
      <PageLayout>
        <div className="flex items-center justify-center min-h-screen bg-surface dark:bg-[#171717] text-on-surface-variant dark:text-gray-400 transition-colors">
          Loading unified timeline...
        </div>
      </PageLayout>
    )
  }

  return (
    <PageLayout>
      <div className="bg-surface dark:bg-[#171717] transition-colors duration-300">
        {/* ========== HEADER ==========*/}
        <div className="px-6 md:px-8 lg:px-12 pt-8 pb-6 bg-surface dark:bg-[#171717]">
          <div className="flex items-start justify-between gap-6">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-on-surface dark:text-white mb-2">
                Borrow Timeline
              </h1>
              <p className="text-on-surface-variant dark:text-gray-400 text-sm">
                Manage requests and returns with a unified timeline view.
              </p>
            </div>

            <div className="flex gap-2 flex-wrap justify-end">
              <div className="px-3 py-1.5 bg-surface-container-low dark:bg-[#222] rounded-full text-xs font-medium text-on-surface dark:text-white border border-outline-variant/20 dark:border-gray-700 whitespace-nowrap">
                Pending: <span className="font-bold text-primary dark:text-blue-400">{requests.filter((r) => r.status === "pending").length}</span>
              </div>
              <div className="px-3 py-1.5 bg-surface-container-low dark:bg-[#222] rounded-full text-xs font-medium text-on-surface dark:text-white border border-outline-variant/20 dark:border-gray-700 whitespace-nowrap">
                In Progress: <span className="font-bold text-primary dark:text-blue-400">{requests.filter((r) => r.status === "approved" || r.status === "pending_return").length}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ========== MAIN CONTENT ==========*/}
        <div className="px-6 md:px-8 lg:px-12 space-y-4 bg-surface dark:bg-[#171717]">
          <div className="flex items-center gap-3 bg-surface-container-low dark:bg-[#222] rounded-lg px-3 py-2.5 border border-transparent dark:border-gray-700 hover:border-primary/20 dark:hover:border-blue-400/30 focus-within:ring-2 focus-within:ring-primary dark:focus-within:ring-blue-400 focus-within:border-transparent dark:focus-within:border-transparent transition shadow-sm">
            <Search className="w-4 h-4 text-on-surface-variant dark:text-gray-400 flex-shrink-0" />
            <input
              type="text"
              placeholder="Search borrower, division, or item..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent focus:outline-none text-xs text-on-surface dark:text-white dark:placeholder-gray-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="px-1.5 text-on-surface-variant dark:text-gray-400 hover:text-on-surface dark:hover:text-white transition"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex gap-2 flex-wrap items-center mb-2">
            <button
              onClick={() => setSelectedDivision(null)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                selectedDivision === null
                  ? "bg-primary text-on-primary shadow-sm"
                  : "bg-surface-container-low dark:bg-[#222] text-on-surface dark:text-white border border-outline-variant/30 dark:border-gray-700 hover:bg-surface-container-high dark:hover:bg-[#2a2a2a]"
              }`}
            >
              All
            </button>
            {divisions.map((div) => (
              <button
                key={div.id}
                onClick={() => setSelectedDivision(div.id)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  selectedDivision === div.id
                    ? "bg-primary text-on-primary shadow-sm"
                    : "bg-surface-container-low dark:bg-[#222] text-on-surface dark:text-white border border-outline-variant/30 dark:border-gray-700 hover:bg-surface-container-high dark:hover:bg-[#2a2a2a]"
                }`}
              >
                {div.name}
              </button>
            ))}

            <div
              className="relative bg-surface-container-low dark:bg-[#222] rounded-lg border border-outline-variant/20 dark:border-gray-700 shadow-sm dark:shadow-black/40 ml-auto transition-colors"
              onMouseEnter={() => setFilterHovering(true)}
              onMouseLeave={() => setFilterHovering(false)}
            >
              <button
                onClick={() => setFilterDropdownOpen(!filterDropdownOpen)}
                className="px-4 py-2.5 flex items-center justify-between gap-2 hover:bg-surface-container-high dark:hover:bg-[#2a2a2a] transition-colors text-left whitespace-nowrap min-w-[145px]"
              >
                <span className="text-xs font-medium text-on-surface dark:text-white">
                  <span className="text-on-surface-variant dark:text-gray-400">Status:</span>{" "}
                  <span className="font-bold text-primary capitalize">{filter}</span>
                </span>
                <ChevronRight
                  className={`w-3.5 h-3.5 text-on-surface-variant dark:text-gray-400 transition-transform duration-300 flex-shrink-0 ${
                    filterDropdownOpen || filterHovering ? "rotate-90" : ""
                  }`}
                />
              </button>

              <div
                className={`absolute top-full left-0 right-0 mt-0 bg-surface-container-low dark:bg-[#222] rounded-b-lg border-t border-outline-variant/20 dark:border-gray-700 overflow-hidden transition-all duration-300 ease-in-out z-20 ${
                  filterDropdownOpen || filterHovering ? "max-h-96 opacity-100 visible" : "max-h-0 opacity-0 invisible"
                }`}
              >
                <div className="px-3 py-2 space-y-1">
                  {[
                    { value: "all", label: "All", count: requests.length },
                    { value: "pending", label: "Pending", count: requests.filter((r) => r.status === "pending").length },
                    { value: "approved", label: "Approved", count: requests.filter((r) => r.status === "approved").length },
                    { value: "pending_return", label: "Pending Review", count: requests.filter((r) => r.status === "pending_return").length },
                    { value: "returned", label: "Returned", count: requests.filter((r) => r.status === "returned").length },
                    { value: "declined", label: "Declined", count: requests.filter((r) => r.status === "declined").length },
                  ].map((option) => (
                    <label
                      key={option.value}
                      className="flex items-center gap-2 px-2 py-1.5 hover:bg-surface-container-lowest dark:hover:bg-[#1a1a1a] rounded-lg cursor-pointer transition-colors"
                    >
                      <input
                        type="radio"
                        name="filter"
                        value={option.value}
                        checked={filter === option.value}
                        onChange={(e) => {
                          setFilter(e.target.value)
                          setFilterDropdownOpen(false)
                        }}
                        className="w-3.5 h-3.5 accent-primary flex-shrink-0"
                      />
                      <span className="text-xs font-medium text-on-surface dark:text-white flex-1">
                        {option.label}
                      </span>
                      <span className="text-xs font-semibold bg-surface-container-lowest dark:bg-[#1a1a1a] px-1.5 py-0.5 rounded text-on-surface-variant dark:text-gray-400">
                        {option.count}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {groupedRequests.length === 0 ? (
            <div className="py-16 text-center rounded-2xl border border-dashed border-outline-variant/40 dark:border-gray-700 bg-surface-container-low/50 dark:bg-[#1f1f1f]">
              <Package className="w-12 h-12 text-on-surface-variant/30 dark:text-gray-600 mx-auto mb-4" />
              <p className="text-on-surface-variant dark:text-gray-400 text-sm">You're all caught up 🎉</p>
              <p className="text-on-surface-variant dark:text-gray-400 text-xs mt-2">No borrow requests to review</p>
            </div>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-4">
              {groupedRequests.map((column) => {
                const columnMeta = getStatusMeta(column.key)
                return (
                  <div
                    key={column.key}
                    className="min-w-[290px] max-w-[320px] flex-1 rounded-2xl border border-outline-variant/20 dark:border-gray-700 bg-surface-container-low/70 dark:bg-[#1d1d1d] shadow-sm"
                  >
                    <div className="sticky top-0 z-10 rounded-t-2xl border-b border-outline-variant/20 dark:border-gray-700 bg-surface-container-low/95 dark:bg-[#1d1d1d]/95 px-4 py-3 backdrop-blur">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: column.dotColor }} />
                            <h2 className="text-sm font-semibold text-on-surface dark:text-white">{column.title}</h2>
                          </div>
                          <p className="text-[11px] text-on-surface-variant dark:text-gray-400 mt-1">{column.description}</p>
                        </div>
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${column.badgeClass}`}>
                          {column.requests.length}
                        </span>
                      </div>
                    </div>

                    <div className="max-h-[70vh] overflow-y-auto p-3 space-y-3">
                      {column.requests.map((req) => {
                        const isDeclinedReq = isDeclined(req)
                        const daysFromToday = getDaysFromToday(req.due_date)
                        const statusMeta = getStatusMeta(req.status)

                        return (
                          <div
                            key={req.id}
                            className="rounded-xl border border-outline-variant/20 dark:border-gray-700 bg-surface-container-lowest dark:bg-[#171717] p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: statusMeta.dotColor }} />
                                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-on-surface-variant dark:text-gray-400">
                                    {req.request_id || `REQ-${req.id}`}
                                  </p>
                                </div>
                                <h3 className="mt-2 text-sm font-semibold text-on-surface dark:text-white truncate">
                                  {req.borrower_name || "Unknown borrower"}
                                </h3>
                              </div>
                              <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${statusMeta.badgeClass}`}>
                                {statusMeta.title}
                              </span>
                            </div>

                            <div className="mt-3 space-y-2 text-xs text-on-surface-variant dark:text-gray-400">
                              <div className="flex items-center justify-between">
                                <span>Requested</span>
                                <span className="font-medium text-on-surface dark:text-gray-200">
                                  {formatDate(req.request_date || req.created_at)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span>Items</span>
                                <span className="font-medium text-on-surface dark:text-gray-200">{req.quantity || req.items?.length || 0}</span>
                              </div>
                              {req.due_date && (
                                <div className="flex items-center justify-between">
                                  <span>Due</span>
                                  <span className="font-medium text-on-surface dark:text-gray-200">
                                    {dayjs(req.due_date).tz("Asia/Manila").format("MMM DD, YYYY")}
                                  </span>
                                </div>
                              )}
                            </div>

                            {req.items?.length > 0 && (
                              <div className="mt-3 rounded-lg border border-outline-variant/20 dark:border-gray-700 bg-surface-container-low/70 dark:bg-[#222] p-2">
                                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-on-surface-variant dark:text-gray-400">Items</p>
                                <div className="mt-2 space-y-1.5">
                                  {req.items.slice(0, 3).map((item, idx) => (
                                    <div key={idx} className="flex items-center justify-between gap-2 text-xs">
                                      <span className="truncate text-on-surface dark:text-gray-200">{item.item_name}</span>
                                      <span className="font-semibold text-primary">×{item.borrowed_quantity}</span>
                                    </div>
                                  ))}
                                  {req.items.length > 3 && (
                                    <p className="text-[10px] text-on-surface-variant dark:text-gray-400">+{req.items.length - 3} more</p>
                                  )}
                                </div>
                              </div>
                            )}

                            {isDeclinedReq && req.return_decline_reason && (
                              <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-2 text-[11px] text-rose-700 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-300">
                                {req.return_decline_reason}
                              </div>
                            )}

                            <div className="mt-3 flex items-center justify-between gap-2">
                              <div className="text-[10px] font-medium text-on-surface-variant dark:text-gray-400">
                                {daysFromToday === 0 ? "Due today" : daysFromToday > 0 ? `Due in ${daysFromToday}d` : `Overdue ${Math.abs(daysFromToday)}d`}
                              </div>
                              <div className="flex items-center gap-1.5">
                                {req.status === "pending" && (
                                  <>
                                    <button
                                      onClick={() => handleApprove(req.id, true)}
                                      disabled={actionLoading[req.id]}
                                      className="rounded-md bg-primary px-2.5 py-1.5 text-[11px] font-semibold text-on-primary transition hover:bg-primary/90 disabled:opacity-50"
                                    >
                                      {actionLoading[req.id] ? "..." : "Approve"}
                                    </button>
                                    <button
                                      onClick={() => handleDecline(req.id)}
                                      disabled={actionLoading[req.id]}
                                      className="rounded-md border border-outline-variant/30 px-2.5 py-1.5 text-[11px] font-semibold text-on-surface dark:text-white transition hover:bg-surface-container-high"
                                    >
                                      {actionLoading[req.id] ? "..." : "Decline"}
                                    </button>
                                  </>
                                )}

                                {req.status === "approved" && (
                                  <button
                                    onClick={() => handleManualReturn(req)}
                                    disabled={actionLoading[`manual-${req.id}`]}
                                    className="rounded-md bg-primary px-2.5 py-1.5 text-[11px] font-semibold text-on-primary transition hover:bg-primary/90 disabled:opacity-50"
                                  >
                                    {actionLoading[`manual-${req.id}`] ? "..." : "Receive"}
                                  </button>
                                )}

                                {req.status === "pending_return" && (
                                  <>
                                    <button
                                      onClick={() => handleApproveReturn(req)}
                                      disabled={actionLoading[req.id]}
                                      className="rounded-md bg-primary px-2.5 py-1.5 text-[11px] font-semibold text-on-primary transition hover:bg-primary/90 disabled:opacity-50"
                                    >
                                      {actionLoading[req.id] ? "..." : "Approve"}
                                    </button>
                                    <button
                                      onClick={() => handleDeclineReturn(req)}
                                      disabled={actionLoading[`decline-${req.id}`]}
                                      className="rounded-md border border-outline-variant/30 px-2.5 py-1.5 text-[11px] font-semibold text-on-surface dark:text-white transition hover:bg-surface-container-high"
                                    >
                                      {actionLoading[`decline-${req.id}`] ? "..." : "Decline"}
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* MODALS */}
      {staffPhotoCaptureOpen && selectedRequestForPhotos && (
        <StaffReturnPhotoCaptureModal
          isOpen={staffPhotoCaptureOpen}
          requestId={selectedRequestForPhotos.id}
          borrowerName={selectedRequestForPhotos.borrower_name}
          itemCount={selectedRequestForPhotos.quantity}
          onClose={() => {
            setStaffPhotoCaptureOpen(false)
            setSelectedRequestForPhotos(null)
          }}
          onPhotosSubmitted={handleManualReturnComplete}
        />
      )}
    </PageLayout>
  )
}
