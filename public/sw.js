const CACHE_NAME = 'fitnessflow-static-v1'
const STATIC_ASSETS = [
  '/offline.html',
  '/icons/fitnessflow-icon.svg',
  '/icons/fitnessflow-192.png',
  '/icons/fitnessflow-512.png',
  '/icons/fitnessflow-maskable-512.png',
]

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS)))
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', event => {
  const request = event.request
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // Personal data is never stored by the service worker. Navigations and every
  // API call stay network-only; the generic offline page contains no user data.
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('/offline.html')))
    return
  }
  if (url.pathname.startsWith('/api/')) return

  if (STATIC_ASSETS.includes(url.pathname)) {
    event.respondWith(caches.match(request).then(cached => cached || fetch(request)))
  }
})
