// NBN service worker: makes the site installable and opens fast.
// Always tries the network first so users get the newest version; falls back to the last copy when offline.
const CACHE = 'nbn-v54';
const SHELL = ['/', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png', '/pricesheet.js', '/lang.js', '/extras.js', '/vendor/supabase.js', '/vendor/html5-qrcode.min.js'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => {})); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;           // never touch Supabase, Shopee, fonts etc.
  e.respondWith(fetch(req, {cache: "no-cache"}).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req).then(r => r || (req.mode === 'navigate' ? caches.match('/') : Response.error()))));
});
