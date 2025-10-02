// Root videos.js: dynamically load TikTok embeds based on Firestore config
// This file uses Firebase CDN modules directly (no bundler required)

(async function () {
  'use strict';

  const FIREBASE_CONFIG = {
    apiKey: "AIzaSyARFiFCadGKFUc_s6x3qNX8F4jsVawkzVg",
    authDomain: "redsracing-a7f8b.firebaseapp.com",
    projectId: "redsracing-a7f8b",
    storageBucket: "redsracing-a7f8b.firebasestorage.app",
    messagingSenderId: "517034606151",
    appId: "1:517034606151:web:24cae262e1d98832757b62",
  };

  function getVideoIdFromUrl(url) {
    try {
      const u = new URL(url);
      // Expect .../video/{id}
      const m = u.pathname.match(/\/video\/(\d+)/);
      return m ? m[1] : null;
    } catch (_) {
      return null;
    }
  }

  function insertTikTokScript() {
    if (document.getElementById('tiktok-embed-js')) return;
    const s = document.createElement('script');
    s.id = 'tiktok-embed-js';
    s.src = 'https://www.tiktok.com/embed.js';
    s.async = true;
    document.body.appendChild(s);
  }

  function clearYouTubeFallback() {
    const grid = document.getElementById('video-grid');
    if (!grid) return;
    // Hide any existing iframes (YouTube cards)
    grid.querySelectorAll('iframe').forEach((el) => {
      const card = el.closest('.modern-card');
      if (card) {
        card.style.display = 'none';
      } else {
        el.style.display = 'none';
      }
    });
  }

  function showInfo(msg) {
    const embeds = document.getElementById('tiktok-embeds');
    if (!embeds) return;
    const p = document.createElement('p');
    p.className = 'text-slate-400 col-span-full text-center';
    p.textContent = msg;
    embeds.appendChild(p);
  }

  async function ensureApp() {
    const { initializeApp, getApps } = await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js');
    if (getApps().length === 0) initializeApp(FIREBASE_CONFIG);
  }

  async function loadConfig() {
    try {
      await ensureApp();
      const { getFirestore, doc, getDoc, collection, getDocs, orderBy, query } = await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js');
      const db = getFirestore();
      // Try collection of videos first
      let videos = [];
      try {
        const q = query(collection(db, 'tiktok_videos'), orderBy('createdAt', 'desc'));
        const snapCol = await getDocs(q);
        videos = snapCol.docs.map(d => ({ id: d.id, ...(d.data() || {}) }));
      } catch (_) {}
      // Single config doc as fallback for TikTok
      let tiktokConfig = {};
      try {
        const snap = await getDoc(doc(db, 'config', 'tiktok'));
        if (snap.exists()) tiktokConfig = snap.data() || {};
      } catch (_) {}
      // Video display settings
      let videoSettings = {};
      try {
        const snapVs = await getDoc(doc(db, 'config', 'videos'));
        if (snapVs.exists()) videoSettings = snapVs.data() || {};
      } catch (_) {}
      return { videos, tiktokConfig, videoSettings };
    } catch (e) {
      return { videos: [], tiktokConfig: {}, videoSettings: {} };
    }
  }

  function renderMany(videos, tiktokConfig, videoSettings) {
    let renderedAny = false;
    if (Array.isArray(videos) && videos.length > 0) {
      for (const v of videos) {
        const ok = renderOne(v.sampleUrl || v.url || '', v.handle || tiktokConfig.handle || '', videoSettings);
        if (ok) renderedAny = true;
      }
    }
    if (!renderedAny && (tiktokConfig.sampleUrl || tiktokConfig.handle)) {
      const ok = renderOne(tiktokConfig.sampleUrl || '', tiktokConfig.handle || '', videoSettings);
      if (ok) renderedAny = true;
    }
    return renderedAny;
  }

  function renderOne(sampleUrl, handle, videoSettings) {
    const embeds = document.getElementById('tiktok-embeds');
    if (!embeds) return false;
    let rendered = false;

    if (sampleUrl) {
      const vid = getVideoIdFromUrl(sampleUrl);
      if (vid) {
        const block = document.createElement('blockquote');
        block.className = 'tiktok-embed';
        block.setAttribute('cite', sampleUrl);
        block.setAttribute('data-video-id', vid);
        // Apply admin-configured sizing
        const vs = videoSettings || {};
        const widthNum = Number(vs.width || 0);
        const heightNum = Number(vs.height || 0);
        if (vs.maxWidth) block.style.maxWidth = String(vs.maxWidth);
        else block.style.maxWidth = '100%';
        if (widthNum > 0) block.style.width = widthNum + 'px';
        if (heightNum > 0) block.style.height = heightNum + 'px';
        if (vs.aspect && CSS && CSS.supports && CSS.supports('aspect-ratio: 16/9')) {
          const parts = String(vs.aspect).split(':');
          if (parts.length === 2 && Number(parts[0])>0 && Number(parts[1])>0) {
            block.style.aspectRatio = `${Number(parts[0])}/${Number(parts[1])}`;
          }
        }
        // Sensible defaults if no settings
        if (!block.style.maxWidth) block.style.maxWidth = '605px';
        if (!block.style.minWidth) block.style.minWidth = '325px';
        const section = document.createElement('section');
        block.appendChild(section);
        embeds.appendChild(block);
        rendered = true;
      }
    }
    if (!rendered && handle) {
      const a = document.createElement('a');
      a.href = `https://www.tiktok.com/${handle.replace(/^@/, '')}`;
      a.target = '_blank';
      a.className = 'text-red-400 hover:text-red-300 underline';
      a.textContent = `View ${handle} on TikTok`;
      const wrap = document.createElement('div');
      wrap.className = 'col-span-full text-center';
      wrap.appendChild(a);
      embeds.appendChild(wrap);
      rendered = true;
    }
    if (rendered) insertTikTokScript();
    return rendered;
  }

  try {
    const { videos, tiktokConfig, videoSettings } = await loadConfig();
    const ok = renderMany(videos, tiktokConfig, videoSettings);
    if (ok) {
      clearYouTubeFallback();
    }
  } catch (_) {
    // Leave page as-is
  }
})();
