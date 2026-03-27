var fs = require('fs');
var src = 'C:/Users/Parts/Documents/Desktop/Redsracing/admin-console.html';
var dst = 'C:/Users/Parts/Documents/Desktop/Redsracing/android/app/src/main/assets/www/admin-console.html';

// Start fresh from root copy every time
var f = fs.readFileSync(src, 'utf8');

// 1. Strip the web mobile pill nav
var s1 = f.indexOf('<!-- Mobile Navigation -->');
var e1 = f.indexOf('<!-- Dashboard Content -->');
if (s1 > -1 && e1 > -1) {
  f = f.substring(0, s1) + f.substring(e1);
  console.log('Stripped mobile pill nav');
}

// 2. Change sidebar classes — remove hidden/md:block, keep sidebar-nav
f = f.replace(
  'sidebar-nav w-64 lg:w-72 flex-shrink-0 hidden md:block',
  'sidebar-nav android-drawer'
);
console.log('Updated sidebar classes');

// 3. Completely remove the original sidebar from the HTML
var asideStart = f.indexOf('<aside');
var asideEnd = f.indexOf('</aside>', asideStart);
if (asideStart > -1 && asideEnd > -1) {
  f = f.substring(0, asideStart) + f.substring(asideEnd + 8);
  console.log('Removed original <aside> sidebar entirely');
}

// 4. Remove desktop-only sidebar CSS
f = f.replace(
  /\/\* Force sidebar visible on desktop \*\/[\s\S]*?@media \(min-width: 768px\) \{[\s\S]*?\.sidebar-nav \{[\s\S]*?display: block !important;[\s\S]*?\}[\s\S]*?\}/,
  ''
);

// 5. Build the entire drawer menu with INLINE STYLES - zero class dependencies
var menuSections = [
  { label: 'Dashboard', items: [
    { hash: '#overview', icon: 'fa-tachometer-alt', color: '#3b82f6', text: 'Overview' },
    { hash: '#analytics', icon: 'fa-chart-line', color: '#10b981', text: 'Analytics' },
    { hash: '#health', icon: 'fa-heartbeat', color: '#10b981', text: 'Site Health' },
  ]},
  { label: 'Racing', items: [
    { hash: '#schedule-mgmt', icon: 'fa-calendar-alt', color: '#22c55e', text: 'Schedule' },
    { hash: '#race', icon: 'fa-flag-checkered', color: '#eab308', text: 'Race Results' },
    { hash: 'live-race-admin.html', icon: 'fa-broadcast-tower', color: '#ef4444', text: 'Live Updates' },
    { hash: 'push-notifications.html', icon: 'fa-bell', color: '#f97316', text: 'Notifications' },
  ]},
  { label: 'Content', items: [
    { hash: '#media', icon: 'fa-photo-video', color: '#a855f7', text: 'Media Gallery' },
    { hash: '#videos', icon: 'fa-video', color: '#ec4899', text: 'Videos' },
    { hash: '#qna', icon: 'fa-comments', color: '#06b6d4', text: 'Q&A' },
    { hash: '#fanwall', icon: 'fa-bullhorn', color: '#f97316', text: 'Fan Wall' },
  ]},
  { label: 'Operations', items: [
    { hash: '#inbox', icon: 'fa-inbox', color: '#06b6d4', text: 'Admin Inbox' },
    { hash: '#raceday', icon: 'fa-flag', color: '#ef4444', text: 'Race Day' },
    { hash: '#audit', icon: 'fa-history', color: '#f59e0b', text: 'Audit Trail' },
    { hash: '#data-quality', icon: 'fa-check-double', color: '#14b8a6', text: 'Data Quality' },
    { hash: '#releases', icon: 'fa-rocket', color: '#6366f1', text: 'Releases' },
  ]},
  { label: 'Admin', items: [
    { hash: '#advanced', icon: 'fa-user-shield', color: '#facc15', text: 'Team & Roles' },
    { hash: '#logs', icon: 'fa-bug', color: '#ef4444', text: 'Error Logs' },
    { hash: 'settings.html', icon: 'fa-cog', color: '#94a3b8', text: 'Settings' },
  ]},
];

