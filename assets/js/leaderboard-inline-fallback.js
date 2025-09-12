// Inline fallback for leaderboard.html if the module fails to initialize.
// After 8 seconds, reveal the error state if the loader is still visible.

(function () {
  function showLeaderboardFallback() {
    var loading = document.getElementById('loading-state');
    var content = document.getElementById('leaderboard-content');
    var errorState = document.getElementById('error-state');

    if (!loading) return;

    var isHidden = loading.classList.contains('hidden') || loading.style.display === 'none';
    if (isHidden) return;

    loading.classList.add('hidden');
    loading.style.display = 'none';

    if (errorState) {
      errorState.classList.remove('hidden');
    } else if (content) {
      // Inject a generic message if no dedicated error state exists
      content.innerHTML = '' +
        '<div class="text-center py-20">' +
        '  <h1 class="text-5xl font-racing uppercase mb-2">Achievement <span class="neon-yellow">Leaderboard</span></h1>' +
        '  <div class="text-yellow-400 mb-6">' +
        '    <div class="text-6xl mb-4">⚠️</div>' +
        '    <h2 class="text-2xl font-bold">Leaderboard Temporarily Unavailable</h2>' +
        '    <p class="mt-2">We're unable to load the leaderboard right now.</p>' +
        '    <p class="text-sm text-slate-400 mt-2">This could be a temporary connectivity or service issue.</p>' +
        '  </div>' +
        '  <div class="space-x-4">' +
        '    <button onclick="window.location.reload()" class="bg-blue-600 text-white font-bold py-2 px-4 rounded-md hover:bg-blue-500 transition">Try Again</button>' +
        '    <a href="index.html" class="bg-slate-600 text-white font-bold py-2 px-4 rounded-md hover:bg-slate-500 transition">Go Home</a>' +
        '  </div>' +
        '</div>';
      content.classList.remove('hidden');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      setTimeout(showLeaderboardFallback, 8000);
    });
  } else {
    setTimeout(showLeaderboardFallback, 8000);
  }
})();