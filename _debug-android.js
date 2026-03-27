var fs = require('fs');
var src = 'C:/Users/Parts/Documents/Desktop/Redsracing/admin-console.html';
var dst = 'C:/Users/Parts/Documents/Desktop/Redsracing/android/app/src/main/assets/www/admin-console.html';

// Start fresh from root copy
var f = fs.readFileSync(src, 'utf8');

// 1. Strip the mobile pill nav (between markers)
var s1 = f.indexOf('<!-- Mobile Navigation -->');
var e1 = f.indexOf('<!-- Dashboard Content -->');
if (s1 > -1 && e1 > -1) {
  f = f.substring(0, s1) + f.substring(e1);
}

// 2. Hide sidebar by default, make it a slide-out drawer
f = f.replace(
  'sidebar-nav w-64 lg:w-72 flex-shrink-0 hidden md:block',
  'sidebar-nav'
);

// 3. Inject hamburger + drawer CSS/JS before </head>
var inject = `
<style>
  .sidebar-nav { display:none; position:fixed; top:0; left:0; width:280px; height:100vh; z-index:9999; overflow-y:auto; background:rgba(15,23,42,0.98); backdrop-filter:blur(20px); border-right:1px solid rgba(148,163,184,0.1); transition:transform 0.3s ease; transform:translateX(-100%); }
  .sidebar-nav.open { display:block; transform:translateX(0); }
  .sidebar-overlay { display:none; position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.5); z-index:9998; }
  .sidebar-overlay.open { display:block; }
  #hamburger-btn { position:fixed; top:8px; left:8px; z-index:9997; background:#1e293b; border:1px solid rgba(148,163,184,0.15); color:#fbbf24; width:40px; height:40px; border-radius:8px; display:flex; align-items:center; justify-content:center; font-size:18px; cursor:pointer; box-shadow:0 2px 8px rgba(0,0,0,0.3); }
</style>
`;
f = f.replace('</head>', inject + '</head>');

// 4. Inject hamburger button + overlay + JS after <body...>
var bodyTag = f.indexOf('<body');
var bodyEnd = f.indexOf('>', bodyTag);
var afterBody = bodyEnd + 1;
var hamburgerHtml = `
<button id="hamburger-btn" onclick="toggleSidebar()"><i class="fas fa-bars"></i></button>
<div id="sidebar-overlay" class="sidebar-overlay" onclick="toggleSidebar()"></div>
<script>
function toggleSidebar(){
  var sb=document.querySelector('.sidebar-nav');
  var ov=document.getElementById('sidebar-overlay');
  if(sb.classList.contains('open')){sb.classList.remove('open');ov.classList.remove('open');}
  else{sb.classList.add('open');ov.classList.add('open');}
}
// Close sidebar when clicking a nav link
document.addEventListener('click',function(e){
  if(e.target.closest&&e.target.closest('.nav-item')){
    var sb=document.querySelector('.sidebar-nav');
    var ov=document.getElementById('sidebar-overlay');
    if(sb)sb.classList.remove('open');
    if(ov)ov.classList.remove('open');
  }
});
</script>
`;
f = f.substring(0, afterBody) + hamburgerHtml + f.substring(afterBody);

// 5. Make flex container stack vertically
f = f.replace('class="flex min-h-screen"', 'class="flex flex-col min-h-screen"');

fs.writeFileSync(dst, f);
console.log('Done - hamburger drawer menu for Android admin console');
console.log('File size:', f.length);
