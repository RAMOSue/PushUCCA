import React, { useEffect, useState, useContext } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { UserContext } from "../../../context/userContext";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import relativeTime from "dayjs/plugin/relativeTime";
import { Trash2, Package, AlertCircle, Clock, CheckCircle, Search, ChevronRight } from "lucide-react";
import PageLayout from "../../components/layout/PageLayout";
import toast from "react-hot-toast";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(relativeTime);

// Status icon and color mapping (Material Design 3 style)
const getStatusConfig = (status) => {
  switch (status) {
    case "pending":
      return {
        icon: <Clock className="w-5 h-5" />,
        badgeColor: "bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300",
        textColor: "text-orange-800 dark:text-orange-300",
      };
    case "approved":
      return {
        icon: <CheckCircle className="w-5 h-5" />,
        badgeColor: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300",
        textColor: "text-green-700 dark:text-green-300",
      };
    case "declined":
      return {
        icon: <AlertCircle className="w-5 h-5" />,
        badgeColor: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300",
        textColor: "text-red-700 dark:text-red-300",
      };
    case "returned":
      return {
        icon: <CheckCircle className="w-5 h-5" />,
        badgeColor: "bg-surface-container-high dark:bg-blue-900/30 text-on-surface dark:text-blue-300",
        textColor: "text-on-surface dark:text-blue-300",
      };
    case "pending_return":
      return {
        icon: <AlertCircle className="w-5 h-5" />,
        badgeColor: "bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300",
        textColor: "text-orange-800 dark:text-orange-300",
      };
    default:
      return {
        icon: <AlertCircle className="w-5 h-5" />,
        badgeColor: "bg-surface-container-high dark:bg-gray-700 text-on-surface dark:text-white",
        textColor: "text-on-surface dark:text-white",
      };
  }
};

function getStatusLabel(status) {
  switch (status) {
    case "pending":
      return "Pending";
    case "approved":
      return "Approved";
    case "declined":
      return "Declined";
    case "returned":
      return "Returned";
    case "pending_return":
      return "Return in Progress";
    default:
      return status;
  }
}

