# TypeSafe AI / Jev — fit analysis for FocusGuard

## What Jev is

Jev (by TypeSafe AI) is a "System One" classification API. Instead of asking a
model to return JSON you parse, you define structured questions with typed
primitives — `Choice`, `Noul` (nullable), `Score` — and the API evaluates all
of them in parallel, returning typed values plus probability distributions.
No JSON parsing, no code fences to strip, no try/catch around `JSON.parse`.

```js
// Sketch — not wired into FocusGuard today
import jev from 'typesafe-ai';

const { verdict, reason } = await jev({
  verdict: Choice(['allow', 'block']),
  reason:  Noul(String),
}, prompt);
// verdict is 'allow' | 'block' — no parsing needed
```

## What FocusGuard currently does instead

`classifier.js` calls Claude Haiku with a system prompt that demands minified
JSON (`{"verdict":"allow","reason":"...","confidence":0.9}`), then runs
`parseVerdict()` — 15 lines of defensive code:

- strip accidental code fences
- `JSON.parse()` inside a try/catch
- validate `.verdict`, `.reason`, `.confidence` types
- clamp confidence to `[0, 1]`
- return `null` on failure so the caller can fail-open

This is the exact problem Jev is designed to eliminate.

## Where Jev adds value

| Situation | FocusGuard today | With Jev |
|---|---|---|
| Unambiguous pages (Roblox, Khan Academy, Google Docs) | Haiku classifies correctly, parses fine | Jev would be faster and cheaper for clear-cut cases |
| Ambiguous pages (YouTube watch page, Reddit topic thread) | Haiku uses the **page body excerpt** to decide — the strongest signal | Jev has no access to page content; it classifies by URL/title only |
| parseVerdict failure | Falls through to fail-open (allow) | No parsing step; failure path is shorter |
| Cold service-worker restart | Entire verdict cache was lost (now fixed with storage persistence) | Same problem — Jev also has no built-in caching |

## The core tradeoff

FocusGuard's hardest classification problems are **ambiguous URLs where the
page body is the deciding signal**: a YouTube `/watch` URL whose title is
"Math tutorial" vs "minecraft lets play", a Reddit thread that could be
homework research or a gaming discussion. The system prompt explicitly says:
"The excerpt is the strongest signal when URL/title are ambiguous."

Jev currently evaluates questions against the input you send it — which is
your prompt text. Sending the body excerpt is possible, but then you are
back to doing prompt construction yourself, and the value proposition
(structured output without parsing) is the only gain over direct Haiku calls.

## Recommendation

**Don't swap in Jev as a full replacement.** The cost is a new vendor and an
unknown pricing model for a gain that is primarily "remove 15 lines of
parseVerdict code." That trade is not worth the dependency unless the parsing
is actually a pain point in practice.

**Consider a hybrid if the parseVerdict failure rate becomes observable:**
use Jev for high-confidence URL-only cases (known block domains like
`roblox.com`, `tiktok.com`; known allow domains like `khanacademy.org`,
`classroom.google.com`) where the title alone is enough, and route ambiguous
URLs to Haiku with the body excerpt. This adds complexity — two vendor SDKs,
a routing step — and should only happen if data shows the Haiku path is
failing often enough to justify it.

**Before considering Jev, check:**
1. Jev pricing — not published on the docs page as of this analysis
2. Whether Jev runs from a Chrome extension service worker (same
   `anthropic-dangerous-direct-browser-access` story, or does it require a
   backend?)
3. Whether it supports confidence scores natively (FocusGuard logs confidence
   per visit; Jev's `Score` primitive may or may not map to this)

## What this analysis did NOT assess

- Latency comparison (Jev may be faster or slower than Haiku for short prompts)
- Token cost comparison (Jev pricing unknown)
- Whether Jev's structured primitives support the `reason` field
  (the parent reads reasons in the dashboard — losing them would be a
  regression)
