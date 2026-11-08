// background.js (MV3 service worker)
// - Fetch FishBase summary HTML with fetch(). The extension holds a host
//   permission for www.fishbase.se, so no CORS workaround is needed.
// - Parse og:image or main species photo
// - If FishBase has no photo (invertebrates, algae, genus-only entries on the
//   Pacific Coast and other invert-inclusive lists), fall back to iNaturalist.
// - Respond to {type:"fb.image", scientificName} with
//   {url, image, source: "fishbase"|"inat", credit?}

async function fetchText(url) {
  const res = await fetch(url, { method: "GET" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

function absolutize(url, base) {
  try { return new URL(url, base).toString(); } catch { return url; }
}

// FishBase's og:image points to www.fishbase.us, which 403s on hotlinked
// image requests. The same path is served by www.fishbase.se without that
// restriction, so rewrite to keep images loadable.
function rewriteImageHost(url) {
  if (!url) return url;
  return url.replace(/^(https?:\/\/)(?:www\.)?fishbase\.us\//i, "$1www.fishbase.se/");
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
    .replace(/\s+(cf|aff|sp|spp)\.?(\s.*)?$/i, "")
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
      if (img) return { url, image: rewriteImageHost(img) };
    } catch {
      // try next
    }
  }
  throw new Error(`No FishBase summary found for ${genus} ${species}`);
}

// ---- iNaturalist fallback ---------------------------------------------
// FishBase only covers fish. iNaturalist's public API (CORS-enabled, no key)
// covers invertebrates and algae and returns a CC-licensed default photo with
// an attribution string, which we show in the popup.
// Only an exact name match is accepted (current name or a synonym), so a
// species never silently gets a photo of a different species. A genus-only
// REEF entry (e.g. "Metridium spp.") gets the genus photo.
async function inatLookup(name) {
  const q = encodeURIComponent(name);
  const res = await fetch(
    `https://api.inaturalist.org/v1/taxa?q=${q}&is_active=true&per_page=10`,
    { headers: { Accept: "application/json" } }
  );
  if (!res.ok) throw new Error(`iNaturalist HTTP ${res.status}`);
  const json = await res.json();
  const want = name.toLowerCase();
  const results = Array.isArray(json?.results) ? json.results : [];
  const wantWords = want.split(/\s+/).length;
  const withPhoto = results.filter(t => t?.default_photo);
  // Exact current name first; otherwise a synonym match at the same level
  // (a genus query must not pick up one of its species, and vice versa).
  const hit =
    withPhoto.find(t => String(t.name || "").toLowerCase() === want) ||
    withPhoto.find(t =>
      String(t.matched_term || "").toLowerCase() === want &&
      String(t.name || "").trim().split(/\s+/).length === wantWords);
  if (!hit) throw new Error(`No iNaturalist photo for ${name}`);
  const p = hit.default_photo;
  const image = p.medium_url || p.url || p.square_url;
  if (!image) throw new Error(`No iNaturalist photo for ${name}`);
  return {
    url: `https://www.inaturalist.org/taxa/${encodeURIComponent(hit.id)}`,
    image,
    source: "inat",
    credit: p.attribution || null
  };
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    try {
      if (msg.type === "fb.image") {
        const cleaned = normalizeScientificName(msg.scientificName || "");
        if (!cleaned) throw new Error("Bad scientific name: " + msg.scientificName);
        const parts = splitGenusSpecies(cleaned);

        // 1) FishBase (fish, binomials only)
        if (parts) {
          try {
            const data = await fbSummarySmart(parts.genus, parts.species);
            if (data?.image) {
              sendResponse({ ok: true, data: { ...data, source: "fishbase" } });
              return;
            }
          } catch { /* fall through to iNaturalist */ }
        }

        // 2) iNaturalist (invertebrates, algae, genus-level entries)
        const words = cleaned.split(/\s+/);
        const inatName = parts
          ? `${parts.genus} ${parts.species}`
          : words[0].charAt(0).toUpperCase() + words[0].slice(1).toLowerCase();
        const data = await inatLookup(inatName);
        sendResponse({ ok: true, data });
        return;
      }
      sendResponse({ ok: false, error: "Unknown message type" });
    } catch (err) {
      sendResponse({ ok: false, error: String(err) });
    }
  })();
  return true; // async
});
