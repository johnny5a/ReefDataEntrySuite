// content.js — RFSP Map inset with Near Me tab, mouse-centered zoom, dblclick zoom, active pin styling
// v3.21  — adds "Show on map only" toggle and defaults radius to 25 mi
(function () {
  "use strict";

  // ---------- utils ----------
  function log() { try { console.log.apply(console, ["[RFSP map]"].concat([].slice.call(arguments))); } catch (_) {} }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const mod = (n, m) => ((n % m) + m) % m;
  const escapeHtml = (s)=>String(s||"").replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));
  const mi = (n)=>Number(n).toFixed(1);

  // Haversine (miles)
  function distMiles(a, b){
    const R = 3958.7613;
    const toRad = (x)=>x*Math.PI/180;
    const dLat = toRad(b[0]-a[0]);
    const dLon = toRad(b[1]-a[1]);
    const la1 = toRad(a[0]);
    const la2 = toRad(b[0]);
    const h = Math.sin(dLat/2)**2 + Math.cos(la1)*Math.cos(la2)*Math.sin(dLon/2)**2;
    return 2*R*Math.asin(Math.sqrt(h));
  }

  // ---------- micro tile map ----------
  function MicroMap(container, opts) {
    this._container = container;
    this._zoom = (opts && opts.zoom) || 2;
    this._center = (opts && opts.center) || [0, 0];
    this._tilePane = document.createElement("div"); this._tilePane.id = "rfsp-tile-pane";
    this._markerPane = document.createElement("div"); this._markerPane.id = "rfsp-marker-pane";
    container.appendChild(this._tilePane); container.appendChild(this._markerPane);
    this._bindWheel(); this._bindResize(); this._bindDrag(); this._bindDblClick(); this._render();
  }
  // mouse-centered wheel zoom
  MicroMap.prototype._projectAt = function (latlng, zoom) {
    const d = Math.PI / 180, n = Math.pow(2, zoom), s = 256 * n;
    const x = ((latlng[1] + 180) / 360) * s;
    const y = ((1 - Math.log(Math.tan(Math.PI / 4 + (latlng[0] * d) / 2)) / Math.PI) / 2) * s;
    return [x, y];
  };
  MicroMap.prototype._unprojectAt = function (px, zoom) {
    const s = 256 * Math.pow(2, zoom);
    const lon = (px[0] / s) * 360 - 180;
    const lat = (2 * Math.atan(Math.exp((1 - (px[1] / s) * 2) * Math.PI)) - Math.PI / 2) * (180 / Math.PI);
    return [lat, lon];
  };
  MicroMap.prototype._bindWheel = function () {
    const self = this; let last = 0;
    this._container.addEventListener("wheel", function (e) {
      e.preventDefault();
      const now = Date.now(); if (now - last < 120) return; last = now;
      const dir = e.deltaY < 0 ? 1 : -1;
      const newZoom = clamp(self._zoom + dir, 1, 19);
      if (newZoom === self._zoom) return;

      const rect = self._container.getBoundingClientRect();
      const localX = e.clientX - rect.left, localY = e.clientY - rect.top;
      const tl = self._viewTL || [0, 0];
      const worldPxAtMouse_Current = [tl[0] + localX, tl[1] + localY];
      const latlngAtMouse = self._unprojectAt(worldPxAtMouse_Current, self._zoom);
      const worldPxAtMouse_New = self._projectAt(latlngAtMouse, newZoom);
      const newTopLeft = [worldPxAtMouse_New[0] - localX, worldPxAtMouse_New[1] - localY];
      const w = self._container.clientWidth || 0, h = self._container.clientHeight || 0;
      const newCenterPx = [newTopLeft[0] + w/2, newTopLeft[1] + h/2];
      const newCenterLatLng = self._unprojectAt(newCenterPx, newZoom);

      self._zoom = newZoom; self._center = newCenterLatLng; self._render();
    }, { passive: false });
  };
  MicroMap.prototype._bindResize = function () { const ro = new ResizeObserver(() => this._render()); ro.observe(this._container); this._ro = ro; };
  MicroMap.prototype._bindDrag = function () {
    let drag = null;
    const onDown = (e) => { drag = { x: e.clientX, y: e.clientY, startPx: this._project(this._center) };
      this._container.style.cursor = "grabbing"; window.addEventListener("mousemove", onMove); window.addEventListener("mouseup", onUp); e.preventDefault(); };
    const onMove = (e) => { if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      const newPx = [drag.startPx[0] - dx, drag.startPx[1] - dy]; this.panTo(this._unproject(newPx)); };
    const onUp = () => { drag = null; this._container.style.cursor = "grab"; window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
    this._container.style.cursor = "grab"; this._container.addEventListener("mousedown", onDown); this._container.addEventListener("mouseleave", onUp);
  };
  MicroMap.prototype._bindDblClick = function () {
    const self = this;
    this._container.addEventListener("dblclick", function (e) {
      e.preventDefault();
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const marker = (el && el.classList && el.classList.contains("rfsp-marker")) ? el :
                     (el && el.closest ? el.closest(".rfsp-marker") : null);
      if (marker) {
        const lat = parseFloat(marker.dataset.lat), lng = parseFloat(marker.dataset.lng);
        if (Number.isFinite(lat) && Number.isFinite(lng)) { self.panTo([lat, lng]); self.setZoom(self._zoom + 1); return; }
      }
      const rect = self._container.getBoundingClientRect();
      const localX = e.clientX - rect.left, localY = e.clientY - rect.top;
      const tl = self._viewTL || [0, 0];
      const worldPx = [tl[0] + localX, tl[1] + localY];
      const latlng = self._unprojectAt(worldPx, self._zoom);
      self.panTo(latlng); self.setZoom(self._zoom + 1);
    }, { passive: false });
  };
  MicroMap.prototype._worldSize = function () { return 256 * Math.pow(2, this._zoom); };
  MicroMap.prototype._project = function (latlng) {
    const d = Math.PI / 180, n = Math.pow(2, this._zoom), s = 256 * n;
    const x = ((latlng[1] + 180) / 360) * s;
    const y = ((1 - Math.log(Math.tan(Math.PI / 4 + (latlng[0] * d) / 2)) / Math.PI) / 2) * s;
    return [x, y];
  };
  MicroMap.prototype._unproject = function (px) {
    const s = this._worldSize();
    const lon = (px[0] / s) * 360 - 180;
    const lat = (2 * Math.atan(Math.exp((1 - (px[1] / s) * 2) * Math.PI)) - Math.PI / 2) * (180 / Math.PI);
    return [lat, lon];
  };
  MicroMap.prototype.setZoom = function (z) { this._zoom = clamp(z, 1, 19); this._render(); };
  MicroMap.prototype.panTo  = function (center) { this._center = center; this._render(); };
  MicroMap.prototype.setMarkers = function (arr) { this._markers = Array.isArray(arr) ? arr.slice() : []; this._renderMarkers(); };
  MicroMap.prototype._render = function () {
    const w = this._container.clientWidth || 0, h = this._container.clientHeight || 0;
    if (!w || !h) return;
    const centerPx = this._project(this._center), topLeftPx = [centerPx[0] - w / 2, centerPx[1] - h / 2];
    const x0 = Math.floor(topLeftPx[0] / 256), y0 = Math.floor(topLeftPx[1] / 256);
    const x1 = Math.floor((topLeftPx[0] + w) / 256), y1 = Math.floor((topLeftPx[1] + h) / 256);
    this._tilePane.innerHTML = "";
    const maxIndex = Math.pow(2, this._zoom) - 1;
    for (let ty = y0; ty <= y1; ty++) {
      const clampedY = clamp(ty, 0, maxIndex);
      for (let tx = x0; tx <= x1; tx++) {
        const wrappedX = mod(tx, maxIndex + 1);
        const img = new Image(); img.draggable = false;
        img.src = `https://tile.openstreetmap.org/${this._zoom}/${wrappedX}/${clampedY}.png`;
        img.style.position = "absolute";
        img.style.left = (tx * 256 - topLeftPx[0]) + "px";
        img.style.top  = (ty * 256 - topLeftPx[1]) + "px";
        img.width = 256; img.height = 256;
        this._tilePane.appendChild(img);
      }
    }
    this._viewTL = topLeftPx; this._renderMarkers();
  };
  MicroMap.prototype._renderMarkers = function () {
    if (!this._markers) return;
    const w = this._container.clientWidth || 0, h = this._container.clientHeight || 0, tl = this._viewTL || [0,0];
    this._markerPane.innerHTML = "";
    this._markers.forEach((m) => {
      const p = this._project(m.latlng), x = p[0] - tl[0], y = p[1] - tl[1];
      if (x > -24 && y > -24 && x < w + 24 && y < h + 24) {
        const el = document.createElement("div");
        el.className = "rfsp-marker";
        el.style.left = x + "px"; el.style.top = y + "px";
        el.title = m.title || "";
        el.dataset.zonecode = m.zonecode || "";
        el.dataset.title = m.title || "";
        el.dataset.lat = String(m.latlng[0]); el.dataset.lng = String(m.latlng[1]);
        defaultMarkerStyle(el);
        if (activeZone && activeZone === el.dataset.zonecode) activeMarkerStyle(el);
        this._markerPane.appendChild(el);
      }
    });
  };

  // ---------- app wiring ----------
  const RESULTS_ID = "results", REGION_SELECT = 'select[name="region"]';
  let map, mapEl, cardEl, mapWrap, listWrap, lastHash = "";
  let latestPlusList = []; // all sites (zonecode+name)
  let zoneToLatLng = new Map();  // zonecode -> [lat, lng]
  let activeZone = null;         // currently selected zonecode
  let activeTab = "nogps";       // "nogps" | "all" | "near"
  let userLoc = null;            // [lat,lng] once granted
  let radiusMi = 25;             // default radius
  let showNearMapOnly = false;   // NEW: filter map markers in Near me tab

  function isResultsPopulated() {
    const r = document.getElementById(RESULTS_ID);
    if (!r) return false;
    if (r.children && r.children.length > 0) return true;
    return ((r.textContent || "").trim().length > 0);
  }

  function ensureCard() {
    if (cardEl && document.body.contains(cardEl)) return cardEl;

    // Card container
    cardEl = document.createElement("div"); cardEl.id = "rfsp-map-inset-card";
    cardEl.style.margin = "24px 0 8px";
    cardEl.style.border = "1px solid #9aa0a6";
    cardEl.style.borderRadius = "8px";
    cardEl.style.background = "#fafafa";
    cardEl.style.padding = "8px";
    cardEl.style.fontFamily = 'system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif';

    const title = document.createElement("div"); title.id = "rfsp-map-inset-title";
    title.textContent = "Map of matching sites";
    title.style.fontWeight = "600"; title.style.margin = "0 0 6px 0"; title.style.fontSize = "14px";

    // Flex layout
    const flex = document.createElement("div");
    flex.style.display = "flex"; flex.style.gap = "10px"; flex.style.alignItems = "stretch"; flex.style.flexWrap = "wrap";

    // Map wrapper
    mapWrap = document.createElement("div"); mapWrap.style.flex = "2 1 480px"; mapWrap.style.minWidth = "320px"; mapWrap.style.position = "relative";
    mapEl = document.createElement("div"); mapEl.id = "rfsp-map";
    mapEl.style.position = "relative"; mapEl.style.width = "100%"; mapEl.style.height = "35vh";
    mapEl.style.borderRadius = "6px"; mapEl.style.background = "#ddd"; mapEl.style.overflow = "hidden";

    const ctrls = document.createElement("div"); ctrls.id = "rfsp-map-controls";
    ctrls.style.position = "absolute"; ctrls.style.right = "10px"; ctrls.style.top = "10px";
    ctrls.style.display = "flex"; ctrls.style.flexDirection = "column"; ctrls.style.gap = "6px"; ctrls.style.zIndex = "1000";
    const mkBtn = (txt, title) => { const b = document.createElement("button"); b.className = "rfsp-btn"; b.textContent = txt; b.title = title; b.type="button";
      b.style.border = "1px solid #9aa0a6"; b.style.background = "#fff"; b.style.borderRadius = "6px"; b.style.padding = "6px 8px";
      b.style.font = '13px system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif'; b.style.cursor = "pointer"; b.style.userSelect = "none";
      b.style.boxShadow = "0 1px 2px rgba(0,0,0,.08)"; return b; };
    const btnPlus  = mkBtn("+", "Zoom in");  btnPlus.addEventListener("click", () => map && map.setZoom(map._zoom + 1));
    const btnMinus = mkBtn("−", "Zoom out"); btnMinus.addEventListener("click", () => map && map.setZoom(map._zoom - 1));
    const btnFit   = mkBtn("Fit", "Fit to markers"); btnFit.addEventListener("click", () => { try {
      const pts = (map && map._markers && map._markers.map(m => ({ lat: m.latlng[0], lng: m.latlng[1] }))) || collectPoints().withGPS;
      if (pts && pts.length) fitBounds(pts);
    } catch(e){ log("Fit failed", e);} });
    const btnRefresh = mkBtn("↻", "Refresh map");
    btnRefresh.addEventListener("click", () => forceRefresh({ fit: true, clearSelected: true }));
    ctrls.append(btnPlus, btnMinus, btnFit, btnRefresh);

    
    mapEl.appendChild(ctrls); mapWrap.appendChild(mapEl);

    // Sidebar with tabs
    listWrap = document.createElement("div"); listWrap.style.flex = "1 1 300px"; listWrap.style.minWidth = "240px";
    listWrap.style.border = "1px solid #e0e0e0"; listWrap.style.borderRadius = "6px"; listWrap.style.background = "#fff";
    listWrap.style.display = "flex"; listWrap.style.flexDirection = "column"; listWrap.style.maxHeight = "35vh";

    const tabs = document.createElement("div"); tabs.id = "rfsp-tabs";
    tabs.style.display = "flex"; tabs.style.borderBottom = "1px solid #e5e7eb";

    const tabBtn = (id, label, active) => {
      const b = document.createElement("button");
      b.id = id; b.textContent = label; b.type = "button";
      b.style.flex = "1"; b.style.padding = "10px 12px";
      b.style.font = '12px system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif';
      b.style.cursor = "pointer"; b.style.border = "0"; b.style.transition = "all .12s ease";
      setTabActiveStyles(b, !!active);
      b.addEventListener("click", () => activateTab(b.id));
      return b;
    };
    const tabNoGPS = tabBtn("rfsp-tab-nogps", "No GPS", true);
    const tabAll   = tabBtn("rfsp-tab-all",   "All (A–Z)", false);
    const tabNear  = tabBtn("rfsp-tab-near",  "Near me", false);
    tabs.appendChild(tabNoGPS); tabs.appendChild(tabAll); tabs.appendChild(tabNear);

    const listBody = document.createElement("div");
    listBody.id = "rfsp-tab-body";
    listBody.style.flex = "1"; listBody.style.overflow = "auto"; listBody.style.padding = "6px 8px";
    listBody.innerHTML = `<div id="rfsp-nogps-body" style="font-size:12px;color:#444">None</div>`;

    listWrap.appendChild(tabs); listWrap.appendChild(listBody);

    const legend = document.createElement("div"); legend.id = "rfsp-map-legend";
    legend.style.fontSize = "12px"; legend.style.marginTop = "6px"; legend.style.color = "#444";

    const flex2 = document.createElement("div");
    flex2.style.display = "flex"; flex2.style.gap = "10px"; flex2.style.alignItems = "stretch"; flex2.style.flexWrap = "wrap";
    flex2.appendChild(mapWrap); flex2.appendChild(listWrap);

    cardEl.append(title, flex2, legend);
    document.body.appendChild(cardEl);

    try { map = new MicroMap(mapEl, { center: [0, 0], zoom: 2 }); } catch (e) { log("Map init failed", e); }

    // Delegated events
    bindDelegatedEvents();   // markers (hover/click)
    bindListDelegation();    // table clicks (all tabs)
    return cardEl;
  }

  function setTabActiveStyles(tabEl, isActive){
    if (!tabEl) return;
    if (isActive) {
      tabEl.style.background = "#eef2ff";
      tabEl.style.fontWeight = "700";
      tabEl.style.color = "#1e40af";
      tabEl.style.borderBottom = "3px solid #2563eb";
      tabEl.style.boxShadow = "inset 0 -1px 0 rgba(0,0,0,.04)";
      tabEl.setAttribute("aria-selected","true");
    } else {
      tabEl.style.background = "#fff";
      tabEl.style.fontWeight = "500";
      tabEl.style.color = "#374151";
      tabEl.style.borderBottom = "3px solid transparent";
      tabEl.style.boxShadow = "none";
      tabEl.setAttribute("aria-selected","false");
    }
  }

  function showCard(show) { if (cardEl) cardEl.style.display = show ? "" : "none"; }

  function dedupeCoords(arr) {
    const seen = new Set(), out = [];
    for (const p of arr) { const k = `${(+p.lat).toFixed(5)},${(+p.lng).toFixed(5)}`; if (!seen.has(k)) { seen.add(k); out.push(p); } }
    return out;
  }

  function fitBounds(points) {
    if (!points.length) return;
    let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
    for (const p of points) { minLat = Math.min(minLat, p.lat); maxLat = Math.max(maxLat, p.lat); minLng = Math.min(minLng, p.lng); maxLng = Math.max(maxLng, p.lng); }
    const center = [(minLat + maxLat) / 2, (minLng + maxLng) / 2];
    map && map.panTo(center);
    const span = Math.max(maxLat - minLat, maxLng - minLng);
    let z = 2;
    if (span < 60) z = 3; if (span < 30) z = 4; if (span < 15) z = 5; if (span < 8) z = 6; if (span < 4) z = 7;
    if (span < 2) z = 8; if (span < 1) z = 9; if (span < 0.5) z = 10; if (span < 0.25) z = 11; if (span < 0.12) z = 12;
    map && map.setZoom(z);
  }
function forceRefresh(options) {
  const opt = Object.assign({ fit: true, clearSelected: false }, options || {});
  if (!map) return;

  if (opt.clearSelected) {
    clearActiveSelection();
  }

  const { withGPS } = collectPoints();

  // respect Near me → Show on map only
  let displayMarkers = withGPS;
  if (activeTab === "near" && showNearMapOnly && userLoc) {
    displayMarkers = withGPS.filter(p => distMiles(userLoc, [p.lat, p.lng]) <= radiusMi);
  }
  if (activeZone) {
    const visibleZones = new Set(displayMarkers.map(p => String(p.zonecode || "")));
    if (!visibleZones.has(String(activeZone))) {
      clearActiveSelectionAndField();
    }
  }

  map.setMarkers(displayMarkers.map(p => ({
    latlng: [p.lat, p.lng],
    title: p.title,
    zonecode: p.zonecode || ""
  })));

  zoneToLatLng = new Map(withGPS.map(p => [String(p.zonecode), [p.lat, p.lng]]));

  if (displayMarkers.length && opt.fit) fitBounds(displayMarkers);

  lastHash = ""; // ensure next render repaints
  render();
}


  // ---- parsing ----
  function parsePlusLinks(root) {
    const items = [];
    root.querySelectorAll('a[onclick*="changeZone("]').forEach(a => {
      try {
        const oc = a.getAttribute("onclick") || "";
        const m = oc.match(/changeZone\(\s*'([^']+)'\s*,\s*'([^']*)'\s*\)/i);
        if (m) {
          const zonecode = m[1];
          const encodedName = m[2] || "";
          const name = decodeURIComponent(encodedName);
          items.push({ zonecode, name });
        }
      } catch (_) {}
    });
    const seen = new Set(); return items.filter(it => !seen.has(it.zonecode) && seen.add(it.zonecode));
  }
  function parsePointsFrom(root) {
    const points = [];
    // window.open('...lat=..&lon=..')
    root.querySelectorAll("a[onclick]").forEach((a) => {
      try {
        const oc = a.getAttribute("onclick") || "";
        const m = oc.match(/window\.open\s*\(\s*['"]([^'"]+)['"]/i);
        let urlStr = m ? m[1] : "";
        if (urlStr) {
          urlStr = urlStr.replace(/&amp;/g, "&");
          const u = new URL(urlStr, location.origin);
          const latU = u.searchParams.get("lat") || u.searchParams.get("latitude");
          const lngU = u.searchParams.get("lon") || u.searchParams.get("lng") || u.searchParams.get("longitude");
          const zoneU = u.searchParams.get("zonecode") || u.searchParams.get("zone") || u.searchParams.get("id") || "";
          const nameU = u.searchParams.get("name");
          const titleTxt = (a.textContent || "").trim();
          const siteName = nameU ? decodeURIComponent(nameU) : titleTxt;
          if (latU != null && lngU != null) {
            const lat = parseFloat(latU), lng = parseFloat(lngU);
            if (Number.isFinite(lat) && Number.isFinite(lng)) points.push({ lat, lng, title: siteName.slice(0,80), zonecode: String(zoneU) });
          }
        }
      } catch (_) {}
    });
    // href with lat/lon
    root.querySelectorAll("a[href]").forEach((a) => {
      try {
        const href = a.getAttribute("href") || "";
        if (!href || href === "javascript:" || href.startsWith("javascript")) return;
        const u = new URL(href, location.origin);
        const lat = parseFloat(u.searchParams.get("lat") || u.searchParams.get("latitude"));
        const lng = parseFloat(u.searchParams.get("lon") || u.searchParams.get("lng") || u.searchParams.get("longitude"));
        const zoneU = u.searchParams.get("zonecode") || u.searchParams.get("zone") || u.searchParams.get("id") || "";
        const nameU = u.searchParams.get("name");
        const titleTxt = (a.textContent || "").trim();
        const siteName = nameU ? decodeURIComponent(nameU) : titleTxt;
        if (Number.isFinite(lat) && Number.isFinite(lng)) points.push({ lat, lng, title: siteName.slice(0,80), zonecode: String(zoneU) });
      } catch (_) {}
    });
    return dedupeCoords(points);
  }
  function collectPoints() {
    const results = document.getElementById(RESULTS_ID);
    const withGPS  = results ? parsePointsFrom(results) : [];
    const plusList = results ? parsePlusLinks(results) : [];
    latestPlusList = plusList;
    const gpsSet = new Set(withGPS.map(p => p.zonecode));
    const noGPS  = plusList.filter(item => !gpsSet.has(item.zonecode));
    return { withGPS, noGPS, allSites: plusList, gpsSet };
  }

  // ---- changeZone triggers (shared) ----
  function clickPlus(zonecode) {
    try {
      const results = document.getElementById(RESULTS_ID);
      if (!results) return false;
      const links = results.querySelectorAll('a[onclick*="changeZone("]');
      for (const a of links) {
        const oc = String(a.getAttribute("onclick") || "");
        if (oc.indexOf("changeZone('" + zonecode + "'") !== -1) {
          // Try to call changeZone directly instead of clicking (avoids CSP issues)
          try {
            const match = oc.match(/changeZone\(\s*'([^']+)'\s*,\s*'([^']*)'\s*\)/);
            if (match && typeof window.changeZone === 'function') {
              window.changeZone(match[1], decodeURIComponent(match[2] || ''));
              log("used: clickPlus (direct call)");
              return true;
            }
          } catch (e) {
            log("Direct call failed, trying click:", e);
          }
          // Fallback to clicking if direct call doesn't work
          a.click();
          log("used: clickPlus (click)");
          return true;
        }
      }
      return false;
    } catch (_) { return false; }
  }
  // Removed: CSP-violating javascript: URL methods
  // function jsLocationChange(zonecode, name) {...}
  // function tempInlineCall(zonecode, name) {...}

  function fallbackSet(zonecode, name) {
    try {
      const z = document.getElementById("zonecode") || document.querySelector('input[name="zonecode"]');
      if (z) { z.value = zonecode; z.dispatchEvent(new Event("input", { bubbles: true })); z.dispatchEvent(new Event("change", { bubbles: true })); }
      const g = document.getElementById("geog"); if (g) g.textContent = name || ""; // Changed from innerHTML to textContent
      log("used: fallbackSet");
    } catch (_) {}
  }
  function triggerChangeZone(zonecode, name) {
    let done = false;
    if (zonecode) done = clickPlus(zonecode);
    // Removed CSP-violating methods, jump straight to safe fallback
    if (!done) fallbackSet(zonecode, name);
  }

  // ---- marker styles & active pin helpers ----
  function defaultMarkerStyle(el){
    el.style.width = "18px"; el.style.height = "18px"; el.style.borderRadius = "50%";
    el.style.background = "#2563eb"; el.style.boxShadow = "0 0 0 2px #fff";
    el.style.transform = "translate(-9px,-9px)"; el.style.zIndex = "";
  }
  function clearActiveSelection() {
  // remove active styling from any marker
  const pane = document.getElementById("rfsp-marker-pane");
  if (pane) {
    pane.querySelectorAll(".rfsp-marker").forEach((m) => defaultMarkerStyle(m));
  }
  // forget the active zone
  activeZone = null;

  // remove popup & info box if present
  const pop = document.getElementById("rfsp-popup");
  if (pop && pop.parentElement) pop.parentElement.removeChild(pop);
  const info = document.getElementById("rfsp-info");
  if (info) info.remove();
}
function clearZoneField() {
  // Clears the page’s zone selector + label safely (no inline JS required)
  const z = document.getElementById("zonecode") || document.querySelector('input[name="zonecode"]');
  if (z) {
    z.value = "";
    z.dispatchEvent(new Event("input", { bubbles: true }));
    z.dispatchEvent(new Event("change", { bubbles: true }));
  }
  const g = document.getElementById("geog");
  if (g) g.textContent = "";
}

function clearActiveSelectionAndField() {
  clearActiveSelection();   // your existing helper that removes active pin & info box
  clearZoneField();         // also clear the form field/label
}

  function activeMarkerStyle(el){
    el.style.width = "20px"; el.style.height = "20px";
    el.style.borderRadius = "50% 50% 50% 0"; el.style.background = "#dc2626";
    el.style.boxShadow = "0 0 0 2px #fff"; el.style.transform = "translate(-10px,-18px) rotate(-45deg)";
    el.style.zIndex = "1002";
  }
  function setActiveMarkerByZone(zonecode){
    const pane = document.getElementById('rfsp-marker-pane');
    if (!pane) return;
    if (activeZone){
      const prev = pane.querySelector(`.rfsp-marker[data-zonecode="${CSS.escape(activeZone)}"]`);
      if (prev) defaultMarkerStyle(prev);
    }
    activeZone = zonecode || null;
    if (!activeZone) return;
    const el = pane.querySelector(`.rfsp-marker[data-zonecode="${CSS.escape(activeZone)}"]`);
    if (el) activeMarkerStyle(el);
  }
  function zoomToLatLng(lat, lng, minZoom = 11){
    if (!map) return;
    map.panTo([lat, lng]);
    map.setZoom(Math.max(map._zoom, minZoom));
  }

  // ---- delegated events (hover + click) for markers ----
  function bindDelegatedEvents() {
    mapEl.addEventListener("mousemove", (e) => {
      const m = e.target && e.target.classList && e.target.classList.contains("rfsp-marker") ? e.target : null;
      const existing = document.getElementById("rfsp-popup");
      if (!m) { if (existing && existing.parentElement) existing.parentElement.removeChild(existing); return; }
      if (!existing) {
        const pop = document.createElement("div"); pop.id = "rfsp-popup";
        pop.style.position = "absolute"; pop.style.pointerEvents = "none"; pop.style.background = "#111"; pop.style.color = "#fff";
        pop.style.font = '12px system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif';
        pop.style.padding = "6px 8px"; pop.style.borderRadius = "6px"; pop.style.boxShadow = "0 4px 12px rgba(0,0,0,.25)";
        pop.style.transform = "translate(-50%,-120%)"; pop.style.zIndex = "1001"; pop.style.whiteSpace = "nowrap";
        mapEl.appendChild(pop);
      }
      const pop = document.getElementById("rfsp-popup");
      pop.textContent = m.dataset.title || "Site";
      const r = m.getBoundingClientRect(), pr = mapEl.getBoundingClientRect();
      pop.style.left = (r.left - pr.left) + "px"; pop.style.top = (r.top - pr.top) + "px";
    });
    mapEl.addEventListener("click", (e) => {
      const el = e.target && e.target.classList && e.target.classList.contains("rfsp-marker") ? e.target : null;
      if (!el) return;
      const zc = (el.dataset.zonecode || "").trim();
      const nm = (el.dataset.title || "").trim();
      ensureInfo().innerHTML = `<b>${nm || "Site"}</b><br>Zone: ${zc || "(unknown)"}<br>Lat/Lng: ${Number(el.dataset.lat).toFixed(6)}, ${Number(el.dataset.lng).toFixed(6)}`;

      if (zoneToLatLng.has(zc)) {
        const [lat, lng] = zoneToLatLng.get(zc);
        zoomToLatLng(lat, lng, 11);
      }
      setActiveMarkerByZone(zc);
      triggerChangeZone(zc, nm);
      e.stopPropagation();
    });
  }
  function ensureInfo() {
    let info = document.getElementById("rfsp-info");
    if (!info) {
      info = document.createElement("div"); info.id = "rfsp-info";
      info.style.position = "absolute"; info.style.left = "10px"; info.style.bottom = "10px";
      info.style.background = "rgba(255,255,255,.95)"; info.style.border = "1px solid #9aa0a6";
      info.style.borderRadius = "6px"; info.style.padding = "8px 10px";
      info.style.font = '12px/1.35 system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif';
      info.style.zIndex = "1000"; info.style.maxWidth = "60%"; info.style.boxShadow = "0 1px 2px rgba(0,0,0,.08)";
      mapEl.appendChild(info);
    }
    return info;
  }

  // ---- sidebar tabs & tables ----
  function activateTab(id) {
    const tabNoGPS = document.getElementById("rfsp-tab-nogps");
    const tabAll   = document.getElementById("rfsp-tab-all");
    const tabNear  = document.getElementById("rfsp-tab-near");
    if (!tabNoGPS || !tabAll || !tabNear) return;

    if (id === "rfsp-tab-all")      activeTab = "all";
    else if (id === "rfsp-tab-near") activeTab = "near";
    else                             activeTab = "nogps";

    setTabActiveStyles(tabNoGPS, activeTab==="nogps");
    setTabActiveStyles(tabAll,   activeTab==="all");
    setTabActiveStyles(tabNear,  activeTab==="near");

    const results = collectPoints();
    renderSidebar(results.noGPS, results.allSites, results.gpsSet, results.withGPS);
    render(); // re-render map in case "map only" state matters
  }

  function bindListDelegation() {
    listWrap.addEventListener("click", (e) => {
      const row = e.target.closest && e.target.closest(".rfsp-list-row");
      if (!row) return;
      const zc = row.getAttribute("data-zonecode") || "";
      const nm = row.getAttribute("data-name") || "";

      if (zoneToLatLng.has(zc)) {
        const [lat, lng] = zoneToLatLng.get(zc);
        zoomToLatLng(lat, lng, 11);
        setActiveMarkerByZone(zc);
        ensureInfo().innerHTML =
          `<b>${(nm || "Site")}</b><br>Zone: ${zc || "(unknown)"}<br>Lat/Lng: ${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      }
      triggerChangeZone(zc, nm);
    });
  }

  function renderSidebar(noGPS, allSites, gpsSet, withGPS) {
    const body = document.getElementById("rfsp-tab-body");
    if (!body) return;
    body.innerHTML = "";

    if (activeTab === "nogps") {
      const inner = document.createElement("div"); inner.id = "rfsp-nogps-body";
      if (!noGPS.length) { inner.textContent = "None"; body.appendChild(inner); return; }
      inner.appendChild(buildTable(noGPS, { showGpsBadge:false }));
      body.appendChild(inner);

    } else if (activeTab === "all") {
      const list = (allSites || []).slice().sort((a,b)=>{
        const an=(a.name||"").toLowerCase(), bn=(b.name||"").toLowerCase();
        if (an<bn) return -1; if (an>bn) return 1; return 0;
      });
      const wrap = document.createElement("div");
      wrap.appendChild(buildTable(list, { showGpsBadge:true, gpsSet }));
      body.appendChild(wrap);

    } else { // near me
      const header = document.createElement("div");
      header.style.display = "flex"; header.style.alignItems = "center"; header.style.flexWrap = "wrap";
      header.style.gap = "8px"; header.style.padding = "4px 2px 8px 2px";

      const btn = document.createElement("button"); btn.type="button";
      btn.textContent = userLoc ? "Refresh my location" : "Use my location";
      btn.style.border = "1px solid #9aa0a6"; btn.style.background = "#fff"; btn.style.borderRadius = "6px";
      btn.style.padding = "6px 8px"; btn.style.cursor = "pointer"; btn.style.font = '12px system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif';
      btn.addEventListener("click", requestLocation);

      const lbl = document.createElement("label"); lbl.textContent = "Radius (mi):";
      lbl.style.fontSize = "12px"; lbl.style.color = "#374151";
      const input = document.createElement("input"); input.type = "number"; input.min = "1"; input.max = "500";
      input.value = String(radiusMi); input.style.width = "70px"; input.style.padding = "4px 6px";
      input.style.border = "1px solid #9aa0a6"; input.style.borderRadius = "6px"; input.style.font = '12px system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif';
      input.addEventListener("change", ()=>{ radiusMi = Math.max(1, Math.min(500, Number(input.value)||25)); renderSidebar(noGPS, allSites, gpsSet, withGPS); render(); });

      // NEW: "Show on map only" toggle
      const chkWrap = document.createElement("label");
      chkWrap.style.display = "inline-flex"; chkWrap.style.alignItems = "center"; chkWrap.style.gap = "6px";
      chkWrap.style.fontSize = "12px"; chkWrap.style.color = "#374151";
      const chk = document.createElement("input"); chk.type = "checkbox";
      chk.id = "rfsp-near-maponly";
      chk.checked = !!showNearMapOnly;
      chk.disabled = !userLoc;
      chk.title = userLoc ? "Only display nearby sites on the map" : "Enable after using your location";
      chk.addEventListener("change", () => { showNearMapOnly = chk.checked; render(); });
      const chkLbl = document.createElement("span"); chkLbl.textContent = "Show on map only";

      chkWrap.appendChild(chk); chkWrap.appendChild(chkLbl);

      header.appendChild(btn); header.appendChild(lbl); header.appendChild(input); header.appendChild(chkWrap);
      body.appendChild(header);

      if (!userLoc) {
        const msg = document.createElement("div");
        msg.style.fontSize = "12px"; msg.style.color = "#444"; msg.textContent = "Click “Use my location” to find sites near you.";
        body.appendChild(msg);
        return;
      }

      // build near list: withGPS only (we need coordinates)
      const near = (withGPS || []).map(p => ({
        zonecode: p.zonecode || "",
        name: p.title || "",
        lat: p.lat, lng: p.lng,
        dist: distMiles(userLoc, [p.lat, p.lng])
      })).filter(r => r.dist <= radiusMi)
        .sort((a,b) => a.dist - b.dist);

      if (!near.length) {
        const msg = document.createElement("div");
        msg.style.fontSize = "12px"; msg.style.color = "#444"; msg.textContent = `No sites within ${radiusMi} mi of your location.`;
        body.appendChild(msg);
        return;
      }

      // table with distance column
      const table = document.createElement("table");
      table.style.width = "100%"; table.style.borderCollapse = "collapse"; table.style.fontSize = "12px";
      const thead = document.createElement("thead");
      thead.innerHTML = `<tr>
        <th style="text-align:left; padding:4px 6px; border-bottom:1px solid #e5e7eb;">Zone</th>
        <th style="text-align:left; padding:4px 6px; border-bottom:1px solid #e5e7eb;">Site</th>
        <th style="text-align:left; padding:4px 6px; border-bottom:1px solid #e5e7eb;">Distance</th>
      </tr>`;
      const tbody = document.createElement("tbody");
      near.forEach(it => {
        const tr = document.createElement("tr");
        tr.className = "rfsp-list-row";
        tr.setAttribute("data-zonecode", it.zonecode);
        tr.setAttribute("data-name", it.name);
        tr.style.cursor = "pointer";
        tr.addEventListener("mouseenter", () => tr.style.background = "#f3f4f6");
        tr.addEventListener("mouseleave", () => tr.style.background = "");
        tr.innerHTML = `<td style="padding:4px 6px;">${it.zonecode}</td>
          <td style="padding:4px 6px;">${escapeHtml(it.name)}</td>
          <td style="padding:4px 6px;">${mi(it.dist)} mi</td>`;
        tbody.appendChild(tr);
      });
      table.appendChild(thead); table.appendChild(tbody);
      body.appendChild(table);
    }
  }

  function buildTable(rows, opts) {
    const showGpsBadge = opts && opts.showGpsBadge;
    const gpsSet = (opts && opts.gpsSet) || new Set();
    const table = document.createElement("table");
    table.style.width = "100%"; table.style.borderCollapse = "collapse"; table.style.fontSize = "12px";
    const thead = document.createElement("thead");
    thead.innerHTML = `<tr>
      <th style="text-align:left; padding:4px 6px; border-bottom:1px solid #e5e7eb;">Zone</th>
      <th style="text-align:left; padding:4px 6px; border-bottom:1px solid #e5e7eb;">Site</th>
      ${showGpsBadge ? '<th style="text-align:left; padding:4px 6px; border-bottom:1px solid #e5e7eb;">GPS</th>' : ''}
    </tr>`;
    const tbody = document.createElement("tbody");
    rows.forEach(it => {
      const tr = document.createElement("tr");
      tr.className = "rfsp-list-row";
      tr.setAttribute("data-zonecode", it.zonecode);
      tr.setAttribute("data-name", it.name);
      tr.style.cursor = "pointer";
      tr.addEventListener("mouseenter", () => tr.style.background = "#f3f4f6");
      tr.addEventListener("mouseleave", () => tr.style.background = "");
      tr.innerHTML = `<td style="padding:4px 6px;">${it.zonecode}</td>
        <td style="padding:4px 6px;">${escapeHtml(it.name)}</td>
        ${showGpsBadge ? `<td style="padding:4px 6px;">${gpsSet.has(it.zonecode) ? "✔︎" : "—"}</td>` : ""}`;
      tbody.appendChild(tr);
    });
    table.appendChild(thead); table.appendChild(tbody);
    return table;
  }

  // ---- geolocation ----
  function requestLocation(){
    if (!navigator.geolocation) { alert("Geolocation not supported by this browser."); return; }
    navigator.geolocation.getCurrentPosition(
      (pos)=>{
        userLoc = [pos.coords.latitude, pos.coords.longitude];
        render(); // refresh lists & map with distances / filter
      },
      (err)=>{
        log("geo error", err);
        alert("Couldn't get your location: " + err.message);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 600000 }
    );
  }

  // ---- render & observers ----
  function render() {
    try {
      const { withGPS, noGPS, allSites, gpsSet } = collectPoints();
      const populated = isResultsPopulated();
      if (!populated || (!withGPS.length && !noGPS.length)) { if (cardEl) showCard(false); return; }
      ensureCard(); showCard(true);

      // Decide which markers to display on the map (respect "Near me → Show on map only")
      let displayMarkers = withGPS;
      if (activeTab === "near" && showNearMapOnly && userLoc) {
        displayMarkers = withGPS.filter(p => distMiles(userLoc, [p.lat, p.lng]) <= radiusMi);
      }

      // Marker hash based on displayed markers so toggling affects the map
      const hash = displayMarkers.map(p => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join("|");
      if (hash !== lastHash) {
        lastHash = hash;
        // Ensure the selected site still exists in the visible dataset
        if (activeZone) {
          const visibleZones = new Set(displayMarkers.map(p => String(p.zonecode || "")));
          if (!visibleZones.has(String(activeZone))) {
            clearActiveSelectionAndField();
          }
        }

        map.setMarkers(displayMarkers.map(p => ({ latlng: [p.lat, p.lng], title: p.title, zonecode: p.zonecode || "" })));

        // keep lookup from zone -> lat/lng (for jumps from any tab)
        zoneToLatLng = new Map(withGPS.map(p => [String(p.zonecode), [p.lat, p.lng]]));

        // keep active marker styled across re-renders
        if (activeZone) setActiveMarkerByZone(activeZone);

        if (displayMarkers.length) fitBounds(displayMarkers);
      }

      // Sidebar (respect active tab)
      renderSidebar(noGPS, allSites, gpsSet, withGPS);

      const legend = document.getElementById("rfsp-map-legend");
      if (legend) {
        const nearTxt = userLoc ? ` • Near me ready${(activeTab==='near' && showNearMapOnly) ? " (map filtered)" : ""}` : "";
        legend.textContent = `${withGPS.length} mapped, ${noGPS.length} without coordinates.${nearTxt}`;
      }
      log("Rendered", displayMarkers.length, "displayed; total withGPS:", withGPS.length, "noGPS:", noGPS.length, "all:", allSites.length);
    } catch (e) { log("render error", e); }
  }

  function setupObservers() {
    try {
      const results = document.getElementById(RESULTS_ID);
      let t; const kick = () => { clearTimeout(t); t = setTimeout(render, 120); };
      if (results) { const mo = new MutationObserver(kick); mo.observe(results, { childList: true, subtree: true, characterData: true }); }
      const regionSelect = document.querySelector(REGION_SELECT); if (regionSelect) regionSelect.addEventListener("change", kick);
      const searchInput = document.querySelector('input[name="search"]'); if (searchInput) ["input","change","keyup"].forEach(ev => searchInput.addEventListener(ev, kick));
    } catch (e) { log("setupObservers error", e); }
  }

  function boot() {
    // Early exit if no results element (not a site search page)
    if (!document.getElementById(RESULTS_ID)) {
      return;
    }
    setupObservers();
    render();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
