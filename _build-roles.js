const fs = require('fs');
const path = require('path');
const base = 'C:/Users/Parts/Documents/Desktop/Redsracing';

// Read fan dashboard as the template foundation for structure
const fanDash = fs.readFileSync(path.join(base, 'fan/dashboard.html'), 'utf8');

// Extract the shared header/nav/style pattern
const FIREBASE_INIT = `firebase.initializeApp({apiKey:"AIzaSyARFiFCadGKFUc_s6x3qNX8F4jsVawkzVg",authDomain:"redsracing-a7f8b.firebaseapp.com",projectId:"redsracing-a7f8b",storageBucket:"redsracing-a7f8b.firebasestorage.app",messagingSenderId:"517034606151",appId:"1:517034606151:web:24cae262e1d98832757b62"});`;
const LOGOUT_JS = `document.getElementById('lo').onclick=async function(){try{localStorage.removeItem('rr_auth_uid');localStorage.removeItem('rr_signup_role');}catch(_){}try{await firebase.auth().signOut();}catch(_){}window.location.href='../signup.html';};`;
const AUTH_GATE = `firebase.auth().onAuthStateChanged(function(u){if(!u){window.location.replace('../signup.html');}});`;

const themes = {
  fan: {
    vars: `:root{--ac:#fbbf24;--ac2:#fde047;--ac3:#f59e0b;--dim:rgba(251,191,36,.12);--mid:rgba(251,191,36,.35);--bg:rgba(251,191,36,.04)}`,
    badge: '<i class="fas fa-flag-checkered"></i> Racing Fan',
    emoji: '🏁',
    navLinks: [
      ['dashboard.html','Dashboard'],['schedule.html','Schedule'],['gallery.html','Gallery'],
      ['videos.html','Videos'],['leaderboard.html','Leaderboard'],['fan-wall.html','Fan Wall'],['profile.html','Profile']
    ],
  },
  racer: {
    vars: `:root{--ac:#f97316;--ac2:#fb923c;--ac3:#ea580c;--dim:rgba(249,115,22,.12);--mid:rgba(249,115,22,.35);--bg:rgba(249,115,22,.04)}`,
    badge: '<i class="fas fa-car-side"></i> Racer',
    emoji: '🏎️',
    navLinks: [
      ['dashboard.html','Dashboard'],['schedule.html','Schedule'],['results.html','My Results'],
      ['gallery.html','Gallery'],['videos.html','Videos'],['leaderboard.html','Standings'],['profile.html','Profile']
    ],
  },
  crew: {
    vars: `:root{--ac:#06b6d4;--ac2:#22d3ee;--ac3:#0891b2;--dim:rgba(6,182,212,.12);--mid:rgba(6,182,212,.35);--bg:rgba(6,182,212,.04)}`,
    badge: '<i class="fas fa-wrench"></i> Crew Member',
    emoji: '🔧',
    navLinks: [
      ['dashboard.html','Dashboard'],['schedule.html','Schedule'],['gallery.html','Pit Photos'],
      ['videos.html','Videos'],['leaderboard.html','Standings'],['driver.html','Drivers'],['profile.html','Profile']
    ],
  }
};

