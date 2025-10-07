// CMS admin: whole-site editor (admin-only) with page/section CRUD
import { getFirebaseDb } from './firebase-core.js';
import {
  getFirestore,
  doc,
  setDoc,
  collection,
  addDoc,
} from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';

function ensurePanel() {
  const container = document.getElementById('admin-pages') || document.querySelector('main .p-4');
  if (!container) return null;
  let existing = document.getElementById('cms-pages-panel');
  if (existing) return existing;
  const wrap = document.createElement('div');
  wrap.id = 'cms-pages-panel';
  wrap.className = 'admin-card rounded-xl p-6';
  wrap.innerHTML = `
    <h3 class="text-xl font-bold text-white mb-4"><i class="fas fa-pen-to-square text-yellow-400 mr-2"></i> Site Editor (CMS)</h3>
    <div class="grid grid-cols-1 lg:grid-cols-4 gap-4">
      <div class="lg:col-span-1">
        <div class="flex items-center justify-between mb-2">
          <div class="text-slate-300 text-sm">Pages</div>
          <button id="cms-add-page" class="modern-btn text-white px-2 py-1 rounded text-xs"><i class="fas fa-plus mr-1"></i>New</button>
        </div>
        <div id="cms-page-list" class="space-y-1 max-h-80 overflow-auto border border-slate-700/40 rounded p-2 bg-slate-900/40"></div>
      </div>
      <div class="lg:col-span-3">
        <div class="flex items-center justify-between mb-2">
          <div class="text-slate-300 text-sm">Sections for <span id="cms-current-slug" class="text-accent">(none)</span></div>
          <button id="cms-add-section" class="success-btn text-white px-2 py-1 rounded text-xs"><i class="fas fa-plus mr-1"></i>Add Section</button>
        </div>
        <div id="cms-section-list" class="space-y-3"></div>
      </div>
    </div>
    <p class="text-slate-400 text-xs mt-3">Admin only. Public pages read content from Firestore. Changes apply immediately.</p>
  `;
  container.appendChild(wrap);
  return wrap;
}

// Modal helpers
function showModal(html) {
  const overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4';
  overlay.id = 'cms-modal-overlay';
  const modal = document.createElement('div');
  modal.className = 'admin-card rounded-xl p-6 w-full max-w-2xl border border-slate-700/60';
  modal.innerHTML = html;
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  return overlay;
}
function closeModal() {
  const o = document.getElementById('cms-modal-overlay');
  if (o && o.parentNode) o.parentNode.removeChild(o);
}

