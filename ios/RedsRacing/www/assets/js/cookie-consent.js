// Cookie Consent Banner for AdSense & GDPR Compliance
(function() {
  // Skip if already consented
  if (localStorage.getItem('cookie_consent') === 'accepted') return;
  if (localStorage.getItem('cookie_consent') === 'rejected') return;

  // Create banner
  var banner = document.createElement('div');
  banner.id = 'cookie-consent-banner';
  banner.setAttribute('role', 'dialog');
  banner.setAttribute('aria-label', 'Cookie consent');
  banner.innerHTML =
    '<div class="rr-cookie-inner">' +
      '<p class="rr-cookie-copy">' +
        'We use cookies for ads, analytics, and site improvements. ' +
        '<a href="privacy-policy.html">Privacy Policy</a>' +
      '</p>' +
      '<div class="rr-cookie-actions">' +
        '<button type="button" id="cookie-accept">Accept All</button>' +
        '<button type="button" id="cookie-reject">Reject Non-Essential</button>' +
      '</div>' +
    '</div>';

  var style = document.createElement('style');
  style.textContent =
    '#cookie-consent-banner{position:fixed;bottom:0;left:0;right:0;z-index:99999;' +
    'background:rgba(15,23,42,.97);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);' +
    'border-top:2px solid rgba(251,191,36,.3);padding:12px 16px;color:#e2e8f0;font-family:Inter,system-ui,sans-serif;}' +
    '#cookie-consent-banner .rr-cookie-inner{max-width:900px;margin:0 auto;display:flex;align-items:center;' +
    'justify-content:space-between;flex-wrap:wrap;gap:10px;}' +
    '#cookie-consent-banner .rr-cookie-copy{margin:0;flex:1;min-width:0;font-size:13px;line-height:1.45;}' +
    '#cookie-consent-banner .rr-cookie-copy a{color:#fbbf24;text-decoration:underline;}' +
    '#cookie-consent-banner .rr-cookie-actions{display:flex;gap:8px;flex-shrink:0;flex-wrap:wrap;}' +
    '#cookie-consent-banner #cookie-accept{background:linear-gradient(135deg,#fbbf24,#f59e0b);color:#0f172a;border:none;' +
    'padding:10px 18px;border-radius:8px;font-weight:700;font-size:13px;cursor:pointer;min-height:44px;}' +
    '#cookie-consent-banner #cookie-reject{background:transparent;color:#94a3b8;border:1px solid #475569;' +
    'padding:10px 14px;border-radius:8px;font-weight:600;font-size:13px;cursor:pointer;min-height:44px;}' +
    '@media (max-width:640px){' +
    '#cookie-consent-banner{padding:10px 12px calc(10px + env(safe-area-inset-bottom,0px));}' +
    '#cookie-consent-banner .rr-cookie-inner{flex-direction:column;align-items:stretch;gap:8px;}' +
    '#cookie-consent-banner .rr-cookie-copy{font-size:12px;}' +
    '#cookie-consent-banner .rr-cookie-actions{width:100%;}' +
    '#cookie-consent-banner .rr-cookie-actions button{flex:1;white-space:nowrap;}' +
    '}';

  document.head.appendChild(style);
  document.body.appendChild(banner);

  function dismiss() {
    banner.style.transition = 'transform 0.3s ease';
    banner.style.transform = 'translateY(100%)';
    setTimeout(function() { banner.remove(); }, 300);
  }

  document.getElementById('cookie-accept').addEventListener('click', function() {
    localStorage.setItem('cookie_consent', 'accepted');
    localStorage.setItem('cookie_consent_date', new Date().toISOString());
    dismiss();
  });

  document.getElementById('cookie-reject').addEventListener('click', function() {
    localStorage.setItem('cookie_consent', 'rejected');
    localStorage.setItem('cookie_consent_date', new Date().toISOString());
    dismiss();
  });
})();