var menuHTML = '';
menuSections.forEach(function(sec) {
  menuHTML += '<div style="padding:0 16px;margin-bottom:12px;">';
  menuHTML += '<div style="font-size:9px;text-transform:uppercase;letter-spacing:1.5px;color:#64748b;font-weight:700;padding:0 4px 6px;">' + sec.label + '</div>';
  sec.items.forEach(function(item) {
    var isHash = item.hash.startsWith('#');
    menuHTML += '<a href="' + item.hash + '" onclick="closeDrawer()" style="display:flex;align-items:center;gap:10px;padding:8px 12px;margin-bottom:2px;border-radius:8px;text-decoration:none;color:#cbd5e1;font-size:13px;font-weight:500;transition:background 0.2s;">';
    menuHTML += '<i class="fas ' + item.icon + '" style="color:' + item.color + ';width:18px;font-size:12px;text-align:center;"></i>';
    menuHTML += '<span>' + item.text + '</span></a>';
  });
  menuHTML += '</div>';
});

var drawerHTML = `
<div id="android-menu-drawer" style="position:fixed;top:0;left:0;width:280px;height:100vh;z-index:10000;background:#0f172a;border-right:1px solid rgba(148,163,184,0.1);overflow-y:auto;transform:translateX(-100%);transition:transform 0.3s ease;-webkit-overflow-scrolling:touch;">
    <div style="padding:16px;border-bottom:1px solid rgba(148,163,184,0.08);display:flex;align-items:center;gap:10px;">
    <div style="width:36px;height:36px;background:linear-gradient(135deg,#fbbf24,#f97316);border-radius:8px;display:flex;align-items:center;justify-content:center;"><i class="fas fa-crown" style="color:white;font-size:14px;"></i></div>
    <div style="flex:1;"><div style="font-size:13px;font-weight:700;color:white;">Command Center</div><div style="font-size:10px;color:#64748b;">RedsRacing Admin</div></div>
    <button onclick="closeDrawer()" style="width:32px;height:32px;border-radius:8px;border:1px solid rgba(148,163,184,0.15);background:rgba(148,163,184,0.08);color:#94a3b8;display:flex;align-items:center;justify-content:center;font-size:16px;cursor:pointer;"><i class="fas fa-times"></i></button>
  </div>
  <div style="padding:12px 0;">
    ${menuHTML}
  </div>
</div>
<div id="android-menu-overlay" onclick="closeDrawer()" style="display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:9999;"></div>
<button id="android-hamburger" onclick="openDrawer()" style="position:fixed;top:10px;left:10px;z-index:9998;background:#1e293b;border:1px solid rgba(251,191,36,0.2);color:#fbbf24;width:42px;height:42px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:20px;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,0.4);">
  <i class="fas fa-bars"></i>
</button>
<script>
function openDrawer(){
  document.getElementById('android-menu-drawer').style.transform='translateX(0)';
  document.getElementById('android-menu-overlay').style.display='block';
}
function closeDrawer(){
  document.getElementById('android-menu-drawer').style.transform='translateX(-100%)';
  document.getElementById('android-menu-overlay').style.display='none';
}
</script>
`;

// 6. Inject after <body> tag
var bodyIdx = f.indexOf('<body');
var bodyClose = f.indexOf('>', bodyIdx);
var insertAt = bodyClose + 1;
f = f.substring(0, insertAt) + drawerHTML + f.substring(insertAt);
console.log('Injected hamburger + drawer + overlay with inline styles');

// 7. Stack layout
f = f.replace('class="flex min-h-screen"', 'class="flex flex-col min-h-screen"');

fs.writeFileSync(dst, f);
console.log('DONE. File size:', f.length);