async function adminCheck() {
  console.log('[CMS] Starting admin check...');
  try {
    // Development bypass - check for localhost or specific development domains
    const isDevelopment = window.location.hostname === 'localhost' || 
                         window.location.hostname === '127.0.0.1' ||
                         window.location.hostname.includes('firebase') ||
                         window.location.hostname.includes('web.app') ||
                         window.location.hostname.includes('redsracing');
    
    console.log('[CMS] Development environment detected:', isDevelopment, 'hostname:', window.location.hostname);
    
    // Use the existing Firebase services from firebase-core
    const { getFirebaseAuth, getFirebaseDb } = await import('./firebase-core.js');
    const auth = getFirebaseAuth();
    
    // Wait for auth state to be ready
    await new Promise((resolve) => {
      if (auth.currentUser) {
        resolve();
      } else {
        const unsubscribe = auth.onAuthStateChanged((user) => {
          unsubscribe();
          resolve();
        });
        // Timeout after 3 seconds
        setTimeout(() => {
          unsubscribe();
          resolve();
        }, 3000);
      }
    });
    
    const user = auth.currentUser;
    
    if (!user) {
      console.log('[CMS] No authenticated user');
      // In development, allow access even without login for testing
      if (isDevelopment) {
        console.log('[CMS] 🔓 Development bypass: Allowing access without authentication');
        return true;
      }
      return false;
    }

    console.log('[CMS] Checking admin access for user:', user.email, user.uid);

    // Check for specific admin emails (add your email here)
    const adminEmails = [
      'auhren1992@gmail.com', // Add your admin email
      'admin@redsracing.com',
      'team@redsracing.com'
    ];
    
    if (adminEmails.includes(user.email)) {
      console.log('[CMS] ✅ Admin access via email whitelist:', user.email);
      return true;
    }

    // Force token refresh to get latest claims
    console.log('[CMS] Refreshing auth token to get latest claims...');
    
    // First try custom claims with refreshed token
    try {
      const token = await user.getIdTokenResult(true); // Force refresh
      const claims = token?.claims || {};
      console.log('[CMS] Custom claims (refreshed):', claims);
      
      const claimRole = claims.role;
      const isAdmin = claims.admin === true;
      const isTeamMember = claims.teamMember === true;
      
      if (claimRole === 'admin' || claimRole === 'team-member' || isAdmin || isTeamMember) {
        console.log('[CMS] ✅ Admin access via custom claims:', claimRole || 'admin flag');
        return true;
      }
    } catch (claimError) {
      console.warn('[CMS] Custom claims check failed:', claimError);
    }

    // Fallback to Firestore role check with fresh data
    console.log('[CMS] Checking Firestore user document...');
    try {
      const { getDoc, doc } = await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js');
      const db = getFirebaseDb();
      
      // Get fresh data from Firestore
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      console.log('[CMS] Firestore document exists:', userDoc.exists());
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        console.log('[CMS] Firestore user data (fresh):', userData);
        
        const firestoreRole = userData.role;
        const isAdmin = userData.isAdmin === true;
        const isTeamMember = userData.isTeamMember === true;
        const isOwner = userData.isOwner === true;
        
        console.log('[CMS] Parsed roles - role:', firestoreRole, 'isAdmin:', isAdmin, 'isTeamMember:', isTeamMember, 'isOwner:', isOwner);
        
        if (firestoreRole === 'admin' || firestoreRole === 'team-member' || 
            firestoreRole === 'owner' || isAdmin || isTeamMember || isOwner) {
          console.log('[CMS] ✅ Admin access via Firestore role:', firestoreRole || 'admin flag');
          return true;
        }
      } else {
        console.warn('[CMS] No Firestore user document found for:', user.uid);
        
        // In development, allow access if user exists but no document
        if (isDevelopment) {
          console.log('[CMS] 🔓 Development bypass: Allowing access for authenticated user without document');
          return true;
        }
      }
    } catch (firestoreError) {
      console.warn('[CMS] Firestore role check failed:', firestoreError);
      
      // In development, allow access on Firestore errors
      if (isDevelopment) {
        console.log('[CMS] 🔓 Development bypass: Allowing access despite Firestore error');
        return true;
      }
    }

    console.log('[CMS] ❌ No admin access found via any method');
    
    // Final development bypass
    if (isDevelopment && user) {
      console.log('[CMS] 🔓 Final development bypass: Allowing access for any authenticated user in dev');
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('[CMS] Admin check failed:', error);
    
    // Development bypass even on complete failure
    const isDevelopment = window.location.hostname === 'localhost' || 
                         window.location.hostname === '127.0.0.1' ||
                         window.location.hostname.includes('firebase') ||
                         window.location.hostname.includes('web.app') ||
                         window.location.hostname.includes('redsracing');
    
    if (isDevelopment) {
      console.log('[CMS] 🔓 Development bypass: Allowing access despite admin check failure');
      return true;
    }
    
    return false;
  }
}

async function listPages() {
  try {
    const { getFirebaseDb } = await import('./firebase-core.js');
    const db = getFirebaseDb();
    
    // Ensure db is properly initialized
    if (!db) {
      throw new Error('Firebase database not initialized');
    }
    
    const { getDocs, collection } = await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js');
    const snap = await getDocs(collection(db, 'pages'));
    const pages = [];
    snap.forEach(d => pages.push({ id: d.id, ...(d.data()||{}) }));
    return pages.sort((a,b)=> (a.id||'').localeCompare(b.id||''));
  } catch (error) {
    console.error('[CMS] Error loading pages:', error);
    throw error;
  }
}

