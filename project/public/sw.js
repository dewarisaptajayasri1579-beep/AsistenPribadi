const CACHE_NAME = "dda-static-v1"

self.addEventListener("install", (event) => {
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  )
})

// Hanya cache aset statis build (JS/CSS/icon) — HALAMAN & DATA (/api, HTML) selalu
// diambil langsung dari network supaya tidak ada risiko data basi atau bocor sesi
// antar user di perangkat yang sama.
self.addEventListener("fetch", (event) => {
  const { request } = event
  if (request.method !== "GET") return

  const url = new URL(request.url)
  const isCacheable = url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icon-")
  if (!isCacheable) return

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(request)
      if (cached) return cached
      const response = await fetch(request)
      if (response.ok) cache.put(request, response.clone())
      return response
    })
  )
})
