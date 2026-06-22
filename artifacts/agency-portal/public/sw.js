// Service worker minimo per il portal Be Kind.
// Strategie:
//  - install: skipWaiting, precache della shell minima
//  - activate: claim + cleanup vecchie cache
//  - fetch (solo GET stessa origine):
//      * navigate (HTML) → network-first, fallback alla pagina cached
//      * statici Vite (/assets/*.{js,css}) → cache-first stale-while-revalidate
//      * resto → solo network (no cache)
// (Le notifiche push browser sono state rimosse: niente handler notificationclick.)

const CACHE_VERSION = "bekind-v3";
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const ASSETS_CACHE = `${CACHE_VERSION}-assets`;
const PRECACHE_URLS = ["/", "/favicon.png", "/favicon.svg", "/logo-bekind.png"];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(PRECACHE_URLS).catch(() => {})),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("bekind-") && !k.startsWith(CACHE_VERSION))
            .map((k) => caches.delete(k)),
        ),
      ),
    ]),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return; // mai cachare API

  // Documenti HTML (navigation) → network-first con fallback alla shell.
  if (req.mode === "navigate" || req.destination === "document") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put("/", copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match("/").then((m) => m || Response.error())),
    );
    return;
  }

  // Asset Vite build (immutable per chunk-hash) → cache-first.
  if (url.pathname.startsWith("/assets/") || /\.(js|css|woff2?|png|jpe?g|svg|webp|ico)$/.test(url.pathname)) {
    event.respondWith(
      caches.open(ASSETS_CACHE).then(async (cache) => {
        const cached = await cache.match(req);
        if (cached) {
          // Background refresh
          fetch(req).then((res) => {
            if (res.ok) cache.put(req, res.clone()).catch(() => {});
          }).catch(() => {});
          return cached;
        }
        try {
          const res = await fetch(req);
          if (res.ok) cache.put(req, res.clone()).catch(() => {});
          return res;
        } catch {
          return Response.error();
        }
      }),
    );
  }
});
