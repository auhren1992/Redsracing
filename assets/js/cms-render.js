// Lightweight CMS renderer for pages/sections
// Renders CMS content on top of existing static page; falls back to static if no data

import { getFirebaseDb } from './firebase-core.js';
import {
  getFirestore,
  doc,
  getDoc,
  collection,
  getDocs,
  query,
  orderBy,
} from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';

async function loadPage(slug) {
  try {
    const db = getFirebaseDb ? getFirebaseDb() : getFirestore();
    const pageRef = doc(db, 'pages', slug);
    const pageSnap = await getDoc(pageRef);
    if (!pageSnap.exists()) return null;
    const sectionsRef = collection(db, 'pages', slug, 'sections');
    const snap = await getDocs(query(sectionsRef, orderBy('order', 'asc')));
    const sections = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return { page: pageSnap.data(), sections };
  } catch (e) {
    console.warn('[CMS] loadPage failed', e);
    return null;
  }
}

function applyHero(sec) {
  // Target existing Kids Hero if present
  const hero = document.getElementById('jonny-kids-hero');
  if (!hero) return;
  if (sec.data?.title) {
    const h = hero.querySelector('h1');
    if (h) h.innerHTML = sec.data.title;
  }
  if (sec.data?.subtitle) {
    const p = hero.querySelector('p');
    if (p) p.textContent = sec.data.subtitle;
  }
  if (sec.data?.imageUrl) {
    // update bg overlay and inline img if present
    hero.style.setProperty('--cms-hero', `url('${sec.data.imageUrl}')`);
    const img = hero.querySelector('img');
    if (img) img.src = sec.data.imageUrl;
  }
}

function applyTrackTips(sec) {
  const panel = document.getElementById('track-tips');
  if (!panel) return;
  if (Array.isArray(sec.data?.tips) && sec.data.tips.length) {
    // Replace existing tips grid with CMS tips
    const container = panel.querySelector('.grid');
    if (!container) return;
    container.innerHTML = '';
    sec.data.tips.forEach(t => {
      const card = document.createElement('div');
      card.className = 'quiz-card';
      card.innerHTML = `<div class="text-white font-extrabold mb-1"><i class="fas fa-lightbulb text-yellow-400 mr-2"></i>${t.title||'Tip'}</div><p class="text-slate-300 text-sm">${t.body||''}</p>`;
      container.appendChild(card);
    });
  }
}

function applyQuiz(sec) {
  // If quiz questions are provided, we can inject into the global quiz list before jonny-kids.js renders.
  // For now, we attach to window to let the existing quiz use them if it looks for overrides.
  if (Array.isArray(sec.data?.questions)) {
    window.__JONNY_CMS_QUIZ__ = sec.data.questions;
  }
}

async function initCMS() {
  const body = document.body;
  const slug = body.getAttribute('data-cms-page') || 'jonny';
  const res = await loadPage(slug);
  if (!res || !res.sections || res.sections.length === 0) return; // fallback to static

  // Mark CMS active (optional styling hooks)
  body.classList.add('cms-active');

  res.sections.forEach(sec => {
    switch ((sec.type||'').toLowerCase()) {
      case 'hero':
        applyHero(sec);
        break;
      case 'tracktips':
        applyTrackTips(sec);
        break;
      case 'quiz':
        applyQuiz(sec);
        break;
      default:
        break;
    }
  });
}

window.addEventListener('DOMContentLoaded', initCMS);
