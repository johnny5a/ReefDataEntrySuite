# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Chrome extension (Manifest V3) that enhances the REEF (Reef Environmental Education Foundation) data entry workflow. It combines three main features:
1. **Navigation toolbar** - Quick access buttons for scrolling and form submission
2. **Fish image previews** - Inline FishBase images with keyboard shortcuts for rapid data entry
3. **Interactive site maps** - OpenStreetMap visualization of survey sites

The extension operates on REEF.org pages using content scripts in different contexts (main pages, iframes, and map pages).

## Architecture

### Content Script Contexts

The extension uses **four separate content scripts** that load in different contexts:

1. **content-main.js** (~420 lines)
   - Runs in the top window on `www.reef.org/dataentry` pages
   - Implements navigation toolbar (Top/Bottom/Next/Save/Family dropdown)
   - Handles cross-frame messaging with iframe content
   - Auto-fits the `data.reef.org` iframe to its content height (`rfsp-size` messages; `autoFitFrame` setting)
   - Key functions: `postToFrame()`, `requestFamilyList()`, `askFrameScrollTo()`, `applyFrameHeight()`

2. **content-frame.js** (~1400 lines)
   - Runs in iframe context on `data.reef.org/dataentry` pages
   - Implements fish image previews from FishBase API
   - Handles keyboard shortcuts (0-4 for abundance, N/S/F/M/A letters, arrow navigation)
   - Provides UX enhancements (radio buttons, checkboxes, row highlighting)
   - Key functions: `sendFamilies()`, `scanFamilyRows()`, message listeners

3. **content-map.js** (~840 lines)
   - Runs on every `https://*.reef.org/*` page **in all frames**: the data-entry site search lives inside the `data.reef.org` iframe, so don't narrow this to the top window or to www.reef.org
   - Sole owner of the map UI (an older duplicate in content-main.js was removed in 1.4.0)
   - Implements custom tile-based map renderer (MicroMap class)
   - Shows markers for survey sites, with "Near Me" geolocation feature
   - Key functions: `MicroMap()`, `distMiles()`, `_projectAt()`, `_unprojectAt()`

4. **content-unlisted.js** (~800 lines)
   - Runs on unlisted/addfish pages
   - Tracks recently added species per region
   - Provides quick-select panel for recent species
   - Key functions: `detectRegion()`, `addToRecentSpecies()`, `createRecentSpeciesPanel()`

### Background Service Worker

**background.js** (~100 lines)
- Fetches fish images from FishBase.se (host permission covers cross-origin fetch; no CORS workaround needed)
- Responds to `{type: "fb.image", scientificName}` messages
- Key functions: `fbSummarySmart()`, `normalizeScientificName()`

### Cross-Frame Communication

The extension uses `postMessage()` for iframe communication with namespaced messages:
- `rfsp-cmd`: Commands from main → iframe (NEXT, SAVE, FAMILY_SCROLL_TO_INDEX, etc.)
- `rfsp-page`: Page info from iframe → main
- `rfsp-families`: Family list from iframe → main
- `rfsp-fam-scrolled`: Scroll confirmation from iframe → main
- `rfsp-fam-measured`: Measurement data from iframe → main
- `rfsp-size`: Content height from iframe → main (drives iframe auto-fit)

Always validate `event.origin` before processing messages: main accepts only `https://*.data.reef.org`, the frame accepts `https://*.reef.org`. The frame posts with target origin `https://www.reef.org` (never `*`).

## Development Commands

This is a Chrome extension with no build process. Development workflow:

1. **Load extension in Chrome:**
   - Navigate to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select this directory

2. **Reload after changes:**
   - Go to `chrome://extensions/`
   - Click reload icon on "REEF DataEntry Suite" card
   - OR: Press Ctrl+R (Cmd+R) on the extensions page

3. **Debug content scripts:**
   - Open DevTools (F12) on target REEF page
   - Check Console for `[REEF Suite - Nav]`, `[REEF Suite - Frame]`, etc. log messages
   - Use Sources tab to set breakpoints in content scripts

4. **Debug background worker:**
   - Go to `chrome://extensions/`
   - Click "service worker" link under extension
   - Use DevTools console to inspect FishBase API requests

5. **Test on REEF pages:**
   - Navigation: `https://www.reef.org/dataentry/listedfish.php`
   - Fish previews: iframe at `https://data.reef.org/dataentry/listedfish.php`
   - Maps: `https://www.reef.org/db/reports/site_search.php` (with results)
   - Unlisted: `https://data.reef.org/dataentry/unlisted` or `/addfish`

