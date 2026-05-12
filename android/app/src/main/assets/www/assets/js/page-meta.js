/*!
 * page-meta.js — RedsRacing per-page meta bootstrap
 *
 * Loaded with `defer` in the <head> of every public page. It looks up the page's
 * slug (filename without extension) and fetches a Firestore document at
 *   page_meta/<slug>
 * via the REST API (no SDK). On success it applies title / description /
 * keywords / canonical / OG / Twitter / robots tags before paint.
 *
 * Also registers the service worker (PWA) and emits an `rr:pwa-installable`
 * event when the browser fires `beforeinstallprompt` so a future UI can render
 * an install button.
 *
 * Failsafe: never throws, never blocks. If Firestore is unreachable the page
 * falls back to its hard-coded meta tags.
 */
(function () {
  "use strict";

  var PROJECT_ID = "redsracing-a7f8b";
  var CACHE_TTL_MS = 5 * 60 * 1000; // 5 min
  var FIRESTORE_BASE =
    "https://firestore.googleapis.com/v1/projects/" +
    PROJECT_ID +
    "/databases/(default)/documents/page_meta/";

  function safeQuery(sel) {
    try {
      return document.querySelector(sel);
    } catch (_) {
      return null;
    }
  }

  function upsertMeta(attr, key, content) {
    if (!content) return;
    try {
      var el = safeQuery('meta[' + attr + '="' + key + '"]');
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attr, key);
        (document.head || document.documentElement).appendChild(el);
      }
      el.setAttribute("content", content);
    } catch (_) {}
  }

  function upsertLink(rel, href) {
    if (!href) return;
    try {
      var el = safeQuery('link[rel="' + rel + '"]');
      if (!el) {
        el = document.createElement("link");
        el.setAttribute("rel", rel);
        (document.head || document.documentElement).appendChild(el);
      }
      el.setAttribute("href", href);
    } catch (_) {}
  }

  function getSlug() {
    try {
      var path = (location.pathname || "/").replace(/^\/+/, "");
      if (!path) return "index";
      var last = path.split("/").pop() || "index";
      last = last.replace(/\.html?$/i, "");
      return last || "index";
    } catch (_) {
      return "index";
    }
  }

  function readCache(slug) {
    try {
      var raw = sessionStorage.getItem("rr_page_meta_" + slug);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || !parsed.ts || Date.now() - parsed.ts > CACHE_TTL_MS) return null;
      return parsed.data || null;
    } catch (_) {
      return null;
    }
  }

  function writeCache(slug, data) {
    try {
      sessionStorage.setItem(
        "rr_page_meta_" + slug,
        JSON.stringify({ ts: Date.now(), data: data })
      );
    } catch (_) {}
  }

  // Convert Firestore "fields" map into a flat JS object (strings only).
  function flattenFirestoreFields(fields) {
    var out = {};
    if (!fields || typeof fields !== "object") return out;
    Object.keys(fields).forEach(function (k) {
      var v = fields[k];
      if (!v) return;
      if (typeof v.stringValue === "string") out[k] = v.stringValue;
      else if (typeof v.booleanValue === "boolean") out[k] = v.booleanValue;
      else if (typeof v.integerValue !== "undefined")
        out[k] = Number(v.integerValue);
      else if (typeof v.doubleValue === "number") out[k] = v.doubleValue;
    });
    return out;
  }

  function applyMeta(meta) {
    if (!meta) return;
    try {
      if (meta.title) {
        document.title = meta.title;
        upsertMeta("property", "og:title", meta.ogTitle || meta.title);
        upsertMeta("name", "twitter:title", meta.ogTitle || meta.title);
      }
      if (meta.description) {
        upsertMeta("name", "description", meta.description);
        upsertMeta(
          "property",
          "og:description",
          meta.ogDescription || meta.description
        );
        upsertMeta(
          "name",
          "twitter:description",
          meta.ogDescription || meta.description
        );
      }
      if (meta.keywords) upsertMeta("name", "keywords", meta.keywords);
      if (meta.canonical) upsertLink("canonical", meta.canonical);
      if (meta.ogImage) {
        upsertMeta("property", "og:image", meta.ogImage);
        upsertMeta("name", "twitter:image", meta.ogImage);
      }
      upsertMeta(
        "name",
        "twitter:card",
        meta.twitterCard || "summary_large_image"
      );
      var url = meta.canonical || (location.origin + location.pathname);
      upsertMeta("property", "og:url", url);
      if (meta.noindex === true) {
        upsertMeta("name", "robots", "noindex,nofollow");
      }
    } catch (_) {}
  }

  function fetchMeta(slug) {
    var cached = readCache(slug);
    if (cached) {
      applyMeta(cached);
      return Promise.resolve(cached);
    }
    return fetch(FIRESTORE_BASE + encodeURIComponent(slug), {
      method: "GET",
      mode: "cors",
      credentials: "omit",
      cache: "no-store",
    })
      .then(function (r) {
        if (!r || !r.ok) return null;
        return r.json();
      })
      .then(function (json) {
        if (!json || !json.fields) return null;
        var data = flattenFirestoreFields(json.fields);
        writeCache(slug, data);
        applyMeta(data);
        return data;
      })
      .catch(function () {
        return null;
      });
  }

  // ------------------------------------------------------------------
  // Service worker registration (PWA)
  // ------------------------------------------------------------------
  function registerServiceWorker() {
    try {
      if (!("serviceWorker" in navigator)) return;
      // Skip on file:// (Android WebView assets) and non-https in production
      if (location.protocol !== "https:" && location.hostname !== "localhost")
        return;
      window.addEventListener("load", function () {
        navigator.serviceWorker
          .register("/service-worker.js")
          .catch(function () {
            /* failsafe: ignore */
          });
      });
    } catch (_) {}
  }

  function wireInstallEvent() {
    try {
      window.addEventListener("beforeinstallprompt", function (e) {
        try {
          e.preventDefault();
          window.__rrPwaInstallPrompt = e;
          var ev = new CustomEvent("rr:pwa-installable", { detail: e });
          window.dispatchEvent(ev);
        } catch (_) {}
      });
    } catch (_) {}
  }

  // ------------------------------------------------------------------
  // SEO audit hook (?seo_audit=1) — posts result back to localStorage so
  // the admin Meta Tags editor can poll for it.
  // ------------------------------------------------------------------
  function maybeRunAudit() {
    try {
      var qs = new URLSearchParams(location.search || "");
      if (qs.get("seo_audit") !== "1") return;
      var slug = getSlug();
      window.addEventListener("load", function () {
        setTimeout(function () {
          try {
            var checks = [];
            var title = (document.title || "").trim();
            checks.push({
              key: "title",
              ok: title.length >= 30 && title.length <= 70,
              msg: "Title length " + title.length + " (target 30–70)",
              value: title,
            });
            var md =
              (document.querySelector('meta[name="description"]') &&
                document
                  .querySelector('meta[name="description"]')
                  .getAttribute("content")) ||
              "";
            checks.push({
              key: "description",
              ok: md.length >= 70 && md.length <= 160,
              msg: "Meta description " + md.length + " (target 70–160)",
              value: md,
            });
            checks.push({
              key: "h1",
              ok: document.querySelectorAll("h1").length === 1,
              msg: "H1 count " + document.querySelectorAll("h1").length,
            });
            var imgs = Array.from(document.querySelectorAll("img"));
            var missingAlt = imgs.filter(function (i) {
              return !((i.getAttribute("alt") || "").trim());
            }).length;
            checks.push({
              key: "alt",
              ok: missingAlt === 0,
              msg: missingAlt + "/" + imgs.length + " images missing alt",
            });
            checks.push({
              key: "canonical",
              ok: !!document.querySelector('link[rel="canonical"]'),
              msg: document.querySelector('link[rel="canonical"]')
                ? "Canonical present"
                : "Canonical missing",
            });
            checks.push({
              key: "og:image",
              ok: !!document.querySelector('meta[property="og:image"]'),
              msg: document.querySelector('meta[property="og:image"]')
                ? "og:image present"
                : "og:image missing",
            });
            var score = Math.round(
              (checks.filter(function (c) {
                return c.ok;
              }).length /
                checks.length) *
                100
            );
            var payload = {
              slug: slug,
              url: location.href,
              ts: Date.now(),
              score: score,
              checks: checks,
            };
            try {
              localStorage.setItem(
                "rr_seo_audit_" + slug,
                JSON.stringify(payload)
              );
            } catch (_) {}
          } catch (_) {}
        }, 600);
      });
    } catch (_) {}
  }

  // Kick off
  try {
    var slug = getSlug();
    fetchMeta(slug);
    registerServiceWorker();
    wireInstallEvent();
    maybeRunAudit();
  } catch (_) {
    /* failsafe */
  }
})();
