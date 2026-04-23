/**
 * classifier.js — Claude Haiku page classifier
 *
 * Loaded by background.js via importScripts('classifier.js').
 * Global entry point: self.FocusGuardClassifier.classifyPage({url, title})
 *
 * Returns a promise that always resolves to:
 *   { verdict: 'allow'|'block', reason, confidence, source }
 *
 * Never throws. Always fail-open (allow) on error — we don't want
 * bugs here to break the child's ability to use the browser.
 */

'use strict';

// --- Config ---

const MODEL = 'claude-haiku-4-5';
const API_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';
// Generous enough to absorb cold-start DNS/TLS setup on the first request
// after a service-worker wake. Haiku typically responds in <1s when warm.
const REQUEST_TIMEOUT_MS = 15000;
const MAX_TOKENS = 150;
const CACHE_MAX_ENTRIES = 500;

// --- Global namespace ---

self.FocusGuardClassifier = self.FocusGuardClassifier || {};

// --- Cache (in-memory LRU) ---

const verdictCache = new Map();  // url -> {verdict, reason, confidence}

function cacheGet(url) {
  if (!verdictCache.has(url)) return null;
  // LRU bump: delete + reinsert so insertion order reflects recency
  const entry = verdictCache.get(url);
  verdictCache.delete(url);
  verdictCache.set(url, entry);
  return entry;
}

function cachePut(url, entry) {
  if (verdictCache.has(url)) verdictCache.delete(url);
  verdictCache.set(url, entry);
  // Evict oldest if over capacity
  if (verdictCache.size > CACHE_MAX_ENTRIES) {
    const oldestKey = verdictCache.keys().next().value;
    verdictCache.delete(oldestKey);
  }
}

// --- Dev seeding (Phase 2, before Phase 6 setup UI exists) ---
// To test locally, paste into the service worker DevTools console:
//
//   chrome.storage.local.set({ apiKey: 'sk-ant-api03-...' })
//
// Then reload any page. The key is read on demand and cached
// per-worker-lifetime. Phase 6 will replace this with a setup form.

// --- API key retrieval ---

let cachedApiKey = null;

async function getApiKey() {
  if (cachedApiKey) return cachedApiKey;
  try {
    const { apiKey } = await chrome.storage.local.get('apiKey');
    if (apiKey && typeof apiKey === 'string' && apiKey.startsWith('sk-ant-')) {
      cachedApiKey = apiKey;
      return apiKey;
    }
  } catch (e) {
    console.warn('[FocusGuard] Failed to read API key:', e);
  }
  return null;
}

// --- Allowlist (parent-managed URL bypass list) ---
// Entries are substrings matched against the URL. An allowlist hit returns
// `allow` immediately, skipping both the verdict cache and the API call.

let cachedAllowlist = null;

async function getAllowlist() {
  if (Array.isArray(cachedAllowlist)) return cachedAllowlist;
  try {
    const { allowlist } = await chrome.storage.local.get('allowlist');
    cachedAllowlist = Array.isArray(allowlist)
      ? allowlist.filter((e) => typeof e === 'string' && e.length > 0)
      : [];
  } catch {
    cachedAllowlist = [];
  }
  return cachedAllowlist;
}

function matchAllowlist(url, list) {
  for (const entry of list) {
    if (entry && url.includes(entry)) return entry;
  }
  return null;
}

// Invalidate when storage changes.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.apiKey) {
    const next = changes.apiKey.newValue;
    cachedApiKey = (typeof next === 'string' && next.startsWith('sk-ant-')) ? next : null;
  }
  if (changes.allowlist) {
    const next = changes.allowlist.newValue;
    cachedAllowlist = Array.isArray(next)
      ? next.filter((e) => typeof e === 'string' && e.length > 0)
      : [];
  }
});

// --- System prompt (tuned for moderate filtering per PRD) ---

