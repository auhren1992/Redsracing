/**
 * Injects the same primary nav + mobile menu used on the public site into
 * fan/crew/racer hub pages (served from a subfolder). Expects a mount node:
 *   <div id="rr-role-hub-nav-mount"></div>
 * Configure via script tag:
 *   <script src="../assets/js/role-hub-shell.js" data-hub="fan"></script>
 * data-hub: "fan" | "crew" (controls login link + hub label)
 */
(function () {
  'use strict';

  var mount = document.getElementById('rr-role-hub-nav-mount');
  if (!mount) return;

  var scr = document.currentScript;
  var hub = (scr && scr.getAttribute('data-hub')) || 'fan';
  var R = (scr && scr.getAttribute('data-root')) || '..';

  var loginHref;
  var loginLabel;
  var hubLabel;
  var hubColor;
  if (hub === 'crew') {
    loginHref = R + '/login.html';
    loginLabel = 'Crew login';
    hubLabel = 'Crew workspace';
    hubColor = 'text-cyan-400 border-cyan-500/40 bg-cyan-500/10';
  } else if (hub === 'racer') {
    loginHref = R + '/login.html';
    loginLabel = 'Driver login';
    hubLabel = 'Racer hub';
    hubColor = 'text-orange-400 border-orange-500/40 bg-orange-500/10';
  } else {
    loginHref = R + '/follower-login.html';
    loginLabel = 'Fan login';
    hubLabel = 'Fan hub';
    hubColor = 'text-amber-400 border-amber-500/40 bg-amber-500/10';
  }

  function h(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/"/g, '&quot;');
  }

  var html =
    '<header class="bg-black/30 backdrop-blur-md sticky w-full top-0 z-50 border-b border-slate-700/50">' +
    '  <nav class="container mx-auto px-6 py-3 flex justify-between items-center gap-3">' +
    '    <div class="flex items-center gap-2 md:gap-4 min-w-0">' +
    '      <a href="' + h(R) + '/index.html" class="text-3xl sm:text-4xl font-racing uppercase tracking-wider shrink-0 rr-brand">' +
    '        <span class="logo-blue">Reds</span><span class="logo-yellow">Racing</span>' +
    '      </a>' +
    '      <span class="hidden sm:inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ' +
    hubColor +
    '">' +
    h(hubLabel) +
    '</span>' +
    '    </div>' +
    '    <div class="hidden md:flex items-center space-x-5 font-bold">' +
    '      <a href="' + h(R) + '/index.html" class="nav-link">🏠 Home</a>' +
    '      <div class="relative dropdown">' +
    '        <button type="button" class="dropdown-toggle nav-link">🏎️ Drivers <i class="fas fa-chevron-down"></i></button>' +
    '        <div class="dropdown-menu modern-dropdown">' +
    '          <div class="relative dropdown-nested">' +
    '            <button type="button" class="dropdown-item dropdown-nested-toggle flex items-center justify-between w-full"><span>Jon Kirsch #8</span><i class="fas fa-chevron-right ml-2 text-xs"></i></button>' +
    '            <div class="dropdown-menu-nested modern-dropdown">' +
    '              <a href="' + h(R) + '/driver.html" class="dropdown-item">👤 Profile</a>' +
    '              <a href="' + h(R) + '/gallery.html" class="dropdown-item">📸 Gallery</a>' +
    '            </div>' +
    '          </div>' +
    '          <div class="relative dropdown-nested">' +
    '            <button type="button" class="dropdown-item dropdown-nested-toggle flex items-center justify-between w-full"><span>Jonny Kirsch #88</span><i class="fas fa-chevron-right ml-2 text-xs"></i></button>' +
    '            <div class="dropdown-menu-nested modern-dropdown">' +
    '              <a href="' + h(R) + '/jonny.html" class="dropdown-item">👤 Profile</a>' +
    '              <a href="' + h(R) + '/jonny-gallery.html" class="dropdown-item">📸 Gallery</a>' +
    '              <a href="' + h(R) + '/jonny-results.html" class="dropdown-item">📊 Race Results</a>' +
    '            </div>' +
    '          </div>' +
    '          <a href="' + h(R) + '/legends.html" class="dropdown-item">Team Legends</a>' +
    '        </div>' +
    '      </div>' +
    '      <div class="relative dropdown">' +
    '        <button type="button" class="dropdown-toggle nav-link">🏁 Racing <i class="fas fa-chevron-down"></i></button>' +
    '        <div class="dropdown-menu modern-dropdown">' +
    '          <a href="' + h(R) + '/schedule.html" class="dropdown-item">Schedule</a>' +
    '          <a href="' + h(R) + '/leaderboard.html" class="dropdown-item">Leaderboard</a>' +
    '          <a href="' + h(R) + '/videos.html" class="dropdown-item">🎥 Videos</a>' +
    '        </div>' +
    '      </div>' +
    '      <div class="relative dropdown">' +
    '        <button type="button" class="dropdown-toggle nav-link">👥 Community <i class="fas fa-chevron-down"></i></button>' +
    '        <div class="dropdown-menu modern-dropdown">' +
    '          <a href="' + h(R) + '/qna.html" class="dropdown-item">❓ Q&amp;A</a>' +
    '          <a href="' + h(R) + '/feedback.html" class="dropdown-item">💬 Feedback</a>' +
    '          <a href="' + h(R) + '/sponsorship.html" class="dropdown-item">💰 Sponsorship</a>' +
    '        </div>' +
    '      </div>' +
    '      <div id="auth-section">' +
    '        <a href="' + h(loginHref) + '" id="login-btn" class="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md font-bold transition duration-300 flex items-center space-x-1">' +
    '          <i class="fas fa-sign-in-alt"></i><span>' +
    h(loginLabel) +
    '</span></a>' +
    '        <div id="user-profile" class="relative dropdown hidden">' +
    '          <button type="button" class="dropdown-toggle flex items-center space-x-2 bg-slate-800/50 hover:bg-slate-700/50 px-3 py-2 rounded-lg border border-slate-600/50 hover:border-slate-500/50 transition-colors">' +
    '            <div class="w-7 h-7 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center"><i class="fas fa-user text-white text-xs"></i></div>' +
    '            <div class="text-left hidden md:block">' +
    '              <div class="text-sm font-semibold text-white" id="user-name">Member</div>' +
    '              <div class="text-xs text-slate-400">Signed in</div>' +
    '            </div>' +
    '            <i class="fas fa-chevron-down text-slate-400 text-xs"></i>' +
    '          </button>' +
    '          <div class="dropdown-menu modern-dropdown right-0 w-44">' +
    '            <div class="px-4 py-2 border-b border-slate-600/50">' +
    '              <div class="flex items-center space-x-2">' +
    '                <div class="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div><span class="text-green-400 text-sm">Online</span>' +
    '              </div>' +
    '            </div>' +
    '            <a href="dashboard.html" class="dropdown-item flex items-center"><i class="fas fa-th-large w-4 mr-3 text-blue-400"></i><span>My hub</span></a>' +
    '            <a href="' + h(R) + '/profile.html" class="dropdown-item flex items-center"><i class="fas fa-user w-4 mr-3 text-green-400"></i><span>My Profile</span></a>' +
    '            <div class="border-t border-slate-600/50 my-1"></div>' +
    '            <button type="button" id="user-logout" class="dropdown-item flex items-center w-full text-left hover:bg-red-600/10 hover:text-red-400">' +
    '              <i class="fas fa-sign-out-alt w-4 mr-3 text-red-400"></i><span>Sign Out</span>' +
    '            </button>' +
    '          </div>' +
    '        </div>' +
    '      </div>' +
    '    </div>' +
    '    <div class="md:hidden flex items-center space-x-3 shrink-0">' +
    '      <div id="mobile-clock" class="text-yellow-400 font-bold text-sm bg-slate-800/50 px-3 py-1 rounded-lg border border-slate-600/50">12:00 PM</div>' +
    '      <button type="button" id="mobile-menu-button" class="text-white focus:outline-none" aria-label="Open menu">' +
    '        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16m-7 6h7"></path></svg>' +
    '      </button>' +
    '    </div>' +
    '  </nav>' +
    '  <div id="mobile-menu" class="mobile-menu modern-mobile hidden">' +
    '    <a href="' + h(R) + '/index.html" class="mobile-nav-item">🏠 Home</a>' +
    '    <button type="button" class="mobile-accordion"><span>🏎️ Drivers</span><i class="fas fa-chevron-down accordion-icon"></i></button>' +
    '    <div class="mobile-accordion-content">' +
    '      <button type="button" class="mobile-accordion mobile-accordion-nested"><span>Jon Kirsch #8</span><i class="fas fa-chevron-down accordion-icon"></i></button>' +
    '      <div class="mobile-accordion-content mobile-accordion-content-nested">' +
    '        <a href="' + h(R) + '/driver.html" class="mobile-nav-subitem mobile-nav-subitem-nested">👤 Profile</a>' +
    '        <a href="' + h(R) + '/gallery.html" class="mobile-nav-subitem mobile-nav-subitem-nested">📸 Gallery</a>' +
    '      </div>' +
    '      <button type="button" class="mobile-accordion mobile-accordion-nested"><span>Jonny Kirsch #88</span><i class="fas fa-chevron-down accordion-icon"></i></button>' +
    '      <div class="mobile-accordion-content mobile-accordion-content-nested">' +
    '        <a href="' + h(R) + '/jonny.html" class="mobile-nav-subitem mobile-nav-subitem-nested">👤 Profile</a>' +
    '        <a href="' + h(R) + '/jonny-gallery.html" class="mobile-nav-subitem mobile-nav-subitem-nested">📸 Gallery</a>' +
    '        <a href="' + h(R) + '/jonny-results.html" class="mobile-nav-subitem mobile-nav-subitem-nested">📊 Race Results</a>' +
    '      </div>' +
    '      <a href="' + h(R) + '/legends.html" class="mobile-nav-subitem">Team Legends</a>' +
    '    </div>' +
    '    <button type="button" class="mobile-accordion"><span>🏁 Racing</span><i class="fas fa-chevron-down accordion-icon"></i></button>' +
    '    <div class="mobile-accordion-content">' +
    '      <a href="' + h(R) + '/schedule.html" class="mobile-nav-subitem">Schedule</a>' +
    '      <a href="' + h(R) + '/leaderboard.html" class="mobile-nav-subitem">Leaderboard</a>' +
    '      <a href="' + h(R) + '/videos.html" class="mobile-nav-subitem">🎥 Videos</a>' +
    '    </div>' +
    '    <button type="button" class="mobile-accordion"><span>👥 Community</span><i class="fas fa-chevron-down accordion-icon"></i></button>' +
    '    <div class="mobile-accordion-content">' +
    '      <a href="' + h(R) + '/qna.html" class="mobile-nav-subitem">❓ Q&amp;A</a>' +
    '      <a href="' + h(R) + '/feedback.html" class="mobile-nav-subitem">💬 Feedback</a>' +
    '      <a href="' + h(R) + '/sponsorship.html" class="mobile-nav-subitem">💰 Sponsorship</a>' +
    '    </div>' +
    '    <div class="border-t border-slate-600 mt-4 pt-4">' +
    '      <div id="mobile-auth-section">' +
    '        <a href="' + h(loginHref) + '" id="mobile-login-btn" class="mobile-login-btn bg-red-600 hover:bg-red-700">' +
    '          <i class="fas fa-sign-in-alt mr-2"></i>' +
    h(loginLabel) +
    '</a>' +
    '        <div id="mobile-user-profile" class="hidden">' +
    '          <div class="bg-slate-800/50 rounded-lg p-3 mb-3">' +
    '            <div class="flex items-center space-x-3 mb-3">' +
    '              <div class="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center"><i class="fas fa-user text-white"></i></div>' +
    '              <div>' +
    '                <div class="text-white font-semibold" id="mobile-user-name">Member</div>' +
    '                <div class="text-slate-400 text-sm">Signed in</div>' +
    '                <div class="flex items-center space-x-1 mt-1">' +
    '                  <div class="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div><span class="text-green-400 text-xs">Online</span>' +
    '                </div>' +
    '              </div>' +
    '            </div>' +
    '            <div class="space-y-1">' +
    '              <a href="dashboard.html" class="mobile-nav-item flex items-center p-2 rounded"><i class="fas fa-th-large w-5 mr-3 text-blue-400"></i><span>My hub</span></a>' +
    '              <a href="' + h(R) + '/profile.html" class="mobile-nav-item flex items-center p-2 rounded"><i class="fas fa-user w-5 mr-3 text-green-400"></i><span>My Profile</span></a>' +
    '              <button type="button" id="mobile-user-logout" class="mobile-nav-item flex items-center p-2 rounded w-full text-left hover:bg-red-600/10 hover:text-red-400">' +
    '                <i class="fas fa-sign-out-alt w-5 mr-3 text-red-400"></i><span>Sign Out</span>' +
    '              </button>' +
    '            </div>' +
    '          </div>' +
    '        </div>' +
    '      </div>' +
    '    </div>' +
    '  </div>' +
    '</header>';

  mount.innerHTML = html;
})();