// Simple page content definitions
const simplePages = {
  'leaderboard.html': { title: 'Standings', icon: 'fa-trophy', h1: '2026 Standings', body: 'Leaderboard updates as the 2026 season progresses. Check back after each race for the latest standings!' },
  'fan-wall.html': { title: 'Fan Wall', icon: 'fa-bullhorn', h1: 'Fan Wall', body: '<div style="text-align:left"><div style="margin-bottom:1rem"><select id="fw-tag" style="background:#1e293b;border:1px solid var(--dim);color:#fff;padding:.5rem;border-radius:.5rem;font-size:.85rem;width:100%;margin-bottom:.5rem"><option value="team">Team</option><option value="jon">Jon #8</option><option value="jonny">Jonny #88</option></select><textarea id="fw-text" rows="3" placeholder="Write your shoutout..." style="background:#1e293b;border:1px solid var(--dim);color:#fff;padding:.75rem;border-radius:.5rem;font-size:.85rem;width:100%;resize:none"></textarea><button id="fw-post" style="margin-top:.5rem;background:linear-gradient(45deg,var(--ac),var(--ac3));color:#0a0e17;padding:.5rem 1.5rem;border:none;border-radius:.5rem;font-weight:700;cursor:pointer;font-size:.85rem">Post Shoutout</button><div id="fw-msg" style="margin-top:.5rem;font-size:.8rem"></div></div><div id="fw-list" style="margin-top:1rem"></div></div>', hasScript: true, script: `document.getElementById('fw-post').onclick=async function(){var t=document.getElementById('fw-text').value.trim();if(!t){document.getElementById('fw-msg').innerHTML='<span style="color:#ef4444">Write something first!</span>';return;}try{await firebase.firestore().collection('fan_wall').add({text:t,tag:document.getElementById('fw-tag').value,userName:u.displayName||u.email.split('@')[0],userId:u.uid,approved:false,createdAt:firebase.firestore.FieldValue.serverTimestamp()});document.getElementById('fw-text').value='';document.getElementById('fw-msg').innerHTML='<span style="color:var(--ac)">Posted! Awaiting approval.</span>';setTimeout(function(){document.getElementById('fw-msg').innerHTML='';},3000);}catch(e){document.getElementById('fw-msg').innerHTML='<span style="color:#ef4444">Failed: '+e.message+'</span>';}};try{var snap=await firebase.firestore().collection('fan_wall').where('approved','==',true).orderBy('createdAt','desc').limit(20).get();var list=document.getElementById('fw-list');snap.forEach(function(d){var v=d.data();var div=document.createElement('div');div.style.cssText='background:rgba(15,23,42,.4);border:1px solid var(--dim);border-radius:.5rem;padding:.75rem;margin-bottom:.5rem;';var tagL=v.tag==='jon'?'Jon #8':v.tag==='jonny'?'Jonny #88':'Team';div.innerHTML='<div style="display:flex;justify-content:space-between;margin-bottom:.25rem"><span style="font-weight:700;font-size:.85rem">'+(v.userName||'Fan')+'</span><span style="font-size:.65rem;color:var(--ac);background:var(--bg);padding:.1rem .4rem;border-radius:1rem">'+tagL+'</span></div><div style="color:rgba(255,255,255,.7);font-size:.85rem">'+v.text+'</div>';list.appendChild(div);});}catch(e){console.warn('Fan wall load:',e);}` },
  'predictions.html': { title: 'Predictions', icon: 'fa-star', h1: 'Race Predictions', body: 'Predict race outcomes and compete with other fans. Make your picks before each race and see how you stack up!' },
  'qna.html': { title: 'Q&A', icon: 'fa-comments', h1: 'Ask the Team', body: 'Got questions for the drivers or crew? Submit your question and it may be answered by the team!' },
  'profile.html': { title: 'My Profile', icon: 'fa-id-card', h1: 'My Profile', body: '<div id="pdata" style="text-align:left;margin-top:1rem"></div>', hasScript: true, script: `var uu=firebase.auth().currentUser;if(uu){var dd=await firebase.firestore().collection('users').doc(uu.uid).get();var p=dd.exists?dd.data():{};document.getElementById('pdata').innerHTML='<div style="margin-bottom:.75rem"><div style="color:rgba(255,255,255,.5);font-size:.7rem;text-transform:uppercase;letter-spacing:.05em">Email</div><div style="font-weight:700">'+uu.email+'</div></div><div style="margin-bottom:.75rem"><div style="color:rgba(255,255,255,.5);font-size:.7rem;text-transform:uppercase;letter-spacing:.05em">Display Name</div><div style="font-weight:700">'+(p.displayName||uu.displayName||'Not set')+'</div></div><div style="margin-bottom:.75rem"><div style="color:rgba(255,255,255,.5);font-size:.7rem;text-transform:uppercase;letter-spacing:.05em">Role</div><div style="font-weight:700;color:var(--ac)">'+(p.signupRoleLabel||p.role||'Member')+'</div></div><div><div style="color:rgba(255,255,255,.5);font-size:.7rem;text-transform:uppercase;letter-spacing:.05em">Member Since</div><div style="font-weight:700">'+(p.joinDate?new Date(p.joinDate).toLocaleDateString():'Unknown')+'</div></div>';}` },
  'driver.html': { title: 'Jon Kirsch #8', icon: 'fa-user', h1: 'Jon Kirsch #8', body: '<div id="dp" style="text-align:left"></div>', hasScript: true, script: `try{var cfg=await firebase.firestore().collection('config').doc('site').get();var s=cfg.exists?cfg.data():{};var j=s.jon||{};document.getElementById('dp').innerHTML='<div style="display:flex;align-items:center;gap:1rem;margin-bottom:1.5rem"><div style="width:80px;height:80px;background:linear-gradient(45deg,var(--ac),var(--ac3));border-radius:1rem;display:flex;align-items:center;justify-content:center;font-size:2rem;color:#0a0e17;font-family:Racing Sans One,cursive;font-weight:900">#8</div><div><div style="font-size:1.4rem;font-weight:900">Jon Kirsch</div><div style="color:var(--ac);font-weight:700;font-size:.9rem">Car #'+(j.number||'8')+' \u2022 RedsRacing</div><div style="color:rgba(255,255,255,.4);font-size:.8rem;margin-top:.25rem">Father \u2022 Mentor \u2022 Racing Legend</div></div></div><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:.75rem;margin-bottom:1.5rem"><div style="background:var(--bg);border:1px solid var(--dim);border-radius:.6rem;padding:.75rem;text-align:center"><div style="font-family:Racing Sans One,cursive;font-size:1.6rem;color:var(--ac)">'+(j.years||'2')+'</div><div style="font-size:.6rem;color:rgba(255,255,255,.4);text-transform:uppercase;letter-spacing:.08em">Years</div></div><div style="background:var(--bg);border:1px solid var(--dim);border-radius:.6rem;padding:.75rem;text-align:center"><div style="font-family:Racing Sans One,cursive;font-size:1.6rem;color:var(--ac)">'+(j.wins||'12')+'</div><div style="font-size:.6rem;color:rgba(255,255,255,.4);text-transform:uppercase;letter-spacing:.08em">Wins</div></div><div style="background:var(--bg);border:1px solid var(--dim);border-radius:.6rem;padding:.75rem;text-align:center"><div style="font-family:Racing Sans One,cursive;font-size:1.6rem;color:var(--ac)">'+(j.podiums||'11')+'</div><div style="font-size:.6rem;color:rgba(255,255,255,.4);text-transform:uppercase;letter-spacing:.08em">Podiums</div></div><div style="background:var(--bg);border:1px solid var(--dim);border-radius:.6rem;padding:.75rem;text-align:center"><div style="font-family:Racing Sans One,cursive;font-size:1.6rem;color:var(--ac)">#8</div><div style="font-size:.6rem;color:rgba(255,255,255,.4);text-transform:uppercase;letter-spacing:.08em">Car</div></div></div><div style="margin-bottom:1.5rem"><div style="font-weight:700;margin-bottom:.5rem;font-size:.9rem">About</div><div style="color:rgba(255,255,255,.6);font-size:.85rem;line-height:1.7">'+(j.bio||'Jon Kirsch brings decades of racing passion to the track. As the driving force behind RedsRacing, he mentors the next generation while still competing at the highest level. Car #8 is a symbol of determination and family tradition on the dirt track circuit.')+'</div></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem"><a href="gallery.html" style="display:flex;align-items:center;gap:.5rem;padding:.65rem .9rem;background:var(--bg);border:1px solid var(--dim);border-radius:.55rem;text-decoration:none;color:#fff;font-size:.85rem;font-weight:600"><i class="fas fa-camera" style="color:var(--ac)"></i> Race Photos</a><a href="schedule.html" style="display:flex;align-items:center;gap:.5rem;padding:.65rem .9rem;background:var(--bg);border:1px solid var(--dim);border-radius:.55rem;text-decoration:none;color:#fff;font-size:.85rem;font-weight:600"><i class="fas fa-calendar" style="color:var(--ac)"></i> Race Schedule</a></div>';}catch(e){document.getElementById('dp').innerHTML='<div style="color:rgba(255,255,255,.4)">Failed to load driver data</div>';}` },
  'jonny.html': { title: 'Jonny Kirsch #88', icon: 'fa-user', h1: 'Jonny Kirsch #88', body: '<div id="dp" style="text-align:left"></div>', hasScript: true, script: `try{var cfg=await firebase.firestore().collection('config').doc('site').get();var s=cfg.exists?cfg.data():{};var j=s.jonny||{};document.getElementById('dp').innerHTML='<div style="display:flex;align-items:center;gap:1rem;margin-bottom:1.5rem"><div style="width:80px;height:80px;background:linear-gradient(45deg,var(--ac),var(--ac3));border-radius:1rem;display:flex;align-items:center;justify-content:center;font-size:1.8rem;color:#0a0e17;font-family:Racing Sans One,cursive;font-weight:900">#88</div><div><div style="font-size:1.4rem;font-weight:900">Jonny Kirsch</div><div style="color:var(--ac);font-weight:700;font-size:.9rem">Car #'+(j.number||'88')+' \u2022 RedsRacing</div><div style="color:rgba(255,255,255,.4);font-size:.8rem;margin-top:.25rem">Next Generation \u2022 Speed Demon \u2022 Rising Star</div></div></div><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:.75rem;margin-bottom:1.5rem"><div style="background:var(--bg);border:1px solid var(--dim);border-radius:.6rem;padding:.75rem;text-align:center"><div style="font-family:Racing Sans One,cursive;font-size:1.6rem;color:var(--ac)">'+(j.years||'1')+'</div><div style="font-size:.6rem;color:rgba(255,255,255,.4);text-transform:uppercase;letter-spacing:.08em">Years</div></div><div style="background:var(--bg);border:1px solid var(--dim);border-radius:.6rem;padding:.75rem;text-align:center"><div style="font-family:Racing Sans One,cursive;font-size:1.6rem;color:var(--ac)">'+(j.wins||'8')+'</div><div style="font-size:.6rem;color:rgba(255,255,255,.4);text-transform:uppercase;letter-spacing:.08em">Wins</div></div><div style="background:var(--bg);border:1px solid var(--dim);border-radius:.6rem;padding:.75rem;text-align:center"><div style="font-family:Racing Sans One,cursive;font-size:1.6rem;color:var(--ac)">'+(j.championships||'1')+'</div><div style="font-size:.6rem;color:rgba(255,255,255,.4);text-transform:uppercase;letter-spacing:.08em">Champs</div></div><div style="background:var(--bg);border:1px solid var(--dim);border-radius:.6rem;padding:.75rem;text-align:center"><div style="font-family:Racing Sans One,cursive;font-size:1.6rem;color:var(--ac)">#88</div><div style="font-size:.6rem;color:rgba(255,255,255,.4);text-transform:uppercase;letter-spacing:.08em">Car</div></div></div><div style="margin-bottom:1.5rem"><div style="font-weight:700;margin-bottom:.5rem;font-size:.9rem">About</div><div style="color:rgba(255,255,255,.6);font-size:.85rem;line-height:1.7">'+(j.bio||'Jonny Kirsch is the future of RedsRacing. Carrying the #88, he is quickly making a name for himself with aggressive driving and natural talent. A rising star in dirt track racing, Jonny combines raw speed with the racing wisdom passed down from his father.')+'</div></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem"><a href="gallery.html" style="display:flex;align-items:center;gap:.5rem;padding:.65rem .9rem;background:var(--bg);border:1px solid var(--dim);border-radius:.55rem;text-decoration:none;color:#fff;font-size:.85rem;font-weight:600"><i class="fas fa-camera" style="color:var(--ac)"></i> Race Photos</a><a href="videos.html" style="display:flex;align-items:center;gap:.5rem;padding:.65rem .9rem;background:var(--bg);border:1px solid var(--dim);border-radius:.55rem;text-decoration:none;color:#fff;font-size:.85rem;font-weight:600"><i class="fas fa-video" style="color:var(--ac)"></i> Race Videos</a></div>';}catch(e){document.getElementById('dp').innerHTML='<div style="color:rgba(255,255,255,.4)">Failed to load driver data</div>';}` },
  'legends.html': { title: 'Team Legends', icon: 'fa-trophy', h1: 'Team Legends', body: '<div style="font-size:1.2rem;margin-bottom:.5rem">🏆 The RedsRacing Legacy</div><div style="color:rgba(255,255,255,.5);font-size:.85rem;line-height:1.6">From humble beginnings to championship contenders, RedsRacing\'s legacy is built on family, passion, and the pursuit of victory. Every lap tells a story, every race adds to the legend.</div>' },
  'results.html': { title: 'Race Results', icon: 'fa-chart-bar', h1: 'My Race Results', body: 'Race results and season statistics will be displayed here as the 2026 season progresses. Track your performance across every race!' },
  'settings.html': { title: 'Settings', icon: 'fa-cog', h1: 'Settings', body: 'Account settings and preferences. Notification preferences, display options, and account management will be available here.' },
};

