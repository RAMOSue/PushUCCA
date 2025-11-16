/* eslint-disable no-restricted-globals */

// Cache name for PWA
const CACHE_NAME = 'ucca-v1';

// Listen for push events
self.addEventListener('push', function(event) {
  if (!event.data) return;
  let data = {};
  try {
    data = event.data.json();
  } catch (err) {
    // If payload is not JSON, treat as text
    data = { title: 'Notification', message: event.data.text() };
  }

  // Debug: log incoming push payload for troubleshooting
  try {
    // eslint-disable-next-line no-console
    console.log('[ServiceWorker] push event received:', data);
  } catch (e) {}

  const options = {
    body: data.message || '',
    icon: '/icon-192x192.png', // Add your icon path
    badge: '/badge-96x96.png', // Add your badge path
    data: Object.assign({}, data.data || {}, { _notificationId: data.notificationId }),
    requireInteraction: true,
    vibrate: [200, 100, 200]
  };

  event.waitUntil(
    (async () => {
      // Show notification
      await self.registration.showNotification(data.title || 'Notification', options);

      // Notify all open windows (so in-app UI can update)
      const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of clientList) {
        try {
          client.postMessage({ type: 'PUSH_RECEIVED', payload: data });
        } catch (e) {
          // ignore
        }
      }
    })()
  );
});

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