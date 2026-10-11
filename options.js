// options.js — REEF DataEntry Suite settings page

function $(id) { return document.getElementById(id); }
function toInt(el, def) {
  const n = parseInt(el?.value, 10);
  return Number.isFinite(n) ? n : def;
}

document.addEventListener("DOMContentLoaded", () => {
  const hoverDelay             = $("hoverDelay");
  const tooltipPosition        = $("tooltipPosition");
  const thumbHeight            = $("thumbHeight");
  const popupWidth             = $("popupWidth");
  const popupImgMaxWidth       = $("popupImgMaxWidth");
  const popupImgMaxHeight      = $("popupImgMaxHeight");
  const saveBtn                = $("save");
  const statusEl               = $("status");
  const fishTableMaxWidth      = $("fishTableMaxWidth");
  const showPreviewsOnUnlisted = $("showPreviewsOnUnlisted");
  const autoFitFrame           = $("autoFitFrame");
  const fishFontSize           = $("fishFontSize");
  const fishFontSizeValue      = $("fishFontSizeValue");

  const defaults = {
    hoverDelay: 100,
    tooltipPosition: "right",
    thumbHeight: 90,
    popupWidth: 320,
    popupImgMaxWidth: 300,
    popupImgMaxHeight: 200,
    fishTableMaxWidth: 500,
    showPreviewsOnUnlisted: true,  // Show previews on unlisted pages by default
    autoFitFrame: true,            // Grow the data-entry iframe to fit its content
    fishFontSize: 14
  };

  // Font size is a live slider: it saves as you drag.
  function showFishFontSize(size) {
    if (fishFontSize) fishFontSize.value = size;
    if (fishFontSizeValue) fishFontSizeValue.textContent = size;
  }
  fishFontSize?.addEventListener("input", () => {
    const size = Number(fishFontSize.value) || defaults.fishFontSize;
    showFishFontSize(size);
    chrome.storage.sync.set({ fishFontSize: size });
  });

  chrome.storage.sync.get(defaults, (items) => {
    if (hoverDelay)        hoverDelay.value        = items.hoverDelay;
    if (tooltipPosition)   tooltipPosition.value   = items.tooltipPosition;
    if (thumbHeight)       thumbHeight.value       = items.thumbHeight;
    if (popupWidth)        popupWidth.value        = items.popupWidth;
    if (popupImgMaxWidth)  popupImgMaxWidth.value  = items.popupImgMaxWidth;
    if (popupImgMaxHeight) popupImgMaxHeight.value = items.popupImgMaxHeight;
    if (fishTableMaxWidth) fishTableMaxWidth.value = items.fishTableMaxWidth ?? defaults.fishTableMaxWidth;
    if (showPreviewsOnUnlisted) showPreviewsOnUnlisted.checked = items.showPreviewsOnUnlisted ?? defaults.showPreviewsOnUnlisted;
    if (autoFitFrame) autoFitFrame.checked = items.autoFitFrame ?? defaults.autoFitFrame;
    showFishFontSize(Number(items.fishFontSize ?? defaults.fishFontSize) || defaults.fishFontSize);
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;
    if (changes.hoverDelay && hoverDelay)                     hoverDelay.value                     = changes.hoverDelay.newValue;
    if (changes.tooltipPosition && tooltipPosition)           tooltipPosition.value                = changes.tooltipPosition.newValue;
    if (changes.thumbHeight && thumbHeight)                   thumbHeight.value                    = changes.thumbHeight.newValue;
    if (changes.popupWidth && popupWidth)                     popupWidth.value                     = changes.popupWidth.newValue;
    if (changes.popupImgMaxWidth && popupImgMaxWidth)         popupImgMaxWidth.value               = changes.popupImgMaxWidth.newValue;
    if (changes.popupImgMaxHeight && popupImgMaxHeight)       popupImgMaxHeight.value              = changes.popupImgMaxHeight.newValue;
    if (changes.showPreviewsOnUnlisted && showPreviewsOnUnlisted) showPreviewsOnUnlisted.checked   = changes.showPreviewsOnUnlisted.newValue;
    if (changes.autoFitFrame && autoFitFrame)                 autoFitFrame.checked                 = changes.autoFitFrame.newValue;
    if (changes.fishFontSize)                                 showFishFontSize(changes.fishFontSize.newValue);
  });

  saveBtn.addEventListener("click", () => {
    const data = {
      hoverDelay:            Math.max(0,   toInt(hoverDelay,       defaults.hoverDelay)),
      tooltipPosition:       tooltipPosition?.value || defaults.tooltipPosition,
      thumbHeight:           Math.max(40,  toInt(thumbHeight,      defaults.thumbHeight)),
      popupWidth:            Math.max(180, toInt(popupWidth,       defaults.popupWidth)),
      popupImgMaxWidth:      Math.max(50,  toInt(popupImgMaxWidth, defaults.popupImgMaxWidth)),
      popupImgMaxHeight:     Math.max(50,  toInt(popupImgMaxHeight,defaults.popupImgMaxHeight)),
      fishTableMaxWidth:     Math.max(200, toInt(fishTableMaxWidth, defaults.fishTableMaxWidth)),
      showPreviewsOnUnlisted: showPreviewsOnUnlisted?.checked ?? defaults.showPreviewsOnUnlisted,
      autoFitFrame:           autoFitFrame?.checked ?? defaults.autoFitFrame
    };
    chrome.storage.sync.set(data, () => {
      statusEl.textContent = "Saved!";
      setTimeout(() => (statusEl.textContent = ""), 1200);
    });
  });

  // Load and display recent unlisted species
  function loadRecentSpecies() {
    const RECENT_SPECIES_KEY = "rfsp_recent_unlisted_by_region";
    chrome.storage.local.get({ [RECENT_SPECIES_KEY]: [] }, (result) => {
      const recentSpecies = result[RECENT_SPECIES_KEY] || [];
      const listEl = document.getElementById("recentSpeciesList");

      if (!listEl) {
        return;
      }

      if (recentSpecies.length === 0) {
        listEl.innerHTML = '<p style="color: #888; font-style: italic;">No recent unlisted species yet.</p>';
        return;
      }

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
    chrome.storage.local.get({ [RECENT_SPECIES_KEY]: [] }, (result) => {
      let recentSpecies = result[RECENT_SPECIES_KEY] || [];

      if (index >= 0 && index < recentSpecies.length) {
        // Remove the species at the specified index
        recentSpecies.splice(index, 1);

        // Save back to storage
        chrome.storage.local.set({ [RECENT_SPECIES_KEY]: recentSpecies }, () => {
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
