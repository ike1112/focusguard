import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { URLS, FIXTURE_VERSION, canReuseCapture } from '../benchmark/urls.js';

describe('benchmark fixture cache', () => {
  const item = URLS[0];
  const cached = { ...item, scraped: true, fixtureVersion: FIXTURE_VERSION };
  it('reuses an unchanged successful capture', () => {
    assert.equal(canReuseCapture(cached, item), true);
  });
  it('rejects changed URLs and labels even when the ID is unchanged', () => {
    assert.equal(canReuseCapture(cached, { ...item, url: 'https://example.com/new' }), false);
    assert.equal(canReuseCapture(cached, { ...item, gt: 'block' }), false);
  });
  it('rejects legacy, outdated, missing and failed captures', () => {
    for (const entry of [undefined, { ...cached, fixtureVersion: undefined },
      { ...cached, fixtureVersion: 'old' }, { ...cached, scraped: false }]) {
      assert.equal(canReuseCapture(entry, item), false);
    }
  });
});
