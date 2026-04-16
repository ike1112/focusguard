/**
 * logger.js — FocusGuard activity logger
 *
 * Persists every classified page visit to chrome.storage.local,
 * keyed by date (log:YYYY-MM-DD). Tracks active-tab duration.
 * Prunes entries older than 30 days.
 *
 * Loaded by background.js via importScripts('logger.js').
 * Namespace: self.FocusGuardLogger
 */

'use strict';

// --- Config ---
const RETENTION_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_ENTRIES_PER_DAY = 5000;
const MAX_URL_LENGTH = 500;
const MAX_TITLE_LENGTH = 200;
const MAX_REASON_LENGTH = 200;

// --- Namespace ---

self.FocusGuardLogger = self.FocusGuardLogger || {};

// --- Internal state for duration tracking ---
// activeTabId: tabId currently user-focused (or null)
// activeSince:  ms timestamp when it became active
// lastEntryIdByTab: tabId -> {key, id} pointer to last logged entry, for
//                   patching durationMs when the tab loses focus.
let activeTabId = null;
let activeSince = null;
const lastEntryIdByTab = new Map();

// --- Storage write serializer ---
// Chrome serializes individual storage ops, but not app-level get→set
// sequences. Without this lock, a concurrent logPageVisit between
// flushActive's get and set would lose the newly appended entry.
let writeChain = Promise.resolve();
function withLock(fn) {
  const next = writeChain.then(fn, fn);
  writeChain = next.catch(() => {});
  return next;
}

// --- Storage helpers ---

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

function makeId() {
  // 8 chars of base36 randomness + 4 chars of timestamp tail.
  // Collision-free enough for a single-day array (<= 5000 entries).
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

// --- Public: append a page visit ---

async function logPageVisit({ url, title, verdict, reason, confidence, source, tabId }) {
  if (!url) return;

  const now = Date.now();
  const entry = {
    id: makeId(),
    ts: now,
    url: truncate(url, MAX_URL_LENGTH),
    title: truncate(title || '', MAX_TITLE_LENGTH),
    domain: extractDomain(url),
    verdict: verdict === 'block' ? 'block' : 'allow',
    reason: truncate(reason || '', MAX_REASON_LENGTH),
    confidence: typeof confidence === 'number' ? confidence : 0,
    source: source || 'unknown',
    durationMs: 0,
  };

  const key = dateKey(now);
  try {
    await withLock(async () => {
      const got = await chrome.storage.local.get(key);
      const arr = Array.isArray(got[key]) ? got[key] : [];
      if (arr.length >= MAX_ENTRIES_PER_DAY) {
        // Safety valve: if a bug floods logPageVisit, cap the day's bucket
        // by dropping the oldest entries instead of unbounded growth.
        arr.splice(0, arr.length - MAX_ENTRIES_PER_DAY + 1);
      }
      arr.push(entry);
      await chrome.storage.local.set({ [key]: arr });
    });
    if (typeof tabId === 'number') {
      lastEntryIdByTab.set(tabId, { key, id: entry.id });
    }
  } catch (e) {
    console.warn('[FocusGuard] log append failed:', e);
  }
}

// --- Duration tracking ---

function markTabActive(tabId) {
  if (typeof tabId !== 'number') return;
  flushActive();
  activeTabId = tabId;
  activeSince = Date.now();
}

function markTabInactive() {
  flushActive();
}

function flushActive() {
  if (activeTabId == null || activeSince == null) {
    activeTabId = null;
    activeSince = null;
    return;
  }
  const elapsed = Date.now() - activeSince;
  const ref = lastEntryIdByTab.get(activeTabId);
  activeTabId = null;
  activeSince = null;
  if (!ref || elapsed <= 0) return;

  withLock(async () => {
    const got = await chrome.storage.local.get(ref.key);
    const arr = got[ref.key];
    if (!Array.isArray(arr)) return;
    const idx = arr.findIndex((e) => e.id === ref.id);
    if (idx === -1) return;
    arr[idx].durationMs = (arr[idx].durationMs || 0) + elapsed;
    await chrome.storage.local.set({ [ref.key]: arr });
  }).catch((e) => console.warn('[FocusGuard] duration patch failed:', e));
}

function forgetTab(tabId) {
  if (activeTabId === tabId) flushActive();
  lastEntryIdByTab.delete(tabId);
}

// --- Pruning ---

async function pruneOldLogs() {
  const cutoff = Date.now() - RETENTION_DAYS * DAY_MS;
  try {
    const all = await chrome.storage.local.get(null);
    const keysToRemove = [];
    for (const k of Object.keys(all)) {
      if (!k.startsWith('log:')) continue;
      const datePart = k.slice(4);
      const [y, m, d] = datePart.split('-').map(Number);
      if (!y || !m || !d) continue;
      // UTC comparison avoids DST surprises when translating day-key -> ts.
      const ts = Date.UTC(y, m - 1, d);
      if (ts < cutoff) keysToRemove.push(k);
    }
    if (keysToRemove.length) {
      await chrome.storage.local.remove(keysToRemove);
      console.log('[FocusGuard] pruned', keysToRemove.length, 'old day(s)');
    }
  } catch (e) {
    console.warn('[FocusGuard] prune failed:', e);
  }
}

// --- Dev helper: per-day entry counts ---

async function _summary() {
  const all = await chrome.storage.local.get(null);
  const result = {};
  for (const k of Object.keys(all)) {
    if (k.startsWith('log:')) result[k] = Array.isArray(all[k]) ? all[k].length : 0;
  }
  return result;
}

// --- Exports ---

self.FocusGuardLogger.logPageVisit = logPageVisit;
self.FocusGuardLogger.markTabActive = markTabActive;
self.FocusGuardLogger.markTabInactive = markTabInactive;
self.FocusGuardLogger.forgetTab = forgetTab;
self.FocusGuardLogger.pruneOldLogs = pruneOldLogs;
self.FocusGuardLogger._summary = _summary;
