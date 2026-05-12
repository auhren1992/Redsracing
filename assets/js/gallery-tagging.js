/*!
 * gallery-tagging.js — shared photo upload tagging (caption / altText / tags)
 *
 * Self-mounts on any page that has #photo-upload-input. Injects a small
 * panel beneath the file picker with three inputs:
 *   - caption     (text, ≤240)
 *   - altText     (text, ≤120, REQUIRED — empty submits are blocked)
 *   - tags        (chip-style multi-select, autocomplete from config/photo_tags)
 *
 * Also exposes:
 *   window.RR_Tagging.collect()        -> { caption, altText, tags, width, height }
 *   window.RR_Tagging.validate()       -> { ok: boolean, error?: string }
 *   window.RR_Tagging.computeImageDimensions(file)
 *                                       -> Promise<{ width, height }>
 *   window.RR_Tagging.reset()          -> clear inputs
 *
 * Tag vocabulary is read from Firestore at config/photo_tags (field "tags").
 */
(function () {
  "use strict";
  if (window.RR_Tagging) return;

  var DEFAULT_VOCAB = [
    "#8",
    "#88",
    "podium",
    "qualifying",
    "crew",
    "sponsor",
    "behind-the-scenes",
    "kart",
    "track-day",
    "weather",
    "milestone",
    "family",
    "sponsor-day",
  ];

  var MAX_TAGS = 8;
  var state = {
    tags: [],
    vocab: DEFAULT_VOCAB.slice(),
    vocabLoaded: false,
    mounted: false,
    cachedDims: null,
  };

  function styles() {
    if (document.getElementById("rr-tagging-styles")) return;
    var s = document.createElement("style");
    s.id = "rr-tagging-styles";
    s.textContent =
      ".rr-tagging{margin-top:14px;padding:14px;border:1px solid rgba(148,163,184,0.18);border-radius:12px;background:rgba(15,23,42,0.45);color:#e2e8f0;display:flex;flex-direction:column;gap:10px}" +
      ".rr-tagging label{display:block;font-size:0.75rem;font-weight:700;color:#cbd5e1;letter-spacing:0.04em;text-transform:uppercase;margin-bottom:4px}" +
      ".rr-tagging input.rr-input,.rr-tagging textarea.rr-input{width:100%;background:rgba(15,23,42,0.7);border:1px solid rgba(148,163,184,0.25);border-radius:8px;padding:8px 10px;color:#fff;font-size:0.9rem;outline:none}" +
      ".rr-tagging input.rr-input:focus,.rr-tagging textarea.rr-input:focus{border-color:#fbbf24}" +
      ".rr-tagging .rr-helper{font-size:0.7rem;color:#94a3b8;margin-top:3px}" +
      ".rr-tagging .rr-helper.rr-err{color:#f87171}" +
      ".rr-chips{display:flex;flex-wrap:wrap;gap:6px;min-height:32px;padding:6px 8px;background:rgba(15,23,42,0.55);border:1px solid rgba(148,163,184,0.25);border-radius:8px}" +
      ".rr-chip{display:inline-flex;align-items:center;gap:4px;background:rgba(251,191,36,0.18);color:#fde68a;border:1px solid rgba(251,191,36,0.4);padding:3px 8px;border-radius:999px;font-size:0.75rem;font-weight:600}" +
      ".rr-chip button{background:none;border:none;color:inherit;cursor:pointer;font-size:0.85rem;line-height:1;padding:0 0 0 4px}" +
      ".rr-chip-input{flex:1;min-width:120px;background:transparent;border:none;outline:none;color:#fff;font-size:0.85rem}" +
      ".rr-suggest{position:relative}" +
      ".rr-suggest-list{position:absolute;top:100%;left:0;right:0;background:#0f172a;border:1px solid rgba(148,163,184,0.25);border-top:none;border-radius:0 0 8px 8px;max-height:160px;overflow:auto;z-index:50;display:none}" +
      ".rr-suggest-list.open{display:block}" +
      ".rr-suggest-item{padding:6px 10px;font-size:0.85rem;cursor:pointer;color:#e2e8f0}" +
      ".rr-suggest-item:hover,.rr-suggest-item.active{background:rgba(251,191,36,0.15);color:#fde68a}";
    document.head.appendChild(s);
  }

  function loadVocab() {
    if (state.vocabLoaded) return Promise.resolve(state.vocab);
    return fetch(
      "https://firestore.googleapis.com/v1/projects/redsracing-a7f8b/databases/(default)/documents/config/photo_tags",
      { method: "GET", credentials: "omit", cache: "no-store" }
    )
      .then(function (r) {
        return r && r.ok ? r.json() : null;
      })
      .then(function (json) {
        try {
          var arr =
            json &&
            json.fields &&
            json.fields.tags &&
            json.fields.tags.arrayValue &&
            json.fields.tags.arrayValue.values;
          if (Array.isArray(arr)) {
            state.vocab = arr
              .map(function (v) {
                return v && v.stringValue;
              })
              .filter(Boolean);
          }
        } catch (_) {}
        state.vocabLoaded = true;
        return state.vocab;
      })
      .catch(function () {
        state.vocabLoaded = true;
        return state.vocab;
      });
  }

  function findHost() {
    var anchor = document.getElementById("photo-upload-input");
    if (!anchor) return null;
    // Walk up to find a sensible block container; default = anchor's parent.
    var host = anchor.closest("label") || anchor.parentElement || null;
    return host;
  }

  function buildPanel() {
    var div = document.createElement("div");
    div.className = "rr-tagging";
    div.innerHTML =
      '<div>' +
      '  <label for="rr-caption">Caption <span class="text-slate-500">(optional, ≤240)</span></label>' +
      '  <input id="rr-caption" class="rr-input" maxlength="240" placeholder="Quick description: track, lap, moment…" />' +
      '</div>' +
      '<div>' +
      '  <label for="rr-alt">Alt text <span class="text-red-400">*</span> <span class="text-slate-500">(required, ≤120)</span></label>' +
      '  <input id="rr-alt" class="rr-input" maxlength="120" placeholder="Describe what\'s in the photo for screen readers" />' +
      '  <div class="rr-helper" id="rr-alt-help">Required — describe what\'s in the photo for screen readers.</div>' +
      '</div>' +
      '<div>' +
      '  <label>Tags <span class="text-slate-500">(up to 8)</span></label>' +
      '  <div class="rr-suggest">' +
      '    <div class="rr-chips" id="rr-chips">' +
      '      <input id="rr-tag-input" class="rr-chip-input" placeholder="Type a tag, hit Enter…" autocomplete="off" />' +
      '    </div>' +
      '    <div class="rr-suggest-list" id="rr-suggest-list" role="listbox"></div>' +
      '  </div>' +
      '  <div class="rr-helper" id="rr-tag-help">Pick from suggestions or type your own (kart, podium, sponsor, etc.).</div>' +
      '</div>';
    return div;
  }

  function renderChips() {
    var chips = document.getElementById("rr-chips");
    if (!chips) return;
    Array.from(chips.querySelectorAll(".rr-chip")).forEach(function (el) {
      el.remove();
    });
    var input = chips.querySelector(".rr-chip-input");
    state.tags.forEach(function (t) {
      var c = document.createElement("span");
      c.className = "rr-chip";
      c.textContent = t;
      var x = document.createElement("button");
      x.type = "button";
      x.setAttribute("aria-label", "Remove " + t);
      x.textContent = "×";
      x.addEventListener("click", function () {
        removeTag(t);
      });
      c.appendChild(x);
      chips.insertBefore(c, input);
    });
  }

  function addTag(raw) {
    var t = String(raw || "")
      .trim()
      .toLowerCase()
      .replace(/^#+/, "#")
      .slice(0, 32);
    if (!t) return;
    if (state.tags.length >= MAX_TAGS) return;
    if (state.tags.indexOf(t) !== -1) return;
    state.tags.push(t);
    renderChips();
  }

  function removeTag(t) {
    state.tags = state.tags.filter(function (x) {
      return x !== t;
    });
    renderChips();
  }

  function renderSuggestions(filter) {
    var list = document.getElementById("rr-suggest-list");
    if (!list) return;
    var q = (filter || "").toLowerCase();
    var matches = state.vocab
      .filter(function (v) {
        return state.tags.indexOf(v) === -1 && v.toLowerCase().indexOf(q) !== -1;
      })
      .slice(0, 8);
    if (!matches.length) {
      list.classList.remove("open");
      list.innerHTML = "";
      return;
    }
    list.innerHTML = matches
      .map(function (m, i) {
        return (
          '<div class="rr-suggest-item' +
          (i === 0 ? " active" : "") +
          '" data-tag="' +
          m +
          '">' +
          m +
          "</div>"
        );
      })
      .join("");
    list.classList.add("open");
    Array.from(list.querySelectorAll(".rr-suggest-item")).forEach(function (el) {
      el.addEventListener("mousedown", function (e) {
        e.preventDefault();
        addTag(el.getAttribute("data-tag"));
        var input = document.getElementById("rr-tag-input");
        if (input) input.value = "";
        renderSuggestions("");
      });
    });
  }

  function bindEvents() {
    var input = document.getElementById("rr-tag-input");
    if (!input) return;
    input.addEventListener("input", function () {
      renderSuggestions(input.value);
    });
    input.addEventListener("focus", function () {
      renderSuggestions(input.value);
    });
    input.addEventListener("blur", function () {
      setTimeout(function () {
        var list = document.getElementById("rr-suggest-list");
        if (list) list.classList.remove("open");
      }, 150);
    });
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === ",") {
        e.preventDefault();
        var v = input.value.trim();
        if (v) addTag(v);
        input.value = "";
        renderSuggestions("");
      } else if (e.key === "Backspace" && !input.value && state.tags.length) {
        e.preventDefault();
        state.tags.pop();
        renderChips();
      }
    });

    var alt = document.getElementById("rr-alt");
    if (alt) {
      alt.addEventListener("input", function () {
        var help = document.getElementById("rr-alt-help");
        if (!help) return;
        if (alt.value.trim()) {
          help.textContent = "Looks good.";
          help.classList.remove("rr-err");
        } else {
          help.textContent =
            "Required — describe what's in the photo for screen readers.";
          help.classList.add("rr-err");
        }
      });
    }
  }

  function mount() {
    if (state.mounted) return true;
    var host = findHost();
    if (!host) return false;
    styles();
    var panel = buildPanel();
    // Insert after the upload control's enclosing block. Prefer the nearest
    // grid/parent so we don't break flex layouts.
    var anchor = host.parentElement || host;
    anchor.parentNode.insertBefore(panel, anchor.nextSibling);
    state.mounted = true;
    bindEvents();
    renderChips();
    loadVocab();
    return true;
  }

  function reset() {
    state.tags = [];
    state.cachedDims = null;
    ["rr-caption", "rr-alt", "rr-tag-input"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.value = "";
    });
    var help = document.getElementById("rr-alt-help");
    if (help) {
      help.textContent =
        "Required — describe what's in the photo for screen readers.";
      help.classList.remove("rr-err");
    }
    renderChips();
  }

  function collect() {
    var caption = "";
    var altText = "";
    var capEl = document.getElementById("rr-caption");
    var altEl = document.getElementById("rr-alt");
    if (capEl) caption = String(capEl.value || "").trim();
    if (altEl) altText = String(altEl.value || "").trim();
    return {
      caption: caption,
      altText: altText,
      tags: state.tags.slice(0),
      width: state.cachedDims ? state.cachedDims.width : null,
      height: state.cachedDims ? state.cachedDims.height : null,
    };
  }

  function validate() {
    var altEl = document.getElementById("rr-alt");
    var altText = altEl ? String(altEl.value || "").trim() : "";
    if (!altText) {
      var help = document.getElementById("rr-alt-help");
      if (help) {
        help.textContent =
          "Alt text is required — describe what's in the photo for screen readers.";
        help.classList.add("rr-err");
      }
      if (altEl) {
        try {
          altEl.focus();
        } catch (_) {}
      }
      return { ok: false, error: "Alt text is required." };
    }
    if (altText.length > 120) {
      return { ok: false, error: "Alt text must be 120 characters or fewer." };
    }
    return { ok: true };
  }

  function computeImageDimensions(file) {
    return new Promise(function (resolve) {
      if (!file) return resolve({ width: null, height: null });
      try {
        var url = URL.createObjectURL(file);
        var img = new Image();
        img.onload = function () {
          var dims = { width: img.naturalWidth || null, height: img.naturalHeight || null };
          state.cachedDims = dims;
          try {
            URL.revokeObjectURL(url);
          } catch (_) {}
          resolve(dims);
        };
        img.onerror = function () {
          state.cachedDims = { width: null, height: null };
          resolve(state.cachedDims);
        };
        img.src = url;
      } catch (_) {
        resolve({ width: null, height: null });
      }
    });
  }

  function ensureMounted() {
    if (state.mounted) return;
    if (!mount()) {
      var tries = 0;
      var t = setInterval(function () {
        tries++;
        if (mount() || tries > 20) clearInterval(t);
      }, 250);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ensureMounted);
  } else {
    ensureMounted();
  }

  window.RR_Tagging = {
    mount: mount,
    reset: reset,
    collect: collect,
    validate: validate,
    computeImageDimensions: computeImageDimensions,
    setVocab: function (arr) {
      if (Array.isArray(arr)) state.vocab = arr.slice();
    },
  };
})();
