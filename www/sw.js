const CACHE_NAME = 'electrolux-3d-twin-v3';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  const isNavigation =
    event.request.mode === 'navigate' ||
    url.pathname.endsWith('/') ||
    url.pathname.endsWith('/index.html');

  // Network-first for index.html so app updates immediately when online, with offline fallback
  if (isNavigation) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Cache-first for static assets & Three.js CDN modules
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          if (response && (response.status === 200 || response.type === 'cors')) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached);
    })
  );
});

self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data) return;

  if (data.type === 'SHOW_WASH_NOTIFICATION') {
    const title = data.title || 'Electrolux 3D Twin';
    const options = {
      body: data.body || '',
      icon: './icon-192.png',
      badge: './icon-192.png',
      silent: false,
      renotify: true,
      requireInteraction: Boolean(data.requireInteraction),
      vibrate: Array.isArray(data.vibrate) ? data.vibrate : [150, 80, 150],
      tag: data.tag || 'electrolux-wash-status'
    };
    event.waitUntil(self.registration.showNotification(title, options));
    return;
  }

  if (data.type === 'SHOW_COMPLETION_NOTIFICATION') {
    const title = data.title || 'Cucian Selesai! 🧺';
    const options = {
      body: data.body || 'Pakaian di Electrolux 8.0kg sudah selesai dicuci, yuk segera dijemur.',
      icon: './icon-192.png',
      badge: './icon-192.png',
      silent: false,
      renotify: true,
      requireInteraction: true,
      vibrate: [300, 100, 300, 100, 300],
      tag: 'electrolux-wash-done'
    };
    event.waitUntil(self.registration.showNotification(title, options));
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsList) => {
      for (const client of clientsList) {
        if ('focus' in client) return client.focus();
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow('./index.html');
      }
    })
  );
});
