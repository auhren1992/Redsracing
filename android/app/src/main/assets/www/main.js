// Root main.js: small shared helpers
(function () {
  'use strict';

  function setYear() {
    const el = document.getElementById('year');
    if (el) {
      try { el.textContent = new Date().getFullYear().toString(); } catch (_) {}
    }
  }

  function hideDropdownsOnLoad() {
    document.querySelectorAll('.dropdown-menu').forEach((menu) => {
      menu.classList.add('hidden');
      menu.setAttribute('aria-hidden', 'true');
      try { menu.style.display = 'none'; } catch (_) {}
    });
  }

  function ready() {
    setYear();
    hideDropdownsOnLoad();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ready);
  } else {
    ready();
  }
})();
