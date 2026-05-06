/**
 * One-off: align stale inline firebaseConfig blocks with assets/js/firebase-config.js
 * Fixes Firestore WebChannel Listen 400 (API key / appId mismatch vs project).
 */
const fs = require("fs");
const path = require("path");

const CANON_4 = `    const firebaseConfig = {
        apiKey: "AIzaSyARFiFCadGKFUc_s6x3qNX8F4jsVawkzVg",
        authDomain: "redsracing-a7f8b.firebaseapp.com",
        databaseURL: "https://redsracing-a7f8b-default-rtdb.firebaseio.com",
        projectId: "redsracing-a7f8b",
        storageBucket: "redsracing-a7f8b.firebasestorage.app",
        messagingSenderId: "517034606151",
        appId: "1:517034606151:web:24cae262e1d98832757b62",
        measurementId: "G-YD3ZWC13SR"
    };`;

const OLD_DU91 = `    const firebaseConfig = {
        apiKey: "AIzaSyDu91Bi9SiF4K6P_sBjHBUNbjXjEB02X74",
        authDomain: "redsracing-a7f8b.firebaseapp.com",
        projectId: "redsracing-a7f8b",
        storageBucket: "redsracing-a7f8b.firebasestorage.app",
        messagingSenderId: "517034606151",
        appId: "1:517034606151:web:ea84d9fb6b21f5ba99c8a9"
    };`;

const OLD_PARTIAL_ARFI = `    const firebaseConfig = {
        apiKey: "AIzaSyARFiFCadGKFUc_s6x3qNX8F4jsVawkzVg",
        authDomain: "redsracing-a7f8b.firebaseapp.com",
        projectId: "redsracing-a7f8b",
        storageBucket: "redsracing-a7f8b.firebasestorage.app",
        messagingSenderId: "517034606151",
        appId: "1:517034606151:web:24cae262e1d98832757b62"
    };`;

const NEW_COUNTDOWN = `      var countdownConfig = {
        apiKey: "AIzaSyARFiFCadGKFUc_s6x3qNX8F4jsVawkzVg",
        authDomain: "redsracing-a7f8b.firebaseapp.com",
        databaseURL: "https://redsracing-a7f8b-default-rtdb.firebaseio.com",
        projectId: "redsracing-a7f8b",
        storageBucket: "redsracing-a7f8b.firebasestorage.app",
        messagingSenderId: "517034606151",
        appId: "1:517034606151:web:24cae262e1d98832757b62",
        measurementId: "G-YD3ZWC13SR"
      };`;

const OLD_COUNTDOWN = `      var countdownConfig = {
        apiKey: "AIzaSyAWwholQM5RJC_LQcymKc6bM8c5hN4YKlw",
        authDomain: "redsracing-a7f8b.firebaseapp.com",
        projectId: "redsracing-a7f8b",
        storageBucket: "redsracing-a7f8b.firebasestorage.app",
        messagingSenderId: "398769104682",
        appId: "1:398769104682:web:d1cbbc92c651e94da3a5fe",
        measurementId: "G-1TJL2WK20C"
      };`;

const NEW_SETTINGS = `        const firebaseConfig = {
          apiKey: "AIzaSyARFiFCadGKFUc_s6x3qNX8F4jsVawkzVg",
          authDomain: "redsracing-a7f8b.firebaseapp.com",
          databaseURL: "https://redsracing-a7f8b-default-rtdb.firebaseio.com",
          projectId: "redsracing-a7f8b",
          storageBucket: "redsracing-a7f8b.firebasestorage.app",
          messagingSenderId: "517034606151",
          appId: "1:517034606151:web:24cae262e1d98832757b62",
          measurementId: "G-YD3ZWC13SR"
        };`;

const OLD_SETTINGS = `        const firebaseConfig = {
          apiKey: "AIzaSyAWwholQM5RJC_LQcymKc6bM8c5hN4YKlw",
          authDomain: "redsracing-a7f8b.firebaseapp.com",
          projectId: "redsracing-a7f8b",
          storageBucket: "redsracing-a7f8b.firebasestorage.app",
          messagingSenderId: "398769104682",
          appId: "1:398769104682:web:d1cbbc92c651e94da3a5fe",
          measurementId: "G-1TJL2WK20C"
        };`;

