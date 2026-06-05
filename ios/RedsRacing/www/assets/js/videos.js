import "./app.js";
import "./navigation.js";
import { getFirebaseDb } from "./firebase-core.js";
import { collection, getDocs, query, where, orderBy, limit } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

(function(){
  async function loadTikTokVideos() {
    try {
      const grid = document.getElementById('tiktok-embeds') || document.getElementById('video-grid');
      if (!grid) return;
      const db = getFirebaseDb();
      const q = query(
        collection(db, 'tiktok_videos'),
        where('published','==', true),
        orderBy('createdAt','desc'),
        limit(24)
      );
      const snap = await getDocs(q);
      if (snap.empty) {
        const p = document.createElement('p');
        p.className = 'text-slate-400';
        p.innerHTML = 'No videos yet. Follow <a class="text-neon-yellow underline" href="https://www.tiktok.com/@redsracing" target="_blank" rel="noopener">@redsracing</a> on TikTok.';
        grid.appendChild(p);
        return;
      }
      const frag = document.createDocumentFragment();
      snap.forEach(doc => {
        const v = doc.data() || {};
        const id = v.videoId || (String(v.url||'').match(/\/(video|photo)\/(\d{6,})/)||[])[2];
        if (!id) return;
        const wrap = document.createElement('div');
        wrap.className = 'rounded-xl overflow-hidden border border-slate-700/50 bg-black/30';
        wrap.innerHTML = `<iframe src="https://www.tiktok.com/embed/v2/${id}" width="100%" height="700" frameborder="0" allowfullscreen scrolling="no" loading="lazy"></iframe>`;
        frag.appendChild(wrap);
      });
      grid.appendChild(frag);
    } catch (e) {
      console.error('[Videos] Failed to load TikTok videos', e);
    }
  }
  document.addEventListener('DOMContentLoaded', loadTikTokVideos);
})();
