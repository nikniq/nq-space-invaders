// Service worker: makes the game installable and playable offline.
// Same-origin GET requests are served stale-while-revalidate, so a visit
// always works from cache and quietly picks up the next version.
const CACHE = 'nq-space-invaders-v2';
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
    const url = new URL(req.url);
    if (req.method !== 'GET' || url.origin !== self.location.origin) return;
    // Pages carry the signed-in player and a CSRF token, so always try the
    // network first and fall back to the cached game page only when offline.
    if (req.mode === 'navigate') {
        if (url.pathname !== '/') return;
        event.respondWith(fetch(req).then(res => {
            if (res.ok) caches.open(CACHE).then(c => c.put('./', res.clone()));
            return res;
        }).catch(() => caches.match('./')));
        return;
    }
    // Live data and account pages are never cached.
    if (url.pathname.startsWith('/scores') || url.pathname.startsWith('/email-link') || url.pathname.startsWith('/auth')) return;
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
