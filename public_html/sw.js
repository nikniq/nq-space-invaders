// Service worker: makes the game installable and playable offline.
// Same-origin GET requests are served stale-while-revalidate, so a visit
// always works from cache and quietly picks up the next version.
const CACHE = 'nq-space-invaders-v1';
const PRECACHE = ['./', './space-invaders.js', './icon.svg', './manifest.webmanifest'];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE).then(cache => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    const req = event.request;
    if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
    event.respondWith(
        caches.open(CACHE).then(async cache => {
            const cached = await cache.match(req);
            const fresh = fetch(req).then(res => {
                if (res && res.ok) cache.put(req, res.clone());
                return res;
            }).catch(() => cached);
            return cached || fresh;
        })
    );
});
