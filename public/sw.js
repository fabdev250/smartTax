const CACHE_NAME = "smarttax-v1";
const ASSETS = [
  "/",
  "/index.html",
  "/src/main.tsx",
  "/src/App.tsx",
  "/src/index.css",
  "/public/manifest.json",
];

// Install Event
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("Service Worker caching system asset shell");
      return cache.addAll(ASSETS);
    }).then(() => {
      return self.skipWaiting();
    })
  );
});

// Activate Event
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// Fetch Intercept for full offline behavior
self.addEventListener("fetch", (e) => {
  // Direct ignore chrome-extensions, non-http, or local development HMR sockets
  if (!e.request.url.startsWith("http")) return;

  // Static API requests bypass Cache First Strategy
  if (e.request.url.includes("/api/")) {
    e.respondWith(
      fetch(e.request).catch(() => {
        // Safe offline return if checking DB or API
        return new Response(
          JSON.stringify({ offline: true, message: "Operating in SmartTax Offline mode." }),
          { headers: { "Content-Type": "application/json" } }
        );
      })
    );
    return;
  }

  // Assets Standard Cache first strategy
  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;
      return fetch(e.request).then((networkResponse) => {
        return caches.open(CACHE_NAME).then((cache) => {
          cache.put(e.request, networkResponse.clone());
          return networkResponse;
        });
      }).catch(() => {
        // Fallback to offline index for SPA routes
        return caches.match("/");
      });
    })
  );
});
