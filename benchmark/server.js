#!/usr/bin/env node
// benchmark/server.js — zero npm deps, Node 18+
// Usage: node benchmark/server.js
//        (run from repo root or from benchmark/ directory)

import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = 3474;

// ─── Load .env ────────────────────────────────────────────────────────────────
function loadEnv() {
  const envPath = resolve(__dirname, '.env');
  if (!existsSync(envPath)) {
    console.warn('[warn] benchmark/.env not found — copy .env.example and fill in keys');
    return;
  }
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (key && val && !process.env[key]) process.env[key] = val;
  }
}
loadEnv();

const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY || '';

console.log('[bench] OpenRouter key:', OPENROUTER_KEY ? '✓ (Claude + Jev)' : '⚠ no key');
console.log(`[bench] Open http://localhost:${PORT}\n`);

// ─── Proxy helpers ────────────────────────────────────────────────────────────
async function proxyJson(targetUrl, init) {
  const res = await fetch(targetUrl, init);
  const body = await res.json().catch(() => ({ error: 'non-json response' }));
  return { status: res.status, body };
}

// ─── Route handlers ───────────────────────────────────────────────────────────
async function handleStatus() {
  return {
    claude:   OPENROUTER_KEY ? 'openrouter' : null,
    typesafe: !!OPENROUTER_KEY,   // Jev runs via OpenRouter too
  };
}

async function handleClaude(reqBody) {
  if (!OPENROUTER_KEY) return { status: 503, body: { error: 'OPENROUTER_API_KEY not set in .env' } };

  const sys     = reqBody.system || '';
  const userMsg = reqBody.messages?.[0]?.content || '';

  const { status, body } = await proxyJson('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${OPENROUTER_KEY}`,
      'HTTP-Referer':  'http://localhost:' + PORT,
    },
    body: JSON.stringify({
      model:      'anthropic/claude-haiku-4-5',
      max_tokens: reqBody.max_tokens || 150,
      messages: [
        { role: 'system', content: sys },
        { role: 'user',   content: userMsg },
      ],
    }),
  });

  // Normalise OpenRouter response to Anthropic shape so the client doesn't care
  if (status === 200 && body.choices) {
    const text  = body.choices[0]?.message?.content || '';
    const usage = body.usage || {};
    return {
      status: 200,
      body: {
        content: [{ text }],
        usage: { input_tokens: usage.prompt_tokens || 0, output_tokens: usage.completion_tokens || 0 },
      },
    };
  }
  return { status, body };
}

async function handleTypesafe(reqBody) {
  if (!OPENROUTER_KEY) return { status: 503, body: { error: 'OPENROUTER_API_KEY not set in .env' } };

  // Jev via OpenRouter — translate the three questions to a structured prompt
  // since OpenRouter uses the OpenAI chat format, not Typesafe's native API.
  const { state, questions } = reqBody;
  const questionLines = Object.entries(questions).map(([key, q]) => {
    if (q.type === 'choice') {
      const opts = Object.entries(q.criteria).map(([k, v]) => `  - ${k}: ${v}`).join('\n');
      return `${key} (pick one):\n${opts}`;
    }
    if (q.type === 'score') {
      const levels = q.criteria.map((c, i) => `  ${i}: ${c}`).join('\n');
      return `${key} (score 0-${q.criteria.length - 1}):\n${levels}`;
    }
    return `${key} (yes=1/no=0): ${q.instructions}`;
  }).join('\n\n');

  const prompt = `Analyze this web page and answer each question with a JSON object.\n\n${state}\n\nQuestions:\n${questionLines}\n\nRespond ONLY with minified JSON where each key matches the question name. For choice questions use the exact option key. For score questions use the integer. For noul questions use 0 or 1.\nExample: {"verdict":"allow","subject_area":"math","distraction_risk":1}`;

  const { status, body } = await proxyJson('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${OPENROUTER_KEY}`,
      'HTTP-Referer':  'http://localhost:' + PORT,
    },
    body: JSON.stringify({
      model:      'typesafe/jev-router',
      max_tokens: 200,
      messages:   [{ role: 'user', content: prompt }],
    }),
  });

  if (status !== 200 || !body.choices) return { status, body };

  // Parse Jev's JSON response and normalise to Typesafe native shape
  const text = body.choices[0]?.message?.content || '';
  let parsed = {};
  try {
    const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    parsed = JSON.parse(clean);
  } catch { /* fall through with empty answers */ }

  const answers = {};
  for (const [key, q] of Object.entries(questions)) {
    const val = parsed[key];
    if (q.type === 'choice') {
      answers[key] = { type: 'choice', choice: val || Object.keys(q.criteria)[0], confidence: 0.8, probabilities: {} };
    } else if (q.type === 'score') {
      answers[key] = { type: 'score', score: Number(val) || 0, legend: Object.fromEntries(q.criteria.map((c,i) => [i, c])), probabilities: {} };
    } else {
      answers[key] = { type: 'noul', noul: Number(val) || 0 };
    }
  }

  const usage = body.usage || {};
  return {
    status: 200,
    body: { answers, usage: { input_tokens: usage.prompt_tokens || 0, output_tokens: usage.completion_tokens || 0 } },
  };
}

// ─── HTTP server ──────────────────────────────────────────────────────────────
createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // CORS for local dev
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // Serve index.html
  if (req.method === 'GET' && url.pathname === '/') {
    const html = readFileSync(resolve(__dirname, 'index.html'), 'utf8');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
    return;
  }

  // Serve scraped dataset if available
  if (req.method === 'GET' && url.pathname === '/api/dataset') {
    const datasetPath = resolve(__dirname, 'dataset.json');
    if (existsSync(datasetPath)) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(readFileSync(datasetPath, 'utf8'));
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'dataset.json not found — run: npm run scrape' }));
    }
    return;
  }

  // Status
  if (req.method === 'GET' && url.pathname === '/api/status') {
    const data = await handleStatus();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
    return;
  }

  // API proxy — read body
  if (req.method === 'POST' && ['/api/claude', '/api/typesafe'].includes(url.pathname)) {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    let reqBody;
    try { reqBody = JSON.parse(raw); } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'invalid json' }));
      return;
    }

    const { status, body } = url.pathname === '/api/claude'
      ? await handleClaude(reqBody)
      : await handleTypesafe(reqBody);

    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
    return;
  }

  res.writeHead(404); res.end();
}).listen(PORT);
