// PotteryTracker service worker
// Minimal och medvetet försiktig: gör appen installerbar (PWA-krav i Chrome)
// utan att cacha API-svar eller sidor — det undviker inaktuell data och
// problem med sessioner/inloggning. Offline-cachning kan läggas till senare.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Passthrough-fetch: krävs för installerbarhet, men vi rör inte svaren.
self.addEventListener('fetch', () => {});
