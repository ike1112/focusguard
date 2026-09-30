# FocusGuard — Developer Reference

Technical documentation for FocusGuard. Parents looking for install and setup instructions should read [README.md](README.md) instead.

FocusGuard is an MV3 Chrome extension that classifies every page visit via the Claude Haiku API, shows a 5-second warning overlay on distractions, and then closes the tab. All state lives in `chrome.storage.local`; there is no server.

- **100% local** — no server, no database, no telemetry. Everything lives inside the Chrome extension and `chrome.storage.local`.
- **Direct Claude API calls** — the service worker calls `api.anthropic.com` directly (BYOK — parent supplies the API key); nothing goes through a middleman.
- **Content-aware classification** — each page sends URL, title, and a 2,000-char visible-text excerpt; the classifier uses the excerpt to distinguish an educational YouTube video from a gaming one.
- **Persistent LRU verdict cache** — 500-entry cache survives MV3 service-worker restarts via `chrome.storage.local`, so the same URL is only ever billed once.
- **SPA-aware** — `chrome.tabs.onUpdated` re-classifies pushState navigations (YouTube, Reddit, Twitter) that `content.js` never sees because the page doesn't reload.
- **Password-gated parent dashboard** — salted SHA-256 password, persistent lockout after repeated failures, shoulder-surf-safe logout.

---

## Table of contents

