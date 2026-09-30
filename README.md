# FocusGuard

**A quiet AI-powered helper that keeps kids focused on homework.**

When your child opens a website, FocusGuard reads the page and decides if it's schoolwork or a distraction. Homework stuff (Google Classroom, Wikipedia, Khan Academy, a math site…) passes through like normal — your child won't even know FocusGuard is there. But if they open Roblox, a gaming YouTube video, TikTok, or something else off-task, a full-screen message appears saying **"This doesn't look like homework,"** a 5-second timer counts down, and the tab closes by itself.

You install it once on your child's computer, take two minutes to set it up, and from then on it runs in the background. No icons, no popups, no buttons — nothing for your child to see or turn off.

- 🔒 **Private by design.** Your child's activity log, API key, and password stay on your computer. The only data that leaves is a short page excerpt sent to the AI to classify each site — nothing is stored by FocusGuard or any company server.
- 👨‍👩‍👧 **Only you can see the activity.** A hidden password-protected page shows every site your child has opened today and for the past 30 days.
- 🌱 **Gentle, not scary.** No alarms or lectures — just a calm "please get back to homework" screen.
- 💰 **Almost free.** FocusGuard itself costs nothing. The AI that checks the pages usually costs a few cents a month.

> **Developers:** see [README-developers.md](README-developers.md) for architecture, security model, file layout, and API details.
>
> **Tech:** Chrome Extension (Manifest V3) · Claude Haiku API · Vanilla JS · No backend · `chrome.storage.local`

---

## Table of contents

