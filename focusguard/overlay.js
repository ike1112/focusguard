/**
 * overlay.js — FocusGuard blocked-page warning overlay
 *
 * Loaded as a content script BEFORE content.js via manifest.json.
 * Exposes window.FocusGuardOverlay.show({reason, countdownMs, onComplete}).
 *
 * Shadow-DOM isolated (mode: 'closed') so page CSS/JS cannot modify,
 * remove, or inspect it trivially. Content scripts run in an isolated
 * world, so `window.FocusGuardOverlay` is not reachable from page scripts.
 */

'use strict';

(function () {
  // --- Constants ---
  const HOST_ID = 'focusguard-root';
  const Z_INDEX = 2147483647;  // 32-bit signed max; above any sane stacking context
  const DEFAULT_COUNTDOWN_MS = 5000;

  let activeHost = null;
  let activeTimer = null;

  // --- Public API ---

  function show({ reason, countdownMs, onComplete } = {}) {
    destroy();

    const host = document.createElement('div');
    host.id = HOST_ID;
    // Inline `all: initial` + fixed positioning beats most page CSS attempts
    // to style or hide the host. The shadow tree inside is fully isolated.
    host.setAttribute(
      'style',
      `all: initial; position: fixed; inset: 0; z-index: ${Z_INDEX}; pointer-events: auto;`
    );

    const shadow = host.attachShadow({ mode: 'closed' });
    shadow.innerHTML = renderMarkup(reason || '');

    const mountTarget = document.body || document.documentElement;
    mountTarget.appendChild(host);
    activeHost = host;

    document.documentElement.style.overflow = 'hidden';

    const total = typeof countdownMs === 'number' && countdownMs > 0
      ? countdownMs
      : DEFAULT_COUNTDOWN_MS;

    startCountdown(shadow, total, () => {
      destroy();
      try { onComplete && onComplete(); } catch (_) {}
    });
  }

  function destroy() {
    if (activeTimer) {
      clearInterval(activeTimer);
      activeTimer = null;
    }
    if (activeHost && activeHost.parentNode) {
      activeHost.parentNode.removeChild(activeHost);
    }
    activeHost = null;
    document.documentElement.style.overflow = '';
  }

  // --- Markup ---

  function renderMarkup(reason) {
    // Defense in depth: reason comes from the classifier (model output) and
    // may echo page titles. Escape HTML so an attacker-controlled title can't
    // inject script/DOM into the overlay even inside the shadow tree.
    const safeReason = String(reason)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .slice(0, 200);

    const reasonLine = safeReason ? `Reason: ${safeReason}` : '';

    return `
      <style>
        :host { all: initial; }
        .overlay {
          position: fixed; inset: 0;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          background: rgba(26, 22, 19, 0.96);
          color: #f8f5f0;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
          text-align: center;
          animation: fg-fade 200ms ease-out both;
        }
        .headline {
          font-size: 32px;
          font-weight: 500;
          margin: 0 24px 16px;
          letter-spacing: -0.01em;
        }
        .reason {
          font-size: 16px;
          color: #9a918a;
          margin: 0 24px 48px;
          max-width: 540px;
          min-height: 1em;
        }
        .countdown-label {
          font-size: 14px;
          color: #9a918a;
          margin-bottom: 8px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }
        .countdown {
          font-size: 72px;
          font-weight: 300;
          line-height: 1;
          font-variant-numeric: tabular-nums;
        }
        .accent { color: #b35a5a; }
        @keyframes fg-fade { from { opacity: 0; } to { opacity: 1; } }
      </style>
      <div class="overlay" role="alertdialog" aria-live="assertive" aria-modal="true">
        <div class="headline">This doesn't look like homework.</div>
        <div class="reason">${reasonLine}</div>
        <div class="countdown-label">Closing tab in</div>
        <div class="countdown accent" data-countdown>5</div>
      </div>
    `;
  }

  // --- Countdown ---

  function startCountdown(shadow, totalMs, done) {
    const el = shadow.querySelector('[data-countdown]');
    let remaining = Math.ceil(totalMs / 1000);
    if (el) el.textContent = String(remaining);

    activeTimer = setInterval(() => {
      remaining -= 1;
      if (el) el.textContent = String(Math.max(remaining, 0));
      if (remaining <= 0) {
        clearInterval(activeTimer);
        activeTimer = null;
        done();
      }
    }, 1000);
  }

  // --- Cleanup on navigation ---
  // If the user (or a pushState) navigates away mid-countdown, clear the
  // timer so it can't fire after our DOM host is gone.
  window.addEventListener('pagehide', destroy, { once: false });

  // Content scripts live in an isolated world — page scripts can't reach this
  window.FocusGuardOverlay = { show, destroy };
})();
