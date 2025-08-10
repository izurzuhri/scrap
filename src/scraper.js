const { chromium } = require("playwright");
const pLimit = require("p-limit");
const { sleep, cleanText, dashIfEmpty } = require("./utils");
const { makeLLMFromEnv } = require("./llm");

const DEFAULT_TIMEOUT = Number(process.env.PAGE_TIMEOUT_MS || 30000);
const HARD_MAX_PAGES   = Number(process.env.HARD_MAX_PAGES || 50);
const MAX_CONCURRENCY  = Number(process.env.MAX_CONCURRENCY || 3);

function buildSearchUrl(query, pageNum = 1) {
  const params = new URLSearchParams({
    _from: "R40",
    _nkw: query,
    _sacat: "0",
    rt: "nc",
    _pgn: String(pageNum)
  });
  return `https://www.ebay.com/sch/i.html?${params.toString()}`;
}

async function extractCardsFromSearch(page) {
  // Target li.s-item cards
  await page.waitForLoadState("networkidle", { timeout: DEFAULT_TIMEOUT }).catch(()=>{});
  const items = await page.$$eval("li.s-item", cards => {
    return cards.map((el, idx) => {
      const a = el.querySelector("a.s-item__link") || el.querySelector("a[href]");
      const titleEl = el.querySelector(".s-item__title") || el.querySelector("[data-testid='item-title']");
      const priceEl = el.querySelector(".s-item__price") || el.querySelector("[data-testid='item-price']");
      const href = a?.getAttribute("href") || "";
      const title = titleEl?.textContent || "";
      const price = priceEl?.textContent || "";
      return { href, title, price, position: idx + 1 };
    });
  });
  // Filter link sanity
  return items.filter(x => x.href && x.href.startsWith("http"));
}

async function hasNextPage(page) {
  // Detect next page
  const nextLink = await page.$("a[aria-label*='Next'], a[aria-label*='next'], a.pagination__next, a[rel='next']");
  return !!nextLink;
}

async function extractDescriptionFromDetail(ctxPage, llm) {
  // Try common selectors
  const selectors = [
    "#viTabs_0_is",
    "#vi-desc-maincntr",
    "section[itemprop='description']",
    "[data-testid='x-item-description']",
    "div.d-item-desc",
    "div#desc_div",
    "div[itemprop='description']",
    "div#viTabs_0_pd"
  ];

  for (const sel of selectors) {
    try {
      const loc = ctxPage.locator(sel);
      if (await loc.count() > 0) {
        const txt = cleanText(await loc.innerText({ timeout: 3000 }).catch(()=> "" ));
        if (txt && txt.length > 20) return txt;
      }
    } catch {}
  }

  try {
    const meta = await ctxPage.locator("meta[name='description'], meta[property='og:description']").first();
    if (await meta.count()) {
      const content = cleanText(await meta.getAttribute("content"));
      if (content) return content;
    }
  } catch {}

  if (llm?.enabled) {
    try {
      const candidate = await ctxPage.evaluate(() => {
        const pick = (sel) => {
          const el = document.querySelector(sel);
          return el ? el.innerText : "";
        };
        const parts = [];
        parts.push(pick("[data-testid='x-about-this-item']"));
        parts.push(pick("[data-testid='x-item-description']"));
        parts.push(pick("#viTabs_0_is"));
        parts.push(pick("section[itemprop='description']"));
        const joined = parts.filter(Boolean).join("\n\n");
        return joined || document.body.innerText || "";
      });
      const ai = await llm.extractDescription(candidate);
      return cleanText(ai || "-");
    } catch (e) {
      console.warn("[AI] extractDescription error:", e.message);
    }
  }

  return "-";
}

async function scrapeEbay({ query, maxPages, useAI = true, headless = true }) {
  const llm = useAI ? makeLLMFromEnv() : { enabled: false };
  const browser = await chromium.launch({ headless });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    viewport: { width: 1366, height: 768 }
  });

  const page = await context.newPage();
  let pageNum = 1;
  let totalCollected = 0;
  const all = [];
  const limit = pLimit(MAX_CONCURRENCY);

  try {
    while (true) {
      if (maxPages && pageNum > maxPages) break;
      if (pageNum > HARD_MAX_PAGES) break;

      const url = buildSearchUrl(query, pageNum);
      await page.goto(url, { timeout: DEFAULT_TIMEOUT, waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle", { timeout: DEFAULT_TIMEOUT }).catch(()=>{});

      const cards = await extractCardsFromSearch(page);
      if (!cards.length) {
        break;
      }

      const enriched = await Promise.all(
        cards.map(card => limit(async () => {
          const item = {
            page: pageNum,
            position: card.position,
            url: card.href,
            title: dashIfEmpty(card.title),
            price: dashIfEmpty(card.price),
            description: "-"
          };
          try {
            const p = await context.newPage();
            await p.goto(card.href, { timeout: DEFAULT_TIMEOUT, waitUntil: "domcontentloaded" });
            await p.waitForLoadState("networkidle", { timeout: DEFAULT_TIMEOUT }).catch(()=>{});
            await sleep(400 + Math.floor(Math.random() * 300));
            const desc = await extractDescriptionFromDetail(p, llm);
            item.description = dashIfEmpty(desc);
            await p.close();
          } catch (e) {
            console.warn(`[Detail] ${card.href} -> ${e.message}`);
          }
          return item;
        }))
      );

      all.push(...enriched);
      totalCollected += enriched.length;

      const next = await hasNextPage(page);
      if (!next) break;
      pageNum += 1;

      await sleep(800 + Math.floor(Math.random() * 400));
    }
  } finally {
    await context.close();
    await browser.close();
  }

  return {
    query,
    total: totalCollected,
    items: all
  };
}

module.exports = { scrapeEbay };
