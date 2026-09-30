/**
 * dashboard.js — FocusGuard Parent Dashboard
 *
 * Password-gated. All client-side. Reads activity logs from
 * chrome.storage.local keys written by Phase 4's logger.
 */

'use strict';

(function () {
  // --- Config ---
  const DATE_PICKER_DAYS = 30;

  // --- State ---
  const state = {
    selectedDate: todayKey(),
  };

  // --- Helpers ---

  function todayKey() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function $(id) { return document.getElementById(id); }

  function showView(which) {
    $('view-auth').hidden = (which !== 'auth');
    $('view-main').hidden = (which !== 'main');
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatTime(ts) {
    const d = new Date(ts);
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }

  function formatDuration(ms) {
    if (!ms || ms < 1000) return '<1s';
    const sec = Math.round(ms / 1000);
    if (sec < 60) return sec + 's';
    const min = Math.floor(sec / 60);
    const remSec = sec % 60;
    if (min < 60) return remSec ? `${min}m ${remSec}s` : `${min}m`;
    const hr = Math.floor(min / 60);
    const remMin = min % 60;
    return remMin ? `${hr}h ${remMin}m` : `${hr}h`;
  }

  // --- Auth ---

  async function sha256Hex(input) {
    const buf = new TextEncoder().encode(input);
    const digest = await crypto.subtle.digest('SHA-256', buf);
    return [...new Uint8Array(digest)]
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  async function pbkdf2Hex(salt, password, iterations = 200_000) {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']
    );
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: enc.encode(salt), iterations, hash: 'SHA-256' },
      keyMaterial,
      256
    );
    return [...new Uint8Array(bits)]
      .map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  // parentPassword shape: { salt: '<hex>', hash: '<hex>', algo?: 'pbkdf2' }
  // Legacy records have no algo field (SHA-256). They are auto-migrated on
  // first successful login.
  async function verifyPassword(password) {
    try {
      const { parentPassword } = await chrome.storage.local.get('parentPassword');
      if (!parentPassword || !parentPassword.salt || !parentPassword.hash) {
        return { ok: false, error: 'No password set. Complete setup first.' };
      }
      let computed;
      if (parentPassword.algo === 'pbkdf2') {
        computed = await pbkdf2Hex(parentPassword.salt, password);
      } else {
        // Legacy SHA-256 record — verify, then transparently migrate
        computed = await sha256Hex(parentPassword.salt + ':' + password);
      }
      if (computed !== parentPassword.hash) return { ok: false };
      // Successful legacy login — upgrade to PBKDF2 in the background
      if (!parentPassword.algo) {
        const newHash = await pbkdf2Hex(parentPassword.salt, password);
        chrome.storage.local.set({
          parentPassword: { salt: parentPassword.salt, hash: newHash, algo: 'pbkdf2' }
        }).catch(() => {});
      }
      return { ok: true };
    } catch (_) {
      return { ok: false, error: 'Storage error' };
    }
  }

  // --- Persistent lockout ---
  // authState survives reloads — only a correct password resets failCount.

  async function getAuthState() {
    try {
      const { authState } = await chrome.storage.local.get('authState');
      return authState || { failCount: 0, lockoutUntil: 0, lastFailAt: 0 };
    } catch {
      return { failCount: 0, lockoutUntil: 0, lastFailAt: 0 };
    }
  }

  async function setAuthState(next) {
    try { await chrome.storage.local.set({ authState: next }); } catch {}
  }

  function lockoutDurationFor(failCount) {
    if (failCount < 3) return 0;
    if (failCount === 3) return 60_000;
    if (failCount === 4) return 5 * 60_000;
    return 30 * 60_000;
  }

  async function recordFailure() {
    const cur = await getAuthState();
    const failCount = cur.failCount + 1;
    const ms = lockoutDurationFor(failCount);
    const next = {
      failCount,
      lockoutUntil: ms ? Date.now() + ms : 0,
      lastFailAt: Date.now(),
    };
    await setAuthState(next);
    return next;
  }

  async function clearAuthState() {
    await setAuthState({ failCount: 0, lockoutUntil: 0, lastFailAt: 0 });
  }

  function formatRemaining(ms) {
    const s = Math.ceil(ms / 1000);
    if (s < 60) return s + 's';
    const m = Math.ceil(s / 60);
    return m + 'm';
  }

  function wireAuth() {
    $('auth-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = $('auth-error');
      err.hidden = true;

      const auth = await getAuthState();
      if (auth.lockoutUntil && Date.now() < auth.lockoutUntil) {
        err.textContent = `Locked. Try again in ${formatRemaining(auth.lockoutUntil - Date.now())}.`;
        err.hidden = false;
        return;
      }

      const password = $('auth-password').value;
      const result = await verifyPassword(password);
      if (!result.ok) {
        const next = await recordFailure();
        err.textContent = next.lockoutUntil
          ? `Wrong password. Locked for ${formatRemaining(next.lockoutUntil - Date.now())}.`
          : (result.error || 'Wrong password.');
        err.hidden = false;
        $('auth-password').value = '';
        return;
      }

      await clearAuthState();
      $('auth-password').value = '';
      showView('main');
      initMainView();
    });
  }

  // --- Date picker ---

  function populateDatePicker() {
    const sel = $('date-picker');
    sel.innerHTML = '';
    const now = new Date();
    for (let i = 0; i < DATE_PICKER_DAYS; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const value = `${y}-${m}-${day}`;
      const label = i === 0 ? `Today (${value})`
                  : i === 1 ? `Yesterday (${value})`
                  : value;
      const opt = document.createElement('option');
      opt.value = value;
      opt.textContent = label;
      sel.appendChild(opt);
    }
    sel.value = state.selectedDate;
  }

  // --- Data ---

  async function loadDay(dateStr) {
    const key = `log:${dateStr}`;
    try {
      const got = await chrome.storage.local.get(key);
      const arr = Array.isArray(got[key]) ? got[key] : [];
      return [...arr].sort((a, b) => b.ts - a.ts);
    } catch {
      return [];
    }
  }

  // --- Render ---

  function renderFeed(entries) {
    const feed = $('feed');
    const empty = $('empty-state');
    feed.innerHTML = '';
    if (!entries.length) {
      empty.hidden = false;
      return;
    }
    empty.hidden = true;

    const frag = document.createDocumentFragment();
    for (const e of entries) {
      const node = document.createElement('div');
      node.className = 'entry';
      const badgeClass = e.verdict === 'block' ? 'badge-block' : 'badge-allow';
      const confStr = typeof e.confidence === 'number' ? e.confidence.toFixed(2) : '—';
      const reasonLine = e.reason
        ? `<div class="entry-reason">${escapeHtml(e.reason)}</div>`
        : '';
      const metaParts = [];
      if (e.domain) metaParts.push(escapeHtml(e.domain));
      metaParts.push(`${confStr} conf`);
      if (e.source === 'cache' || e.source === 'allowlist') metaParts.push(e.source);
      const metaHtml = metaParts
        .map((p) => `<span>${p}</span>`)
        .join('<span class="dot"></span>');
      node.innerHTML = `
        <div class="entry-time">${formatTime(e.ts)}</div>
        <span class="badge ${badgeClass}">${escapeHtml(e.verdict)}</span>
        <div class="entry-main">
          <div class="entry-title" title="${escapeHtml(e.url)}">${escapeHtml(e.title || e.url)}</div>
          <div class="entry-meta">${metaHtml}</div>
          ${reasonLine}
        </div>
        <div class="entry-right">${formatDuration(e.durationMs)}</div>
      `;
      frag.appendChild(node);
    }
    feed.appendChild(frag);
  }

  function renderStats(entries) {
    const totalMs = entries.reduce((s, e) => s + (e.durationMs || 0), 0);
    const allowMs = entries
      .filter((e) => e.verdict === 'allow')
      .reduce((s, e) => s + (e.durationMs || 0), 0);
    const blockedCount = entries.filter((e) => e.verdict === 'block').length;

    // Top domains ranked by time spent, not visit count — that's what parents care about.
    const domainMap = new Map();
    for (const e of entries) {
      if (!e.domain) continue;
      domainMap.set(e.domain, (domainMap.get(e.domain) || 0) + (e.durationMs || 0));
    }
    const topDomains = [...domainMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([d]) => d);

    $('stat-time').textContent = formatDuration(totalMs);
    // Show em-dash when nothing has accrued duration — 0% would be misleading.
    $('stat-educational').textContent = totalMs > 0
      ? Math.round((allowMs / totalMs) * 100) + '%'
      : '—';
    $('stat-blocked').textContent = String(blockedCount);

    const ol = $('stat-top-domains');
    ol.innerHTML = '';
    for (const d of topDomains) {
      const li = document.createElement('li');
      li.textContent = d;
      ol.appendChild(li);
    }
  }

  async function renderDay() {
    const entries = await loadDay(state.selectedDate);
    renderStats(entries);
    renderFeed(entries);
  }

  // --- Allowlist ---
  // chrome.storage.local.allowlist: string[] — substrings matched against URL.
  // classifier.js reads it via chrome.storage.onChanged, so writes here take
  // effect immediately without reloading the service worker.

  const ALLOWLIST_MAX_ENTRIES = 500;
  const ALLOWLIST_MAX_ENTRY_LEN = 500;
  let allowlist = [];

  async function loadAllowlist() {
    try {
      const { allowlist: stored } = await chrome.storage.local.get('allowlist');
      allowlist = Array.isArray(stored) ? stored.slice() : [];
    } catch {
      allowlist = [];
    }
    renderAllowlist();
  }

  async function saveAllowlist() {
    try { await chrome.storage.local.set({ allowlist }); } catch {}
  }

  function renderAllowlist() {
    const list = $('allowlist-items');
    const empty = $('allowlist-empty');
    list.innerHTML = '';
    if (!allowlist.length) {
      empty.hidden = false;
      return;
    }
    empty.hidden = true;
    const frag = document.createDocumentFragment();
    for (const entry of allowlist) {
      const row = document.createElement('div');
      row.className = 'allowlist-row';
      row.innerHTML = `
        <span class="allowlist-entry" title="${escapeHtml(entry)}">${escapeHtml(entry)}</span>
        <button class="allowlist-delete" type="button" aria-label="Remove ${escapeHtml(entry)}">
          <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </button>
      `;
      // Attach the entry to the delete button as a data property — avoids
      // string-matching on rendered text and survives any future escaping.
      row.querySelector('.allowlist-delete').dataset.entry = entry;
      frag.appendChild(row);
    }
    list.appendChild(frag);
  }

  function setAllowlistError(msg) {
    const el = $('allowlist-error');
    if (!msg) { el.hidden = true; el.textContent = ''; return; }
    el.textContent = msg;
    el.hidden = false;
  }

  async function addAllowlistEntry(raw) {
    setAllowlistError('');
    const trimmed = String(raw || '').trim();
    if (!trimmed) return;
    if (trimmed.length > ALLOWLIST_MAX_ENTRY_LEN) {
      setAllowlistError(`Entry must be ${ALLOWLIST_MAX_ENTRY_LEN} characters or fewer.`);
      return;
    }
    if (allowlist.includes(trimmed)) {
      setAllowlistError('That entry is already on the list.');
      return;
    }
    if (allowlist.length >= ALLOWLIST_MAX_ENTRIES) {
      setAllowlistError(`Allowlist is full (${ALLOWLIST_MAX_ENTRIES} max).`);
      return;
    }
    allowlist = [...allowlist, trimmed];
    await saveAllowlist();
    renderAllowlist();
  }

  async function removeAllowlistEntry(entry) {
    allowlist = allowlist.filter((e) => e !== entry);
    await saveAllowlist();
    renderAllowlist();
  }

  function wireAllowlistControls() {
    $('allowlist-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = $('allowlist-input');
      await addAllowlistEntry(input.value);
      if (!$('allowlist-error').hidden) return;
      input.value = '';
      input.focus();
    });
    $('allowlist-input').addEventListener('input', () => setAllowlistError(''));
    $('allowlist-items').addEventListener('click', async (e) => {
      const btn = e.target.closest('.allowlist-delete');
      if (!btn) return;
      await removeAllowlistEntry(btn.dataset.entry);
    });
  }

  // --- Settings: API key + password change ---

  function setSettingsMsg(errorId, okId, msg, isError) {
    const err = $(errorId);
    const ok = $(okId);
    err.hidden = true;
    ok.hidden = true;
    if (!msg) return;
    if (isError) { err.textContent = msg; err.hidden = false; }
    else { ok.hidden = false; }
  }

  async function testApiKey(key) {
    // Validate by hitting the models endpoint — cheap, no tokens consumed.
    try {
      const res = await fetch('https://api.anthropic.com/v1/models', {
        headers: {
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
      });
      return res.ok || res.status === 404;  // 404 = valid key, unknown endpoint
    } catch {
      return false;
    }
  }

  function wireSettingsControls() {
    $('settings-key-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = $('settings-key-input');
      const key = input.value.trim();
      setSettingsMsg('settings-key-error', 'settings-key-ok', '');
      if (!key.startsWith('sk-ant-')) {
        setSettingsMsg('settings-key-error', 'settings-key-ok', 'Key must start with sk-ant-', true);
        return;
      }
      const btn = e.target.querySelector('button[type="submit"]');
      btn.disabled = true;
      btn.querySelector('span').textContent = 'Validating…';
      const valid = await testApiKey(key);
      btn.disabled = false;
      btn.querySelector('span').textContent = 'Save key';
      if (!valid) {
        setSettingsMsg('settings-key-error', 'settings-key-ok', 'Key rejected by Anthropic API. Check it and try again.', true);
        return;
      }
      try {
        await chrome.storage.local.set({ apiKey: key });
        input.value = '';
        setSettingsMsg('settings-key-error', 'settings-key-ok', '', false);
      } catch {
        setSettingsMsg('settings-key-error', 'settings-key-ok', 'Storage error — try again.', true);
      }
    });

    $('settings-pw-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const current = $('settings-pw-current').value;
      const next = $('settings-pw-new').value;
      const confirm = $('settings-pw-confirm').value;
      setSettingsMsg('settings-pw-error', 'settings-pw-ok', '');
      if (!current || !next || !confirm) {
        setSettingsMsg('settings-pw-error', 'settings-pw-ok', 'Fill in all three fields.', true);
        return;
      }
      if (next.length < 6) {
        setSettingsMsg('settings-pw-error', 'settings-pw-ok', 'New password must be at least 6 characters.', true);
        return;
      }
      if (next !== confirm) {
        setSettingsMsg('settings-pw-error', 'settings-pw-ok', 'New passwords do not match.', true);
        return;
      }
      const check = await verifyPassword(current);
      if (!check.ok) {
        setSettingsMsg('settings-pw-error', 'settings-pw-ok', check.error || 'Current password is wrong.', true);
        return;
      }
      // Hash the new password with a fresh salt.
      const salt = [...crypto.getRandomValues(new Uint8Array(16))]
        .map((b) => b.toString(16).padStart(2, '0')).join('');
      const hash = await pbkdf2Hex(salt, next);
      try {
        await chrome.storage.local.set({ parentPassword: { salt, hash, algo: 'pbkdf2' } });
        $('settings-pw-current').value = '';
        $('settings-pw-new').value = '';
        $('settings-pw-confirm').value = '';
        setSettingsMsg('settings-pw-error', 'settings-pw-ok', '', false);
      } catch {
        setSettingsMsg('settings-pw-error', 'settings-pw-ok', 'Storage error — try again.', true);
      }
    });

    // Clear status messages when the user starts typing again
    ['settings-key-input', 'settings-pw-current', 'settings-pw-new', 'settings-pw-confirm']
      .forEach((id) => {
        $(id).addEventListener('input', () => {
          $('settings-key-error').hidden = true;
          $('settings-key-ok').hidden = true;
          $('settings-pw-error').hidden = true;
          $('settings-pw-ok').hidden = true;
        });
      });
  }

  // --- Main view + logout ---

  function initMainView() {
    populateDatePicker();
    renderDay();
    loadAllowlist();
  }

  function wireMainControls() {
    $('refresh-btn').addEventListener('click', renderDay);
    $('logout-btn').addEventListener('click', logout);
    $('date-picker').addEventListener('change', () => {
      state.selectedDate = $('date-picker').value;
      renderDay();
    });
    wireAllowlistControls();
    wireSettingsControls();
  }

  function logout() {
    state.selectedDate = todayKey();
    // Clear DOM so entries don't linger behind the auth view (shoulder-surf defense).
    $('feed').innerHTML = '';
    $('stat-time').textContent = '—';
    $('stat-educational').textContent = '—';
    $('stat-blocked').textContent = '—';
    $('stat-top-domains').innerHTML = '';
    $('allowlist-items').innerHTML = '';
    $('allowlist-input').value = '';
    setAllowlistError('');
    $('settings-key-input').value = '';
    $('settings-pw-current').value = '';
    $('settings-pw-new').value = '';
    $('settings-pw-confirm').value = '';
    ['settings-key-error', 'settings-key-ok', 'settings-pw-error', 'settings-pw-ok']
      .forEach((id) => { $(id).hidden = true; });
    $('auth-password').value = '';
    $('auth-error').hidden = true;
    showView('auth');
    $('auth-password').focus();
  }

  // --- Boot ---

  showView('auth');
  wireAuth();
  wireMainControls();
})();
