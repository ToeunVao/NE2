// public/sw.js
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  // Required for PWA validation
  event.respondWith(fetch(event.request));
});