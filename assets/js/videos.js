import "./app.js";

import { getFirebaseDb } from "./firebase-core.js";
import {
  getFirestore,
  collection,
  query,
  where,
  orderBy,
  getDocs,
  limit,
} from "firebase/firestore";

function createTikTokCard(url) {
  // Prefer iframe embed v2 to avoid extra script UI
  const safeUrl = typeof url === 'string' ? url : '';
  const idMatch = safeUrl.match(/\/(video|photo)\/(\d+)/);
  const videoId = idMatch ? idMatch[2] : '';
  const wrapper = document.createElement('div');
  wrapper.className = 'modern-card rounded-2xl overflow-hidden hover:scale-105 transition-all duration-500 group';
  const media = document.createElement('div');
  media.className = 'aspect-video relative bg-slate-800';
  if (videoId) {
    const iframe = document.createElement('iframe');
    iframe.src = `https://www.tiktok.com/embed/v2/${videoId}`; // lightweight embed
    iframe.setAttribute('frameborder', '0');
    iframe.setAttribute('allowfullscreen', '');
    iframe.setAttribute('loading', 'lazy');
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    media.appendChild(iframe);
  } else {
    // Fallback: simple link card if ID not parsed
    const link = document.createElement('a');
    link.href = safeUrl || 'https://www.tiktok.com/@redsracing';
    link.target = '_blank';
    link.className = 'absolute inset-0 flex items-center justify-center text-slate-300 underline';
    link.textContent = 'Open on TikTok';
    media.appendChild(link);
  }
  wrapper.appendChild(media);
  return wrapper;
}

async function loadTikToks() {
  const grid = document.getElementById('videos-grid');
  if (!grid) return;
  grid.innerHTML = '';
  let items = [];
  try {
    const db = getFirebaseDb();
    const parts = [collection(db, 'videos'), where('platform','==','tiktok'), where('published','==', true), orderBy('createdAt','desc'), limit(12)];
    const snap = await getDocs(query.apply(null, parts));
    items = snap.docs.map(d => d.data()?.url).filter(Boolean);
  } catch(_) {}

  // Fallback to data file if Firestore empty
  if (!items.length) {
    try {
      const res = await fetch('data/tiktok.json', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) items = data.filter(u => typeof u === 'string');
        else if (Array.isArray(data?.videos)) items = data.videos;
      }
    } catch(_) {}
  }

  if (!items.length) {
    const empty = document.createElement('div');
    empty.className = 'col-span-full text-center text-slate-400';
    empty.innerHTML = `No TikTok videos configured yet. Follow <a class="text-red-400 underline" href="https://www.tiktok.com/@redsracing" target="_blank">@redsracing</a>.`;
    grid.appendChild(empty);
    return;
  }

  items.forEach((url) => {
    try { grid.appendChild(createTikTokCard(url)); } catch(_){}
  });
}

document.addEventListener('DOMContentLoaded', loadTikToks);
