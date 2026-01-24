// Content script that runs on shopping websites
console.log('Fabric Rating Extension loaded');

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

// Calculate real score from materials using fabricDatabase
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

// Determine rating based on score
function getRatingFromScore(score) {
  if (score >= 70) return 'green';
  if (score >= 40) return 'yellow';
  return 'red';
}

// Parse material composition from text
function parseComposition(text) {
  if (!text) return null;

  const materials = [];

  // Common patterns: "100% Cotton", "Cotton 100%", "50% Polyester, 50% Cotton"
  const percentPattern = /(\d+)%?\s*([a-zA-Z\s]+)|([a-zA-Z\s]+)\s*(\d+)%/gi;

  let match;
  while ((match = percentPattern.exec(text)) !== null) {
    const percentage = match[1] || match[4];
    const material = (match[2] || match[3]).trim().toLowerCase();

    if (percentage && material) {
      materials.push({
        name: material,
        percentage: parseInt(percentage)
      });
    }
  }

  return materials.length > 0 ? materials : null;
}

// Scrape composition from Zara product page
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

// Scrape composition from any product page
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

// Create rating indicator with hover tooltip
function createRatingIndicator(score, productUrl, compositionData) {
  const rating = getRatingFromScore(score);

  const container = document.createElement('div');
  container.className = 'fabric-rating-container';
  container.setAttribute('data-product-url', productUrl);
  if (compositionData) {
    container.setAttribute('data-composition', JSON.stringify(compositionData));
  }

  const indicator = document.createElement('div');
  indicator.className = `fabric-rating-indicator fabric-rating-${rating}`;

  const light = document.createElement('div');
  light.className = 'fabric-rating-light';
  indicator.appendChild(light);

  const tooltip = document.createElement('div');
  tooltip.className = 'fabric-rating-tooltip-hover';
  tooltip.innerHTML = `
    <div class="tooltip-score">${score}</div>
    <div class="tooltip-label">Sustainability Score</div>
  `;

  container.appendChild(indicator);
  container.appendChild(tooltip);

  // Click handler to show detailed popup
  container.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    showDetailedPopup(productUrl, compositionData, score, rating);
  });

  return container;
}

// Show detailed composition popup
function showDetailedPopup(productUrl, compositionData, score, rating) {
  // Remove any existing popup
  const existingPopup = document.querySelector('.fabric-detail-popup');
  if (existingPopup) existingPopup.remove();

  const popup = document.createElement('div');
  popup.className = 'fabric-detail-popup';

  let materialsHtml = '<p class="no-data">Loading composition data...</p>';

  if (compositionData && compositionData.materials) {
    materialsHtml = compositionData.materials.map(mat => `
      <div class="material-item">
        <span class="material-name">${mat.name.charAt(0).toUpperCase() + mat.name.slice(1)}</span>
        <span class="material-percentage">${mat.percentage}%</span>
      </div>
    `).join('');
  } else if (compositionData && compositionData.raw) {
    materialsHtml = `<p class="raw-composition">${compositionData.raw}</p>`;
  }

  popup.innerHTML = `
    <div class="popup-header">
      <h3>Material Composition</h3>
      <button class="popup-close">×</button>
    </div>
    <div class="popup-content">
      <div class="score-display ${rating}">
        <div class="score-number">${score}</div>
        <div class="score-label">Sustainability Score</div>
      </div>
      <div class="materials-list">
        <h4>Composition</h4>
        ${materialsHtml}
      </div>
    </div>
  `;

  document.body.appendChild(popup);

  // If we don't have composition data yet, fetch it
  if (!compositionData) {
    scrapeComposition(productUrl).then(data => {
      if (data) {
        const materialsList = popup.querySelector('.materials-list');
        if (data.materials) {
          materialsList.innerHTML = `
            <h4>Composition</h4>
            ${data.materials.map(mat => `
              <div class="material-item">
                <span class="material-name">${mat.name.charAt(0).toUpperCase() + mat.name.slice(1)}</span>
                <span class="material-percentage">${mat.percentage}%</span>
              </div>
            `).join('')}
          `;
        } else if (data.raw) {
          materialsList.innerHTML = `
            <h4>Composition</h4>
            <p class="raw-composition">${data.raw}</p>
          `;
        }
      } else {
        popup.querySelector('.materials-list').innerHTML = `
          <h4>Composition</h4>
          <p class="no-data">Could not load composition data</p>
        `;
      }
    });
  }

  // Close button
  popup.querySelector('.popup-close').addEventListener('click', () => {
    popup.remove();
  });

  // Close when clicking outside
  setTimeout(() => {
    document.addEventListener('click', function closePopup(e) {
      if (!popup.contains(e.target)) {
        popup.remove();
        document.removeEventListener('click', closePopup);
      }
    });
  }, 100);
}

// Add rating indicators to product cards
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

    // Try to scrape composition immediately for accurate scoring
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

    // Create and add indicator with REAL score
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