## Key Implementation Details

### FishBase Image Fetching

The background worker tries multiple URL patterns to find fish images:
```javascript
// Try in order:
// 1. https://www.fishbase.se/summary/Genus-species
// 2. https://www.fishbase.se/summary/Genus-species.html
// 3. https://www.fishbase.se/summary/SpeciesSummary.php?genusname=Genus&speciesname=species
```

Scientific names are normalized: remove parentheses, strip "cf.", "aff.", "sp.", "spp.", extract genus+species only.

### Keyboard Shortcuts (content-frame.js)

Shortcuts only work when NOT focused in a text input:
- **Numbers:** 0=None, 1=Single, 2=Few, 3=Many, 4=Abundant
- **Letters:** N=None, S=Single, F=Few, M=Many, A=Abundant
- **Navigation:** ↑↓=move rows, Enter=next row, Space=toggle (Tab is deliberately left alone)
- Event listener: `document.addEventListener("keydown", ...)`; bails on Ctrl/Cmd/Alt combos and on any text-like field (`TYPING_SELECTOR`)

### Map Implementation (content-map.js)

Custom map renderer without external libraries:
- Uses OpenStreetMap tiles: `https://tile.openstreetmap.org/{z}/{x}/{y}.png`
- Web Mercator projection with manual `_projectAt()` / `_unprojectAt()` functions
- Mouse-wheel zoom centers on cursor position (not map center)
- Double-click on markers zooms to that location
- Drag-to-pan uses `mousedown`/`mousemove`/`mouseup` handlers

### Storage Keys

- `chrome.storage.local.rfspImageCache`: Persistent FishBase lookup cache keyed by normalized scientific name. Entries are `{ data: {image,url} | null, ts }`; `null` = known miss, retried after 7 days. Writes are debounced (500 ms).
- `chrome.storage.sync` (one key per setting): `hoverDelay`, `tooltipPosition`, `thumbHeight`, `popupWidth`, `popupImgMaxWidth`, `popupImgMaxHeight`, `fishTableMaxWidth`, `fishFontSize`, `showPreviewsOnUnlisted`, `autoFitFrame`
- `chrome.storage.local.rfsp_recent_unlisted_by_region`: Recent unlisted species (MAX_RECENT=20)

## Permissions Requirements

- `storage`: Save settings and fish image cache
- Host permissions (https only): `*.reef.org`, `www.fishbase.se`, `tile.openstreetmap.org`

## Common Gotchas

1. **Content scripts load in multiple contexts** - content-main.js sees the outer page DOM, content-frame.js sees the iframe DOM. They cannot directly access each other's variables; use postMessage().

2. **Frame detection** - Use `if (window !== window.top) return;` in content-main.js to avoid running in iframes.

3. **Scientific name parsing** - FishBase URLs are case-sensitive (Genus-species format). Always capitalize genus, lowercase species.

4. **FishBase requests** go through the background service worker (content scripts on reef.org can't fetch fishbase.se; the worker can because of the host permission).

5. **Map tile caching** - OpenStreetMap tiles have usage limits. The extension does not implement tile caching; rely on browser HTTP cache.

6. **Keyboard shortcuts conflict** - Shortcuts are disabled for Ctrl/Cmd/Alt combos and whenever the target is a text-like field (`TYPING_SELECTOR` in content-frame.js). Keep it that way: a bare `1`/`f`/`a` must never fire while typing or with a modifier held.

7. **Mutation observers** - Every `MutationObserver` on `documentElement` must be debounced (≥120 ms) and must not read storage per mutation.

8. **innerHTML** - Build UI from DOM APIs or run values through `escapeHtml()`; species names, site names and FishBase URLs are page-sourced.

## File Structure Reference

```
manifest.json          - Extension config (V3), content_scripts mapping
background.js          - Service worker for FishBase API
content-main.js        - Navigation toolbar + messaging + iframe auto-fit
content-frame.js       - Fish previews + keyboard shortcuts + size reporting
content-map.js         - Custom map renderer
content-unlisted.js    - Recent species tracking
options.html/js        - Settings UI
styles.css             - Combined styles for all features
test-patterns.js       - Rough match-pattern sanity check (not Chrome's real matcher)
CHANGELOG.md           - Release notes
```
