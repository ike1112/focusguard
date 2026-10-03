// benchmark/scrape.js
// Visits each benchmark URL with a real browser, extracts title + visible text
// for the benchmark, saves to dataset.json. Capture quality needs review.
//
// Run: node benchmark/scrape.js   (from repo root)
//   OR: npm run scrape             (from benchmark/)
//
// Output: benchmark/dataset.json — commit this file so the benchmark is
// reproducible without re-scraping.

import puppeteer from 'puppeteer';
import { URLS, FIXTURE_VERSION, canReuseCapture } from './urls.js';
import { writeFileSync, existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, 'dataset.json');

// URL selection and policy rationales live in urls.js.
// Research provenance and capture limitations are documented in urls.md.

const TIMEOUT_MS = 20_000;
const DELAY_MS   = 800;   // polite pause between requests

async function extractPageData(page) {
  return page.evaluate(() => {
    const clean = (value, limit) => String(value || '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, limit);

    const meta = [...document.querySelectorAll('meta[name], meta[property]')]
      .map((node) => ({
        name: node.getAttribute('name') || node.getAttribute('property') || '',
        content: clean(node.getAttribute('content'), 300),
      }))
      .filter((item) => /description|title|keywords|og:|twitter:/i.test(item.name) && item.content)
      .slice(0, 12);

    const headings = [...document.querySelectorAll('h1,h2,h3')]
      .map((node) => clean(node.innerText || node.textContent, 160))
      .filter(Boolean)
      .slice(0, 20);

    const links = [...document.querySelectorAll('a')]
      .map((node) => clean(node.innerText || node.textContent || node.getAttribute('aria-label'), 120))
      .filter(Boolean)
      .slice(0, 40);

    return {
      excerpt: clean(document.body?.innerText, 2000),
      meta,
      headings,
      links,
    };
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

  // Use system Chrome on Windows — avoids bundled Chromium launch failures
  const CHROME_PATHS = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    process.env.CHROME_PATH,
  ].filter(Boolean);

  const executablePath = CHROME_PATHS.find(existsSync);
  if (!executablePath) {
    throw new Error(
      'Chrome not found. Install Chrome or set CHROME_PATH in .env.\n' +
      'Checked: ' + CHROME_PATHS.join(', ')
    );
  }
  console.log('[scrape] Using Chrome at:', executablePath);

  const browser = await puppeteer.launch({
    headless: true,
    executablePath,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const results = [];
  let scraped = 0, cached = 0, failed = 0;

  for (const item of URLS) {
    if (canReuseCapture(existing[item.id], item)) {
      results.push({ ...existing[item.id], ...item });
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
        if (['image','font','media'].includes(req.resourceType())) req.abort();
        else req.continue();
      });

      await page.goto(item.url, { waitUntil: 'domcontentloaded', timeout: TIMEOUT_MS });
      await page.waitForFunction(() => document.readyState === 'complete', { timeout: 5000 }).catch(() => {});
      await new Promise(r => setTimeout(r, 1500));

      const title   = await page.title();
      const pageData = await extractPageData(page);

      results.push({ ...item, title, ...pageData, scraped: true, fixtureVersion: FIXTURE_VERSION, scrapedAt: new Date().toISOString() });
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
