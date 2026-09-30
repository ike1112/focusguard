/**
 * content.js — FocusGuard Content Script
 *
 * Injected into every web page via manifest content_scripts.
 * Responsibilities:
 *   - On full page load: extract URL/title, send PAGE_DATA, show overlay on block
 *   - On SPA pushState nav: listen for SHOW_OVERLAY from background and mount overlay
 *
 * Runs at document_idle — DOM is ready, page is interactive.
 */

'use strict';

(function () {
  if (!window.location.href) return;

  // Dedupe overlay trigger by URL — on a full page load, both the
  // PAGE_DATA response and the background's onUpdated/spa-classify path
  // fire for the same URL, and we don't want to destroy+recreate the
  // overlay twice (the countdown would visibly restart).
  let overlayShownForUrl = null;

  function triggerBlockOverlay(reason) {
    const currentUrl = window.location.href;
    if (overlayShownForUrl === currentUrl) return;
    overlayShownForUrl = currentUrl;

    try {
      if (window.FocusGuardOverlay && typeof window.FocusGuardOverlay.show === 'function') {
        window.FocusGuardOverlay.show({
          reason: reason || '',
          countdownMs: 5000,
          onComplete: () => {
            chrome.runtime.sendMessage({ type: 'CLOSE_TAB' }, () => {
              // Tab is closing; the channel tears down and Chrome would
              // otherwise log "message port closed". Read lastError to
              // suppress it.
              void chrome.runtime.lastError;
            });
          },
        });
      } else {
        console.warn('[FocusGuard] overlay module missing — cannot render block UI');
      }
    } catch (e) {
      console.warn('[FocusGuard] overlay failed:', e);
    }
  }

  // --- Initial full-load classification ---

  // Best-effort visible-text excerpt. innerText respects display:none and
  // skips <script>/<style>, giving "what the user actually sees". Capped
  // here so we don't ship megabytes of forum content to the API; the
  // classifier sanitizes again before sending.
  let bodyText = '';
  try {
    bodyText = (document.body && document.body.innerText || '').slice(0, 2000);
  } catch (_) {
    // Some pages throw on innerText access; fall through with empty string.
  }

  chrome.runtime.sendMessage(
    {
      type: 'PAGE_DATA',
      url: window.location.href,
      title: document.title || '',
      bodyText,
    },
    (response) => {
      if (chrome.runtime.lastError) {
        // Extension context invalidated — silently ignore
        return;
      }

      if (response && response.verdict === 'block') {
        triggerBlockOverlay(response.reason);
      }
    }
  );

  // --- SPA nav verdicts pushed from background ---
  //
  // content.js only runs once per full page load, so pushState navigations
  // (YouTube, Reddit, Twitter) never re-run this file. background.js
  // classifies SPA navs via chrome.tabs.onUpdated and pushes blocks here.

  chrome.runtime.onMessage.addListener((message) => {
    if (message && message.type === 'SHOW_OVERLAY') {
      triggerBlockOverlay(message.reason);
    }
  });
})();
