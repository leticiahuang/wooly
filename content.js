// Utility function to clamp values
function clamp(val, min, max) {
  return Math.min(max, Math.max(min, val));
}

function injectMascotToggleStyles() {
  if (document.getElementById('wooly-toggle-style')) return;

  const style = document.createElement('style');
  style.id = 'wooly-toggle-style';
  style.textContent = `
    .wooly-mascot-container{
      position: fixed;
      right: 18px;
      bottom: 18px;
      z-index: 10000;
    }

    /* Toggle wrapper sits ABOVE the mascot */
    .wooly-filter-toggle-wrap{
      position: absolute;
      right: 0;
      bottom: 72px; /* above icon */
      display: flex;
      align-items: center;
      gap: 10px;

      background: rgba(255,255,255,0.95);
      border: 1px solid rgba(0,0,0,0.08);
      border-radius: 999px;
      padding: 8px 10px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.18);

      opacity: 0;
      transform: translateY(8px);
      pointer-events: none;
      transition: opacity 150ms ease, transform 150ms ease;
      user-select: none;
      white-space: nowrap;
    }

    /* Only show on hover of mascot container OR hover of toggle itself */
    .wooly-mascot-container:hover .wooly-filter-toggle-wrap,
    .wooly-filter-toggle-wrap:hover{
      opacity: 1;
      transform: translateY(0);
      pointer-events: auto;
    }

    .wooly-filter-toggle-text{
      font-size: 12px;
      font-weight: 600;
      color: #1E7D3A;
      margin: 0;
    }

    /* Actual swipe toggle */
    .wooly-switch{
      width: 44px;
      height: 24px;
      border-radius: 999px;
      background: #CFEFD8;
      border: 1px solid #A9E2BA;
      position: relative;
      cursor: pointer;
      transition: background 150ms ease, border-color 150ms ease;
      flex: 0 0 auto;
    }

    .wooly-switch[data-on="true"]{
      background: #35C46A;
      border-color: #2EAD5C;
    }

    .wooly-switch-knob{
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: #fff;
      position: absolute;
      top: 50%;
      left: 3px;
      transform: translateY(-50%);
      box-shadow: 0 2px 8px rgba(0,0,0,0.18);
      transition: left 150ms ease;
    }

    .wooly-switch[data-on="true"] .wooly-switch-knob{
      left: 23px;
    }
  `;
  document.head.appendChild(style);
}


