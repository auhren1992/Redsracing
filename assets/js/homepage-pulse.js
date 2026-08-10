/**
 * Homepage Pulse — public consumer for config/homepage_pulse
 * Renders site banner, merges LIVE ticker lines, and exposes spotlight for the carousel.
 */
(function () {
  'use strict';

  const DOC_PATH = 'config/homepage_pulse';
  const DISMISS_KEY = 'rr_pulse_banner_dismissed';

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function toneClasses(tone) {
    switch (String(tone || '').toLowerCase()) {
      case 'alert':
        return { border: 'rgba(239,68,68,.45)', bg: 'rgba(127,29,29,.55)', accent: '#fca5a5', icon: 'fas fa-exclamation-triangle' };
      case 'celebrate':
        return { border: 'rgba(52,211,153,.4)', bg: 'rgba(6,78,59,.5)', accent: '#6ee7b7', icon: 'fas fa-trophy' };
      case 'info':
        return { border: 'rgba(96,165,250,.4)', bg: 'rgba(30,58,138,.45)', accent: '#93c5fd', icon: 'fas fa-info-circle' };
      case 'race':
      default:
        return { border: 'rgba(251,191,36,.4)', bg: 'rgba(120,53,15,.45)', accent: '#fbbf24', icon: 'fas fa-flag-checkered' };
    }
  }

  async function fetchPulse(db) {
    try {
      const snap = await db.doc(DOC_PATH).get();
      if (!snap.exists) return null;
      const data = snap.data() || {};
      if (data.enabled === false) return null;
      return data;
    } catch (e) {
      console.warn('[homepage-pulse] fetch failed', e);
      return null;
    }
  }

  function bannerDismissed(pulse) {
    try {
      const stamp = String((pulse && pulse.updatedAt && (pulse.updatedAt.seconds || pulse.updatedAt)) || pulse.banner?.message || '');
      return localStorage.getItem(DISMISS_KEY) === stamp;
    } catch (_) {
      return false;
    }
  }

  function markBannerDismissed(pulse) {
    try {
      const stamp = String((pulse && pulse.updatedAt && (pulse.updatedAt.seconds || pulse.updatedAt)) || pulse.banner?.message || '');
      localStorage.setItem(DISMISS_KEY, stamp);
    } catch (_) {}
  }

  function mountBanner(pulse) {
    const banner = pulse && pulse.banner;
    if (!banner || !banner.enabled || !String(banner.message || '').trim()) return;
    if (banner.dismissible !== false && bannerDismissed(pulse)) return;

    const existing = document.getElementById('rr-homepage-pulse-banner');
    if (existing) existing.remove();

    const tone = toneClasses(banner.tone);
    const wrap = document.createElement('div');
    wrap.id = 'rr-homepage-pulse-banner';
    wrap.setAttribute('role', 'region');
    wrap.setAttribute('aria-label', 'Site announcement');
    wrap.style.cssText = [
      'width:min(920px,92%)',
      'margin:0 auto 1rem',
      'border-radius:14px',
      'border:1px solid ' + tone.border,
      'background:' + tone.bg,
      'backdrop-filter:blur(10px)',
      '-webkit-backdrop-filter:blur(10px)',
      'padding:14px 16px',
      'display:flex',
      'align-items:flex-start',
      'gap:12px',
      'box-shadow:0 12px 40px rgba(0,0,0,.35)',
      'animation:rrPulseIn .45s ease-out'
    ].join(';');

    const cta = banner.ctaLabel && banner.ctaHref
      ? `<a href="${escapeHtml(banner.ctaHref)}" style="display:inline-flex;align-items:center;gap:6px;margin-top:8px;color:${tone.accent};font-weight:700;font-size:.85rem;text-decoration:none;">${escapeHtml(banner.ctaLabel)} <i class="fas fa-arrow-right" aria-hidden="true"></i></a>`
      : '';

    const dismissBtn = banner.dismissible === false
      ? ''
      : `<button type="button" id="rr-pulse-dismiss" aria-label="Dismiss announcement" style="margin-left:auto;flex-shrink:0;width:36px;height:36px;border-radius:10px;border:1px solid rgba(148,163,184,.25);background:rgba(15,23,42,.35);color:#e2e8f0;cursor:pointer;"><i class="fas fa-times" aria-hidden="true"></i></button>`;

    wrap.innerHTML = `
      <div style="width:40px;height:40px;border-radius:12px;display:flex;align-items:center;justify-content:center;background:rgba(15,23,42,.35);color:${tone.accent};flex-shrink:0;">
        <i class="${tone.icon}" aria-hidden="true"></i>
      </div>
      <div style="min-width:0;flex:1;">
        ${banner.eyebrow ? `<div style="font-size:.7rem;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:${tone.accent};margin-bottom:4px;">${escapeHtml(banner.eyebrow)}</div>` : ''}
        <div style="color:#f8fafc;font-size:.98rem;line-height:1.45;font-weight:600;">${escapeHtml(banner.message)}</div>
        ${cta}
      </div>
      ${dismissBtn}
    `;

    if (!document.getElementById('rr-pulse-anim-style')) {
      const style = document.createElement('style');
      style.id = 'rr-pulse-anim-style';
      style.textContent = '@keyframes rrPulseIn{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:none}}';
      document.head.appendChild(style);
    }

    const ticker = document.querySelector('.hype-ticker');
    const hero = document.querySelector('.hero') || document.querySelector('main') || document.body;
    if (ticker && ticker.parentNode) {
      ticker.parentNode.insertBefore(wrap, ticker);
    } else if (hero) {
      hero.insertBefore(wrap, hero.firstChild);
    }

    const btn = document.getElementById('rr-pulse-dismiss');
    if (btn) {
      btn.addEventListener('click', () => {
        markBannerDismissed(pulse);
        wrap.remove();
      });
    }
  }

  function normalizeTickerItems(raw) {
    if (!Array.isArray(raw)) return [];
    return raw
      .map((it) => ({
        icon: String(it.icon || 'fas fa-bolt').trim(),
        text: String(it.text || '').trim(),
        href: String(it.href || '').trim()
      }))
      .filter((it) => it.text);
  }

  function spotlightSlide(pulse) {
    const s = pulse && pulse.spotlight;
    if (!s || !s.enabled || !String(s.title || '').trim()) return null;
    const slide = {
      kicker: String(s.kicker || 'Spotlight').trim() || 'Spotlight',
      title: String(s.title || '').trim(),
      sub: String(s.sub || '').trim(),
      href: String(s.href || 'schedule.html').trim() || 'schedule.html',
      cta: String(s.cta || 'Learn more').trim() || 'Learn more',
      gradient: String(s.gradient || 'linear-gradient(125deg, #7c2d12 0%, #0f172a 45%, #1d4ed8 100%)').trim()
    };
    if (s.cta2Label && s.cta2Href) {
      slide.cta2 = { href: String(s.cta2Href).trim(), label: String(s.cta2Label).trim() };
    }
    return slide;
  }

  async function initWithDb(db) {
    const pulse = await fetchPulse(db);
    window.__RR_HOMEPAGE_PULSE__ = pulse || null;
    if (!pulse) {
      window.dispatchEvent(new CustomEvent('rr-homepage-pulse-ready', { detail: null }));
      return null;
    }
    try { mountBanner(pulse); } catch (e) { console.warn('[homepage-pulse] banner', e); }
    window.dispatchEvent(new CustomEvent('rr-homepage-pulse-ready', { detail: pulse }));
    return pulse;
  }

  function waitForDb(attempt) {
    const n = attempt || 0;
    const db = window.firebase && window.firebase.firestore && window.firebase.firestore();
    if (db) {
      initWithDb(db);
      return;
    }
    if (n > 40) return;
    setTimeout(() => waitForDb(n + 1), 250);
  }

  // Public helpers used by homepage ticker/carousel
  window.RRHomepagePulse = {
    get: () => window.__RR_HOMEPAGE_PULSE__ || null,
    tickerItems: () => normalizeTickerItems((window.__RR_HOMEPAGE_PULSE__ || {}).ticker?.items),
    tickerMode: () => String(((window.__RR_HOMEPAGE_PULSE__ || {}).ticker || {}).mode || 'append').toLowerCase(),
    spotlightSlide: () => spotlightSlide(window.__RR_HOMEPAGE_PULSE__),
    ready: initWithDb
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => waitForDb(0));
  } else {
    waitForDb(0);
  }
})();
