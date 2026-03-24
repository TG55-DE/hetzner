// Service Worker – ermöglicht die Installation als PWA auf dem iPhone
// Version 4: Kein Fetch-Intercepting mehr (iOS Safari Bug-Umgehung)
// Der SW ist nur noch für die PWA-Installierbarkeit zuständig.

const CACHE_NAME = 'cc-extension-v4';

// Beim Installieren: Sofort aktiv werden
self.addEventListener('install', (event) => {
    self.skipWaiting();
});

// Beim Aktivieren: Alten Cache löschen und Kontrolle übernehmen
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

// KEIN fetch-Handler – alle Requests gehen direkt ans Netzwerk.
// iOS Safari blockiert POST-Requests wenn ein SW fetch-Events abfängt.
