// content-main.js — REEF DataEntry Suite Main Page (www.reef.org/dataentry)
// Navigation toolbar (Top/Bottom/Next/Save/Family menu) + data-entry iframe auto-fit.
// The site map lives in content-map.js.

(() => {
  if (window !== window.top) return;

  // ========================================
  // Navigation Toolbar + iframe auto-fit
  // ========================================

  if (/^https?:\/\/(?:www\.)?reef\.org\/dataentry(?:[\/?#]|$)/i.test(location.href)) {
    const NS = "rfsp";
    const HOST_ID = `${NS}-toolbar-host`;
    const STYLE_ID = `${NS}-style`;

    // Messages
    const MSG_CMD          = "rfsp-cmd";
    const MSG_PAGE         = "rfsp-page";
    const MSG_FAMS         = "rfsp-families";
    const MSG_FAM_SCROLLED = "rfsp-fam-scrolled";
    const MSG_FAM_MEASURED = "rfsp-fam-measured";
    const MSG_SIZE         = "rfsp-size";

    // Behavior
    const DESIRED_SCREEN_TOP = 60;
    const FAMILY_MAX_ADJUSTS = 3;

    const LOG = (...a) => console.log("[REEF Suite - Nav]", ...a);

    // Helpers
    const root = () => document.scrollingElement || document.documentElement || document.body;
    const isScrollable = (el) => !!el && ((el.scrollHeight || 0) - (el.clientHeight || 0) > 4);
    const getWinScroll = () => (window.scrollY || document.documentElement.scrollTop || 0);
    const setWinScroll = (y) => { try { window.scrollTo({ top: y, behavior: "smooth" }); } catch { window.scrollTo(0, y); } };

    function findIframe() {
      return document.querySelector(
        'iframe#iframe-field-iframe-0, iframe[name="iframe-field-iframe-0"], iframe[src*="://data.reef.org/dataentry"]'
      );
    }
    const explicitWrapper = () => document.querySelector(".field-iframe.field-iframe-instance");
    const getPrimaryScroller = () => {
      const wrap = explicitWrapper();
      return (wrap && isScrollable(wrap)) ? wrap : root();
    };

    function scrollContainerTo(scroller, y) {
      const isRootEl = (scroller === root() || scroller === document.documentElement || scroller === document.body);
      const max = Math.max(0, (scroller.scrollHeight || 0) - (scroller.clientHeight || 0));
      const target = Math.min(Math.max(0, y), max);
      if (isRootEl) setWinScroll(target);
      else if (scroller.scrollTo) scroller.scrollTo({ top: target, behavior: "smooth" });
      else scroller.scrollTop = target;
    }

    function commonNameOnly(label) {
      if (!label) return "";
      const trimmed = String(label).replace(/\s+/g, " ").trim();
      return trimmed.replace(/\s*\([^)]*\)\s*$/, "").trim();
    }

    // Family alignment
    let lastFamIndex = -1;
    let famAdjustsLeft = 0;

    function dataFrames() {
      return Array.from(document.querySelectorAll('iframe[src*="://data.reef.org/dataentry"]'));
    }
    function postToFrame(payload) {
      dataFrames().forEach(f => {
        try { f.contentWindow?.postMessage(payload, new URL(f.src, location.href).origin); } catch {}
      });
    }
    function requestFamilyList() { postToFrame({ ns: MSG_CMD, action: "FAMILY_LIST_REQ" }); }
    function askFrameScrollTo(index) {
      lastFamIndex = index;
      famAdjustsLeft = FAMILY_MAX_ADJUSTS;
      postToFrame({ ns: MSG_CMD, action: "FAMILY_SCROLL_TO_INDEX", index });
    }
    function askFrameMeasure(index) { postToFrame({ ns: MSG_CMD, action: "FAMILY_MEASURE_INDEX", index }); }

    function alignOnceWithClientTop(clientTop) {
      const ifr = findIframe(); if (!ifr) return true;
      const scroller = getPrimaryScroller();
      const onScreenNow = ifr.getBoundingClientRect().top + (clientTop || 0);
      const delta = onScreenNow - DESIRED_SCREEN_TOP;
      if (Math.abs(delta) < 2) return true;

      if (scroller === root() || scroller === document.documentElement || scroller === document.body) {
        setWinScroll(getWinScroll() + delta);
      } else {
        scroller.scrollTop = Math.min(
          Math.max(0, scroller.scrollTop + delta),
          Math.max(0, (scroller.scrollHeight || 0) - (scroller.clientHeight || 0))
        );
      }
      return false;
    }
    function handleFamScrolledOrMeasured(d) {
      const done = alignOnceWithClientTop(Number(d.clientTop) || 0);
      if (done) { famAdjustsLeft = 0; return; }
      if (famAdjustsLeft > 0) {
        famAdjustsLeft--;
        setTimeout(() => askFrameMeasure(lastFamIndex), 120);
      }
    }

    // Top / Bottom
    function doScroll(where) {
      const scroller = getPrimaryScroller();
      const max = Math.max(0, (scroller.scrollHeight || 0) - (scroller.clientHeight || 0));
      scrollContainerTo(scroller, where === "top" ? 0 : max);
    }

    let lastFamilies = [];
    function scrollToLastFamily() {
      if (lastFamilies.length) {
        askFrameScrollTo(lastFamilies.length - 1);
        return;
      }
      requestFamilyList();
      setTimeout(() => {
        if (lastFamilies.length) askFrameScrollTo(lastFamilies.length - 1);
        else doScroll("bottom");
      }, 300);
    }

    function postToDataFrames(action) {
      try {
        console.log("[REEF Suite] postToDataFrames:", action);
        postToFrame({ ns: MSG_CMD, action: action });
      } catch (err) {
        console.warn("[REEF Suite] postToDataFrames error:", err);
      }
    }

    // Toolbar (Shadow DOM)
    let hostRef = null, famMenu = null, famBtn = null;
    let hoverTimer = null, hoverMonitor = null;

    const setToolbarVisible = (v) => { if (hostRef) hostRef.style.display = v ? "block" : "none"; };

    function ensureToolbar() {
      let host = document.getElementById(HOST_ID);
      if (!host) {
        host = document.createElement("div");
        host.id = HOST_ID;
        Object.assign(host.style, {
          position: "fixed", right: "16px", bottom: "24px",
          zIndex: "2147483647", pointerEvents: "none", display: "none"
        });
        (document.body || document.documentElement).appendChild(host);
      }
      hostRef = host;

      const shadow = host.shadowRoot || host.attachShadow({ mode: "open" });
      if (!shadow.getElementById(STYLE_ID)) {
        const st = document.createElement("style"); st.id = STYLE_ID;
        st.textContent = `
          :host{ all:initial; }
          .wrap{ display:flex; flex-direction:column; gap:10px; pointer-events:none; }
          .col{ display:flex; flex-direction:column; gap:10px; align-items:stretch; pointer-events:auto; }

          .btn{
            font-family: system-ui,-apple-system, Segoe UI, Roboto, Arial, sans-serif;
            font-size:14px; padding:8px 12px; border-radius:999px;
            border:1px solid rgba(0,0,0,.15); background:#fff; color:#111;
            box-shadow:0 6px 18px rgba(0,0,0,.18);
            cursor:pointer; user-select:none; white-space:nowrap;
          }
          .btn:hover{ transform:translateY(-1px); box-shadow:0 8px 22px rgba(0,0,0,.22); }
          .btn:active{ transform:translateY(0); box-shadow:0 4px 12px rgba(0,0,0,.20); }

          :host{ --rfsp-menu-top: 60px; --rfsp-menu-bottom: 24px; }
          .famwrap{ position:relative; width:100%; pointer-events:auto; }
          .fambtn{ font-weight:600; text-align:left; width:100%; }
          .caret{ margin-left:6px; font-size:12px; opacity:.65; float:right; }

          .fammenu{
            display:none;
            position:fixed;
            top:var(--rfsp-menu-top); bottom:var(--rfsp-menu-bottom);
            background:#fff; color:#111; border:1px solid rgba(0,0,0,.15);
            border-radius:12px; padding:6px; box-shadow:0 10px 24px rgba(0,0,0,.22);
            overflow:auto; z-index:2147483646;
            flex-direction:column; gap:2px;
          }
          .fammenu.open{ display:flex; }

          .famitem{
            display:block; width:100%; text-align:left;
            background:transparent; border:none; padding:8px 10px; border-radius:8px;
            font:inherit; color:inherit; cursor:pointer; line-height:1.2;
          }
          .famitem:hover{ background:#f0f0f0; }

          @media (prefers-color-scheme: dark){
            .btn{ background:#fff; color:#111; border-color:rgba(0,0,0,.2); }
            .fammenu{ background:#fff; color:#111; border-color:rgba(0,0,0,.2); }
            .famitem:hover{ background:#e9e9e9; }
          }
        `;
        shadow.appendChild(st);
      }

      if (!shadow.querySelector(".wrap")) {
        const wrap = document.createElement("div"); wrap.className = "wrap";
        const col = document.createElement("div"); col.className = "col";

        // Family control
        const fw = document.createElement("div"); fw.className = "famwrap";
        const btn = document.createElement("button"); btn.type="button"; btn.className="btn fambtn"; btn.textContent="Family";
        const caret = document.createElement("span"); caret.className="caret"; caret.textContent="▾";
        btn.appendChild(caret);

        const menu = document.createElement("div"); menu.className = "fammenu";

        menu.addEventListener("mousedown", (e) => {
          const item = e.target.closest(".famitem");
          if (!item) return;
          const idx = Number(item.dataset.index);
          if (!isNaN(idx)) askFrameScrollTo(idx);
          closeMenu(menu);
        });

        const openNow = () => { clearTimeout(hoverTimer); positionMenu(menu, btn); menu.classList.add("open"); startHoverMonitor(menu, btn); };
        const closeSoon = () => { clearTimeout(hoverTimer); hoverTimer = setTimeout(() => closeMenu(menu), 140); };
        btn.addEventListener("mouseenter", openNow);
        btn.addEventListener("mouseleave", closeSoon);
        menu.addEventListener("mouseenter", openNow);
        menu.addEventListener("mouseleave", closeSoon);
        btn.addEventListener("focus", openNow);
        btn.addEventListener("blur", closeSoon);

        window.addEventListener("keydown", (e)=>{ if (e.key === "Escape") closeMenu(menu); }, { passive:true });
        window.addEventListener("scroll",  ()=>{ if (menu.classList.contains("open")) positionMenu(menu, btn); }, { passive:true });
        window.addEventListener("resize",  ()=>{ if (menu.classList.contains("open")) positionMenu(menu, btn); }, { passive:true });
        window.addEventListener("pointerdown", (e)=>{
          if (!menu.classList.contains("open")) return;
          const path = e.composedPath ? e.composedPath() : [];
          if (!path.includes(host)) closeMenu(menu);
        }, true);

        fw.appendChild(btn);
        fw.appendChild(menu);
        col.appendChild(fw);

        const mk = (t, fn) => { const b=document.createElement("button"); b.className="btn"; b.textContent=t; b.onclick=(e)=>{e.preventDefault(); fn();}; return b; };
        col.appendChild(mk("Top", () => doScroll("top")));
        col.appendChild(mk("Bottom", () => scrollToLastFamily()));
        col.appendChild(mk("Next", () => postToDataFrames("NEXT")));
        col.appendChild(mk("Save", () => postToDataFrames("SAVE")));

        wrap.appendChild(col);
        shadow.appendChild(wrap);

        hostRef = host;
        famMenu  = menu;
        famBtn   = btn;

        LOG("toolbar added");
      }
    }

    function positionMenu(menu, btn){
      const vw = window.innerWidth, topGap = 60, bottomGap = 24, sideGap = 8, gap = 12;
      const rect = btn.getBoundingClientRect();

      const minW = 260, maxW = 520;
      let width = Math.min(maxW, Math.max(minW, Math.round(vw * 0.3)));

      const availLeft = rect.left - gap - sideGap;
      if (width > availLeft) width = Math.max(180, Math.min(maxW, availLeft));

      let left = Math.max(sideGap, rect.left - gap - width);
      if (left + width > vw - sideGap) left = vw - sideGap - width;
      if (left < sideGap) left = sideGap;

      menu.style.left   = `${left}px`;
      menu.style.right  = "auto";
      menu.style.top    = `${topGap}px`;
      menu.style.bottom = `${bottomGap}px`;
      menu.style.width  = `${width}px`;
    }

    function closeMenu(menu){
      menu.classList.remove("open");
      stopHoverMonitor();
    }
    function startHoverMonitor(menu, btn){
      if (hoverMonitor) return;
      hoverMonitor = setInterval(() => {
        if (!menu.classList.contains("open")) { stopHoverMonitor(); return; }
        if (!menu.matches(":hover") && !btn.matches(":hover")) closeMenu(menu);
      }, 180);
    }
    function stopHoverMonitor(){
      if (hoverMonitor) { clearInterval(hoverMonitor); hoverMonitor = null; }
    }

    function populateMenu(list) {
      lastFamilies = Array.isArray(list) ? list : [];
      if (!famMenu) return;
      famMenu.innerHTML = "";
      lastFamilies.forEach((f, i) => {
        const it = document.createElement("button");
        it.type = "button";
        it.className = "famitem";
        it.dataset.index = String(i);
        it.textContent = commonNameOnly(f.name || "");
        famMenu.appendChild(it);
      });
    }

    // ---- iframe auto-fit -------------------------------------------------
    // The data-entry page is an iframe from data.reef.org with a fixed height,
    // so long pages (unlisted species, big families) scroll inside the inset.
    // content-frame.js reports its content height; we grow the iframe to match
    // so the whole page scrolls as one.
    let autoFitFrame = true;
    const FIT_MIN_PX = 200, FIT_MAX_PX = 40000;

    function frameForEvent(ev) {
      return dataFrames().find(f => f.contentWindow === ev.source) || findIframe();
    }
    function relaxWrapper(ifr) {
      // REEF wraps the iframe in a fixed-height scroll box; let it grow.
      let el = ifr.parentElement;
      for (let i = 0; el && i < 3; i++) {
        if (el.matches(".field-iframe, .field-iframe-instance") || isScrollable(el)) {
          el.style.setProperty("height", "auto", "important");
          el.style.setProperty("max-height", "none", "important");
          el.style.setProperty("overflow", "visible", "important");
        }
        el = el.parentElement;
      }
    }
    function applyFrameHeight(ifr, h) {
      if (!ifr || !Number.isFinite(h)) return;
      h = Math.min(FIT_MAX_PX, Math.max(FIT_MIN_PX, Math.ceil(h)));
      // Guard against feedback loops (content that grows with the frame):
      // ignore a run of ever-increasing reports arriving in quick succession.
      const now = Date.now();
      const st = ifr.__rfspFit || (ifr.__rfspFit = { last: 0, grows: 0, at: 0 });
      if (now - st.at > 2000) st.grows = 0;
      if (h > st.last) st.grows++; else st.grows = 0;
      st.at = now;
      if (st.grows > 6) return;
      if (Math.abs(h - st.last) < 2) return;
      st.last = h;

      relaxWrapper(ifr);
      ifr.setAttribute("scrolling", "no");
      ifr.style.setProperty("height", h + "px", "important");
      ifr.style.setProperty("min-height", h + "px", "important");
      ifr.style.setProperty("max-height", "none", "important");
      ifr.style.setProperty("overflow", "hidden", "important");
      ifr.style.setProperty("width", "100%", "important");
    }
    function resetFrameHeight(ifr) {
      if (!ifr) return;
      ifr.__rfspFit = null;
      ["height","min-height","max-height","overflow","width"].forEach(p => ifr.style.removeProperty(p));
      ifr.removeAttribute("scrolling");
      let el = ifr.parentElement;
      for (let i = 0; el && i < 3; i++) {
        ["height","max-height","overflow"].forEach(p => el.style.removeProperty(p));
        el = el.parentElement;
      }
    }

    try {
      chrome.storage.sync.get({ autoFitFrame: true }, (items) => {
        autoFitFrame = items.autoFitFrame !== false;
        if (autoFitFrame) postToFrame({ ns: MSG_CMD, action: "SIZE_REQ" });
      });
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== "sync" || !("autoFitFrame" in changes)) return;
        autoFitFrame = changes.autoFitFrame.newValue !== false;
        if (autoFitFrame) postToFrame({ ns: MSG_CMD, action: "SIZE_REQ" });
        else dataFrames().forEach(resetFrameHeight);
      });
    } catch {}

    // ---- messages from the frame ------------------------------------------
    const FRAME_ORIGIN_RE = /^https:\/\/([a-z0-9-]+\.)*data\.reef\.org$/i;

    function handleMessage(ev) {
      const d = ev?.data;
      if (!d || typeof d !== "object") return;
      if (!FRAME_ORIGIN_RE.test(ev.origin || "")) return;

      if (d.ns === MSG_PAGE) {
        const listed = /\/listedfish\.php(?:[?#]|$)/i.test(d.path || d.href || "");
        setToolbarVisible(!!listed);
        if (listed) requestFamilyList();
        return;
      }

      if (d.ns === MSG_FAMS) {
        populateMenu(d.families || []);
        return;
      }

      if (d.ns === MSG_FAM_SCROLLED || d.ns === MSG_FAM_MEASURED) {
        handleFamScrolledOrMeasured(d);
        return;
      }

      if (d.ns === MSG_SIZE) {
        if (autoFitFrame) applyFrameHeight(frameForEvent(ev), Number(d.height));
        return;
      }
    }

    function initToolbar() {
      ensureToolbar();
      window.addEventListener("message", handleMessage, false);
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initToolbar, { once:true });
    else initToolbar();
  }
})();