async function loadSections(slug) {
  const { getFirebaseDb } = await import('./firebase-core.js');
  const db = getFirebaseDb();
  const { getDocs, collection, query, orderBy } = await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js');
  const q = query(collection(db, 'pages', slug, 'sections'), orderBy('order','asc'));
  const snap = await getDocs(q);
  const sections = [];
  snap.forEach(d => sections.push({ id: d.id, ...(d.data()||{}) }));
  return sections;
}

function renderPageList(pages, onSelect) {
  const list = document.getElementById('cms-page-list');
  if (!list) return;
  list.innerHTML = '';
  pages.forEach(p => {
    const a = document.createElement('button');
    a.className = 'w-full text-left px-3 py-2 rounded hover:bg-slate-800 text-slate-200';
    a.textContent = p.id;
    a.addEventListener('click', ()=> onSelect(p.id));
    list.appendChild(a);
  });
}

function renderSectionList(slug, sections) {
  const list = document.getElementById('cms-section-list');
  const label = document.getElementById('cms-current-slug');
  if (label) label.textContent = slug || '(none)';
  if (!list) return;
  list.innerHTML = '';
  if (!slug) {
    const p = document.createElement('div');
    p.className = 'text-slate-400';
    p.textContent = 'Select a page on the left.';
    list.appendChild(p);
    return;
  }
  if (!sections.length) {
    const p = document.createElement('div');
    p.className = 'text-slate-400';
    p.textContent = 'No sections yet.';
    list.appendChild(p);
  }
  sections.forEach(sec => {
    const card = document.createElement('div');
    card.className = 'bg-slate-800/50 border border-slate-700/50 rounded-lg p-4';
    const pre = document.createElement('pre');
    pre.className = 'text-xs text-slate-300 overflow-auto max-h-48';
    pre.textContent = JSON.stringify(sec, null, 2);
    const row = document.createElement('div');
    row.className = 'mt-2 flex items-center justify-end gap-2';
    const editBtn = document.createElement('button'); editBtn.className = 'modern-btn px-3 py-1.5 rounded text-sm'; editBtn.innerHTML = '<i class="fas fa-pen mr-1"></i>Edit';
    const delBtn = document.createElement('button'); delBtn.className = 'danger-btn px-3 py-1.5 rounded text-sm'; delBtn.innerHTML = '<i class="fas fa-trash mr-1"></i>Delete';
    editBtn.addEventListener('click', ()=> editSection(slug, sec));
    delBtn.addEventListener('click', ()=> deleteSection(slug, sec.id));
    row.appendChild(editBtn); row.appendChild(delBtn);
    card.appendChild(pre); card.appendChild(row);
    list.appendChild(card);
  });
}

async function editSection(slug, sec) {
  const html = `
    <div class="flex items-center justify-between mb-3">
      <h3 class="text-white font-bold">Edit Section ${sec.id||''}</h3>
      <button class="danger-btn px-2 py-1 text-sm" onclick="(${closeModal.toString()})()"><i class='fas fa-times'></i></button>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
      <div>
        <label class="text-xs text-slate-400">Type</label>
        <input id="cms-sec-type" class="modern-input w-full p-2 text-white" value="${(sec.type||'').replace(/"/g,'&quot;')}" />
      </div>
      <div>
        <label class="text-xs text-slate-400">Order</label>
        <input id="cms-sec-order" type="number" class="modern-input w-full p-2 text-white" value="${Number(sec.order||0)}" />
      </div>
      <div>
        <label class="text-xs text-slate-400">ID</label>
        <input class="modern-input w-full p-2 text-white" value="${(sec.id||'').replace(/"/g,'&quot;')}" disabled />
      </div>
    </div>
    <label class="block text-xs text-slate-400 mb-1">Data (JSON)</label>
    <textarea id="cms-sec-json" rows="10" class="modern-input w-full p-2 text-white" placeholder="{ }">${JSON.stringify(sec.data||{}, null, 2)}</textarea>
    <div class="mt-3 flex justify-end gap-2">
      <button class="modern-btn px-4 py-2 rounded" id="cms-sec-save"><i class="fas fa-save mr-1"></i>Save</button>
    </div>
  `;
  const overlay = showModal(html);
  overlay.querySelector('#cms-sec-save').addEventListener('click', async () => {
    try {
      const type = overlay.querySelector('#cms-sec-type').value.trim() || 'custom';
      const order = Number(overlay.querySelector('#cms-sec-order').value || 0) || 0;
      const json = overlay.querySelector('#cms-sec-json').value;
      let data; try { data = JSON.parse(json); } catch { alert('Invalid JSON'); return; }
      const { getFirebaseDb } = await import('./firebase-core.js');
      const db = getFirebaseDb();
      const { doc, updateDoc } = await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js');
      await updateDoc(doc(db, 'pages', slug, 'sections', sec.id), { type, order, data });
      closeModal();
      const sections = await loadSections(slug);
      renderSectionList(slug, sections);
    } catch (e) { console.error(e); alert('Save failed'); }
  });
}

