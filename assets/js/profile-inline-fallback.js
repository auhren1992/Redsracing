// Inline fallback for profile.html if the module fails to initialize.
// Runs after 8 seconds; if loading spinner is still visible, show a graceful error.

(function () {
  function showProfileFallback() {
    var loading = document.getElementById('loading-state');
    var content = document.getElementById('profile-content');
    if (!loading || !content) return;

    // Only act if the loader is still visible
    var isHidden = loading.classList.contains('hidden') || loading.style.display === 'none';
    if (isHidden) return;

    loading.classList.add('hidden');
    loading.style.display = 'none';

    content.innerHTML = '' +
      '<div class="text-center py-20">' +
      '  <h1 class="text-5xl font-racing uppercase mb-2">User <span class="neon-yellow">Profile</span></h1>' +
      '  <div class="text-yellow-400 mb-6">' +
      '    <div class="text-6xl mb-4">⚠️</div>' +
      '    <h2 class="text-2xl font-bold">Profile Temporarily Unavailable</h2>' +
      '    <p class="mt-2">We're unable to load your profile right now.</p>' +
      '    <p class="text-sm text-slate-400 mt-2">This could be a temporary connectivity or service issue.</p>' +
      '  </div>' +
      '  <div class="space-x-4">' +
      '    <button onclick="window.location.reload()" class="bg-blue-600 text-white font-bold py-2 px-4 rounded-md hover:bg-blue-500 transition">Try Again</button>' +
      '    <a href="index.html" class="bg-slate-600 text-white font-bold py-2 px-4 rounded-md hover:bg-slate-500 transition">Go Home</a>' +
      '  </div>' +
      '</div>';

    content.classList.remove('hidden');
  }

  // Run after 8s if module hasn't hidden the loader
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      setTimeout(showProfileFallback, 8000);
    });
  } else {
    setTimeout(showProfileFallback, 8000);
  }
})();