// Show quality filter toggle modal
function showQualityFilterToggle() {
  // Check current filter state
  chrome.storage.sync.get(['filterHighQualityOnly'], (data) => {
    const isFiltered = data.filterHighQualityOnly || false;
    
    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
    `;
    
    // Create modal box
    const modal = document.createElement('div');
    modal.style.cssText = `
      background: white;
      border-radius: 12px;
      padding: 24px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
      max-width: 300px;
      text-align: center;
    `;
    
    modal.innerHTML = `
      <h2 style="margin: 0 0 16px 0; font-size: 18px; color: #333;">Quality Filter</h2>
      <p style="margin: 0 0 20px 0; font-size: 14px; color: #666;">Show only high-quality items</p>
      
      <label style="display: flex; align-items: center; justify-content: center; gap: 12px; cursor: pointer; margin-bottom: 20px;">
        <input type="checkbox" id="filterToggle" ${isFiltered ? 'checked' : ''} style="width: 20px; height: 20px; cursor: pointer;">
        <span style="font-size: 14px; color: #333;">Show only Good & Excellent</span>
      </label>
      
      <button id="closeFilterModal" style="
        background: #4CAF50;
        color: white;
        border: none;
        padding: 10px 20px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
      ">Done</button>
    `;
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    
    // Handle toggle change
    const checkbox = modal.querySelector('#filterToggle');
    checkbox.addEventListener('change', (e) => {
      const filterEnabled = e.target.checked;
      chrome.storage.sync.set({ filterHighQualityOnly: filterEnabled });
      
      // Apply filter immediately
      applyQualityFilter(filterEnabled);
    });
    
    // Close modal
    const closeBtn = modal.querySelector('#closeFilterModal');
    closeBtn.addEventListener('click', () => {
      overlay.remove();
    });
    
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.remove();
      }
    });
  });
}

// Apply quality filter to visible products
function applyQualityFilter(filterEnabled) {
  const config = getSiteConfig();
  const productCards = document.querySelectorAll(config.productCards);
  
  productCards.forEach(card => {
    const ratingButton = card.querySelector('.fabric-rating-button');
    if (ratingButton) {
      const rating = ratingButton.className.match(/fabric-rating-(red|medium|lightGreen|darkGreen)/)?.[1];
      const isHighQuality = rating === 'lightGreen' || rating === 'darkGreen';
      
      if (filterEnabled && !isHighQuality) {
        card.style.display = 'none';
      } else {
        card.style.display = '';
      }
    }
  });
}

// Create and add the floating mascot icon
function createMascotIcon() {
  if (document.querySelector('.wooly-mascot-container')) return;

  injectMascotToggleStyles();

  const container = document.createElement('div');
  container.className = 'wooly-mascot-container';

  // ✅ Toggle UI (above mascot)
  const toggleWrap = document.createElement('div');
  toggleWrap.className = 'wooly-filter-toggle-wrap';
  toggleWrap.innerHTML = `
    <p class="wooly-filter-toggle-text">Only Good & Excellent</p>
    <div class="wooly-switch" role="switch" aria-checked="false" tabindex="0" data-on="false">
      <div class="wooly-switch-knob"></div>
    </div>
  `;

  const icon = document.createElement('div');
  icon.className = 'wooly-mascot-icon';

  const img = document.createElement('img');
  img.src = chrome.runtime.getURL('icons/excellent.png');
  img.alt = 'Wooly';
  icon.appendChild(img);

  container.appendChild(toggleWrap);
  container.appendChild(icon);
  document.body.appendChild(container);

  const sw = toggleWrap.querySelector('.wooly-switch');

  // Load saved state + apply immediately
  chrome.storage.sync.get(['filterHighQualityOnly'], (data) => {
    const enabled = !!data.filterHighQualityOnly;
    sw.dataset.on = String(enabled);
    sw.setAttribute('aria-checked', String(enabled));
    applyQualityFilter(enabled);
  });

  function setSwitch(on) {
    sw.dataset.on = String(on);
    sw.setAttribute('aria-checked', String(on));
    chrome.storage.sync.set({ filterHighQualityOnly: on });
    applyQualityFilter(on);
  }

  function flip() {
    const isOn = sw.dataset.on === 'true';
    setSwitch(!isOn);
  }

  sw.addEventListener('click', (e) => {
    e.stopPropagation();
    flip();
  });

  sw.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      flip();
    }
  });
}


// Site-specific selectors for different retailers
const SITE_CONFIGS = {
  'zara.com': {
    productCards: '.product-grid-product',
    imageContainer: '.product-grid-product-info__media, .media-image',
    productLink: 'a.product-link',
    compositionSelector: '.product-detail-info__composition, .product-detail-extra-info__composition-care',
  },
  'hm.com': {
    productCards: '.product-item, article[class*="product"]',
    imageContainer: '.item-image, .image-container',
    productLink: 'a[href*="/productpage"]',
    compositionSelector: '[class*="composition"], [class*="material"]',
  },
  'uniqlo.com': {
    productCards: '.fr-product-tile, .productTile',
    imageContainer: '.tile-image, .product-tile__image',
    productLink: 'a.product-tile__link',
    compositionSelector: '.product-composition, [data-test="composition"]',
  },
  'asos.com': {
    productCards: 'article[data-auto-id="productTile"]',
    imageContainer: 'a[data-auto-id="productTileImage"]',
    productLink: 'a[data-auto-id="productTileLink"]',
    compositionSelector: '[class*="about-me"], [class*="composition"]',
  },
  'amazon.com': {
    productCards: '[data-component-type="s-search-result"]',
    productLink: 'h2 a.a-link-normal',
    imageContainer: 'img.s-image',
    compositionSelector: '#productDetails_techSpec_section_1, #productDetails_detailBullets_sections1, #detailBullets_feature_div'
  }
};

// Get current site config
function getSiteConfig() {
  const hostname = window.location.hostname;
  for (const [site, config] of Object.entries(SITE_CONFIGS)) {
    if (hostname.includes(site)) return config;
  }
  // Default fallback (if you are not in site config)
  return {
    productCards: 'article, .product, .product-card, [class*="product"]',
    imageContainer: 'img, a, .image',
    productLink: 'a',
    compositionSelector: '[class*="composition"], [class*="material"]',
  };
}

// Calculate real score from materials using the new blend scoring formula
function calculateRealScore(materials) {
  if (!materials || materials.length === 0) return null;

  // Use the new sophisticated scoring formula from fabricDatabase
  if (window.fabricDB && window.fabricDB.calculateBlendScore) {
    const score = window.fabricDB.calculateBlendScore(materials);
    console.log('Using new blend scoring formula, score:', score);
    return score;
  }

  // Fallback to simple weighted average using FABRIC_Q if fabricDB not fully loaded
  let totalWeightedQ = 0;
  let totalPercentage = 0;

  for (const mat of materials) {
    const materialName = mat.name.toLowerCase().trim();
    const percentage = mat.percentage || 100;

    // Default quality for unknown fabrics
    let q = 0.40;

    if (window.fabricDB && window.fabricDB.FABRIC_Q) {
      // Try exact match first
      if (window.fabricDB.FABRIC_Q[materialName] !== undefined) {
        q = window.fabricDB.FABRIC_Q[materialName];
      } else {
        // Try partial match
        for (const [fabric, quality] of Object.entries(window.fabricDB.FABRIC_Q)) {
          if (materialName.includes(fabric) || fabric.includes(materialName)) {
            q = quality;
            break;
          }
        }
      }
    }

    totalWeightedQ += q * percentage;
    totalPercentage += percentage;
  }

  if (totalPercentage === 0) return 50;

  // Convert quality (0-1) to score (0-100)
  const avgQ = totalWeightedQ / totalPercentage;
  return Math.round(avgQ * 100);
}

// Determine rating based on score using new 4-tier color system (from rectangle-popup)
function getRatingFromScore(score) {
  // Use scoreColors if available, otherwise fallback
  if (window.scoreColors && window.scoreColors.getColorClassFromScore) {
    return window.scoreColors.getColorClassFromScore(score);
  }
  // Fallback logic matching scoreColors.js
  if (score < 40) return 'red';
  if (score < 65) return 'medium';
  if (score < 85) return 'lightGreen';
  return 'darkGreen';
}

// Get label text from rating (from rectangle-popup)
function getLabelFromRating(rating) {
  const labels = {
    red: 'Poor',
    medium: 'Moderate',
    lightGreen: 'Good',
    darkGreen: 'Excellent'
  };
  return labels[rating] || 'Unknown';
}

// Get dynamic slogan from rating (from rectangle-popup)
function getSloganFromRating(rating) {
  const slogans = {
    red: "Don't get fleeced! <span class=\"sheep-emoji\">🙅</span>",
    medium: "This fabric is a bit... <br> fuzzy <span class=\"sheep-emoji\">🤔</span>",
    lightGreen: "Not baaa-d at all <span class=\"sheep-emoji\">🐑</span>",
    darkGreen: "Shear perfection! <span class=\"sheep-emoji\">✨</span>"
  };
  return slogans[rating] || "Check the details below!";
}

// Get Wooly mascot PNG path based on rating tier
function getMascotFromRating(rating) {
  const mascots = {
    red: 'poor.png',
    medium: 'medium.png',
    lightGreen: 'good.png',
    darkGreen: 'excellent.png'
  };
  const filename = mascots[rating] || 'good.png';
  return chrome.runtime.getURL('icons/' + filename);
}

// Parse material composition from text (from diego)
function parseComposition(text) {
  if (!text) return null;

  const rawMaterials = [];

  // FABRIC_Q keys - the canonical fabric names we recognize
  // Two-word entries MUST come before single-word to match correctly
  const fabricQKeys = [
    'recycled polyester', 'organic cotton', 'recycled cotton',
    'cashmere', 'merino', 'wool', 'silk', 'linen', 'flax', 'hemp', 'cotton',
    'viscose', 'rayon', 'lyocell', 'tencel', 'modal',
    'nylon', 'polyamide', 'polyester', 'acrylic',
    'elastane', 'spandex'
  ];

  // Blacklist of words that are NOT materials (labels, headers, etc.)
  const nonMaterials = [
    'composition', 'material', 'materials', 'fabric', 'fabrics', 'content',
    'care', 'washing', 'instructions', 'made', 'origin', 'country', 'shell',
    'lining', 'outer', 'inner', 'main', 'body', 'exterior', 'interior'
  ];

  // Clean up the text
  const cleanText = text.replace(/[\n\r\t]+/g, ' ').replace(/\s+/g, ' ');

  // Pattern 1: "60% Cotton" or "60 % Cotton" or "60% Compact Cotton"
  const pattern1 = /(\d+)\s*%\s*([a-zA-Z][a-zA-Z\s]{1,25})/gi;
  let match;
  while ((match = pattern1.exec(cleanText)) !== null) {
    const percentage = parseInt(match[1]);
    const material = match[2].trim().toLowerCase().replace(/[,\.\s]+$/, '');

    if (percentage > 0 && percentage <= 100) {
      // Skip if it's a non-material word (label, header, etc.)
      const isBlacklisted = nonMaterials.some(nm => material.includes(nm));
      if (isBlacklisted) continue;

      rawMaterials.push({ name: material, percentage });
    }
  }

  // Pattern 2: "Cotton 60%" or "Cotton: 60%"
  const pattern2 = /([a-zA-Z][a-zA-Z\s]{1,25})[:\s]+(\d+)\s*%/gi;
  while ((match = pattern2.exec(cleanText)) !== null) {
    const material = match[1].trim().toLowerCase().replace(/[,\.\s]+$/, '');
    const percentage = parseInt(match[2]);

    if (percentage > 0 && percentage <= 100) {
      // Skip if it's a non-material word
      const isBlacklisted = nonMaterials.some(nm => material.includes(nm));
      if (isBlacklisted) continue;

      rawMaterials.push({ name: material, percentage });
    }
  }

  // Normalize materials to FABRIC_Q keys and combine percentages
  // Maps normalized fabric name -> total percentage
  const normalizedMap = new Map();

  for (const mat of rawMaterials) {
    const materialName = mat.name;
    let matchedFabric = null;

    // Try to find a matching FABRIC_Q key
    // Check two-word matches first (e.g., "organic cotton" before "cotton")
    for (const fabricKey of fabricQKeys) {
      if (materialName === fabricKey) {
        // Exact match - use as is
        matchedFabric = fabricKey;
        break;
      }
      if (materialName.includes(fabricKey)) {
        // e.g., "compact cotton" contains "cotton"
        // But "organic cotton" should match "organic cotton" not "cotton"
        // Since fabricQKeys has two-word entries first, this works correctly
        matchedFabric = fabricKey;
        break;
      }
    }

    if (matchedFabric) {
      // Add to existing percentage or create new entry
      const existing = normalizedMap.get(matchedFabric) || 0;
      normalizedMap.set(matchedFabric, existing + mat.percentage);
    }
  }

  // Convert map back to materials array
  const materials = [];
  for (const [name, percentage] of normalizedMap) {
    materials.push({ name, percentage: Math.min(percentage, 100) }); // Cap at 100%
  }

  // Sort by percentage (highest first)
  materials.sort((a, b) => b.percentage - a.percentage);

  return materials.length > 0 ? materials : null;
}

// Scrape composition from Zara product page (from diego)
async function scrapeZaraComposition(productUrl) {
  try {
    console.log('Requesting composition scrape for:', productUrl);

    // Send message to background script to open the page and scrape
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { action: 'scrapeComposition', url: productUrl },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error('sendMessage error:', chrome.runtime.lastError);
            resolve(null);
            return;
          }
          if (response && response.success) {
            resolve(response.data);
          } else {
            console.error('Failed to scrape:', response?.error);
            resolve(null);
          }
        }
      );
    });
  } catch (error) {
    console.error('Error scraping composition:', error);
    return null;
  }
}

//Scrape composition from Amazon product page (from Victoia)
async function scrapeAmazonComposition(productUrl) {
  try {
    console.log('Requesting composition scrape for:', productUrl);

    // Send message to background script to open the page and scrape
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { action: 'scrapeComposition', url: productUrl },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error('sendMessage error:', chrome.runtime.lastError);
            resolve(null);
            return;
          }
          if (response && response.success) {
            resolve(response.data);
          } else {
            console.error('Failed to scrape:', response?.error);
            resolve(null);
          }
        }
      );
    });
  } catch (error) {
    console.error('Error scraping composition:', error);
    return null;
  }
}

// Scrape composition from any product page (from diego)
async function scrapeComposition(productUrl) {
  const hostname = window.location.hostname;

  if (hostname.includes('zara')) {
    return await scrapeZaraComposition(productUrl);
  }

  if (hostname.includes('amazon')) {
    return await scrapeAmazonComposition(productUrl);
  }

  // Generic scraping for other sites
  try {
    const response = await fetch(productUrl);
    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const config = getSiteConfig();
    const element = doc.querySelector(config.compositionSelector);

    // Also try to extract price from the detail page
    let price = null;
    const priceSelectors = [
      '.money-amount._main',  // Zara
      '.money-amount',  // Zara
      '[class*="price"]',
      '[data-price]',
      '.product-price',
      '.price',
      '[itemprop="price"]',
      '.product-sale-price',
      '.current-price',
      '[data-qa-qualifier="price-amount-current"]'  // Zara
    ];

    for (const selector of priceSelectors) {
      const priceEl = doc.querySelector(selector);
      if (priceEl) {
        const priceText = priceEl.textContent || priceEl.getAttribute('content') || '';
        const priceMatch = priceText.match(/[\$€£¥]?\s*(\d+[\d.,]*)/);
        if (priceMatch) {
          price = parseFloat(priceMatch[1].replace(/,/g, '.'));
          if (price > 0 && price < 10000) { // Sanity check: price between $0-$10k
            console.log(`Extracted price: $${price} from selector: ${selector}`);
            break;
          }
        }
      }
    }

    if (element) {
      const text = element.textContent.trim();
      const materials = parseComposition(text);
      return {
        raw: text,
        materials: materials,
        price: price
      };
    }

    return { price };
  } catch (error) {
    console.error('Error scraping composition:', error);
    return null;
  }
}

// Generate fabric rows HTML from materials data
function getFabricRowsHTML(materials) {
  // If no materials data available, show a message
  if (!materials || materials.length === 0) {
    return `
      <div class="sheep-fabric-row">
        <div class="sheep-fabric-info">
          <span class="sheep-fabric-name" style="font-style: italic; color: #94A3B8;">Composition data unavailable</span>
        </div>
      </div>
    `;
  }

  return materials
    .map(
      (f) => `
      <div class="sheep-fabric-row">
        <div class="sheep-fabric-info">
          <span class="sheep-fabric-name">${f.name.charAt(0).toUpperCase() + f.name.slice(1)}</span>
          <span class="sheep-fabric-percent">${f.percentage}%</span>
        </div>
        <div class="sheep-fabric-bar-track">
          <!-- Using static class 'sheep-bar-static' instead of rating-based color -->
          <div class="sheep-fabric-bar-fill sheep-bar-static" style="width: ${f.percentage}%"></div>
        </div>
      </div>
    `
    )
    .join("");
}

// Create rating button with text label and hover popup (from rectangle-popup, adapted for real scores)
function createRatingIndicator(score, productUrl, compositionData, price) {
  const rating = getRatingFromScore(score);
  const label = getLabelFromRating(rating);

  // Calculate value score: (quality / price) * 100
  let valueScore = null;
  if (price && price > 0) {
    valueScore = clamp(Math.round((score / price) * 60), 0, 100);

  }

  // Create container for button and popup
  const container = document.createElement('div');
  container.className = 'fabric-rating-container';
  container.style.cssText = 'position: absolute !important; bottom: 12px !important; right: 12px !important; z-index: 1000 !important; left: auto !important;';

  // Create the button (pill-shaped from rectangle-popup)
  const button = document.createElement('div');
  button.className = `fabric-rating-button fabric-rating-${rating}`;
  button.style.cssText = '';
  button.textContent = label;

  // Create the hover popup with NEW structure (from rectangle-popup)
  const popup = document.createElement('div');
  popup.className = 'fabric-hover-popup';

  // Use real fabric data if available
  const materials = compositionData?.materials || null;
  // No longer passing rating to getFabricRowsHTML
  const fabricRows = getFabricRowsHTML(materials);
  // Slogan is removed as per request for cleaner UI
  const mascotUrl = getMascotFromRating(rating);

  // Circular Score Calculations
  // SVG size is 80x80, radius is approx 36 (stroke width 8)
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  // Value Score Calculations
  let valueRating = 'medium';
  let valueOffset = 0;
  if (valueScore !== null) {
    if (valueScore < 40) valueRating = 'red';
    else if (valueScore < 65) valueRating = 'medium';
    else if (valueScore < 85) valueRating = 'lightGreen';
    else valueRating = 'darkGreen';

    valueOffset = circumference - (valueScore / 100) * circumference;
  }

  popup.innerHTML = `
    <div class="sheep-popup-wrapper">
      <!-- Left: Big Mascot (hover to show filter) -->
      <div class="sheep-mascot-large" style="cursor: pointer; transition: transform 0.2s;" title="Hover to filter by quality">
        <img src="${mascotUrl}" alt="Wooly" style="width: 100%; height: 100%; object-fit: contain;" />
      </div>

      <!-- Right: Info Column -->
      <div class="sheep-info-column">
        
        <!-- Top Right: Score -->
        <div class="sheep-score-container">
          <div style="display: flex; gap: 20px; justify-content: center; align-items: flex-start;">
            
            <!-- Quality Score -->
            <div style="display: flex; flex-direction: column; align-items: center; gap: 5px;">
                <span style="font-size: 11px; text-transform: uppercase; color: #888; font-weight: 600; letter-spacing: 0.5px;">Quality</span>
                <div class="sheep-circular-widget">
                  <svg class="sheep-circle-svg" viewBox="0 0 80 80">
                    <!-- Background Track -->
                    <circle class="score-track" cx="40" cy="40" r="${radius}"></circle>
                    <!-- Progress Fill -->
                    <circle class="score-fill rating-${rating}" cx="40" cy="40" r="${radius}"
                      style="stroke-dasharray: ${circumference}; stroke-dashoffset: ${offset};">
                    </circle>
                  </svg>
                  <div class="sheep-circle-text">
                    <span class="sheep-big-score rating-text-${rating}">${score}</span>
                    <span class="sheep-score-max">/100</span>
                  </div>
                </div>
            </div>

            <!-- Value Score (Optional) -->
            ${valueScore !== null ? `
            <div style="display: flex; flex-direction: column; align-items: center; gap: 5px;">
                <span style="font-size: 11px; text-transform: uppercase; color: #888; font-weight: 600; letter-spacing: 0.5px;">Value</span>
                <div class="sheep-circular-widget">
                  <svg class="sheep-circle-svg" viewBox="0 0 80 80">
                    <!-- Background Track -->
                    <circle class="score-track" cx="40" cy="40" r="${radius}"></circle>
                    <!-- Progress Fill -->
                    <circle class="score-fill rating-${valueRating}" cx="40" cy="40" r="${radius}"
                      style="stroke-dasharray: ${circumference}; stroke-dashoffset: ${valueOffset};">
                    </circle>
                  </svg>
                  <div class="sheep-circle-text">
                    <span class="sheep-big-score rating-text-${valueRating}">${valueScore}</span>
                    <span class="sheep-score-max">/100</span>
                  </div>
                </div>
            </div>` : ''}
          </div>
        </div>

        <!-- Bottom Right: Material Breakdown -->
        <div class="sheep-materials-container">
          <!-- <div class="sheep-fabric-title">Materials</div> -->
          ${fabricRows}
        </div>

      </div>
    </div>
  `;

  // Track hover state for button
  let hideTimeout = null;
  let isOverButton = false;

  const showPopup = () => {
    if (hideTimeout) clearTimeout(hideTimeout);

    // Temporarily add to DOM to measure dimensions
    popup.style.visibility = 'hidden';
    popup.style.position = 'fixed';
    document.body.appendChild(popup);

    const buttonRect = button.getBoundingClientRect();
    const popupRect = popup.getBoundingClientRect();
    const padding = 12; // viewport padding

    // Calculate initial position (to the left of button)
    let left = buttonRect.left - popupRect.width - 10;
    let top = buttonRect.top - 50;

    // Clamp to viewport bounds
    // If would go off left edge, position to the right of button instead
    if (left < padding) {
      left = buttonRect.right + 10;
    }
    // If would go off right edge, clamp to right
    if (left + popupRect.width > window.innerWidth - padding) {
      left = window.innerWidth - popupRect.width - padding;
    }
    // Clamp top
    if (top < padding) {
      top = padding;
    }
    // Clamp bottom
    if (top + popupRect.height > window.innerHeight - padding) {
      top = window.innerHeight - popupRect.height - padding;
    }

    popup.style.left = `${left}px`;
    popup.style.top = `${top}px`;
    popup.style.visibility = 'visible';

    // Force reflow for transition
    requestAnimationFrame(() => {
      popup.classList.add('visible');
    });
  };

  const hidePopup = () => {
    hideTimeout = setTimeout(() => {
      if (!isOverButton) {
        popup.classList.remove('visible');
        setTimeout(() => {
          if (popup.parentNode && !popup.classList.contains('visible')) {
            popup.parentNode.removeChild(popup);
          }
        }, 200);
      }
    }, 150);
  };

  // Event Listeners
  button.addEventListener('mouseenter', () => {
    isOverButton = true;
    showPopup();
  });

  button.addEventListener('mouseleave', () => {
    isOverButton = false;
    hidePopup();
  });

  popup.addEventListener('mouseenter', () => {
    isOverPopup = true;
    if (hideTimeout) clearTimeout(hideTimeout);
  });

  popup.addEventListener('mouseleave', () => {
    isOverPopup = false;
    hidePopup();
  });

  // Add hover handler to mascot for quality filter toggle
  const mascotDiv = popup.querySelector('.sheep-mascot-large');
  if (mascotDiv) {
    mascotDiv.addEventListener('mouseenter', (e) => {
      e.stopPropagation();
      // Just show tooltip on hover, don't show filter
    });
  }

  container.appendChild(button);

  return container;
}

// Add rating indicators to product cards (combined: async scraping from diego, UI from rectangle-popup)
async function addRatingsToProducts() {
  const config = getSiteConfig();
  console.log('Scanning for products with config:', config);

  const productCards = document.querySelectorAll(config.productCards);
  console.log(`Found ${productCards.length} product cards`);

  let addedCount = 0;

  // Check if quality filter is enabled
  const filterData = await new Promise((resolve) => {
    chrome.storage.sync.get(['filterHighQualityOnly'], (data) => {
      resolve(data.filterHighQualityOnly || false);
    });
  });

  for (const card of productCards) {
    // Skip if already processed
    if (card.querySelector('.fabric-rating-container')) continue;

    // Find the product link
    let productLink = card.querySelector(config.productLink);
    if (!productLink) {
      productLink = card.querySelector('a[href*="/product"], a[href*="/p/"]');
    }

    if (!productLink) {
      console.log('No product link found for card');
      continue;
    }

    const productUrl = productLink.href;

    // Find the image or image container
    let imageContainer = card.querySelector(config.imageContainer);

    // Fallback: find any image in the card
    if (!imageContainer) {
      const img = card.querySelector('img');
      imageContainer = img ? img.parentElement : null;
    }

    if (!imageContainer) {
      console.log('No image container found for card');
      continue;
    }

    // Make sure the container is positioned
    const position = window.getComputedStyle(imageContainer).position;
    if (position === 'static') {
      imageContainer.style.position = 'relative';
    }

    // Extract price from the product card (fallback - prefer scraped price)
    let price = null;

    // Helper to parse price string to number
    const parsePrice = (str) => {
      if (!str) return null;
      // Remove currency symbols and whitespace
      let clean = str.replace(/[^\d.,]/g, '');

      // Handle different formats:
      // 1.234,56 (EU) -> 1234.56
      // 1,234.56 (US) -> 1234.56
      // 1.234 (EU) -> 1234
      // 1,234 (US) -> 1234

      // If contains both . and ,
      if (clean.includes('.') && clean.includes(',')) {
        if (clean.indexOf('.') > clean.indexOf(',')) {
          // 1,234.56 - Standard US/UK
          clean = clean.replace(/,/g, '');
        } else {
          // 1.234,56 - EU
          clean = clean.replace(/\./g, '').replace(/,/g, '.');
        }
      } else if (clean.includes(',')) {
        // If only comma: 1,234 or 12,34
        // Assume decimal if it's 2 digits at end: 12,34 -> 12.34
        // Assume thousands if 3 digits: 1,234 -> 1234
        if (clean.match(/,\d{2}$/)) {
          clean = clean.replace(/,/g, '.');
        } else {
          clean = clean.replace(/,/g, '');
        }
      }

      const val = parseFloat(clean);
      return !isNaN(val) && val > 0 ? val : null;
    };

    // Try a list of potential price selectors, prioritized
    const cardPriceSelectors = [
      '[data-testid="price"]',
      '.product-price',
      '.current-price',
      '.price',
      '.amount',
      '[class*="price"]',
      '[data-price]'
    ];

    for (const selector of cardPriceSelectors) {
      const priceEl = card.querySelector(selector);
      if (priceEl) {
        // Look for the "current" or "sale" price first if nested
        const currentPrice = priceEl.querySelector('.current, .sale, .new-price') || priceEl;
        price = parsePrice(currentPrice.textContent);
        if (price) break;
      }
    }

    if (price) {
      console.log(`Product price from listing: $${price}`);
    }

    // Try to scrape composition immediately for accurate scoring (from diego)
    let compositionData = null;
    let score = 50; // Default score

    try {
      compositionData = await scrapeComposition(productUrl);

      // Use scraped price if available, otherwise use card price
      if (compositionData?.price && compositionData.price > 0) {
        price = compositionData.price;
        console.log(`Product price from detail page: $${price}`);
      }

      if (compositionData && compositionData.materials) {
        // Calculate REAL score from actual materials!
        score = calculateRealScore(compositionData.materials);
        console.log(`Product scored: ${score} from materials:`, compositionData.materials);
      } else if (compositionData && compositionData.raw) {
        // Try to analyze raw text
        const analysis = window.fabricDB?.analyzeMaterials(compositionData.raw);
        if (analysis) {
          score = Math.round(analysis.avgScore * 10);
        }
      }
    } catch (err) {
      console.log('Could not scrape, using default score');
    }

    // Create and add indicator with REAL score and value score (combined UI)
    const indicator = createRatingIndicator(score, productUrl, compositionData, price);
    imageContainer.appendChild(indicator);

    // Apply quality filter if enabled
    const rating = getRatingFromScore(score);
    if (filterData && rating !== 'lightGreen' && rating !== 'darkGreen') {
      card.style.display = 'none';
    }

    addedCount++;
  }

  console.log(`Added ${addedCount} rating indicators`);

  // Update count in storage
  chrome.storage.sync.get(['ratedCount'], (data) => {
    const newCount = (data.ratedCount || 0) + addedCount;
    chrome.storage.sync.set({ ratedCount: newCount });
  });
}

// Debounce function
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Initialize when page loads
function init() {
  chrome.storage.sync.get(['enabled'], (data) => {
    if (data.enabled === false) {
      console.log('Fabric Rating Extension is disabled');
      return;
    }

    console.log('Initializing Fabric Rating Extension');

    // Add the floating mascot icon (from rectangle-popup)
    createMascotIcon();

    // Wait a bit for the page to load
    setTimeout(() => {
      addRatingsToProducts();
    }, 1000);

    // Start observer for dynamic content
    startObserver();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Re-scan when new content loads (for infinite scroll)
const debouncedScan = debounce(addRatingsToProducts, 1000);

function startObserver() {
  const observer = new MutationObserver((mutations) => {
    // Check if significant changes occurred
    const hasNewProducts = mutations.some(mutation =>
      mutation.addedNodes.length > 0
    );

    if (hasNewProducts) {
      debouncedScan();
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}