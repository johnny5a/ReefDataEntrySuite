// content-frame.js — REEF DataEntry Suite Frame Content
// Combines iframe message handlers + fish image previews from FishBase
// v1.0.0

// Detect if we're on an unlisted/addfish page early
// (defined at top so all IIFEs can use it)
const isUnlistedPage = window.location.href.includes('/unlisted') || window.location.href.includes('/addfish');

// Diagnostic logging
console.log("[REEF Suite - Frame] Script loaded on URL:", window.location.href);
console.log("[REEF Suite - Frame] isUnlistedPage:", isUnlistedPage);

// ========================================
// PART 1: Frame Message Handlers (from Buttons/frame.js)
// ========================================
(() => {
  const NS_CMD           = "rfsp-cmd";
  const NS_PAGE          = "rfsp-page";
  const NS_FAMS          = "rfsp-families";
  const NS_FAM_SCROLLED  = "rfsp-fam-scrolled";
  const NS_FAM_MEASURED  = "rfsp-fam-measured";
  const LOG = (...a) => console.log("[REEF Suite - Frame]", ...a);

  function sendPageInfo() {
    try { (window.parent || window.top).postMessage({ ns: NS_PAGE, href: location.href, path: location.pathname }, "*"); } catch {}
  }

  function scanFamilyRows() {
    return Array.from(document.querySelectorAll("tr.questionbold")).filter(tr => {
      const tds = tr.querySelectorAll("td");
      return tds && tds.length >= 2 && (tds[0].textContent || "").trim().toLowerCase() === "family";
    });
  }

  function sendFamilies() {
    const list = scanFamilyRows().map(tr => {
      const name = (tr.querySelectorAll("td")[1]?.textContent || "").replace(/\s+/g," ").trim();
      const rect = tr.getBoundingClientRect();
      const docY = rect.top + (window.scrollY || document.documentElement.scrollTop || 0);
      return { name, y: docY };
    });
    try { (window.parent || window.top).postMessage({ ns: NS_FAMS, families: list }, "*"); } catch {}
  }

  function clickCandidate(list){
    for (const sel of list){ const el = document.querySelector(sel); if (el){ el.click(); return true; } }
    return false;
  }
  function submitFallback(which){
    try{ if (typeof window.submitPage === "function"){ window.submitPage(which.toLowerCase()); return true; } }catch{}
    return false;
  }

  window.addEventListener("message", (ev) => {
    const d = ev?.data || {};
    if (!d || d.ns !== NS_CMD) return;
    if (!/^https?:\/\/([a-z0-9-]+\.)*reef\.org$/i.test(ev.origin || "")) return;

    if (d.action === "FAMILY_LIST_REQ") { sendFamilies(); return; }

    if (d.action === "FAMILY_SCROLL_TO_INDEX") {
      const rows = scanFamilyRows(); if (!rows.length) return;
      const i = Math.min(Math.max(0, Number(d.index) || 0), rows.length - 1);
      const tr = rows[i];
      try { tr.scrollIntoView({ block: "start" }); } catch { tr.scrollIntoView(true); }
      const rect = tr.getBoundingClientRect();
      (window.parent || window.top).postMessage({ ns: NS_FAM_SCROLLED, index: i, clientTop: rect.top }, "*");
      return;
    }

    if (d.action === "FAMILY_MEASURE_INDEX") {
      const rows = scanFamilyRows(); if (!rows.length) return;
      const i = Math.min(Math.max(0, Number(d.index) || 0), rows.length - 1);
      const tr = rows[i];
      const rect = tr.getBoundingClientRect();
      (window.parent || window.top).postMessage({ ns: NS_FAM_MEASURED, index: i, clientTop: rect.top }, "*");
      return;
    }

    if (d.action === "NEXT") {
      const ok = clickCandidate([
        "#nextbutton",'input[type="button"][value="NEXT"]','input[type="submit"][value="NEXT"]','input.btn2[value="NEXT"]',
        '[onclick*="submitPage(\'next\')"]'
      ]) || submitFallback("next");
      LOG("NEXT", ok ? "clicked" : "not found");
      return;
    }

    if (d.action === "SAVE") {
      const ok = clickCandidate([
        "#savebutton",'input[type="button"][value="SAVE"]','input[type="submit"][value="SAVE"]','input.btn2[value="SAVE"]',
        '[onclick*="submitPage(\'save\')"]'
      ]) || submitFallback("save");
      LOG("SAVE", ok ? "clicked" : "not found");
      return;
    }
  }, false);

  // Keep families fresh if DOM changes
  try {
    const mo = new MutationObserver(() => { clearTimeout(mo._t); mo._t = setTimeout(sendFamilies, 250); });
    mo.observe(document.documentElement, { childList: true, subtree: true });
  } catch {}

  window.addEventListener("DOMContentLoaded", () => { sendPageInfo(); sendFamilies(); }, { once:true });
  window.addEventListener("load", () => { sendPageInfo(); sendFamilies(); }, { once:true });
  setTimeout(() => { sendPageInfo(); sendFamilies(); }, 600);
})();

// ========================================
// PART 2: Fish Preview System (from Reef extension)
// ========================================

// User-configurable settings
let HOVER_DELAY_MS        = 100;
let TOOLTIP_POSITION      = "right";
let THUMB_HEIGHT          = 90;
let POPUP_WIDTH           = 320;
let POPUP_IMG_MAX_WIDTH   = 300;
let POPUP_IMG_MAX_HEIGHT  = 200;
let MAX_PARALLEL_REQUESTS = 3;
let FISH_TABLE_MAX_WIDTH  = 500;

// Seed CSS variables immediately
(function rfspSeedThumbVars() {
  const cellWidth = Math.round(THUMB_HEIGHT * 1.4) + 20;
  const wrapWidth = Math.round(THUMB_HEIGHT * 1.2);
  const root = document.documentElement.style;
  root.setProperty("--rfsp-col-thumb-width",        cellWidth + "px");
  root.setProperty("--rfsp-thumb-wrapper-width",    wrapWidth + "px");
  root.setProperty("--rfsp-thumb-wrapper-min-height", THUMB_HEIGHT + "px");
})();