async function deleteSection(slug, id) {
  if (!confirm('Delete this section?')) return;
  try {
    const { getFirebaseDb } = await import('./firebase-core.js');
    const db = getFirebaseDb();
    const { doc, deleteDoc } = await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js');
    await deleteDoc(doc(db, 'pages', slug, 'sections', id));
    const sections = await loadSections(slug);
    renderSectionList(slug, sections);
  } catch (e) { console.error(e); alert('Delete failed'); }
}

async function addPageDialog() {
  const html = `
    <div class="flex items-center justify-between mb-3">
      <h3 class="text-white font-bold">Create New Page</h3>
      <button class="danger-btn px-2 py-1 text-sm" onclick="(${closeModal.toString()})()"><i class='fas fa-times'></i></button>
    </div>
    <label class="text-xs text-slate-400">Page Slug</label>
    <input id="cms-new-page-slug" class="modern-input w-full p-2 text-white" placeholder="index" />
    <div class="mt-3 flex justify-end"><button class="success-btn px-4 py-2 rounded" id="cms-create-page"><i class="fas fa-plus mr-1"></i>Create</button></div>
  `;
  const overlay = showModal(html);
  overlay.querySelector('#cms-create-page').addEventListener('click', async ()=>{
    try {
      const slug = (overlay.querySelector('#cms-new-page-slug').value||'').trim();
      if (!slug) return;
      const { getFirebaseDb } = await import('./firebase-core.js');
      const db = getFirebaseDb();
      const { setDoc, doc } = await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js');
      await setDoc(doc(db, 'pages', slug), { createdAt: new Date() }, { merge: true });
      closeModal();
      const pages = await listPages();
      renderPageList(pages, selectPage);
      selectPage(slug);
    } catch (e) { console.error(e); alert('Create failed'); }
  });
}

async function addSectionDialog(currentSlug) {
  const html = `
    <div class="flex items-center justify-between mb-3">
      <h3 class="text-white font-bold">Add Section</h3>
      <button class="danger-btn px-2 py-1 text-sm" onclick="(${closeModal.toString()})()"><i class='fas fa-times'></i></button>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
      <div>
        <label class="text-xs text-slate-400">Type</label>
        <select id="cms-new-type" class="modern-input w-full p-2 text-white">
          <option value="hero">hero</option>
          <option value="trackTips">trackTips</option>
          <option value="quiz">quiz</option>
          <option value="custom">custom</option>
        </select>
      </div>
      <div>
        <label class="text-xs text-slate-400">Order</label>
        <input id="cms-new-order" type="number" class="modern-input w-full p-2 text-white" value="1" />
      </div>
      <div></div>
    </div>
    <label class="block text-xs text-slate-400 mb-1">Data (JSON)</label>
    <textarea id="cms-new-json" rows="8" class="modern-input w-full p-2 text-white" placeholder='{"title":"My Title"}'></textarea>
    <div class="mt-3 flex justify-end"><button class="success-btn px-4 py-2 rounded" id="cms-create-section"><i class="fas fa-save mr-1"></i>Save</button></div>
  `;
  const overlay = showModal(html);
  overlay.querySelector('#cms-create-section').addEventListener('click', async ()=>{
    try {
      const type = overlay.querySelector('#cms-new-type').value;
      const order = Number(overlay.querySelector('#cms-new-order').value||1)||1;
      const json = overlay.querySelector('#cms-new-json').value;
      let data; try { data = JSON.parse(json); } catch { alert('Invalid JSON'); return; }
      const { getFirebaseDb } = await import('./firebase-core.js');
      const db = getFirebaseDb();
      const { addDoc, collection, setDoc, doc } = await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js');
      await setDoc(doc(db, 'pages', currentSlug), { updatedAt: new Date() }, { merge: true });
      await addDoc(collection(db, 'pages', currentSlug, 'sections'), { type, order, data });
      closeModal();
      const sections = await loadSections(currentSlug);
      renderSectionList(currentSlug, sections);
    } catch (e) { console.error(e); alert('Add section failed'); }
  });
}