1. [What you need before you start](#what-you-need-before-you-start)
2. [Installing FocusGuard](#installing-focusguard)
3. [First-time setup](#first-time-setup)
4. [What your child sees (and doesn't see)](#what-your-child-sees-and-doesnt-see)
5. [Checking what your child has been doing](#checking-what-your-child-has-been-doing)
6. [What it costs](#what-it-costs)
7. [Your privacy](#your-privacy)
8. [Common questions](#common-questions)
9. [Uninstalling](#uninstalling)

---

## What you need before you start

### 1. A computer with Google Chrome

FocusGuard only works inside the Chrome browser. If Chrome isn't on your child's computer yet, get it free from [google.com/chrome](https://www.google.com/chrome/).

> Other Chromium-based browsers (like Microsoft Edge or Brave) will probably work too, but haven't been tested.

### 2. An "API key" from Anthropic

An API key is just a secret code that lets your computer ask the AI whether a web page is schoolwork or not. Think of it like a prepaid phone card — you load a few dollars onto it, and each time your computer asks a question, it uses up a tiny, tiny amount. A normal month of homework browsing costs anywhere from a few cents to about a dollar.

Here's how to get one:

1. Go to **[console.anthropic.com](https://console.anthropic.com/)** and sign up with an email. It's the company that makes the AI.
2. After signing in, look for a section called **"Billing"** or **"Plans & billing"** and add a small amount of money. Even **$5 usually lasts many months.** (You can also set a spending limit so you're never surprised by a charge.)
3. Now look for a section called **"API keys"** and click a button like **"Create Key."** Give it any name you want (like "FocusGuard").
4. A long code will appear that starts with `sk-ant-` followed by lots of letters and numbers. **Copy it** and keep it somewhere safe for the next step.

> ⚠️ Treat this code like a password. Don't share it or paste it into random websites — anyone who has it could use up your balance.

---

## Installing FocusGuard

1. **Download this project.** On the project's GitHub page, click the green **"Code"** button, then **"Download ZIP."** Save it somewhere you can find it (like your Desktop).
2. **Unzip it.** Right-click the ZIP file and choose "Extract All" (Windows) or double-click it (Mac). You'll get a folder named something like `FocusGuard-main`. Inside that folder, there's another folder called `focusguard` — this is the one we'll use.
3. **Open Chrome's extension page.** In Chrome's address bar at the top, type: `chrome://extensions` and press Enter.
4. **Turn on Developer mode.** In the top-right corner of that page, flip the switch labeled **"Developer mode."**
5. **Click "Load unpacked."** A new button appears at the top-left. Click it.
6. **Choose the `focusguard` folder.** A file picker opens — navigate to where you unzipped the download and pick the **inner `focusguard` folder** (the one with files like `manifest.json` inside). Click "Select folder."

That's it — Chrome installs it right away. A new tab opens automatically with the setup page.

---

## First-time setup

The setup page is where you plug in your API key and pick a parent password.

1. **Paste your API key** (the `sk-ant-...` code you copied earlier) into the first box.
2. **Pick a parent password.** This is what you'll type later to see the activity dashboard.
   - Use at least 6 characters.
   - Pick something your child can't easily guess (not "password," not a pet's name, not a birthday).
   - **Write it down somewhere safe.** There is no "Forgot password" button — if you lose it, the only way to reset is to reinstall FocusGuard (which erases the activity history).
3. **Type the same password again** in the confirmation box.
4. Click **"Save and activate."**

FocusGuard will quickly check that your API key works (this takes a second or two). When you see **"Setup complete,"** you're done. You can close the tab.

From this moment on, FocusGuard is watching every page.

---

## What your child sees (and doesn't see)

### What they see

- **On homework pages** (Google Classroom, Wikipedia, Khan Academy, math/science sites, educational YouTube videos, reference sites): nothing. The page loads normally. No message, no delay, no change.
- **On distraction pages** (Roblox, gaming videos, TikTok, Instagram, shopping, memes, etc.): the whole browser window goes dark with this message:

  > **This doesn't look like homework.**
  >
  > Reason: *(a short explanation from the AI)*
  >
  > **Closing tab in 5**

  The number counts down — 5, 4, 3, 2, 1 — and then the tab closes automatically. The overlay cannot be clicked through or dismissed.

### What they don't see

- **No icon** in Chrome's toolbar.
- **No popup** or menu.
- **No setting** inside Chrome that mentions FocusGuard.
- **No notification** when something gets blocked besides the 5-second message itself.

FocusGuard is intentionally invisible so it feels less like being watched and more like the computer "just works that way."

> If your child is tech-savvy enough to explore `chrome://extensions`, they will see FocusGuard listed there and could turn it off. FocusGuard isn't a hard lock — it's a gentle guide. For stricter control, combine it with your operating system's built-in parental controls.

---

## Checking what your child has been doing

The parent dashboard is a hidden page inside the extension. Only you know how to open it.

### Opening the dashboard

1. In Chrome's address bar, type: `chrome://extensions` and press Enter.
2. Find **FocusGuard** in the list of extensions.
3. Just under the name, you'll see an **ID** — a long string of letters that looks like `abcdefghijklmnopqrstuvwxyz123456`. Copy this ID.
4. In the address bar, type:

   ```
   chrome-extension://<paste-the-id-here>/dashboard.html
   ```

   For example: `chrome-extension://abcdefghijklmnopqrstuvwxyz123456/dashboard.html`

5. Press Enter. You'll see the password screen.

### 💡 Make it easier for yourself

**Bookmark the dashboard page** so you don't have to look up the ID each time. But give the bookmark a boring name — like "Work notes" or "Recipes" — so your child doesn't get curious about it.

### What's on the dashboard

After you type your parent password, you'll see:

- **Today's activity** at the top in big numbers:
  - *Time online* — how long your child's been actively using the browser.
  - *Educational* — what percentage of that time was on allowed sites.
  - *Blocked* — how many distractions FocusGuard stopped today.
  - *Top domains* — your child's five most-used sites.

- **A full list** of every site they've opened today, newest first. Each entry shows:
  - The time they opened it.
  - A green "allow" tag or a red "block" tag.
  - The page title and website name.
  - How long they spent on it.
  - The AI's short reason (like "educational research" or "entertainment video").

- **A date picker** to scroll back through the last 30 days.

- A **Log out** button — tap it when you're done so the info isn't sitting on screen.

> **Tip:** If you type the wrong password 3 times in a row, the dashboard locks for 1 minute. This is to slow down guessing.

---

## What it costs

**FocusGuard itself is free.** There's no subscription, no in-app purchase, no account.

**The only cost is the AI.** Each time your child opens a web page, FocusGuard sends one short question to the Claude AI ("is this page educational or a distraction?"). Each question costs a tiny fraction of a cent.

In practice, most families spend **under $1 per month.** Heavy users might see a few dollars.

You can:

- **Check your balance** anytime at [console.anthropic.com](https://console.anthropic.com/).
- **Set a monthly spending limit** on the Anthropic billing page so you're never charged above a certain amount.
- **Top up whenever you want** — if your balance runs out, FocusGuard simply stops blocking and lets everything through (it fails safely; the browser keeps working).

---

## Your privacy

FocusGuard is built around one principle: **your child's browsing stays on your computer.**

### What stays on the computer

- Every website your child visits (URL and page title).
- How long they spent on each one.
- Your API key.
- Your parent password (stored as a scrambled, unreadable version — not the password itself).

None of this is ever sent to FocusGuard, to me, or to anyone else. There's no company server. There's no account. No one can see it except you, and only through the password-protected dashboard on your own computer.

### What's sent to Anthropic (the AI company)

For each page your child opens, FocusGuard sends the AI three things:

- The **web address** of the page (e.g. `https://en.wikipedia.org/wiki/Photosynthesis`).
- The **page title** (e.g. "Photosynthesis - Wikipedia").
- A **short excerpt of the page's visible text** — up to 2,000 characters of what your child can actually read on screen (this is how FocusGuard can tell the difference between an educational YouTube video and a gaming one, where the URL alone wouldn't help).

That's it. No cookies, no form fields, no full page contents, no browsing history. Anthropic is the company that answers the question; their privacy policy is at [anthropic.com](https://www.anthropic.com/legal/privacy).

### What about Chrome's history?

FocusGuard does **not** read Chrome's built-in history database. It keeps its own separate log of only the pages that happened while it was installed.

### Uninstalling wipes everything

If you uninstall FocusGuard, everything it stored — API key, password, and all the activity history — is deleted from the computer immediately.

---

## Common questions

### Is FocusGuard always on?

**Yes.** Once it's set up, it runs automatically whenever Chrome is open. You don't have to turn it on, leave a tab open, or do anything to keep it running. It works after restarts, too.

### Do I need to keep the DevTools window open?

**No.** Just install it once and leave it alone. You don't need to open any developer tools.

### Does it work on Incognito mode?

By default, Chrome extensions don't run in Incognito windows — meaning a tech-savvy child could open Incognito and browse freely. To fix this:

1. Go to `chrome://extensions`.
2. Click **"Details"** under FocusGuard.
3. Turn on **"Allow in Incognito."**

Or, if you'd prefer, you can disable Incognito mode entirely in Chrome's settings.

### What happens if Chrome is closed and reopened?

Everything keeps working. Your API key, password, and history all stick around. The dashboard will show the same info as before. Pages that were blocked yesterday will still be blocked today.

### Can I use FocusGuard on more than one computer?

Yes — install it on each computer separately, each with its own copy of the API key. The activity log on each computer is separate (it's not synced across devices).

### What if my child has more than one Chrome profile?

Chrome keeps each profile's extensions completely separate — so FocusGuard only runs in the profile you installed it in. If your child switches to another Chrome profile (the little circle icon in the top-right of Chrome), FocusGuard isn't there and won't block anything.

To cover this, you have two choices:

- **Install FocusGuard in every profile** your child uses. Repeat the steps under [Installing FocusGuard](#installing-focusguard) from within each profile. Each one needs its own API key entry and parent password.
- **Or, stop your child from making new profiles.** In Chrome's settings, under *You and Google → Profiles*, you can turn off profile creation. Combine with your operating system's parental controls for the strongest lock.

### Does the AI ever get it wrong?

Sometimes. The AI is trained to lean toward "allow" when it's unsure, so it's more likely to let a borderline page through than to block a real homework page. If something important keeps getting blocked, check the dashboard to see the AI's reason — it can help you understand what happened.

### What if the AI can't be reached (no internet, outage, etc.)?

FocusGuard **lets the page through** in that case. This is on purpose — we never want a bug or a network hiccup to break your child's browser. The worst case is "FocusGuard stopped blocking for a while," not "the browser stopped working."

### Can my child bypass it?

FocusGuard is a **gentle** tool, not a hard lock. A determined child who knows about `chrome://extensions` can turn it off there. For that reason, it works best when combined with:

- **Honest conversations** about focus and homework — some families find that just telling the child "this closes distracting tabs while you're working" actually works fine.
- **Your operating system's parental controls** (built into Windows and macOS) for stricter limits that kids can't disable in the browser.

### I forgot my password.

There's no way to recover it — but you can reset it. Uninstall FocusGuard (see below), then install it again and pick a new password. You'll lose the past activity history when you do this.

### I want to change my API key or password.

Open the dashboard, log in, and scroll down to the **Settings** panel at the bottom of the page. You can update your API key (it gets validated against Anthropic before saving) or change your password (requires your current password). No need to go back to the setup page.

---

## Uninstalling

1. In Chrome's address bar, type `chrome://extensions` and press Enter.
2. Find **FocusGuard** in the list.
3. Click **"Remove."**
4. Confirm.

Everything — your API key, parent password, and all activity history — is deleted from the computer right away. Nothing is left behind.

---

Questions, problems, or ideas? Open an issue on this project's GitHub page.
