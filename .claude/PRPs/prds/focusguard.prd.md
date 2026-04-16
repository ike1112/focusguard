# FocusGuard — AI-Powered Homework Focus Chrome Extension

## Problem Statement

A parent's 11-year-old child uses the family laptop for homework (primarily Google Classroom) but gets distracted by non-educational content — gaming sites, social media, entertainment videos. The parent has no visibility into what the child is actually doing online, and no way to automatically enforce focus. This results in homework taking significantly longer than it should and producing lower-quality output. Existing parental control tools either use static blocklists (which break legitimate research), focus on blocking unsafe/adult content rather than distractions, require expensive subscriptions, or don't provide activity logging.

## Evidence

- Parent directly observes: child's homework takes too long and quality is low
- Parent directly observes: child is doing non-homework activities online but cannot track or block them
- Existing AI parental control extensions (e.g., aiparentalcontrol.com) focus on blocking inappropriate content, not distractions — they wouldn't block Roblox or YouTube gaming videos
- Existing tools (Qustodio, Bark, Norton Family) cost $50-100/year and use static category filters, not contextual AI
- The closest competitor explicitly does NOT log activity ("your browsing data is never stored") — the opposite of what this parent needs

## Proposed Solution

A 100% local Chrome extension that uses Claude Haiku AI to classify every web page as educational or not in real-time. Non-educational pages get a 5-second warning overlay then the tab is closed. All browsing activity is logged locally with a hidden, password-protected parent dashboard inside the extension. No server, no subscription, no account — just a Chrome extension inspired by Tab Out's local-only architecture. The AI approach means no blocklist to maintain and contextual understanding (YouTube math tutorial = allowed, YouTube gaming = blocked).

## Key Hypothesis

We believe AI-powered contextual content classification will keep an 11-year-old focused during homework better than static blocklists or category-based filters.
We'll know we're right when: homework completion time decreases, homework quality improves, and the parent dashboard shows 90%+ educational browsing during homework sessions.

## What We're NOT Building

- Network-level DNS filtering — Chrome extension only for v1
- Multi-browser support (Edge, Firefox) — Chrome only for v1
- Remote dashboard / phone access — local only, viewable on the same laptop
- Adult content filtering — existing tools handle this; we focus on distraction blocking
- Multiple child profiles — single-user for v1
- Allowlist/blocklist manual overrides — AI handles everything for v1

## Success Metrics

| Metric | Target | How Measured |
|--------|--------|--------------|
| Educational browsing % | 90%+ during homework | Dashboard activity logs |
| Homework completion time | Noticeable reduction (parent-observed) | Parent feedback |
| False positive rate | < 10% (legitimate research not blocked) | Dashboard blocked entries review |
| False negative rate | < 10% (distractions not caught) | Dashboard allowed entries review |
| AI classification latency | < 2 seconds per page | Measured in extension |

## Open Questions

- [ ] Will Claude Haiku API latency be fast enough that pages don't feel slow? (need to test)
- [ ] Does `anthropic-dangerous-direct-browser-access: true` header work reliably for sustained use?
- [ ] Will Shadow DOM overlay be robust enough that page scripts can't remove it?
- [ ] How does the extension behave when offline (no API access)?
- [ ] Will `chrome.storage.local` 5MB limit be sufficient with 30-day auto-cleanup?

---

## Users & Context

**Primary User**
- **Who**: Parent of an 11-year-old who uses the family laptop for homework
- **Current behavior**: Child opens Google Classroom, then drifts to gaming sites, YouTube entertainment, social media. Parent has no visibility and no automated enforcement.
- **Trigger**: Every homework session — child sits down at the laptop
- **Success state**: Parent can see browsing activity in the dashboard, distractions are automatically warned and closed, homework gets done faster with better quality

**Job to Be Done**
When my child sits down to do homework on the laptop, I want to automatically filter out distractions and see what he's browsing, so I can ensure homework gets done efficiently and with quality.

**Non-Users**
- Parents primarily concerned with blocking adult/explicit content (use AI Parental Control or Net Nanny instead)
- Teens who need social media for school projects
- Enterprise/school IT administrators (this is a personal/family tool)

---

## Solution Detail

### Core Capabilities (MoSCoW)

| Priority | Capability | Rationale |
|----------|------------|-----------|
| Must | AI content classification via Claude Haiku | Core differentiator — contextual understanding, not blocklists |
| Must | 5-second warning overlay then tab close | Gentle enforcement that teaches self-regulation |
| Must | Activity logging to chrome.storage.local | Parent needs full visibility into browsing behavior |
| Must | Hidden, password-protected parent dashboard | Parent needs to review activity; child shouldn't access it |
| Must | First-time setup (API key + parent password) | Secure configuration without hardcoding secrets |
| Must | Invisible to child (no toolbar icon, no visible UI) | Child shouldn't know it exists or try to tamper |
| Should | Summary stats (time online, % educational, blocked count) | Quick overview without reading every log entry |
| Should | Historical view (browse past days, up to 30 days) | Track improvement over time |
| Should | Auto-cleanup of logs older than 30 days | Stay within chrome.storage.local limits |
| Could | Chrome policy lock (tamper resistance via Group Policy) | Prevents child from disabling extension |
| Won't | Remote dashboard / phone access | Adds server complexity; can add in v2 |
| Won't | Multi-browser support | Chrome only for v1 |
| Won't | Manual allowlist/blocklist | AI handles everything; may add overrides in v2 |