chrome.storage.sync.get(
  {
    hoverDelay: 100,
    tooltipPosition: "right",
    thumbHeight: 90,
    popupWidth: 320,
    popupImgMaxWidth: 300,
    popupImgMaxHeight: 200,
    fishTableMaxWidth: 500
  },
  (items) => {
    HOVER_DELAY_MS       = items.hoverDelay;
    TOOLTIP_POSITION     = items.tooltipPosition;
    THUMB_HEIGHT         = items.thumbHeight;
    POPUP_WIDTH          = items.popupWidth;
    POPUP_IMG_MAX_WIDTH  = items.popupImgMaxWidth;
    POPUP_IMG_MAX_HEIGHT = items.popupImgMaxHeight;
    FISH_TABLE_MAX_WIDTH = items.fishTableMaxWidth;

    applyThumbCssVariables();
    warmCachedImagesForCurrentRows();
    rfspWrapAndCenterFishTables();
    document.querySelectorAll("tr").forEach(bindRow);
  }
);

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "sync") return;
  if (changes.hoverDelay)        HOVER_DELAY_MS       = changes.hoverDelay.newValue;
  if (changes.tooltipPosition)   TOOLTIP_POSITION     = changes.tooltipPosition.newValue;
  if (changes.thumbHeight)       THUMB_HEIGHT         = changes.thumbHeight.newValue;
  if (changes.popupWidth)        POPUP_WIDTH          = changes.popupWidth.newValue;
  if (changes.popupImgMaxWidth)  POPUP_IMG_MAX_WIDTH  = changes.popupImgMaxWidth.newValue;
  if (changes.popupImgMaxHeight) POPUP_IMG_MAX_HEIGHT = changes.popupImgMaxHeight.newValue;
  if (changes.fishTableMaxWidth) {
    FISH_TABLE_MAX_WIDTH = changes.fishTableMaxWidth.newValue;
    rfspUpdateFishTableWidth();
  }

  if (changes.thumbHeight) {
    applyThumbCssVariables();
  }
  if (changes.popupWidth && tip.style.display === "block") {
    tip.style.width = POPUP_WIDTH + "px";
  }
});

function rfspInjectFishFontCSS() {
  if (document.getElementById("rfsp-fish-font-css")) return;
  const css = `
    .rfsp-fish-scope {
      font-size: var(--rfsp-fish-font-size, 14px) !important;
      line-height: 1.2 !important;
    }
    .rfsp-fish-scope td,
    .rfsp-fish-scope th,
    .rfsp-fish-scope input,
    .rfsp-fish-scope select,
    .rfsp-fish-scope textarea,
    .rfsp-fish-scope label,
    .rfsp-fish-scope .rfsp-presence-wrap {
      font-size: inherit !important;
      line-height: inherit !important;
    }
  `;
  const style = document.createElement("style");
  style.id = "rfsp-fish-font-css";
  style.textContent = css;
  (document.head || document.documentElement).appendChild(style);
}
rfspInjectFishFontCSS();

// Lazy-load thumbnails
const RFSP_IO_ROOT_MARGIN = "300px 0px";
let rfspRowIO = null;
const rfspLoadedRows = new WeakSet();

function rfspEnsureObserver() {
  if (rfspRowIO) return rfspRowIO;
  if (!("IntersectionObserver" in window)) return null;
  rfspRowIO = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      const row = e.target;
      rfspRowIO.unobserve(row);
      if (rfspLoadedRows.has(row)) continue;
      rfspLoadedRows.add(row);
      const sci = row.__rfspSci;
      if (sci) populateInlinePreview(row, sci);
    }
  }, { root: null, rootMargin: RFSP_IO_ROOT_MARGIN, threshold: 0.01 });
  return rfspRowIO;
}

// Tooltip
const tip = document.createElement("div");
tip.id = "fish-tooltip";
document.body.appendChild(tip);

let pinned = false;

function hideTip() { tip.style.display = "none"; }

function clampToViewport(left, top, w, h, pad = 12) {
  const vw = window.innerWidth + window.scrollX;
  const vh = window.innerHeight + window.scrollY;
  if (left + w + pad > vw) left = Math.max(window.scrollX + pad, vw - w - pad);
  if (top  + h + pad > vh) top  = Math.max(window.scrollY + pad, vh - h - pad);
  return { left, top };
}

function placeTipNearElement(el) {
  tip.style.width = POPUP_WIDTH + "px";
  tip.style.visibility = "hidden";
  tip.style.display = "block";

  const rect = el.getBoundingClientRect();
  const w = tip.offsetWidth  || POPUP_WIDTH;
  const h = tip.offsetHeight || 160;

  let left, top;
  switch (TOOLTIP_POSITION) {
    case "left":
      left = rect.left + window.scrollX - w - 8;
      top  = rect.top + window.scrollY + rect.height/2 - h/2;
      break;
    case "above":
      left = rect.left + window.scrollX + rect.width/2 - w/2;
      top  = rect.top + window.scrollY - h - 8;
      break;
    case "below":
      left = rect.left + window.scrollX + rect.width/2 - w/2;
      top  = rect.bottom + window.scrollY + 8;
      break;
    case "right":
    default:
      left = rect.right + window.scrollX + 8;
      top  = rect.top   + window.scrollY + rect.height/2 - h/2;
      break;
  }

  const cl = clampToViewport(left, top, w, h);
  tip.style.left = cl.left + "px";
  tip.style.top  = cl.top  + "px";
  tip.style.visibility = "visible";
  tip.style.display = "block";
}