const OLD_D3F36 = `            const firebaseConfig = {
                apiKey: "AIzaSyDu91Bi9SiF4K6P_sBjHBUNbjXjEB02X74",
                authDomain: "redsracing-d3f36.firebaseapp.com",
                projectId: "redsracing-d3f36",
                storageBucket: "redsracing-d3f36.firebasestorage.app",
                messagingSenderId: "536299135078",
                appId: "1:536299135078:web:ea84d9fb6b21f5ba99c8a9",
                measurementId: "G-MNHR1VW81Z"
            };`;

const NEW_D3F36 = `            const firebaseConfig = {
                apiKey: "AIzaSyARFiFCadGKFUc_s6x3qNX8F4jsVawkzVg",
                authDomain: "redsracing-a7f8b.firebaseapp.com",
                databaseURL: "https://redsracing-a7f8b-default-rtdb.firebaseio.com",
                projectId: "redsracing-a7f8b",
                storageBucket: "redsracing-a7f8b.firebasestorage.app",
                messagingSenderId: "517034606151",
                appId: "1:517034606151:web:24cae262e1d98832757b62",
                measurementId: "G-YD3ZWC13SR"
            };`;

const pairs = [
  [OLD_DU91, CANON_4],
  [OLD_PARTIAL_ARFI, CANON_4],
  [OLD_COUNTDOWN, NEW_COUNTDOWN],
  [OLD_SETTINGS, NEW_SETTINGS],
  [OLD_D3F36, NEW_D3F36],
];

function walk(dir, list = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === "node_modules" || ent.name === ".git") continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, list);
    else if (ent.name.endsWith(".html")) list.push(p);
  }
  return list;
}

const root = path.resolve(__dirname);
let touched = 0;
/** CRLF-safe: newsletter block with wrong apiKey (Du91 / old appId). */
const reNewsletterStale =
  /const firebaseConfig = \{[\s\r\n]*apiKey:\s*"AIzaSyDu91Bi9SiF4K6P_sBjHBUNbjXjEB02X74"[\s\S]*?appId:\s*"1:517034606151:web:ea84d9fb6b21f5ba99c8a9"[\s\r\n]*\};/g;

/** Countdown compat block with wrong keys. */
const reCountdownStale =
  /var countdownConfig = \{[\s\r\n]*apiKey:\s*"AIzaSyAWwholQM5RJC_LQcymKc6bM8c5hN4YKlw"[\s\S]*?measurementId:\s*"G-1TJL2WK20C"[\s\r\n]*\};/g;

/** settings.html fallback (AWwhol / wrong app). */
const reSettingsStale =
  /const firebaseConfig = \{[\s\r\n]*apiKey:\s*"AIzaSyAWwholQM5RJC_LQcymKc6bM8c5hN4YKlw"[\s\S]*?measurementId:\s*"G-1TJL2WK20C"[\s\r\n]*\};/g;

/** Android admin/settings catch blocks pointing at old d3f36 project. */
const reD3Stale =
  /const firebaseConfig = \{[\s\r\n]*apiKey:\s*"AIzaSyDu91Bi9SiF4K6P_sBjHBUNbjXjEB02X74"[\s\S]*?measurementId:\s*"G-MNHR1VW81Z"[\s\r\n]*\};/g;

for (const file of walk(root)) {
  if (path.basename(file).startsWith("_sync-")) continue;
  if (file.includes(`${path.sep}android${path.sep}app${path.sep}build${path.sep}`)) continue;
  let c = fs.readFileSync(file, "utf8");
  const orig = c;
  for (const [from, to] of pairs) {
    if (c.includes(from)) c = c.split(from).join(to);
  }
  c = c.replace(reNewsletterStale, CANON_4);
  c = c.replace(reCountdownStale, NEW_COUNTDOWN);
  c = c.replace(reSettingsStale, NEW_SETTINGS);
  c = c.replace(reD3Stale, NEW_D3F36);
  if (c !== orig) {
    fs.writeFileSync(file, c);
    touched++;
    console.log("updated", path.relative(root, file));
  }
}
console.log("html files updated:", touched);
