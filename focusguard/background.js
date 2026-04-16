/**
 * background.js — FocusGuard Service Worker
 *
 * Chrome's background service worker for FocusGuard.
 * Handles:
 *   - First-time install: opens setup page
 *   - Message receiving from content scripts
 *   - Tab management (future: close blocked tabs)
 *
 * Phase 2: Wires classifier.js into PAGE_DATA handler.
 */

'use strict';

// --- Module loading ---

try {
  importScripts('classifier.js');
} catch (e) {
  console.error('[FocusGuard] Failed to load classifier.js:', e);
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

// --- Installation handler ---

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // Open setup page on first install
    chrome.tabs.create({ url: chrome.runtime.getURL('setup.html') });
  }
});

// --- Message handler (content script -> background) ---

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.type === 'PAGE_DATA' && typeof message.url === 'string') {
    self.FocusGuardClassifier.classifyPage({
      url: message.url,
      title: typeof message.title === 'string' ? message.title : '',
    }).then((verdict) => {
      console.log('[FocusGuard] classify', message.url, '->',
        verdict.verdict, `(${verdict.reason}, ${verdict.confidence.toFixed(2)}, ${verdict.source})`);
      sendResponse(verdict);
    }).catch((e) => {
      // Defensive: classifier promises to never reject, but just in case
      console.error('[FocusGuard] unexpected classifier error:', e);
      sendResponse({ verdict: 'allow', reason: 'internal-error', confidence: 1, source: 'fallback' });
    });

    // Keep the message channel open for the async response
    return true;
  }

  // Unknown message type — no async response
  return false;
});

