// tests/logger.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// --- Copied from focusguard/logger.js (pure, no chrome deps) ---

function dateKey(ts) {
  const d = new Date(ts == null ? Date.now() : ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `log:${y}-${m}-${day}`;
}

function extractDomain(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); }
  catch { return ''; }
}

function truncate(s, n) {
  if (!s) return '';
  return s.length > n ? s.slice(0, n) : s;
}

// --- Tests ---

describe('dateKey', () => {
  it('formats a known timestamp correctly', () => {
    const d = new Date(2026, 8, 30);  // Sep 30 2026 local time
    assert.equal(dateKey(d.getTime()), 'log:2026-09-30');
  });
  it('zero-pads month and day', () => {
    const d = new Date(2026, 0, 5);  // Jan 5
    assert.equal(dateKey(d.getTime()), 'log:2026-01-05');
  });
  it('uses current time when ts is null', () => {
    const key = dateKey(null);
    assert.match(key, /^log:\d{4}-\d{2}-\d{2}$/);
  });
});

describe('extractDomain', () => {
  it('extracts hostname', () => {
    assert.equal(extractDomain('https://en.wikipedia.org/wiki/Photosynthesis'), 'en.wikipedia.org');
  });
  it('strips www.', () => {
    assert.equal(extractDomain('https://www.youtube.com/watch?v=abc'), 'youtube.com');
  });
  it('returns empty string for invalid URL', () => {
    assert.equal(extractDomain('not a url'), '');
  });
  it('returns empty string for empty input', () => {
    assert.equal(extractDomain(''), '');
  });
  it('handles URL with no path', () => {
    assert.equal(extractDomain('https://khanacademy.org'), 'khanacademy.org');
  });
});

describe('truncate', () => {
  it('returns string unchanged when under limit', () => {
    assert.equal(truncate('hello', 10), 'hello');
  });
  it('truncates to n chars when over limit', () => {
    assert.equal(truncate('hello world', 5), 'hello');
  });
  it('returns empty string for falsy input', () => {
    assert.equal(truncate('', 10), '');
    assert.equal(truncate(null, 10), '');
    assert.equal(truncate(undefined, 10), '');
  });
  it('handles exact-length string', () => {
    assert.equal(truncate('hello', 5), 'hello');
  });
});
