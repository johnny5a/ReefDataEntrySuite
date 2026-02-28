// content-unlisted.js — REEF DataEntry Suite Unlisted Species Improvements
// Enhances unlisted species search and selection with recent species tracking
// v1.0.0

(function rfspUnlistedImprovements() {
  const LOG = (...args) => console.log("[REEF Suite - Unlisted]", ...args);
  const RECENT_SPECIES_KEY = "rfsp_recent_unlisted_by_region";
  const MAX_RECENT = 20;

  // Announce that script is loading
  LOG("Script loaded on URL:", window.location.href);

  let recentSpecies = [];
  let currentRegion = null;

  // Detect current region from the page
  function detectRegion() {
    // Try to find region from various places in the page

    // Method 1: Look for region in URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    let region = urlParams.get('region') || urlParams.get('geog') || urlParams.get('zonecode');

    if (region) {
      LOG("Found region in URL:", region);
      return region;
    }

    // Method 2: Look for region in page content
    // Check for select element with name "region"
    const regionSelect = document.querySelector('select[name="region"]');
    if (regionSelect && regionSelect.value) {
      region = regionSelect.value;
      LOG("Found region in select:", region);
      return region;
    }

    // Method 3: Look for hidden input with region/zonecode
    const regionInput = document.querySelector('input[name="region"], input[name="zonecode"], input[name="geog"]');
    if (regionInput && regionInput.value) {
      region = regionInput.value;
      LOG("Found region in input:", region);
      return region;
    }

    // Method 4: Look for text content mentioning region
    const bodyText = document.body.textContent;
    const regionMatch = bodyText.match(/Region:\s*([^<\n]+)/i) || bodyText.match(/Zone:\s*([^<\n]+)/i);
    if (regionMatch) {
      region = regionMatch[1].trim();
      LOG("Found region in text:", region);
      return region;
    }

    // Fallback: Check if we're in an iframe and try to get from parent
    if (window !== window.top) {
      try {
        const parentUrl = new URLSearchParams(window.parent.location.search);
        region = parentUrl.get('region') || parentUrl.get('geog') || parentUrl.get('zonecode');
        if (region) {
          LOG("Found region in parent URL:", region);
          return region;
        }
      } catch (e) {
        // Cross-origin iframe, can't access parent
      }
    }

    LOG("Could not detect region, using 'unknown'");
    return 'unknown';
  }

  // Load recent species from storage (no region filtering)
  function loadRecentSpecies() {
    chrome.storage.local.get({ [RECENT_SPECIES_KEY]: [] }, (result) => {
      recentSpecies = result[RECENT_SPECIES_KEY] || [];
      LOG("Loaded recent species:", recentSpecies.length);
      if (recentSpecies.length > 0) {
        createRecentSpeciesPanel();
      }
    });
  }

  // Save species to recent list
  function addToRecentSpecies(speciesData, callback) {
    LOG("addToRecentSpecies called with:", speciesData);
    chrome.storage.local.get({ [RECENT_SPECIES_KEY]: [] }, (result) => {
      let speciesList = result[RECENT_SPECIES_KEY] || [];
      LOG("Current species list length:", speciesList.length);

      // Remove if already exists (to move to top)
      // Match by name AND scientific name (not just ID, since IDs may be auto-generated)
      speciesList = speciesList.filter(s => {
        const nameMatch = s.name.toLowerCase() === speciesData.name.toLowerCase();
        const scientificMatch = s.scientific && speciesData.scientific
          ? s.scientific.toLowerCase() === speciesData.scientific.toLowerCase()
          : false;

        // Remove if name matches, or if both have scientific names and they match
        return !(nameMatch || scientificMatch);
      });

      LOG("After deduplication, list length:", speciesList.length);

      // Add to front
      speciesList.unshift(speciesData);

      // Keep only MAX_RECENT
      if (speciesList.length > MAX_RECENT) {
        speciesList = speciesList.slice(0, MAX_RECENT);
      }

      recentSpecies = speciesList;

      chrome.storage.local.set({ [RECENT_SPECIES_KEY]: speciesList }, () => {
        LOG("Saved recent species, new count:", speciesList.length);
        LOG("First species:", speciesList[0]);
        createRecentSpeciesPanel();
        if (callback) callback();
      });
    });
  }

  // Synchronous version that takes a callback
  function addToRecentSpeciesSync(speciesData, callback) {
    addToRecentSpecies(speciesData, callback);
  }

  // Create recent species quick-access panel
  function createRecentSpeciesPanel() {
    LOG("createRecentSpeciesPanel called, recentSpecies.length:", recentSpecies.length);

    let panel = document.getElementById("rfsp-recent-species");

    if (!panel && recentSpecies.length > 0) {
      panel = document.createElement("div");
      panel.id = "rfsp-recent-species";
      panel.className = "rfsp-recent-panel";

      // Find insertion point (before the search box)
      const searchInput = document.querySelector('input[name="AddFish"]');
      LOG("Search input found:", !!searchInput);

      if (searchInput && searchInput.parentElement) {
        searchInput.parentElement.insertBefore(panel, searchInput);
        LOG("Panel inserted before search input");
      } else {
        // Fallback: Try to find any form or just prepend to body
        const form = document.querySelector('form');
        if (form) {
          form.insertBefore(panel, form.firstChild);
          LOG("Panel inserted at top of form");
        } else {
          document.body.insertBefore(panel, document.body.firstChild);
          LOG("Panel inserted at top of body");
        }
      }
    }

    if (!panel) {
      LOG("Panel not created - no recent species or panel already exists");
      return;
    }

    // Update panel content
    const regionDisplay = currentRegion && currentRegion !== 'unknown' ? ` (${currentRegion})` : '';
    panel.innerHTML = `
      <div class="rfsp-recent-header">
        <h3>Recently Added Species${regionDisplay}</h3>
        <button type="button" class="rfsp-clear-recent">Clear All</button>
      </div>
      <div class="rfsp-recent-list">
        ${recentSpecies.map((species, index) => `
          <button
            type="button"
            class="rfsp-recent-item"
            data-index="${index}"
            data-species-id="${species.id}"
            data-species-name="${species.name}"
            title="Click to add ${species.name}"
          >
            <span class="rfsp-recent-name">${species.name}</span>
            ${species.scientific ? `<span class="rfsp-recent-sci">${species.scientific}</span>` : ''}
          </button>
        `).join('')}
      </div>
    `;

    // Attach event listeners
    panel.querySelector('.rfsp-clear-recent').addEventListener('click', clearRecentSpecies);
    panel.querySelectorAll('.rfsp-recent-item').forEach(item => {
      item.addEventListener('click', (e) => {
        const index = parseInt(item.dataset.index);
        const species = recentSpecies[index];
        if (species) {
          selectSpecies(species);
        }
      });
    });
  }

  // Clear recent species
  function clearRecentSpecies() {
    if (confirm('Clear all recently added species?')) {
      recentSpecies = [];
      chrome.storage.local.set({ [RECENT_SPECIES_KEY]: [] }, () => {
        const panel = document.getElementById("rfsp-recent-species");
        if (panel) panel.remove();
        LOG("Cleared recent species");
      });
    }
  }

  // Select a species and add it immediately
  function selectSpecies(speciesData) {
    LOG("selectSpecies called with:", speciesData.name);

    // Update timestamp to move to top of recent list
    addToRecentSpecies(speciesData);

    // Use search-and-auto-click method
    triggerSpeciesAdd(speciesData);
  }

  // Trigger the actual species add action
  function triggerSpeciesAdd(speciesData) {
    LOG("Triggering species add:", speciesData.name);

    // Find and populate the search box
    const searchInput = document.querySelector('input[name="AddFish"]');
    if (!searchInput) {
      LOG("ERROR: Search input not found on page");
      return;
    }

    LOG("Found search input, populating with:", speciesData.name);

    // Set the value
    searchInput.value = speciesData.name;

    // Trigger the search by simulating keyup event
    const keyupEvent = new Event('keyup', { bubbles: true, cancelable: true });
    searchInput.dispatchEvent(keyupEvent);

    // Also try input event in case that's what triggers search
    const inputEvent = new Event('input', { bubbles: true, cancelable: true });
    searchInput.dispatchEvent(inputEvent);

    LOG("Search triggered, waiting for results...");

    // Wait for results, then try to click the first matching result
    setTimeout(() => {
      // First, try to find the results container
      let resultsContainer = document.getElementById('results');

      if (!resultsContainer || resultsContainer.children.length === 0) {
        // Fallback: look for any container that might have results
        resultsContainer = document.querySelector('.results, #search-results, .search-results, [id*="result"]');
        LOG("Using fallback results container:", resultsContainer?.id || resultsContainer?.className);
      }

      // If still no container, search the whole page but be more selective
      const searchScope = resultsContainer || document.body;
      LOG("Searching for clickable elements in:", searchScope === document.body ? 'body' : 'results container');

      // Find all potentially clickable elements
      const allElements = Array.from(searchScope.querySelectorAll('a, button, div, span, td, tr'));
      LOG("Total elements found:", allElements.length);

      // Filter to actual clickable species result elements
      const clickableElements = allElements.filter(el => {
        // Skip if it's in the recently added panel
        if (el.closest('.rfsp-recent-panel')) return false;

        // Must have pointer cursor
        const style = window.getComputedStyle(el);
        if (style.cursor !== 'pointer') return false;

        // Must have meaningful text
        const text = el.textContent.trim();
        if (text.length === 0) return false;

        // Skip UI elements
        if (text === 'Clear All' || text === '📍' || text === '❌' || text === 'View on FishBase') return false;

        // Skip FishBase links
        const href = el.getAttribute('href') || '';
        if (href.includes('fishbase.se')) return false;

        // For elements in results container, must be marked as enhanced or have data attributes
        if (resultsContainer && resultsContainer !== document.body) {
          return true; // If it's in results container and passed other checks, it's good
        }

        // For body search, only include if it looks like a species result
        return el.dataset.rfspEnhanced || el.dataset.speciesId || el.dataset.speciesName;
      });

      LOG("Found", clickableElements.length, "valid clickable elements");

      if (clickableElements.length === 0) {
        LOG("ERROR: No clickable elements found after search. Check if search returned results.");
        return;
      }

      // Try to find the best match for our species
      const speciesNameLower = speciesData.name.toLowerCase();
      const scientificLower = speciesData.scientific ? speciesData.scientific.toLowerCase() : '';

      let bestMatch = null;
      for (const el of clickableElements) {
        const text = el.textContent.toLowerCase();

        // Exact name match is best
        if (text.includes(speciesNameLower)) {
          bestMatch = el;
          LOG("Found exact name match");
          break;
        }

        // Scientific name match is also good
        if (scientificLower && text.includes(scientificLower)) {
          bestMatch = el;
          LOG("Found scientific name match");
          // Don't break - keep looking for exact name match
        }
      }

      // If no match found, take the first element
      const elementToClick = bestMatch || clickableElements[0];

      LOG("Clicking element:", {
        text: elementToClick.textContent.substring(0, 100),
        tag: elementToClick.tagName,
        href: elementToClick.getAttribute('href'),
        onclick: elementToClick.getAttribute('onclick')
      });

      elementToClick.click();
    }, 750); // Wait 750ms for search results to appear
  }

  // Enhance search results with keyboard navigation
  function enhanceSearchResults() {
    const results = document.getElementById('results');
    if (!results) return;

    // Add keyboard navigation to results
    let currentIndex = -1;
    const resultItems = Array.from(results.querySelectorAll('a, button'));

    if (resultItems.length === 0) return;

    document.addEventListener('keydown', (e) => {
      // Only handle if results are visible
      if (results.style.visibility === 'hidden') return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        currentIndex = Math.min(currentIndex + 1, resultItems.length - 1);
        highlightResult(resultItems, currentIndex);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        currentIndex = Math.max(currentIndex - 1, 0);
        highlightResult(resultItems, currentIndex);
      } else if (e.key === 'Enter' && currentIndex >= 0) {
        e.preventDefault();
        resultItems[currentIndex].click();
      }
    });
  }

  function highlightResult(items, index) {
    items.forEach((item, i) => {
      if (i === index) {
        item.classList.add('rfsp-result-highlight');
        item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      } else {
        item.classList.remove('rfsp-result-highlight');
      }
    });
  }

  // Observe search results for changes
  function observeResults() {
    const results = document.getElementById('results');
    if (!results) {
      LOG("Results div not found, will try again in 500ms");
      // Try again after delay
      setTimeout(observeResults, 500);
      return;
    }

    LOG("Found results div, setting up observer");

    const observer = new MutationObserver((mutations) => {
      LOG("Mutation detected in results div");
      for (const mutation of mutations) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          LOG("Child nodes added, enhancing result items");
          enhanceResultItems();
        }
      }
    });

    observer.observe(results, { childList: true, subtree: true });

    // Also observe the whole document body for changes (in case results div gets replaced)
    let bodyObserverTimeout;
    const bodyObserver = new MutationObserver(() => {
      // Throttle to avoid excessive calls
      clearTimeout(bodyObserverTimeout);
      bodyObserverTimeout = setTimeout(() => {
        // Check if any new links appeared
        const allLinks = document.querySelectorAll('a, button');
        const unenhancedLinks = Array.from(allLinks).filter(link => !link.dataset.rfspEnhanced);
        if (unenhancedLinks.length > 0) {
          LOG("Detected", unenhancedLinks.length, "new unenhanced links");
          enhanceResultItems();
        }
      }, 300);
    });
    bodyObserver.observe(document.body, { childList: true, subtree: true });

    enhanceResultItems();
  }

  // Enhance individual result items
  function enhanceResultItems() {
    let results = document.getElementById('results');
    let containerType = 'results-id';

    if (results) {
      LOG("Found #results element");
      LOG("#results innerHTML length:", results.innerHTML.length);
      const linksInResults = results.querySelectorAll('a').length;
      LOG("#results has links:", linksInResults);
      LOG("#results has buttons:", results.querySelectorAll('button').length);
      LOG("#results direct children:", results.children.length);
      if (results.children.length > 0) {
        LOG("First child tag:", results.children[0].tagName);
      }

      // If #results is empty or has no links, ignore it and search the whole page
      if (results.innerHTML.length < 50 || linksInResults === 0) {
        LOG("#results is empty or has no links, searching entire page instead");
        results = null;
      }
    }

    // Fallback: look for any div/container that might contain results
    if (!results) {
      results = document.querySelector('.results, #search-results, .search-results, [id*="result"], [class*="result"]');
      if (results) {
        containerType = 'results-class';
        LOG("Found results container with selector:", results.id || results.className);

        // Check if this container is also empty
        const linksInFallback = results.querySelectorAll('a, button').length;
        LOG("Fallback container has", linksInFallback, "links/buttons");
        if (linksInFallback === 0) {
          LOG("Fallback container is also empty, ignoring it");
          results = null;
        }
      }
    }

    if (!results) {
      LOG("Results container not found, trying to enhance all links in document");
      // Ultimate fallback: enhance all links on the page
      results = document.body;
      containerType = 'body';
    }

    // Find all fish links/buttons in results - try multiple selectors
    // REEF may use divs/spans with onclick handlers instead of actual links
    let items = results.querySelectorAll('a, button, [onclick], [data-species-id], .species-result, .search-result');

    // Also look for any clickable elements (cursor:pointer)
    const clickableElements = Array.from(results.querySelectorAll('div, span, td, tr')).filter(el => {
      const style = window.getComputedStyle(el);
      return style.cursor === 'pointer' && el.textContent.trim().length > 0;
    });

    // Combine all potential items
    const allItems = new Set([...items, ...clickableElements]);
    items = Array.from(allItems);

    const alreadyEnhanced = Array.from(items).filter(item => item.dataset.rfspEnhanced).length;
    LOG("Container type:", containerType);
    LOG("Found", items.length, "items to check for enhancement");
    LOG("Already enhanced:", alreadyEnhanced, "New:", items.length - alreadyEnhanced);
    LOG("Clickable elements found:", clickableElements.length);

    let enhancedCount = 0;
    items.forEach(item => {
      if (item.dataset.rfspEnhanced) return;
      item.dataset.rfspEnhanced = '1';
      enhancedCount++;

      // Extract species data from the link
      const speciesData = extractSpeciesData(item);
      if (!speciesData) return;

      item.dataset.speciesId = speciesData.id;
      item.dataset.speciesName = speciesData.name;

      // Override click behavior to save species
      item.addEventListener('click', (e) => {
        LOG("Species link clicked:", speciesData);
        const targetUrl = item.href;
        const hasHref = targetUrl && targetUrl !== '';

        if (hasHref) {
          // For actual links, prevent navigation and do it ourselves after saving
          e.preventDefault();
          e.stopPropagation();

          LOG("Saving to recent species before navigation:", speciesData);
          addToRecentSpeciesSync(speciesData, () => {
            // Navigate after save completes
            LOG("Navigation to:", targetUrl);
            window.location.href = targetUrl;
          });
        } else {
          // For non-link elements (div, span with onclick), just save but let original click happen
          LOG("Saving to recent species (non-link element):", speciesData);
          addToRecentSpecies(speciesData);
          // Let the original onclick handler execute
        }
      }, true);
    });

    LOG("Enhanced", enhancedCount, "new items with click handlers");
  }

  // Extract species data from a result item
  function extractSpeciesData(element) {
    // This needs to be adapted to match REEF's actual HTML structure
    const text = element.textContent.trim();
    const href = element.getAttribute('href') || '';
    const onclick = element.getAttribute('onclick') || '';
    const tagName = element.tagName.toLowerCase();

    LOG("Extracting species data from element:", { text, href, onclick, tagName });

    // Filter out invalid elements:

    // If it's a link element, apply href filters
    if (href) {
      if (href.includes('fishbase.se')) {
        LOG("Skipping - FishBase external link");
        return null;
      }

      // For links, only accept data.reef.org links
      if (tagName === 'a' && !href.includes('data.reef.org')) {
        LOG("Skipping - not a REEF data link");
        return null;
      }
    }

    // Skip if it's a known UI element
    if (text === 'Clear All' || text === '📍' || text === '❌' || text === 'View on FishBase') {
      LOG("Skipping - UI element");
      return null;
    }

    // Skip if it's from the recently added panel (has specific class or parent)
    if (element.closest('.rfsp-recent-panel')) {
      LOG("Skipping - recently added panel item");
      return null;
    }

    // For non-link elements, must have onclick or be clickable
    if (!href && !onclick && window.getComputedStyle(element).cursor !== 'pointer') {
      LOG("Skipping - not clickable");
      return null;
    }

    // Try to parse species ID from href, onclick, or data attributes
    let id = null;
    const idMatch = href.match(/[?&]id=(\d+)/i) || href.match(/\/(\d+)\/?$/);
    if (idMatch) {
      id = idMatch[1];
    } else if (onclick) {
      // Try to extract ID from onclick handler
      const onclickIdMatch = onclick.match(/id[=:]\s*['"]?(\d+)/i);
      if (onclickIdMatch) id = onclickIdMatch[1];
    }

    if (!id) {
      id = Date.now().toString();
    }

    // Try to extract common name and scientific name
    // The text might be in format: "0177Reef ScorpionfishScorpaenodes caribbaeusScorpionfish"
    // or similar with ID, common name, scientific name, and possibly family name all concatenated

    // Log the HTML structure to understand it better
    LOG("Element innerHTML:", element.innerHTML.substring(0, 200));
    LOG("Element children:", element.children.length);

    // Try to find child elements that might contain the names separately
    let name = '';
    let scientific = '';

    // Strategy 1: Look for specific child elements (spans, divs, etc)
    const childElements = Array.from(element.querySelectorAll('*'));
    LOG("Child elements:", childElements.map(el => ({tag: el.tagName, text: el.textContent.trim().substring(0, 50)})));

    // Try to identify which child contains what
    if (childElements.length > 0) {
      for (const child of childElements) {
        const childText = child.textContent.trim();
        // Skip empty or very short text
        if (childText.length < 3) continue;

        // Scientific names are typically in italics or have specific formatting
        const isItalic = window.getComputedStyle(child).fontStyle === 'italic';
        const className = child.className || '';

        // Common patterns for scientific names
        const looksLikeScientific = /^[A-Z][a-z]+ [a-z]+/.test(childText); // "Genus species" format

        if ((isItalic || looksLikeScientific || className.includes('scientific')) && !scientific) {
          scientific = childText.replace(/^\d+/, '').trim(); // Remove leading numbers
          LOG("Found scientific name from child:", scientific);
        } else if (!name && childText.length > 2 && !childText.match(/^\d+$/)) {
          // Remove leading numbers and extract just the common name
          let cleaned = childText.replace(/^\d+/, '').trim();

          // If this contains the scientific name, try to split it out
          if (looksLikeScientific && cleaned.includes(' ')) {
            // Find where the scientific name starts (first capital letter after the first word)
            const match = cleaned.match(/^([A-Z][a-z\s]+?)([A-Z][a-z]+ [a-z]+.*)/);
            if (match) {
              name = match[1].trim();
              if (!scientific) scientific = match[2].trim();
              LOG("Split common and scientific from same element:", { name, scientific });
            } else {
              name = cleaned;
            }
          } else {
            name = cleaned;
          }
          LOG("Found common name from child:", name);
        }
      }
    }

    // Strategy 2: If we didn't get a good name from children, parse the concatenated text
    if (!name || name.length < 3) {
      LOG("Parsing concatenated text:", text);

      // Remove leading numbers/codes (like "0177")
      let cleanText = text.replace(/^\d+/, '').trim();

      // Try to identify where scientific name starts
      // Scientific names follow pattern: Genus species (two words, first capitalized)
      const scientificMatch = cleanText.match(/([A-Z][a-z]+ [a-z]+[a-z\s]*?)(?:[A-Z][a-z]+|$)/);

      if (scientificMatch) {
        // Find the position of the scientific name
        const scientificStart = cleanText.indexOf(scientificMatch[1]);

        if (scientificStart > 0) {
          // Everything before scientific name is the common name
          name = cleanText.substring(0, scientificStart).trim();
          scientific = scientificMatch[1].trim();
          LOG("Parsed from concatenated:", { name, scientific });
        } else {
          // Scientific name is at the start, take everything after as common name
          scientific = scientificMatch[1].trim();
          name = cleanText.substring(scientificMatch[1].length).trim();
          // If name still contains the scientific part, clean it
          if (name.startsWith(scientific)) {
            name = name.substring(scientific.length).trim();
          }
          LOG("Scientific at start:", { name, scientific });
        }
      } else {
        // Can't find scientific name pattern, just use the cleaned text as name
        name = cleanText;
        LOG("Using cleaned text as name:", name);
      }
    }

    if (!name || name.length < 3) {
      LOG("Failed to extract species name from:", text);
      return null;
    }

    const speciesData = {
      id,
      name,
      scientific,
      timestamp: Date.now()  // Add timestamp for sorting/display
    };

    LOG("Extracted species data:", speciesData);
    return speciesData;
  }

  // Inject CSS for all enhancements
  function injectStyles() {
    if (document.getElementById('rfsp-unlisted-styles')) return;

    const style = document.createElement('style');
    style.id = 'rfsp-unlisted-styles';
    style.textContent = `
      /* Recent species panel */
      .rfsp-recent-panel {
        background: #f8f9fa;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        padding: 12px;
        margin-bottom: 16px;
      }

      .rfsp-recent-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
      }

      .rfsp-recent-header h3 {
        margin: 0;
        font-size: 14px;
        font-weight: 600;
        color: #333;
      }

      .rfsp-clear-recent {
        background: transparent;
        border: 1px solid #ccc;
        border-radius: 4px;
        padding: 4px 8px;
        font-size: 12px;
        cursor: pointer;
        color: #666;
      }

      .rfsp-clear-recent:hover {
        background: #fff;
        border-color: #999;
      }

      .rfsp-recent-list {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .rfsp-recent-item {
        background: #fff;
        border: 1px solid #d1d5db;
        border-radius: 6px;
        padding: 6px 10px;
        cursor: pointer;
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        transition: all 0.2s;
      }

      .rfsp-recent-item:hover {
        background: #e0f2fe;
        border-color: #0284c7;
        transform: translateY(-1px);
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      }

      .rfsp-recent-name {
        font-weight: 500;
        color: #111;
        font-size: 13px;
      }

      .rfsp-recent-sci {
        font-size: 11px;
        color: #666;
        font-style: italic;
      }

      /* Keyboard navigation highlight */
      .rfsp-result-highlight {
        background: #fef3c7 !important;
        outline: 2px solid #f59e0b;
        outline-offset: -2px;
      }
    `;

    (document.head || document.documentElement).appendChild(style);
  }

  // Initialize everything
  function initialize() {
    LOG("Initializing unlisted species improvements...");

    injectStyles();
    loadRecentSpecies();
    observeResults();

    LOG("Initialization complete");
  }

  // Expose test function to window for debugging
  window.rfspTestAddSpecies = function(name, scientific) {
    const testSpecies = {
      id: Date.now().toString(),
      name: name || "Test Fish",
      scientific: scientific || "Testus fishus",
      timestamp: Date.now()
    };
    LOG("Adding test species:", testSpecies);
    addToRecentSpecies(testSpecies);
  };

  window.rfspShowRegion = function() {
    LOG("Current region:", currentRegion || detectRegion());
  };

  window.rfspShowRecent = function() {
    chrome.storage.local.get({ [RECENT_SPECIES_KEY]: [] }, (result) => {
      LOG("All stored recent species:", result[RECENT_SPECIES_KEY]);
    });
  };

  // Announce script availability
  window.__RFSP_UNLISTED_LOADED__ = true;
  LOG("✅ Extension script successfully loaded and ready");
  LOG("Available test commands: rfspTestAddSpecies(), rfspShowRecent(), rfspShowRegion()");

  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize, { once: true });
  } else {
    initialize();
  }
})();