function buildNav(role, activeFile) {
  const t = themes[role];
  let nav = `<span class="badge">${t.badge}</span>`;
  t.navLinks.forEach(([href, label]) => {
    const cls = href === activeFile ? ' class="act"' : '';
    nav += `<a href="${href}"${cls}>${label}</a>`;
  });
  nav += `<button id="lo" class="lbtn"><i class="fas fa-sign-out-alt"></i></button>`;
  return nav;
}

function makeSimplePage(role, file) {
  const t = themes[role];
  const p = simplePages[file];
  if (!p) return;
  
  const navHtml = buildNav(role, file);
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${t.emoji} ${p.title} - RedsRacing</title>
  <link rel="icon" type="image/x-icon" href="../favicon.ico">
  <link href="https://fonts.googleapis.com/css2?family=Racing+Sans+One&family=Inter:wght@400;600;700;900&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-auth-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore-compat.js"></script>
  <style>
    ${t.vars}
    *{margin:0;padding:0;box-sizing:border-box}body{font-family:'Inter',sans-serif;background:linear-gradient(135deg,#0a0e17,#1a1f2e,#0a0e17);color:#fff;min-height:100vh}
    header{position:sticky;top:0;z-index:100;background:rgba(10,14,23,.9);backdrop-filter:blur(20px);border-bottom:1px solid var(--dim)}
    nav{max-width:1100px;margin:0 auto;padding:.5rem 1.25rem;display:flex;justify-content:space-between;align-items:center}
    .logo{font-family:'Racing Sans One',cursive;font-size:1.3rem;text-decoration:none;letter-spacing:.08em}.lb{color:#3b82f6}.ly{color:var(--ac)}
    .nr{display:flex;gap:.5rem;align-items:center;flex-wrap:wrap}.nr a{color:rgba(255,255,255,.6);text-decoration:none;font-weight:600;font-size:.78rem;padding:.3rem .6rem;border-radius:.4rem;transition:all .2s}.nr a:hover,.nr a.act{background:var(--bg);color:var(--ac)}
    .badge{display:inline-flex;align-items:center;gap:.3rem;padding:.15rem .55rem;border-radius:2rem;font-size:.6rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;border:1px solid var(--dim);background:var(--bg);color:var(--ac)}
    .lbtn{background:linear-gradient(45deg,#ef4444,#dc2626);color:#fff;padding:.3rem .7rem;border-radius:.4rem;border:none;font-weight:700;font-size:.75rem;cursor:pointer}
    main{max-width:1100px;margin:0 auto;padding:1.5rem 1.25rem;position:relative;z-index:10}
    h1{font-family:'Racing Sans One',cursive;font-size:clamp(1.4rem,3vw,2.2rem);background:linear-gradient(45deg,var(--ac),var(--ac2));-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:1.5rem;text-transform:uppercase;letter-spacing:.04em}
    .content{background:rgba(15,23,42,.5);border:1px solid var(--dim);border-radius:.9rem;padding:2rem;text-align:center}
    .content i.big{font-size:3rem;color:var(--ac);margin-bottom:1rem;display:block}
    .content .t{font-size:1.1rem;font-weight:700;margin-bottom:.5rem}
    .content .d{color:rgba(255,255,255,.4);font-size:.85rem}
    .content a{color:var(--ac)}
    @media(max-width:640px){nav{flex-direction:column;gap:.4rem}.nr{justify-content:center}}
  </style>
</head>
<body>
  <header><nav>
    <a href="dashboard.html" class="logo"><span class="lb">Reds</span><span class="ly">Racing</span></a>
    <div class="nr">${navHtml}</div>
  </nav></header>
  <main>
    <h1><i class="fas ${p.icon}" style="margin-right:.5rem"></i>${p.h1}</h1>
    <div class="content"><i class="fas ${p.icon} big"></i><div class="t">${p.title}</div><div class="d">${p.body}</div></div>
  </main>
  <script>${FIREBASE_INIT}${LOGOUT_JS}
firebase.auth().onAuthStateChanged(async function(u){if(!u){window.location.replace('../signup.html');return;}${p.hasScript ? p.script : ''}});</script>
</body>
</html>`;

  const dir = path.join(base, role);
  fs.writeFileSync(path.join(dir, file), html);
}

// Build simple pages for all 3 roles
Object.keys(themes).forEach(role => {
  Object.keys(simplePages).forEach(file => {
    // Skip fan-wall and predictions for racer/crew (not in their nav)
    makeSimplePage(role, file);
  });
  console.log(`Created ${Object.keys(simplePages).length} simple pages for ${role}/`);
});

// Now clone fan's schedule.html, gallery.html, videos.html to racer/ and crew/ with theme changes
['schedule.html', 'gallery.html', 'videos.html'].forEach(file => {
  const fanFile = fs.readFileSync(path.join(base, 'fan', file), 'utf8');
  
  ['racer', 'crew'].forEach(role => {
    const t = themes[role];
    let html = fanFile
      // Swap CSS vars
      .replace(/:root\{[^}]+\}/, t.vars)
      // Swap badge
      .replace(/<span class="badge">.*?<\/span>/, `<span class="badge">${t.badge}</span>`)
      // Swap title emoji
      .replace(/🏁/g, t.emoji)
      // Swap nav links
      .replace(/<a href="fan-wall\.html">Fan Wall<\/a>/, role === 'racer' ? '<a href="results.html">My Results</a>' : '<a href="driver.html">Drivers</a>')
      // Swap logo color
      .replace(/.ly\{color:#fbbf24\}/, `.ly{color:${t.vars.match(/--ac:([^;]+)/)[1]}}`);
    
    fs.writeFileSync(path.join(base, role, file), html);
  });
  console.log(`Cloned ${file} to racer/ and crew/`);
});

// Clone fan dashboard to racer and crew with theme + content changes
const racerDash = fanDash
  .replace(/:root\{[^}]+\}/, themes.racer.vars)
  .replace(/🏁/g, '🏎️')
  .replace(/<span class="badge">.*?<\/span>/, `<span class="badge">${themes.racer.badge}</span>`)
  .replace(/Racing Fan/g, 'Racer')
  .replace(/Welcome Back, Fan!/g, 'Ready to Race! 🏎️')
  .replace(/.ly\{color:#fbbf24\}/, `.ly{color:#f97316}`)
  .replace(/<a href="fan-wall\.html">Fan Wall<\/a>/, '<a href="results.html">My Results</a>')
  .replace(/'fa-rocket','Fan Zone'/g, "'fa-tachometer-alt','Driver Tools'")
  .replace(/'fa-users','Community'/g, "'fa-user','My Profile'")
  .replace(/'fa-heart','Team'/g, "'fa-trophy','Season'")
  .replace(/'Fan Wall','Shoutouts & support'/g, "'Live Race','Go live on race day'")
  .replace(/fan-wall\.html/g, '../live.html')
  .replace(/'Predictions','Predict race outcomes'/g, "'My Results','Season stats & lap times'")
  .replace(/predictions\.html/g, 'results.html')
  .replace(/'Q&A','Ask the team'/g, "'Videos','Race highlights'")
  .replace(/'Sponsorship','Support the team'/g, "'Settings','Account preferences'")
  .replace(/\.\.\/sponsorship\.html/g, 'settings.html');

fs.writeFileSync(path.join(base, 'racer/dashboard.html'), racerDash);
console.log('Created racer/dashboard.html');

const crewDash = fanDash
  .replace(/:root\{[^}]+\}/, themes.crew.vars)
  .replace(/🏁/g, '🔧')
  .replace(/<span class="badge">.*?<\/span>/, `<span class="badge">${themes.crew.badge}</span>`)
  .replace(/Racing Fan/g, 'Crew Member')
  .replace(/Welcome Back, Fan!/g, 'Welcome Back, Crew! 🔧')
  .replace(/.ly\{color:#fbbf24\}/, `.ly{color:#06b6d4}`)
  .replace(/<a href="fan-wall\.html">Fan Wall<\/a>/, '<a href="driver.html">Drivers</a>')
  .replace(/'fa-rocket','Fan Zone'/g, "'fa-tools','Crew Tools'")
  .replace(/'fa-users','Community'/g, "'fa-clipboard-list','Team Hub'")
  .replace(/'fa-heart','Team'/g, "'fa-cog','Settings'")
  .replace(/'Fan Wall','Shoutouts & support'/g, "'Live Race','Real-time updates'")
  .replace(/fan-wall\.html/g, '../live.html')
  .replace(/'Predictions','Predict race outcomes'/g, "'Pit Photos','Upload crew shots'")
  .replace(/predictions\.html/g, 'gallery.html')
  .replace(/'Q&A','Ask the team'/g, "'Team Standings','Track performance'")
  .replace(/'Sponsorship','Support the team'/g, "'Settings','Account preferences'")
  .replace(/\.\.\/sponsorship\.html/g, 'settings.html');

fs.writeFileSync(path.join(base, 'crew/dashboard.html'), crewDash);
console.log('Created crew/dashboard.html');

// Count total files
let total = 0;
['fan','racer','crew'].forEach(r => {
  const files = fs.readdirSync(path.join(base, r)).filter(f => f.endsWith('.html'));
  total += files.length;
  console.log(`${r}/: ${files.length} files`);
});
console.log(`Total: ${total} role-specific pages`);
