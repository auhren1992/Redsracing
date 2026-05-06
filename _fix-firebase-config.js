const fs = require('fs');
const path = require('path');

const CANON = {
  apiKey: 'AIzaSyARFiFCadGKFUc_s6x3qNX8F4jsVawkzVg',
  authDomain: 'redsracing-a7f8b.firebaseapp.com',
  databaseURL: 'https://redsracing-a7f8b-default-rtdb.firebaseio.com',
  projectId: 'redsracing-a7f8b',
  storageBucket: 'redsracing-a7f8b.firebasestorage.app',
  messagingSenderId: '517034606151',
  appId: '1:517034606151:web:24cae262e1d98832757b62',
  measurementId: 'G-YD3ZWC13SR',
};

function lines(indentInner, includeMeasurement = true) {
  const i = ' '.repeat(indentInner);
  const rows = [
    `${i}apiKey: "${CANON.apiKey}",`,
    `${i}authDomain: "${CANON.authDomain}",`,
    `${i}databaseURL: "${CANON.databaseURL}",`,
    `${i}projectId: "${CANON.projectId}",`,
    `${i}storageBucket: "${CANON.storageBucket}",`,
    `${i}messagingSenderId: "${CANON.messagingSenderId}",`,
    `${i}appId: "${CANON.appId}",`,
  ];
  if (includeMeasurement) rows.push(`${i}measurementId: "${CANON.measurementId}",`);
  return rows.join('\n');
}

const replacements = [
  // Footer newsletter module (most pages)
  {
    from: `    const firebaseConfig = {
        apiKey: "AIzaSyDu91Bi9SiF4K6P_sBjHBUNbjXjEB02X74",
        authDomain: "redsracing-a7f8b.firebaseapp.com",
        projectId: "redsracing-a7f8b",
        storageBucket: "redsracing-a7f8b.firebasestorage.app",
        messagingSenderId: "517034606151",
        appId: "1:517034606151:web:ea84d9fb6b21f5ba99c8a9"
    };`,
    to: `    const firebaseConfig = {
${lines(8)}
    };`,
  },
  // test-subscriber style
  {
    from: `        const firebaseConfig = {
            apiKey: "AIzaSyDu91Bi9SiF4K6P_sBjHBUNbjXjEB02X74",
            authDomain: "redsracing-a7f8b.firebaseapp.com",
            projectId: "redsracing-a7f8b",
            storageBucket: "redsracing-a7f8b.firebasestorage.app",
            messagingSenderId: "517034606151",
            appId: "1:517034606151:web:ea84d9fb6b21f5ba99c8a9"
        };`,
    to: `        const firebaseConfig = {
${lines(12)}
        };`,
  },
  // update-footers / temp-footer (d3f36 wrong project)
  {
    from: `        const firebaseConfig = {
            apiKey: "AIzaSyDu91Bi9SiF4K6P_sBjHBUNbjXjEB02X74",
            authDomain: "redsracing-d3f36.firebaseapp.com",
            projectId: "redsracing-d3f36",
            storageBucket: "redsracing-d3f36.firebasestorage.app",
            messagingSenderId: "536299135078",
            appId: "1:536299135078:web:ea84d9fb6b21f5ba99c8a9",
            measurementId: "G-MNHR1VW81Z"
        };`,
    to: `        const firebaseConfig = {
${lines(12)}
        };`,
  },
  // admin / team-settings / fan-settings catch (d3f36)
  {
    from: `            const firebaseConfig = {
                apiKey: "AIzaSyDu91Bi9SiF4K6P_sBjHBUNbjXjEB02X74",
                authDomain: "redsracing-d3f36.firebaseapp.com",
                projectId: "redsracing-d3f36",
                storageBucket: "redsracing-d3f36.firebasestorage.app",
                messagingSenderId: "536299135078",
                appId: "1:536299135078:web:ea84d9fb6b21f5ba99c8a9",
                measurementId: "G-MNHR1VW81Z"
            };`,
    to: `            const firebaseConfig = {
${lines(16)}
            };`,
  },
  // schedule countdown (compat)
  {
    from: `      var countdownConfig = {
        apiKey: "AIzaSyAWwholQM5RJC_LQcymKc6bM8c5hN4YKlw",
        authDomain: "redsracing-a7f8b.firebaseapp.com",
        projectId: "redsracing-a7f8b",
        storageBucket: "redsracing-a7f8b.firebasestorage.app",
        messagingSenderId: "398769104682",
        appId: "1:398769104682:web:d1cbbc92c651e94da3a5fe",
        measurementId: "G-1TJL2WK20C"
      };`,
    to: `      var countdownConfig = {
${lines(8)}
      };`,
  },
  // settings.html fallback (10-space inner keys)
  {
    from: `        const firebaseConfig = {
          apiKey: "AIzaSyAWwholQM5RJC_LQcymKc6bM8c5hN4YKlw",
          authDomain: "redsracing-a7f8b.firebaseapp.com",
          projectId: "redsracing-a7f8b",
          storageBucket: "redsracing-a7f8b.firebasestorage.app",
          messagingSenderId: "398769104682",
          appId: "1:398769104682:web:d1cbbc92c651e94da3a5fe",
          measurementId: "G-1TJL2WK20C"
        };`,
    to: `        const firebaseConfig = {
          apiKey: "${CANON.apiKey}",
          authDomain: "${CANON.authDomain}",
          databaseURL: "${CANON.databaseURL}",
          projectId: "${CANON.projectId}",
          storageBucket: "${CANON.storageBucket}",
          messagingSenderId: "${CANON.messagingSenderId}",
          appId: "${CANON.appId}",
          measurementId: "${CANON.measurementId}"
        };`,
  },
];

function walk(dir, list = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === 'node_modules' || ent.name === '.git') continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, list);
    else if (/\.(html|ps1|txt)$/i.test(ent.name)) list.push(p);
  }
  return list;
}

const root = __dirname;
let touched = 0;
for (const file of walk(root)) {
  if (path.basename(file) === '_fix-firebase-config.js') continue;
  let c = fs.readFileSync(file, 'utf8');
  const orig = c;
  for (const { from, to } of replacements) {
    if (c.includes(from)) c = c.split(from).join(to);
  }
  if (c !== orig) {
    fs.writeFileSync(file, c);
    touched++;
    console.log('updated', path.relative(root, file));
  }
}
console.log('files updated:', touched);