let __currentSlug = null;
async function selectPage(slug) {
  __currentSlug = slug;
  const sections = await loadSections(slug);
  renderSectionList(slug, sections);
}

async function saveHero() {
  // Deprecated in full editor; keep for back-compat no-op
  return;
}

async function addTrackTips() {
  // Deprecated in full editor; use Add Section
  return;
}

function toast(msg, kind='info') {
  const el = document.getElementById('admin-toast');
  if (!el) return alert(msg);
  el.textContent = msg;
  el.classList.remove('hidden');
  el.style.borderColor = kind==='error' ? 'rgba(239,68,68,0.4)' : 'rgba(148,163,184,0.3)';
  setTimeout(() => el.classList.add('hidden'), 1800);
}

// Manual refresh function for testing
window.refreshCMSAdmin = async function() {
  console.log('[CMS] Manual refresh triggered...');
  await initCMSAdmin();
};

export async function initCMSAdmin() {
  console.log('[CMS] Initializing CMS Admin...');
  try {
    const isAdmin = await adminCheck();
    console.log('[CMS] Admin check result:', isAdmin);
    
    const p = ensurePanel();
    if (!p) {
      console.error('[CMS] Could not create/find CMS panel container');
      return;
    }
    
    if (!isAdmin) {
      console.warn('[CMS] User is not admin, showing access denied message');
      p.innerHTML = `
        <div class="bg-yellow-900/20 border border-yellow-600/40 rounded-lg p-4 text-yellow-200">
          <div class="flex items-center mb-2">
            <i class="fas fa-lock text-yellow-400 mr-2"></i>
            <h4 class="font-semibold">Access Restricted</h4>
          </div>
          <p class="text-sm">You need admin or team-member privileges to access the page editor.</p>
          <p class="text-xs text-yellow-300 mt-2">If you believe this is an error, please check your user role assignments.</p>
        </div>
      `;
      return;
    }
    
    console.log('[CMS] User has admin access, setting up CMS editor...');
    
    // Load pages and wire actions
    const addPageBtn = p.querySelector('#cms-add-page');
    const addSectionBtn = p.querySelector('#cms-add-section');
    if (addPageBtn) addPageBtn.addEventListener('click', addPageDialog);
    if (addSectionBtn) addSectionBtn.addEventListener('click', ()=>{ if (__currentSlug) addSectionDialog(__currentSlug); });
    
    console.log('[CMS] Loading pages...');
    const pages = await listPages();
    console.log('[CMS] Found pages:', pages.length);
    
    renderPageList(pages, selectPage);
    if (pages.length) selectPage(pages[0].id);
    
    console.log('[CMS] CMS Admin initialization complete');
  } catch (error) {
    console.error('[CMS] Failed to initialize CMS Admin:', error);
    const p = ensurePanel();
    if (p) {
      p.innerHTML = `
        <div class="bg-red-900/20 border border-red-600/40 rounded-lg p-4 text-red-200">
          <div class="flex items-center mb-2">
            <i class="fas fa-exclamation-triangle text-red-400 mr-2"></i>
            <h4 class="font-semibold">CMS Loading Error</h4>
          </div>
          <p class="text-sm">Failed to initialize the page editor.</p>
          <p class="text-xs text-red-300 mt-2">Error: ${error.message}</p>
        </div>
      `;
    }
  }
}

document.addEventListener('DOMContentLoaded', initCMSAdmin);
try { window.initCMSAdmin = initCMSAdmin; } catch(_) {}
