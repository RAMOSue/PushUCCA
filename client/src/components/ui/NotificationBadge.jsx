import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  const refreshTimerRef = useRef(null);
  const profilePicsRef = useRef({});
  const notificationKeysRef = useRef(new Set());

  useEffect(() => {
    profilePicsRef.current = profilePics;
  }, [profilePics]);

  // Fetch profile pictures for users
  const fetchProfilePic = async (userId) => {
    // Return cached pic if available
    if (profilePicsRef.current[userId] !== undefined) {
      return profilePicsRef.current[userId];
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

  const refreshNotifications = async (options = {}) => {
    try {
      const [list, count] = await Promise.all([
        notificationService.getNotifications(),
        notificationService.getUnreadCount(),
      ]);

      const normalized = notificationService.normalizeNotifications(list || []);
      const unreadCount = normalized.filter((item) => !item.is_read).length;
      const nextCount = Number(count) || unreadCount;

      setNotificationList(normalized);
      setNotificationCount(nextCount);

      // Fetch profile pictures for all users in notifications
      normalized.forEach((item) => {
        if (item.data?.borrowerId) {
          fetchProfilePic(item.data.borrowerId);
        }
      });

      if (options.showToast && normalized[0] && !normalized[0].is_read) {
        console.log('🔔 Refreshed notifications with latest item:', normalized[0]);
      }
    } catch (error) {
      console.error('Notification refresh error:', error);
    }
  };

  // Initialize
  useEffect(() => {
    const initNotifications = async () => {
      try {
        const initialized = await notificationService.init();

        if (initialized && Notification.permission !== 'granted') {
          await notificationService.requestPermission();
        }

        await refreshNotifications();
      } catch (error) {
        console.error('Notification init error:', error);
      }
    };

    initNotifications();
  }, []);

  useEffect(() => {
    const handleVisibilityRefresh = () => {
      if (!document.hidden) {
        refreshNotifications();
      }
    };

    const refreshInterval = window.setInterval(() => {
      refreshNotifications();
    }, 10000);

    window.addEventListener('focus', handleVisibilityRefresh);
    document.addEventListener('visibilitychange', handleVisibilityRefresh);

    return () => {
      window.clearInterval(refreshInterval);
      window.removeEventListener('focus', handleVisibilityRefresh);
      document.removeEventListener('visibilitychange', handleVisibilityRefresh);
    };
  }, []);

  // Click notification
  const handleNotificationClick = (notification) => {
    setNotificationList(prev =>
      prev.map(item =>
        item.id === notification.id ? { ...item, is_read: true } : item
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
    const getNotificationKey = (item) => {
      if (!item) return null;
      return item.id ? `id:${item.id}` : `sig:${item.title || ''}|${item.message || ''}|${item.timestamp || item.created_at || ''}`;
    };

    const handleNotification = (incoming) => {
      const normalizedIncoming = incoming?.data?.notification || incoming;
      if (!normalizedIncoming) return;

      const newNotif = notificationService.normalizeNotification(normalizedIncoming);
      const notificationKey = getNotificationKey(newNotif);

      if (notificationKey && notificationKeysRef.current.has(notificationKey)) {
        return;
      }

      if (notificationKey) {
        notificationKeysRef.current.add(notificationKey);
      }

      setNotificationList(prev => {
        const merged = [newNotif, ...prev];
        const unique = [];
        const seen = new Set();

        merged.forEach((item) => {
          const key = getNotificationKey(item);
          if (!key || seen.has(key)) return;
          seen.add(key);
          unique.push(item);
        });

        return unique.slice(0, 50);
      });

      if (!newNotif.is_read) {
        setNotificationCount(prev => prev + 1);
      }

      window.dispatchEvent(new Event('notifications:updated'));

      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
      refreshTimerRef.current = setTimeout(() => {
        refreshNotifications();
      }, 600);
    };

    notificationService.setupMessageListener(handleNotification);

    const onUpdated = async () => {
      await refreshNotifications();
    };

    window.addEventListener('notifications:updated', onUpdated);

    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
      window.removeEventListener('notifications:updated', onUpdated);
      notificationService.removeMessageListener(handleNotification);
    };
  }, []);

  const filteredNotifications = useMemo(() => {
    return notificationList
      .filter((item) => {
        if (filterType === 'unread') return !item.is_read;
        if (filterType === 'read') return item.is_read;
        return true;
      })
      .slice(0, 6);
  }, [filterType, notificationList]);

  const groupedNotifications = useMemo(() => {
    const today = new Date();
    const todayLabel = today.toDateString();

    return filteredNotifications.reduce((groups, item) => {
      const rawDate = item.timestamp || item.created_at || new Date().toISOString();
      const parsed = new Date(rawDate);
      const section = parsed.toDateString() === todayLabel ? 'Today' : 'Earlier';
      if (!groups[section]) {
        groups[section] = [];
      }
      groups[section].push(item);
      return groups;
    }, {});
  }, [filteredNotifications]);

  const getNotificationDisplayText = (notification) => {
    const message = notification?.message || notification?.body || notification?.data?.message || notification?.data?.body || '';
    const title = notification?.title || notification?.data?.title || '';

    if (typeof message === 'string' && message.trim()) {
      return message.trim();
    }

    if (typeof title === 'string' && title.trim()) {
      return title.trim();
    }

    return '';
  };

  const formatNotificationTime = (value) => {
    const parsed = new Date(value || Date.now());
    if (Number.isNaN(parsed.getTime())) return '';

    return parsed.toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

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
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-700 bg-white dark:bg-[#1f1f1f]">
            <h3 className="font-semibold text-gray-900 dark:text-white">Notifications</h3>
          </div>

          {/* FILTER TABS */}
          <div className="flex items-center justify-between gap-3 px-4 py-2 text-sm border-b border-gray-100 dark:border-gray-700 bg-white dark:bg-[#1f1f1f]">
            <div className="flex items-center gap-4">
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

            <button
              onClick={() => {
                setShowDropdown(false);
                navigate('/notifications');
              }}
              className="text-xs font-medium text-blue-600 transition hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
            >
              See All
            </button>
          </div>

          {/* LIST */}
          <div className="max-h-[70vh] overflow-y-auto bg-white dark:bg-[#1f1f1f]">

            {filteredNotifications.length === 0 ? (
              <div className="px-4 py-4 text-sm text-gray-500 dark:text-gray-400">
                No notifications
              </div>
            ) : (
              <>
                {(['Today', 'Earlier']).filter((section) => groupedNotifications[section]?.length).map((section) => (
                  <div key={section}>
                    <div className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase bg-gray-50 dark:bg-[#272727]">
                      {section}
                    </div>

                    {groupedNotifications[section].map((notification) => (
                      <button
                        key={notification.id}
                        onClick={() => handleNotificationClick(notification)}
                        className={`w-full text-left px-3 py-2.5 hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors border-b border-gray-100 dark:border-gray-700 ${
                          !notification.is_read ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                        }`}
                      >
                        <div className="flex gap-2.5">

                          {/* Avatar */}
                          <div className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-600 flex-shrink-0 overflow-hidden flex items-center justify-center">
                            {profilePics[notification.data?.borrowerId] ? (
                              <img
                                src={profilePics[notification.data?.borrowerId]}
                                alt="User"
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <User className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <p className="text-sm leading-snug text-gray-800 dark:text-gray-200">
                              {getNotificationDisplayText(notification)}
                            </p>

                            <p className="mt-1 text-[10px] text-gray-500 dark:text-gray-400">
                              {formatNotificationTime(notification.timestamp)}
                            </p>
                          </div>

                          {!notification.is_read && (
                            <div className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-blue-500 dark:bg-blue-400"></div>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
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