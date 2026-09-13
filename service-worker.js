importScripts('/version.js');

const CACHE_NAME = `astrieos-${self.ASTRIEOS_VERSION}`;
const APP_SHELL = [
    '/', '/index.html', '/index.css', '/version.json',
    '/JavaScript/Window_system.js', '/JavaScript/Erfolgen.js', '/JavaScript/ui.js',
    '/JavaScript/Soundeffekt.js', '/JavaScript/toggle.js', '/JavaScript/Ladenoverlay.js',
    '/JavaScript/Hintergrund-tracking.js', '/JavaScript/Nutzeruhr.js', '/JavaScript/untertitlel_system.js',
    '/JavaScript/Benachrichtigen.js', '/JavaScript/Update_hernterladen.js', '/JavaScript/Einstellungen.js',
    '/ui/Einstellungen.html', '/ui/Benachrichtigung.html', '/ui/Nutzercenter.html', '/ui/overlay/window.html'
];

self.addEventListener('install', (event) => {
    event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => Promise.all(keys
            .filter((key) => key.startsWith('astrieos-') && key !== CACHE_NAME)
            .map((key) => caches.delete(key))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('message', (event) => {
    if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;
    const url = new URL(event.request.url);
    // The updater must always see the deployed version, never the cached one.
    if (url.origin === self.location.origin && url.pathname === '/version.json') {
        event.respondWith(fetch(event.request));
        return;
    }
    event.respondWith(
        caches.match(event.request).then((cached) => cached || fetch(event.request))
    );
});
