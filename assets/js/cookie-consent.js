// Cookie Consent Banner for AdSense & GDPR Compliance
(function() {
  // Skip if already consented
  if (localStorage.getItem('cookie_consent') === 'accepted') return;

  // Create banner
  var banner = document.createElement('div');
  banner.id = 'cookie-consent-banner';
  banner.innerHTML = 
    '<div style="max-width:900px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">' +
      '<p style="margin:0;flex:1;min-width:250px;font-size:14px;line-height:1.5;">' +
        'We use cookies and third-party services (including Google AdSense and Google Analytics) to serve ads, ' +
        'analyze traffic, and improve your experience. By continuing to use this site, you consent to the use of cookies. ' +
        '<a href="privacy-policy.html" style="color:#fbbf24;text-decoration:underline;">Privacy Policy</a> · ' +
        '<a href="https://policies.google.com/technologies/partner-sites" target="_blank" rel="noopener" style="color:#fbbf24;text-decoration:underline;">How Google uses data</a>' +
      '</p>' +
      '<div style="display:flex;gap:8px;flex-shrink:0;">' +
        '<button id="cookie-accept" style="background:linear-gradient(135deg,#fbbf24,#f59e0b);color:#0f172a;border:none;padding:10px 24px;border-radius:8px;font-weight:700;font-size:14px;cursor:pointer;white-space:nowrap;">Accept All</button>' +
        '<button id="cookie-reject" style="background:transparent;color:#94a3b8;border:1px solid #475569;padding:10px 16px;border-radius:8px;font-weight:600;font-size:14px;cursor:pointer;white-space:nowrap;">Reject Non-Essential</button>' +
      '</div>' +
    '</div>';

  // Style the banner
  banner.style.cssText = 
    'position:fixed;bottom:0;left:0;right:0;z-index:99999;' +
    'background:rgba(15,23,42,0.97);backdrop-filter:blur(10px);' +
    'border-top:2px solid rgba(251,191,36,0.3);' +
    'padding:16px 20px;color:#e2e8f0;font-family:Inter,sans-serif;';

  document.body.appendChild(banner);

  // Accept handler
  document.getElementById('cookie-accept').addEventListener('click', function() {
    localStorage.setItem('cookie_consent', 'accepted');
    localStorage.setItem('cookie_consent_date', new Date().toISOString());
    banner.style.transition = 'transform 0.3s ease';
    banner.style.transform = 'translateY(100%)';
    setTimeout(function() { banner.remove(); }, 300);
  });

  // Reject handler — essential cookies only
  document.getElementById('cookie-reject').addEventListener('click', function() {
    localStorage.setItem('cookie_consent', 'rejected');
    localStorage.setItem('cookie_consent_date', new Date().toISOString());
    banner.style.transition = 'transform 0.3s ease';
    banner.style.transform = 'translateY(100%)';
    setTimeout(function() { banner.remove(); }, 300);
  });
})();
