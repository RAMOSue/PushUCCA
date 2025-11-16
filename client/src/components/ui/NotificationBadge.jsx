import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { notificationService } from '../../services/notifications';

const NotificationBadge = () => {
  const navigate = useNavigate();
  const [notificationCount, setNotificationCount] = useState(0);
  const [notificationList, setNotificationList] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);

  // Initialize notifications
  useEffect(() => {
    const initNotifications = async () => {
      try {
        console.log('🔔 NotificationBadge: Starting initialization');
        console.log('Current permission:', Notification.permission);
        
        // Initialize notification service and fetch server-side notifications
        await notificationService.init();
        console.log('✅ Notification service initialized');

        // Always request permission if not already granted
        if (Notification.permission !== 'granted') {
          console.log('🔔 NotificationBadge: Requesting notification permission...');
          await notificationService.requestPermission();
          console.log('✅ Permission request completed');
        } else {
          console.log('✅ Notifications already permitted');
        }

        // Load persisted notifications and unread count from server
        try {
          const [list, count] = await Promise.all([
            notificationService.getNotifications(),
            notificationService.getUnreadCount()
          ]);
          setNotificationList(list || []);
          setNotificationCount(Number(count) || 0);
        } catch (err) {
          console.warn('Could not fetch notifications from server:', err);
        }
      } catch (error) {
        console.error('❌ Notification initialization error:', error);
      }
    };

    initNotifications();
  }, []);

  // Handle notification clicks
  const handleNotificationClick = (notification) => {
    // Mark as read locally and server-side
    setNotificationList(prev => 
      prev.map(n => n.id === notification.id ? { ...n, is_read: true } : n)
    );
    if (!notification.is_read) {
      // markAsRead expects a single id (object with { id })
      notificationService.markAsRead(notification.id).catch(err => console.warn('Mark as read failed', err));
      setNotificationCount(prev => Math.max(0, prev - 1));
    }

    // Navigate based on notification payload. If a requestId is present, deep-link into staff manage requests
    if (notification.data?.requestId) {
      navigate(`/staff/manage-requests?openRequestId=${notification.data.requestId}`);
    } else if (notification.data?.url) {
      navigate(notification.data.url);
    }

    setShowDropdown(false);
  };

  // Listen for notifications
  useEffect(() => {
    const handleNotification = (event) => {
      const payload = event.data;
      // payload from service-worker should include a type or notification doc
      if (!payload) return;

      // If the service worker posts a notification object, normalize it
      const incoming = payload.notification || payload;
      const newNotif = {
        id: incoming.id || Date.now(),
        title: incoming.title || incoming.data?.title || 'Notification',
        message: incoming.message || incoming.data?.message || '',
        data: incoming.data || incoming.data || {},
        is_read: incoming.is_read === true || false,
        timestamp: incoming.created_at ? new Date(incoming.created_at) : new Date()
      };

      setNotificationList(prev => [newNotif, ...prev].slice(0, 50));
      if (!newNotif.is_read) setNotificationCount(prev => prev + 1);
    };

    // Add event listener
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleNotification);
    }

    // Also listen for in-app events when notifications are updated elsewhere
    const onUpdated = async () => {
      try {
        const [list, count] = await Promise.all([
          notificationService.getNotifications(),
          notificationService.getUnreadCount()
        ]);
        setNotificationList(list || []);
        setNotificationCount(Number(count) || 0);
      } catch (err) {
        console.warn('Failed to refresh notifications:', err);
      }
    };
    window.addEventListener('notifications:updated', onUpdated);

    return () => {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleNotification);
      }
      window.removeEventListener('notifications:updated', onUpdated);
    };
  }, []);

  return (
    <div className="relative">
      {/* Notification Bell Icon with Badge */}
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="relative p-2 text-gray-600 hover:text-gray-800 focus:outline-none"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {notificationCount > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-red-100 transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full">
            {notificationCount}
          </span>
        )}
      </button>

      {/* Notification Dropdown */}
      {showDropdown && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl z-50">
          <div className="py-2">
            <div className="px-4 py-2 border-b border-gray-200 font-semibold text-gray-800">
              Notifications
              {notificationCount > 0 && (
                <button
                  onClick={() => {
                    setNotificationList(prev =>
                      prev.map(n => ({ ...n, read: true }))
                    );
                    setNotificationCount(0);
                  }}
                  className="float-right text-sm text-blue-600 hover:text-blue-800"
                >
                  Mark all as read
                </button>
              )}
            </div>
            <div className="max-h-96 overflow-y-auto">
              {notificationList.length === 0 ? (
                <div className="px-4 py-3 text-sm text-gray-500">
                  No new notifications
                </div>
              ) : (
                notificationList.map(notification => (
                  <button
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`w-full text-left px-4 py-3 hover:bg-gray-50 ${
                      !notification.is_read ? 'bg-blue-50' : ''
                    }`}
                  >
                    <p className="font-semibold text-sm text-gray-800">
                      {notification.title}
                    </p>
                    <p className="text-sm text-gray-600">{notification.message}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(notification.timestamp).toLocaleString()}
                    </p>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBadge;