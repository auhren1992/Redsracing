/*!
 * site-search.js — RedsRacing site-wide search modal
 *
 * Cmd/Ctrl+K (or `/` when focus is outside an input) opens a modal overlay.
 * Lazy-loads /data/search-index.json on first open. Tiny in-memory ranked
 * search (token match + title weight; no library).
 *
 * Keyboard: up/down/enter/escape. Esc / click-outside closes.
 */
(function () {
  "use strict";

  if (window.__rrSiteSearchLoaded) return;
  window.__rrSiteSearchLoaded = true;

  var INDEX_URL = "/data/search-index.json";
  var index = null;
  var indexLoading = null;
  var modal = null;
  var input = null;
  var results = null;
  var selectedIdx = 0;

  function injectStyles() {
    if (document.getElementById("rr-search-styles")) return;
    var s = document.createElement("style");
    s.id = "rr-search-styles";
    s.textContent =
      ".rr-search-backdrop{position:fixed;inset:0;z-index:9999;background:rgba(2,3,6,0.78);backdrop-filter:blur(8px);display:none;align-items:flex-start;justify-content:center;padding:8vh 16px}" +
      ".rr-search-backdrop.open{display:flex}" +
      ".rr-search-panel{width:100%;max-width:640px;background:linear-gradient(145deg,rgba(30,41,59,0.95),rgba(15,23,42,0.98));border:1px solid rgba(251,191,36,0.25);border-radius:14px;box-shadow:0 16px 56px rgba(0,0,0,0.6);color:#e2e8f0;overflow:hidden;font-family:Inter,system-ui,sans-serif}" +
      ".rr-search-head{display:flex;align-items:center;gap:10px;padding:14px 16px;border-bottom:1px solid rgba(148,163,184,0.15)}" +
      ".rr-search-head .rr-icon{color:#fbbf24}" +
      ".rr-search-input{flex:1;background:transparent;border:none;outline:none;color:#fff;font-size:1.05rem;letter-spacing:0.01em}" +
      ".rr-search-hint{font-size:0.75rem;color:#94a3b8;border:1px solid rgba(148,163,184,0.25);padding:2px 6px;border-radius:4px}" +
      ".rr-search-list{max-height:60vh;overflow:auto;padding:6px 0}" +
      ".rr-search-item{display:block;padding:10px 16px;cursor:pointer;border-left:3px solid transparent;text-decoration:none;color:#e2e8f0}" +
      ".rr-search-item.active,.rr-search-item:hover{background:rgba(251,191,36,0.08);border-left-color:#fbbf24}" +
      ".rr-search-title{font-weight:700;color:#fff;font-size:0.95rem}" +
      ".rr-search-desc{font-size:0.8rem;color:#94a3b8;margin-top:2px;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}" +
      ".rr-search-empty{padding:24px;text-align:center;color:#64748b;font-size:0.9rem}";
    document.head.appendChild(s);
  }

  function buildModal() {
    if (modal) return;
    injectStyles();
    modal = document.createElement("div");
    modal.className = "rr-search-backdrop";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-label", "Site search");
    modal.innerHTML =
      '<div class="rr-search-panel" role="document">' +
      '  <div class="rr-search-head">' +
      '    <span class="rr-icon" aria-hidden="true">' +
      '      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>' +
      "    </span>" +
      '    <input type="text" class="rr-search-input" placeholder="Search the RedsRacing site…" autocomplete="off" aria-label="Search" />' +
      '    <span class="rr-search-hint">Esc</span>' +
      "  </div>" +
      '  <div class="rr-search-list" role="listbox" aria-label="Search results"></div>' +
      "</div>";
    document.body.appendChild(modal);
    input = modal.querySelector(".rr-search-input");
    results = modal.querySelector(".rr-search-list");

    modal.addEventListener("click", function (e) {
      if (e.target === modal) close();
    });
    input.addEventListener("input", render);
    input.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        moveSelection(1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        moveSelection(-1);
      } else if (e.key === "Enter") {
        e.preventDefault();
        var active = results.querySelector(".rr-search-item.active");
        if (active && active.href) location.href = active.href;
      }
    });
  }

  function loadIndex() {
    if (index) return Promise.resolve(index);
    if (indexLoading) return indexLoading;
    indexLoading = fetch(INDEX_URL, { cache: "force-cache" })
      .then(function (r) {
        return r && r.ok ? r.json() : [];
      })
      .then(function (data) {
        index = Array.isArray(data) ? data : data && data.pages ? data.pages : [];
        return index;
      })
      .catch(function () {
        index = [];
        return index;
      });
    return indexLoading;
  }

  function tokenize(s) {
    return (s || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter(Boolean);
  }

  function score(item, qTokens) {
    if (!qTokens.length) return 0;
    var titleText = (item.title || "").toLowerCase();
    var descText = (item.description || "").toLowerCase();
    var bodyText = (item.body || "").toLowerCase();
    var total = 0;
    for (var i = 0; i < qTokens.length; i++) {
      var t = qTokens[i];
      if (!t) continue;
      var hit = false;
      if (titleText.indexOf(t) !== -1) {
        total += 10;
        if (titleText.split(/\s+/).indexOf(t) !== -1) total += 4;
        hit = true;
      }
      if (descText.indexOf(t) !== -1) {
        total += 4;
        hit = true;
      }
      if (bodyText.indexOf(t) !== -1) {
        total += 1;
        hit = true;
      }
      if (!hit) return 0; // every token must match somewhere
    }
    return total;
  }

  function moveSelection(delta) {
    var items = Array.from(results.querySelectorAll(".rr-search-item"));
    if (!items.length) return;
    selectedIdx = (selectedIdx + delta + items.length) % items.length;
    items.forEach(function (el, i) {
      el.classList.toggle("active", i === selectedIdx);
      if (i === selectedIdx) {
        try {
          el.scrollIntoView({ block: "nearest" });
        } catch (_) {}
      }
    });
  }

  function render() {
    if (!results || !index) return;
    var q = (input.value || "").trim();
    var qTokens = tokenize(q);
    results.innerHTML = "";
    if (!q) {
      var hints = index.slice(0, 8);
      hints.forEach(function (item, i) {
        results.appendChild(renderItem(item, i === 0));
      });
      selectedIdx = 0;
      return;
    }
    var ranked = index
      .map(function (item) {
        return { item: item, s: score(item, qTokens) };
      })
      .filter(function (r) {
        return r.s > 0;
      })
      .sort(function (a, b) {
        return b.s - a.s;
      })
      .slice(0, 20);
    if (!ranked.length) {
      results.innerHTML =
        '<div class="rr-search-empty">No matches for "' +
        escapeHtml(q) +
        '". Try a different keyword.</div>';
      selectedIdx = -1;
      return;
    }
    ranked.forEach(function (r, i) {
      results.appendChild(renderItem(r.item, i === 0));
    });
    selectedIdx = 0;
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderItem(item, active) {
    var a = document.createElement("a");
    a.className = "rr-search-item" + (active ? " active" : "");
    a.href = item.url || "/" + (item.slug || "") + ".html";
    a.setAttribute("role", "option");
    a.innerHTML =
      '<div class="rr-search-title">' +
      escapeHtml(item.title || item.slug || "Untitled") +
      "</div>" +
      (item.description
        ? '<div class="rr-search-desc">' + escapeHtml(item.description) + "</div>"
        : "");
    return a;
  }

  function open() {
    buildModal();
    loadIndex().then(function () {
      modal.classList.add("open");
      try {
        input.value = "";
        input.focus();
      } catch (_) {}
      render();
    });
  }

  function close() {
    if (modal) modal.classList.remove("open");
  }

  function isEditable(el) {
    if (!el) return false;
    var tag = (el.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") return true;
    if (el.isContentEditable) return true;
    return false;
  }

  window.addEventListener("keydown", function (e) {
    var meta = e.ctrlKey || e.metaKey;
    if (meta && (e.key === "k" || e.key === "K")) {
      e.preventDefault();
      open();
      return;
    }
    if (e.key === "/" && !meta && !isEditable(document.activeElement)) {
      e.preventDefault();
      open();
      return;
    }
    if (e.key === "Escape" && modal && modal.classList.contains("open")) {
      e.preventDefault();
      close();
    }
  });

  // Public API for any future UI button
  window.rrOpenSearch = open;
})();
