const { cleanText } = require("./utils");

// Simple OpenAI-compatible client via fetch (Node 18+ has global fetch).
// Works with DeepSeek when base URL + API key set accordingly.
async function callChatCompletion({ baseUrl, apiKey, model, system, user }) {
  const url = `${baseUrl.replace(/\/$/, "")}/chat/completions`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      messages: [
        ...(system ? [{ role: "system", content: system }] : []),
        { role: "user", content: user }
      ],
      temperature: 0.2
    })
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`LLM HTTP ${res.status}: ${text}`);
  }
  const json = await res.json();
  const content = json.choices?.[0]?.message?.content || "";
  return content;
}

function makeLLMFromEnv() {
  const provider = (process.env.LLM_PROVIDER || "").toLowerCase();
  if (!provider) {
    return { enabled: false, provider: "none", async extractDescription() { return "-"; } };
  }

  if (provider === "deepseek") {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    const base = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";
    const model = process.env.DEEPSEEK_MODEL || "deepseek-chat";
    if (!apiKey) {
      console.warn("[LLM] DeepSeek selected but DEEPSEEK_API_KEY missing; AI disabled.");
      return { enabled: false, provider: "deepseek", async extractDescription() { return "-"; } };
    }
    return {
      enabled: true,
      provider: "deepseek",
      async extractDescription(raw) {
        const chunk = cleanText(raw).slice(0, 12000);
        const system =
          "You extract concise product descriptions from messy HTML/text. Only return the description sentence(s) in plain text. If no seller description exists, return a single dash '-'.";
        const user = `Extract the seller-provided product description from the following eBay product page text. Avoid prices, shipping, return policy, ads, and boilerplate. Keep it brief (1-3 sentences). If nothing relevant, return '-'.\n\n---\n${chunk}`;
        const out = await callChatCompletion({ baseUrl: base, apiKey, model, system, user });
        return cleanText(out) || "-";
      }
    };
  }

  if (provider === "openai") {
    const apiKey = process.env.OPENAI_API_KEY;
    const base = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
    if (!apiKey) {
      console.warn("[LLM] OpenAI selected but OPENAI_API_KEY missing; AI disabled.");
      return { enabled: false, provider: "openai", async extractDescription() { return "-"; } };
    }
    return {
      enabled: true,
      provider: "openai",
      async extractDescription(raw) {
        const chunk = cleanText(raw).slice(0, 12000);
        const system =
          "You extract concise product descriptions from messy HTML/text. Only return the description sentence(s) in plain text. If no seller description exists, return a single dash '-'.";
        const user = `Extract the seller-provided product description from the following eBay product page text. Avoid prices, shipping, return policy, ads, and boilerplate. Keep it brief (1-3 sentences). If nothing relevant, return '-'.\n\n---\n${chunk}`;
        const out = await callChatCompletion({ baseUrl: base, apiKey, model, system, user });
        return cleanText(out) || "-";
      }
    };
  }

  console.warn(`[LLM] Unknown provider '${provider}'; AI disabled.`);
  return { enabled: false, provider: "none", async extractDescription() { return "-"; } };
}

module.exports = { makeLLMFromEnv };
