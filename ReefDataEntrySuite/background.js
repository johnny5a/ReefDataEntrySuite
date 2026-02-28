// background.js (MV3)
// - Inject CORS header for FishBase via Declarative Net Request (dynamic rule)
// - Fetch FishBase summary HTML with fetch()
// - Parse og:image or main species photo
// - Respond to {type:"fb.image", scientificName} with {url, image}

async function ensureCorsRule() {
  const RULE_ID = 90001;
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [RULE_ID],
    addRules: [{
      id: RULE_ID,
      priority: 1,
      action: {
        type: "modifyHeaders",
        responseHeaders: [
          { header: "access-control-allow-origin", operation: "set", value: "*" },
          { header: "access-control-allow-headers", operation: "set", value: "*" },
          { header: "access-control-allow-methods", operation: "set", value: "GET, OPTIONS" }
        ]
      },
      condition: {
        resourceTypes: ["xmlhttprequest", "sub_frame", "main_frame", "script"],
        urlFilter: "||fishbase.se/summary/"
      }
    }]
  });
}

chrome.runtime.onInstalled.addListener(() => { ensureCorsRule(); });
chrome.runtime.onStartup.addListener(() => { ensureCorsRule(); });

async function fetchText(url) {
  const res = await fetch(url, { method: "GET" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

function absolutize(url, base) {
  try { return new URL(url, base).toString(); } catch { return url; }
}

function extractOgImage(html) {
  const m = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
  return m ? m[1] : null;
}

function extractMainPhoto(html, baseUrl) {
  let m = html.match(/<img[^>]+id=["']ssphoto["'][^>]+src=["']([^"']+)["']/i);
  if (m) return absolutize(m[1], baseUrl);
  m = html.match(/<img[^>]+class=["'][^"']*(?:imgSS|speciesimg)[^"']*["'][^>]+src=["']([^"']+)["']/i);
  if (m) return absolutize(m[1], baseUrl);
  m = html.match(/<img[^>]+src=["']([^"']+\/images\/[^"']+)["'][^>]*>/i);
  if (m) return absolutize(m[1], baseUrl);
  return null;
}

function normalizeScientificName(raw) {
  return String(raw)
    .replace(/[()]/g, "")
    .replace(/\b(cf\.|aff\.|sp\.|spp\.)\b.*$/i, "")
    .replace(/[^\p{L}\-\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function splitGenusSpecies(cleaned) {
  const parts = cleaned.split(/\s+/);
  if (parts.length < 2) return null;
  const genus   = parts[0].charAt(0).toUpperCase() + parts[0].slice(1).toLowerCase();
  const species = parts[1].toLowerCase();
  return { genus, species };
}

async function fbSummarySmart(genus, species) {
  const slug = `${genus}-${species}`;
  const candidates = [
    `https://www.fishbase.se/summary/${encodeURIComponent(slug)}`,
    `https://www.fishbase.se/summary/${encodeURIComponent(slug)}.html`,
    `https://www.fishbase.se/summary/SpeciesSummary.php?genusname=${encodeURIComponent(genus)}&speciesname=${encodeURIComponent(species)}`
  ];
  for (const url of candidates) {
    try {
      const html = await fetchText(url);
      const og  = extractOgImage(html);
      const img = og ? absolutize(og, url) : extractMainPhoto(html, url);
      if (img) return { url, image: img };
    } catch {
      // try next
    }
  }
  throw new Error(`No FishBase summary found for ${genus} ${species}`);
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    try {
      if (msg.type === "fb.image") {
        const cleaned = normalizeScientificName(msg.scientificName || "");
        const parts = splitGenusSpecies(cleaned);
        if (!parts) throw new Error("Bad scientific name: " + msg.scientificName);
        const { genus, species } = parts;
        const data = await fbSummarySmart(genus, species);
        if (!data?.image) {
          sendResponse({ ok: false, error: "No image found on FishBase page" });
          return;
        }
        sendResponse({ ok: true, data }); // { url, image }
        return;
      }
      sendResponse({ ok: false, error: "Unknown message type" });
    } catch (err) {
      sendResponse({ ok: false, error: String(err) });
    }
  })();
  return true; // async
});
