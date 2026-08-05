import React, { useEffect, useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import PageLayout from "../../components/layout/PageLayout";
import { UserContext } from "../../../context/userContext";
import { SidebarContext } from "../../context/SidebarContext";
import notificationService from "../../services/notifications";
import { Trash2, CheckCheck, Loader, AlertCircle, Bell, User } from "lucide-react";
import toast from "react-hot-toast";

export default function NotificationsPage() {
  const { user } = useContext(UserContext);
  const { setSidebarOpen, isMobile } = useContext(SidebarContext);
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState([]);
  const [filteredNotifications, setFilteredNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState("all");
  const [profilePics, setProfilePics] = useState({}); // Cache profile pictures

  // Ensure sidebar is open when viewing notifications on desktop only
  useEffect(() => {
    if (!isMobile) {
      setSidebarOpen(true);
    }
  }, [setSidebarOpen, isMobile]);

  useEffect(() => {
    fetchAllNotifications();
    const interval = setInterval(fetchAllNotifications, 30000);
    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    applyFilters();
  }, [notifications, selectedFilter]);

  // Fetch profile pictures for users in notifications
  const fetchProfilePic = async (userId) => {
    // Return cached pic if available
    if (profilePics[userId]) {
      return profilePics[userId];
    }

    try {
      const { data } = await axios.get(`/api/profiles/${userId}`, {
        withCredentials: true,
      });
      
      const picUrl = data?.profile_pic_url || null;
      setProfilePics((prev) => ({
        ...prev,
        [userId]: picUrl,
      }));
      return picUrl;
    } catch (err) {
      console.warn(`Failed to fetch profile pic for user ${userId}:`, err);
      setProfilePics((prev) => ({
        ...prev,
        [userId]: null, // Cache as null to avoid repeated requests
      }));
      return null;
    }
  };

  const fetchAllNotifications = async () => {
    try {
      setIsLoading(true);
      const data = await notificationService.getNotifications();

      const filtered = Array.isArray(data)
        ? data.filter((n) => {
            if (!n || !n.message) return false;
            if (user?.role === "staff" && (n.type === "add_to_cart" || n.type === "cart_added")) {
              return false;
            }
            return true;
          })
        : [];

      setNotifications(filtered);

      // Fetch profile pictures for all users in notifications
      filtered.forEach((n) => {
        if (n.data?.borrowerId) {
          fetchProfilePic(n.data.borrowerId);
        }
      });
    } catch (err) {
      toast.error("Failed to load notifications");
    } finally {
      setIsLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...notifications];

    if (selectedFilter === "unread") {
      filtered = filtered.filter((n) => !n.is_read);
    } else if (selectedFilter === "read") {
      filtered = filtered.filter((n) => n.is_read);
    }

    // sort newest first
    filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    setFilteredNotifications(filtered);
  };

  const handleMarkAsRead = async (id) => {
    await notificationService.markAsRead(id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
  };

  const handleMarkAllAsRead = async () => {
    const success = await notificationService.markAllAsRead();
    if (success) {
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      toast.success("All marked as read");
    }
  };

  const handleDelete = async (id) => {
    await notificationService.deleteNotification(id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const handleNotificationClick = (notification) => {
    handleMarkAsRead(notification.id);

    if (notification.data?.requestId) {
      navigate(`/staff/manage-requests?openRequestId=${notification.data.requestId}`);
    } else if (notification.data?.url) {
      navigate(notification.data.url);
    }
  };

  const getTimeAgo = (date) => {
    const parsed = new Date(date);
    if (isNaN(parsed)) return "just now";
    const diff = Math.floor((Date.now() - parsed) / 1000);

    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  const formatMessage = (notification) => {
    if (!notification) return "";
    if (notification.type === "return_approved") {
      return (notification.message || "").replace(
        /^A borrower wants to return:\s*/i,
        "Successfully returned: "
      );
    }
    if (notification.type === "performance_reminder") {
      // Extract just the main message for the display (without the full items list)
      const message = notification.message || "";
      const mainPart = message.split(" Items needed:")[0];
      return mainPart;
    }
    return notification.message;
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const today = new Date().toDateString();
  const todayNotifs = filteredNotifications.filter(
    (n) => new Date(n.created_at).toDateString() === today
  );
  const earlierNotifs = filteredNotifications.filter(
    (n) => new Date(n.created_at).toDateString() !== today
  );

  return (
    <PageLayout>
      <div className="max-w-2xl mx-auto px-3 sm:px-4 md:px-0">

        {/* HEADER */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 py-3 sm:py-4">
          <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0">
              <Bell className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600 dark:text-gray-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white truncate">
                Notifications
              </h1>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                {notifications.length} total
                {unreadCount > 0 && ` • ${unreadCount} unread`}
              </p>
            </div>
          </div>

          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              className="text-xs sm:text-sm text-blue-600 dark:text-blue-400 hover:underline dark:hover:text-blue-300 flex items-center gap-1 transition-colors whitespace-nowrap flex-shrink-0"
            >
              <CheckCheck className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Mark all as read</span>
              <span className="sm:hidden">Mark as read</span>
            </button>
          )}
        </div>

        {/* TABS */}
        <div className="flex gap-4 sm:gap-6 border-b border-gray-200 dark:border-gray-700 text-xs sm:text-sm overflow-x-auto">
          {["all", "unread"].map((type) => (
            <button
              key={type}
              onClick={() => setSelectedFilter(type)}
              className={`pb-2 transition-colors whitespace-nowrap font-medium ${
                selectedFilter === type
                  ? "text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              }`}
            >
              {type === "all"
                ? "All"
                : type === "unread"
                ? `Unread ${unreadCount > 0 ? `(${unreadCount})` : ""}`
                : "Read"}
            </button>
          ))}
        </div>

        {/* CONTENT */}
        {isLoading ? (
          <div className="text-center py-8 sm:py-10">
            <Loader className="w-5 h-5 sm:w-6 sm:h-6 animate-spin mx-auto mb-2 text-gray-500 dark:text-gray-400" />
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Loading...</p>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="text-center py-8 sm:py-10">
            <AlertCircle className="w-8 h-8 sm:w-10 sm:h-10 mx-auto text-gray-400 dark:text-gray-600 mb-2" />
            <p className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm">
              No {selectedFilter} notifications
            </p>
          </div>
        ) : (
          <div>

            {/* TODAY */}
            {todayNotifs.length > 0 && (
              <>
                <div className="px-1 sm:px-2 py-2 sm:py-3 text-[10px] sm:text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Today
                </div>

                {todayNotifs.map((notification) => (
                  <NotificationRow
                    key={notification.id}
                    notification={notification}
                    onClick={handleNotificationClick}
                    onDelete={handleDelete}
                    timeAgo={getTimeAgo}
                    formatMessage={formatMessage}
                    profilePic={profilePics[notification.data?.borrowerId]}
                  />
                ))}
              </>
            )}

            {/* EARLIER */}
            {earlierNotifs.length > 0 && (
              <>
                <div className="px-1 sm:px-2 py-2 sm:py-3 text-[10px] sm:text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Earlier
                </div>

                {earlierNotifs.map((notification) => (
                  <NotificationRow
                    key={notification.id}
                    notification={notification}
                    onClick={handleNotificationClick}
                    onDelete={handleDelete}
                    timeAgo={getTimeAgo}
                    formatMessage={formatMessage}
                    profilePic={profilePics[notification.data?.borrowerId]}
                  />
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </PageLayout>
  );
}

/* Clean Row Component */
const NotificationRow = ({ notification, onClick, onDelete, timeAgo, formatMessage, profilePic }) => {
  const isPerformanceReminder = notification.type === "performance_reminder";
  const performanceItems = isPerformanceReminder ? notification.data?.items : [];
  
  return (
    <div
      onClick={() => onClick(notification)}
      className={`flex gap-2 sm:gap-3 px-1 sm:px-2 md:px-3 py-2 sm:py-3 hover:bg-gray-100 dark:hover:bg-gray-900 cursor-pointer border-b border-gray-200 dark:border-gray-700 transition-colors ${
        !notification.is_read ? "bg-blue-50 dark:bg-blue-900/20" : ""
      } ${isPerformanceReminder ? "border-l-4 border-l-purple-500" : ""}`}
    >
      {/* Avatar */}
      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gray-300 dark:bg-gray-600 flex-shrink-0 overflow-hidden flex items-center justify-center">
        {profilePic ? (
          <img
            src={profilePic}
            alt="User"
            className="w-full h-full object-cover"
          />
        ) : (
          <User className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500 dark:text-gray-400" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-xs sm:text-sm font-semibold text-gray-800 dark:text-white truncate">
                {notification.data?.borrowerName || "User"}
              </p>
              {isPerformanceReminder && (
                <span className="text-[9px] sm:text-xs px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 rounded font-semibold flex-shrink-0">
                  Performance
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 mt-0.5 line-clamp-2">
              {formatMessage(notification)}
            </p>
            
            {/* Show items for performance reminders */}
            {isPerformanceReminder && performanceItems && performanceItems.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {performanceItems.map((item, idx) => (
                  <span
                    key={idx}
                    className="text-[10px] sm:text-xs bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded"
                  >
                    {item.name}
                  </span>
                ))}
              </div>
            )}
            
            <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 mt-1">
              {timeAgo(notification.created_at)}
            </p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(notification.id);
          }}
          className="p-1 text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-colors flex-shrink-0"
          title="Delete notification"
        >
          <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
        </button>

        {!notification.is_read && (
          <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-blue-500 dark:bg-blue-400 rounded-full flex-shrink-0"></div>
        )}
      </div>
    </div>
  );
};