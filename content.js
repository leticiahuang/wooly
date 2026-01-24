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
  img.src = chrome.runtime.getURL('icons/icon128.png');
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
  },
  'hm.com': {
    productCards: '.product-item, article[class*="product"]',
    imageContainer: '.item-image, .image-container',
  },
  'uniqlo.com': {
    productCards: '.fr-product-tile, .productTile',
    imageContainer: '.tile-image, .product-tile__image',
  },
  'asos.com': {
    productCards: 'article[data-auto-id="productTile"]',
    imageContainer: 'a[data-auto-id="productTileImage"]',
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
  };
}

// Get random score for testing (0-100)
function getProductScore() {
  // Generate random score between 0 and 100 for testing
  return Math.floor(Math.random() * 101);
}

// Determine rating based on score using new 4-tier color system
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

// Get label text from rating
function getLabelFromRating(rating) {
  const labels = {
    red: 'Poor',
    medium: 'Moderate',
    lightGreen: 'Good',
    darkGreen: 'Excellent'
  };
  return labels[rating] || 'Unknown';
}

// Get dynamic slogan from rating
function getSloganFromRating(rating) {
  const slogans = {
    red: "Don't get fleeced! <span class=\"sheep-emoji\">🙅</span>",
    medium: "This fabric is a bit... <br> fuzzy <span class=\"sheep-emoji\">🤔</span>",
    lightGreen: "Not baaa-d at all <span class=\"sheep-emoji\">🐑</span>",
    darkGreen: "Shear perfection! <span class=\"sheep-emoji\">✨</span>"
  };
  return slogans[rating] || "Check the details below!";
}

function getFabricRowsHTML() {
  // For now we’re using a placeholder composition.
  // Later you’ll replace this with scraped/parsed material data.
  const fabric = [
    { name: "Cotton", percent: 60 },
    { name: "Polyester", percent: 35 },
    { name: "Elastane", percent: 5 },
  ];

  return fabric
    .map(
      (f) => `
      <div class="sheep-fabric-row">
        <div class="sheep-fabric-info">
          <span class="sheep-fabric-name">${f.name}</span>
          <span class="sheep-fabric-percent">${f.percent}%</span>
        </div>
        <div class="sheep-fabric-bar-track">
          <div class="sheep-fabric-bar-fill" style="width: ${f.percent}%"></div>
        </div>
      </div>
    `
    )
    .join("");
}

// Create rating button with text label and hover popup
function createRatingIndicator(score) {
  const rating = getRatingFromScore(score);
  const label = getLabelFromRating(rating);

  // Create container for button and popup
  const container = document.createElement('div');
  container.className = 'fabric-rating-container';
  container.style.cssText = 'position: absolute !important; bottom: 12px !important; right: 12px !important; z-index: 1000 !important; left: auto !important;'; // Updated positioning to match CSS

  // Create the button
  const button = document.createElement('div');
  button.className = `fabric-rating-button fabric-rating-${rating}`;
  // Remove inline styles that might conflict with new CSS
  button.style.cssText = '';
  // Revert to simple text label for the "original" button style
  button.textContent = label;

  // Create the hover popup with NEW structure
  const popup = document.createElement('div');
  popup.className = 'fabric-hover-popup';

  // Fabric data helper
  const fabricRows = getFabricRowsHTML(); // Use existing helper
  const slogan = getSloganFromRating(rating);

  // Circular Score Calculations
  const radius = 36;
  const circumference = 2 * Math.PI * radius; // ~226.19
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

    // Position to the left of the button by default, or right if space allows
    // For now, let's hover above-left
    popup.style.left = `${buttonRect.left - 300}px`; // Shift left
    popup.style.top = `${buttonRect.top - 150}px`;   // Shift up

    // Better positioning logic could go here, but stick to simple for now
    // Actually, let's center it above the mouse/button more intelligently
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
        }, 200); // Wait for fade out
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
  // Popup is appended to body on hover, not container, to avoid z-index clipping issues in some sites

  return container;
}

// Add rating indicators to product cards
function addRatingsToProducts() {
  const config = getSiteConfig();
  console.log('Scanning for products with config:', config);

  const productCards = document.querySelectorAll(config.productCards);
  console.log(`Found ${productCards.length} product cards`);

  let addedCount = 0;

  productCards.forEach((card, index) => {
    // Skip if already processed
    if (card.querySelector('.fabric-rating-button')) return;

    // Find the image or image container
    let imageContainer = card.querySelector(config.imageContainer);

    // Fallback: find any image in the card
    if (!imageContainer) {
      const img = card.querySelector('img');
      imageContainer = img ? img.parentElement : null;
    }

    if (!imageContainer) {
      console.log('No image container found for card', index);
      return;
    }

    // Make sure the container is positioned
    const position = window.getComputedStyle(imageContainer).position;
    if (position === 'static') {
      imageContainer.style.position = 'relative';
    }

    // Get score using calculateScore function
    const score = getProductScore();

    // Create and add indicator
    const indicator = createRatingIndicator(score);
    imageContainer.appendChild(indicator);

    addedCount++;
  });

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

  // Add the floating mascot icon
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