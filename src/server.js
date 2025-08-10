require("dotenv").config();
const express = require("express");
const { scrapeEbay } = require("./scraper");

const app = express();

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Example: GET /scrape?query=nike&max_pages=3&use_ai=true&headless=true
app.get("/scrape", async (req, res) => {
  const query = (req.query.query || req.query.q || "").toString().trim();
  if (!query) {
    return res.status(400).json({ error: "Missing ?query= keyword" });
  }

  const maxPages = req.query.max_pages ? parseInt(req.query.max_pages) : undefined;
  const useAI = req.query.use_ai
    ? ["1","true","yes"].includes(String(req.query.use_ai).toLowerCase())
    : true;
  const headless = req.query.headless
    ? ["1","true","yes"].includes(String(req.query.headless).toLowerCase())
    : (String(process.env.HEADLESS || "true").toLowerCase() !== "false");

  try {
    const result = await scrapeEbay({ query, maxPages, useAI, headless });
    // Pastikan semua field ada; fallback '-' sudah di dalam scraper
    res.json(result);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message || "Internal error" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Scraper API listening on http://localhost:${PORT}`);
});