const SYSTEM_PROMPT = `You are FocusGuard, a classifier that decides whether a web page is appropriate for a student focused on homework.

You will receive a URL and the page title. Classify as one of:
- "allow" — homework, education, reference, research, general knowledge, news, school tools (Google Classroom, Docs, Drive, Khan Academy, etc.)
- "block" — games, gaming videos, social media, entertainment videos, memes, shopping, streaming, anything clearly off-task

Policy:
- Moderate filtering. Allow legitimate research even on broad sites.
- YouTube homepage (path "/" with no search query, e.g. https://www.youtube.com/ or https://youtube.com/) = allow. The bare landing page by itself is not off-task.
- YouTube specific URLs (/watch, /results, /shorts, /gaming, /feed/trending, /@channel) classify by the topic in the title — math, science, history, tutorials, educational content = allow; gaming, entertainment, memes, trending feeds, music videos = block.
- Wikipedia, news sites, dictionaries, reference sites = allow.
- Roblox, Fortnite, TikTok, Instagram, Twitch, gaming news sites = block.
- If truly uncertain, prefer allow (fail open).

Respond ONLY with minified JSON in this exact shape — no prose, no markdown, no code fences:
{"verdict":"allow","reason":"<short>","confidence":<0..1>}`;

// --- API call ---

async function callClaude(apiKey, url, title) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  // Defense against prompt injection via attacker-controlled titles:
  // strip newlines so the title can't visually spawn a new prompt section,
  // and cap length to keep token usage predictable.
  const safeUrl = String(url).slice(0, 500);
  const safeTitle = String(title || '(no title)').replace(/[\r\n]+/g, ' ').slice(0, 200);

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': API_VERSION,
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: `URL: ${safeUrl}\nTitle: ${safeTitle}`,
        }],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      console.warn('[FocusGuard] API error:', response.status);
      return null;
    }

    const data = await response.json();
    const text = data?.content?.[0]?.text || '';
    return parseVerdict(text);
  } catch (e) {
    if (e.name === 'AbortError') {
      console.warn('[FocusGuard] API timeout');
    } else {
      console.warn('[FocusGuard] API failure:', e.message);
    }
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function parseVerdict(text) {
  try {
    // Strip any accidental code fences
    const cleaned = text.trim().replace(/^```(?:json)?\s*/, '').replace(/```$/, '').trim();
    const parsed = JSON.parse(cleaned);
    const verdict = parsed.verdict === 'block' ? 'block' : 'allow';
    const reason = typeof parsed.reason === 'string' ? parsed.reason.slice(0, 200) : '';
    const confidence = typeof parsed.confidence === 'number'
      ? Math.max(0, Math.min(1, parsed.confidence))
      : 0.5;
    return { verdict, reason, confidence };
  } catch {
    return null;  // caller will fail-open
  }
}

// --- Public API ---

// Throttle the "no API key" console warning so it fires once per
// worker lifetime instead of once per page visit.
let warnedNoKey = false;

async function classifyPage({ url, title }) {
  // Guard: skip internal URLs entirely (defense in depth — background.js also filters)
  if (!url || url.startsWith('chrome://') ||
      url.startsWith('chrome-extension://') ||
      url.startsWith('about:') ||
      url.startsWith('file://')) {
    return { verdict: 'allow', reason: 'internal', confidence: 1, source: 'fallback' };
  }

  // Parent allowlist wins over both cache and API — removing an entry
  // means subsequent visits fall through to normal classification.
  const allowlist = await getAllowlist();
  const matched = matchAllowlist(url, allowlist);
  if (matched) {
    return {
      verdict: 'allow',
      reason: `allowlisted: ${matched}`,
      confidence: 1,
      source: 'allowlist',
    };
  }

  const cached = cacheGet(url);
  if (cached) {
    return { ...cached, source: 'cache' };
  }

  const apiKey = await getApiKey();
  if (!apiKey) {
    if (!warnedNoKey) {
      console.warn('[FocusGuard] No API key set — allowing by default');
      warnedNoKey = true;
    }
    return { verdict: 'allow', reason: 'no-api-key', confidence: 1, source: 'fallback' };
  }

  const parsed = await callClaude(apiKey, url, title || '');
  if (!parsed) {
    // fail-open without caching — let next visit retry
    return { verdict: 'allow', reason: 'api-error', confidence: 1, source: 'fallback' };
  }

  cachePut(url, parsed);
  return { ...parsed, source: 'api' };
}

self.FocusGuardClassifier.classifyPage = classifyPage;
