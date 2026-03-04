#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const exts = new Set(['.js', '.ts', '.jsx', '.tsx', '.html']);
const errors = [];
const SELF = path.join('scripts', 'validate_firebase_imports.js');

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full);
    } else if (exts.has(path.extname(entry.name))) {
      const rel = path.relative(ROOT, full).replace(/\\/g, '/');
      if (rel === SELF.replace(/\\/g, '/')) {
        return; // ignore this validator script itself
      }
      const content = fs.readFileSync(full, 'utf8');
      // Find bare firebase imports like "from 'firebase/..." or dynamic import('firebase/...')
      const bareModuleRegex = /from\s+['\"]firebase\//g;
      const dynamicBareRegex = /import\(\s*['\"]firebase\//g;
      if (bareModuleRegex.test(content) || dynamicBareRegex.test(content)) {
        errors.push(full);
      }
    }
  }
}

walk(ROOT);

if (errors.length) {
  console.error('Bare Firebase imports detected in the following files:');
  for (const f of errors) console.error(' - ' + path.relative(ROOT, f));
  console.error('Please switch to CDN imports, e.g. https://www.gstatic.com/firebasejs/9.22.0/firebase-*.js');
  process.exit(1);
} else {
  console.log('OK: No bare Firebase imports found.');
}
