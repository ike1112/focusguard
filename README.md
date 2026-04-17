# FocusGuard

FocusGuard is a helper for Chrome that keeps kids focused while doing homework. When your child opens a website, FocusGuard quietly asks an AI whether the page looks like schoolwork or a distraction. If it's a distraction (like games, TikTok, or YouTube videos about Minecraft), a full-screen warning appears for 5 seconds and then the tab closes by itself.

It was built with an 11-year-old in mind — someone who does homework on Google Classroom but keeps wandering off to Roblox or gaming videos. You set it up once, and after that it runs silently in the background. Your child never sees an icon, a popup, or a menu.

- **Everything stays on your computer.** No website, no company server, no account. Nothing about your child's browsing is sent anywhere except the one AI question.
- **Only you can see the activity.** There's a hidden page where you log in with a password to see what your child has been doing.
- **It's gentle.** No loud alarms, no scary messages. Just a calm 5-second warning, then the tab closes.

---

## Quick start for parents (no technical jargon)

### What you need first

1. **A computer with Google Chrome.** If you don't have Chrome, download it from [google.com/chrome](https://www.google.com/chrome/).
2. **An "API key" from Anthropic.** This is a secret code that lets your computer ask the AI questions. Think of it like a prepaid phone card — you pay a tiny amount (usually a few cents a month for normal browsing) based on how many questions get asked.
   - Go to [console.anthropic.com](https://console.anthropic.com/) and make an account.
   - Add a small amount of money (even $5 lasts a long time).
   - Find the "API keys" section and click "Create key."
   - Copy the long code that starts with `sk-ant-`. Keep it private — don't share it or paste it into random websites. You'll need it in a moment.

### How to install FocusGuard

1. Download this project to your computer (click the green "Code" button on GitHub → "Download ZIP", then unzip it). You'll end up with a folder called `FocusGuard` that contains another folder called `focusguard`.
2. Open Chrome and type this into the address bar: `chrome://extensions`
3. In the top-right corner of that page, turn on the switch labeled **"Developer mode."**
4. A new button appears: **"Load unpacked."** Click it.
5. A file picker opens. Find the `FocusGuard` folder you downloaded, open it, and select the **`focusguard`** folder inside. Click "Select folder."
6. A new tab opens automatically — this is the setup page.

### How to set it up

On the setup page:

1. **Paste the API key** you copied earlier (the `sk-ant-...` code) into the first box.
2. **Pick a parent password.** This is what you'll use later to see what your child did. Use at least 6 characters, and pick something your child can't guess. **Write it down somewhere safe** — there's no "forgot password" button.
3. Type the same password again in the confirmation box.
4. Click **"Save and activate."**

The page will say "Setup complete." That's it — FocusGuard is now watching.

### What happens from now on

- When your child opens a homework page (Google Classroom, Khan Academy, Wikipedia, a math site, etc.), nothing happens. They won't even know FocusGuard exists.
- When your child opens a distraction (Roblox, gaming videos, TikTok, etc.), a dark screen appears that says **"This doesn't look like homework."** A countdown goes from 5 down to 0, and then the tab closes itself.
- There is no icon, no button, no popup. The extension is invisible on purpose.

### How to check what your child did

1. In Chrome's address bar, type: `chrome://extensions`
2. Find **FocusGuard** in the list. Below its name, there's an ID that looks like `abcdefghijklmnop...` — a long string of letters. Copy it.
3. In the address bar, type: `chrome-extension://` then paste the ID, then add `/dashboard.html`. So the full address looks like: `chrome-extension://abcdefghijklmnop.../dashboard.html`
4. **Tip:** bookmark this page for yourself once you've opened it. Just don't name the bookmark something obvious like "spy on kid" — give it a boring name like "Work" so your child doesn't get curious.
5. Enter your parent password. If you type it wrong 3 times, you have to wait 1 minute before trying again.
6. You'll see:
   - **Today's activity** — every website your child opened, with the time, how long they spent there, whether it was allowed or blocked, and why the AI decided that.
   - **Numbers at the top** — total time online, how much of that was educational, how many distractions got blocked, and their most-visited sites.
   - **A date picker** to scroll back through the last 30 days.

### If something goes wrong

- **Everything is allowed, nothing is getting blocked.** Your API key might be missing or wrong. Go to `chrome-extension://<id>/setup.html` and do setup again.
- **You forgot your password.** There's no way to recover it — but you can reset it. Go to `chrome://extensions`, find FocusGuard, click **"Remove,"** then install it again and pick a new password. (You'll lose the past activity history when you do this.)
- **You want to uninstall it.** Go to `chrome://extensions`, find FocusGuard, click **"Remove."** Everything — the API key, password, and activity history — is deleted from your computer.
- **Your child found out about it.** That's okay — the goal isn't really to spy, it's to help them stay focused. Some parents find it works better to just tell their child: "This thing closes distracting tabs while you do homework." Up to you.

### What does it cost?

Only what you pay Anthropic for AI questions. Each page your child opens costs a tiny fraction of a cent. In practice, a normal month of browsing costs a few cents to maybe a dollar. You control the budget on Anthropic's website and can set a monthly limit so you're never surprised.

FocusGuard itself is free. There's no subscription.

---

## Table of contents (technical details below)

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
   - Returns a cached verdict if the URL has been seen this worker lifetime (in-memory LRU, 500 entries).
   - Otherwise calls `POST https://api.anthropic.com/v1/messages` with model `claude-haiku-4-5`, a system prompt tuned for moderate filtering, and a 15 s timeout.
   - Parses the JSON response (`{verdict, reason, confidence}`) and caches it.
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

The dashboard is read-only. It does not edit logs or settings.

---

## Where data is stored

Everything is in `chrome.storage.local`, which is a per-extension key-value store scoped to the local browser profile. Nothing leaves the device except Claude API calls.

| Key                 | Shape                                                       | Written by     |
| ------------------- | ----------------------------------------------------------- | -------------- |
| `apiKey`            | string, must start with `sk-ant-`                           | `setup.js`     |
| `parentPassword`    | `{salt: <hex32>, hash: <sha256(salt + ":" + password)>}`    | `setup.js`     |
| `log:YYYY-MM-DD`    | array of visit entries (see below)                          | `logger.js`    |

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
- **durationMs** is updated when the tab loses focus (`tabs.onActivated`, `windows.onFocusChanged`). There's a write lock in `logger.js:40` so duration patches don't race with new visits.
- **source** is one of `api` (fresh Claude call), `cache` (in-memory LRU hit), or `fallback` (internal URL, no API key, API error).
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
- **Title-only classification.** The classifier sees the URL and `<title>` but not page body text. That keeps request size and latency low, but some legitimately-titled-but-off-task pages can slip through, and some well-titled educational pages on suspicious domains get blocked. The system prompt is tuned to lean toward allow when uncertain.
- **In-memory cache only.** Verdicts aren't persisted across service-worker restarts (Chrome aggressively terminates idle MV3 workers), so the same URL may be re-classified if the worker has been evicted. This is a cost/freshness trade-off — re-querying on fresh workers keeps verdicts current.
