// Service Worker básico para suporte a PWA
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Estratégia de rede primeiro para garantir dados atualizados do restaurante
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});