# Installation Guide - REEF DataEntry Suite

## Quick Start

### Step 1: Download latest release
Download latest release from GitHub and unzip. Copy Folder location

### Step 2: Load in Chrome
1. Open Google Chrome
2. Navigate to `chrome://extensions/`
3. Toggle **"Developer mode"** ON (top-right corner)
4. Click **"Load unpacked"** button
5. Navigate to and select the `ReefDataEntrySuite` folder location from Step 1
6. Click **"Select"** or **"Open"**

### Step 3: Verify Installation
You should see "REEF DataEntry Suite" appear in your extensions list with:
- A green/blue icon
- Status showing "Enabled"
- Description mentioning navigation controls, fish previews, and maps

### Step 4: Configure (Optional)
1. Click the extension's **Details** button
2. Scroll down and click **"Extension options"**
3. Customize settings such as:
   - Hover delay for fish preview popups
   - Tooltip position (right/left/above/below)
   - Thumbnail and popup sizes
   - Fish table width and font size
4. Click **Save** when done

## Testing the Extension

### Test Navigation Controls
1. Go to any REEF data entry page with `listedfish.php`
2. Look for floating buttons in the bottom-right corner:
   - Family (dropdown menu)
   - Top
   - Bottom
   - Next
   - Save

### Test Fish Previews
1. On a fish data entry page, you should see:
   - New thumbnail column on the right side of the table
   - Fish images loading automatically
   - Hover over thumbnails to see larger popups
   - Radio buttons/checkboxes for abundance selectors

### Test Interactive Map
1. Go to REEF site search results page
2. Look for a map card below the results showing:
   - OpenStreetMap with site markers
   - Three tabs: "No GPS", "All (A–Z)", "Near me"
   - Zoom controls (+, −, Fit, Refresh)
3. Try clicking markers or list items to select sites

## Troubleshooting

### Extension Not Loading
- **Check Developer Mode**: Ensure it's toggled ON in `chrome://extensions/`
- **Check Folder**: Make sure you selected the `ReefDataEntrySuite` folder, not a parent folder
- **Reload**: Click the reload icon on the extension card

### Features Not Appearing
- **Check Permissions**: The extension needs access to `reef.org` and `data.reef.org`
- **Check URL**: Make sure you're on the correct REEF pages
- **Console Errors**: Open DevTools (F12) and check for errors in the Console tab
- **Reload Page**: Try refreshing the REEF page after enabling the extension

### Fish Images Not Loading
- **Internet Connection**: Check your network connection
- **FishBase Access**: Ensure `www.fishbase.se` is accessible
- **Clear Cache**: Try clearing the extension's cache via Options
- **Check Console**: Look for network errors in DevTools

### Map Not Showing
- **Check Results**: Map only appears when search results contain GPS data
- **OpenStreetMap**: Verify `tile.openstreetmap.org` is accessible
- **Reload Page**: Refresh the search results page

## Uninstalling

To remove the extension:
1. Go to `chrome://extensions/`
2. Find "REEF DataEntry Suite"
3. Click **"Remove"**
4. Confirm the removal

## Updating

When updates are available:
1. Make sure you have the latest files in `~/Documents/Projects/ReefDataEntrySuite/`
2. Go to `chrome://extensions/`
3. Click the reload icon on the "REEF DataEntry Suite" card

The extension will automatically reload with the new version.

## File Structure

```
ReefDataEntrySuite/
├── manifest.json          # Extension configuration
├── content-main.js        # Main page scripts (toolbar + map)
├── content-frame.js       # Iframe scripts (fish previews)
├── background.js          # Service worker (FishBase API)
├── styles.css             # Combined styles
├── options.html           # Settings page UI
├── options.js             # Settings page logic
├── icon16.png            # Extension icon (16x16)
├── icon48.png            # Extension icon (48x48)
├── icon128.png           # Extension icon (128x128)
├── README.md             # Documentation
└── INSTALL.md            # This file
```

## Support

For technical support or feature requests, please refer to the README.md file or contact the extension developer.