### MVP Scope

The minimum to validate the hypothesis:
1. Content script that extracts page data on every navigation
2. Background service worker that calls Claude Haiku API for classification
3. Warning overlay (5 seconds) + tab close for blocked content
4. Activity logging to chrome.storage.local
5. Password-protected dashboard page with activity feed and basic stats
6. First-time setup page for API key and password

### User Flow

**Setup (one-time, parent):**
```
Install extension → Setup page opens → Enter Claude API key + parent password → Test API call → Done
```

**During homework (invisible to child):**
```
Child navigates to page → Content script extracts page data → Background worker calls Claude AI
  → Verdict "allow" → Nothing happens (invisible)
  → Verdict "block" → Warning overlay (5 sec) → Tab closes → Logged
```

**Parent review (on same laptop):**
```
Type extension URL in Chrome → Password login → See activity feed + stats → Browse history by date
```

---

## Technical Approach

**Feasibility**: HIGH

Tab Out proves the architecture: Chrome Manifest V3 + chrome.storage.local + chrome.tabs API + vanilla JS, no build step, no server. FocusGuard adds Claude API calls via fetch() from the service worker and a content script for page data extraction + overlay injection.

**Architecture Notes**
- Single Chrome extension, no external server or database
- Background service worker handles AI classification and tab management
- Content script injected into every page for data extraction and overlay
- All data stored in chrome.storage.local (keyed by date for easy retrieval)
- Claude Haiku API called directly from service worker with `anthropic-dangerous-direct-browser-access: true` header
- Dashboard is a hidden extension page (chrome-extension://[id]/dashboard.html), not a new tab override
- Shadow DOM used for warning overlay to prevent page CSS/JS interference

**Technical Risks**

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Claude API latency > 2s causes visible page delay | Medium | Page loads normally; overlay only appears after verdict returns. Child sees page briefly before block. |
| chrome.storage.local 5MB limit hit | Low | 30-day auto-cleanup. Each log entry is ~200 bytes; 5MB holds ~25,000 entries. |
| Child discovers extension in chrome://extensions | Medium | Install via Chrome Group Policy to hide and lock. Document in setup guide. |
| Page scripts detect and remove overlay | Low | Shadow DOM isolation. Overlay captures all events. |
| API key exposed in extension storage | Low | Acceptable risk for 11-year-old user. Key is in chrome.storage.local, not source code. |
| Offline: no API access, no classification | Low | Allow all pages when offline; log as "unclassified". Alert in dashboard. |

---

## Implementation Phases

| # | Phase | Description | Status | Parallel | Depends | PRP Plan |
|---|-------|-------------|--------|----------|---------|----------|
| 1 | Extension scaffold | Manifest, background worker, content script skeleton, project structure | in-progress | - | - | `.claude/PRPs/plans/focusguard-extension-scaffold.plan.md` |
| 2 | AI classification engine | Claude Haiku API integration, classification prompt, verdict handling | pending | - | 1 | - |
| 3 | Warning overlay + tab close | Content script overlay injection (Shadow DOM), 5-second countdown, tab removal | pending | with 2 | 1 | - |
| 4 | Activity logging | Log every page visit to chrome.storage.local, duration tracking, 30-day cleanup | pending | with 2 | 1 | - |
| 5 | Parent dashboard | Password-protected dashboard.html with activity feed, stats, historical view | pending | - | 2, 3, 4 | - |
| 6 | First-time setup | Setup page for API key + password entry, API validation, onboarding flow | pending | with 5 | 1 | - |
| 7 | Stealth & tamper resistance | Hide toolbar icon, Chrome policy lock documentation, security hardening | pending | - | 5, 6 | - |

### Phase Details

**Phase 1: Extension Scaffold**
- **Goal**: Working Chrome extension skeleton that can be loaded in developer mode
- **Scope**: manifest.json, empty background.js, content.js injected on all pages, dashboard.html, setup.html, file structure
- **Success signal**: Extension loads in Chrome without errors, content script runs on page navigation

**Phase 2: AI Classification Engine**
- **Goal**: Background worker can classify any page as "allow" or "block" using Claude Haiku
- **Scope**: API key retrieval from storage, fetch() to Claude API, system prompt, response parsing, verdict caching for repeated URLs
- **Success signal**: Console logs show correct verdicts for test URLs (Google Classroom = allow, Roblox = block, educational YouTube = allow, gaming YouTube = block)

**Phase 3: Warning Overlay + Tab Close**
- **Goal**: Blocked pages get a visible warning, then the tab closes
- **Scope**: Shadow DOM overlay injection, "This doesn't look like homework" message, 5-second countdown, tab close via message to background worker
- **Success signal**: Navigating to a gaming site shows overlay for 5 seconds, then tab closes

**Phase 4: Activity Logging**
- **Goal**: Every page visit is recorded with full metadata
- **Scope**: Log entry creation (URL, title, verdict, reason, confidence, timestamp), duration tracking via tab focus events, storage keyed by date, 30-day auto-cleanup
- **Success signal**: After browsing several sites, chrome.storage.local contains accurate log entries with correct durations

**Phase 5: Parent Dashboard**
- **Goal**: Parent can review all browsing activity in a clean UI
- **Scope**: Password login, activity feed with verdict badges, summary stats (time online, % educational, blocked count, top domains), date picker for history
- **Success signal**: Dashboard shows all logged activity with correct stats, password protection works

**Phase 6: First-Time Setup**
- **Goal**: Parent can configure the extension without touching code
- **Scope**: Setup page auto-opens on first install, API key input + validation test call, parent password creation, confirmation screen
- **Success signal**: Fresh install → setup page → enter key + password → extension activates

**Phase 7: Stealth & Tamper Resistance**
- **Goal**: Child cannot see, access, or disable the extension
- **Scope**: Remove toolbar icon visibility, document Chrome Group Policy installation, password lockout after 3 failed attempts, dashboard access only via direct URL
- **Success signal**: Extension is not visible in normal Chrome usage; chrome://extensions shows it as force-installed (when using policy)

### Parallelism Notes

Phases 2, 3, and 4 can run in parallel after Phase 1 — they touch different concerns (API calls vs. UI overlay vs. storage). Phase 2 produces the verdict that Phase 3 consumes, but Phase 3 can be built with mock verdicts initially. Phases 5 and 6 can run in parallel as they're independent UI pages. Phase 7 depends on everything being functional.

---

## Decisions Log

| Decision | Choice | Alternatives | Rationale |
|----------|--------|--------------|-----------|
| Architecture | 100% local Chrome extension | Server + remote dashboard, DNS proxy | Simplest to build and maintain; Tab Out proves the pattern works; user accepted dashboard-only-on-laptop tradeoff |
| AI provider | Claude Haiku (Anthropic) | OpenAI GPT, local model | Fast, cheap (~$0.001/call), user already has Anthropic context |
| API key storage | chrome.storage.local (entered during setup) | Hardcoded in source, environment variable, server proxy | No secrets in code; acceptable risk for 11-year-old; no server needed |
| Enforcement style | 5-second warning then close tab | Hard block (immediate close), redirect to Classroom, just log | Warning teaches self-regulation; user explicitly chose this |
| Monitoring mode | Always on | Manual toggle, scheduled, triggered by Classroom | Simplest; no session management logic needed; user explicitly chose this |
| Filtering strictness | Moderate | Strict (only homework), lenient (only block social/games) | Block obvious distractions, allow general knowledge browsing; user explicitly chose this |
| Dashboard access | Local only (same laptop) | Remote web app, email reports, phone app | Eliminates server entirely; user accepted this tradeoff |
| Data storage | chrome.storage.local with 30-day cleanup | IndexedDB, server database, file export | Simplest; 5MB is plenty with cleanup; no external dependencies |

---

## Research Summary

**Market Context**
- AI Parental Control (aiparentalcontrol.com) is the closest competitor: Chrome extension using ChatGPT for content filtering. But it focuses on blocking unsafe/inappropriate content, not homework distractions. No activity logging. No dashboard. Free tier limited to 25 pages/day; $1.99/mo for unlimited.
- AIWebFilter is another AI-powered Chrome extension with similar safety focus.
- Major players (Qustodio, Bark, Norton Family, Net Nanny) cost $50-100/year, use static category filters, require accounts and subscriptions. Some offer "homework mode" schedules but still rely on category-based blocking, not contextual AI.
- No existing product combines: AI contextual classification + distraction focus (not safety) + activity logging + parent dashboard + free/local + no account.

**Technical Context**
- Tab Out (github.com/zarazhangrui/tab-out) proves the 100% local Chrome extension architecture: Manifest V3, chrome.storage.local, chrome.tabs API, vanilla JS, no build step, no server. FocusGuard follows the same pattern with added AI classification and content script.
- Claude Haiku API supports direct browser access via special header. Latency is typically < 1 second.
- Chrome Manifest V3 content scripts can inject Shadow DOM overlays that are isolated from page CSS/JS.
- chrome.storage.local provides ~5MB of persistent storage — sufficient for months of activity logs with cleanup.

---

*Generated: 2026-04-15*
*Status: DRAFT - needs validation*
