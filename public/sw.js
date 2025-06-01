// public/sw.js

// This is a minimal service worker to prevent 404 errors.
// It doesn't implement any caching or PWA features by default.

self.addEventListener('install', (event) => {
  // console.log('[SW] Service Worker installing.');
  // event.waitUntil(self.skipWaiting()); // Optional: activate new SW immediately
});

self.addEventListener('activate', (event) => {
  // console.log('[SW] Service Worker activating.');
  // event.waitUntil(self.clients.claim()); // Optional: take control of open clients immediately
});

self.addEventListener('fetch', (event) => {
  // console.log('[SW] Fetching:', event.request.url);
  // This basic fetch handler just lets the network request pass through.
  // For actual offline capabilities, you would add caching strategies here.
  // event.respondWith(fetch(event.request));
});
