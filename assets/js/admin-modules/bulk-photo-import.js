/**
 * Admin Bulk Photo Importer — injects into #admin-extensions
 * Behind enable_bulk_importer flag.
 * Drag files → read EXIF date → match schedule → batch upload to Firebase Storage.
 * Uses browser-native ExifReader approach (Blob + DataView) for date extraction.
 */
(function () {
  'use strict';

  var _files = [];
  var _schedule = null;

  function init() {
    var rrf = window.RR && window.RR.flags;
    var flagP = rrf ? rrf.get('enable_bulk_importer', false) : Promise.resolve(false);
    flagP.then(function (enabled) {
      if (!enabled) return;

      var mount = document.getElementById('admin-extensions');
      if (!mount) return;

      var card = document.createElement('div');
      card.className = 'admin-card';
      card.id = 'panel-bulk-photo-import';
      card.innerHTML = `
        <div class="admin-card-header">
          <h3 class="admin-card-title"><i class="fas fa-images" style="color:#fbbf24"></i> Bulk Photo Importer</h3>
        </div>
        <div class="admin-card-body">
          <div id="bpi-drop-zone"
            style="border:2px dashed rgba(251,191,36,.4);border-radius:8px;padding:1.25rem;text-align:center;cursor:pointer;margin-bottom:.75rem;background:rgba(251,191,36,.04);">
            <i class="fas fa-cloud-upload-alt" style="color:#fbbf24;font-size:1.5rem;margin-bottom:.4rem;display:block;"></i>
            <div style="color:#94a3b8;font-size:.85rem;">Drag &amp; drop photos here, or <label for="bpi-file-input" style="color:#fbbf24;cursor:pointer;">browse files</label></div>
            <input id="bpi-file-input" type="file" accept="image/*" multiple style="display:none;" />
          </div>

          <div id="bpi-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:.5rem;max-height:240px;overflow-y:auto;margin-bottom:.75rem;"></div>

          <div id="bpi-batch-bar" style="display:none;margin-bottom:.5rem;">
            <label style="font-size:.78rem;color:#94a3b8;display:block;margin-bottom:.2rem;">Batch tags (applies to all)</label>
            <input id="bpi-batch-tags" type="text" placeholder="e.g. race, 2026, grundy"
              style="width:100%;background:#0d1a35;border:1px solid rgba(251,191,36,.3);color:#fff;padding:.35rem .6rem;border-radius:5px;font-size:.82rem;box-sizing:border-box;" />
          </div>

          <div style="display:flex;gap:.5rem;">
            <button id="bpi-upload-btn" class="btn btn-sm btn-primary" style="flex:1;display:none;">Upload All (<span id="bpi-count">0</span>)</button>
            <button id="bpi-clear-btn" class="btn btn-sm btn-secondary" style="flex:1;display:none;">Clear</button>
          </div>
          <div id="bpi-progress" style="margin-top:.5rem;font-size:.8rem;min-height:1.2em;"></div>
        </div>`;
      mount.appendChild(card);

      setupDrop();
      loadSchedule();

      document.getElementById('bpi-upload-btn').addEventListener('click', uploadAll);
      document.getElementById('bpi-clear-btn').addEventListener('click', clearAll);
    });
  }

  function setupDrop() {
    var zone = document.getElementById('bpi-drop-zone');
    var input = document.getElementById('bpi-file-input');
    if (!zone || !input) return;

    zone.addEventListener('click', function () { input.click(); });
    zone.addEventListener('dragover', function (e) { e.preventDefault(); zone.style.borderColor = '#fbbf24'; });
    zone.addEventListener('dragleave', function () { zone.style.borderColor = ''; });
    zone.addEventListener('drop', function (e) {
      e.preventDefault();
      zone.style.borderColor = '';
      addFiles(Array.from(e.dataTransfer.files).filter(function (f) { return f.type.startsWith('image/'); }));
    });
    input.addEventListener('change', function () {
      addFiles(Array.from(input.files));
      input.value = '';
    });
  }

  function loadSchedule() {
    fetch('/data/schedule.json').then(function (r) { return r.json(); }).then(function (s) {
      _schedule = s;
    }).catch(function () {});
  }

  function addFiles(newFiles) {
    newFiles.forEach(function (f) {
      if (_files.find(function (x) { return x.file.name === f.name && x.file.size === f.size; })) return;
      _files.push({ file: f, caption: '', tags: [], date: null, raceId: null });
    });
    processExif().then(renderGrid);
  }

  function processExif() {
    var promises = _files.map(function (item) {
      if (item.date) return Promise.resolve();
      return readExifDate(item.file).then(function (d) {
        item.date = d;
        if (d && _schedule) item.raceId = matchRace(d);
      }).catch(function () {});
    });
    return Promise.all(promises);
  }

  function readExifDate(file) {
    return new Promise(function (resolve) {
      var reader = new FileReader();
      reader.onload = function (e) {
        try {
          var buf = e.target.result;
          var view = new DataView(buf);
          // JPEG EXIF parsing — look for DateTimeOriginal (tag 0x9003)
          if (view.getUint16(0) !== 0xFFD8) return resolve(null);
          var offset = 2;
          while (offset < view.byteLength) {
            var marker = view.getUint16(offset);
            offset += 2;
            if (marker === 0xFFE1) {
              // APP1 — EXIF
              var segLen = view.getUint16(offset);
              var exifStart = offset + 2;
              var exifStr = String.fromCharCode.apply(null, new Uint8Array(buf, exifStart, 4));
              if (exifStr === 'Exif') {
                var tiffStart = exifStart + 6;
                var littleEndian = view.getUint16(tiffStart) === 0x4949;
                var getUint16 = function (o) { return view.getUint16(tiffStart + o, littleEndian); };
                var getUint32 = function (o) { return view.getUint32(tiffStart + o, littleEndian); };
                var ifd0 = getUint32(4);
                var numEntries = getUint16(ifd0);
                for (var i = 0; i < numEntries; i++) {
                  var entryOffset = ifd0 + 2 + i * 12;
                  var tag = getUint16(entryOffset);
                  if (tag === 0x8769) {
                    // ExifIFD pointer
                    var exifIFD = getUint32(entryOffset + 8);
                    var numEx = getUint16(exifIFD);
                    for (var j = 0; j < numEx; j++) {
                      var eOff = exifIFD + 2 + j * 12;
                      var eTag = getUint16(eOff);
                      if (eTag === 0x9003) { // DateTimeOriginal
                        var valOff = getUint32(eOff + 8);
                        var dateStr = String.fromCharCode.apply(null, new Uint8Array(buf, tiffStart + valOff, 19));
                        // "2026:05:25 10:30:00" → "2026-05-25"
                        var parts = dateStr.split(' ')[0].split(':');
                        if (parts.length === 3) return resolve(parts.join('-'));
                      }
                    }
                  }
                }
              }
              offset += segLen;
            } else if ((marker & 0xFF00) === 0xFF00) {
              offset += view.getUint16(offset);
            } else break;
          }
          resolve(null);
        } catch (_) { resolve(null); }
      };
      reader.readAsArrayBuffer(file.slice(0, 65536)); // read first 64KB only
    });
  }

  function matchRace(dateStr) {
    if (!_schedule || !dateStr) return null;
    var best = null, minDiff = Infinity;
    var d = new Date(dateStr + 'T00:00:00').getTime();
    for (var _i = 0; _i < (_schedule.seasons || []).length; _i++) {
      var season = _schedule.seasons[_i];
      for (var _j = 0; _j < (season.races || []).length; _j++) {
        var race = season.races[_j];
        var diff = Math.abs(new Date(race.date + 'T00:00:00').getTime() - d);
        if (diff < minDiff) { minDiff = diff; best = race; }
      }
    }
    if (!best || minDiff > 7 * 24 * 60 * 60 * 1000) return null;
    return best.date + '-' + (best.track || '').toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
  }

  function renderGrid() {
    var grid = document.getElementById('bpi-grid');
    var uploadBtn = document.getElementById('bpi-upload-btn');
    var clearBtn  = document.getElementById('bpi-clear-btn');
    var batchBar  = document.getElementById('bpi-batch-bar');
    var countEl   = document.getElementById('bpi-count');
    if (!grid) return;
    grid.innerHTML = '';
    if (!_files.length) {
      uploadBtn.style.display = 'none';
      clearBtn.style.display  = 'none';
      batchBar.style.display  = 'none';
      return;
    }
    countEl.textContent = _files.length;
    uploadBtn.style.display = 'block';
    clearBtn.style.display  = 'block';
    batchBar.style.display  = 'block';

    _files.forEach(function (item, i) {
      var url = URL.createObjectURL(item.file);
      var cell = document.createElement('div');
      cell.style.cssText = 'position:relative;border-radius:6px;overflow:hidden;aspect-ratio:1;background:#0d1a35;border:1px solid rgba(251,191,36,.15);';
      cell.innerHTML = `<img src="${url}" style="width:100%;height:100%;object-fit:cover;" />
        <div style="position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,.7);padding:.25rem .35rem;">
          <input class="bpi-caption" data-idx="${i}" type="text" placeholder="Caption…" value="${escHtml(item.caption)}"
            style="width:100%;background:transparent;border:none;color:#fff;font-size:.65rem;outline:none;" />
        </div>
        ${item.raceId ? '<div style="position:absolute;top:3px;right:3px;background:rgba(251,191,36,.9);color:#000;font-size:.6rem;padding:.1rem .3rem;border-radius:3px;">' + escHtml(item.raceId.substring(0, 10)) + '</div>' : ''}`;
      grid.appendChild(cell);
    });

    grid.querySelectorAll('.bpi-caption').forEach(function (inp) {
      inp.addEventListener('input', function () {
        _files[parseInt(inp.dataset.idx)].caption = inp.value;
      });
    });
  }

  function clearAll() {
    _files = [];
    renderGrid();
  }

  function uploadAll() {
    var db       = window.firebase && window.firebase.firestore && window.firebase.firestore();
    var storage  = window.firebase && window.firebase.storage && window.firebase.storage();
    var auth     = window.firebase && window.firebase.auth    && window.firebase.auth();
    var progress = document.getElementById('bpi-progress');
    var btn      = document.getElementById('bpi-upload-btn');
    if (!db || !storage) { progress.textContent = '✗ Firebase not ready'; return; }
    if (!_files.length)  { progress.textContent = '✗ No files'; return; }

    var batchTags = (document.getElementById('bpi-batch-tags').value || '').split(',').map(function (t) { return t.trim(); }).filter(Boolean);
    var uid = auth && auth.currentUser ? auth.currentUser.uid : 'admin';

    btn.disabled = true;
    var total = _files.length, done = 0, failed = 0;
    progress.style.color = '#fbbf24';
    progress.textContent = '0/' + total + ' uploaded…';

    _files.forEach(function (item) {
      var ext   = item.file.name.split('.').pop().toLowerCase();
      var id    = 'bulk_' + Date.now() + '_' + Math.random().toString(36).slice(2);
      var path  = 'gallery/' + id + '.' + ext;
      var ref   = storage.ref(path);
      ref.put(item.file).then(function () {
        return ref.getDownloadURL();
      }).then(function (url) {
        return db.collection('gallery_images').doc(id).set({
          url:          url,
          downloadURL:  url,
          fileName:     item.file.name,
          caption:      item.caption || '',
          altText:      item.caption || item.file.name,
          tags:         batchTags.concat(item.tags),
          raceId:       item.raceId || null,
          exifDate:     item.date   || null,
          uploaderUid:  uid,
          uploadedAt:   window.firebase.firestore.FieldValue.serverTimestamp(),
          source:       'bulk_import',
        });
      }).then(function () {
        done++;
        progress.textContent = done + '/' + total + ' uploaded…';
        if (done + failed === total) onAllDone();
      }).catch(function (e) {
        failed++;
        console.warn('[BulkImport] failed:', item.file.name, e);
        progress.textContent = done + '/' + total + ' (' + failed + ' failed)';
        if (done + failed === total) onAllDone();
      });
    });

    function onAllDone() {
      if (window.logAdminAction) logAdminAction('bulk_import.upload', total + ' images', { done: done, failed: failed });
      progress.style.color = failed ? '#f87171' : '#4ade80';
      progress.textContent = '✓ Done: ' + done + ' uploaded' + (failed ? ', ' + failed + ' failed' : '');
      btn.disabled = false;
      _files = [];
      renderGrid();
    }
  }

  function escHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
