// Centralized LoadingService to prevent infinite spinners and provide skeleton helpers
// Usage:
//   LoadingService.bind({ loaderId: 'loading-state', contentId: 'profile-content', maxMs: 3000 })
//   LoadingService.done('profile-content')
//   LoadingService.error({ loaderId: 'loading-state', errorId: 'error-state' })

export const LoadingService = (function () {
  const binds = new Map();

  function now() { return Date.now(); }

  function hide(el) {
    if (!el) return;
    el.classList.add('hidden');
    el.style.display = 'none';
    el.setAttribute('hidden', 'true');
  }
  function show(el) {
    if (!el) return;
    el.classList.remove('hidden');
    el.style.removeProperty('display');
    el.removeAttribute('hidden');
  }

  function bind(opts) {
    const { loaderId, contentId, errorId=null, maxMs=3000 } = opts || {};
    const binding = {
      loader: document.getElementById(loaderId || ''),
      content: document.getElementById(contentId || ''),
      error: errorId ? document.getElementById(errorId) : null,
      maxMs,
      start: now(),
      timer: null,
      done: false,
    };
    if (!binding.loader && !binding.content) return;
    // Start a guard timer to auto-show content area as skeleton
    binding.timer = setTimeout(() => {
      if (binding.done) return;
      if (binding.loader) hide(binding.loader);
      if (binding.content) show(binding.content);
    }, maxMs);
    binds.set(contentId || loaderId, binding);
    return binding;
  }

  function done(idOrEl) {
    const key = typeof idOrEl === 'string' ? idOrEl : idOrEl?.id;
    if (!key) return;
    const b = binds.get(key) || binds.get(document.getElementById(key)?.id);
    if (!b) return;
    b.done = true;
    if (b.timer) clearTimeout(b.timer);
    if (b.loader) hide(b.loader);
    if (b.content) show(b.content);
  }

  function error(opts) {
    const { loaderId, errorId } = opts || {};
    const loader = document.getElementById(loaderId || '');
    const errorEl = document.getElementById(errorId || '');
    if (loader) hide(loader);
    if (errorEl) show(errorEl);
  }

  return { bind, done, error };
})();