const CACHE = 'sqlite-v1';
const urls = ['/build/sqlite3.js', '/build/sqlite3.wasm'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(urls)));
});

self.addEventListener('fetch', e => {
  if (urls.some(u => e.request.url.includes(u))) {
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
  }
});
