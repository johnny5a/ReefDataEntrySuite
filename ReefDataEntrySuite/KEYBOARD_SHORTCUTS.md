    # REEF DataEntry Suite - Keyboard Shortcuts & Quick Reference

## Fish Data Entry UX Improvements

### Keyboard Shortcuts

The extension now includes powerful keyboard shortcuts to speed up fish data entry:

#### Abundance Surveys (Number & Letter Keys)
- **0** or **N** = None
- **1** or **S** = Single (1)
- **2** or **F** = Few (2-10)
- **3** or **M** = Many (11-100)
- **4** or **A** = Abundant (101+)

#### Species Surveys (Checkbox)
- **Spacebar** = Check/uncheck "Present" checkbox
- Works with species presence surveys that use checkboxes instead of abundance levels

#### Navigation
- **Arrow Down** = Move to next fish row
- **Arrow Up** = Move to previous fish row
- **Enter** or **Tab** = Advance to next row
- **Spacebar** = For abundance surveys: Toggle between "None" and your last selected abundance level
- **Spacebar** = For species surveys: Check/uncheck the "Present" checkbox

### Click-Anywhere-on-Row

You can now interact with fish rows more easily:

- **Single Click** on any part of a row (outside of inputs) = Select that row (highlights it)
- **Double Click** on a row = Cycle through abundance levels (None → Single → Few → Many → Abundant → None...)

### Visual Feedback

The extension provides clear visual indicators:

#### Active Row Highlighting
- The currently selected row is highlighted with a **yellow background** and **orange border**
- The active row automatically scrolls into view when navigating with keyboard

#### Completed Rows
- Rows where you've entered data are shown with a **light green background**
- This helps you quickly see which species you've already recorded

### Quick Data Entry Workflow

#### For Abundance Surveys:
1. Click on the first fish row to make it active (or press Arrow Down)
2. Use number keys (0-4) or letter keys (N/S/F/M/A) to quickly set abundance
3. Press Enter or Tab to automatically move to the next row
4. Repeat steps 2-3 for rapid data entry
5. Use Arrow Up/Down to navigate back if you need to review or change entries
6. Use Spacebar to quickly toggle a species between "None" and your last selected value

#### For Species Surveys (Checkbox):
1. Click on the first fish row to make it active (or press Arrow Down)
2. Press Spacebar to check "Present" for species you saw
3. Press Enter or Tab to move to next row
4. For species you didn't see, just press Enter/Tab to skip (leaves unchecked)
5. Use Spacebar again to uncheck if you made a mistake

### Tips for Efficient Entry

- **Abundance surveys**: Press `S` (Single) or `1` then Enter for quick single fish entries
- **Species surveys**: Just press Spacebar + Enter for fish you saw, Enter to skip fish you didn't see
- **For fish you didn't see**: Press `N` or `0` then Enter to quickly mark as "None"
- **Navigation**: Arrow keys let you move around freely without taking your hands off the keyboard
- **Visual scanning**: Green completed rows help you spot any gaps in your data entry
- **Letter shortcuts**: Use N/S/F/M/A for faster entry without reaching for number row

### Notes

- Keyboard shortcuts only work when you're NOT typing in a text input or textarea
- The active row highlighting persists, so you always know where you are
- All changes are synchronized with the underlying form elements, so the REEF system receives all your data correctly
- Both uppercase and lowercase letters work (N and n are the same)

## Other Extension Features

### Navigation Controls
- Floating buttons in bottom-right: Top, Bottom, Next, Save, Family dropdown
- Family dropdown appears on hover

### Fish Image Previews
- Thumbnails appear automatically on the right side of the fish table
- Hover over thumbnails for larger preview popup
- Click thumbnails to open FishBase in new tab

### Interactive Site Maps
- Map appears when viewing site search results
- Three tabs: "No GPS", "All (A–Z)", "Near me"
- Click markers or list items to select sites
- Zoom controls: +, −, Fit, Refresh

### Settings
- Access via extension options in `chrome://extensions/`
- Customize hover delays, thumbnail sizes, popup dimensions, font sizes
- Changes apply immediately

---

For installation instructions, see [INSTALL.md](INSTALL.md)

For general information, see [README.md](README.md)
