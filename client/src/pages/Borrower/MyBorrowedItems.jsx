import React, { useContext, useEffect, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import { UserContext } from "../../../context/userContext";
import { BorrowingContext } from "../../../context/borrowingContext";
import { CheckCircle, Clock, AlertCircle, AlertTriangle, X, ChevronLeft, ChevronRight, Search, Package } from "lucide-react";
import PageLayout from "../../components/layout/PageLayout";
import ReturnModal from "../../components/modals/ReturnModal";
import { getInventoryDivisionInfo } from "../../utils/inventoryDivisionStorage";

export default function MyBorrowedItems() {
  const { user } = useContext(UserContext);
  const { refreshBorrowHistory } = useContext(BorrowingContext);
  const [borrowHistory, setBorrowHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedItems, setExpandedItems] = useState({});
  const [notificationModal, setNotificationModal] = useState(null);
  
  // Return flow state - unified modal
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [selectedRequestForReturn, setSelectedRequestForReturn] = useState(null);

  // Return photos modal state
  const [returnPhotosModalOpen, setReturnPhotosModalOpen] = useState(false);
  const [returnPhotos, setReturnPhotos] = useState([]);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [loadingPhotos, setLoadingPhotos] = useState(false);

  // ✅ Format date like "October 7, 2025"
  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    if (isNaN(date)) return "N/A";
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const todayDate = formatDate(new Date());

  const handleReturnComplete = () => {
    // Show success modal
    setNotificationModal({
      type: "return_success",
      message: "✅ Thank you! This request has been marked as returned.",
    });
    
    // Auto hide after 3 seconds
    setTimeout(() => setNotificationModal(null), 3000);
    
    // Refresh the borrow history after return is complete
    setReturnModalOpen(false);
    setSelectedRequestForReturn(null);
    fetchBorrowHistory();
  };

  // Fetch return photos for a specific request
  const fetchReturnPhotos = async (requestId) => {
    setLoadingPhotos(true);
    try {
      const res = await axios.get(`/api/borrow/return/photos/${requestId}`, {
        withCredentials: true
      });
      setReturnPhotos(res.data.photos || []);
      setCurrentPhotoIndex(0);
      setReturnPhotosModalOpen(true);
    } catch (err) {
      console.error("Failed to fetch return photos:", err);
      // Show error to user
      setNotificationModal({
        type: "error",
        message: "❌ Failed to load return photos. Please try again.",
      });
      setTimeout(() => setNotificationModal(null), 3000);
    } finally {
      setLoadingPhotos(false);
    }
  };

  const nextPhoto = () => {
    if (returnPhotos.length > 0) {
      setCurrentPhotoIndex((returnPhotos.length + currentPhotoIndex + 1) % returnPhotos.length);
    }
  };

  const prevPhoto = () => {
    if (returnPhotos.length > 0) {
      setCurrentPhotoIndex((returnPhotos.length + currentPhotoIndex - 1) % returnPhotos.length);
    }
  };

  const fetchBorrowHistory = async () => {
    if (!user?.id) return;
    try {
      const res = await axios.get(`/api/borrow/history/${user.id}`);
      const grouped = [];
      const map = new Map();

      res.data.forEach((req) => {
        if (!map.has(req.request_id)) {
          map.set(req.request_id, { ...req, items: req.items || [] });
          grouped.push(map.get(req.request_id));
        } else if (req.items && req.items.length) {
          const existing = map.get(req.request_id);
          existing.items = [...existing.items, ...req.items];
        }
      });

      setBorrowHistory(grouped);
      setLoading(false);
    } catch (err) {
      console.error("Failed to fetch borrow history:", err);
      setLoading(false);
    }
  };

  const formatRelativeDays = (dueDateStr) => {
    if (!dueDateStr) return "";
    
    // Parse date string and handle timezone correctly
    const due = new Date(dueDateStr);
    // Create today's date at midnight for accurate comparison
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    due.setHours(0, 0, 0, 0);
    
    const diff = Math.floor((due - today) / (1000 * 60 * 60 * 24));
    
    if (diff < 0) {
      const overdueCount = Math.abs(diff);
      return overdueCount === 1 ? "1 day overdue" : `${overdueCount} days overdue`;
    }
    if (diff === 0) return "Due today";
    if (diff === 1) return "Due tomorrow";
    return `Due in ${diff} day(s)`;
  };

  // Get section category for grouping
  const getSectionCategory = (request) => {
    if (isOverdue(request.due_date, request.status)) return "OVERDUE";
    
    const due = new Date(request.due_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    due.setHours(0, 0, 0, 0);
    
    const diff = Math.floor((due - today) / (1000 * 60 * 60 * 24));
    
    if (diff === 0) return "TODAY";
    return "EARLIER";
  };

  useEffect(() => {
    fetchBorrowHistory();
  }, [user, refreshBorrowHistory]);

  const isOverdue = (dueDate, status) => {
    // Items marked as returned are not overdue
    if (!dueDate || status === "returned") return false;
    
    // Create date objects at midnight for accurate comparison
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    
    // Item is overdue if due date is in the past
    return due < today;
  };

  // Status icon and color mapping
  const getStatusConfig = (status) => {
    switch (status) {
      case "pending":
        return {
          icon: <Clock className="w-5 h-5" />,
          color: "bg-orange-50/50 border-orange-200/50",
          badgeColor: "bg-orange-100 text-orange-800",
          textColor: "text-orange-800",
        };
      case "approved":
        return {
          icon: <CheckCircle className="w-5 h-5" />,
          color: "bg-primary/5 border-primary/20",
          badgeColor: "bg-primary/10 text-primary",
          textColor: "text-primary",
        };
      case "returned":
        return {
          icon: <CheckCircle className="w-5 h-5" />,
          color: "bg-surface-container-low border-outline-variant/20",
          badgeColor: "bg-surface-container-high text-on-surface",
          textColor: "text-on-surface",
        };
      case "pending_return":
        return {
          icon: <AlertCircle className="w-5 h-5" />,
          color: "bg-orange-50/50 border-orange-200/50",
          badgeColor: "bg-orange-100 text-orange-800",
          textColor: "text-orange-800",
        };
      default:
        return {
          icon: <AlertCircle className="w-5 h-5" />,
          color: "bg-surface-container-low border-outline-variant/20",
          badgeColor: "bg-surface-container-high text-on-surface",
          textColor: "text-on-surface",
        };
    }
  };

  // ✅ Calculate progress percentage based on status
  const getProgress = (status) => {
    switch (status) {
      case "pending":
        return 25;
      case "approved":
        return 50;
      case "pending_return":
        return 75;
      case "returned":
        return 100;
      default:
        return 0;
    }
  };

  if (loading)
    return (
      <div className="bg-surface dark:bg-[#171717] min-h-screen flex items-center justify-center px-3 sm:px-4 transition-colors duration-300 scroll-smooth">
        <div className="text-center">
          <Clock className="w-10 sm:w-12 h-10 sm:h-12 text-primary dark:text-blue-400 mx-auto mb-2 sm:mb-3 animate-pulse" />
          <p className="text-on-surface-variant dark:text-gray-400 text-xs sm:text-sm">Loading your items...</p>
        </div>
      </div>
    );

  return (
    <PageLayout>
      <div className="min-h-screen bg-surface dark:bg-[#171717] pb-16 sm:pb-20 transition-colors duration-300 scroll-smooth">
        {/* Header Section - Mobile Optimized */}
        <div className="px-3 sm:px-4 md:px-8 lg:px-12 pt-4 sm:pt-8 pb-3 sm:pb-6">
          <div className="flex flex-col gap-3 sm:gap-4">
            {/* Title */}
            <div>
              <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-on-surface dark:text-white mb-0.5 sm:mb-2">
                My Borrowed Items
              </h1>
              <p className="text-[11px] sm:text-xs md:text-sm text-on-surface-variant dark:text-gray-400">
                Track and manage your requests
              </p>
            </div>

            {/* Summary Pills - Mobile Optimized */}
            <div className="flex gap-2 flex-wrap">
              <div className="px-2.5 sm:px-3 py-1 sm:py-1.5 bg-surface-container-low dark:bg-[#222] rounded-full text-[10px] sm:text-xs font-medium text-on-surface dark:text-white border border-outline-variant/20 dark:border-gray-700 whitespace-nowrap">
                Pending: <span className="font-bold text-primary dark:text-blue-400">{borrowHistory.filter(r => r.status === "pending").length}</span>
              </div>
              <div className="px-2.5 sm:px-3 py-1 sm:py-1.5 bg-surface-container-low dark:bg-[#222] rounded-full text-[10px] sm:text-xs font-medium text-on-surface dark:text-white border border-outline-variant/20 dark:border-gray-700 whitespace-nowrap">
                To Return: <span className="font-bold text-primary dark:text-blue-400">{borrowHistory.filter(r => r.status === "approved").length}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="px-3 sm:px-4 md:px-8 lg:px-12">
          <div className="max-w-5xl mx-auto space-y-3 sm:space-y-4">
            {/* Sticky Search Bar - Mobile Optimized */}
            <div className="sticky top-0 z-10 bg-surface dark:bg-[#171717] py-2 sm:py-3">
              <div className="flex items-center gap-2 sm:gap-3 bg-surface-container-low dark:bg-[#222] rounded-lg px-2.5 sm:px-3 py-2 sm:py-2.5 border border-transparent dark:border-gray-700 hover:border-primary/20 dark:hover:border-blue-400/30 focus-within:ring-2 focus-within:ring-primary dark:focus-within:ring-blue-400 focus-within:border-transparent dark:focus-within:border-transparent transition shadow-sm">
                <Search className="w-3.5 sm:w-4 h-3.5 sm:h-4 text-on-surface-variant dark:text-gray-400 flex-shrink-0" />
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 bg-transparent focus:outline-none text-[11px] sm:text-xs md:text-sm text-on-surface dark:text-white dark:placeholder-gray-500"
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
            </div>

          {(() => {
            // Filter by status
            let filtered = borrowHistory.filter((r) => r.status !== "reserved");
            
            // Apply search filter first
            if (searchQuery.trim()) {
              const searchLower = searchQuery.toLowerCase();
              filtered = filtered.filter((r) =>
                (r.items?.some(item =>
                  (item.item_name || item.name || '').toLowerCase().includes(searchLower)
                )) ||
                (r.request_id || '').toLowerCase().includes(searchLower)
              );
            }

            if (filtered.length === 0) {
              return (
                <div className="py-12 sm:py-16 text-center">
                  <AlertCircle className="w-10 sm:w-12 h-10 sm:h-12 text-on-surface-variant/30 dark:text-gray-500/30 mx-auto mb-2 sm:mb-4" />
                  <p className="text-on-surface text-sm sm:text-base font-medium mb-1 sm:mb-2">
                    {searchQuery ? "No requests match your search" : "No requests found"}
                  </p>
                  <p className="text-on-surface-variant text-[11px] sm:text-sm mb-3 sm:mb-4">
                    {searchQuery ? "Try adjusting your search" : "Browse items to create a new borrow request."}
                  </p>
                  {!searchQuery && (
                    <Link
                      to="/available-items"
                      className="inline-block bg-primary text-on-primary text-xs sm:text-sm font-medium px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg hover:bg-primary-container shadow-sm transition-colors"
                    >
                      Browse Items
                    </Link>
                  )}
                </div>
              );
            }

            // ✅ ORGANIZE INTO SECTIONS - DETAILED FLOW
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const getDaysFromToday = (dueDate) => {
              if (!dueDate) return Number.MAX_VALUE;
              const due = new Date(dueDate);
              due.setHours(0, 0, 0, 0);
              return Math.floor((due - today) / (1000 * 60 * 60 * 24));
            };

            // Helper to check if return was declined
            const isDeclined = (request) => {
              return request.status === "approved" && request?.return_decline_reason;
            };

            // 1. OVERDUE - Only approved items that haven't been returned yet and are past due date
            const overdue = filtered.filter(r => {
              if (r.status === "approved" && !isDeclined(r)) {
                return getDaysFromToday(r.due_date) < 0;
              }
              return false;
            });

            // 2. DUE TODAY
            const dueToday = filtered.filter(r => {
              if (r.status !== "returned" && r.status !== "pending" && r.status !== "pending_return" && !isDeclined(r)) {
                return getDaysFromToday(r.due_date) === 0;
              }
              return false;
            });

            // 3. DUE SOON (1-2 days)
            const dueSoon = filtered.filter(r => {
              if (r.status !== "returned" && r.status !== "pending" && r.status !== "pending_return" && !isDeclined(r)) {
                const days = getDaysFromToday(r.due_date);
                return days >= 1 && days <= 2;
              }
              return false;
            });

            // 4. TO RETURN (Approved but not urgent - more than 2 days away)
            const toReturn = filtered.filter(r => {
              if (r.status === "approved" && !isDeclined(r)) {
                return getDaysFromToday(r.due_date) > 2;
              }
              return false;
            });

            // 5. PENDING APPROVAL (Both pending approval and in office/pending return)
            const pendingApproval = filtered.filter(r => r.status === "pending" || r.status === "pending_return");

            // 6. DECLINED
            const declined = filtered.filter(r => isDeclined(r));

            // 7. COMPLETED
            const completed = filtered.filter(r => r.status === "returned");

            // Sort each section by due date (most urgent first)
            overdue.sort((a, b) => getDaysFromToday(a.due_date) - getDaysFromToday(b.due_date));
            dueToday.sort((a, b) => getDaysFromToday(a.due_date) - getDaysFromToday(b.due_date));
            dueSoon.sort((a, b) => getDaysFromToday(a.due_date) - getDaysFromToday(b.due_date));
            toReturn.sort((a, b) => getDaysFromToday(a.due_date) - getDaysFromToday(b.due_date));
            pendingApproval.sort((a, b) => {
              // Pending items first (by request date), then pending_return items (by due date)
              if (a.status === "pending" && b.status === "pending_return") return -1;
              if (a.status === "pending_return" && b.status === "pending") return 1;
              if (a.status === "pending" && b.status === "pending") {
                return new Date(a.request_date) - new Date(b.request_date);
              }
              // Both pending_return, sort by due date (closest to due first)
              return getDaysFromToday(a.due_date) - getDaysFromToday(b.due_date);
            });
            declined.sort((a, b) => new Date(a.declined_at || a.approved_at) - new Date(b.declined_at || b.approved_at));
            completed.sort((a, b) => new Date(b.returned_at) - new Date(a.returned_at)); // Recent first

            // Render section
            const renderSection = (items, label, labelColor) => {
              if (items.length === 0) return null;

              return (
                <div key={label} className="space-y-2 sm:space-y-3">
                  <h2 className={`text-[9px] sm:text-[10px] font-bold ${labelColor} mb-2 sm:mb-3 uppercase tracking-wide`}>{label}</h2>
                  {items.map((request, index) => {
            const statusConfig = getStatusConfig(request.status);
            const isRequestOverdue = isOverdue(request.due_date, request.status);
            const isExpanded = expandedItems[request.request_id];
            
            return (
              <div
                key={request.request_id || `req-${index}`}
                className={`bg-surface-container-low dark:bg-[#1a1a1a] rounded-lg border overflow-hidden shadow-sm hover:shadow-md dark:hover:shadow-black/40 transition-all duration-200 ${
                  isRequestOverdue ? "border-error/30 dark:border-red-900/40" : "border-outline-variant/20 dark:border-gray-700"
                }`}
              >
                {/* Request Card Header - Compact with Progress Bar - Mobile Optimized */}
                <button
                  onClick={() => setExpandedItems({
                    ...expandedItems,
                    [request.request_id]: !isExpanded
                  })}
                  className="w-full p-1.5 sm:p-2 md:p-2.5 flex items-center gap-1.5 sm:gap-2 hover:bg-surface-container-high dark:hover:bg-[#222] transition-colors duration-200 text-left"
                >
                  {/* Item Image Thumbnail - Smaller */}
                  {(() => {
                    const firstItem = request.items?.[0];
                    const imageUrl = firstItem?.image_url;
                    const itemName = firstItem?.item_name || firstItem?.name || "Item";
                    
                    return (
                      <div className="flex-shrink-0 w-10 sm:w-12 h-10 sm:h-12 rounded-full overflow-hidden border-2 border-primary/30 dark:border-blue-500/30 bg-surface-container-high dark:bg-[#222] shadow-sm">
                        {imageUrl ? (
                          <img
                            src={imageUrl?.startsWith('http') ? imageUrl : `${import.meta.env.VITE_API_URL || window.location.origin}${imageUrl}`}
                            alt={itemName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-on-surface-variant dark:text-gray-400 bg-gradient-to-br from-surface-container-high to-surface-container-lowest dark:from-[#2a2a2a] dark:to-[#1a1a1a]">
                            <Package className="w-4 sm:w-5 h-4 sm:h-5" />
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Request Info with Progress Bar Inline - Mobile Optimized */}
                  <div className="flex-1 min-w-0 flex flex-col justify-center" style={{ height: "auto", minHeight: "44px" }}>
                    {/* Item Name - Above the line */}
                    <div className="flex items-center gap-1 sm:gap-2 flex-wrap mb-0.5 sm:mb-1">
                      {(() => {
                        const firstItem = request.items?.[0];
                        const itemName = firstItem?.item_name || firstItem?.name || "Item";
                        return (
                          <span className="text-[10px] sm:text-xs md:text-sm font-bold text-on-surface dark:text-white truncate">
                            {itemName}
                          </span>
                        );
                      })()}
                      {isRequestOverdue && (
                        <span className="inline-block px-1 py-0.5 rounded-full text-[7px] sm:text-[8px] font-bold bg-error/10 dark:bg-red-900/30 text-error dark:text-red-200 flex-shrink-0">
                          ⚠️
                        </span>
                      )}
                    </div>

                    {/* Progress Bar - Centered */}
                    {(() => {
                      const getStatusColor = (status, request) => {
                        // If return was declined, show error/warning color
                        if (status === "approved" && request?.return_decline_reason) {
                          return { dot: "#dc2626", text: "text-red-600 dark:text-red-400" }; // Red error color
                        }
                        switch (status) {
                          case "pending":
                            return { dot: "#f59e0b", text: "text-orange-600 dark:text-orange-400" };
                          case "approved":
                            return { dot: "#3b82f6", text: "text-blue-600 dark:text-blue-400" };
                          case "pending_return":
                            return { dot: "#eab308", text: "text-amber-600 dark:text-amber-400" };
                          case "returned":
                            return { dot: "#22c55e", text: "text-green-600 dark:text-green-400" };
                          default:
                            return { dot: "#6b7280", text: "text-gray-600 dark:text-gray-400" };
                        }
                      };

                      const getStatusLabel = (status, request) => {
                        // If return was declined, show warning message
                        if (status === "approved" && request?.return_decline_reason) {
                          return request.return_decline_reason;
                        }
                        switch (status) {
                          case "pending":
                            return "Pending";
                          case "approved":
                            return "Approved";
                          case "pending_return":
                            return "In office";
                          case "returned":
                            return "Returned";
                          default:
                            return "Unknown";
                        }
                      };

                      const getStatusDate = (status, request) => {
                        switch (status) {
                          case "pending":
                            return request.request_date ? new Date(request.request_date).toLocaleDateString() : "N/A";
                          case "approved":
                            return request.approved_at ? new Date(request.approved_at).toLocaleDateString() : "N/A";
                          case "pending_return":
                            return request.due_date ? new Date(request.due_date).toLocaleDateString() : "N/A";
                          case "returned":
                            return request.returned_at ? new Date(request.returned_at).toLocaleDateString() : "N/A";
                          default:
                            return "N/A";
                        }
                      };

                      const getRelativeDueDate = (dueDate, status) => {
                        if (status === "returned") {
                          return "Return confirmed. Thank you!";
                        }
                        if (!dueDate) return "Due: N/A";
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        const due = new Date(dueDate);
                        due.setHours(0, 0, 0, 0);
                        const diffDays = Math.floor((due - today) / (1000 * 60 * 60 * 24));
                        
                        if (diffDays === 0) return "Due: Today";
                        if (diffDays > 0) return `Due: ${diffDays}d`;
                        if (diffDays < 0) return `Overdue: ${Math.abs(diffDays)}d`;
                      };

                      const statusColor = getStatusColor(request.status, request);
                      const statusLabel = getStatusLabel(request.status, request);
                      const statusDate = getStatusDate(request.status, request);
                      const relativeDueDate = getRelativeDueDate(request.due_date, request.status);

                      return (
                        <div className="flex flex-col w-full">
                          {/* Progress Bar Row */}
                          <div className="relative w-full h-3 sm:h-4 flex items-center mb-1 sm:mb-2">
                            {/* Thin dashed line */}
                            <div className="absolute top-1/2 left-0 w-full h-[1px] -translate-y-1/2">
                              <div className="w-full h-full border-t border-dashed border-gray-300 dark:border-gray-600"></div>
                            </div>

                            {/* Progress (solid part before dot) */}
                            <div
                              className="absolute top-1/2 left-0 h-[1px] -translate-y-1/2 transition-all duration-500"
                              style={{ 
                                width: `${getProgress(request.status)}%`,
                                backgroundColor: statusColor.dot
                              }}
                            ></div>

                            {/* Status dot with label above and date below */}
                            <div
                              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 flex flex-col items-center"
                              style={{ left: `${getProgress(request.status)}%` }}
                            >
                              {/* Status label above dot */}
                              <div className="flex items-center gap-0.5 mb-0.5">
                                <p className={`text-[7px] sm:text-[8px] font-bold uppercase ${statusColor.text} whitespace-nowrap`}>
                                  {statusLabel}
                                </p>
                                {/* Warning icon if return was declined */}
                                {request?.return_decline_reason && request.status === "approved" && (
                                  <AlertTriangle className="w-2 h-2 text-red-600 dark:text-red-400" />
                                )}
                              </div>

                              {/* Colored dot */}
                              <div
                                className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full shadow-sm border-2 border-surface-container-low dark:border-[#222]"
                                style={{ backgroundColor: statusColor.dot }}
                              ></div>
                              
                              {/* Date below dot */}
                              <p className="text-[7px] text-on-surface-variant dark:text-gray-500 whitespace-nowrap">
                                {statusDate}
                              </p>
                            </div>
                          </div>

                          {/* Due Date Display - Left Aligned Below Progress Bar */}
                          <p className={`text-[8px] sm:text-[9px] font-semibold ${request.status === "returned" ? "text-green-600 dark:text-green-400" : "text-on-surface-variant dark:text-gray-400"} whitespace-normal`}>
                            {relativeDueDate}
                          </p>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Expand Button - Compact */}
                  {request.items && request.items.length > 0 && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <span className="px-1 sm:px-1.5 py-0.5 rounded text-[8px] sm:text-[9px] font-bold bg-surface-container-lowest dark:bg-[#222] text-on-surface dark:text-gray-300 border border-outline-variant/20 dark:border-gray-700">
                        {request.items.length}
                      </span>
                      <ChevronRight
                        className={`w-3.5 sm:w-4 h-3.5 sm:h-4 text-on-surface-variant dark:text-gray-400 transition-transform duration-300 ease-in-out ${isExpanded ? "rotate-90" : ""}`}
                      />
                    </div>
                  )}
                </button>

                {/* Items List - Expandable Receipt Style - Mobile Optimized */}
                {isExpanded && request.items && request.items.length > 0 && (
                  <div className="border-t border-outline-variant/20 dark:border-gray-700 bg-surface-container-low/50 dark:bg-[#1a1a1a]/50 overflow-hidden transition-all duration-300 ease-in-out">
                    {/* Receipt Items - Show First 3 Only */}
                    <div className="p-2 sm:p-3 md:p-4 space-y-1.5 sm:space-y-2">
                      {/* Table Header */}
                      <div className="flex justify-between border-b border-outline-variant/30 dark:border-gray-700 pb-1 sm:pb-2 text-[8px] sm:text-[10px] font-bold text-on-surface dark:text-white mb-1 sm:mb-2 uppercase">
                        <span>Item</span>
                        <span className="text-right">Size</span>
                      </div>

                      {/* Individual Items - First 3 */}
                      {request.items.slice(0, 3).map((item, idx) => (
                        <div key={`${request.request_id}-${item.unit_id || item.id}-${idx}`} className="flex justify-between items-center text-[9px] sm:text-xs border-b border-outline-variant/20 dark:border-gray-700 py-1 sm:py-1.5 hover:bg-surface-container-high dark:hover:bg-[#222] transition-colors">
                          <span className="truncate flex-1 font-medium text-on-surface dark:text-white">
                            {idx + 1}. {item.unit_number || item.item_name || item.name || "N/A"}
                            {(() => {
                              const divisionInfo = getInventoryDivisionInfo(item);
                              return divisionInfo?.division_name ? (
                                <span className="ml-2 text-[8px] sm:text-[9px] text-primary dark:text-blue-400">[{divisionInfo.division_name}]</span>
                              ) : null;
                            })()}
                          </span>
                          <span className="text-on-surface-variant dark:text-gray-400 ml-1 sm:ml-2 whitespace-nowrap text-right text-[8px] sm:text-[9px]">
                            {item.size || "—"}
                          </span>
                        </div>
                      ))}

                      {/* View More Link */}
                      {request.items.length > 3 && (
                        <button
                          onClick={() => setExpandedItems({
                            ...expandedItems,
                            [request.request_id]: false
                          })}
                          className="text-[9px] sm:text-xs font-bold text-primary dark:text-blue-400 hover:text-primary-container dark:hover:text-blue-300 mt-1 sm:mt-2 transition-colors"
                        >
                          + {request.items.length - 3} more items
                        </button>
                      )}
                    </div>

                    {/* Receipt Footer */}
                    <div className="border-t border-outline-variant/30 dark:border-gray-700 px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 bg-surface-container-lowest dark:bg-[#171717] flex justify-between text-[8px] sm:text-[10px] font-bold text-on-surface dark:text-white">
                      <span>Total Units</span>
                      <span className="text-primary dark:text-blue-400">{request.items.length}</span>
                    </div>
                  </div>
                )}

                {/* Action Footer - Return Button - Mobile Optimized */}
                {request.status === "approved" && (
                  <div className="border-t border-outline-variant/20 dark:border-gray-700 p-2 sm:p-3 md:p-4 bg-surface-container-low dark:bg-[#1a1a1a]">
                    <button
                      onClick={() => {
                        setSelectedRequestForReturn(request.request_id);
                        setReturnModalOpen(true);
                      }}
                      className="w-full bg-primary hover:bg-primary-container dark:bg-blue-600 dark:hover:bg-blue-700 text-on-primary dark:text-white font-semibold py-1.5 sm:py-2 px-2 sm:px-3 rounded transition-colors duration-200 text-[10px] sm:text-xs flex items-center justify-center gap-1.5"
                    >
                      ↩️ Return Items
                    </button>
                  </div>
                )}

                {/* Action Footer - View Photos Button - Mobile Optimized */}
                {request.status === "returned" && (
                  <div className="border-t border-outline-variant/20 dark:border-gray-700 p-2 sm:p-3 md:p-4 bg-surface-container-low dark:bg-[#1a1a1a]">
                    <button
                      onClick={() => fetchReturnPhotos(request.request_id)}
                      disabled={loadingPhotos}
                      className="w-full bg-primary hover:bg-primary-container dark:bg-blue-600 dark:hover:bg-blue-700 disabled:bg-on-surface-variant/30 dark:disabled:bg-gray-700 disabled:opacity-50 text-on-primary dark:text-white font-semibold py-1.5 sm:py-2 px-2 sm:px-3 rounded transition-colors duration-200 text-[10px] sm:text-xs flex items-center justify-center gap-1.5"
                    >
                      📸 {loadingPhotos ? "Loading..." : "View Photos"}
                    </button>
                  </div>
                )}
              </div>
            );
                  })}
                </div>
              );
            };

            // Render all sections in priority order
            return (
              <>
                {renderSection(overdue, "🔴 OVERDUE", "text-red-600 dark:text-red-400")}
                {renderSection(dueToday, "🟡 DUE TODAY", "text-yellow-600 dark:text-yellow-400")}
                {renderSection(dueSoon, "🟠 DUE SOON", "text-orange-600 dark:text-orange-400")}
                {renderSection(toReturn, "🔵 TO RETURN", "text-blue-600 dark:text-blue-400")}
                {renderSection(pendingApproval, "⚪ PENDING APPROVAL", "text-gray-600 dark:text-gray-400")}
                {renderSection(declined, "⚫ DECLINED", "text-gray-700 dark:text-gray-500")}
                {renderSection(completed, "🟢 COMPLETED", "text-green-600 dark:text-green-400")}
              </>
            );
          })()}
        </div>
      </div>
    </div>

      <>
        {/* Notification Modal - 3 Seconds - Mobile Optimized */}
        {notificationModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3 sm:p-4">
            <div className="bg-surface-container-lowest dark:bg-[#1a1a1a] rounded-lg shadow-2xl dark:shadow-black/60 p-4 sm:p-6 max-w-sm w-full text-center border border-outline-variant/20 dark:border-gray-700">
              <p className="text-sm sm:text-base font-medium text-on-surface dark:text-white">
                {notificationModal.message}
              </p>
            </div>
          </div>
        )}

        {/* ✅ Unified Return Modal */}
        {selectedRequestForReturn && (
          <ReturnModal
            isOpen={returnModalOpen}
            requestId={selectedRequestForReturn}
            items={borrowHistory.find((r) => r.request_id === selectedRequestForReturn)?.items || []}
            onClose={() => {
              setReturnModalOpen(false);
              setSelectedRequestForReturn(null);
            }}
            onReturnComplete={handleReturnComplete}
          />
        )}

        {/* Return Photos Modal - Mobile Optimized */}
        {returnPhotosModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-3 sm:p-4">
            <div className="bg-surface rounded-lg shadow-2xl max-w-2xl w-full overflow-hidden border border-outline-variant/20 max-h-[90vh] overflow-y-auto">
              {/* Header */}
              <div className="sticky top-0 flex items-center justify-between p-3 sm:p-4 md:p-6 border-b border-outline-variant/20 bg-gradient-to-r from-primary/5 to-primary/10">
                <h2 className="text-base sm:text-lg md:text-xl font-bold text-on-surface">Return Photos</h2>
                <button
                  onClick={() => {
                    setReturnPhotosModalOpen(false);
                    setReturnPhotos([]);
                  }}
                  className="text-on-surface-variant hover:text-on-surface transition-colors"
                >
                  <X className="w-5 sm:w-6 h-5 sm:h-6" />
                </button>
              </div>

              {/* Loading State */}
              {loadingPhotos && (
                <div className="p-6 sm:p-8 text-center">
                  <div className="inline-block animate-spin border-4 border-outline-variant border-t-primary rounded-full w-10 h-10 mb-3"></div>
                  <p className="text-sm text-on-surface-variant">Loading photos...</p>
                </div>
              )}

              {/* Photos Display */}
              {!loadingPhotos && returnPhotos.length > 0 ? (
                <div className="bg-black flex flex-col items-center justify-center p-3 sm:p-4 md:p-6">
                  {/* Main Photo */}
                  <div className="w-full max-w-md bg-gray-900 rounded-lg overflow-hidden mb-3 sm:mb-4">
                    <img
                      src={returnPhotos[currentPhotoIndex]?.photo_url || returnPhotos[currentPhotoIndex]?.storage_path}
                      alt={`Return photo ${currentPhotoIndex + 1}`}
                      className="w-full h-auto max-h-80 sm:max-h-96 object-contain"
                      onError={(e) => {
                        // Fallback if image fails to load
                        e.target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300' viewBox='0 0 400 300'%3E%3Crect fill='%23333' width='400' height='300'/%3E%3Ctext x='50%' y='50%' text-anchor='middle' dy='.3em' font-family='system-ui' font-size='16' fill='%23999'%3EImage failed to load%3C/text%3E%3C/svg%3E";
                      }}
                    />
                  </div>

                  {/* Navigation */}
                  {returnPhotos.length > 1 && (
                    <div className="flex items-center justify-center gap-2 sm:gap-4 w-full mb-3 sm:mb-4">
                      <button
                        onClick={prevPhoto}
                        className="bg-primary hover:bg-primary-container text-on-primary p-2 sm:p-3 rounded-full transition-colors duration-200"
                      >
                        <ChevronLeft className="w-4 sm:w-5 h-4 sm:h-5" />
                      </button>
                      <span className="text-on-surface text-xs sm:text-sm font-medium">
                        {currentPhotoIndex + 1} / {returnPhotos.length}
                      </span>
                      <button
                        onClick={nextPhoto}
                        className="bg-primary hover:bg-primary-container text-on-primary p-2 sm:p-3 rounded-full transition-colors duration-200"
                      >
                        <ChevronRight className="w-4 sm:w-5 h-4 sm:h-5" />
                      </button>
                    </div>
                  )}

                  {/* Photo Info */}
                  {returnPhotos[currentPhotoIndex] && (
                    <div className="w-full text-on-surface text-xs bg-surface-container-high rounded p-2 sm:p-3 space-y-1 border border-outline-variant/20">
                      <p>
                        <span className="font-semibold">Uploaded:</span> {new Date(returnPhotos[currentPhotoIndex]?.uploaded_at).toLocaleDateString()} {new Date(returnPhotos[currentPhotoIndex]?.uploaded_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </p>
                      {returnPhotos[currentPhotoIndex]?.file_size && (
                        <p>
                          <span className="font-semibold">Size:</span> {(returnPhotos[currentPhotoIndex].file_size / 1024).toFixed(2)} KB
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ) : !loadingPhotos && (
                <div className="p-6 sm:p-8 text-center text-on-surface-variant">
                  <Package className="w-10 sm:w-12 h-10 sm:h-12 mx-auto mb-2 sm:mb-3 opacity-50" />
                  <p className="text-xs sm:text-sm">No return photos available</p>
                  <p className="text-[11px] sm:text-xs mt-1">Photos will appear here after items are returned</p>
                </div>
              )}

              {/* Footer */}
              <div className="border-t border-outline-variant/20 p-3 sm:p-4 md:p-6 bg-surface-container-low flex gap-2 sm:gap-3">
                <button
                  onClick={() => {
                    setReturnPhotosModalOpen(false);
                    setReturnPhotos([]);
                  }}
                  className="flex-1 bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-semibold py-2 px-3 sm:px-4 rounded-lg transition-colors text-xs sm:text-sm border border-outline-variant/20"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    </PageLayout>
  );
}