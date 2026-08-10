/**
 * Site Editor CMS removed — replaced by Homepage Pulse.
 * Kept as a thin stub so old bookmarks / setup-admin imports do not hard-crash.
 */
export async function initCMSAdmin() {
  console.info('[cms-admin] Site Editor removed. Redirecting to Homepage Pulse (#pulse).');
  try {
    if (typeof window.initHomepagePulseAdmin === 'function') {
      window.location.hash = '#pulse';
      await window.initHomepagePulseAdmin();
      return;
    }
  } catch (_) {}
  try {
    window.location.href = 'admin-console.html#pulse';
  } catch (_) {}
}

try { window.initCMSAdmin = initCMSAdmin; } catch (_) {}
