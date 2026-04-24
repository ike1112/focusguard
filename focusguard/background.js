/**
 * background.js — FocusGuard Service Worker
 *
 * Loads classifier + logger modules, dispatches content-script messages,
 * classifies SPA navigations, tracks active-tab duration, and runs the
 * daily log-prune alarm.
 */

'use strict';

// --- Module loading ---

try {
  importScripts('classifier.js', 'logger.js');
} catch (e) {
  console.error('[FocusGuard] importScripts failed:', e);
}

// Fail-open shim: if classifier never loaded, PAGE_DATA must still
// receive a valid verdict so the child can keep browsing.
if (!self.FocusGuardClassifier || typeof self.FocusGuardClassifier.classifyPage !== 'function') {
  self.FocusGuardClassifier = {
    classifyPage: async () => ({
      verdict: 'allow',
      reason: 'classifier-load-error',
      confidence: 1,
      source: 'fallback',
    }),
  };
}

// Logger fail-open shim: if logger never loaded, every call site becomes a
// no-op so classification + overlay flow keeps working.
if (!self.FocusGuardLogger) self.FocusGuardLogger = {};
const NOOP = () => {};
const NOOP_ASYNC = async () => {};
self.FocusGuardLogger.logPageVisit = self.FocusGuardLogger.logPageVisit || NOOP_ASYNC;
self.FocusGuardLogger.markTabActive = self.FocusGuardLogger.markTabActive || NOOP;
self.FocusGuardLogger.markTabInactive = self.FocusGuardLogger.markTabInactive || NOOP;
self.FocusGuardLogger.forgetTab = self.FocusGuardLogger.forgetTab || NOOP;
self.FocusGuardLogger.pruneOldLogs = self.FocusGuardLogger.pruneOldLogs || NOOP_ASYNC;

// --- Shared helper: persist a classification verdict ---
// Both the PAGE_DATA handler and the SPA onUpdated handler log the same
// entry shape after classify; this helper keeps them in sync.
function logClassification({ url, title, tabId, verdict }) {
  self.FocusGuardLogger.logPageVisit({
    url,
    title,
    verdict: verdict.verdict,
    reason: verdict.reason,
    confidence: verdict.confidence,
    source: verdict.source,
    tabId,
  }).catch(() => {});
}

// --- Installation handler ---

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // Open setup page on first install
    chrome.tabs.create({ url: chrome.runtime.getURL('setup.html') });
  }
  // Daily prune alarm — first fire 1 min after install, then every 24h.
  chrome.alarms.create('focusguard-prune', {
    when: Date.now() + 60 * 1000,
    periodInMinutes: 24 * 60,
  });
  self.FocusGuardLogger.pruneOldLogs();
});

chrome.runtime.onStartup.addListener(() => {
  self.FocusGuardLogger.pruneOldLogs();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'focusguard-prune') {
    self.FocusGuardLogger.pruneOldLogs();
  }
});

// --- Message handler (content script -> background) ---

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.type === 'PAGE_DATA' && typeof message.url === 'string') {
    const title = typeof message.title === 'string' ? message.title : '';
    const bodyText = typeof message.bodyText === 'string' ? message.bodyText : '';
    const tabId = sender && sender.tab && sender.tab.id;
    self.FocusGuardClassifier.classifyPage({
      url: message.url,
      title,
      bodyText,
    }).then((verdict) => {
      console.log('[FocusGuard] classify', message.url, '->',
        verdict.verdict, `(${verdict.reason}, ${verdict.confidence.toFixed(2)}, ${verdict.source})`);
      sendResponse(verdict);
      logClassification({ url: message.url, title, tabId, verdict });
    }).catch((e) => {
      // Defensive: classifier promises to never reject, but just in case
      console.error('[FocusGuard] unexpected classifier error:', e);
      sendResponse({ verdict: 'allow', reason: 'internal-error', confidence: 1, source: 'fallback' });
    });

    // Keep the message channel open for the async response
    return true;
  }

  if (message && message.type === 'CLOSE_TAB') {
    // Use sender.tab.id — never trust a tab id supplied in the message
    // payload. A content script should only close the tab it runs in.
    const tabId = sender && sender.tab && sender.tab.id;
    if (typeof tabId === 'number') {
      chrome.tabs.remove(tabId).catch((e) => {
        console.warn('[FocusGuard] tabs.remove failed:', e);
      });
    }
    return false;
  }

  // Unknown message type — no async response
  return false;
});

// --- SPA navigation detection ---
//
// content.js only runs once per full page load. SPAs (YouTube, Reddit,
// Twitter, etc.) use history.pushState() to change the URL without
// reloading, so content.js never re-fires. Watch chrome.tabs.onUpdated
// for URL-only changes (URL set, no status transition) to classify
// SPA navigations too.

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Fire whenever the tab's URL changes. This catches SPA navigations
  // (YouTube search, Reddit subreddit clicks, etc.) that content.js misses
  // because it only runs once at document_idle.
  //
  // Skip full page loads: those emit changeInfo with status='loading' when
  // the URL commits. content.js will fire PAGE_DATA shortly after with the
  // page body excerpt — letting the SPA path classify here would race and
  // poison the per-URL cache with a title-only verdict before the
  // body-aware classification ever runs.
  if (!changeInfo.url) return;
  if (changeInfo.status) return;

  const url = changeInfo.url;
  if (url.startsWith('chrome://') ||
      url.startsWith('chrome-extension://') ||
      url.startsWith('about:') ||
      url.startsWith('file://')) {
    return;
  }

  const title = tab.title || '';
  self.FocusGuardClassifier.classifyPage({
    url,
    title,
  }).then((verdict) => {
    console.log('[FocusGuard] spa-classify', url, '->',
      verdict.verdict, `(${verdict.reason}, ${verdict.confidence.toFixed(2)}, ${verdict.source})`);

    // SPA navigations skip content.js (only runs at document_idle on full
    // loads), so the PAGE_DATA -> sendResponse path can't trigger the
    // overlay here. Push the block verdict to the tab's content script.
    if (verdict.verdict === 'block') {
      chrome.tabs.sendMessage(tabId, {
        type: 'SHOW_OVERLAY',
        reason: verdict.reason || '',
      }).catch(() => {
        // Content script may not be injected yet (tab mid-load);
        // the PAGE_DATA path will handle this navigation instead.
      });
    }

    logClassification({ url, title, tabId, verdict });
  }).catch((e) => {
    console.error('[FocusGuard] unexpected classifier error (spa):', e);
  });
});

// --- Tab / window focus events for duration tracking ---

chrome.tabs.onActivated.addListener(({ tabId }) => {
  self.FocusGuardLogger.markTabActive(tabId);
});

chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    self.FocusGuardLogger.markTabInactive();
    return;
  }
  try {
    const [tab] = await chrome.tabs.query({ active: true, windowId });
    if (tab) self.FocusGuardLogger.markTabActive(tab.id);
  } catch (_) { /* ignore — window may have closed mid-query */ }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  self.FocusGuardLogger.forgetTab(tabId);
});

