# Feature: FocusGuard Extension Scaffold (Phase 1)

## Summary

Build the foundational Chrome Manifest V3 extension skeleton for FocusGuard — an AI-powered homework focus extension. This phase creates the project structure, manifest configuration, empty background service worker, content script that runs on all pages, and placeholder HTML pages (dashboard + setup). No AI classification, no overlay, no logging — just a working extension that loads in Chrome developer mode and proves content script injection works.

## User Story

As a parent setting up FocusGuard
I want a working Chrome extension skeleton that installs and runs
So that subsequent phases can build AI classification, overlay, logging, and dashboard features on a solid foundation

## Problem Statement

There is no FocusGuard extension yet. We need a Manifest V3 Chrome extension skeleton that:
1. Loads in Chrome without errors
2. Injects a content script into every web page
3. Has a background service worker ready for message handling
4. Has placeholder dashboard.html and setup.html pages
5. Follows the same architecture patterns as the Tab Out reference implementation

## Solution Statement

Create a vanilla JS Chrome extension (no build step, no bundler) following the Tab Out pattern: Manifest V3, service worker background, content script, chrome.storage.local, and static HTML pages. The key architectural difference from Tab Out is that FocusGuard needs content scripts injected into all pages (Tab Out has none) and uses a hidden extension page for the dashboard (Tab Out overrides the new tab page).

## Metadata

| Field            | Value                                         |
| ---------------- | --------------------------------------------- |
| Type             | NEW_CAPABILITY                                |
| Complexity       | LOW                                           |
| Systems Affected | Chrome extension (new project)                |
| Dependencies     | Chrome browser, Manifest V3                   |
| Estimated Tasks  | 8                                             |

---

## UX Design

### Before State

```
+-----------------------------------------------------------------------+
|                        BEFORE: No Extension                           |
+-----------------------------------------------------------------------+
|                                                                       |
|   Child opens Chrome -> navigates freely -> no monitoring             |
|                                                                       |
|   Parent has: NOTHING                                                 |
|   - No extension installed                                            |
|   - No project files                                                  |
|   - No way to build subsequent features                               |
|                                                                       |
|   DATA_FLOW: None                                                     |
+-----------------------------------------------------------------------+
```

### After State

```
+-----------------------------------------------------------------------+
|                    AFTER: Extension Scaffold Loaded                    |
+-----------------------------------------------------------------------+
|                                                                       |
|   Chrome loads extension in developer mode                            |
|     |                                                                 |
|     +-> background.js (service worker) starts                         |
|     |     - Listens for messages from content script                  |
|     |     - Handles onInstalled (opens setup page)                    |
|     |                                                                 |
|     +-> content.js injects into EVERY web page                        |
|     |     - Extracts page URL + title                                 |
|     |     - Sends data to background via chrome.runtime.sendMessage   |
|     |     - Ready for overlay injection (Phase 3)                     |
|     |                                                                 |
|     +-> setup.html accessible at chrome-extension://[id]/setup.html   |
|     |     - Placeholder: "FocusGuard Setup" heading                   |
|     |     - Auto-opens on first install                               |
|     |                                                                 |
|     +-> dashboard.html at chrome-extension://[id]/dashboard.html      |
|           - Placeholder: "FocusGuard Dashboard" heading               |
|           - Password-protected (Phase 5)                              |
|                                                                       |
|   DATA_FLOW:                                                          |
|   page load -> content.js extracts {url, title} ->                    |
|   chrome.runtime.sendMessage -> background.js receives + logs         |
|                                                                       |
+-----------------------------------------------------------------------+
```

### Interaction Changes

| Location | Before | After | User Impact |
|----------|--------|-------|-------------|
| Chrome extensions page | No FocusGuard | FocusGuard listed, loads without errors | Extension exists |
| Any web page | No content script | content.js runs, extracts page data | Foundation for AI classification |
| chrome-extension://[id]/setup.html | N/A | Placeholder setup page opens on install | Ready for API key + password (Phase 6) |
| chrome-extension://[id]/dashboard.html | N/A | Placeholder dashboard page | Ready for activity feed (Phase 5) |
| Browser console | Nothing | Logs from content.js + background.js | Proves message passing works |

---

## Mandatory Reading

