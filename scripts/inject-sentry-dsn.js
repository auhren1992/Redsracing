const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function getDsn() {
  if (process.env.SENTRY_DSN) return process.env.SENTRY_DSN;
  try {
    const out = execSync('firebase functions:config:get sentry', { stdio: ['ignore','pipe','ignore'] }).toString().trim();
    if (!out || out === 'null' || out === '{}') return null;
    const obj = JSON.parse(out);
    if (obj && typeof obj === 'object' && obj.dsn) return obj.dsn;
  } catch {}
  return null;
}

const dsn = getDsn();
if (!dsn) {
  console.log('[inject-sentry-dsn] No DSN found in env or functions config; skipping injection.');
  process.exit(0);
}

const rootDir = path.resolve(__dirname, '..');
if (!fs.existsSync(rootDir)) {
  console.log('[inject-sentry-dsn] root directory not found; skipping.');
  process.exit(0);
}

const files = [];
(function walk(dir) {
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const it of items) {
    const p = path.join(dir, it.name);
    if (it.isDirectory() && !it.name.startsWith('.') && it.name !== 'node_modules' && it.name !== 'dist') walk(p);
    else if (it.isFile() && p.endsWith('.html')) files.push(p);
  }
})(rootDir);

const emptyNeedle = '<meta name="sentry-dsn" content="" />';
const dsnsNeedleRegex = /<meta name="sentry-dsn" content="[^"]*" \/>/g;
const replaced = `<meta name="sentry-dsn" content="${dsn}" />`;
let count = 0;
for (const file of files) {
  let txt = fs.readFileSync(file, 'utf8');
  let changed = false;
  
  // Replace empty DSN
  if (txt.includes(emptyNeedle)) {
    txt = txt.replace(emptyNeedle, replaced);
    changed = true;
  }
  
  // Replace existing DSN
  if (dsnsNeedleRegex.test(txt)) {
    txt = txt.replace(dsnsNeedleRegex, replaced);
    changed = true;
  }
  
  if (changed) {
    fs.writeFileSync(file, txt, 'utf8');
    count++;
  }
}
console.log(`[inject-sentry-dsn] Injected DSN into ${count} file(s).`);
