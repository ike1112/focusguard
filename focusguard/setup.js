/**
 * setup.js — FocusGuard first-time setup.
 *
 * Collects API key + parent password, validates them, writes them to
 * chrome.storage.local. No server. Single network call to Anthropic to
 * confirm the key is valid.
 *
 * Storage contract (must match Phases 2 and 5):
 *   apiKey:         string, starts with 'sk-ant-'
 *   parentPassword: { salt: <hex32>, hash: <sha256(salt + ':' + password)> }
 *
 * Dev reset (service worker DevTools console):
 *   await chrome.storage.local.remove(['apiKey', 'parentPassword']);
 */

'use strict';

(function () {
  // --- Config ---
  const API_TEST_TIMEOUT_MS = 10_000;
  const MIN_PASSWORD_LEN = 6;

  // --- Helpers ---
  const $ = (id) => document.getElementById(id);
  const show = (el) => { if (el) el.hidden = false; };
  const hide = (el) => { if (el) el.hidden = true; };

  function setStatus(msg) {
    const s = $('status');
    if (!msg) { hide(s); s.textContent = ''; return; }
    s.textContent = msg; show(s);
  }
  function setError(msg) {
    const e = $('error');
    if (!msg) { hide(e); e.textContent = ''; return; }
    e.textContent = msg; show(e);
  }

  // --- Crypto ---

  async function sha256Hex(input) {
    const buf = new TextEncoder().encode(input);
    const digest = await crypto.subtle.digest('SHA-256', buf);
    return [...new Uint8Array(digest)]
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  function genSalt() {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  // --- API key test ---

  async function testApiKey(apiKey) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), API_TEST_TIMEOUT_MS);
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'ping' }],
        }),
        signal: controller.signal,
      });
      if (r.status === 401 || r.status === 403) {
        return { ok: false, msg: `API key rejected (${r.status}).` };
      }
      if (!r.ok) {
        return { ok: false, msg: `API error: ${r.status}` };
      }
      return { ok: true };
    } catch (e) {
      if (e && e.name === 'AbortError') {
        return { ok: false, msg: 'API test timed out.' };
      }
      return { ok: false, msg: 'Network error: ' + (e && e.message ? e.message : String(e)) };
    } finally {
      clearTimeout(timer);
    }
  }

  // --- Boot: show reconfigure notice if already set up ---

  (async function boot() {
    try {
      const { apiKey, parentPassword } = await chrome.storage.local.get(['apiKey', 'parentPassword']);
      if (apiKey || parentPassword) show($('reconfigure-notice'));
    } catch (_) {
      /* first-time view is the safe default */
    }
  })();

  // --- Form ---

  $('setup-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    setError('');
    setStatus('');
    const btn = $('submit-btn');
    btn.disabled = true;

    try {
      const apiKey = $('api-key').value.trim();
      const pw = $('password').value;
      const pw2 = $('password-confirm').value;

      if (!apiKey.startsWith('sk-ant-')) {
        setError('API key must start with sk-ant-.');
        return;
      }
      if (pw.length < MIN_PASSWORD_LEN) {
        setError(`Password must be at least ${MIN_PASSWORD_LEN} characters.`);
        return;
      }
      if (pw !== pw2) {
        setError('Passwords do not match.');
        return;
      }

      setStatus('Testing API key...');
      const test = await testApiKey(apiKey);
      if (!test.ok) {
        setError(test.msg);
        return;
      }

      setStatus('Saving...');
      // New salt every time, even on reconfigure — never reuse a salt with a new password.
      const salt = genSalt();
      const hash = await sha256Hex(salt + ':' + pw);

      await chrome.storage.local.set({
        apiKey,
        parentPassword: { salt, hash },
      });

      setStatus('');
      $('view-form').hidden = true;
      $('view-done').hidden = false;
    } catch (err) {
      setError('Unexpected error: ' + (err && err.message ? err.message : String(err)));
    } finally {
      btn.disabled = false;
    }
  });
})();
