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

// Generate random score (will be replaced with API call later)
function getRandomScore() {
  return Math.floor(Math.random() * 100) + 1;
}

// Determine rating based on score
function getRatingFromScore(score) {
  if (score >= 70) return 'green';
  if (score >= 40) return 'yellow';
  return 'red';
}

// Create rating indicator with hover tooltip
function createRatingIndicator(score) {
  const rating = getRatingFromScore(score);

  const container = document.createElement('div');
  container.className = 'fabric-rating-container';

  const indicator = document.createElement('div');
  indicator.className = `fabric-rating-indicator fabric-rating-${rating}`;

  const light = document.createElement('div');
  light.className = 'fabric-rating-light';
  indicator.appendChild(light);

  // Create hover rectangle
  const hoverRect = document.createElement('div');
  hoverRect.className = `fabric-hover-rectangle fabric-hover-${rating}`;
  hoverRect.innerHTML = `
    <div class="hover-rect-score">${score}</div>
    <div class="hover-rect-label">Sustainability</div>
  `;

  container.appendChild(indicator);
  container.appendChild(hoverRect);

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
    if (card.querySelector('.fabric-rating-container')) return;

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

    // Generate random score (will be replaced with API call)
    const score = getRandomScore();

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