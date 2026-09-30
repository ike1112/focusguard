# FocusGuard — Security & Threat Model

## Who this protects against

- An 11-year-old using the family computer who is curious and
  reasonably tech-literate, but is not a security researcher.

## What's protected

| Surface | Mitigation |
| ------- | ---------- |
| Discovery via toolbar | No `action` block → no icon in toolbar |
| Removal from `chrome://extensions` | Force-install via Group Policy (see `docs/group-policy-install.md`) |
| Disabling via `chrome://extensions` | Force-install removes Disable button |
| Dashboard brute-force | Persistent lockout: 3 fails → 60s, 4th → 5m, 5+ → 30m |
| Dashboard password offline attack | PBKDF2-SHA-256 (200k iterations) via WebCrypto. Legacy SHA-256 records auto-migrate on next successful login. |
| API key exfiltration | Stored in `chrome.storage.local`; not visible from page scripts (isolated world) |
| Overlay removal via page JS | Closed-mode Shadow DOM + isolated-world content script |
| Prompt injection via page title | Title HTML-escaped before overlay render; model sees it as plain text |
| Activity log tampering | Stored in `chrome.storage.local`; page scripts cannot reach extension storage |

## Known gaps (accepted for v1)

- **DevTools on a page**: a child with DevTools open can remove the
  overlay host element manually. The tab will still close on the
  countdown (background.js drives close, not the overlay).
- **DevTools on the service worker**: a child with Developer mode
  enabled in Chrome can read/clear `chrome.storage.local` directly.
  Force-install blocks the disable path but NOT the storage inspection
  path. Keep Developer Mode off on the child's profile (Group Policy:
  `DeveloperToolsAvailability = 2`).
- **Policy removal**: A child with local admin rights can edit the
  Group Policy. Ensure the child uses a standard, non-admin account.
- **Dashboard URL discovery**: Typing
  `chrome-extension://<id>/dashboard.html` is the entry point. There's
  no way to HIDE it — rely on the password (6+ chars, persistent lockout).
- **Offline mode**: When the Claude API is unreachable, verdicts
  fail-open to `allow`. A child noticing this could work around
  FocusGuard by forcing network failure (unplugging ethernet, etc.).
  Logged as "api-error" in the dashboard so the parent sees gaps.
- **Forgotten parent password**: If the parent is locked out and
  cannot remember the password, recovery is to clear
  `chrome.storage.local` from the service-worker DevTools console:
  `await chrome.storage.local.remove(['apiKey', 'parentPassword', 'authState']);`
  Then reopen `setup.html` to reconfigure.

## Recommended Group Policy hardening (Windows example)

In addition to `ExtensionInstallForcelist`:

- `DeveloperToolsAvailability = 2` — disables DevTools on managed
  profiles except for force-installed extensions.
- `IncognitoModeAvailability = 1` — disables incognito (bypasses content
  scripts by default).
- `BrowserGuestModeEnabled = false` — prevents guest-mode escape.

## What's out of scope

- Parental controls for non-browser apps (games, app stores, etc.)
- Network-level filtering
- Resistance against a motivated adversary with admin rights
