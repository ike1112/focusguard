/**
 * background.js — FocusGuard Service Worker
 *
 * Chrome's background service worker for FocusGuard.
 * Handles:
 *   - First-time install: opens setup page
 *   - Message receiving from content scripts
 *   - Tab management (future: close blocked tabs)
 *
 * Phase 1: Skeleton only. AI classification added in Phase 2.
 */

'use strict';

// --- Installation handler ---

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // Open setup page on first install
    chrome.tabs.create({ url: chrome.runtime.getURL('setup.html') });
  }
});

// --- Message handler (content script -> background) ---

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'PAGE_DATA') {
    // Phase 1: just log it to prove message passing works
    console.log('[FocusGuard] Page data received:', {
      url: message.url,
      title: message.title,
      tabId: sender.tab?.id,
    });

    // Always respond with 'allow' for now (Phase 2 adds AI classification)
    sendResponse({ verdict: 'allow' });
  }

  // Return true to indicate async response (needed even if sync for now)
  return true;
});

// --- Tab event listeners (skeleton for future use) ---

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Phase 2 will use this to trigger classification on navigation
  if (changeInfo.status === 'complete' && tab.url) {
    // Skip internal pages
    if (tab.url.startsWith('chrome://') ||
        tab.url.startsWith('chrome-extension://') ||
        tab.url.startsWith('about:')) {
      return;
    }
    // Future: trigger classification here
  }
});
