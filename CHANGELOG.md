# Changelog

All notable changes to the REEF DataEntry Suite extension.

## [1.4.0] - 2026-10-11

### Added
- **Data-entry frame auto-fit.** The `data.reef.org` iframe on the data entry page
  now grows to the height of its content, so long pages (unlisted species, large
  families) scroll with the main page instead of inside a small inset box. The
  frame reports its height to the parent page (`rfsp-size` message) and
  `content-main.js` resizes the iframe. New **Auto-fit data entry frame** toggle
  on the options page (on by default). Height is measured from the content's
  real bottom edge (REEF pages are quirks-mode, where `scrollHeight` reports the
  viewport), so there is no trailing blank space on short pages.
- `CHANGELOG.md` and `.gitignore`.

### Fixed
- **Keyboard shortcuts fired on Cmd/Ctrl combos.** ⌘F, ⌘S, ⌘A (and Ctrl
  equivalents) on a listed-fish page set the active row to Few / Single /
  Abundant and swallowed the browser shortcut. Modifier combos are now ignored.
- Shortcuts also fired while typing in inputs without an explicit `type`,
  date/password fields, or `contenteditable` elements. All text-like fields are
  now excluded.
- Double-clicking a row cycled abundance twice after the row list was rescanned
  (listeners were bound more than once). Rows are now bound once.
- Scientific names ending in `sp.` / `spp.` / `cf.` weren't stripped before the
  FishBase lookup, producing wasted requests for e.g. `Scarus-sp`.
- Clicking a "recent species" button could click an unrelated element when no
  search result matched; it now does nothing and logs a warning.
- `postToFrame()` had a fallback that posted to the wrong window and never
  delivered; removed.

### Changed
- **Tab is no longer intercepted** on the fish table; normal focus navigation
  works again. Enter still advances to the next row.
- **Fewer permissions.** `declarativeNetRequest` and `activeTab` removed; the
  service worker fetches FishBase directly under its host permission, so the
  CORS-header rewrite rule is gone. `http://` host permissions and the unused
  `web_accessible_resources` entry removed. Chrome may ask you to re-approve the
  extension after this change because the permission set shrank.
- **Map code consolidated.** The interactive site map existed twice (in
  `content-main.js` and `content-map.js`); `content-map.js` is now the only copy
  and `content-main.js` is toolbar + frame messaging only. Manifest `matches`
  adjusted so each script runs on exactly one kind of page.
- FishBase cache: writes are debounced, and "not found" results are remembered
  for 7 days instead of being re-fetched on every page load.
- `MutationObserver`s in `content-frame.js` and `content-unlisted.js` are
  debounced and no longer read `chrome.storage` on every DOM mutation.
- Tooltip, map info panel, and recent-species panel are built with DOM APIs /
  escaped values instead of raw `innerHTML` interpolation.
- Verbose per-element tracing in `content-unlisted.js` is behind a `DEBUG` flag
  (off by default); the `rfspTest*` console helpers are only installed when it
  is on.
- Options page: removed a stray duplicate storage read and an unused
  `thumbWidth` default; font-size slider wiring tidied.
- Docs (`README`, `CLAUDE.md`, `INSTALL`, `diagnostic`, `KEYBOARD_SHORTCUTS`)
  updated to match the code; stale `v1.0.0` / `v1.1.1` references removed.

### Removed
- Dead code: `resizeExistingThumbs`, `warmCachedImagesForCurrentRows`,
  `updateProgressIndicator`, `enhanceSearchResults`, `addToRecentSpeciesSync`,
  and the non-functional in-frame `rfspFitFishFrameInit` block (replaced by the
  parent-side auto-fit above).

## [1.3.4] and earlier

Combined release of the three original extensions (Buttons, Reef Fish Survey
Preview, REEF Map for Sites) plus the unlisted-species recent list, FishBase
image-host fix, and options-page recent-species manager.
