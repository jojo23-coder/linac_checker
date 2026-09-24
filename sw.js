// Service worker: keeps the app working with no signal in the bunker (CLAUDE.md › Architecture).
//
// Every request goes to the network first, so a deployed change shows up on the next load and
// the files can never mix old and new versions while online. When the network fails, or takes
// longer than NETWORK_TIMEOUT_MS on a weak signal, the cached copy answers instead.

const CACHE = "linac-checker-v1";
const NETWORK_TIMEOUT_MS = 4000;

// Every file the page loads. tests/sw.test.js reds when one is missing; bump CACHE when this changes.
const PRECACHE = [
  "./",
  "index.html",
  "styles.css",
  "manifest.webmanifest",
  "js/app.js",
  "js/checks.js",
  "js/format.js",
  "js/protocol.js",
  "js/report.js",
  "js/store.js",
  "js/linacs/index.js",
  "js/linacs/linac4.js",
  "icons/icon.svg",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || !event.request.url.startsWith("http")) return;
  event.respondWith(networkFirst(event.request));
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  const network = fetch(request, { cache: "no-cache" }).then((response) => {
    if (response.ok || response.type === "opaque") cache.put(request, response.clone());
    return response;
  });
  network.catch(() => {}); // a failure after the cache has answered is not an error
  const timeout = new Promise((resolve) => setTimeout(resolve, NETWORK_TIMEOUT_MS));
  try {
    const response = await Promise.race([network, timeout]);
    if (response) return response;
  } catch {
    // Offline: fall through to the cache.
  }
  const cached = await cache.match(request, { ignoreSearch: true });
  return cached ?? network;
}
