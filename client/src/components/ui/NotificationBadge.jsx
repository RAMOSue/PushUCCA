import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { User, Bell } from 'lucide-react';
import { notificationService } from '../../services/notifications';

const NotificationBadge = ({ isMobile = false }) => {
  const navigate = useNavigate();
  const [notificationCount, setNotificationCount] = useState(0);
  const [notificationList, setNotificationList] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [filterType, setFilterType] = useState("all");
  const [profilePics, setProfilePics] = useState({});
  // Fetch profile pictures for users
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
        [userId]: null,
      }));
      return null;
    }
  };

  // Track mobile viewport
  // If parent passes isMobile prop, prefer it; otherwise keep legacy resize behavior
  useEffect(() => {
    if (typeof isMobile === 'boolean') return;
    const handleResize = () => {
      // no-op: legacy path avoided when prop provided
    };
    return () => {};
  }, [isMobile]);

  // Initialize
  useEffect(() => {
    const initNotifications = async () => {
      try {
        await notificationService.init();

        if (Notification.permission !== 'granted') {
          await notificationService.requestPermission();
        }

        const [list, count] = await Promise.all([
          notificationService.getNotifications(),
          notificationService.getUnreadCount()
        ]);

        const normalized = (list || []).map((n) => ({
          ...n,
          timestamp:
            n.created_at ||
            n.data?.createdAt ||
            n.data?.timestamp ||
            new Date().toISOString()
        }));

        setNotificationList(normalized);
        setNotificationCount(Number(count) || 0);

        // Fetch profile pictures for all users in notifications
        normalized.forEach((n) => {
          if (n.data?.borrowerId) {
            fetchProfilePic(n.data.borrowerId);
          }
        });
      } catch (error) {
        console.error('Notification init error:', error);
      }
    };

    initNotifications();
  }, []);

  // Click notification
  const handleNotificationClick = (notification) => {
    setNotificationList(prev =>
      prev.map(n =>
        n.id === notification.id ? { ...n, is_read: true } : n
      )
    );

    if (!notification.is_read) {
      notificationService.markAsRead(notification.id);
      setNotificationCount(prev => Math.max(0, prev - 1));
    }

    if (notification.data?.requestId) {
      navigate(`/staff/manage-requests?openRequestId=${notification.data.requestId}`);
    } else if (notification.data?.url) {
      navigate(notification.data.url);
    }

    setShowDropdown(false);
  };

  // Listen updates
  useEffect(() => {
    const handleNotification = (event) => {
      const incoming = event.data?.notification || event.data;
      if (!incoming) return;

      const ts =
        incoming.created_at ||
        incoming.data?.createdAt ||
        incoming.data?.timestamp ||
        new Date().toISOString();

      const newNotif = {
        id: incoming.id || Date.now(),
        title: incoming.title || 'Notification',
        message: incoming.message || '',
        data: incoming.data || {},
        is_read: incoming.is_read || false,
        timestamp: typeof ts === 'string' ? ts : new Date(ts).toISOString()
      };

      setNotificationList(prev => [newNotif, ...prev].slice(0, 50));
      if (!newNotif.is_read) setNotificationCount(prev => prev + 1);
    };

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleNotification);
    }

    const onUpdated = async () => {
      const [list, count] = await Promise.all([
        notificationService.getNotifications(),
        notificationService.getUnreadCount()
      ]);
      setNotificationList(list || []);
      setNotificationCount(Number(count) || 0);

      // Fetch profile pictures for any new users
      (list || []).forEach((n) => {
        if (n.data?.borrowerId && !profilePics[n.data.borrowerId]) {
          fetchProfilePic(n.data.borrowerId);
        }
      });
    };

    window.addEventListener('notifications:updated', onUpdated);

    return () => {
      navigator.serviceWorker?.removeEventListener('message', handleNotification);
      window.removeEventListener('notifications:updated', onUpdated);
    };
  }, []);

  // Filtered + limited (Facebook style: only few items)
  const filteredNotifications = notificationList
    .filter(n => {
      if (filterType === 'unread') return !n.is_read;
      if (filterType === 'read') return n.is_read;
      return true;
    })
    .slice(0, 6);

  return (
    <div className="relative">
      {/* 🔔 Bell */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (isMobile) {
            navigate('/notifications');
          } else {
            setShowDropdown(!showDropdown);
          }
        }}
        className={`${isMobile ? 'relative flex h-7 w-7 sm:h-8 sm:w-8' : 'relative w-10 h-10'} flex items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-700 transition hover:bg-slate-100`}
        aria-label="Notifications"
        type="button"
      >
        <Bell className={`${isMobile ? 'h-4 w-4' : 'w-5 h-5'} text-gray-700 dark:text-gray-300`} />

        {notificationCount > 0 && (
          <span className={`absolute ${isMobile ? '-top-1 -right-1' : 'top-1 right-1'} min-w-[18px] h-4 px-1.5 rounded-full bg-red-500 dark:bg-red-600 text-[10px] font-bold text-white flex items-center justify-center`}>{notificationCount > 99 ? '99+' : notificationCount}</span>
        )}
      </button>

      {/* 🔽 Dropdown */}
      {showDropdown && !isMobile && (
        <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-[#1f1f1f] rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 z-50 overflow-hidden">

          {/* HEADER */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700 bg-white dark:bg-[#1f1f1f]">
            <h3 className="font-semibold text-gray-900 dark:text-white">Notifications</h3>

            <button
              onClick={() => {
                setShowDropdown(false);
                navigate('/notifications');
              }}
              className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline transition-colors"
            >
              See Alls
            </button>
          </div>

          {/* FILTER TABS */}
          <div className="flex gap-4 px-4 py-2 text-sm border-b border-gray-100 dark:border-gray-700 bg-white dark:bg-[#1f1f1f]">
            {['all', 'unread'].map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`pb-1 transition-colors ${
                  filterType === type
                    ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 font-medium'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                {type === 'all' ? 'All' : type === 'unread' ? 'Unread' : 'Read'}
              </button>
            ))}
          </div>

          {/* LIST */}
          <div className="max-h-[400px] overflow-y-auto bg-white dark:bg-[#1f1f1f]">

            {filteredNotifications.length === 0 ? (
              <div className="px-4 py-4 text-sm text-gray-500 dark:text-gray-400">
                No notifications
              </div>
            ) : (
              <>
                {/* SECTION */}
                <div className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase bg-gray-50 dark:bg-[#272727]">
                  Earlier
                </div>

                {filteredNotifications.map(notification => (
                  <button
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`w-full text-left px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors border-b border-gray-100 dark:border-gray-700 ${
                      !notification.is_read ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                    }`}
                  >
                    <div className="flex gap-3">

                      {/* Avatar */}
                      <div className="w-9 h-9 rounded-full bg-gray-300 dark:bg-gray-600 flex-shrink-0 overflow-hidden flex items-center justify-center">
                        {profilePics[notification.data?.borrowerId] ? (
                          <img
                            src={profilePics[notification.data?.borrowerId]}
                            alt="User"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <User className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-800 dark:text-gray-200 leading-snug">
                          <span className="font-semibold">
                            {notification.title}
                          </span>{" "}
                          {notification.message}
                        </p>

                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {new Date(notification.timestamp).toLocaleTimeString()}
                        </p>
                      </div>

                      {!notification.is_read && (
                        <div className="w-2 h-2 bg-blue-500 dark:bg-blue-400 rounded-full mt-2 flex-shrink-0"></div>
                      )}
                    </div>
                  </button>
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBadge;