// focusguard/lib/logger-pure.js — pure functions, no Chrome or DOM deps.
// Imported by both logger.js (service worker) and tests/.

export function dateKey(ts) {
  const d = new Date(ts == null ? Date.now() : ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `log:${y}-${m}-${day}`;
}

export function extractDomain(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); }
  catch { return ''; }
}

export function truncate(s, n) {
  if (!s) return '';
  return s.length > n ? s.slice(0, n) : s;
}
