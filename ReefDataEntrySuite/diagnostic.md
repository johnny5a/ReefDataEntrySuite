# 🔍 REEF Extension Diagnostic - Version 1.1.1

## Run This First

**In the browser console, paste this:**

```javascript
console.log("URL:", window.location.href);
console.log("Extension loaded?:", window.__RFSP_UNLISTED_LOADED__);
console.log("In iframe?:", window !== window.top);
```

## What the Results Mean

**If `Extension loaded?: true`** ✅
- Extension is working! 
- Commands available: `rfspTestAddSpecies()`, `rfspShowRecent()`

**If `Extension loaded?: undefined`** ❌
- Extension NOT loading on this page
- Check: Does URL contain "unlisted" or "addfish"?
- Check: Did you reload extension at chrome://extensions/?

## Quick Fix Steps

1. **Reload Extension**
   - chrome://extensions/
   - Find "REEF DataEntry Suite" 
   - Verify version = **1.1.1**
   - Click reload ⟳

2. **Hard Refresh Page**
   - Mac: Cmd+Shift+R
   - Windows: Ctrl+Shift+R

3. **Check URL**
   - Must be: `https://data.reef.org/dataentry/*unlisted*`
   - OR: `https://data.reef.org/dataentry/*addfish*`

## Test Storage Directly

If you just want to test the options page display, go to chrome://extensions/, click "service worker" under REEF extension, paste:

```javascript
chrome.storage.local.set({
  "rfsp_recent_unlisted_by_region": [
    {id: "1", name: "Queen Angelfish", scientific: "Holacanthus ciliaris", timestamp: Date.now()},
    {id: "2", name: "Blue Tang", scientific: "Acanthurus coeruleus", timestamp: Date.now()}
  ]
}, () => console.log("✅ Saved! Open Options page to view"));
```

Then: Right-click extension → Options
