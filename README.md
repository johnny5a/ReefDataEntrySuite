# REEF DataEntry Suite

A comprehensive Chrome extension that combines three powerful tools for REEF (Reef Environmental Education Foundation) data entry, providing an enhanced workflow for marine survey documentation.

## Features

### 🎯 Navigation Controls
- **Top/Bottom Buttons**: Quickly jump to the top or bottom of the current data entry page
- **Next/Save Buttons**: Convenient floating buttons for form submission
- **Family Navigation Menu**: Dropdown menu to quickly jump between fish family sections
- **Smart Scrolling**: Automatically aligns the selected family to optimal viewing position

### 🐠 Fish Image Previews
- **Inline Thumbnails**: Displays fish images from FishBase directly in the data entry table
- **Hover Popups**: Larger preview images appear on hover with customizable delay
- **Persistent Cache**: Stores fetched fish images locally for faster subsequent loads
- **Enhanced Selectors**: Radio buttons and checkboxes replace dropdown menus for abundance/presence fields
- **"Today" Button**: Quick-fill button for date entry fields
- **Customizable Display**: Adjust thumbnail size, popup position, table width, and font size

### 🗺️ Interactive Site Maps
- **Live Map View**: Displays all REEF survey sites with GPS coordinates on an interactive OpenStreetMap
- **Three Tab System**:
  - **No GPS**: Sites without coordinate data
  - **All (A–Z)**: Alphabetically sorted list of all sites
  - **Near Me**: Find sites within a customizable radius using geolocation
- **Click to Select**: Click any marker or list item to automatically select that site in the REEF interface
- **Active Pin Highlighting**: Selected sites are highlighted with a red teardrop marker
- **Zoom Controls**: Mouse wheel zoom (centered on cursor), double-click zoom, drag to pan
- **Fit to Bounds**: Automatically adjusts zoom to show all available sites

## Installation

1. Download or clone this extension to your local machine
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked"
5. Select the `ReefDataEntrySuite` folder

## Usage

### Navigation Toolbar
The toolbar appears automatically when you're on a REEF data entry page with `listedfish.php`. It floats in the bottom-right corner with these buttons:
- **Family**: Opens a dropdown menu to jump to specific fish families
- **Top**: Scrolls to the top of the page
- **Bottom**: Scrolls to the last family section
- **Next**: Submits the form and advances to the next page
- **Save**: Saves the current form without advancing

### Fish Previews
Fish thumbnails appear automatically in a new column on the right side of the data entry table. Hover over any thumbnail to see a larger popup preview with a link to the full FishBase entry.

### Site Map
When viewing REEF site search results, the map appears below the results table showing all sites with GPS coordinates. Use the tabs to switch between different views, and click any site to select it.

### Configuration
Right-click the extension icon and select "Options" to customize:
- **Hover delay**: Time before popup appears (milliseconds)
- **Tooltip position**: Where popups appear relative to thumbnails (right/left/above/below)
- **Thumbnail height**: Vertical size of inline preview images
- **Popup dimensions**: Maximum width and height for hover popups
- **Fish table max width**: Maximum width for the centered data entry table
- **Fish table font size**: Text size for the fish data table (10-24px)

## Technical Details

### Files
- `manifest.json`: Extension configuration (Manifest V3)
- `content-main.js`: Main page functionality (navigation toolbar + interactive map)
- `content-frame.js`: Iframe functionality (fish previews + frame message handlers)
- `background.js`: Service worker for FishBase API requests with CORS handling
- `styles.css`: Combined styles for all features
- `options.html` / `options.js`: Settings interface

### Permissions
- `activeTab`: Access to the current tab
- `declarativeNetRequest`: Inject CORS headers for FishBase requests
- `storage`: Save user preferences and cached fish images
- `https://www.fishbase.se/*`: Fetch fish images and data
- `https://tile.openstreetmap.org/*`: Load map tiles
- `https://*.reef.org/*`: Access REEF data entry pages

### Data Sources
- **Fish Images**: [FishBase](https://www.fishbase.se/) - Global fish species database
- **Maps**: [OpenStreetMap](https://www.openstreetmap.org/) - Open-source mapping data

## Version History

### v1.0.0 (Current)
- Initial combined release
- Merged functionality from three separate extensions:
  - **Buttons** (v2.4.2): Navigation controls
  - **Reef Fish Survey Preview** (v1.0.1): Fish image previews
  - **REEF Map for Sites** (v1.9.0): Interactive site maps
- Unified codebase with improved organization
- Single options page for all settings
- Reduced memory footprint through shared resources

## Credits

Developed for the REEF (Reef Environmental Education Foundation) community to streamline marine survey data entry.

**Data Sources:**
- Fish species data and images: [FishBase](https://www.fishbase.se/)
- Map tiles: [OpenStreetMap](https://www.openstreetmap.org/) contributors

## Support

For issues, feature requests, or questions about this extension, please refer to the REEF data entry documentation or contact the extension developer.

## License

This extension is provided as-is for use with REEF data entry. Fish data and images remain property of FishBase. Map data © OpenStreetMap contributors.
