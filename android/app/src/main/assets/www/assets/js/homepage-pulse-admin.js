/**
 * Homepage Pulse + Live Race Mode admin (replaces broken Site Editor CMS).
 * Writes config/homepage_pulse — consumed by homepage-pulse.js + next-race-hub.js.
 */
(function () {
  'use strict';

  const DOC = 'config/homepage_pulse';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function val(id) {
    const el = document.getElementById(id);
    return el ? String(el.value || '').trim() : '';
  }

  function checked(id) {
    const el = document.getElementById(id);
    return !!(el && el.checked);
  }

  function setVal(id, v) {
    const el = document.getElementById(id);
    if (el) el.value = v == null ? '' : String(v);
  }

  function setChecked(id, on) {
    const el = document.getElementById(id);
    if (el) el.checked = !!on;
  }

  function parseTickerLines(text) {
    return String(text || '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        // text | href | icon
        const parts = line.split('|').map((p) => p.trim());
        return {
          text: parts[0] || '',
          href: parts[1] || '',
          icon: parts[2] || 'fas fa-bolt'
        };
      })
      .filter((x) => x.text);
  }

  function tickerToText(items) {
    if (!Array.isArray(items)) return '';
    return items.map((it) => {
      const bits = [it.text || ''];
      if (it.href) bits.push(it.href);
      if (it.icon && it.icon !== 'fas fa-bolt') {
        if (!it.href) bits.push('');
        bits.push(it.icon);
      }
      return bits.join(' | ');
    }).join('\n');
  }

  function ensurePanel() {
    const container = document.getElementById('homepage-pulse-section');
    if (!container) return null;
    if (document.getElementById('homepage-pulse-panel')) return document.getElementById('homepage-pulse-panel');

    const wrap = document.createElement('div');
    wrap.id = 'homepage-pulse-panel';
    wrap.className = 'space-y-6';
    wrap.innerHTML = `
      <div class="admin-card rounded-xl p-6">
        <div class="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <h2 class="text-2xl font-bold text-white flex items-center">
              <i class="fas fa-bolt text-yellow-400 mr-3"></i>Homepage Pulse
            </h2>
            <p class="text-slate-400 text-sm mt-1">Live banner, ticker lines, spotlight, and race-mode — updates the site immediately (no deploy).</p>
          </div>
          <label class="inline-flex items-center gap-2 text-sm text-slate-200 bg-slate-800/60 border border-slate-700 px-3 py-2 rounded-lg">
            <input type="checkbox" id="pulse-enabled" checked /> Pulse enabled
          </label>
        </div>

        <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div class="bg-slate-900/50 border border-slate-700/50 rounded-xl p-4 space-y-3">
            <h3 class="text-white font-semibold text-sm"><i class="fas fa-bullhorn text-orange-400 mr-2"></i>Site banner</h3>
            <label class="inline-flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" id="pulse-banner-enabled" /> Show banner on homepage</label>
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="block text-xs text-slate-400 mb-1">Tone</label>
                <select id="pulse-banner-tone" class="modern-input w-full p-2 text-white text-sm">
                  <option value="race">Race</option>
                  <option value="alert">Alert / rain</option>
                  <option value="info">Info</option>
                  <option value="celebrate">Celebrate</option>
                </select>
              </div>
              <div>
                <label class="block text-xs text-slate-400 mb-1">Eyebrow</label>
                <input id="pulse-banner-eyebrow" class="modern-input w-full p-2 text-white text-sm" placeholder="RACE WEEK" />
              </div>
            </div>
            <div>
              <label class="block text-xs text-slate-400 mb-1">Message</label>
              <textarea id="pulse-banner-message" rows="2" class="modern-input w-full p-2 text-white text-sm" placeholder="Saturday at Grundy — gates 5pm. Rain in the forecast, pack a jacket."></textarea>
            </div>
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="block text-xs text-slate-400 mb-1">CTA label</label>
                <input id="pulse-banner-cta-label" class="modern-input w-full p-2 text-white text-sm" placeholder="Next Race Hub" />
              </div>
              <div>
                <label class="block text-xs text-slate-400 mb-1">CTA link</label>
                <input id="pulse-banner-cta-href" class="modern-input w-full p-2 text-white text-sm" placeholder="next-race.html" />
              </div>
            </div>
            <label class="inline-flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" id="pulse-banner-dismissible" checked /> Fans can dismiss</label>
          </div>

          <div class="bg-slate-900/50 border border-red-700/30 rounded-xl p-4 space-y-3">
            <h3 class="text-white font-semibold text-sm"><i class="fas fa-flag text-red-400 mr-2"></i>Live Race Mode</h3>
            <label class="inline-flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" id="pulse-race-enabled" /> Race mode ON (shows on Next Race Hub)</label>
            <div>
              <label class="block text-xs text-slate-400 mb-1">Status line</label>
              <input id="pulse-race-status" class="modern-input w-full p-2 text-white text-sm" placeholder="Heat racing under way" />
            </div>
            <div>
              <label class="block text-xs text-slate-400 mb-1">Note</label>
              <textarea id="pulse-race-note" rows="2" class="modern-input w-full p-2 text-white text-sm" placeholder="Rain delay — next green TBD"></textarea>
            </div>
            <p class="text-[11px] text-slate-500">Tip: pair with Live Race Admin + push when the feature goes green.</p>
          </div>

          <div class="bg-slate-900/50 border border-slate-700/50 rounded-xl p-4 space-y-3">
            <h3 class="text-white font-semibold text-sm"><i class="fas fa-stream text-cyan-400 mr-2"></i>LIVE ticker lines</h3>
            <div>
              <label class="block text-xs text-slate-400 mb-1">Mode</label>
              <select id="pulse-ticker-mode" class="modern-input w-full p-2 text-white text-sm">
                <option value="append">Append to auto race ticker</option>
                <option value="replace">Replace auto ticker</option>
              </select>
            </div>
            <div>
              <label class="block text-xs text-slate-400 mb-1">Lines (one per row: text | optional href | optional icon)</label>
              <textarea id="pulse-ticker-items" rows="5" class="modern-input w-full p-2 text-white text-sm font-mono" placeholder="Pit notes at 4pm | live.html | fas fa-broadcast-tower"></textarea>
            </div>
          </div>

          <div class="bg-slate-900/50 border border-indigo-700/30 rounded-xl p-4 space-y-3">
            <h3 class="text-white font-semibold text-sm"><i class="fas fa-star text-indigo-400 mr-2"></i>Homepage spotlight slide</h3>
            <label class="inline-flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" id="pulse-spotlight-enabled" /> Pin spotlight as first carousel slide</label>
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="block text-xs text-slate-400 mb-1">Kicker</label>
                <input id="pulse-spot-kicker" class="modern-input w-full p-2 text-white text-sm" placeholder="This weekend" />
              </div>
              <div>
                <label class="block text-xs text-slate-400 mb-1">CTA</label>
                <input id="pulse-spot-cta" class="modern-input w-full p-2 text-white text-sm" placeholder="Open hub" />
              </div>
            </div>
            <div>
              <label class="block text-xs text-slate-400 mb-1">Title</label>
              <input id="pulse-spot-title" class="modern-input w-full p-2 text-white text-sm" placeholder="Grundy under the lights" />
            </div>
            <div>
              <label class="block text-xs text-slate-400 mb-1">Subtitle</label>
              <input id="pulse-spot-sub" class="modern-input w-full p-2 text-white text-sm" placeholder="Jon #8 + Jonny #88" />
            </div>
            <div>
              <label class="block text-xs text-slate-400 mb-1">Link</label>
              <input id="pulse-spot-href" class="modern-input w-full p-2 text-white text-sm" placeholder="next-race.html" />
            </div>
          </div>

          <div class="bg-slate-900/50 border border-slate-700/50 rounded-xl p-4 space-y-3 xl:col-span-2">
            <h3 class="text-white font-semibold text-sm"><i class="fas fa-car text-emerald-400 mr-2"></i>Next Race Hub notes</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label class="block text-xs text-slate-400 mb-1">Gate / tickets</label>
                <textarea id="pulse-hub-gate" rows="3" class="modern-input w-full p-2 text-white text-sm" placeholder="Gates 5pm · pit passes at will-call"></textarea>
              </div>
              <div>
                <label class="block text-xs text-slate-400 mb-1">Parking</label>
                <textarea id="pulse-hub-parking" rows="3" class="modern-input w-full p-2 text-white text-sm" placeholder="Free lot on the north side — fill up early on features."></textarea>
              </div>
            </div>
          </div>
        </div>

        <div class="flex flex-wrap items-center justify-between gap-3 mt-5">
          <div id="pulse-status" class="text-xs text-slate-400">Load current pulse to edit.</div>
          <div class="flex gap-2">
            <button type="button" id="pulse-load-btn" class="modern-btn text-white px-4 py-2 rounded-lg text-sm font-semibold"><i class="fas fa-sync mr-2"></i>Load</button>
            <button type="button" id="pulse-save-btn" class="success-btn text-white px-4 py-2 rounded-lg text-sm font-semibold"><i class="fas fa-save mr-2"></i>Publish to site</button>
            <a href="next-race.html" target="_blank" rel="noopener" class="modern-btn text-white px-4 py-2 rounded-lg text-sm font-semibold inline-flex items-center"><i class="fas fa-external-link-alt mr-2"></i>Open hub</a>
          </div>
        </div>
      </div>
    `;
    container.innerHTML = '';
    container.appendChild(wrap);
    document.getElementById('pulse-load-btn')?.addEventListener('click', () => loadPulse());
    document.getElementById('pulse-save-btn')?.addEventListener('click', () => savePulse());
    return wrap;
  }

  const FIREBASE_CONFIG = {
    apiKey: 'AIzaSyARFiFCadGKFUc_s6x3qNX8F4jsVawkzVg',
    authDomain: 'redsracing-a7f8b.firebaseapp.com',
    projectId: 'redsracing-a7f8b',
    storageBucket: 'redsracing-a7f8b.firebasestorage.app',
    messagingSenderId: '517034606151',
    appId: '1:517034606151:web:24cae262e1d98832757b62'
  };

  async function getDbAuth() {
    const { initializeApp, getApps } = await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js');
    const { getFirestore, doc, getDoc, setDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js');
    const { getAuth } = await import('https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js');

    // Prefer admin-console helper when exposed; otherwise init/reuse default app here.
    let app = null;
    try {
      if (typeof window.ensureDefaultApp === 'function') {
        app = await window.ensureDefaultApp();
      }
    } catch (_) {}
    if (!app) {
      const existing = getApps().find((a) => a.name === '[DEFAULT]') || getApps()[0];
      app = existing || initializeApp(FIREBASE_CONFIG);
    }
    if (!app) throw new Error('Firebase app not ready');
    return { db: getFirestore(app), auth: getAuth(app), doc, getDoc, setDoc, serverTimestamp };
  }

  async function assertStaffAccess(auth) {
    // Prefer admin-console helpers when available
    try {
      if (typeof window.getUserRole === 'function') {
        const role = await window.getUserRole();
        const ok = role === 'admin' || role === 'team-member' || role === 'owner'
          || (typeof window.isModeratorRole === 'function' && window.isModeratorRole(role));
        if (ok) return role || 'staff';
      }
    } catch (_) {}

    const user = auth.currentUser;
    if (!user) throw new Error('Sign in required');
    let token = {};
    try { token = await user.getIdTokenResult(); } catch (_) {}
    const claimRole = token?.claims?.role;
    if (claimRole === 'admin' || claimRole === 'owner' || claimRole === 'team-member' || token?.claims?.admin === true) {
      return claimRole || 'admin';
    }
    // Fallback: users/{uid} profile role
    try {
      const { db, doc, getDoc } = await getDbAuth();
      const snap = await getDoc(doc(db, 'users', user.uid));
      const role = snap.exists() ? (snap.data()?.role || '') : '';
      if (role === 'admin' || role === 'owner' || role === 'team-member') return role;
      if (snap.exists() && (snap.data()?.isAdmin || snap.data()?.isTeamMember || snap.data()?.isOwner)) return role || 'staff';
    } catch (_) {}
    throw new Error('Admin/team access required');
  }

  async function loadPulse() {
    const status = document.getElementById('pulse-status');
    try {
      if (status) status.textContent = 'Loading…';
      const { db, doc, getDoc } = await getDbAuth();
      const snap = await getDoc(doc(db, 'config', 'homepage_pulse'));
      const d = snap.exists() ? (snap.data() || {}) : {};
      setChecked('pulse-enabled', d.enabled !== false);
      const banner = d.banner || {};
      setChecked('pulse-banner-enabled', !!banner.enabled);
      setVal('pulse-banner-tone', banner.tone || 'race');
      setVal('pulse-banner-eyebrow', banner.eyebrow || '');
      setVal('pulse-banner-message', banner.message || '');
      setVal('pulse-banner-cta-label', banner.ctaLabel || 'Next Race Hub');
      setVal('pulse-banner-cta-href', banner.ctaHref || 'next-race.html');
      setChecked('pulse-banner-dismissible', banner.dismissible !== false);
      const rm = d.raceMode || {};
      setChecked('pulse-race-enabled', !!rm.enabled);
      setVal('pulse-race-status', rm.status || '');
      setVal('pulse-race-note', rm.note || '');
      const ticker = d.ticker || {};
      setVal('pulse-ticker-mode', ticker.mode || 'append');
      setVal('pulse-ticker-items', tickerToText(ticker.items));
      const spot = d.spotlight || {};
      setChecked('pulse-spotlight-enabled', !!spot.enabled);
      setVal('pulse-spot-kicker', spot.kicker || '');
      setVal('pulse-spot-title', spot.title || '');
      setVal('pulse-spot-sub', spot.sub || '');
      setVal('pulse-spot-href', spot.href || 'next-race.html');
      setVal('pulse-spot-cta', spot.cta || 'Open hub');
      const hub = d.hub || {};
      setVal('pulse-hub-gate', hub.gateNotes || '');
      setVal('pulse-hub-parking', hub.parkingNotes || '');
      if (status) status.innerHTML = snap.exists()
        ? '<span class="text-green-400">Loaded current pulse.</span>'
        : '<span class="text-yellow-300">No pulse yet — fill in and publish.</span>';
    } catch (e) {
      console.error('loadPulse', e);
      if (status) status.innerHTML = '<span class="text-red-400">Failed to load: ' + esc(e.message || e) + '</span>';
      if (typeof showToast === 'function') showToast('Failed to load Homepage Pulse', 'error');
    }
  }

  async function savePulse() {
    const status = document.getElementById('pulse-status');
    const btn = document.getElementById('pulse-save-btn');
    try {
      const { db, auth, doc, setDoc, serverTimestamp } = await getDbAuth();
      try {
        await assertStaffAccess(auth);
      } catch (accessErr) {
        if (typeof showToast === 'function') showToast(accessErr.message || 'Admin/team access required', 'error');
        if (status) status.innerHTML = '<span class="text-red-400">' + esc(accessErr.message || accessErr) + '</span>';
        return;
      }
      if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Publishing…'; }
      const payload = {
        enabled: checked('pulse-enabled'),
        banner: {
          enabled: checked('pulse-banner-enabled'),
          tone: val('pulse-banner-tone') || 'race',
          eyebrow: val('pulse-banner-eyebrow'),
          message: val('pulse-banner-message'),
          ctaLabel: val('pulse-banner-cta-label'),
          ctaHref: val('pulse-banner-cta-href') || 'next-race.html',
          dismissible: checked('pulse-banner-dismissible')
        },
        raceMode: {
          enabled: checked('pulse-race-enabled'),
          status: val('pulse-race-status'),
          note: val('pulse-race-note')
        },
        ticker: {
          mode: val('pulse-ticker-mode') || 'append',
          items: parseTickerLines(val('pulse-ticker-items'))
        },
        spotlight: {
          enabled: checked('pulse-spotlight-enabled'),
          kicker: val('pulse-spot-kicker'),
          title: val('pulse-spot-title'),
          sub: val('pulse-spot-sub'),
          href: val('pulse-spot-href') || 'next-race.html',
          cta: val('pulse-spot-cta') || 'Open hub'
        },
        hub: {
          gateNotes: val('pulse-hub-gate'),
          parkingNotes: val('pulse-hub-parking')
        },
        updatedAt: serverTimestamp(),
        updatedBy: auth.currentUser?.uid || null,
        updatedByEmail: auth.currentUser?.email || null
      };
      await setDoc(doc(db, 'config', 'homepage_pulse'), payload, { merge: true });
      if (status) status.innerHTML = '<span class="text-green-400">Published — homepage + Next Race Hub will pick this up.</span>';
      try {
        if (typeof window.showToast === 'function') window.showToast('Homepage Pulse published', 'success');
        else if (typeof showToast === 'function') showToast('Homepage Pulse published');
      } catch (_) {}
    } catch (e) {
      console.error('savePulse', e);
      if (status) status.innerHTML = '<span class="text-red-400">Save failed: ' + esc(e.message || e) + '</span>';
      try {
        if (typeof window.showToast === 'function') window.showToast('Failed to publish pulse', 'error');
        else if (typeof showToast === 'function') showToast('Failed to publish pulse', 'error');
      } catch (_) {}
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-save mr-2"></i>Publish to site'; }
    }
  }

  window.initHomepagePulseAdmin = async function initHomepagePulseAdmin() {
    ensurePanel();
    await loadPulse();
  };
})();
