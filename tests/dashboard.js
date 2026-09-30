// tests/dashboard.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatDuration, escapeHtml } from '../focusguard/lib/dashboard-pure.js';

describe('formatDuration', () => {
  it('returns <1s for 0ms', () => { assert.equal(formatDuration(0), '<1s'); });
  it('returns <1s for null', () => { assert.equal(formatDuration(null), '<1s'); });
  it('returns <1s for 999ms', () => { assert.equal(formatDuration(999), '<1s'); });
  it('returns seconds for 1000ms', () => { assert.equal(formatDuration(1000), '1s'); });
  it('returns seconds for 45000ms', () => { assert.equal(formatDuration(45000), '45s'); });
  it('returns minutes and seconds', () => { assert.equal(formatDuration(90000), '1m 30s'); });
  it('returns whole minutes when no remainder', () => { assert.equal(formatDuration(120000), '2m'); });
  it('returns hours and minutes', () => { assert.equal(formatDuration(3660000), '1h 1m'); });
  it('returns whole hours when no remainder', () => { assert.equal(formatDuration(7200000), '2h'); });
  it('rounds seconds correctly', () => {
    assert.equal(formatDuration(1499), '1s');
    assert.equal(formatDuration(1500), '2s');
  });
});

describe('escapeHtml', () => {
  it('escapes ampersand', () => { assert.equal(escapeHtml('a & b'), 'a &amp; b'); });
  it('escapes less-than', () => { assert.equal(escapeHtml('<script>'), '&lt;script&gt;'); });
  it('escapes double quote', () => { assert.equal(escapeHtml('"hello"'), '&quot;hello&quot;'); });
  it('escapes single quote', () => { assert.equal(escapeHtml("it's"), 'it&#39;s'); });
  it('does not double-escape', () => {
    assert.equal(escapeHtml('&amp;'), '&amp;amp;');
  });
  it('handles empty string', () => { assert.equal(escapeHtml(''), ''); });
  it('handles non-string (coerces)', () => { assert.equal(escapeHtml(42), '42'); });
  it('handles XSS payload', () => {
    const result = escapeHtml('<img src=x onerror=alert(1)>');
    assert.ok(!result.includes('<img'));
    assert.ok(result.includes('&lt;img'));
  });
});
