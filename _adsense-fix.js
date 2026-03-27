const fs = require('fs');
const path = require('path');
const base = 'C:/Users/Parts/Documents/Desktop/Redsracing';

// Pages that should NOT have ads (low content, navigation, auth, admin, debug)
const removeAdsFrom = [
  'index.html',        // countdown page only
  'signup.html',       // auth form
  'login.html',        // auth form
  'follower-dashboard.html', // router/redirect
  'admin-console.html', // admin tool
  'dashboard.html',    // router
  'settings.html',     // settings form
  'profile.html',      // profile form
  'live.html',         // live updates
  'push-notifications.html', // admin tool
  'live-race-admin.html',    // admin tool
];

const adsenseScript = '<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8879853783053353"\n         crossorigin="anonymous"></script>';
const adsenseScriptAlt = '<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8879853783053353" crossorigin="anonymous"></script>';

let removed = 0;
removeAdsFrom.forEach(file => {
  const fp = path.join(base, file);
  if (!fs.existsSync(fp)) return;
  let content = fs.readFileSync(fp, 'utf8');
  if (content.indexOf('pagead2.googlesyndication.com') > -1) {
    // Remove the script tag (various formats)
    content = content.replace(/\s*<script async src="https:\/\/pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js\?client=ca-pub-\d+"\s*crossorigin="anonymous"><\/script>\s*/g, '\n');
    // Also remove any ad unit divs
    content = content.replace(/<ins class="adsbygoogle"[\s\S]*?<\/ins>\s*<script>\s*\(adsbygoogle[\s\S]*?<\/script>/g, '');
    fs.writeFileSync(fp, content);
    removed++;
    console.log('Removed ads from:', file);
  }
});
console.log('Removed ads from', removed, 'pages');

// Also remove from debug/test pages in Android assets
const androidAssets = path.join(base, 'android/app/src/main/assets');
const debugFiles = fs.readdirSync(androidAssets).filter(f => 
  f.includes('debug') || f.includes('test') || f === 'temp_nav.html'
);
debugFiles.forEach(file => {
  const fp = path.join(androidAssets, file);
  if (!fs.statSync(fp).isFile()) return;
  let content = fs.readFileSync(fp, 'utf8');
  if (content.indexOf('pagead2.googlesyndication.com') > -1) {
    content = content.replace(/\s*<script async src="https:\/\/pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js\?client=ca-pub-\d+"\s*crossorigin="anonymous"><\/script>\s*/g, '\n');
    fs.writeFileSync(fp, content);
    console.log('Removed ads from Android:', file);
  }
});

console.log('\nDone removing ads from low-content pages');
