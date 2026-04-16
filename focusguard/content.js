/**
 * content.js — FocusGuard Content Script
 *
 * Injected into every web page via manifest content_scripts.
 * Responsibilities:
 *   - Extract page URL and title
 *   - Send page data to background worker for classification
 *   - (Phase 3) Inject warning overlay for blocked pages
 *
 * Runs at document_idle — DOM is ready, page is interactive.
 */

'use strict';

// --- Page data extraction and reporting ---

(function () {
  // Skip if no URL (shouldn't happen, but be safe)
  if (!window.location.href) return;

  // Send page data to background for classification
  chrome.runtime.sendMessage(
    {
      type: 'PAGE_DATA',
      url: window.location.href,
      title: document.title || '',
    },
    (response) => {
      if (chrome.runtime.lastError) {
        // Extension context invalidated — silently ignore
        return;
      }

      if (response && response.verdict === 'block') {
        // Phase 3: inject warning overlay here
        console.log('[FocusGuard] Page blocked (overlay coming in Phase 3)');
      }
    }
  );
})();
