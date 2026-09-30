// focusguard/lib/classifier-pure.js — pure functions, no Chrome or DOM deps.
// Imported by both classifier.js (service worker) and tests/.

export const CACHE_MAX_ENTRIES = 500;

export const STRIP_PARAMS = new Set([
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'utm_id',
  'fbclid', 'gclid', 'msclkid', 'twclid', 'li_fat_id', 'yclid', 'igshid',
  'si', 'feature', 'pp', 'ref', 'ref_src', 'ref_url', '_ga',
]);

export function normalizeForCache(url) {
  try {
    const u = new URL(url);
    for (const key of [...u.searchParams.keys()]) {
      if (STRIP_PARAMS.has(key)) u.searchParams.delete(key);
    }
    return u.toString();
  } catch {
    return url;
  }
}

export function parseVerdict(text) {
  try {
    const cleaned = text.trim().replace(/^```(?:json)?\s*/, '').replace(/```$/, '').trim();
    const parsed = JSON.parse(cleaned);
    const verdict = parsed.verdict === 'block' ? 'block' : 'allow';
    const reason = typeof parsed.reason === 'string' ? parsed.reason.slice(0, 200) : '';
    const confidence = typeof parsed.confidence === 'number'
      ? Math.max(0, Math.min(1, parsed.confidence)) : 0.5;
    return { verdict, reason, confidence };
  } catch { return null; }
}

// Returns a fresh { cacheGet, cachePut, cache } instance.
// cache is the underlying Map — exposed so hydrateCache/persistCache can
// read and write it directly for storage persistence.
export function makeLRU() {
  const cache = new Map();
  function cacheGet(url) {
    if (!cache.has(url)) return null;
    const entry = cache.get(url);
    cache.delete(url);
    cache.set(url, entry);
    return entry;
  }
  function cachePut(url, entry) {
    if (cache.has(url)) cache.delete(url);
    cache.set(url, entry);
    if (cache.size > CACHE_MAX_ENTRIES) cache.delete(cache.keys().next().value);
  }
  return { cacheGet, cachePut, cache };
}
