// Content script that runs on shopping websites
console.log('Fabric Rating Extension loaded');

// Create and add the floating mascot icon
function createMascotIcon() {
  // Don't add if already exists
  if (document.querySelector('.wooly-mascot-container')) return;

  const container = document.createElement('div');
  container.className = 'wooly-mascot-container';

  const icon = document.createElement('div');
  icon.className = 'wooly-mascot-icon';

  // Create image from mascot file
  const img = document.createElement('img');
  img.src = chrome.runtime.getURL('icons/mascot.svg');
  img.alt = 'Wooly';
  icon.appendChild(img);

  // Tooltip
  const tooltip = document.createElement('div');
  tooltip.className = 'wooly-mascot-tooltip';
  tooltip.textContent = '🧶 Wooly is active!';

  container.appendChild(icon);
  container.appendChild(tooltip);
  document.body.appendChild(container);

  // Optional: click to scroll to top or show info
  container.addEventListener('click', () => {
    tooltip.textContent = '✨ Checking fabric quality...';
    setTimeout(() => {
      tooltip.textContent = '🧶 Wooly is active!';
    }, 2000);
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
  }
};

// Get current site config
function getSiteConfig() {
  const hostname = window.location.hostname;
  for (const [site, config] of Object.entries(SITE_CONFIGS)) {
    if (hostname.includes(site)) return config;
  }
  // Default fallback
  return {
    productCards: 'article, .product, .product-card, [class*="product"]',
    imageContainer: 'img, a, .image',
    productLink: 'a',
    compositionSelector: '[class*="composition"], [class*="material"]',
  };
}

// Calculate real score from materials using fabricDatabase (from diego)
function calculateRealScore(materials) {
  if (!materials || materials.length === 0) return null;

  let totalWeightedScore = 0;
  let totalPercentage = 0;

  for (const mat of materials) {
    const materialName = mat.name.toLowerCase().trim();
    const percentage = mat.percentage || 100;

    // Look up in fabric database
    let score = 5; // Default moderate score

    if (window.fabricDB && window.fabricDB.FABRIC_DATABASE) {
      // Try exact match first
      if (window.fabricDB.FABRIC_DATABASE[materialName]) {
        score = window.fabricDB.FABRIC_DATABASE[materialName].score;
      } else {
        // Try partial match
        for (const [fabric, data] of Object.entries(window.fabricDB.FABRIC_DATABASE)) {
          if (materialName.includes(fabric) || fabric.includes(materialName)) {
            score = data.score;
            break;
          }
        }
      }
    }

    // Weighted by percentage
    totalWeightedScore += score * percentage;
    totalPercentage += percentage;
  }

  if (totalPercentage === 0) return 50;

  // Convert score (1-10) to percentage (0-100)
  const avgScore = totalWeightedScore / totalPercentage;
  return Math.round(avgScore * 10);
}

// Determine rating based on score using new 4-tier color system (from rectangle-popup)
function getRatingFromScore(score) {
  // Use scoreColors if available, otherwise fallback
  if (window.scoreColors && window.scoreColors.getColorClassFromScore) {
    return window.scoreColors.getColorClassFromScore(score);
  }
  // Fallback logic matching scoreColors.js
  if (score <= 40) return 'red';
  if (score <= 65) return 'medium';
  if (score <= 85) return 'lightGreen';
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

// Parse material composition from text (from diego)
function parseComposition(text) {
  if (!text) return null;

  const materials = [];
  const seen = new Set();

  // Known material names to filter valid matches
  const knownMaterials = [
    'cotton', 'polyester', 'nylon', 'wool', 'silk', 'linen', 'hemp',
    'viscose', 'rayon', 'modal', 'tencel', 'lyocell', 'spandex', 'elastane',
    'acrylic', 'cashmere', 'leather', 'suede', 'denim', 'fleece', 'velvet',
    'satin', 'chiffon', 'tweed', 'corduroy', 'jersey', 'organza', 'lace',
    'recycled polyester', 'organic cotton', 'recycled cotton', 'bamboo'
  ];

  // Clean up the text
  const cleanText = text.replace(/[\n\r\t]+/g, ' ').replace(/\s+/g, ' ');

  // Pattern 1: "60% Cotton" or "60 % Cotton"
  const pattern1 = /(\d+)\s*%\s*([a-zA-Z][a-zA-Z\s]{1,25})/gi;
  let match;
  while ((match = pattern1.exec(cleanText)) !== null) {
    const percentage = parseInt(match[1]);
    const material = match[2].trim().toLowerCase().replace(/[,\.\s]+$/, '');
    const key = material.split(/\s+/)[0]; // First word for deduplication
    
    if (percentage > 0 && percentage <= 100 && !seen.has(key)) {
      // Check if it's a known material or contains a known material
      const isKnown = knownMaterials.some(m => material.includes(m) || m.includes(material.split(/\s+/)[0]));
      if (isKnown || material.length <= 15) {
        materials.push({ name: material, percentage });
        seen.add(key);
      }
    }
  }

  // Pattern 2: "Cotton 60%" or "Cotton: 60%"
  const pattern2 = /([a-zA-Z][a-zA-Z\s]{1,25})[:\s]+(\d+)\s*%/gi;
  while ((match = pattern2.exec(cleanText)) !== null) {
    const material = match[1].trim().toLowerCase().replace(/[,\.\s]+$/, '');
    const percentage = parseInt(match[2]);
    const key = material.split(/\s+/)[0];
    
    if (percentage > 0 && percentage <= 100 && !seen.has(key)) {
      const isKnown = knownMaterials.some(m => material.includes(m) || m.includes(material.split(/\s+/)[0]));
      if (isKnown || material.length <= 15) {
        materials.push({ name: material, percentage });
        seen.add(key);
      }
    }
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

// Scrape composition from any product page (from diego)
async function scrapeComposition(productUrl) {
  const hostname = window.location.hostname;

  if (hostname.includes('zara.com')) {
    return await scrapeZaraComposition(productUrl);
  }

  // Generic scraping for other sites
  try {
    const response = await fetch(productUrl);
    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const config = getSiteConfig();
    const element = doc.querySelector(config.compositionSelector);

    if (element) {
      const text = element.textContent.trim();
      const materials = parseComposition(text);
      return {
        raw: text,
        materials: materials
      };
    }

    return null;
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
          <span class="sheep-fabric-name" style="font-style: italic; color: #888;">Composition data unavailable</span>
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
          <div class="sheep-fabric-bar-fill" style="width: ${f.percentage}%"></div>
        </div>
      </div>
    `
    )
    .join("");
}

// Create rating button with text label and hover popup (from rectangle-popup, adapted for real scores)
function createRatingIndicator(score, productUrl, compositionData) {
  const rating = getRatingFromScore(score);
  const label = getLabelFromRating(rating);

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
  const fabricRows = getFabricRowsHTML(materials);
  const slogan = getSloganFromRating(rating);

  // Circular Score Calculations
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  popup.innerHTML = `
    <!-- Wavy Header with Circular Score -->
    <div class="sheep-popup-header centered-header">
      <div class="sheep-score-display centered-score">
        <div class="sheep-title">Wooly Estimate</div>
        
        <div class="sheep-circular-widget">
          <svg class="sheep-circle-svg" width="100" height="100" viewBox="0 0 100 100">
            <!-- Background Track -->
            <circle class="score-track" cx="50" cy="50" r="${radius}"></circle>
            <!-- Progress Fill -->
            <circle class="score-fill rating-${rating}" cx="50" cy="50" r="${radius}"
              style="stroke-dasharray: ${circumference}; stroke-dashoffset: ${offset};">
            </circle>
          </svg>
          <div class="sheep-circle-text">
            <span class="sheep-big-score">${score}</span>
            <span class="sheep-score-max">/100</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Content Body -->
    <div class="sheep-content-body">
      <div class="sheep-question-text">
        ${slogan}
      </div>
      
      <div class="sheep-data-box">
        <div class="sheep-fabric-title">Material Breakdown</div>
        ${fabricRows}
      </div>
    </div>
  `;

  // Track hover state for both button and popup
  let hideTimeout = null;
  let isOverPopup = false;
  let isOverButton = false;

  const showPopup = () => {
    if (hideTimeout) clearTimeout(hideTimeout);

    // Position logic
    const buttonRect = button.getBoundingClientRect();
    popup.style.position = 'fixed';
    popup.style.left = `${buttonRect.left - 280}px`;
    popup.style.top = `${buttonRect.top - 50}px`;

    document.body.appendChild(popup);

    // Force reflow for transition
    requestAnimationFrame(() => {
      popup.classList.add('visible');
    });
  };

  const hidePopup = () => {
    hideTimeout = setTimeout(() => {
      if (!isOverPopup && !isOverButton) {
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

    // Try to scrape composition immediately for accurate scoring (from diego)
    let compositionData = null;
    let score = 50; // Default score

    try {
      compositionData = await scrapeComposition(productUrl);

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

    // Create and add indicator with REAL score (combined UI)
    const indicator = createRatingIndicator(score, productUrl, compositionData);
    imageContainer.appendChild(indicator);

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
  console.log('Initializing Fabric Rating Extension');

  // Add the floating mascot icon (from rectangle-popup)
  createMascotIcon();

  // Wait a bit for the page to load
  setTimeout(() => {
    addRatingsToProducts();
  }, 1000);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Re-scan when new content loads (for infinite scroll)
const debouncedScan = debounce(addRatingsToProducts, 1000);

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