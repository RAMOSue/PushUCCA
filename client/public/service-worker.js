/* eslint-disable no-restricted-globals */

// Cache name for PWA
const CACHE_NAME = 'ucca-v1';

// Keep a short-lived cache of notification IDs to avoid showing duplicates
const _recentNotifications = new Map(); // id -> timestamp
const _DUPLICATE_WINDOW_MS = 30 * 1000; // 30 seconds

// Periodically clean old entries
setInterval(() => {
  const now = Date.now();
  for (const [id, ts] of _recentNotifications.entries()) {
    if (now - ts > _DUPLICATE_WINDOW_MS) _recentNotifications.delete(id);
  }
}, 15 * 1000);

const isLocalHost = ['localhost', '127.0.0.1', '::1'].includes(self.location.hostname);

// Listen for push events
self.addEventListener('push', function(event) {
  console.log('[ServiceWorker] 🎯 PUSH EVENT RECEIVED AT:', new Date().toISOString());
  console.log('[ServiceWorker] Event object:', event);
  
  try {
    console.log('[ServiceWorker] Event.data:', event.data);
    console.log('[ServiceWorker] Event.data type:', event.data?.constructor.name);
  } catch (e) {
    console.log('[ServiceWorker] Could not log event.data:', e);
  }

  if (!event.data) {
    try { console.log('[ServiceWorker] ⚠️ Push event with no data'); } catch (e) {}
    return;
  }

  let data = {};
  try {
    data = event.data.json();
    console.log('[ServiceWorker] ✅ Successfully parsed JSON data:', data);
  } catch (err) {
    try { 
      console.log('[ServiceWorker] ℹ️ Failed to parse JSON, attempting text fallback:', err); 
      const text = event.data.text();
      console.log('[ServiceWorker] Text data:', text);
      data = { title: 'Notification', message: text };
    } catch (e) {
      console.log('[ServiceWorker] ℹ️ Also failed to get text:', e);
    }
  }

  try { console.log('[ServiceWorker] 📦 Raw push payload received:', JSON.stringify(data).substring(0, 500)); } catch (e) {}

  // Extract notification ID - support multiple formats
  const incomingId = data && (data.notificationId || (data.data && data.data._notificationId));
  
  // Validate required fields - must have at least message
  if (!data.message || typeof data.message !== 'string' || !data.message.trim()) {
    try { console.log('[ServiceWorker] ❌ Ignoring push with missing/invalid message:', data); } catch (e) {}
    return;
  }

  // Validate notification ID if present
  if (!incomingId) {
    try { console.log('[ServiceWorker] ⚠️ Push has no notificationId, will still show (might be duplicate):', data.message); } catch (e) {}
  }

  // Check for duplicates only if we have an ID
  let shouldShow = true;
  if (incomingId) {
    const prev = _recentNotifications.get(incomingId);
    if (prev && (Date.now() - prev) < _DUPLICATE_WINDOW_MS) {
      try { console.log('[ServiceWorker] ⏭️ Ignoring duplicate push for id', incomingId, `(last seen ${Date.now() - prev}ms ago)`); } catch (e) {}
      shouldShow = false;
    } else {
      _recentNotifications.set(incomingId, Date.now());
    }
  } else {
    // No ID: mark by message hash to avoid duplicates
    const msgHash = hashString(data.message);
    const prev = _recentNotifications.get(msgHash);
    if (prev && (Date.now() - prev) < _DUPLICATE_WINDOW_MS) {
      try { console.log('[ServiceWorker] ⏭️ Ignoring duplicate message (by hash)'); } catch (e) {}
      shouldShow = false;
    } else {
      _recentNotifications.set(msgHash, Date.now());
    }
  }

  if (!shouldShow) return;

  try {
    console.log('[ServiceWorker] ✅ Will display notification:', { 
      title: data.title || 'Notification', 
      message: data.message.substring(0, 100),
      id: incomingId 
    });
  } catch (e) {}

  const options = {
    body: data.message,
    icon: '/icon-192x192.png',
    badge: '/badge-96x96.png',
    data: Object.assign({}, data.data || {}, { _notificationId: data.notificationId || incomingId }),
    requireInteraction: true,
    vibrate: [200, 100, 200],
    tag: incomingId ? `notif-${incomingId}` : undefined // Prevents duplicate notifications with same ID
  };

  event.waitUntil(
    (async () => {
      try {
        if (isLocalHost) {
          console.log('[ServiceWorker] ℹ️ Skipping browser notification on localhost so only deployed environments show push notifications');
        } else {
          console.log('[ServiceWorker] 🔔 About to call showNotification with options:', JSON.stringify(options).substring(0, 300));
        }

        let notifError = null;
        let notif = null;

        if (!isLocalHost) {
          try {
            notif = await self.registration.showNotification(data.title || 'Notification', options);
            console.log('[ServiceWorker] ✅ Notification displayed successfully:', notif);
          } catch (showNotifErr) {
            notifError = showNotifErr;
            console.error('[ServiceWorker] ❌ showNotification threw error:', showNotifErr.toString(), showNotifErr.message, showNotifErr.stack);
          }
        }
        
        // CRITICAL: Notify all clients that push was received (even if notification failed)
        try {
          const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
          console.log(`[ServiceWorker] 🔔 Found ${clientList.length} window client(s) to notify`);
          
          for (const client of clientList) {
            try {
              console.log(`[ServiceWorker] 📤 Sending PUSH_RECEIVED message to client`);
              client.postMessage({ 
                type: 'PUSH_RECEIVED', 
                payload: data,
                notificationError: notifError ? notifError.toString() : null
              });
              console.log(`[ServiceWorker] ✅ Message sent successfully`);
            } catch (e) {
              console.error(`[ServiceWorker] ❌ Failed to send message to client:`, e);
            }
          }
        } catch (err) {
          console.error(`[ServiceWorker] ❌ Error getting client list:`, err);
        }
      } catch (err) {
        try { console.error('[ServiceWorker] ❌ Outer try-catch error:', err, err.stack); } catch (e) {}
      }
    })()
  );
});

// Helper: simple hash function for message deduplication
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return `hash-${hash}`;
}

// Handle notification click
self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  // Derive an absolute URL for navigation
  const rawData = event.notification.data || {};
  const path = rawData.url || '/';
  const urlToOpen = new URL(path, self.location.origin).href;

  // Debug: log notification click payload
  try {
    // eslint-disable-next-line no-console
    console.log('[ServiceWorker] notificationclick payload:', rawData, '->', urlToOpen);
  } catch (e) {}

  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });

      // Try to find a client whose URL starts with the app origin + path
      for (const client of clientList) {
        try {
          const clientUrl = new URL(client.url).href;
          if (clientUrl === urlToOpen && 'focus' in client) {
            return client.focus();
          }
          // If client is same origin, just focus it and navigate
          if (clientUrl.startsWith(self.location.origin) && 'focus' in client) {
            client.focus();
            // Post a message so the client can navigate internally (SPA)
            client.postMessage({ type: 'NOTIFICATION_CLICK', payload: rawData });
            return;
          }
        } catch (e) {
          // ignore URL parsing errors and continue
        }
      }

      // Open a new window as fallback
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })()
  );
});

// Handle service worker installation
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        return cache.addAll([
          '/',
          '/index.html',
          '/icon-192x192.png',
          '/badge-96x96.png'
        ]);
      })
  );
});