function renderTip(info) {
  const { image, url, sci } = info;
  tip.innerHTML = `
    <div class="fish-tip-inner" style="width:${POPUP_WIDTH}px">
      <div class="fish-tip-actions" style="text-align:right;margin-bottom:4px;">
        <button class="fish-pin" title="${pinned ? "Unpin" : "Pin"}">${pinned ? "📌" : "📍"}</button>
        <button class="fish-close" title="Close">❌</button>
      </div>
      <img src="${image}" alt="${sci}" referrerpolicy="no-referrer"
           style="max-width:${POPUP_IMG_MAX_WIDTH}px; max-height:${POPUP_IMG_MAX_HEIGHT}px;
                  width:auto; height:auto; display:block; border-radius:4px;" />
      ${url ? `<div class="fish-tip-link" style="text-align:right;margin-top:6px;">
                 <a href="${url}" target="_blank" rel="noopener" style="color:#0b70ff;text-decoration:none;">View on FishBase</a>
               </div>` : ""}
    </div>`;

  tip.querySelector(".fish-close").addEventListener("click", (e) => {
    e.stopPropagation();
    pinned = false;
    hideTip();
  });
  tip.querySelector(".fish-pin").addEventListener("click", (e) => {
    e.stopPropagation();
    pinned = !pinned;
    renderTip(info);
  });
}

// Base popup styles
(() => {
  if (!document.getElementById("rfsp-base-style")) {
    const s = document.createElement("style");
    s.id = "rfsp-base-style";
    s.textContent = `
      #fish-tooltip {
        position:absolute; display:none; pointer-events:auto; z-index:2147483647;
        background:#fff; border:1px solid rgba(0,0,0,.15); border-radius:8px;
        box-shadow:0 8px 24px rgba(0,0,0,.18); padding:8px;
      }
      #fish-tooltip .fish-tip-actions button {
        background:transparent; border:0; cursor:pointer; font-size:14px; margin-left:6px;
      }
    `;
    document.head.appendChild(s);
  }
})();

// Caching + background lookup
const cache = new Map();
const inflight = new Map();

let persistentCache = {};
chrome.storage.local.get({ rfspImageCache: {} }, (res) => {
  persistentCache = res.rfspImageCache || {};
  warmCachedImagesForCurrentRows();
});

function getPersistedInfo(sci) {
  return persistentCache?.[sci]?.data || null;
}
function setPersistedInfo(sci, data) {
  persistentCache[sci] = { data, ts: Date.now() };
  chrome.storage.local.set({ rfspImageCache: persistentCache });
}

let _active = 0;
const _q = [];
function enqueue(task) {
  return new Promise((resolve, reject) => {
    _q.push({ task, resolve, reject });
    pump();
  });
}
function pump() {
  while (_active < MAX_PARALLEL_REQUESTS && _q.length) {
    const { task, resolve, reject } = _q.shift();
    _active++;
    task().then(resolve, reject).finally(() => { _active--; pump(); });
  }
}

async function requestFishbaseInfo(scientificName) {
  if (cache.has(scientificName)) return cache.get(scientificName);

  const persisted = getPersistedInfo(scientificName);
  if (persisted) {
    cache.set(scientificName, persisted);
    return persisted;
  }

  if (inflight.has(scientificName)) return inflight.get(scientificName);

  const p = enqueue(() =>
    new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: "fb.image", scientificName }, (resp) => {
        let out = null;
        if (resp && resp.ok) out = { image: resp.data?.image || null, url: resp.data?.url || null };
        cache.set(scientificName, out);
        if (out) setPersistedInfo(scientificName, out);
        inflight.delete(scientificName);
        resolve(out);
      });
    })
  );

  inflight.set(scientificName, p);
  return p;
}

// Fish row detection
function normalizeSci(raw) {
  return String(raw || "")
    .replace(/[()]/g, "")
    .replace(/\b(cf\.|aff\.|sp\.|spp\.)\b.*$/i, "")
    .replace(/[^\p{L}\-\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function sciFromCell(cell) {
  const it = cell?.querySelector?.("i");
  if (it) return normalizeSci(it.textContent || "");
  return normalizeSci(cell?.textContent || "");
}
function findSciCellAndNameForRow(row) {
  const sciCellA = row.querySelector("td.fishdisplayitalic");
  if (sciCellA) {
    const sciA = sciFromCell(sciCellA);
    if (sciA) return { cell: sciCellA, sci: sciA };
  }
  const tds = row.querySelectorAll("td.fishdisplay");
  if (tds.length >= 2 && tds[1].querySelector("i")) {
    const sciB = sciFromCell(tds[1]);
    if (sciB) return { cell: tds[1], sci: sciB };
  }
  const anyItal = row.querySelector("td.fishdisplay i");
  if (anyItal) {
    const td = anyItal.closest("td.fishdisplay");
    const sciC = sciFromCell(td);
    if (sciC) return { cell: td, sci: sciC };
  }
  return null;
}

// Inline thumbnail column
function applyThumbCssVariables() {
  const cellWidth   = Math.round(THUMB_HEIGHT * 1.6) + 20;
  const wrapperW    = Math.round(THUMB_HEIGHT * 1.2);

  const root = document.documentElement.style;
  root.setProperty("--rfsp-thumb-height", THUMB_HEIGHT + "px");
  root.setProperty("--rfsp-thumb-wrapper-width", wrapperW + "px");
  root.setProperty("--rfsp-col-thumb-width", cellWidth + "px");
}

function resizeExistingThumbs() { }

function ensureShellForRow(row) {
  let td = row.querySelector("td.fish-inline-preview-cell");
  if (!td) {
    td = document.createElement("td");
    td.className = "fish-inline-preview-cell";
    row.appendChild(td);
  }
  let wrap = td.querySelector(".fish-inline-preview");
  if (!wrap) {
    wrap = document.createElement("div");
    wrap.className = "fish-inline-preview";
    td.appendChild(wrap);
  }
  return { td, wrap };
}

function attachHover(el, info, sci) {
  let timer = null;
  const showFn = () => {
    timer = setTimeout(() => {
      renderTip({ ...info, sci });
      placeTipNearElement(el);
    }, HOVER_DELAY_MS);
  };
  const leaveFn = (e) => {
    clearTimeout(timer);
    const toEl = e.relatedTarget;
    const enteringTip = toEl ? (toEl === tip || tip.contains(toEl)) : false;
    if (!enteringTip && !pinned) hideTip();
  };
  el.addEventListener("mouseenter", showFn);
  el.addEventListener("mouseleave", leaveFn);
}

async function populateInlinePreview(row, sci) {
  const { wrap } = ensureShellForRow(row);

  const info = await requestFishbaseInfo(sci);
  if (!info || !info.image) return;

  wrap.innerHTML = "";
  const a = document.createElement("a");
  a.href = info.url || "#";
  a.target = "_blank";
  a.rel = "noopener";
  a.title = info.url ? "Open on FishBase" : sci;

  const img = document.createElement("img");
  img.alt = sci;
  img.referrerPolicy = "no-referrer";
  img.decoding = "async";
  img.src = info.image;

  a.appendChild(img);
  wrap.appendChild(a);

  attachHover(wrap, info, sci);
}

function warmCachedImagesForCurrentRows() { }

function bindRow(row) {
  if (row.__rfspBound) return;
  const found = findSciCellAndNameForRow(row);
  if (!found) return;
  row.__rfspBound = true;

  row.__rfspSci = found.sci;

  ensureShellForRow(row);
  rfspTagFishRowColumns(row);

  const io = rfspEnsureObserver();
  if (io) {
    io.observe(row);
  } else {
    rfspLoadedRows.add(row);
    populateInlinePreview(row, found.sci);
  }
}

const observer = new MutationObserver((muts) => {
  let needsWrapCheck = false;
  for (const m of muts) {
    m.addedNodes.forEach((n) => {
      if (n.nodeType !== 1) return;
      if (n.matches?.("tr")) bindRow(n);
      n.querySelectorAll?.("tr")?.forEach(bindRow);
      if (!needsWrapCheck && (n.matches?.("td.fishdisplay, td.fishdisplayitalic") || n.querySelector?.("td.fishdisplay, td.fishdisplayitalic"))) {
        needsWrapCheck = true;
      }
    });
  }
  if (needsWrapCheck) setTimeout(rfspWrapAndCenterFishTables, 0);
});
observer.observe(document.documentElement, { childList: true, subtree: true });

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    pinned = false;
    hideTip();
  }
});

