// Creates a translation template CSV from tools/en-wordlist.txt
// Output columns: en,tr
// Usage:
//   node tools/fetch-en-wordlist.js
//   node tools/make-translation-template.js

const fs = require('fs');
const path = require('path');

const IN_PATH = path.join(__dirname, 'en-wordlist.txt');
const OUT_PATH = path.join(__dirname, 'translation-template.csv');

function csvEscape(s) {
  if (s == null) return '';
  const t = String(s);
  if (/[,"\n\r]/.test(t)) return `"${t.replace(/"/g, '""')}"`;
  return t;
}

if (!fs.existsSync(IN_PATH)) {
  console.error(`Missing ${IN_PATH}. Run: node tools/fetch-en-wordlist.js`);
  process.exit(1);
}

const lines = fs
  .readFileSync(IN_PATH, 'utf8')
  .split(/\r?\n/)
  .map((l) => l.trim())
  .filter(Boolean);

const unique = Array.from(new Set(lines));
let out = 'en,tr\n';
for (const en of unique) {
  out += `${csvEscape(en)},\n`;
}

fs.writeFileSync(OUT_PATH, out, 'utf8');
console.log(`Saved: ${OUT_PATH}`);