1. [How it works](#how-it-works)
2. [Install & first-time setup](#install--first-time-setup)
3. [Using the parent dashboard](#using-the-parent-dashboard)
4. [Where data is stored](#where-data-is-stored)
5. [Privacy & security model](#privacy--security-model)
6. [File layout](#file-layout)
7. [Development notes](#development-notes)
8. [Troubleshooting](#troubleshooting)
9. [Limitations](#limitations)

---

## How it works

```
 ┌─────────────────────────────────────────────────────────────────┐
 │ Chrome tab                                                      │
 │                                                                 │
 │   overlay.js  ──► Shadow-DOM warning UI (only on "block")       │
 │   content.js  ──► sends PAGE_DATA (url, title)                  │
 │                                                                 │
 └──────────────────────────────┬──────────────────────────────────┘
                                │ chrome.runtime.sendMessage
                                ▼
 ┌─────────────────────────────────────────────────────────────────┐
 │ background.js  (MV3 service worker)                             │
 │                                                                 │
 │   classifier.js  ── fetch(api.anthropic.com/v1/messages)        │
 │                     model: claude-haiku-4-5                     │
 │                     returns {verdict, reason, confidence}       │
 │                                                                 │
 │   logger.js      ── append entry to chrome.storage.local        │
 │                     key: log:YYYY-MM-DD                         │
 │                     + track active-tab duration                 │
 │                     + prune > 30 days on a daily alarm          │
 │                                                                 │
 │   tabs.onUpdated ── re-classify SPA navigations (YouTube,       │
 │                     Reddit, etc. — where content.js doesn't     │
 │                     re-fire because the page never reloads)     │
 └─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
 ┌─────────────────────────────────────────────────────────────────┐
 │ dashboard.html  (chrome-extension://<id>/dashboard.html)        │
 │   password-gated, reads logs from chrome.storage.local          │
 └─────────────────────────────────────────────────────────────────┘
```

### The classification loop

1. A page loads. `content.js` (injected on every URL at `document_idle`) sends `{type: "PAGE_DATA", url, title}` to the service worker.
2. `background.js` hands the URL/title to `classifier.js`, which:
   - Returns a cached verdict if available. On the first call after a worker restart, `hydrateCache()` restores up to 500 entries from `chrome.storage.local`. New verdicts are written back via `persistCache()` (fire-and-forget).
   - Otherwise calls `POST https://api.anthropic.com/v1/messages` with model `claude-haiku-4-5-20251001`, a system prompt tuned for moderate filtering, and a 15 s timeout.
   - Parses the JSON response (`{verdict, reason, confidence}`) and caches it (also persisted to `chrome.storage.local` so it survives service-worker eviction).
3. The verdict is sent back to the content script:
   - `allow` → nothing happens; the page is invisible to the user.
   - `block` → `overlay.js` mounts a Shadow-DOM warning with a 5-second countdown. When the timer hits zero, the content script asks the service worker to close the tab via `chrome.tabs.remove()`.
4. Every classified visit is logged via `logger.js`.

### SPA navigations

`content.js` only runs once per full page load, so single-page-app navigations (YouTube video clicks, Reddit subreddit changes, Twitter feeds) would otherwise slip by. `background.js` subscribes to `chrome.tabs.onUpdated` and re-classifies whenever the URL changes. If the new URL is blocked, it pushes a `SHOW_OVERLAY` message to the tab's content script so the overlay still appears.

### Fail-open everywhere

If the classifier module fails to load, if the API key is missing, if the request times out, if the JSON response is malformed — the verdict is always `allow`. The explicit goal is that bugs must not prevent the child from using the browser. See `background.js:21` and `classifier.js:183`.

### Prompt-injection defense

Page titles feed into the Claude prompt. Since a page can set `document.title` to anything, the classifier strips newlines and caps length before sending (`classifier.js:117`), and the overlay HTML-escapes any classifier-returned `reason` string before rendering (`overlay.js:74`).

### Duration tracking

The dashboard's "Time online" stat and per-domain rankings depend on accurate per-page duration. This is harder than it looks because URLs change *inside* a focused tab (SPA navigation, full-page reloads), and the per-tab pointer that duration patches use must move at exactly the right moment.

#### The model

`logger.js` keeps three pieces of in-memory state in the service worker:

- `activeTabId` — which tab is focused right now (`null` when no Chrome window has focus)
- `activeSince` — ms timestamp when that tab became focused
- `lastEntryIdByTab` — map from `tabId` to `{key, id}` pointing at the tab's most recent log entry

Whenever something happens that ends a "viewing session", the elapsed time `now - activeSince` is added to whichever entry the active tab's pointer was pointing at *before* the change.

#### When the timer flushes

| Trigger | What runs | Where the elapsed time lands |
|---------|-----------|------------------------------|
| User switches to a different tab | `tabs.onActivated` → `markTabActive` → `flushActive` | The previously-focused tab's last entry |
| Chrome window loses focus, or another window gains it | `windows.onFocusChanged` → flush or re-mark | Same |
| URL changes within the focused tab (SPA nav, full-page reload) | `logPageVisit` → `flushAndRestart` | The previous entry for that tab; timer immediately restarts on the new entry |
| Tab closes | `tabs.onRemoved` → `forgetTab` → `flushActive` if it was the active tab | The closed tab's last entry |

All four paths route their storage write through the same `withLock` chain (`logger.js:40`), so a duration patch can never race with a concurrent log append.

The SPA / full-page-reload case (third row) is the one most users won't expect to "just work" — it's the difference between `youtube.com/` showing 0s vs. its real dwell time when the kid clicks through to a video. `flushAndRestart` runs *after* the new log entry has been successfully appended but *before* `lastEntryIdByTab` flips to point at it: this keeps a storage-write failure from burning the prior duration without producing the entry that justifies the boundary.

#### Manual test cases

There is no automated test suite — duration tracking depends on real Chrome focus events, real service-worker timing, and real `chrome.storage.local`. Verify by hand. Reload the unpacked extension before each scenario so the worker starts clean, and keep the parent dashboard open in a side window to inspect entries.

1. **Single-page focus (baseline).**
   Open one tab on `https://en.wikipedia.org/wiki/Photosynthesis`. Wait 30s. Switch to another tab. The Wikipedia entry should show ~30s.

2. **SPA navigation within a focused tab.**
   Focus a tab on `https://www.youtube.com/`. Wait 30s. Click any video. Wait 60s. Switch tabs. Two entries: `youtube.com/` ≈ 30s, watch URL ≈ 60s. *Without the SPA flush, `youtube.com/` would be 0s and the watch URL would be ≈ 90s.*

3. **Full-page reload within a focused tab.**
   Focus a Wikipedia article. Wait 20s. Hit `Ctrl+R`. Wait 30s. Switch tabs. Two separate entries for the same URL: ~20s and ~30s. (Reloads are intentionally counted as separate sessions — useful for spotting refresh-spam.)

4. **Background tab opened with `Ctrl+click`.**
   Focus tab A, wait 20s. `Ctrl+click` a link to open tab B in the background. Continue reading tab A for 20s. Switch to tab B for 30s. Switch back to tab A. Tab A's entry shows ~40s; tab B's entry shows ~30s. Tab B never accrues time while it's in the background.

5. **Tab closed without switching first.**
   Focus a tab. Wait 30s. Hit `Ctrl+W`. The closed tab's entry should show ~30s — `tabs.onRemoved` flushes the timer.

6. **Chrome unfocused (alt-tab to another app).**
   Focus a tab. Wait 20s. Click out to another application so Chrome loses window focus. Wait 30s. Click back to Chrome. The entry shows ~20s, not ~50s — the time spent looking at another app is correctly excluded.

7. **Two windows, one Chrome.**
   Open two Chrome windows, one tab each. Focus window 1 for 20s, switch to window 2 for 30s. The window-1 entry should show ~20s and the window-2 entry ~30s. (`windows.onFocusChanged` handles the cross-window switch.)

#### Known limitations (intentionally not fixed yet)

The current model is correct *while the service worker is alive and Chrome's focus events fire*. It misses three cases:

- **Service-worker eviction.** Chrome MV3 evicts idle service workers (~30s of inactivity). `activeTabId` and `activeSince` are wiped — they're plain JS state, not persisted. A long, single-tab read with no other events will accrue 0 duration. *Fix candidate:* mirror `{activeTabId, activeSince}` to `chrome.storage.session` and restore on worker startup.
- **No initial active-mark on browser/extension start.** `activeTabId` is `null` until the first `tabs.onActivated` or `windows.onFocusChanged`. The first session in a freshly-opened browser doesn't accrue time until the user switches tabs. *Fix candidate:* query `chrome.tabs.query({active: true, lastFocusedWindow: true})` on `runtime.onStartup`.
- **System sleep / lock screen.** Chrome's window-focus events don't reliably fire on OS sleep or screen lock, so `activeSince` keeps running across "kid walked away." *Fix candidate:* subscribe to `chrome.idle.onStateChanged` and flush on `idle`/`locked`.

---

## Install & first-time setup

### Prerequisites

- Google Chrome (or any Chromium-based browser that supports MV3 extensions).
- A Claude API key. Get one at [console.anthropic.com](https://console.anthropic.com/). Pay-as-you-go usage with Haiku is cheap — a typical browsing session is fractions of a cent.

### Load the extension

1. Clone or download this repo.
2. Open `chrome://extensions` in Chrome.
3. Turn on **Developer mode** (top right).
4. Click **Load unpacked** and select the `focusguard/` folder (not the repo root).
5. The extension installs and immediately opens a setup tab at `chrome-extension://<id>/setup.html`.

### First-time setup

The setup form (`setup.html`) asks for:

- **Claude API key** — must start with `sk-ant-`. The form makes a single `max_tokens: 1` call to Anthropic to confirm the key is valid before saving it.
- **Parent password** — at least 6 characters. Used later to unlock the dashboard. Hashed before storage (see below).

On submit:
- The API key is stored as-is in `chrome.storage.local` under `apiKey`.
- A random 16-byte salt is generated with `crypto.getRandomValues`, then `sha256(salt + ":" + password)` is stored as `parentPassword: {salt, hash}`.
- A success screen shows a link to the dashboard.

You can re-run setup any time by navigating to `chrome-extension://<id>/setup.html`. Re-submitting replaces both the API key and the password (a fresh salt is generated — salts are never reused).

### After setup

There is **no browser action, no popup, no icon indication**. The extension is intentionally silent. The only visible surfaces are:

- The warning overlay on blocked pages.
- `setup.html` if you re-open it manually.
- `dashboard.html` if you navigate to it manually.

Bookmark `chrome-extension://<id>/dashboard.html` for yourself and don't share that bookmark with the child.

---

## Using the parent dashboard

Open `chrome-extension://<id>/dashboard.html`. The extension ID is visible on the `chrome://extensions` page.

1. Enter the parent password. After 3 wrong attempts you're locked out for 60 seconds.
2. The main view shows today's activity:
   - **Time online** — total active-tab duration.
   - **Educational** — percentage of active time on `allow` pages.
   - **Blocked** — count of block verdicts.
   - **Top domains** — ranked by time spent, not visit count.
   - **Feed** — every classified visit, newest first, with verdict badge, title, domain, duration, confidence, AI reason, and a `cache` tag if the verdict came from the in-memory cache instead of a fresh API call.
3. The date picker lets you scroll back up to 30 days.
4. **Log out** clears the DOM (shoulder-surf defense) and returns to the password screen.

5. The **Allowed URLs** panel lets the parent add URL substrings that always pass classification (stored in `allowlist`).
6. The **Settings** panel lets the parent change the API key (validated against Anthropic before saving) or the password (requires current password; re-hashes with a fresh salt).

---

## Where data is stored

Everything is in `chrome.storage.local`, which is a per-extension key-value store scoped to the local browser profile. Nothing leaves the device except Claude API calls.

| Key                 | Shape                                                       | Written by           |
| ------------------- | ----------------------------------------------------------- | -------------------- |
| `apiKey`            | string, must start with `sk-ant-`                           | `setup.js`, `dashboard.js` |
| `parentPassword`    | `{salt: <hex32>, hash: <sha256(salt + ":" + password)>}`    | `setup.js`, `dashboard.js` |
| `authState`         | `{failCount, lockoutUntil, lastFailAt}`                     | `dashboard.js`       |
| `allowlist`         | `string[]` — substrings matched against URL                 | `dashboard.js`       |
| `verdictCache`      | `[url, {verdict, reason, confidence}][]` — LRU entries      | `classifier.js`      |
| `log:YYYY-MM-DD`    | array of visit entries (see below)                          | `logger.js`          |

Each day is one key. A visit entry looks like:

```json
{
  "id": "k3h9m2ab1a2b",
  "ts": 1734567890123,
  "url": "https://en.wikipedia.org/wiki/Photosynthesis",
  "title": "Photosynthesis - Wikipedia",
  "domain": "en.wikipedia.org",
  "verdict": "allow",
  "reason": "educational reference",
  "confidence": 0.95,
  "source": "api",
  "durationMs": 182000
}
```

- **URL / title / reason** are truncated to 500 / 200 / 200 characters respectively.
- **durationMs** is updated whenever the focused tab's URL changes (SPA nav or full-page reload), focus moves to another tab/window, or the tab closes. See [Duration tracking](#duration-tracking) for the full model, manual test cases, and known limitations. A write lock (`logger.js:40`) keeps duration patches from racing with concurrent log appends.
- **source** is one of `api` (fresh Claude call), `cache` (LRU hit — from memory or restored from storage), `allowlist` (parent bypass), or `fallback` (internal URL, no API key, API error).
- **Cap:** 5000 entries per day. If a bug floods logs, the oldest entries in that day are dropped first.

### Browsing history vs. the log

FocusGuard does **not** read Chrome's built-in history database. It writes its own log, containing only pages the user visited while the extension was installed and active.

### Retention

A `chrome.alarms` alarm (`focusguard-prune`) fires every 24 hours and removes any `log:YYYY-MM-DD` key whose date is older than 30 days. A prune also runs on `onInstalled` and `onStartup`. See `logger.js:155` and `background.js:66`.

### Clearing everything

From the service-worker DevTools console (`chrome://extensions` → FocusGuard → "Service Worker"):

```js
await chrome.storage.local.clear();
```

Or remove just credentials and keep logs:

```js
await chrome.storage.local.remove(['apiKey', 'parentPassword']);
```

---

## Privacy & security model

This is a parental-control tool. The threat model assumes the parent installs and configures the extension, and the child is the "untrusted" user of the same machine — so several defenses are aimed at the child, not at remote attackers.

### What never leaves the device

- Activity logs (URLs, titles, durations, verdicts) — **never sent anywhere**. They live only in `chrome.storage.local` on the local profile.
- The parent password — only its salted SHA-256 hash is stored. The plaintext is never written to disk or sent.
- Chrome browsing history — FocusGuard doesn't read it.

### What does leave the device

Only the page **URL** and **title** are sent to Anthropic, per classification, as the body of a `messages` API call. Page body text, cookies, form fields, and DOM contents are **not** sent. Anthropic's data usage policy applies to those requests.

### API key handling

- Stored in `chrome.storage.local` (not in source, not in sync storage).
- Read on demand by the service worker and cached in memory for the worker's lifetime.
- Validated on read with a `sk-ant-` prefix check.
- Invalidated when storage changes (e.g. re-setup).
- Sent to `api.anthropic.com` as the `x-api-key` header with TLS.

### Password handling

- Hash = `sha256(salt + ":" + password)` with a fresh 16-byte random salt per setup.
- Dashboard verifies by recomputing the hash and comparing in JS (`dashboard.js:78`).
- 3 failed attempts lock the dashboard for 60 seconds; on logout the DOM is cleared so cached entries don't linger behind the auth screen.
- ⚠️ **SHA-256 is fast.** A determined attacker with filesystem access could brute-force a weak password offline. Pick a non-trivial password. A future hardening pass would swap SHA-256 for a slow KDF like PBKDF2 or Argon2.

### Overlay isolation

The warning overlay is injected as a `<div>` with `all: initial`, a maxed-out `z-index`, and a **closed** Shadow DOM. Page scripts can't reach into the shadow tree, and the content script runs in an isolated world so `window.FocusGuardOverlay` isn't exposed to the page. The HTML inside the overlay is generated with explicit escaping of classifier-returned text (`overlay.js:74`).

### Tab-closing authorization

The `CLOSE_TAB` message handler uses `sender.tab.id` — it never trusts a tab id supplied in the message payload, so a compromised page can only close its own tab (`background.js:110`).

### Prompt injection

Page titles are attacker-controlled. Before the title hits the Claude prompt, newlines are stripped and length is capped to 200 characters (`classifier.js:117`). The classifier can't be tricked into changing system instructions by a malicious `<title>`.

### Fail-open philosophy

Every error path — missing API key, API timeout, malformed JSON, classifier not loaded — returns `verdict: "allow"`. The worst-case failure mode is "FocusGuard is broken so the child can browse freely", never "FocusGuard is broken so the browser is unusable".

---

## File layout

```
focusguard/
├── manifest.json      MV3 manifest. Permissions: tabs, storage, alarms, <all_urls>.
├── background.js      Service worker. Routes messages, classifies SPA navs,
│                      tracks focus, runs the daily prune alarm.
├── classifier.js      Claude Haiku client with in-memory LRU cache.
├── logger.js          Activity logger. Per-day storage keys, duration tracking,
│                      write lock, 30-day pruning.
├── content.js         Injected on every page. Sends PAGE_DATA, triggers overlay.
├── overlay.js         Shadow-DOM warning UI with 5-second countdown.
├── setup.html/js/css  First-time setup form (API key + parent password).
├── dashboard.html/js  Parent dashboard (password gate + activity feed + stats).
├── base.css           Shared styles for setup/dashboard.
├── dashboard.css      Dashboard-specific styles.
└── icons/             16 / 48 / 128 px extension icons.
docs/
└── superpowers/specs/2026-04-15-focusguard-design.md   Original design doc.
```

---

## Development notes

- **Pure vanilla JS, no build step.** Edit files in `focusguard/` and hit "Reload" on `chrome://extensions`.
- Service worker logs are in the extension's dedicated DevTools: `chrome://extensions` → FocusGuard → **Service Worker**. You'll see lines like `[FocusGuard] classify <url> -> block (gaming, 0.93, api)`.
- Content-script logs (from `content.js` / `overlay.js`) appear in the DevTools console of the page itself.
- Dashboard / setup pages have their own DevTools — open them from `Ctrl+Shift+I` on the page.
- Dev helpers:
  - `await self.FocusGuardLogger._summary()` in the service-worker console — returns per-day entry counts.
  - `await chrome.storage.local.get(null)` — dump everything.
- Project context and subagent output from the build phases live in `.claude/PRPs/`.

---

## Troubleshooting

**Every page is allowed, nothing is blocked.**
Check the service-worker console. `[FocusGuard] No API key set — allowing by default` means setup didn't save. Re-run `setup.html`. `API error: 401` means the key is rejected — generate a new one. API errors always fail open.

**The overlay doesn't close the tab.**
The tab-close path requires an intact messaging channel between `content.js` and the service worker. A reload of the extension mid-page invalidates the context; just navigate once and subsequent pages will work.

**I forgot the parent password.**
There's no recovery flow by design. Open the service-worker DevTools console and run:

```js
await chrome.storage.local.remove('parentPassword');
```

Then reopen `setup.html` and set a new one.

**I want to wipe all activity.**

```js
const all = await chrome.storage.local.get(null);
const keys = Object.keys(all).filter(k => k.startsWith('log:'));
await chrome.storage.local.remove(keys);
```

---

## Limitations

- **Chromium only.** Uses MV3 service workers and `chrome.storage.local`. Firefox port would need manifest adjustments.
- **Not a security sandbox.** A determined child with developer-tools access can disable the extension at `chrome://extensions`. True kiosk-level lockdown requires OS-level parental controls; FocusGuard is designed for cases where a simple, hidden tool is enough.
- **Depends on Anthropic API availability.** If `api.anthropic.com` is unreachable, the classifier fails open and pages pass through unblocked (by design — see above).
- **Body excerpt is attacker-controlled.** The 2,000-char visible-text excerpt fed to the classifier comes from `document.body.innerText`, which a malicious page can set to anything. The system prompt labels it untrusted and the classifier is prompted to ignore embedded instructions, but a sufficiently adversarial page could theoretically influence the verdict. The excerpt is collapsed to single spaces before sending to prevent injected newlines from visually spawning new prompt sections.