// Presence selectors enhancer
(function rfspPresenceSelectors() {
  // Skip on unlisted/addfish pages - they don't have survey forms
  if (isUnlistedPage) {
    console.log("[REEF Suite - Frame] Skipping rfspPresenceSelectors on unlisted page");
    return;
  }
  console.log("[REEF Suite - Frame] Running rfspPresenceSelectors");

  const ABUNDANCE_MAP = [
    { value: "0",  label: "None" },
    { value: "78", label: "Single (1)" },
    { value: "79", label: "Few (2-10)" },
    { value: "80", label: "Many (11-100)" },
    { value: "81", label: "Abundant (101+)" },
  ];

  function hasAll(select, needed) {
    const vals = new Set([...select.options].map(o => (o.value ?? "").trim()));
    return needed.every(v => vals.has(v));
  }

  function makeContainer() {
    const wrap = document.createElement("div");
    wrap.className = "rfsp-presence-wrap";
    wrap.style.display = "inline-flex";
    wrap.style.flexWrap = "wrap";
    wrap.style.gap = "6px 10px";
    wrap.style.marginLeft = "6px";
    wrap.style.alignItems = "center";
    return wrap;
  }

  document.querySelectorAll("tr").forEach(row => {
    if (!row.querySelector("td.fishdisplayitalic, td.fishdisplay")) return;

    row.querySelectorAll("select").forEach(sel => {
      if (sel.dataset.rfspEnhanced === "1") return;

      const values = [...sel.options].map(o => (o.value ?? "").trim());
      const asSet  = new Set(values);

      const isPresentNot = asSet.has("0") && asSet.has("82");
      const isAbundance  = hasAll(sel, ["0","78","79","80","81"]);

      if (!isPresentNot && !isAbundance) return;

      sel.dataset.rfspEnhanced = "1";
      sel.style.display = "none";

      const mountPoint = sel.parentNode;
      const container  = makeContainer();
      mountPoint.insertBefore(container, sel.nextSibling);

      if (isPresentNot) {
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.id   = `rfsp-present-${Math.random().toString(36).slice(2)}`;
        checkbox.checked = sel.value === "82";

        const label = document.createElement("label");
        label.setAttribute("for", checkbox.id);
        label.textContent = "Present";

        checkbox.addEventListener("change", () => {
          sel.value = checkbox.checked ? "82" : "0";
          sel.dispatchEvent(new Event("change", { bubbles: true }));
        });

        sel.addEventListener("change", () => {
          checkbox.checked = sel.value === "82";
        });

        container.appendChild(checkbox);
        container.appendChild(label);
      } else if (isAbundance) {
        const groupName = `rfsp-abund-${Math.random().toString(36).slice(2)}`;

        ABUNDANCE_MAP.forEach(item => {
          if (!asSet.has(item.value)) return;

          const wrap = document.createElement("span");
          wrap.style.display = "inline-flex";
          wrap.style.alignItems = "center";
          wrap.style.gap = "4px";

          const radio = document.createElement("input");
          radio.type = "radio";
          radio.name = groupName;
          radio.value = item.value;
          radio.id = `rfsp-${groupName}-${item.value}`;

          const label = document.createElement("label");
          label.setAttribute("for", radio.id);
          label.textContent = item.label;

          radio.checked = (sel.value ?? "").trim() === item.value;

          radio.addEventListener("change", () => {
            if (!radio.checked) return;
            sel.value = item.value;
            sel.dispatchEvent(new Event("change", { bubbles: true }));
          });

          wrap.appendChild(radio);
          wrap.appendChild(label);
          container.appendChild(wrap);
        });

        sel.addEventListener("change", () => {
          const want = (sel.value ?? "").trim();
          container.querySelectorAll(`input[type="radio"][name="${groupName}"]`).forEach(r => {
            r.checked = r.value === want;
          });
        });
      }
    });
  });
})();

