var fs = require('fs');
var p = 'C:/Users/Parts/Documents/Desktop/Redsracing/android/app/src/main/assets/www/admin-console.html';
var f = fs.readFileSync(p, 'utf8');
// Force sidebar visible with inline style
f = f.replace(
  'class="sidebar-nav w-full flex-shrink-0"',
  'class="sidebar-nav" style="display:block !important; width:100% !important; position:relative !important; flex-shrink:0"'
);
console.log('Sidebar class found:', f.indexOf('sidebar-nav') > -1);
fs.writeFileSync(p, f);
console.log('Done - sidebar forced visible with inline style');