export default function BorrowerHistory() {
  const { user } = useContext(UserContext);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedItems, setExpandedItems] = useState({});
  const navigate = useNavigate();

  useEffect(() => {
    if (!user?.id) return;
    fetchHistory();
  }, [user]);

  const fetchHistory = async () => {
    try {
      const res = await axios.get(`/api/borrow/history/${user.id}`);
      setHistory(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Failed to fetch history:", err);
      toast.error("Failed to load borrow history");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteItem = async (requestId) => {
    if (!window.confirm("Delete this borrow request from history?")) return;

    setDeleting(requestId);
    try {
      await axios.delete(`/api/borrow/history/${requestId}`, {
        params: { borrower_id: user.id }
      });
      setHistory(prev => prev.filter(item => item.request_id !== requestId));
      toast.success("Deleted from history");
    } catch (err) {
      console.error("Failed to delete:", err);
      toast.error("Failed to delete from history");
    } finally {
      setDeleting(null);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "—";
    const date = new Date(dateString);
    if (isNaN(date)) return "—";
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatDateShort = (dateString) => {
    if (!dateString) return "—";
    const date = dayjs(dateString).tz("Asia/Manila");
    return date.isValid() ? date.format("MMM D, YYYY") : "—";
  };

  const formatTime = (dateString) => {
    if (!dateString) return "—";
    const date = dayjs(dateString).tz("Asia/Manila");
    return date.isValid() ? date.format("h:mm A") : "—";
  };

  if (loading)
    return (
      <PageLayout>
        <div className="bg-surface dark:bg-[#171717] min-h-screen flex items-center justify-center px-4 transition-colors duration-300">
          <div className="text-center">
            <Clock className="w-12 h-12 text-primary mx-auto mb-3 animate-pulse" />
            <p className="text-on-surface-variant dark:text-gray-400 text-sm">Loading your history...</p>
          </div>
        </div>
      </PageLayout>
    );

  

  // Filter by search query
  let filteredHistory = history;
  if (searchQuery.trim()) {
    const searchLower = searchQuery.toLowerCase();
    filteredHistory = history.filter((item) =>
      (item.items?.some(i => (i.item_name || i.name || '').toLowerCase().includes(searchLower))) ||
      (item.request_id || '').toString().toLowerCase().includes(searchLower)
    );
  }

  // Calculate progress percentage based on status
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

  // Get relative due date display
  const getRelativeDueDate = (dueDate, status) => {
    if (status === "returned") {
      return "Return confirmed. Thank you for keeping items in good condition.";
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

  // Get status color for progress bar
  const getStatusColor = (status, request) => {
    if (status === "approved" && request?.return_decline_reason) {
      return { dot: "#dc2626", text: "text-red-600 dark:text-red-400" };
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

  // Get status display label
  const getStatusDisplayLabel = (status, request) => {
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

  // Get status date for progress bar
  const getStatusDisplayDate = (status, request) => {
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

  // ✅ Sort by date - newest first
  filteredHistory.sort((a, b) => {
    const dateA = new Date(a.request_date || a.created_at);
    const dateB = new Date(b.request_date || b.created_at);
    return dateB - dateA; // Newest first (descending order)
  });

  // Group items by request date
  const groupedByDate = filteredHistory.reduce((acc, item) => {
    const dateKey = new Date(item.request_date || item.created_at).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    if (!acc[dateKey]) {
      acc[dateKey] = [];
    }
    acc[dateKey].push(item);
    return acc;
  }, {});

  // Get sorted date keys (newest first)
  const sortedDateKeys = Object.keys(groupedByDate).sort((a, b) => {
    return new Date(b) - new Date(a);
  });

  return (
    <PageLayout>
      <div className="min-h-screen bg-surface dark:bg-[#171717] pb-32 transition-colors duration-300">
        {/* Header Section with Summary Pills */}
        <div className="px-6 md:px-8 lg:px-12 pt-8 pb-6">
          <div className="flex items-start justify-between gap-6">
            {/* Left Side - Title */}
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-on-surface dark:text-white mb-2">
                Borrow History
              </h1>
              <p className="text-on-surface-variant dark:text-gray-400 text-sm">
                View and manage all your borrowing requests
              </p>
            </div>

          
          </div>
        </div>

        <div className="px-6 md:px-8 lg:px-12 space-y-4">
          {/* Full Width Search Bar */}
          <div className="flex items-center gap-3 bg-surface-container-low dark:bg-[#222] rounded-lg px-4 py-3 border border-transparent hover:border-primary/20 dark:hover:border-blue-400/30 focus-within:ring-2 focus-within:ring-primary dark:focus-within:ring-blue-400 focus-within:border-transparent dark:border-gray-700 transition shadow-sm">
            <Search className="w-5 text-on-surface-variant dark:text-gray-400 flex-shrink-0" />
            <input
              type="text"
              placeholder="Search by item name or request ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent focus:outline-none text-sm text-on-surface dark:text-white dark:placeholder-gray-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="px-2 text-on-surface-variant dark:text-gray-400 hover:text-on-surface dark:hover:text-white transition"
              >
                ✕
              </button>
            )}
          </div>

          {/* History Items */}
          {filteredHistory.length === 0 ? (
            <div className="bg-surface-container-low dark:bg-[#222] rounded-xl border border-outline-variant/20 dark:border-gray-700 shadow-sm p-12 text-center">
              <Package className="w-12 h-12 text-on-surface-variant/30 dark:text-gray-500/30 mx-auto mb-4" />
              <p className="text-on-surface dark:text-white text-base font-medium mb-2">
                {searchQuery ? "No requests match your search" : "No borrow requests yet"}
              </p>
              <p className="text-on-surface-variant dark:text-gray-400 text-sm">
                {searchQuery ? "Try adjusting your search" : "Your borrowing history will appear here"}
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {sortedDateKeys.map((dateKey) => (
                <div key={dateKey} className="space-y-3">
                  {/* Date Section Header - Centered */}
                  <h3 className="text-center text-sm font-semibold text-on-surface-variant dark:text-gray-400 uppercase tracking-wider">
                    {dateKey}
                  </h3>

                  {/* Items for this date */}
                  {groupedByDate[dateKey].map((item, index) => {
                    const statusConfig = getStatusConfig(item.status);
                    const isExpanded = expandedItems[item.request_id];

                return (
                  <div
                    key={item.request_id}
                    className="bg-surface-container-low dark:bg-[#1a1a1a] rounded-lg border overflow-hidden shadow-sm hover:shadow-md dark:hover:shadow-black/40 transition-all duration-200 border-outline-variant/20 dark:border-gray-700"
                  >
                    {/* Request Card Header - Compact with Progress Bar */}
                    <button
                      onClick={() =>
                        setExpandedItems({
                          ...expandedItems,
                          [item.request_id]: !isExpanded
                        })
                      }
                      className="w-full p-1.5 md:p-2 flex items-center gap-2 hover:bg-surface-container-high dark:hover:bg-[#222] transition-colors text-left"
                    >
                      {/* Item Image Thumbnail */}
                      {(() => {
                        const firstItemData = item.items?.[0];
                        const imageUrl = firstItemData?.image_url;
                        const itemName = firstItemData?.item_name || firstItemData?.name || "Item";
                        
                        return (
                          <div className="flex-shrink-0 w-12 h-12 rounded-full overflow-hidden border-2 border-primary/30 dark:border-blue-500/30 bg-surface-container-high dark:bg-[#222] shadow-sm">
                            {imageUrl ? (
                              <img
                                src={imageUrl?.startsWith('http') ? imageUrl : `${import.meta.env.VITE_API_URL || window.location.origin}${imageUrl}`}
                                alt={itemName}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-on-surface-variant dark:text-gray-400 bg-gradient-to-br from-surface-container-high to-surface-container-lowest dark:from-[#2a2a2a] dark:to-[#1a1a1a]">
                                <Package className="w-5 h-5" />
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {/* Request Info with Progress Bar */}
                      <div className="flex-1 min-w-0 flex flex-col justify-center" style={{ height: "56px" }}>
                        {/* Item Name - Above the line */}
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          {(() => {
                            const firstItemData = item.items?.[0];
                            const itemName = firstItemData?.item_name || firstItemData?.name || "Item";
                            return (
                              <span className="text-xs font-bold text-on-surface dark:text-white truncate">
                                {itemName}
                              </span>
                            );
                          })()}
                        </div>

                        {/* Progress Bar */}
                        {(() => {
                          const statusColor = getStatusColor(item.status, item);
                          const statusLabel = getStatusDisplayLabel(item.status, item);
                          const statusDate = getStatusDisplayDate(item.status, item);
                          const relativeDueDate = getRelativeDueDate(item.due_date, item.status);

                          return (
                            <div className="flex flex-col w-full">
                              {/* Progress Bar Row */}
                              <div className="relative w-full h-4 flex items-center mb-2">
                                {/* Thin dashed line */}
                                <div className="absolute top-1/2 left-0 w-full h-[1px] -translate-y-1/2">
                                  <div className="w-full h-full border-t border-dashed border-gray-300 dark:border-gray-600"></div>
                                </div>

                                {/* Progress (solid part before dot) */}
                                <div
                                  className="absolute top-1/2 left-0 h-[1px] -translate-y-1/2 transition-all duration-500"
                                  style={{ 
                                    width: `${getProgress(item.status)}%`,
                                    backgroundColor: statusColor.dot
                                  }}
                                ></div>

                                {/* Status dot with label above and date below */}
                                <div
                                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 flex flex-col items-center"
                                  style={{ left: `${getProgress(item.status)}%` }}
                                >
                                  {/* Status label above dot */}
                                  <div className="flex items-center gap-0.5 mb-0.5">
                                    <p className={`text-[9px] font-bold uppercase ${statusColor.text} whitespace-nowrap`}>
                                      {statusLabel}
                                    </p>
                                  </div>

                                  {/* Colored dot */}
                                  <div
                                    className="w-2.5 h-2.5 rounded-full shadow-sm border-2 border-surface-container-low dark:border-[#222]"
                                    style={{ backgroundColor: statusColor.dot }}
                                  ></div>
                                  
                                  {/* Date below dot */}
                                  <p className="text-[8px] text-on-surface-variant dark:text-gray-500 whitespace-nowrap">
                                    {statusDate}
                                  </p>
                                </div>
                              </div>

                              {/* Due Date Display - Below Progress Bar */}
                              <p className={`text-[8px] font-semibold ${item.status === "returned" ? "text-green-600 dark:text-green-400" : "text-on-surface-variant dark:text-gray-400"} whitespace-normal`}>
                                {relativeDueDate}
                              </p>
                            </div>
                          );
                        })()}
                      </div>

                      {/* Expand Button - Compact */}
                      {item.items && item.items.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-surface-container-lowest dark:bg-[#222] text-on-surface dark:text-gray-300 border border-outline-variant/20 dark:border-gray-700">
                            {item.items.length}
                          </span>
                          <ChevronRight
                            className={`w-4 h-4 text-on-surface-variant dark:text-gray-400 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                          />
                        </div>
                      )}

                      {/* Delete Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteItem(item.request_id);
                        }}
                        disabled={deleting === item.request_id}
                        className="flex-shrink-0 p-2 text-on-surface-variant dark:text-gray-400 hover:text-error dark:hover:text-red-400 hover:bg-error/10 dark:hover:bg-red-900/20 rounded transition-colors disabled:opacity-50"
                        title="Delete from history"
                      >
                        <Trash2 size={20} />
                      </button>
                    </button>

                    {/* Items List - Expandable Receipt Style */}
                    {isExpanded && item.items && item.items.length > 0 && (
                      <div className="border-t border-outline-variant/20 dark:border-gray-700 bg-surface-container-low/50 dark:bg-[#1f1f1f]">
                        {/* Receipt Header */}
                        <div className="bg-gradient-to-r from-primary/10 dark:from-blue-900/30 to-primary/5 dark:to-blue-900/10 px-4 py-3 border-b border-primary/10 dark:border-blue-500/20">
                          <p className="text-xs font-bold text-primary dark:text-blue-400 uppercase tracking-wider">📦 REQUEST RECEIPT</p>
                          <p className="text-xs mt-1 text-on-surface-variant dark:text-gray-400">ID: {String(item.request_id || '').slice(0, 12)}</p>
                        </div>

                        {/* Receipt Items */}
                        <div className="p-4 space-y-1">
                          {/* Table Header */}
                          <div className="flex justify-between border-b border-outline-variant/30 dark:border-gray-700 pb-2 text-xs font-bold text-on-surface dark:text-white mb-2">
                            <span>ITEM</span>
                            <span className="text-right">SIZE</span>
                          </div>

                          {/* Individual Items */}
                          {item.items.map((itemData, idx) => (
                            <div key={`${item.request_id}-${itemData.unit_id || itemData.id}-${idx}`} className="flex justify-between items-center text-xs border-b border-outline-variant/20 dark:border-gray-700 py-2 hover:bg-surface-container-high dark:hover:bg-[#252525] transition-colors">
                              <span className="truncate flex-1 font-medium text-on-surface dark:text-white">
                                {idx + 1}. {itemData.unit_number || itemData.item_name || itemData.name || "N/A"}
                              </span>
                              <span className="text-on-surface-variant dark:text-gray-400 ml-3 whitespace-nowrap text-right">
                                {itemData.size || "—"}
                              </span>
                            </div>
                          ))}
                        </div>

                        {/* Receipt Footer */}
                        <div className="border-t border-outline-variant/30 dark:border-gray-700 px-4 py-3 bg-surface-container-lowest dark:bg-[#1a1a1a]">
                          <div className="flex justify-between font-bold text-xs text-on-surface dark:text-white">
                            <span>TOTAL UNITS</span>
                            <span className="text-primary dark:text-blue-400">{item.items.length}</span>
                          </div>
                        </div>

                        {/* Receipt Info Bar */}
                        <div className="bg-surface-container-highest dark:bg-[#252525] text-on-surface dark:text-white text-xs px-4 py-2 flex justify-between font-semibold border-t border-outline-variant/20 dark:border-gray-700">
                          <span>📅 {formatDate(item.request_date || item.created_at)}</span>
                          <span>Status: {getStatusLabel(item.status)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  );
}
