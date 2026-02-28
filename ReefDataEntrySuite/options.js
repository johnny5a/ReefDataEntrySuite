// options.js — Reef Fish Survey Preview (no thumbWidth)

function $(id) { return document.getElementById(id); }
function toInt(el, def) {
  const n = parseInt(el?.value, 10);
  return Number.isFinite(n) ? n : def;
}

document.addEventListener("DOMContentLoaded", () => {
  const hoverDelay        = $("hoverDelay");
  const tooltipPosition   = $("tooltipPosition");
  const thumbHeight       = $("thumbHeight");
  const popupWidth        = $("popupWidth");
  const popupImgMaxWidth  = $("popupImgMaxWidth");
  const popupImgMaxHeight = $("popupImgMaxHeight");
  const saveBtn           = $("save");
  const statusEl          = $("status");
  const fishTableMaxWidth = $("fishTableMaxWidth"); // ← NEW

const defaults = {
  hoverDelay: 100,
  tooltipPosition: "right",
  thumbWidth: 120,
  thumbHeight: 90,
  popupWidth: 320,
  popupImgMaxWidth: 300,
  popupImgMaxHeight: 200,
  fishTableMaxWidth: 500     // ← NEW
};
// ==== Add near your other settings wiring ====
const fishFontSize = document.getElementById("fishFontSize");
const fishFontSizeValue = document.getElementById("fishFontSizeValue");

function loadFishFontSize(items){
  const size = Number(items.fishFontSize ?? 14);
  fishFontSize.value = size;
  fishFontSizeValue.textContent = size;
}

function saveFishFontSize(){
  const size = Number(fishFontSize.value);
  fishFontSizeValue.textContent = size;
  chrome.storage.sync.set({ fishFontSize: size });
}

// on options page init, include fishFontSize in your storage get:
chrome.storage.sync.get(null, (items) => {
  // ...your other loads
  loadFishFontSize(items);
});

// wire up change
fishFontSize.addEventListener("input", saveFishFontSize);


  chrome.storage.sync.get(defaults, (items) => {
    if (hoverDelay)        hoverDelay.value        = items.hoverDelay;
    if (tooltipPosition)   tooltipPosition.value   = items.tooltipPosition;
    if (thumbHeight)       thumbHeight.value       = items.thumbHeight;
    if (popupWidth)        popupWidth.value        = items.popupWidth;
    if (popupImgMaxWidth)  popupImgMaxWidth.value  = items.popupImgMaxWidth;
    if (popupImgMaxHeight) popupImgMaxHeight.value = items.popupImgMaxHeight;
    if (fishTableMaxWidth) fishTableMaxWidth.value = items.fishTableMaxWidth ?? defaults.fishTableMaxWidth; // ← NEW

  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;
    if (changes.hoverDelay && hoverDelay)              hoverDelay.value              = changes.hoverDelay.newValue;
    if (changes.tooltipPosition && tooltipPosition)    tooltipPosition.value         = changes.tooltipPosition.newValue;
    if (changes.thumbHeight && thumbHeight)            thumbHeight.value             = changes.thumbHeight.newValue;
    if (changes.popupWidth && popupWidth)              popupWidth.value              = changes.popupWidth.newValue;
    if (changes.popupImgMaxWidth && popupImgMaxWidth)  popupImgMaxWidth.value        = changes.popupImgMaxWidth.newValue;
    if (changes.popupImgMaxHeight && popupImgMaxHeight)popupImgMaxHeight.value       = changes.popupImgMaxHeight.newValue;
  });

  saveBtn.addEventListener("click", () => {
    const data = {
      hoverDelay:       Math.max(0,   toInt(hoverDelay,       defaults.hoverDelay)),
      tooltipPosition:  tooltipPosition?.value || defaults.tooltipPosition,
      thumbHeight:      Math.max(40,  toInt(thumbHeight,      defaults.thumbHeight)),
      popupWidth:       Math.max(180, toInt(popupWidth,       defaults.popupWidth)),
      popupImgMaxWidth: Math.max(50,  toInt(popupImgMaxWidth, defaults.popupImgMaxWidth)),
      popupImgMaxHeight:Math.max(50,  toInt(popupImgMaxHeight,defaults.popupImgMaxHeight)),
      fishTableMaxWidth: Math.max(200, toInt(fishTableMaxWidth, defaults.fishTableMaxWidth)) // ← NEW

    };
    chrome.storage.sync.set(data, () => {
      statusEl.textContent = "Saved!";
      setTimeout(() => (statusEl.textContent = ""), 1200);
    });
  });

  // Load and display recent unlisted species
  function loadRecentSpecies() {
    const RECENT_SPECIES_KEY = "rfsp_recent_unlisted_by_region";
    console.log("[Options] Loading recent species...");
    chrome.storage.local.get({ [RECENT_SPECIES_KEY]: [] }, (result) => {
      const recentSpecies = result[RECENT_SPECIES_KEY] || [];
      console.log("[Options] Loaded species:", recentSpecies);
      const listEl = document.getElementById("recentSpeciesList");

      if (!listEl) {
        console.log("[Options] List element not found!");
        return;
      }

      if (recentSpecies.length === 0) {
        console.log("[Options] No species to display");
        listEl.innerHTML = '<p style="color: #888; font-style: italic;">No recent unlisted species yet.</p>';
        return;
      }

      console.log("[Options] Displaying", recentSpecies.length, "species");

      listEl.innerHTML = recentSpecies.map((species, index) => {
        const date = species.timestamp ? new Date(species.timestamp).toLocaleDateString() : '';
        return `
          <div class="species-item">
            <div>
              <span class="species-name">${escapeHtml(species.name)}</span>
              ${species.scientific ? `<span class="species-scientific">${escapeHtml(species.scientific)}</span>` : ''}
            </div>
            <div>
              ${date ? `<span class="species-date">${date}</span>` : ''}
              <button class="species-delete" data-index="${index}" title="Remove this species">Remove</button>
            </div>
          </div>
        `;
      }).join('');

      // Add click handlers for delete buttons
      listEl.querySelectorAll('.species-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const index = parseInt(e.target.dataset.index);
          deleteSpecies(index);
        });
      });
    });
  }

  function deleteSpecies(index) {
    const RECENT_SPECIES_KEY = "rfsp_recent_unlisted_by_region";
    console.log("[Options] Deleting species at index:", index);

    chrome.storage.local.get({ [RECENT_SPECIES_KEY]: [] }, (result) => {
      let recentSpecies = result[RECENT_SPECIES_KEY] || [];

      if (index >= 0 && index < recentSpecies.length) {
        const deletedSpecies = recentSpecies[index];
        console.log("[Options] Removing species:", deletedSpecies.name);

        // Remove the species at the specified index
        recentSpecies.splice(index, 1);

        // Save back to storage
        chrome.storage.local.set({ [RECENT_SPECIES_KEY]: recentSpecies }, () => {
          console.log("[Options] Species deleted successfully");
          loadRecentSpecies(); // Refresh the display
        });
      }
    });
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Load recent species on page load
  loadRecentSpecies();

  // Refresh recent species list when storage changes
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.rfsp_recent_unlisted_by_region) {
      loadRecentSpecies();
    }
  });
});
