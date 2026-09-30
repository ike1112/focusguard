// benchmark/scrape.js
// Visits each benchmark URL with a real browser, extracts title + visible text
// exactly as the FocusGuard extension does, saves to dataset.json.
//
// Run: node benchmark/scrape.js   (from repo root)
//   OR: npm run scrape             (from benchmark/)
//
// Output: benchmark/dataset.json — commit this file so the benchmark is
// reproducible without re-scraping.

import puppeteer from 'puppeteer';
import { writeFileSync, existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, 'dataset.json');

// Ground-truth labels (human-verified allow/block).
// Add or remove URLs here, then re-run scrape.js.
const URLS = [
  // Clear allows — educational
  { id:1,  url:'https://en.wikipedia.org/wiki/Photosynthesis',            gt:'allow' },
  { id:2,  url:'https://www.khanacademy.org/science/ap-biology',          gt:'allow' },
  { id:3,  url:'https://stackoverflow.com/questions/11227809',            gt:'allow' },
  { id:4,  url:'https://www.wolframalpha.com/input?i=integrate+x%5E2',   gt:'allow' },
  { id:5,  url:'https://www.desmos.com/calculator',                       gt:'allow' },
  { id:6,  url:'https://quizlet.com/set/123456789',                       gt:'allow' },
  { id:7,  url:'https://www.merriam-webster.com/dictionary/ephemeral',    gt:'allow' },
  { id:8,  url:'https://www.gutenberg.org/files/1342/1342-h/1342-h.htm',  gt:'allow' },
  { id:9,  url:'https://www.gutenberg.org/ebooks/84',                     gt:'allow' },
  { id:10, url:'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Functions', gt:'allow' },

  // Ambiguous — verdict depends on what the page actually shows
  { id:11, url:'https://www.youtube.com/watch?v=NybHckSEQBI',            gt:'allow' }, // history video
  { id:12, url:'https://www.reddit.com/r/learnprogramming/',              gt:'allow' },
  { id:13, url:'https://www.youtube.com/watch?v=dQw4w9WgXcQ',            gt:'block' }, // rickroll
  { id:14, url:'https://www.reddit.com/r/gaming/',                        gt:'block' },
  { id:15, url:'https://www.youtube.com/',                                gt:'allow' }, // homepage edge case

  // Clear blocks — off-task
  { id:16, url:'https://www.roblox.com/',                                 gt:'block' },
  { id:17, url:'https://www.tiktok.com/',                                 gt:'block' },
  { id:18, url:'https://www.twitch.tv/',                                  gt:'block' },
  { id:19, url:'https://store.steampowered.com/',                         gt:'block' },
  { id:20, url:'https://www.instagram.com/',                              gt:'block' },

  // Edge cases
  { id:21, url:'https://news.ycombinator.com/',                           gt:'allow' },
  { id:22, url:'https://www.google.com/search?q=photosynthesis',          gt:'allow' },
  { id:23, url:'https://www.amazon.com/s?k=gaming+headset',              gt:'block' },
  { id:24, url:'https://claude.ai/',                                      gt:'allow' },
  { id:25, url:'https://www.merriam-webster.com/',                        gt:'allow' },
];

const TIMEOUT_MS = 20_000;
const DELAY_MS   = 800;   // polite pause between requests

async function extractText(page) {
  return page.evaluate(() => {
    // Mirror what background.js sends to the classifier:
    // innerText of body, whitespace collapsed, first 2000 chars.
    return (document.body?.innerText || '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 2000);
  });
}

async function main() {
  // If dataset.json already exists, load it so we can skip already-scraped URLs
  // (useful when re-running after a partial scrape or to add new URLs).
  let existing = {};
  if (existsSync(OUT)) {
    try {
      const prev = JSON.parse(readFileSync(OUT, 'utf8'));
      prev.forEach(r => { if (r.scraped) existing[r.id] = r; });
      console.log(`Loaded ${Object.keys(existing).length} cached entries from dataset.json`);
    } catch { /* ignore corrupt file */ }
  }

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const results = [];
  let scraped = 0, cached = 0, failed = 0;

  for (const item of URLS) {
    if (existing[item.id]) {
      results.push(existing[item.id]);
      process.stdout.write(`  [cached] ${item.id.toString().padStart(2)} ${item.url.slice(0, 60)}\n`);
      cached++;
      continue;
    }

    let page;
    try {
      page = await browser.newPage();
      await page.setDefaultNavigationTimeout(TIMEOUT_MS);

      // Mimic a real browser to avoid bot-detection blocks
      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
      );
      // Block images/fonts/media — faster load, same text content
      await page.setRequestInterception(true);
      page.on('request', req => {
        if (['image','font','media','stylesheet'].includes(req.resourceType())) req.abort();
        else req.continue();
      });

      await page.goto(item.url, { waitUntil: 'domcontentloaded', timeout: TIMEOUT_MS });

      const title   = await page.title();
      const excerpt = await extractText(page);

      results.push({ ...item, title, excerpt, scraped: true, scrapedAt: new Date().toISOString() });
      process.stdout.write(`  [ok]     ${item.id.toString().padStart(2)} ${title.slice(0, 55)}\n`);
      scraped++;
    } catch (e) {
      const msg = e.message.split('\n')[0].slice(0, 80);
      process.stdout.write(`  [fail]   ${item.id.toString().padStart(2)} ${msg}\n`);
      results.push({ ...item, title: '', excerpt: '', scraped: false, scrapeError: msg });
      failed++;
    } finally {
      if (page) await page.close();
    }

    await new Promise(r => setTimeout(r, DELAY_MS));
  }

  await browser.close();

  // Sort by id so the file is stable across runs
  results.sort((a, b) => a.id - b.id);
  writeFileSync(OUT, JSON.stringify(results, null, 2));

  console.log(`\nDone: ${scraped} scraped, ${cached} cached, ${failed} failed`);
  console.log(`Saved → benchmark/dataset.json`);
  if (failed > 0) {
    console.log(`Re-run scrape.js to retry failed URLs (cached ones are skipped).`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