// Fit fish frame to content height (works for listed and unlisted species)
(function rfspFitFishFrameInit() {
  function findFishFrame(doc = document) {
    const frames = Array.from(doc.querySelectorAll("iframe, frame"));

    // Look for frames with fish-related URLs
    let found = frames.find(f => {
      try {
        const src = f.src || "";
        return src.includes("/dataentry/listedfish.php") ||
               src.includes("/dataentry/unlistedfish.php");
      } catch {
        return false;
      }
    });
    if (found) return found;

    // Fallback: Look for frames containing fish table elements
    for (const f of frames) {
      try {
        const cd = f.contentDocument;
        if (cd && cd.querySelector("td.fishdisplay, td.fishdisplayitalic")) return f;
      } catch {}
    }
    return null;
  }

  function fitFrameHeight(frame) {
    let cd, de, body;
    try { cd = frame.contentDocument; de = cd?.documentElement; body = cd?.body; } catch { return; }
    if (!cd || !de || !body) return;

    frame.setAttribute("scrolling", "no");
    try { frame.style.overflow = "hidden"; de.style.overflow = "visible"; body.style.overflow = "visible"; } catch {}

    const h = Math.max(body.scrollHeight, body.offsetHeight, de.scrollHeight, de.offsetHeight, de.clientHeight);

    const prev = frame.__rfspLastH || 0;
    if (Math.abs(h - prev) < 2) return;
    frame.__rfspLastH = h;

    console.log("[REEF Suite - Frame] Fitting iframe to height:", h + "px");

    cancelAnimationFrame(frame.__rfspRaf || 0);
    frame.__rfspRaf = requestAnimationFrame(() => {
      frame.style.height = h + "px";
      frame.style.maxHeight = h + "px";
      frame.style.width = "100%";
      frame.style.border = "0";
      frame.style.display = "block";
    });
  }

  function trackFrame(frame) {
    if (!frame || frame.__rfspFitBound) return;
    frame.__rfspFitBound = true;

    frame.addEventListener("load", () => fitFrameHeight(frame), { passive: true });
    window.addEventListener("resize", () => fitFrameHeight(frame), { passive: true });

    try {
      const cd = frame.contentDocument;
      const body = cd?.body;
      if (body && "ResizeObserver" in window) {
        const ro = new ResizeObserver(() => fitFrameHeight(frame));
        ro.observe(body);
        frame.__rfspBodyRO = ro;
      }
    } catch { }

    fitFrameHeight(frame);
    setTimeout(() => fitFrameHeight(frame), 150);
    setTimeout(() => fitFrameHeight(frame), 450);
  }

  function boot() {
    const f = findFishFrame();
    if (f) {
      console.log("[REEF Suite - Frame] Found fish iframe, tracking for auto-fit");
      trackFrame(f);
    }
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
  const lookout = new MutationObserver(() => boot());
  lookout.observe(document.documentElement, { childList: true, subtree: true });
})();

// Fish table wrapping & centering
function rfspFindFishTables() {
  const tables = new Set();
  document.querySelectorAll("td.fishdisplay, td.fishdisplayitalic").forEach(td => {
    const tbl = td.closest("table");
    if (tbl && !tbl.classList.contains("handcursor")) tables.add(tbl);
  });
  return Array.from(tables);
}

function rfspWrapAndCenterFishTables() {
  // Skip on unlisted pages - we don't want to modify the search results table
  if (isUnlistedPage) {
    console.log("[REEF Suite - Frame] Skipping rfspWrapAndCenterFishTables on unlisted page");
    return;
  }

  const tables = rfspFindFishTables();
  for (const tbl of tables) {
    if (tbl.parentElement && tbl.parentElement.classList?.contains("rfsp-fish-wrap")) continue;

    const wrap = document.createElement("div");
    wrap.className = "rfsp-fish-wrap";
    wrap.style.maxWidth = FISH_TABLE_MAX_WIDTH + "px";
    wrap.style.margin = "0 auto";
    wrap.style.width = "100%";

    tbl.style.margin = "0 auto";
    tbl.style.maxWidth = "100%";

    tbl.parentElement.insertBefore(wrap, tbl);
    wrap.appendChild(tbl);
  }
}

function rfspUpdateFishTableWidth() {
  document.querySelectorAll(".rfsp-fish-wrap").forEach(wrap => {
    wrap.style.maxWidth = FISH_TABLE_MAX_WIDTH + "px";
  });
}

function rfspTagFishRowColumns(row) {
  const firstTd = row.querySelector("td:first-child");
  if (firstTd && /^\d+$/.test(firstTd.textContent.trim())) {
    firstTd.classList.add("rfsp-col-number");
  }
  row.querySelectorAll("td").forEach(td => {
    if (td.querySelector("input, select, textarea")) {
      td.classList.add("rfsp-col-count");
    }
  });
  const thumbTd = row.querySelector("td.fish-inline-preview-cell");
  if (thumbTd) thumbTd.classList.add("rfsp-col-thumb");
}

// "Today" button for date fields
(function rfspInjectTodayButton() {
  // Skip on unlisted/addfish pages - they don't have survey date fields
  if (isUnlistedPage) {
    console.log("[REEF Suite - Frame] Skipping rfspInjectTodayButton on unlisted page");
    return;
  }
  console.log("[REEF Suite - Frame] Running rfspInjectTodayButton");

  const BTN_ID = "rfsp-today-btn";

  function insertTodayButton(afterEl, clickHandler) {
    if (!afterEl || document.getElementById(BTN_ID)) return;

    const btn = document.createElement("button");
    btn.id = BTN_ID;
    btn.type = "button";
    btn.textContent = "Today";
    btn.title = "Fill today's date";
    btn.style.cssText = [
      "margin-left:8px",
      "padding:4px 10px",
      "border:1px solid #888",
      "border-radius:6px",
      "background:#f5f5f5",
      "cursor:pointer",
      "font:12px system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
    ].join(";");

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      clickHandler();
    });

    afterEl.insertAdjacentElement("afterend", btn);
  }

  function findFishFrame(doc = document) {
    const frames = Array.from(doc.querySelectorAll("iframe, frame"));
    let found = frames.find(f => {
      try { return (f.src || "").includes("/dataentry/listedfish.php"); } catch { return false; }
    });
    if (found) return found;
    for (const f of frames) {
      try {
        const cd = f.contentDocument;
        if (!cd) continue;
        if (cd.querySelector("input[type=date], select, input")) return f;
      } catch {}
    }
    return null;
  }

  const norm = (s) => String(s || "").toLowerCase();

  function getAttrs(el) {
    return [
      el.id, el.name,
      el.getAttribute("aria-label"),
      el.getAttribute("placeholder")
    ].map(norm).join(" ");
  }

  function findDateFields(root) {
    const dateInput = root.querySelector('input[type="date"]');
    if (dateInput) {
      return { mode: "single", el: dateInput, anchor: dateInput };
    }

    const all = Array.from(root.querySelectorAll("input, select"));

    const month = all.find(el => /month|\bmon\b|\bmm\b/.test(getAttrs(el)));
    const day   = all.find(el => /\bday\b|\bdd\b|\bdate\b/.test(getAttrs(el)));
    const year  = all.find(el => /\byear\b|\byr\b|\byyyy\b/.test(getAttrs(el)));

    if (month && day && year) {
      const anchor = year || day || month;
      return { mode: "mdy", month, day, year, anchor };
    }

    const selects = Array.from(root.querySelectorAll("select"));
    if (selects.length >= 3) {
      const guessMonth = selects.find(s => {
        const t = s.textContent || "";
        const hasMonthName = /jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec/i.test(t);
        const count12 = s.options?.length >= 12 && s.options?.length <= 13;
        return hasMonthName || count12;
      });
      const guessDay = selects.find(s => s !== guessMonth && s.options?.length >= 28 && s.options?.length <= 31);
      const guessYear = selects.find(s => s !== guessMonth && s !== guessDay && Array.from(s.options).some(o => /^\d{4}$/.test(o.value || o.text)));

      if (guessMonth && guessDay && guessYear) {
        const anchor = guessYear;
        return { mode: "mdy", month: guessMonth, day: guessDay, year: guessYear, anchor };
      }
    }

    return null;
  }

  function setSelectTo(select, desired, altStrings = []) {
    const wants = [String(desired), ...altStrings].map(s => norm(s));
    const opts = Array.from(select.options);
    let target = opts.find(o => wants.includes(norm(o.value)));
    if (!target) target = opts.find(o => wants.includes(norm(o.text)));
    if (target) {
      select.value = target.value;
      select.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }
    return false;
  }

  function fillToday(fields) {
    const now = new Date();
    const yyyy = String(now.getFullYear());
    const m = now.getMonth() + 1;
    const d = now.getDate();

    if (fields.mode === "single") {
      const mm = String(m).padStart(2, "0");
      const dd = String(d).padStart(2, "0");
      fields.el.value = `${yyyy}-${mm}-${dd}`;
      fields.el.dispatchEvent(new Event("input", { bubbles: true }));
      fields.el.dispatchEvent(new Event("change", { bubbles: true }));
      return;
    }

    const monthNamesShort = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
    const longName = ["january","february","march","april","may","june","july","august","september","october","november","december"][m-1];
    const shortName = monthNamesShort[m-1];

    if (fields.month?.tagName === "SELECT") {
      setSelectTo(fields.month, m, [String(m).padStart(2,"0"), shortName, longName]);
    } else if (fields.month) {
      fields.month.value = m;
      fields.month.dispatchEvent(new Event("input", { bubbles: true }));
      fields.month.dispatchEvent(new Event("change", { bubbles: true }));
    }

    if (fields.day?.tagName === "SELECT") {
      setSelectTo(fields.day, d, [String(d).padStart(2,"0")]);
    } else if (fields.day) {
      fields.day.value = d;
      fields.day.dispatchEvent(new Event("input", { bubbles: true }));
      fields.day.dispatchEvent(new Event("change", { bubbles: true }));
    }

    if (fields.year?.tagName === "SELECT") {
      setSelectTo(fields.year, yyyy);
    } else if (fields.year) {
      fields.year.value = yyyy;
      fields.year.dispatchEvent(new Event("input", { bubbles: true }));
      fields.year.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }

  function tryInject(rootDoc) {
    if (!rootDoc) return false;
    if (rootDoc.getElementById?.(BTN_ID)) return true;

    const fields = findDateFields(rootDoc);
    if (!fields) return false;

    insertTodayButton(fields.anchor, () => fillToday(fields));
    return true;
  }

  function boot() {
    if (tryInject(document)) return;

    const frame = findFishFrame(document);
    try {
      if (frame?.contentDocument) {
        if (tryInject(frame.contentDocument)) return;
        frame.addEventListener("load", () => tryInject(frame.contentDocument), { once: true });
      }
    } catch { }

    const mo = new MutationObserver(() => {
      if (tryInject(document)) { mo.disconnect(); }
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();

// Fish table font size
(function rfspFishFontSize() {
  const DEFAULT_SIZE = 14;

  function getSameOriginDocs() {
    const docs = [document];
    document.querySelectorAll("iframe, frame").forEach(f => {
      try {
        if (f.contentDocument) docs.push(f.contentDocument);
      } catch (_) { }
    });
    return docs;
  }

  function findFishTablesInDoc(doc) {
    const fishCells = doc.querySelectorAll("td.fishdisplay, td.fishdisplayitalic");
    const tables = new Set();
    fishCells.forEach(td => {
      const tbl = td.closest("table");
      if (tbl && !tbl.classList.contains("handcursor")) tables.add(tbl);
    });
    return [...tables];
  }

  function applySize(px) {
    rfspInjectFishFontCSS?.();
    getSameOriginDocs().forEach(doc => {
      findFishTablesInDoc(doc).forEach(tbl => {
        tbl.classList.add("rfsp-fish-scope");
        tbl.style.setProperty("--rfsp-fish-font-size", `${px}px`);
      });
    });
  }

  function readAndApply() {
    chrome.storage?.sync?.get({ fishFontSize: DEFAULT_SIZE }, items => {
      const px = Number(items.fishFontSize ?? DEFAULT_SIZE) || DEFAULT_SIZE;
      applySize(px);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", readAndApply, { once: true });
  } else {
    readAndApply();
  }

  chrome.storage?.onChanged?.addListener(changes => {
    if ("fishFontSize" in changes) {
      const px = Number(changes.fishFontSize.newValue ?? DEFAULT_SIZE) || DEFAULT_SIZE;
      applySize(px);
    }
  });

  const mo = new MutationObserver(() => readAndApply());
  mo.observe(document.documentElement, { childList: true, subtree: true });
})();

// ========================================
// PART 3: UX Improvements for Fish Data Entry
// ========================================

(function rfspUXImprovements() {
  // Will be populated dynamically by detecting actual select option values
  let ABUNDANCE_VALUES = [];
  let ABUNDANCE_KEYS = {};
  let lastNonZeroValue = null;

  let currentRowIndex = -1;
  let fishRows = [];

  // Detect the actual abundance values from the first select we find
  function detectAbundanceValues() {
    const firstRow = document.querySelector("tr td.rfsp-col-count");
    if (!firstRow) return false;

    const select = firstRow.querySelector("select");
    if (!select || select.options.length === 0) return false;

    const options = Array.from(select.options);
    ABUNDANCE_VALUES = options.map(opt => opt.value.trim());

    // Build keyboard mapping: 0-4 maps to option indices
    // Also add letter shortcuts: N, S, F, M, A
    ABUNDANCE_KEYS = {};
    for (let i = 0; i < Math.min(5, ABUNDANCE_VALUES.length); i++) {
      ABUNDANCE_KEYS[String(i)] = ABUNDANCE_VALUES[i];
    }

    // Letter shortcuts
    if (ABUNDANCE_VALUES.length >= 1) ABUNDANCE_KEYS['n'] = ABUNDANCE_VALUES[0]; // None
    if (ABUNDANCE_VALUES.length >= 2) ABUNDANCE_KEYS['s'] = ABUNDANCE_VALUES[1]; // Single
    if (ABUNDANCE_VALUES.length >= 3) ABUNDANCE_KEYS['f'] = ABUNDANCE_VALUES[2]; // Few
    if (ABUNDANCE_VALUES.length >= 4) ABUNDANCE_KEYS['m'] = ABUNDANCE_VALUES[3]; // Many
    if (ABUNDANCE_VALUES.length >= 5) ABUNDANCE_KEYS['a'] = ABUNDANCE_VALUES[4]; // Abundant

    // Set default lastNonZeroValue to first non-zero option
    if (ABUNDANCE_VALUES.length > 1) {
      lastNonZeroValue = ABUNDANCE_VALUES[1]; // Typically "Single"
    }

    return true;
  }

  // Find all fish data rows
  function findFishRows() {
    const rows = [];
    document.querySelectorAll("tr").forEach(row => {
      const hasNumber = row.querySelector("td.rfsp-col-number");
      const hasCount = row.querySelector("td.rfsp-col-count");
      if (hasNumber && hasCount) {
        rows.push(row);
      }
    });
    return rows;
  }

  // Get the select element from a row
  function getSelectFromRow(row) {
    if (!row) return null;
    const countTd = row.querySelector("td.rfsp-col-count");
    return countTd?.querySelector("select");
  }

  // Get the radio button group from a row
  function getRadioGroupFromRow(row) {
    if (!row) return null;
    const countTd = row.querySelector("td.rfsp-col-count");
    return countTd?.querySelectorAll("input[type='radio']");
  }

  // Set abundance value for a row
  function setAbundance(row, value) {
    const select = getSelectFromRow(row);
    if (!select) return false;

    const oldValue = select.value;
    select.value = value;
    select.dispatchEvent(new Event("change", { bubbles: true }));

    // Also update radio buttons if they exist
    const radios = getRadioGroupFromRow(row);
    if (radios) {
      radios.forEach(radio => {
        radio.checked = radio.value === value;
      });
    }

    // Track last non-zero value for spacebar toggle
    if (value !== "0") {
      lastNonZeroValue = value;
    }

    markRowAsCompleted(row, value);
    return true;
  }

  // Get current abundance value
  function getAbundance(row) {
    const select = getSelectFromRow(row);
    return select ? select.value : null;
  }

  // Highlight/unhighlight row
  function setActiveRow(index) {
    // Remove previous highlighting
    fishRows.forEach(row => row.classList.remove("rfsp-active-row"));

    currentRowIndex = index;
    if (index >= 0 && index < fishRows.length) {
      const row = fishRows[index];
      row.classList.add("rfsp-active-row");

      // Scroll into view if needed
      row.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }

  // Mark row as completed
  function markRowAsCompleted(row, value) {
    if (value && value !== "0") {
      row.classList.add("rfsp-completed-row");
    } else {
      row.classList.remove("rfsp-completed-row");
    }
  }

  // Update progress indicator - REMOVED
  function updateProgressIndicator() {
    // Status bar removed per user request
  }

  // Navigate to next row
  function moveToNextRow() {
    if (currentRowIndex < fishRows.length - 1) {
      setActiveRow(currentRowIndex + 1);
    }
  }

  // Navigate to previous row
  function moveToPreviousRow() {
    if (currentRowIndex > 0) {
      setActiveRow(currentRowIndex - 1);
    }
  }

  // Click-anywhere-on-row functionality
  function setupRowClickHandlers() {
    fishRows.forEach((row, index) => {
      // Single click: just select the row, don't change value
      row.addEventListener("click", (e) => {
        // Don't interfere with clicks on inputs, labels, or links
        if (e.target.matches("input, label, a, button, select")) return;
        if (e.target.closest(".rfsp-presence-wrap")) return;
        if (e.target.closest(".fish-inline-preview")) return;

        setActiveRow(index);
      });

      // Double click: cycle through abundance levels
      row.addEventListener("dblclick", (e) => {
        if (e.target.matches("input, label, a, button, select")) return;
        if (e.target.closest(".rfsp-presence-wrap")) return;
        if (e.target.closest(".fish-inline-preview")) return;

        e.preventDefault();

        const currentValue = getAbundance(row);
        const currentIndex = ABUNDANCE_VALUES.indexOf(currentValue);
        const nextIndex = (currentIndex + 1) % ABUNDANCE_VALUES.length;
        setAbundance(row, ABUNDANCE_VALUES[nextIndex]);
      });
    });
  }

  // Keyboard shortcuts
  function setupKeyboardShortcuts() {
    document.addEventListener("keydown", (e) => {
      // Don't interfere if user is typing in an input field
      if (e.target.matches("input[type='text'], input[type='number'], textarea, select")) {
        return;
      }

      // Number keys 0-4 and letter keys N,S,F,M,A for abundance
      const key = e.key.toLowerCase();
      if (ABUNDANCE_KEYS.hasOwnProperty(key) && currentRowIndex >= 0) {
        e.preventDefault();
        const row = fishRows[currentRowIndex];
        setAbundance(row, ABUNDANCE_KEYS[key]);
        return;
      }

      // Arrow keys for navigation
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (currentRowIndex === -1 && fishRows.length > 0) {
          setActiveRow(0);
        } else {
          moveToNextRow();
        }
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        if (currentRowIndex === -1 && fishRows.length > 0) {
          setActiveRow(fishRows.length - 1);
        } else {
          moveToPreviousRow();
        }
        return;
      }

      // Enter or Tab to advance after selection
      if ((e.key === "Enter" || e.key === "Tab") && currentRowIndex >= 0) {
        e.preventDefault();
        moveToNextRow();
        return;
      }

      // Spacebar to toggle
      if (e.key === " " && currentRowIndex >= 0) {
        e.preventDefault();
        const row = fishRows[currentRowIndex];
        const currentValue = getAbundance(row);

        if (currentValue === "0") {
          // Switch to last non-zero value
          setAbundance(row, lastNonZeroValue);
        } else {
          // Switch to None
          setAbundance(row, "0");
        }
        return;
      }
    });
  }

  // Inject CSS for visual feedback
  function injectUXStyles() {
    if (document.getElementById("rfsp-ux-styles")) return;

    const style = document.createElement("style");
    style.id = "rfsp-ux-styles";
    style.textContent = `
      /* Active row highlighting */
      tr.rfsp-active-row {
        background-color: #fff3cd !important;
        outline: 2px solid #ffc107;
        outline-offset: -2px;
      }

      /* Completed row styling */
      tr.rfsp-completed-row td {
        background-color: #e7f5e7 !important;
      }


      /* Make fish rows visually clickable */
      tr.rfsp-active-row,
      tr:has(td.rfsp-col-count) {
        cursor: pointer;
      }

      tr:has(td.rfsp-col-count):hover {
        background-color: #f8f9fa !important;
      }

      /* Don't apply hover to completed rows - keep their color */
      tr.rfsp-completed-row:hover td {
        background-color: #e7f5e7 !important;
      }

      /* Active row takes precedence over completed */
      tr.rfsp-active-row.rfsp-completed-row td {
        background-color: #fff3cd !important;
      }
    `;

    (document.head || document.documentElement).appendChild(style);
  }

  // Early exit: Check if we're on the login/landing page
  // Login page has specific characteristics we can detect immediately
  const isLoginPage = () => {
    // Check URL - login page is exactly /dataentry or /dataentry/ or /dataentry/index.php
    const path = window.location.pathname;
    if (path === '/dataentry' || path === '/dataentry/' || path === '/dataentry/index.php') {
      return true;
    }
    // Additional check: login page won't have fish survey forms
    const hasSelect = document.querySelector('select[name*="abundance"], select[name*="fish"]');
    const hasForm = document.querySelector('form[action*="survey"], form[action*="fish"]');
    // If we have a very simple page with no survey elements, likely login
    return !hasSelect && !hasForm && path.includes('/dataentry');
  };

  // Exit immediately if this is the login page
  if (isLoginPage()) {
    console.log("[REEF Suite - UX] Skipping on login page");
    return;
  }

  // Exit if this is an unlisted/addfish page (we don't want UX improvements there)
  if (isUnlistedPage) {
    console.log("[REEF Suite - UX] Skipping on unlisted page");
    return;
  }

  console.log("[REEF Suite - UX] Running UX improvements");

  // Check if we're on a fish data entry page
  let initAttempts = 0;
  const MAX_INIT_ATTEMPTS = 10; // Stop trying after 5 seconds

  // Initialize UX improvements
  function initialize() {
    initAttempts++;

    // Stop trying if we've attempted too many times
    if (initAttempts > MAX_INIT_ATTEMPTS) {
      return; // Silent exit, no logging
    }

    injectUXStyles();

    // Detect the actual abundance values from select dropdowns
    if (!detectAbundanceValues()) {
      // Try again after a short delay (in case DOM is still loading)
      setTimeout(initialize, 500);
      return;
    }

    // Find all fish rows
    fishRows = findFishRows();

    if (fishRows.length === 0) {
      // Try again after a short delay (in case DOM is still loading)
      setTimeout(initialize, 500);
      return;
    }

    // Mark already-completed rows
    fishRows.forEach(row => {
      const value = getAbundance(row);
      if (value && value !== "0") {
        markRowAsCompleted(row, value);
      }
    });

    // Setup handlers
    setupRowClickHandlers();
    setupKeyboardShortcuts();

    // Set first row as active by default
    if (fishRows.length > 0) {
      setActiveRow(0);
    }

    // Watch for changes to re-bind new rows
    const observer = new MutationObserver(() => {
      const newRows = findFishRows();
      if (newRows.length !== fishRows.length) {
        fishRows = newRows;
        setupRowClickHandlers();
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  // Start when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, { once: true });
  } else {
    initialize();
  }
})();