**CRITICAL: Implementation agent MUST read these files before starting any task:**

| Priority | File | Lines | Why Read This |
|----------|------|-------|---------------|
| P0 | Tab Out `manifest.json` | all | Manifest V3 structure to MIRROR (captured below) |
| P0 | Tab Out `background.js` | all | Service worker pattern to MIRROR (captured below) |
| P1 | Tab Out `index.html` | 1-30 | HTML page structure pattern |

**External Documentation:**

| Source | Section | Why Needed |
|--------|---------|------------|
| [Manifest - content_scripts (Chrome Developers)](https://developer.chrome.com/docs/extensions/reference/manifest/content-scripts) | matches, run_at, js | Content script injection config |
| [Content Scripts (Chrome Developers)](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts) | Message passing | content <-> background communication |
| [anthropic-dangerous-direct-browser-access (Simon Willison)](https://simonwillison.net/2024/Aug/23/anthropic-dangerous-direct-browser-access/) | CORS header | Phase 2 context — how API calls will work from service worker |

---

## Patterns to Mirror

**MANIFEST_STRUCTURE:**
```json
// SOURCE: Tab Out manifest.json:1-21
// COPY THIS STRUCTURE, adapt fields:
{
  "manifest_version": 3,
  "name": "Tab Out",
  "version": "1.0.0",
  "description": "Keep tabs on your tabs...",
  "permissions": ["tabs", "activeTab", "storage"],
  "chrome_url_overrides": { "newtab": "index.html" },
  "background": { "service_worker": "background.js" },
  "action": {
    "default_title": "Tab Out",
    "default_icon": { "16": "icons/icon16.png", "48": "icons/icon48.png" }
  },
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```

**SERVICE_WORKER_PATTERN:**
```javascript
// SOURCE: Tab Out background.js:1-93
// COPY THIS STRUCTURE:
// 1. JSDoc comment header explaining purpose
// 2. Section separators: // --- Section Name ---
// 3. Event listeners: chrome.runtime.onInstalled, chrome.runtime.onStartup
// 4. chrome.tabs event listeners
// 5. Try/catch for all chrome.* API calls
// 6. Async functions throughout

async function updateBadge() {
  try {
    const tabs = await chrome.tabs.query({});
    // ...filter and process...
  } catch {
    // fail gracefully
  }
}

chrome.runtime.onInstalled.addListener(() => { updateBadge(); });
chrome.runtime.onStartup.addListener(() => { updateBadge(); });
chrome.tabs.onCreated.addListener(() => { updateBadge(); });
```

**HTML_PAGE_PATTERN:**
```html
<!-- SOURCE: Tab Out index.html:1-15 -->
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tab Out</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=..." rel="stylesheet">
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div class="container">
    <!-- content -->
  </div>
  <script src="app.js"></script>
</body>
</html>
```

**CSS_VARIABLES_PATTERN:**
```css
/* SOURCE: Tab Out style.css:1-20 */
:root {
  --ink: #1a1613;
  --paper: #f8f5f0;
  --warm-gray: #e8e2da;
  --muted: #9a918a;
  --accent-amber: #c8713a;
  --accent-sage: #5a7a62;
  --accent-slate: #5a6b7a;
  --accent-rose: #b35a5a;
  --status-active: #3d7a4a;
  --status-cooling: #b8892e;
  --status-abandoned: #b35a5a;
  --card-bg: #fffdf9;
  --shadow: rgba(26, 22, 19, 0.06);
}
```

**NAMING_CONVENTIONS:**
- Functions: camelCase (`fetchOpenTabs`, `saveTabForLater`)
- Variables: camelCase (`openTabs`, `domainGroups`)
- Constants: UPPER_SNAKE (`FRIENDLY_DOMAINS`)
- HTML data attributes: kebab-case (`data-action`, `data-tab-url`)
- CSS classes: kebab-case (`tab-cleanup-banner`, `header-left`)
- File names: kebab-case for multi-word, otherwise simple (`background.js`, `content.js`)

**ERROR_HANDLING:**
```javascript
// SOURCE: Tab Out background.js:57-60
// Pattern: try/catch with silent fallback for non-critical operations
try {
  // chrome API call
} catch {
  // fail gracefully — clear/reset rather than crash
}
```

---

## Files to Change

| File | Action | Justification |
| ---- | ------ | ------------- |
| `focusguard/manifest.json` | CREATE | Manifest V3 config with content scripts, background worker, permissions |
| `focusguard/background.js` | CREATE | Service worker — message handling, onInstalled, tab events |
| `focusguard/content.js` | CREATE | Content script — page data extraction, message to background |
| `focusguard/dashboard.html` | CREATE | Placeholder parent dashboard page |
| `focusguard/dashboard.css` | CREATE | Minimal dashboard styles using CSS variable pattern |
| `focusguard/setup.html` | CREATE | Placeholder first-time setup page |
| `focusguard/setup.css` | CREATE | Minimal setup styles using CSS variable pattern |
| `focusguard/icons/icon16.png` | CREATE | 16x16 extension icon (simple colored square placeholder) |
| `focusguard/icons/icon48.png` | CREATE | 48x48 extension icon |
| `focusguard/icons/icon128.png` | CREATE | 128x128 extension icon |

---

## NOT Building (Scope Limits)

- **Claude API integration** — Phase 2. background.js will NOT call any AI APIs yet.
- **Warning overlay** — Phase 3. content.js will NOT inject any overlays.
- **Activity logging to storage** — Phase 4. No chrome.storage.local writes beyond setup state.
- **Dashboard UI / activity feed** — Phase 5. dashboard.html is a placeholder only.
- **Setup form / API key input** — Phase 6. setup.html is a placeholder only.
- **Stealth mode / icon hiding** — Phase 7. Extension icon visible during development.
- **Sound effects / confetti** — Tab Out feature, not needed for FocusGuard.
- **Any CSS beyond minimal placeholders** — Full styling comes with Phase 5/6.
- **Icons beyond colored placeholders** — Real icons can come later.

---

## Step-by-Step Tasks

Execute in order. Each task is atomic and independently verifiable.

### Task 1: CREATE project directory structure

- **ACTION**: Create the `focusguard/` directory with subdirectories
- **IMPLEMENT**:
  ```
  focusguard/
  ├── manifest.json
  ├── background.js
  ├── content.js
  ├── dashboard.html
  ├── dashboard.css
  ├── setup.html
  ├── setup.css
  └── icons/
      ├── icon16.png
      ├── icon48.png
      └── icon128.png
  ```
- **MIRROR**: Tab Out's flat extension directory structure (no nested src/, no build step)
- **GOTCHA**: All files must be at the root of `focusguard/` — Chrome loads unpacked from this directory
- **VALIDATE**: `ls -la focusguard/` shows all expected files and `icons/` subdirectory

### Task 2: CREATE `focusguard/manifest.json`

- **ACTION**: Create Manifest V3 configuration
- **IMPLEMENT**:
  ```json
  {
    "manifest_version": 3,
    "name": "FocusGuard",
    "version": "0.1.0",
    "description": "AI-powered homework focus assistant. Keeps students on task by classifying web content.",
    "permissions": ["tabs", "storage", "activeTab"],
    "host_permissions": ["<all_urls>"],
    "background": {
      "service_worker": "background.js"
    },
    "content_scripts": [
      {
        "matches": ["<all_urls>"],
        "js": ["content.js"],
        "run_at": "document_idle"
      }
    ],
    "action": {
      "default_title": "FocusGuard"
    },
    "icons": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  }
  ```
- **MIRROR**: Tab Out `manifest.json` structure
- **KEY DIFFERENCES FROM TAB OUT**:
  1. `content_scripts` block added (Tab Out has none) — injects content.js on all pages
  2. `host_permissions: ["<all_urls>"]` added — required for content script `<all_urls>` match and for future fetch() to Claude API from service worker
  3. NO `chrome_url_overrides` — dashboard is a hidden page, not a new tab replacement
  4. NO `action.default_icon` for now — icon will be set but no popup
  5. `run_at: "document_idle"` — safest default, runs after DOM is ready
- **GOTCHA**: `<all_urls>` in content_scripts.matches requires `host_permissions` in Manifest V3. Without it, content script won't inject. Also: Chrome will show a permission warning on install — acceptable for developer mode.
- **GOTCHA**: Do NOT add `"type": "module"` to the service_worker — modules in service workers have different lifecycle behavior and Tab Out doesn't use them.
- **VALIDATE**: Load extension in Chrome via `chrome://extensions` → "Load unpacked" → select `focusguard/`. Extension should appear with no errors.

### Task 3: CREATE `focusguard/background.js`

- **ACTION**: Create background service worker with message handling skeleton
- **IMPLEMENT**:
  ```javascript
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
  ```
- **MIRROR**: Tab Out `background.js` — JSDoc header, section separators, event listener pattern, URL filtering
- **GOTCHA**: `chrome.runtime.onMessage.addListener` callback must `return true` if `sendResponse` will be called asynchronously (even though Phase 1 is sync, this prevents future bugs)
- **GOTCHA**: Do NOT use `async` in the `onMessage` listener callback — Chrome expects a synchronous `return true` to keep the message channel open. Use `sendResponse` instead of returning a promise.
- **VALIDATE**: Load extension, open any web page, check `chrome://extensions` → FocusGuard → "Inspect views: service worker" → Console shows "[FocusGuard] Page data received" logs

### Task 4: CREATE `focusguard/content.js`

- **ACTION**: Create content script that extracts page data and sends to background
- **IMPLEMENT**:
  ```javascript
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
  ```
- **MIRROR**: Tab Out's pattern of IIFE for content scripts, `chrome.runtime.lastError` checking
- **GOTCHA**: Always check `chrome.runtime.lastError` in the sendMessage callback — if the service worker is inactive or extension reloads, this prevents uncaught errors flooding the console
- **GOTCHA**: content.js runs in an ISOLATED world by default (Manifest V3) — it can access the DOM but not page JS globals. This is what we want.
- **VALIDATE**: Open any web page → right-click → Inspect → Console should NOT show errors from FocusGuard. Background service worker console SHOULD show the PAGE_DATA log.

### Task 5: CREATE `focusguard/setup.html`

- **ACTION**: Create placeholder first-time setup page
- **IMPLEMENT**:
  ```html
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>FocusGuard Setup</title>
    <link rel="stylesheet" href="setup.css">
  </head>
  <body>
    <div class="container">
      <h1>FocusGuard Setup</h1>
      <p>Welcome to FocusGuard. Setup form coming in Phase 6.</p>
      <p class="muted">This page will collect your Claude API key and parent password.</p>
    </div>
  </body>
  </html>
  ```
- **MIRROR**: Tab Out `index.html` — DOCTYPE, meta tags, container div pattern
- **GOTCHA**: No `<script>` tags needed yet — setup.js will be added in Phase 6
- **VALIDATE**: Navigate to `chrome-extension://[extension-id]/setup.html` — page renders with heading

### Task 6: CREATE `focusguard/setup.css`

- **ACTION**: Create minimal setup page styles
- **IMPLEMENT**:
  ```css
  /* setup.css — FocusGuard Setup Page Styles (Phase 1: minimal) */

  :root {
    --ink: #1a1613;
    --paper: #f8f5f0;
    --muted: #9a918a;
  }

  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background: var(--paper);
    color: var(--ink);
    line-height: 1.6;
  }

  .container {
    max-width: 480px;
    margin: 80px auto;
    padding: 0 24px;
  }

  h1 {
    font-size: 24px;
    font-weight: 400;
    margin-bottom: 16px;
  }

  p { margin-bottom: 12px; }

  .muted { color: var(--muted); font-size: 14px; }
  ```
- **MIRROR**: Tab Out CSS variables (--ink, --paper, --muted), container pattern, font stack
- **VALIDATE**: Setup page renders centered with warm neutral colors

### Task 7: CREATE `focusguard/dashboard.html` and `focusguard/dashboard.css`

- **ACTION**: Create placeholder parent dashboard page with minimal styles
- **IMPLEMENT dashboard.html**:
  ```html
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>FocusGuard Dashboard</title>
    <link rel="stylesheet" href="dashboard.css">
  </head>
  <body>
    <div class="container">
      <h1>FocusGuard Dashboard</h1>
      <p>Parent activity dashboard coming in Phase 5.</p>
      <p class="muted">This page will show browsing activity, stats, and history.</p>
    </div>
  </body>
  </html>
  ```
- **IMPLEMENT dashboard.css**: Same CSS variable pattern as setup.css (copy from Task 6)
- **MIRROR**: Tab Out `index.html` structure
- **VALIDATE**: Navigate to `chrome-extension://[extension-id]/dashboard.html` — page renders

### Task 8: CREATE placeholder icons

- **ACTION**: Generate simple colored PNG icons (16x16, 48x48, 128x128)
- **IMPLEMENT**: Use a simple approach — generate solid-color PNG files using canvas or a script. Color: `#5a7a62` (accent-sage from Tab Out palette — represents "focused/educational"). Alternative: use any simple PNG generation method available.
- **APPROACH OPTIONS** (in order of preference):
  1. Use Python with Pillow: `python -c "from PIL import Image; img = Image.new('RGB', (16,16), '#5a7a62'); img.save('icon16.png')"`
  2. Use ImageMagick: `convert -size 16x16 xc:'#5a7a62' icon16.png`
  3. Use Node canvas or sharp if available
  4. Create minimal valid PNGs manually (binary)
  5. Copy any existing small PNGs and rename them
- **GOTCHA**: Icons MUST be valid PNG files — Chrome will reject the extension if icon files are missing or corrupt. If no image tool is available, create the smallest valid PNG possible (a 1x1 transparent PNG is 67 bytes).
- **VALIDATE**: Extension loads without icon-related errors in `chrome://extensions`

---

## Testing Strategy

### Manual Verification Tests

| Test | Steps | Expected Result |
|------|-------|-----------------|
| Extension loads | Load unpacked from `focusguard/` | No errors on chrome://extensions |
| Setup page opens on install | Reload extension (simulates install) | setup.html tab opens automatically |
| Content script runs | Open any website (e.g., google.com) | Background console shows PAGE_DATA log |
| Content script skips internal pages | Open chrome://settings | No PAGE_DATA log (filtered in background.js) |
| Dashboard accessible | Navigate to chrome-extension://[id]/dashboard.html | Placeholder page renders |
| Setup accessible | Navigate to chrome-extension://[id]/setup.html | Placeholder page renders |
| No console errors | Open any 5 websites | No errors in page console or service worker console |
| Message passing works | Open website, check background console | Log shows url, title, tabId |

### Edge Cases Checklist

- [ ] Extension loads with no icon errors
- [ ] Content script doesn't crash on about:blank pages
- [ ] Content script handles pages with empty titles
- [ ] Background worker survives service worker restart (Chrome may kill idle workers)
- [ ] Multiple rapid navigations don't cause message queue issues
- [ ] Extension works on both HTTP and HTTPS pages
- [ ] Content script doesn't inject into chrome:// or extension pages (manifest excludes them)

---

## Validation Commands

### Level 1: STATIC_ANALYSIS

```bash
# No build step — validate JSON syntax of manifest
python -c "import json; json.load(open('focusguard/manifest.json')); print('manifest.json: valid')"
# Or: node -e "JSON.parse(require('fs').readFileSync('focusguard/manifest.json')); console.log('valid')"
```

**EXPECT**: "valid" output, no JSON parse errors

### Level 2: STRUCTURE_CHECK

```bash
# Verify all required files exist
ls focusguard/manifest.json focusguard/background.js focusguard/content.js focusguard/dashboard.html focusguard/dashboard.css focusguard/setup.html focusguard/setup.css focusguard/icons/icon16.png focusguard/icons/icon48.png focusguard/icons/icon128.png
```

**EXPECT**: All 10 files listed without errors

### Level 3: MANIFEST_VALIDATION

```bash
# Verify manifest has required fields
python -c "
import json
m = json.load(open('focusguard/manifest.json'))
assert m['manifest_version'] == 3, 'Must be Manifest V3'
assert 'background' in m, 'Missing background'
assert m['background']['service_worker'] == 'background.js', 'Wrong service worker'
assert 'content_scripts' in m, 'Missing content_scripts'
assert m['content_scripts'][0]['matches'] == ['<all_urls>'], 'Wrong matches'
assert 'storage' in m['permissions'], 'Missing storage permission'
assert 'tabs' in m['permissions'], 'Missing tabs permission'
print('All manifest checks passed')
"
```

**EXPECT**: "All manifest checks passed"

### Level 4: ICON_VALIDATION

```bash
# Verify icon files are valid PNGs (start with PNG magic bytes)
python -c "
for size in [16, 48, 128]:
    with open(f'focusguard/icons/icon{size}.png', 'rb') as f:
        header = f.read(8)
        assert header[:4] == b'\\x89PNG', f'icon{size}.png is not a valid PNG'
print('All icons are valid PNGs')
"
```

**EXPECT**: "All icons are valid PNGs"

### Level 5: BROWSER_VALIDATION (Manual)

1. Open `chrome://extensions` in Chrome
2. Enable "Developer mode" (top-right toggle)
3. Click "Load unpacked" → select `focusguard/` directory
4. Verify: Extension appears with name "FocusGuard", no error badges
5. Verify: setup.html tab opens automatically
6. Open any website (e.g., google.com)
7. Go to `chrome://extensions` → FocusGuard → "Inspect views: service worker"
8. Verify: Console shows `[FocusGuard] Page data received: {url: "https://google.com/...", title: "Google", tabId: N}`
9. Navigate to `chrome-extension://[id]/dashboard.html` → verify placeholder renders

---

## Acceptance Criteria

- [ ] Extension loads in Chrome developer mode without errors  *(manual — requires Chrome)*
- [ ] Setup page auto-opens on first install (chrome.runtime.onInstalled)  *(manual — requires Chrome)*
- [ ] Content script runs on every web page and sends PAGE_DATA message  *(manual — requires Chrome)*
- [ ] Background service worker receives messages and logs them  *(manual — requires Chrome)*
- [ ] Background worker skips internal chrome:// and extension pages  *(manual — requires Chrome)*
- [ ] dashboard.html renders as a placeholder page  *(manual — requires Chrome)*
- [ ] setup.html renders as a placeholder page  *(manual — requires Chrome)*
- [x] All icons are valid PNG files
- [x] manifest.json is valid Manifest V3 with content_scripts and host_permissions
- [ ] No console errors on normal browsing (5+ pages tested)  *(manual — requires Chrome)*
- [x] Code follows Tab Out naming conventions (camelCase functions, kebab-case CSS)
- [x] No build step required — plain vanilla JS

---

## Completion Checklist

- [x] All 8 tasks completed in order
- [x] Each task validated immediately after completion
- [x] Level 1: manifest.json parses as valid JSON
- [x] Level 2: All 10 files exist
- [x] Level 3: Manifest has correct fields and values
- [x] Level 4: Icons are valid PNGs
- [ ] Level 5: Browser validation — extension loads, content script works, pages render  *(manual — requires Chrome)*
- [x] All automated acceptance criteria met

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
| ---- | ---------- | ------ | ---------- |
| No image generation tool available for icons | MEDIUM | LOW | Create minimal valid PNG using Python struct/bytes, or base64-decode a known small PNG |
| Content script injection blocked by Chrome on certain pages | LOW | LOW | Expected for chrome://, extension pages — manifest excludes these. document_idle handles most edge cases. |
| Service worker goes idle and misses messages | LOW | MEDIUM | Chrome wakes the service worker on message receipt. onMessage listener re-registers on wake. |
| `<all_urls>` permission triggers Chrome Web Store warning | LOW | NONE | Extension is loaded locally in dev mode, not published to store |

---

## Notes

- **No build step**: Following Tab Out, this is vanilla JS. No npm, no webpack, no TypeScript. Files are edited directly and loaded into Chrome.
- **File location**: Extension files go in `focusguard/` at the project root (sibling to `.claude/` and `docs/`).
- **Tab Out reference was removed**: The reference implementation (`tab-out/` directory) is no longer in the project but all relevant patterns have been captured in this plan's "Patterns to Mirror" section.
- **Phase 2 context**: The background.js message handler currently returns `{ verdict: 'allow' }` for everything. Phase 2 will replace this with a Claude Haiku API call.
- **Phase 3 context**: content.js currently just logs when verdict is 'block'. Phase 3 will inject a Shadow DOM overlay with a 5-second countdown.
- **Icon strategy**: Placeholder solid-color icons are sufficient. The extension icon will eventually be hidden (Phase 7 stealth mode), so polished icons are low priority.
