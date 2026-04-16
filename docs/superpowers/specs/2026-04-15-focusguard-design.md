# FocusGuard — AI-Powered Homework Chrome Extension

## Problem

An 11-year-old uses various laptops for homework (primarily Google Classroom) but gets distracted by non-educational content online. The parent cannot track or block this behavior, resulting in homework taking too long and low-quality output.

## Requirements

1. **AI content filtering** — intelligently classify web pages as educational or not (no static blocklist)
2. **Gentle enforcement** — show a 5-second warning overlay, then close the tab if non-educational
3. **Completely hidden** — the child should not see or know about the extension
4. **Always on** — monitors whenever Chrome is open, no manual toggle
5. **Full activity tracking** — log every website: URL, timestamp, time on page, content classification
6. **Parent dashboard** — password-protected page inside the extension, viewable on the same laptop
7. **Moderate filtering** — block obvious distractions (social media, games, entertainment), allow general knowledge browsing and research
8. **100% local** — no server, no external database, everything runs inside the Chrome extension (inspired by Tab Out's architecture)

## Architecture

Single Chrome extension — no server, no external dependencies beyond the Claude API.

```
[Chrome Extension]
  ├── background.js (service worker)
  │     ├── Listens to all tab navigation events
  │     ├── Calls Claude Haiku API directly for content classification
  │     └── Stores all activity logs in chrome.storage.local
  │
  ├── content.js (content script, injected into every page)
  │     ├── Extracts page title, meta description, visible text snippet
  │     ├── Sends page data to background.js for classification
  │     └── Shows/hides the warning overlay based on verdict
  │
  └── dashboard.html (hidden parent dashboard)
        ├── Password-protected (parent password required to view)
        ├── Reads activity logs from chrome.storage.local
        └── Shows real-time activity feed, stats, and history
```

## First-Time Setup Flow

1. Parent installs extension in Chrome (load unpacked in developer mode)
2. Extension detects no setup has been done — opens setup page
3. Parent enters:
   - **Claude API key** (stored in `chrome.storage.local`, never in source code)
   - **Parent password** (used to access dashboard and settings)
4. Setup page confirms everything is working (test API call)
5. Extension activates — hidden from this point forward

## Content Script (content.js)

### Injected Into Every Page

- Runs on all URLs via manifest `"matches": ["<all_urls>"]`
- On page load:
  1. Extracts: URL, page title, meta description, first 500 characters of visible body text
  2. Sends data to background.js via `chrome.runtime.sendMessage`
  3. Waits for verdict response

### Warning Overlay

- If verdict is `block`:
  - Injects a full-page semi-transparent overlay on top of page content
  - Centered text: "This doesn't look like homework"
  - 5-second countdown visible
  - Cannot be dismissed (overlay captures all click/keyboard events)
  - After 5 seconds, sends message to background.js to close the tab
- If verdict is `allow`:
  - Does nothing — completely invisible
- Overlay is injected via Shadow DOM to prevent the page's CSS from affecting it

## Background Service Worker (background.js)

### AI Classification

- Receives page data from content.js
- Calls Claude Haiku API directly from the service worker using `fetch()`
- API key is read from `chrome.storage.local` (set during first-time setup)

**API Call:**
```
POST https://api.anthropic.com/v1/messages
Headers:
  x-api-key: [key from chrome.storage.local]
  anthropic-version: 2023-06-01
  content-type: application/json
  anthropic-dangerous-direct-browser-access: true
```

**System Prompt:**
```
You are a content classifier for a parental control tool. An 11-year-old is doing
homework. Classify whether this web page is educational/productive or a distraction.

ALLOW: schoolwork, educational content, research, general knowledge, reference
material, educational videos, school-related tools (Google Docs, Classroom, etc.)

BLOCK: social media, gaming, entertainment, streaming video (non-educational),
memes, celebrity news, shopping, chat apps

For ambiguous cases (e.g., YouTube), judge based on the specific content — an
educational YouTube video is allowed, a gaming video is not.

Respond with JSON only:
{"verdict": "allow" or "block", "reason": "brief reason", "confidence": 0.0-1.0}
```

**User Message:**
```
URL: {url}
Title: {title}
Description: {meta_description}
Page content: {first 500 chars of visible text}
```

**Response:**
```json
{
  "verdict": "block",
  "reason": "gaming entertainment video",
  "confidence": 0.95
}
```

### Activity Logging

- Every page visit is logged to `chrome.storage.local` regardless of verdict
- Log entry structure:
  ```json
  {
    "url": "https://example.com/page",
    "title": "Page Title",
    "verdict": "allow",
    "reason": "educational research article",
    "confidence": 0.92,
    "timestamp": "2026-04-15T16:30:00Z",
    "duration_seconds": 180
  }
  ```
- Duration is tracked via tab focus/blur and tab activation events
- Logs are keyed by date for easy retrieval: `activity_2026-04-15`
- Storage cleanup: auto-delete logs older than 30 days to stay within `chrome.storage.local` limits (approximately 5MB)

### Tab Management

- Listens to `chrome.tabs.onUpdated` to detect navigation
- Listens to `chrome.tabs.onActivated` to track which tab is active (for duration tracking)
- Closes tabs via `chrome.tabs.remove()` when content.js reports the 5-second countdown is complete

## Parent Dashboard (dashboard.html)

### Access

- Hidden extension page: `chrome-extension://[extension-id]/dashboard.html`
- Not linked from anywhere visible — parent must type the URL or use a bookmark
- Protected by parent password (checked against hash stored in `chrome.storage.local`)

### Login Screen

- Simple password input
- On correct password, stores a session flag in `sessionStorage` (clears when browser closes)
- After 3 failed attempts, locks for 5 minutes

### Main Dashboard View

**Activity Feed (primary view):**
- Scrolling list of all pages visited today
- Each entry shows:
  - Timestamp
  - Page title (clickable to see full URL)
  - Time spent on page
  - Verdict badge: green "Allowed" or red "Blocked"
  - AI's reason

**Summary Stats (top of page):**
- Total time online today
- Percentage of time on educational vs blocked content
- Number of blocked attempts today
- Top 5 most visited domains today

**Historical View:**
- Date picker to browse past days (up to 30 days)
- Same feed and stats for selected date

### Settings Page (inside dashboard, also password-protected)

- Update Claude API key
- Change parent password
- View extension status (active, API key valid, storage usage)

## Classification Rules (Moderate Filtering)

### Always Allow

- Google Classroom and all Google Workspace apps (Docs, Sheets, Slides, Drive)
- Khan Academy
- Wikipedia
- Educational platforms (Quizlet, Duolingo, Scratch for coding, etc.)
- School domains (.edu)
- Google Search (unless search query is clearly non-educational)
- YouTube videos with educational content (judged per-video by AI)
- News sites for current events research

### Always Block

- Social media: TikTok, Instagram, Snapchat, Twitter/X, Reddit, Discord
- Gaming: Roblox, Steam, Minecraft forums, any gaming site
- Streaming entertainment: Netflix, Disney+, Twitch, Hulu
- Entertainment/memes: BuzzFeed, 9GAG, meme sites
- Shopping: Amazon, eBay (unless clearly for school supplies research)
- Chat/messaging: WhatsApp Web, Messenger

### AI Judges Case by Case

- YouTube (per-video based on title, channel, description)
- Google Search (based on search query content)
- General blogs and articles (educational article vs entertainment)
- Forums (homework help forum vs gaming forum)

## Security & Tamper Resistance

1. **No visible toolbar icon** — manifest configured with no `action` default popup; icon is minimal/blank
2. **Chrome policy lock** — installed via Windows Group Policy so it cannot be disabled or removed without admin password
3. **API key stored securely** — saved in `chrome.storage.local` during setup, never in source code
4. **Dashboard password-protected** — parent password required, with lockout after failed attempts
5. **Shadow DOM for overlay** — warning overlay is injected in Shadow DOM so page scripts cannot detect or remove it

## Chrome Extension Manifest (manifest.json)

```json
{
  "manifest_version": 3,
  "name": "FocusGuard",
  "version": "1.0.0",
  "description": "AI-powered content filter for focused homework sessions",
  "permissions": [
    "tabs",
    "activeTab",
    "storage"
  ],
  "host_permissions": [
    "<all_urls>",
    "https://api.anthropic.com/*"
  ],
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content.js"],
      "run_at": "document_idle"
    }
  ]
}
```

Note: No `action` with popup, no `chrome_url_overrides` — keeps the extension invisible during normal use. The dashboard is accessed directly via its extension URL.

## Tech Stack Summary

| Component | Technology | Storage | Cost |
|-----------|-----------|---------|------|
| Extension | Vanilla JS, Chrome Manifest V3 | Installed locally | Free |
| Data Storage | chrome.storage.local | Local (~5MB limit) | Free |
| AI Classification | Claude Haiku API (direct fetch) | N/A | ~$0.01-0.05/session |
| Dashboard | Plain HTML/CSS/JS in extension | N/A | Free |

**Estimated total cost: ~$1-3/month** (Claude Haiku API calls only)

## File Structure

```
focusguard/
├── manifest.json          # Extension configuration
├── background.js          # Service worker: AI classification, logging, tab management
├── content.js             # Content script: page data extraction, warning overlay
├── dashboard.html         # Parent dashboard UI
├── dashboard.js           # Dashboard logic: reads logs, renders stats
├── dashboard.css          # Dashboard styles
├── setup.html             # First-time setup page
├── setup.js               # Setup logic: API key + password entry
├── setup.css              # Setup styles
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## Limitations

- Only works in Chrome (if he opens Edge or Firefox, extension doesn't apply)
- Only works on devices where the extension is installed
- Requires internet connection for AI classification (page loads briefly before verdict arrives)
- Dashboard is only accessible on the same laptop (no remote/phone access)
- YouTube detection depends on video metadata — may miss some edge cases
- `chrome.storage.local` has ~5MB limit — 30-day auto-cleanup prevents overflow
- Claude API key is stored locally in the browser — low risk for an 11-year-old, but not zero

## Future Improvements (Not in Scope for V1)

- DNS-level filtering for whole-network coverage (all devices, all browsers)
- Browser extension ports for Edge and Firefox
- Allowlist/blocklist overrides in dashboard (parent manually approves/blocks specific sites)
- Remote dashboard (add a small Vercel backend for phone access)
- Weekly email summary reports
- Multiple child profiles
- Homework assignment integration (smarter classification based on current subjects)
