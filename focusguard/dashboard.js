/**
 * dashboard.js — FocusGuard Parent Dashboard
 *
 * Password-gated. All client-side. Reads activity logs from
 * chrome.storage.local keys written by Phase 4's logger.
 */

'use strict';

(function () {
  // --- Config ---
  const LOCKOUT_THRESHOLD = 3;
  const LOCKOUT_MS = 60_000;
  const DATE_PICKER_DAYS = 30;

  // --- State ---
  const state = {
    failedAttempts: 0,
    lockoutUntil: 0,
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

  // parentPassword shape written by Phase 6:
  //   { salt: '<hex>', hash: '<hex of sha256(salt + ":" + password)>' }
  async function verifyPassword(password) {
    try {
      const { parentPassword } = await chrome.storage.local.get('parentPassword');
      if (!parentPassword || !parentPassword.salt || !parentPassword.hash) {
        return { ok: false, error: 'No password set. Complete setup first.' };
      }
      const computed = await sha256Hex(parentPassword.salt + ':' + password);
      return { ok: computed === parentPassword.hash };
    } catch (_) {
      return { ok: false, error: 'Storage error' };
    }
  }

  function wireAuth() {
    $('auth-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = $('auth-error');
      err.hidden = true;

      if (Date.now() < state.lockoutUntil) {
        const secs = Math.ceil((state.lockoutUntil - Date.now()) / 1000);
        err.textContent = `Locked. Try again in ${secs}s.`;
        err.hidden = false;
        return;
      }

      const password = $('auth-password').value;
      const result = await verifyPassword(password);
      if (!result.ok) {
        state.failedAttempts += 1;
        err.textContent = result.error || 'Wrong password.';
        err.hidden = false;
        if (state.failedAttempts >= LOCKOUT_THRESHOLD) {
          state.lockoutUntil = Date.now() + LOCKOUT_MS;
          state.failedAttempts = 0;
        }
        $('auth-password').value = '';
        return;
      }

      state.failedAttempts = 0;
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
        ? `<div class="entry-reason">reason: ${escapeHtml(e.reason)}</div>`
        : '';
      const sourceTag = e.source === 'cache' ? 'cache' : '';
      node.innerHTML = `
        <div class="entry-time">${formatTime(e.ts)}</div>
        <span class="badge ${badgeClass}">${escapeHtml(e.verdict)}</span>
        <div class="entry-main">
          <div class="entry-title" title="${escapeHtml(e.url)}">${escapeHtml(e.title || e.url)}</div>
          <div class="entry-meta">${escapeHtml(e.domain || '')} · ${formatDuration(e.durationMs)} · ${confStr} conf</div>
          ${reasonLine}
        </div>
        <div class="entry-right">${escapeHtml(sourceTag)}</div>
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

  // --- Main view + logout ---

  function initMainView() {
    populateDatePicker();
    renderDay();
  }

  function wireMainControls() {
    $('refresh-btn').addEventListener('click', renderDay);
    $('logout-btn').addEventListener('click', logout);
    $('date-picker').addEventListener('change', () => {
      state.selectedDate = $('date-picker').value;
      renderDay();
    });
  }

  function logout() {
    state.selectedDate = todayKey();
    // Clear DOM so entries don't linger behind the auth view (shoulder-surf defense).
    $('feed').innerHTML = '';
    $('stat-time').textContent = '—';
    $('stat-educational').textContent = '—';
    $('stat-blocked').textContent = '—';
    $('stat-top-domains').innerHTML = '';
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
