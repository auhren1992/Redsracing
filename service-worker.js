/*!
 * service-worker.js — RedsRacing PWA
 *
 * - Cache-first for /assets/ and /data/schedule.json (and a small precache list)
 * - Network-first for HTML
 * - Skips Firestore / Cloud Functions / AdSense / GTM (those should always
 *   hit the network so we don't serve stale auth tokens or freshness-critical
 *   responses)
 * - Versioned cache name; bumped via the timestamp baked into CACHE_VERSION
 *   below. The CACHE_VERSION constant is overwritten by hosting at deploy
 *   time via a no-cache header on this file.
 */
/* eslint-disable no-restricted-globals */

const CACHE_VERSION = "redsracing-v2-2026080903";
const STATIC_CACHE = CACHE_VERSION + "-static";
const HTML_CACHE = CACHE_VERSION + "-html";

const PRECACHE_URLS = [
  "/index.html",
  "/team.html",
  "/schedule.html",
  "/driver.html",
  "/jonny.html",
  "/gallery.html",
  "/manifest.json",
  "/assets/js/page-meta.js",
  "/assets/js/firebase-core.js",
  "/assets/js/navigation.js",
  "/assets/js/main.js",
  "/assets/js/site-search.js",
  "/data/schedule.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) =>
        Promise.all(
          PRECACHE_URLS.map((url) =>
            cache
              .add(new Request(url, { cache: "reload" }))
              .catch(() => undefined),
          ),
        ),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (k) => k.indexOf(CACHE_VERSION) !== 0 && /^redsracing-/.test(k),
            )
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function shouldBypass(url) {
  try {
    if (url.protocol !== "https:" && url.protocol !== "http:") return true;
    const host = url.hostname;
    if (host === "firestore.googleapis.com") return true;
    if (host.endsWith("cloudfunctions.net")) return true;
    if (host === "pagead2.googlesyndication.com") return true;
    if (host === "www.googletagmanager.com") return true;
    if (host === "www.google-analytics.com") return true;
    if (host.endsWith("doubleclick.net")) return true;
    if (host === "www.googleapis.com") return true;
    if (host.endsWith("firebaseio.com")) return true;
    if (host.endsWith("firebaseapp.com")) return true;
    if (host.endsWith("firebasestorage.app")) return true;
    if (host === "fundingchoicesmessages.google.com") return true;
    if (host.startsWith("ep1.adtrafficquality.google")) return true;
    if (host.startsWith("ep2.adtrafficquality.google")) return true;
  } catch (_) {
    return true;
  }
  return false;
}

function isHTMLRequest(req) {
  if (req.mode === "navigate") return true;
  const accept = req.headers.get("accept") || "";
  return accept.indexOf("text/html") !== -1;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  let url;
  try {
    url = new URL(req.url);
  } catch (_) {
    return;
  }
  if (shouldBypass(url)) return;
  if (url.origin !== self.location.origin) {
    // Do NOT intercept cross-origin requests. If we call fetch(req) from
    // inside the SW, the browser checks that fetch against the document's
    // connect-src CSP directive — which legitimately doesn't list every
    // CDN we use for images (imgur, placehold.co) and stylesheets
    // (cdnjs). The original <img>/<link> request would have been governed
    // by img-src / style-src and would have succeeded; intercepting it
    // here just upgrades it into a CSP violation that returns undefined
    // and trips "Failed to convert value to 'Response'". Cross-origin
    // assets are also cached by the CDN's own headers, so SW caching adds
    // little value here. Just let the browser handle it natively.
    return;
  }

  // Network-first for HTML
  if (isHTMLRequest(req)) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(HTML_CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() =>
          caches
            .match(req)
            .then((hit) => hit || caches.match("/index.html") || Response.error()),
        ),
    );
    return;
  }

  // Network-first for CSS so brand/theme polish ships immediately
  if (url.pathname.indexOf("/styles/") === 0) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(STATIC_CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || Response.error())),
    );
    return;
  }

  // Cache-first for /assets/ and /data/schedule.json
  if (
    url.pathname.indexOf("/assets/") === 0 ||
    url.pathname === "/data/schedule.json" ||
    url.pathname === "/manifest.json"
  ) {
    event.respondWith(
      caches.match(req).then((hit) => {
        if (hit) return hit;
        return fetch(req)
          .then((res) => {
            if (res && res.status === 200) {
              const copy = res.clone();
              caches.open(STATIC_CACHE).then((c) => c.put(req, copy));
            }
            return res;
          })
          .catch(() => hit || Response.error());
      }),
    );
  }
});
