// Fetches the EN wordlist from the provided GitHub raw URL and saves it locally.
// Usage: node tools/fetch-en-wordlist.js

const https = require('https');
const fs = require('fs');
const path = require('path');

const RAW_URL = 'https://raw.githubusercontent.com/sagelga/codenames/main/wordlist/en-EN/default/wordlist.txt';
const OUT_PATH = path.join(__dirname, 'en-wordlist.txt');

function fetchText(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { 'User-Agent': 'codenamesv1-wordlist-fetcher' } }, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          fetchText(res.headers.location).then(resolve, reject);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        res.setEncoding('utf8');
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => resolve(data));
      })
      .on('error', reject);
  });
}

(async () => {
  const txt = await fetchText(RAW_URL);
  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, txt, 'utf8');
  console.log(`Saved: ${OUT_PATH}`);
})();
