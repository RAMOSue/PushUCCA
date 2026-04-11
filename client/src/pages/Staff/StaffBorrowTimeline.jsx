"use client"

import { useState, useEffect, useContext } from "react"
import { useLocation } from "react-router-dom"
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
import ViewReturnPhotosModal from "../../components/modals/ViewReturnPhotosModal"

dayjs.extend(utc)
dayjs.extend(timezone)

export default function StaffBorrowTimeline() {
  const { user } = useContext(UserContext)
  const { refreshAfterReturn } = useContext(BorrowingContext)
  const location = useLocation()

  // ========== STATE MANAGEMENT ==========
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState({})
  const [expandedRequest, setExpandedRequest] = useState(null)
  const [requestPhotos, setRequestPhotos] = useState({})
  const [groupedRequests, setGroupedRequests] = useState([])
  const [filter, setFilter] = useState("all")
  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false)
  const [filterHovering, setFilterHovering] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [divisions, setDivisions] = useState([])
  const [selectedDivision, setSelectedDivision] = useState(null)
  const [borrowerProfiles, setBorrowerProfiles] = useState({})
  const [dueDates, setDueDates] = useState({})
  
  // Staff photo capture for manual return
  const [staffPhotoCaptureOpen, setStaffPhotoCaptureOpen] = useState(false)
  const [selectedRequestForPhotos, setSelectedRequestForPhotos] = useState(null)
  const [photosViewerOpen, setPhotosViewerOpen] = useState(false)
  const [photosRequestId, setPhotosRequestId] = useState(null)

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

  const getStatusConfig = (status) => {
    const configs = {
      pending: { bgColor: "bg-warning/15 dark:bg-orange-900/30", textColor: "text-warning" },
      approved: { bgColor: "bg-primary/15 dark:bg-blue-900/30", textColor: "text-primary" },
      pending_return: { bgColor: "bg-warning/15 dark:bg-orange-900/30", textColor: "text-warning" },
      returned: { bgColor: "bg-primary/15 dark:bg-blue-900/30", textColor: "text-primary" },
      declined: { bgColor: "bg-error/15 dark:bg-red-900/30", textColor: "text-error" },
    }
    return configs[status] || configs.pending
  }

  const getProgress = (status) => {
    const progressMap = {
      pending: 25,
      approved: 50,
      pending_return: 75,
      returned: 100,
      declined: 0,
    }
    return progressMap[status] || 0
  }

  const formatRelativeDays = (days) => {
    if (days === null) return ""
    if (days === 0) return "Due today"
    if (days === 1) return "Due tomorrow"
    if (days > 0) return `Due in ${days}d`
    if (days === -1) return "Overdue 1d"
    return `Overdue ${Math.abs(days)}d`
  }

  const isDeclined = (request) => {
    return request.status === "declined" || (request.status === "pending_return" && request.return_decline_reason)
  }

  const getStatusLabel = (status) => {
    const labels = {
      pending: "Pending Approval",
      approved: "Approved",
      pending_return: "Pending Review",
      returned: "Completed",
      declined: "Declined",
    }
    return labels[status] || status
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

  const fetchPhotosForRequest = async (requestId) => {
    try {
      const res = await axios.get(`/api/borrow/photos/${requestId}`)
      setRequestPhotos((prev) => ({ ...prev, [requestId]: res.data }))
    } catch (err) {
      console.error("Failed to fetch photos:", err.message)
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
    // Organize into 7 sections
    const sections = {
      overdue: { title: "🔴 Overdue", requests: [], emoji: "🔴" },
      dueToday: { title: "🟡 Due Today", requests: [], emoji: "🟡" },
      dueSoon: { title: "🟠 Due Soon", requests: [], emoji: "🟠" },
      toReturn: { title: "🔵 To Return", requests: [], emoji: "🔵" },
      pending: { title: "⚪ Pending Approval", requests: [], emoji: "⚪" },
      pendingReview: { title: "⚫ Pending Review", requests: [], emoji: "⚫" },
      completed: { title: "🟢 Completed", requests: [], emoji: "🟢" },
    }

    for (const req of filtered) {
      const daysFromToday = getDaysFromToday(req.due_date)
      const isDeclinedReq = isDeclined(req)

      if (req.status === "declined" || isDeclinedReq) {
        sections.pending.requests.push(req)
      } else if (req.status === "pending") {
        sections.pending.requests.push(req)
      } else if (req.status === "pending_return") {
        sections.pendingReview.requests.push(req)
      } else if (req.status === "returned") {
        sections.completed.requests.push(req)
      } else if (req.status === "approved") {
        if (isOverdue(req.due_date, "approved")) {
          sections.overdue.requests.push(req)
        } else if (daysFromToday === 0) {
          sections.dueToday.requests.push(req)
        } else if (daysFromToday > 0 && daysFromToday <= 3) {
          sections.dueSoon.requests.push(req)
        } else if (daysFromToday > 3) {
          sections.toReturn.requests.push(req)
        }
      }
    }

    // Sort within each section by due date (urgent first)
    Object.values(sections).forEach((section) => {
      section.requests.sort((a, b) => {
        const daysA = getDaysFromToday(a.due_date) || 999
        const daysB = getDaysFromToday(b.due_date) || 999
        return daysA - daysB
      })
    })

    // Return only non-empty sections in order
    return Object.values(sections).filter((section) => section.requests.length > 0)
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
          {/* Search Bar */}
          <div className="flex items-center gap-3 bg-surface-container-low dark:bg-[#222] rounded-lg px-3 py-2.5 border border-transparent dark:border-gray-700 hover:border-primary/20 dark:hover:border-blue-400/30 focus-within:ring-2 focus-within:ring-primary dark:focus-within:ring-blue-400 focus-within:border-transparent dark:focus-within:border-transparent transition shadow-sm">
            <Search className="w-4 h-4 text-on-surface-variant dark:text-gray-400 flex-shrink-0" />
            <input
              type="text"
              placeholder="Search items or request ID..."
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

          {/* Filters */}
          <div className="flex gap-2 flex-wrap items-center mb-8">
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

          {/* SECTIONS */}
          {groupedRequests.length === 0 ? (
            <div className="py-16 text-center">
              <Package className="w-12 h-12 text-on-surface-variant/30 dark:text-gray-600 mx-auto mb-4" />
              <p className="text-on-surface-variant dark:text-gray-400 text-sm">You're all caught up 🎉</p>
              <p className="text-on-surface-variant dark:text-gray-400 text-xs mt-2">No borrow requests to review</p>
            </div>
          ) : (
            <div className="space-y-8">
              {groupedRequests.map((section) => (
                <div key={section.title} className="space-y-4">
                  {/* Section Header */}
                  <div className="flex items-center gap-4 pt-6 pb-2">
                    <h2 className="text-lg font-bold text-on-surface dark:text-white whitespace-nowrap">
                      {section.title}
                    </h2>
                    <div className="flex-1 h-px bg-outline-variant/20 dark:bg-gray-700"></div>
                    <span className="text-xs font-semibold text-on-surface-variant dark:text-gray-400 whitespace-nowrap">
                      {section.requests.length} {section.requests.length === 1 ? "item" : "items"}
                    </span>
                  </div>

                  {/* Request Cards */}
                  <div className="space-y-3">
                    {section.requests.map((req) => {
                      const isExpanded = expandedRequest === req.id
                      const statusConfig = getStatusConfig(req.status)
                      const daysFromToday = getDaysFromToday(req.due_date)
                      const isDeclinedReq = isDeclined(req)

                      return (
                        <div
                          key={req.id}
                          className="bg-surface-container-low dark:bg-[#1a1a1a] rounded-lg border border-outline-variant/20 dark:border-gray-700 overflow-hidden shadow-sm hover:shadow-md dark:hover:shadow-black/40 transition-all duration-200"
                        >
                          <button
                            onClick={() => setExpandedRequest(isExpanded ? null : req.id)}
                            className="w-full p-1.5 md:p-2 flex items-center gap-2 hover:bg-surface-container-high dark:hover:bg-[#222] transition-colors text-left"
                          >
                            {/* Borrower Avatar - Smaller */}
                            <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary/15 dark:bg-blue-900/30 flex items-center justify-center border-2 border-primary/30 dark:border-blue-500/30 bg-surface-container-high dark:bg-[#222] shadow-sm overflow-hidden">
                              {borrowerProfiles[req.borrower_id] ? (
                                <img
                                  src={borrowerProfiles[req.borrower_id]}
                                  alt={req.borrower_name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <span className="text-sm font-bold text-primary">
                                  {req.borrower_name?.charAt(0) || "?"}
                                </span>
                              )}
                            </div>

                            {/* Borrower Name + Timeline Bar Inline */}
                            <div className="flex-1 min-w-0 flex flex-col justify-center" style={{ height: "56px" }}>
                              {/* Borrower Name - Above Line */}
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <span className="text-xs font-bold text-on-surface dark:text-white truncate">
                                  {req.borrower_name || "Unknown"}
                                </span>
                              </div>

                              {/* Mini Timeline Bar - SAME AS BORROWER SIDE */}
                              <div className="relative w-full h-6 flex items-center">
                                {/* Thin dashed line baseline */}
                                <div className="absolute top-1/2 left-0 w-full h-[1px] -translate-y-1/2">
                                  <div className="w-full h-full border-t border-dashed border-gray-300 dark:border-gray-600"></div>
                                </div>

                                {/* Solid progress bar colored by status */}
                                <div
                                  className="absolute top-1/2 left-0 h-[1px] -translate-y-1/2 transition-all duration-500"
                                  style={{
                                    width: `${getProgress(req.status)}%`,
                                    backgroundColor: req.status === "declined" ? "#dc2626" : 
                                                    req.status === "pending" ? "#f59e0b" :
                                                    req.status === "approved" ? "#3b82f6" :
                                                    req.status === "pending_return" ? "#eab308" :
                                                    req.status === "returned" ? "#22c55e" : "#6b7280"
                                  }}
                                ></div>

                                {/* Status dot with label above and date below */}
                                <div
                                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 flex flex-col items-center"
                                  style={{ left: `${getProgress(req.status)}%` }}
                                >
                                  {/* Status label above dot */}
                                  <div className="flex items-center gap-0.5 mb-0.5">
                                    <p className={`text-[9px] font-bold uppercase ${
                                      req.status === "declined" ? "text-red-600 dark:text-red-400" :
                                      req.status === "pending" ? "text-orange-600 dark:text-orange-400" :
                                      req.status === "approved" ? "text-blue-600 dark:text-blue-400" :
                                      req.status === "pending_return" ? "text-amber-600 dark:text-amber-400" :
                                      req.status === "returned" ? "text-green-600 dark:text-green-400" : "text-gray-600 dark:text-gray-400"
                                    } whitespace-nowrap`}>
                                      {getStatusLabel(req.status)}
                                    </p>
                                  </div>

                                  {/* Colored dot */}
                                  <div
                                    className="w-2.5 h-2.5 rounded-full shadow-sm border-2 border-surface-container-low dark:border-[#222]"
                                    style={{
                                      backgroundColor: req.status === "declined" ? "#dc2626" : 
                                                      req.status === "pending" ? "#f59e0b" :
                                                      req.status === "approved" ? "#3b82f6" :
                                                      req.status === "pending_return" ? "#eab308" :
                                                      req.status === "returned" ? "#22c55e" : "#6b7280"
                                    }}
                                  ></div>

                                  {/* Date below dot */}
                                  <p className="text-[8px] text-on-surface-variant dark:text-gray-500 whitespace-nowrap mt-0.5">
                                    {req.approved_at ? new Date(req.approved_at).toLocaleDateString() : 
                                     req.request_date ? new Date(req.request_date).toLocaleDateString() : "N/A"}
                                  </p>
                                </div>
                              </div>

                              {/* Due Date Info Below Progress Bar */}
                              <p className={`text-[8px] font-semibold ${
                                req.status === "returned" ? "text-green-600 dark:text-green-400" :
                                req.status === "declined" ? "text-red-600 dark:text-red-400" :
                                "text-on-surface-variant dark:text-gray-400"
                              } whitespace-normal mt-1`}>
                                {req.status === "returned" ? "Return confirmed. Thank you!" :
                                 req.status === "declined" ? "Request declined" :
                                 daysFromToday === 0 ? "Due: Today" :
                                 daysFromToday > 0 ? `Due: ${daysFromToday}d` :
                                 `Overdue: ${Math.abs(daysFromToday)}d`}
                              </p>
                            </div>

                            {/* Item Count Badge + Chevron */}
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-surface-container-lowest dark:bg-[#222] text-on-surface dark:text-gray-300 border border-outline-variant/20 dark:border-gray-700">
                                {req.quantity}
                              </span>
                              <ChevronRight
                                className={`w-4 h-4 text-on-surface-variant dark:text-gray-400 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                              />
                            </div>
                          </button>

                          {/* Expanded Content */}
                          <div
                            className={`overflow-hidden transition-all duration-300 ease-in-out ${
                              isExpanded ? "max-h-full" : "max-h-0"
                            }`}
                          >
                            <div className="border-t border-outline-variant/20 dark:border-gray-700 p-3 md:p-4 bg-surface-container-lowest/50 dark:bg-[#1a1a1a]/80 grid grid-cols-2 gap-4">
                              {/* Photos */}
                              <div className="flex flex-col gap-2">
                                {requestPhotos[req.id] && requestPhotos[req.id].length > 0 ? (
                                  <div className="grid grid-cols-2 gap-2">
                                    {requestPhotos[req.id].slice(0, 4).map((photo, idx) => (
                                      <img
                                        key={idx}
                                        src={photo.photo_url}
                                        alt="Request photo"
                                        className="w-full h-24 object-cover rounded-lg border border-outline-variant/20 dark:border-gray-700"
                                      />
                                    ))}
                                    {requestPhotos[req.id].length > 4 && (
                                      <div className="w-full h-24 bg-surface-container-high dark:bg-[#2a2a2a] rounded-lg border border-outline-variant/20 dark:border-gray-700 flex items-center justify-center">
                                        <p className="text-xs font-bold text-on-surface-variant dark:text-gray-400">
                                          +{requestPhotos[req.id].length - 4}
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <p className="text-xs text-on-surface-variant dark:text-gray-400 py-4 text-center">
                                    No photos
                                  </p>
                                )}
                              </div>

                              {/* Actions & Details */}
                              <div className="space-y-4">
                                {/* Decline Reason Warning */}
                                {isDeclinedReq && req.return_decline_reason && (
                                  <div className="px-3 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                                    <p className="text-xs text-red-700 dark:text-red-400">
                                      <span className="font-bold">Decline Reason:</span> {req.return_decline_reason}
                                    </p>
                                  </div>
                                )}

                                {/* Action Buttons */}
                                {req.status === "pending" && (
                                  <div className="flex gap-2 flex-col">
                                    <button
                                      onClick={() => handleApprove(req.id, true)}
                                      disabled={actionLoading[req.id]}
                                      className="w-full px-3 py-2 bg-primary dark:bg-blue-600 text-on-primary dark:text-white rounded-lg font-medium text-xs hover:bg-primary-container dark:hover:bg-blue-700 transition-all disabled:opacity-50"
                                    >
                                      {actionLoading[req.id] ? "Approving..." : "Approve"}
                                    </button>
                                    <button
                                      onClick={() => handleDecline(req.id)}
                                      disabled={actionLoading[req.id]}
                                      className="w-full px-3 py-2 bg-surface-container-low dark:bg-[#2a2a2a] border border-outline-variant/20 dark:border-gray-700 text-on-surface dark:text-white rounded-lg font-medium text-xs hover:bg-surface-container-high dark:hover:bg-[#333] transition-all disabled:opacity-50"
                                    >
                                      {actionLoading[req.id] ? "Declining..." : "Decline"}
                                    </button>
                                  </div>
                                )}

                                {req.status === "pending_return" && (
                                  <div className="flex gap-2 flex-col">
                                    <button
                                      onClick={() => handleApproveReturn(req)}
                                      disabled={actionLoading[req.id]}
                                      className="w-full px-3 py-2 bg-primary dark:bg-blue-600 text-on-primary dark:text-white rounded-lg font-medium text-xs hover:bg-primary-container dark:hover:bg-blue-700 transition-all disabled:opacity-50"
                                    >
                                      {actionLoading[req.id] ? "Approving..." : "Approve Return"}
                                    </button>
                                    <button
                                      onClick={() => handleDeclineReturn(req)}
                                      disabled={actionLoading[`decline-${req.id}`]}
                                      className="w-full px-3 py-2 bg-surface-container-low dark:bg-[#2a2a2a] border border-outline-variant/20 dark:border-gray-700 text-on-surface dark:text-white rounded-lg font-medium text-xs hover:bg-surface-container-high dark:hover:bg-[#333] transition-all disabled:opacity-50"
                                    >
                                      {actionLoading[`decline-${req.id}`] ? "Declining..." : "Decline Return"}
                                    </button>
                                  </div>
                                )}

                                {req.status === "approved" && (
                                  <button
                                    onClick={() => handleManualReturn(req)}
                                    disabled={actionLoading[`manual-${req.id}`]}
                                    className="w-full px-3 py-2 bg-primary dark:bg-blue-600 text-on-primary dark:text-white rounded-lg font-medium text-xs hover:bg-primary-container dark:hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                                  >
                                    <Hand className="w-3.5 h-3.5" />
                                    {actionLoading[`manual-${req.id}`] ? "Processing..." : "Mark as Received"}
                                  </button>
                                )}

                                {/* Items List */}
                                <div className="space-y-1">
                                  <p className="text-xs font-bold text-on-surface-variant dark:text-gray-400 uppercase tracking-wide">
                                    Items
                                  </p>
                                  {req.items.map((item, idx) => (
                                    <div
                                      key={idx}
                                      className="flex items-center justify-between text-xs p-1.5 rounded-lg bg-surface-container-low/50 dark:bg-[#1a1a1a]/50"
                                    >
                                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                        <Package className="w-3 h-3 text-on-surface-variant/50 dark:text-gray-600 flex-shrink-0" />
                                        <div className="min-w-0">
                                          <p className="font-medium text-on-surface dark:text-white truncate">
                                            {item.item_name}
                                          </p>
                                          <p className="text-xs text-on-surface-variant dark:text-gray-400">
                                            {item.category}
                                          </p>
                                        </div>
                                      </div>
                                      <span className="text-xs font-bold text-primary ml-1 flex-shrink-0">
                                        ×{item.borrowed_quantity}
                                      </span>
                                    </div>
                                  ))}
                                </div>

                                {/* Dates */}
                                {req.due_date && (
                                  <div className="pt-2 border-t border-outline-variant/20 dark:border-gray-700">
                                    <p className="text-xs text-on-surface-variant dark:text-gray-400">
                                      Due: {dayjs(req.due_date).tz("Asia/Manila").format("MMM DD, YYYY")}
                                    </p>
                                  </div>
                                )}

                                {req.status === "returned" && (
                                  <div className="pt-2 border-t border-outline-variant/20 dark:border-gray-700">
                                    <p className="text-xs text-primary dark:text-blue-400">✓ Return completed</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
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

      {photosViewerOpen && photosRequestId && (
        <ViewReturnPhotosModal
          requestId={photosRequestId}
          onClose={() => {
            setPhotosViewerOpen(false)
            setPhotosRequestId(null)
          }}
        />
      )}
    </PageLayout>
  )
}
