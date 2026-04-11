import React, { useEffect, useState, useRef, useContext } from "react";
import { Bell, ArrowRight, X, Trash2 } from "lucide-react";
import notificationService from "../../services/notifications";
import { UserContext } from "../../../context/userContext.jsx";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

export default function NotificationBell() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const bellRef = useRef(null);
  const { user } = useContext(UserContext);
  const navigate = useNavigate();
  const fetchTimeoutRef = useRef(null); // Debounce timer for fetches

  const [notificationEnabled, setNotificationEnabled] = useState(
    Notification.permission === "granted"
  );

  useEffect(() => {
    fetchNotifications();
    fetchUnreadCount();

    notificationService.setupMessageListener(() => {
      // Debounce: only fetch once per 500ms to avoid duplicate updates
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
      fetchTimeoutRef.current = setTimeout(() => {
        fetchNotifications();
        fetchUnreadCount();
      }, 500);
    });

    const onPendingUpdate = () => {
      fetchNotifications();
      fetchUnreadCount();
    };
    window.addEventListener('notifications:updated', onPendingUpdate);

    const interval = setInterval(() => {
      fetchUnreadCount();
    }, 60000);

    return () => {
      clearInterval(interval);
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
      window.removeEventListener('notifications:updated', onPendingUpdate);
      // remove service worker message listener to avoid duplicate callbacks
      if (notificationService && typeof notificationService.removeMessageListener === 'function') {
        notificationService.removeMessageListener();
      }
    };
  }, [user?.role]);

  // ✅ Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (bellRef.current && !bellRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  const enableNotifications = async () => {
    if (!user?.id) return;
    if (await notificationService.requestPermission(user.id)) {
      await notificationService.subscribe(user.id);
      setNotificationEnabled(true);
    }
  };

  const fetchNotifications = async () => {
    const data = await notificationService.getNotifications();
    // Filter out placeholder or malformed notifications that are likely
    // produced by missing fields in push payloads (title 'Notification' with no message)
    // Also exclude 'add_to_cart' notifications for staff users
    const filtered = Array.isArray(data)
      ? data.filter(n => {
          // Remove malformed notifications
          if (!n || typeof n.message !== 'string' || n.message.trim() === '' || n.message === 'Notification') {
            return false;
          }
          // Remove borrower-only and cart notifications for staff
          if (user?.role === 'staff' && (n.type === 'add_to_cart' || n.type === 'cart_added' || n.type === 'request_approved' || n.type === 'request_declined')) {
            return false;
          }
          return true;
        })
      : [];
    setNotifications(filtered);
  };

  const fetchUnreadCount = async () => {
    const count = await notificationService.getUnreadCount();
    setUnreadCount(count);
  };

  const handleMarkAsRead = async (id) => {
    await notificationService.markAsRead(id);
    fetchNotifications();
    fetchUnreadCount();
  };

  const getNotificationDestination = (notification) => {
    // Return the appropriate navigation path based on notification type and data
    if (notification.data?.path) {
      return notification.data.path;
    }
    
    switch (notification.type) {
      case 'request_approved':
      case 'request_declined':
        return `/my-borrowed-items${notification.data?.requestId ? `?requestId=${notification.data.requestId}` : ''}`;
      
      case 'return_approved':
        return '/my-borrowed-items';
      
      case 'borrow_request':
      case 'return_request':
        return notification.data?.requestId 
          ? `/staff/manage-requests?openRequestId=${notification.data.requestId}`
          : '/staff/manage-returns';
      
      case 'due_soon':
      case 'overdue':
        return '/my-borrowed-items';
      
      default:
        return notification.data?.url || '/dashboard';
    }
  };

  const handleNotificationClick = (notification) => {
    // Mark as read
    handleMarkAsRead(notification.id);
    // Close the notification bell
    setIsOpen(false);
    // Navigate to the appropriate page
    const destination = getNotificationDestination(notification);
    navigate(destination);
  };

  const getTimeAgo = (date) => {
    try {
      const parsed = date ? new Date(date) : null;
      if (!parsed || isNaN(parsed.getTime())) return "just now";
      const seconds = Math.floor((Date.now() - parsed.getTime()) / 1000);
      let interval = seconds / 31536000;
      if (interval > 1) return Math.floor(interval) + " years ago";
      interval = seconds / 2592000;
      if (interval > 1) return Math.floor(interval) + " months ago";
      interval = seconds / 86400;
      if (interval > 1) return Math.floor(interval) + " days ago";
      interval = seconds / 3600;
      if (interval > 1) return Math.floor(interval) + " hours ago";
      interval = seconds / 60;
      if (interval > 1) return Math.floor(interval) + " minutes ago";
      return Math.floor(seconds) + " seconds ago";
    } catch (e) {
      return "just now";
    }
  };

  const formatMessage = (notification) => {
    if (!notification) return '';
    // Normalize return-approved wording for staff
    if (notification.type === 'return_approved' || /return/i.test(notification.type)) {
      const msg = notification.message || '';
      return msg.replace(/^A borrower wants to return:\s*/i, 'Successfully returned: ');
    }
    return notification.message || '';
  };

  const groupNotifications = (notifications) => {
    const today = new Date();
    const todayDate = today.toDateString();

    const todayNotifs = [];
    const earlierNotifs = [];

    notifications.forEach((n) => {
      // created_at may be null or in different formats; try multiple fallbacks
      const raw = n.created_at || n.data?.createdAt || n.data?.timestamp;
      const parsed = raw ? new Date(raw) : new Date();
      const notifDate = isNaN(parsed.getTime()) ? new Date().toDateString() : parsed.toDateString();
      if (notifDate === todayDate) {
        todayNotifs.push(n);
      } else {
        earlierNotifs.push(n);
      }
    });

    return { todayNotifs, earlierNotifs };
  };

  // Deduplicate notifications by id
  const dedupedNotifications = React.useMemo(() => {
    const seen = new Set();
    return notifications.filter(n => {
      if (seen.has(n.id)) return false;
      seen.add(n.id);
      return true;
    });
  }, [notifications]);

  const { todayNotifs, earlierNotifs } = groupNotifications(dedupedNotifications);

  return (
    <div className="relative" ref={bellRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-full hover:bg-gray-100 transition-colors"
      >
        <Bell className="w-6 h-6 text-gray-600" />
        {unreadCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center"
          >
            {unreadCount}
          </motion.span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="fixed right-6 top-20 w-80 bg-white rounded-lg shadow-2xl overflow-hidden border border-gray-200 z-[9999]"
          >
            <div className="p-3 bg-gray-50 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-800">
                  Notifications
                </h3>
                {unreadCount > 0 && (
                  <button
                    onClick={async () => {
                      const success = await notificationService.markAllAsRead();
                      if (success) {
                        // Immediately update local state for dynamic persistence
                        setNotifications(prev =>
                          prev.map(n => ({ ...n, is_read: true }))
                        );
                        setUnreadCount(0);
                      }
                      // Fetch fresh data from server
                      fetchNotifications();
                      fetchUnreadCount();
                    }}
                    className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 transition-colors"
                    title="Mark all as read"
                  >
                    Mark all as read
                  </button>
                )}
              </div>
              {!notificationEnabled && (
                <button
                  onClick={enableNotifications}
                  className="mt-2 w-full py-2 px-4 bg-blue-500 hover:bg-blue-600 text-white rounded-md text-sm transition-colors"
                >
                  Enable Push Notifications
                </button>
              )}
            </div>

            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  No notifications
                </div>
              ) : (
                <>
                  {/* 🟢 TODAY SECTION */}
                  {todayNotifs.length > 0 && (
                    <div>
                      <div className="px-3 py-2 bg-gray-100 text-xs font-semibold text-gray-600 uppercase">
                        Today
                      </div>
                      {todayNotifs.map((notification) => (
                        <div
                          key={notification.id}
                          onClick={() => handleNotificationClick(notification)}
                          className={`p-3 border-b border-gray-100 cursor-pointer hover:bg-emerald-50 transition-colors ${
                            !notification.is_read ? "bg-blue-50" : ""
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              {/* Type-based color indicator */}
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${
                                  notification.type === 'request_approved' ? 'bg-green-500' :
                                  notification.type === 'request_declined' ? 'bg-red-500' :
                                  notification.type === 'return_approved' ? 'bg-blue-500' :
                                  notification.type === 'borrow_request' ? 'bg-yellow-500' :
                                  notification.type === 'return_request' ? 'bg-orange-500' :
                                  'bg-gray-400'
                                }`}></span>
                                <p className="text-xs font-semibold text-gray-600 uppercase">
                                  {notification.type === 'request_approved' ? 'Approved' :
                                   notification.type === 'request_declined' ? 'Declined' :
                                   notification.type === 'return_approved' ? 'Returned' :
                                   notification.type === 'borrow_request' ? 'New Request' :
                                   notification.type === 'return_request' ? 'Return Request' :
                                   notification.type === 'due_soon' ? 'Due Soon' :
                                   notification.type === 'overdue' ? 'Overdue' :
                                   notification.type}
                                </p>
                              </div>
                              {notification.data?.borrowerName ? (
                                <>
                                  <p className="text-sm text-gray-800 font-semibold">{notification.data.borrowerName}</p>
                                  <p className="text-sm text-gray-700">{formatMessage(notification)}</p>
                                </>
                              ) : (
                                <p className="text-sm text-gray-800">{formatMessage(notification)}</p>
                              )}
                              <p className="text-xs text-gray-500 mt-1">
                                {getTimeAgo(notification.created_at)}
                              </p>
                            </div>
                            <div className="flex-shrink-0 ml-2 flex items-start gap-2">
                              {!notification.is_read && (
                                <div className="w-2 h-2 bg-emerald-500 rounded-full mt-1.5"></div>
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  notificationService.deleteNotification(notification.id).then(() => {
                                    fetchNotifications();
                                    fetchUnreadCount();
                                  });
                                }}
                                className="p-1 text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
                                title="Delete notification"
                              >
                                <Trash2 size={14} />
                              </button>
                              <ArrowRight size={16} className="text-gray-400 mt-1 flex-shrink-0" />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 🟠 EARLIER SECTION */}
                  {earlierNotifs.length > 0 && (
                    <div>
                      <div className="px-3 py-2 bg-gray-100 text-xs font-semibold text-gray-600 uppercase">
                        All Earlier
                      </div>
                      {earlierNotifs.map((notification) => (
                        <div
                          key={notification.id}
                          onClick={() => handleNotificationClick(notification)}
                          className={`p-3 border-b border-gray-100 cursor-pointer hover:bg-emerald-50 transition-colors ${
                            !notification.is_read ? "bg-blue-50" : ""
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              {/* Type-based color indicator */}
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${
                                  notification.type === 'request_approved' ? 'bg-green-500' :
                                  notification.type === 'request_declined' ? 'bg-red-500' :
                                  notification.type === 'return_approved' ? 'bg-blue-500' :
                                  notification.type === 'borrow_request' ? 'bg-yellow-500' :
                                  notification.type === 'return_request' ? 'bg-orange-500' :
                                  'bg-gray-400'
                                }`}></span>
                                <p className="text-xs font-semibold text-gray-600 uppercase">
                                  {notification.type === 'request_approved' ? 'Approved' :
                                   notification.type === 'request_declined' ? 'Declined' :
                                   notification.type === 'return_approved' ? 'Returned' :
                                   notification.type === 'borrow_request' ? 'New Request' :
                                   notification.type === 'return_request' ? 'Return Request' :
                                   notification.type === 'due_soon' ? 'Due Soon' :
                                   notification.type === 'overdue' ? 'Overdue' :
                                   notification.type}
                                </p>
                              </div>
                              {notification.data?.borrowerName ? (
                                <>
                                  <p className="text-sm text-gray-800 font-semibold">{notification.data.borrowerName}</p>
                                  <p className="text-sm text-gray-700">{formatMessage(notification)}</p>
                                </>
                              ) : (
                                <p className="text-sm text-gray-800">{formatMessage(notification)}</p>
                              )}
                              <p className="text-xs text-gray-500 mt-1">
                                {getTimeAgo(notification.created_at)}
                              </p>
                            </div>
                            <div className="flex-shrink-0 ml-2 flex items-start gap-2">
                              {!notification.is_read && (
                                <div className="w-2 h-2 bg-emerald-500 rounded-full mt-1.5"></div>
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  notificationService.deleteNotification(notification.id).then(() => {
                                    fetchNotifications();
                                    fetchUnreadCount();
                                  });
                                }}
                                className="p-1 text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
                                title="Delete notification"
                              >
                                <Trash2 size={14} />
                              </button>
                              <ArrowRight size={16} className="text-gray-400 mt-1 flex-shrink-0" />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
