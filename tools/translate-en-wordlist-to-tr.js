// Translates tools/en-wordlist.txt (EN) into Turkish using an AI API and writes wordlists/genel.txt
// Requires: OPENAI_API_KEY env var
// Optional: OPENAI_MODEL (default: gpt-4o-mini)
//
// Usage:
//   node tools/fetch-en-wordlist.js
//   setx OPENAI_API_KEY "..."   (PowerShell: setx OPENAI_API_KEY "..."; restart terminal)
//   node tools/translate-en-wordlist-to-tr.js
//
// Notes:
// - This runs locally on your machine and produces a Turkish list file.
// - Output is uppercased (TR locale) and deduplicated.

const fs = require('fs');
const path = require('path');
const https = require('https');

const API_KEY = process.env.OPENAI_API_KEY;
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

const IN_PATH = path.join(__dirname, 'en-wordlist.txt');
const OUT_PATH = path.join(__dirname, '..', 'wordlists', 'genel.txt');

function normalizeTr(s) {
  return String(s || '')
    .trim()
    .replace(/^\uFEFF/, '')
    .replace(/\s+/g, ' ')
    .toLocaleUpperCase('tr-TR');
}

function postJson(url, headers, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request(
      {
        hostname: u.hostname,
        path: u.pathname + u.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
          ...headers
        }
      },
      (res) => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          if (res.statusCode !== 200) {
            reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 4000)}`));
            return;
          }
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error(`Bad JSON: ${e.message}\n${data.slice(0, 4000)}`));
          }
        });
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function translateBatch(words) {
  // Use Responses API (works with recent OpenAI API versions)
  // We ask for strict JSON array output of same length.
  const prompt = [
    'Translate each English codenames-style word into natural Turkish.',
    'Rules:',
    '- Output MUST be a JSON array of strings.',
    '- Same number of items, same order.',
    '- Keep it short (1-3 Turkish words).',
    '- No explanations, no numbering.',
    '- Avoid special characters unless Turkish letters.',
    '- Prefer common everyday Turkish words.',
    '',
    'Words:',
    ...words.map((w) => `- ${w}`)
  ].join('\n');

  const body = JSON.stringify({
    model: MODEL,
    input: prompt,
    temperature: 0.2,
    max_output_tokens: 3000
  });

  const json = await postJson(
    'https://api.openai.com/v1/responses',
    { Authorization: `Bearer ${API_KEY}` },
    body
  );

  // The Responses API returns output_text in some SDKs; raw API uses output[].content[].text
  let text = '';
  try {
    const out = json.output || [];
    for (const item of out) {
      const content = item.content || [];
      for (const c of content) {
        if (c.type === 'output_text' && typeof c.text === 'string') text += c.text;
        if (c.type === 'text' && typeof c.text === 'string') text += c.text;
      }
    }
  } catch (_) {
    // ignore
  }
  if (!text && typeof json.output_text === 'string') text = json.output_text;

  text = String(text || '').trim();
  // Try to parse as JSON array
  let arr;
  try {
    arr = JSON.parse(text);
  } catch (e) {
    // Sometimes model wraps in code fences
    const stripped = text.replace(/^```(json)?/i, '').replace(/```$/i, '').trim();
    arr = JSON.parse(stripped);
  }
  if (!Array.isArray(arr) || arr.length !== words.length) {
    throw new Error(`Unexpected translate output. Expected array length ${words.length}, got ${Array.isArray(arr) ? arr.length : typeof arr}`);
  }
  return arr.map(normalizeTr);
}

(async () => {
  if (!API_KEY) {
    console.error('Missing OPENAI_API_KEY env var.');
    process.exit(1);
  }
  if (!fs.existsSync(IN_PATH)) {
    console.error(`Missing ${IN_PATH}. Run: node tools/fetch-en-wordlist.js`);
    process.exit(1);
  }

  const raw = fs
    .readFileSync(IN_PATH, 'utf8')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const enWords = Array.from(new Set(raw));

  const BATCH = 40;
  const translated = [];

  for (let i = 0; i < enWords.length; i += BATCH) {
    const batch = enWords.slice(i, i + BATCH);
    process.stdout.write(`Translating ${i + 1}-${Math.min(i + BATCH, enWords.length)} / ${enWords.length}... `);
    // Retry a couple times for formatting hiccups
    let out;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        out = await translateBatch(batch);
        break;
      } catch (e) {
        if (attempt === 3) throw e;
        process.stdout.write(`retry(${attempt})... `);
        await new Promise((r) => setTimeout(r, 800 * attempt));
      }
    }
    translated.push(...out);
    console.log('ok');
    await new Promise((r) => setTimeout(r, 200));
  }

  const uniqueTr = Array.from(new Set(translated.map(normalizeTr))).filter(Boolean);
  if (uniqueTr.length < 25) {
    console.error(`Too few Turkish words produced: ${uniqueTr.length}`);
    process.exit(1);
  }

  const header = [
    '# AUTO-GENERATED from tools/en-wordlist.txt via AI translation',
    '# You can edit/curate this list. One word/phrase per line.',
    '# Lines starting with # are ignored by the server.',
    ''
  ].join('\n');

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, header + uniqueTr.join('\n') + '\n', 'utf8');

  console.log(`\nWrote Turkish wordlist: ${OUT_PATH}`);
})();
