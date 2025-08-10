function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function cleanText(s) {
  if (!s) return "";
  return String(s).replace(/\s+/g, " ").trim();
}

function dashIfEmpty(s) {
  const v = cleanText(s);
  return v ? v : "-";
}

module.exports = { sleep, cleanText, dashIfEmpty };
