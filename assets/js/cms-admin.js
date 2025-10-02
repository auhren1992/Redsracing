// Minimal CMS admin: injects a Jonny page editor into admin console
import { getFirebaseDb } from './firebase-core.js';
import {
  getFirestore,
  doc,
  setDoc,
  collection,
  addDoc,
} from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';

function ensurePanel() {
  const container = document.getElementById('dashboard-content') || document.querySelector('main .p-4');
  if (!container) return null;
  let existing = document.getElementById('cms-pages-panel');
  if (existing) return existing;
  const wrap = document.createElement('div');
  wrap.id = 'cms-pages-panel';
  wrap.className = 'admin-card rounded-xl p-6';
  wrap.innerHTML = `
    <h3 class="text-xl font-bold text-white mb-4"><i class="fas fa-pen-to-square text-yellow-400 mr-2"></i> Page Manager (CMS)</h3>
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div>
        <label class="block text-sm font-medium text-slate-300 mb-1">Page Slug</label>
        <input id="cms-page-slug" class="modern-input w-full p-3 text-white" value="jonny" />
      </div>
      <div>
        <label class="block text-sm font-medium text-slate-300 mb-1">Hero Title (HTML allowed)</label>
        <input id="cms-hero-title" class="modern-input w-full p-3 text-white" placeholder="Jonny <span class='neon-red'>Kirsch</span>" />
      </div>
      <div>
        <label class="block text-sm font-medium text-slate-300 mb-1">Hero Subtitle</label>
        <input id="cms-hero-subtitle" class="modern-input w-full p-3 text-white" placeholder="The Next Generation of Speed" />
      </div>
      <div>
        <label class="block text-sm font-medium text-slate-300 mb-1">Hero Image URL</label>
        <input id="cms-hero-image" class="modern-input w-full p-3 text-white" placeholder="assets/images/jonny-hero3.jpg" />
      </div>
    </div>
    <div class="mt-4 flex gap-2">
      <button id="cms-save-hero" class="success-btn px-4 py-2 rounded-lg text-white font-semibold"><i class="fas fa-save mr-2"></i>Save Hero</button>
      <button id="cms-add-tracktips" class="modern-btn px-4 py-2 rounded-lg text-white font-semibold"><i class="fas fa-plus mr-2"></i>Add Track Tips Section</button>
    </div>
    <p class="text-slate-400 text-sm mt-2">Page content is public-read. Writes require admin role.</p>
  `;
  // Place CMS panel near the top of the dashboard
  if (container.firstChild) {
    container.insertBefore(wrap, container.firstChild);
  } else {
    container.appendChild(wrap);
  }
  return wrap;
}

async function saveHero() {
  try {
    const db = getFirebaseDb ? getFirebaseDb() : getFirestore();
    const slug = document.getElementById('cms-page-slug').value.trim() || 'jonny';
    const title = document.getElementById('cms-hero-title').value || '';
    const subtitle = document.getElementById('cms-hero-subtitle').value || '';
    const imageUrl = document.getElementById('cms-hero-image').value || '';

    // Upsert page
    await setDoc(doc(db, 'pages', slug), { updatedAt: new Date() }, { merge: true });
    // Create/update hero section at order 1 (simple approach: add new hero each time)
    await addDoc(collection(db, 'pages', slug, 'sections'), {
      type: 'hero',
      order: 1,
      data: { title, subtitle, imageUrl },
    });
    toast('Hero saved to CMS');
  } catch (e) {
    console.error(e); toast('Failed to save hero', 'error');
  }
}

async function addTrackTips() {
  try {
    const db = getFirebaseDb ? getFirebaseDb() : getFirestore();
    const slug = document.getElementById('cms-page-slug').value.trim() || 'jonny';
    await setDoc(doc(db, 'pages', slug), { updatedAt: new Date() }, { merge: true });
    await addDoc(collection(db, 'pages', slug, 'sections'), {
      type: 'trackTips',
      order: 2,
      data: {
        tips: [
          { title: 'Look Ahead', body: 'Eyes to apex and exit—car goes where you look.' },
          { title: 'Brake Straight', body: 'Do most braking before turn-in; release smoothly.' },
          { title: 'Smooth Inputs', body: 'Gentle hands and feet keep the car fast.' },
        ],
      },
    });
    toast('Track Tips section added');
  } catch (e) {
    console.error(e); toast('Failed to add Track Tips', 'error');
  }
}

function toast(msg, kind='info') {
  const el = document.getElementById('admin-toast');
  if (!el) return alert(msg);
  el.textContent = msg;
  el.classList.remove('hidden');
  el.style.borderColor = kind==='error' ? 'rgba(239,68,68,0.4)' : 'rgba(148,163,184,0.3)';
  setTimeout(() => el.classList.add('hidden'), 1800);
}

function initCMSAdmin() {
  const p = ensurePanel();
  if (!p) return;
  const saveBtn = p.querySelector('#cms-save-hero');
  const tipsBtn = p.querySelector('#cms-add-tracktips');
  if (saveBtn) saveBtn.addEventListener('click', saveHero);
  if (tipsBtn) tipsBtn.addEventListener('click', addTrackTips);
}

document.addEventListener('DOMContentLoaded', initCMSAdmin);
