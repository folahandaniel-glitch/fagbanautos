/* FAGDAN service worker.
 * - Precaches the offline fallback and brand assets.
 * - Static assets (/_next/static, icons, brand): cache-first.
 * - HTML navigations: network-first, falling back to the offline page. Prices and stock are never served stale as fact.
 * - NEVER caches: /api/*, /admin/*, /checkout*, /account*, /pay*, /cart, /order*, non-GET requests.
 */
const VERSION = "fagdan-v1";
const STATIC = `${VERSION}-static`;
const OFFLINE_URL = "/offline";
const PRECACHE = [OFFLINE_URL, "/icons/icon-192.png", "/icons/icon-512.png", "/brand/logo.png"];
const NEVER = [/^\/api\//, /^\/admin/, /^\/checkout/, /^\/account/, /^\/pay/, /^\/cart/, /^\/order/];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (NEVER.some((r) => r.test(url.pathname))) return;

  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match(OFFLINE_URL)));
    return;
  }
  if (/^\/(_next\/static|icons|brand)\//.test(url.pathname)) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(STATIC).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
  }
});
