import React, { useEffect, useState, useRef, useContext } from "react";
import { Bell } from "lucide-react";
import notificationService from "../services/notifications";
import { UserContext } from "../../context/userContext.jsx";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

export default function NotificationBell() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const bellRef = useRef(null);
  const { user } = useContext(UserContext);
  const navigate = useNavigate();

  const [notificationEnabled, setNotificationEnabled] = useState(
    Notification.permission === "granted"
  );

  useEffect(() => {
    fetchNotifications();
    fetchUnreadCount();

    notificationService.setupMessageListener((payload) => {
      // payload contains the push data; refresh UI to include new notification
      fetchNotifications();
      fetchUnreadCount();
    });

    const onPendingUpdate = () => {
      fetchNotifications();
      fetchUnreadCount();
    };
    window.addEventListener('notifications:updated', onPendingUpdate);

    const interval = setInterval(() => {
      fetchUnreadCount();
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  const enableNotifications = async () => {
    if (!user?.id) return;
    if (await notificationService.requestPermission(user.id)) {
      await notificationService.subscribe(user.id);
      setNotificationEnabled(true);
    }
  };

  const fetchNotifications = async () => {
    const data = await notificationService.getNotifications();
    setNotifications(data);
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

  const getTimeAgo = (date) => {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
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
  };

  const groupNotifications = (notifications) => {
    const today = new Date();
    const todayDate = today.toDateString();

    const todayNotifs = [];
    const earlierNotifs = [];

    notifications.forEach((n) => {
      const notifDate = new Date(n.created_at).toDateString();
      if (notifDate === todayDate) {
        todayNotifs.push(n);
      } else {
        earlierNotifs.push(n);
      }
    });

    return { todayNotifs, earlierNotifs };
  };

  const { todayNotifs, earlierNotifs } = groupNotifications(notifications);

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
            className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg overflow-hidden border border-gray-200 z-50"
          >
            <div className="p-3 bg-gray-50 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800">
                Notifications
              </h3>
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
                          className={`p-3 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                            !notification.is_read ? "bg-blue-50" : ""
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              {/* Type-based color indicator */}
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`inline-block w-2 h-2 rounded-full ${
                                  notification.type === 'request_approved' ? 'bg-green-500' :
                                  notification.type === 'request_declined' ? 'bg-red-500' :
                                  notification.type === 'return_approved' ? 'bg-blue-500' :
                                  'bg-gray-400'
                                }`}></span>
                                <p className="text-xs font-semibold text-gray-600 uppercase">
                                  {notification.type === 'request_approved' ? 'Approved' :
                                   notification.type === 'request_declined' ? 'Declined' :
                                   notification.type === 'return_approved' ? 'Returned' :
                                   notification.type === 'borrow_request' ? 'New Request' :
                                   notification.type}
                                </p>
                              </div>
                              {notification.data?.borrowerName ? (
                                <>
                                  <p className="text-sm text-gray-800 font-semibold">{notification.data.borrowerName}</p>
                                  <p className="text-sm text-gray-700">{notification.message}</p>
                                </>
                              ) : (
                                <p className="text-sm text-gray-800">{notification.message}</p>
                              )}
                              <p className="text-xs text-gray-500 mt-1">
                                {getTimeAgo(notification.created_at)}
                              </p>
                            </div>
                            <div className="flex flex-col items-end">
                              {!notification.is_read && (
                                <button
                                  onClick={() => handleMarkAsRead(notification.id)}
                                  className="text-xs text-blue-600 hover:text-blue-800"
                                >
                                  Mark read
                                </button>
                              )}
                              {notification.data?.requestId && (
                                <button
                                  onClick={() => {
                                    // mark as read then open the modal in ManageBorrowRequests via URL param
                                    handleMarkAsRead(notification.id);
                                    // navigate to staff manage requests and open the modal for this request
                                    navigate(`/staff/manage-requests?openRequestId=${notification.data.requestId}`);
                                  }}
                                  className="text-xs text-gray-500 hover:text-gray-700 mt-2"
                                >
                                  Open Request
                                </button>
                              )}
                              {(!notification.data?.requestId && notification.data?.url) && (
                                <button
                                  onClick={() => {
                                    handleMarkAsRead(notification.id);
                                    navigate(notification.data.url);
                                  }}
                                  className="text-xs text-gray-500 hover:text-gray-700 mt-2"
                                >
                                  Open
                                </button>
                              )}
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
                          className={`p-3 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                            !notification.is_read ? "bg-blue-50" : ""
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              {/* Type-based color indicator */}
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`inline-block w-2 h-2 rounded-full ${
                                  notification.type === 'request_approved' ? 'bg-green-500' :
                                  notification.type === 'request_declined' ? 'bg-red-500' :
                                  notification.type === 'return_approved' ? 'bg-blue-500' :
                                  'bg-gray-400'
                                }`}></span>
                                <p className="text-xs font-semibold text-gray-600 uppercase">
                                  {notification.type === 'request_approved' ? 'Approved' :
                                   notification.type === 'request_declined' ? 'Declined' :
                                   notification.type === 'return_approved' ? 'Returned' :
                                   notification.type === 'borrow_request' ? 'New Request' :
                                   notification.type}
                                </p>
                              </div>
                              {notification.data?.borrowerName ? (
                                <>
                                  <p className="text-sm text-gray-800 font-semibold">{notification.data.borrowerName}</p>
                                  <p className="text-sm text-gray-700">{notification.message}</p>
                                </>
                              ) : (
                                <p className="text-sm text-gray-800">{notification.message}</p>
                              )}
                              <p className="text-xs text-gray-500 mt-1">
                                {getTimeAgo(notification.created_at)}
                              </p>
                            </div>
                            <div className="flex flex-col items-end">
                              {!notification.is_read && (
                                <button
                                  onClick={() => handleMarkAsRead(notification.id)}
                                  className="text-xs text-blue-600 hover:text-blue-800"
                                >
                                  Mark read
                                </button>
                              )}
                              {notification.data?.url && (
                                <button
                                  onClick={() => {
                                    handleMarkAsRead(notification.id);
                                    navigate(notification.data.url);
                                  }}
                                  className="text-xs text-gray-500 hover:text-gray-700 mt-2"
                                >
                                  Open
                                </button>
                              )}
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
