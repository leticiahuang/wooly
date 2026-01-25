// Background service worker
console.log('Fabric Rating Extension background worker loaded');

// Cache for scraped compositions
const compositionCache = new Map();

// Queue for scraping requests
let scrapeQueue = [];
let isProcessing = false;

// Hidden window for scraping
let hiddenWindowId = null;

// Listen for installation
chrome.runtime.onInstalled.addListener(() => {
  console.log('Fabric Rating Extension installed');
  chrome.storage.sync.set({
    enabled: true,
    showNotifications: true
  });
});

// Parse material composition from text
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

// Process queue - only one tab at a time!
async function processQueue() {
  if (isProcessing || scrapeQueue.length === 0) return;

  isProcessing = true;
  const { url, resolve, reject } = scrapeQueue.shift();

  // Check cache first
  if (compositionCache.has(url)) {
    console.log('Cache hit for:', url);
    resolve(compositionCache.get(url));
    isProcessing = false;
    processQueue(); // Process next
    return;
  }

  let tab = null;

  try {
    // Create or reuse a hidden minimized window for scraping
    if (!hiddenWindowId) {
      const hiddenWindow = await chrome.windows.create({
        url: url,
        state: 'minimized',
        focused: false
      });
      hiddenWindowId = hiddenWindow.id;
      tab = hiddenWindow.tabs[0];
    } else {
      // Check if hidden window still exists
      try {
        await chrome.windows.get(hiddenWindowId);
        tab = await chrome.tabs.create({
          url: url,
          windowId: hiddenWindowId,
          active: false
        });
      } catch (e) {
        // Window was closed, create a new one
        const hiddenWindow = await chrome.windows.create({
          url: url,
          state: 'minimized',
          focused: false
        });
        hiddenWindowId = hiddenWindow.id;
        tab = hiddenWindow.tabs[0];
      }
    }

    console.log('Opened hidden tab:', tab.id, 'for:', url);

    // Wait for page to load
    await new Promise((resolveWait, rejectWait) => {
      const timeout = setTimeout(() => {
        rejectWait(new Error('Timeout'));
      }, 10000);

      const listener = (tabId, info) => {
        if (tabId === tab.id && info.status === 'complete') {
          clearTimeout(timeout);
          chrome.tabs.onUpdated.removeListener(listener);
          setTimeout(() => resolveWait(), 1500); // Extra wait for dynamic content
        }
      };
      chrome.tabs.onUpdated.addListener(listener);
    });

    // Inject script to extract composition
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const selectors = [
          '.product-detail-info__composition',
          '.product-detail-extra-info__composition',
          '.expandable-text__inner-content',
          '[class*="composition"]',
          '[class*="material"]'
        ];

        let compositionText = null;

        // Try to click composition tab
        const tabs = document.querySelectorAll('[class*="tab"], button[class*="accordion"]');
        for (const t of tabs) {
          if (/composition|material|fabric/i.test(t.textContent)) {
            t.click();
            break;
          }
        }

        for (const selector of selectors) {
          const elements = document.querySelectorAll(selector);
          for (const el of elements) {
            const text = el.textContent.trim();
            if (text && (text.includes('%') || /cotton|polyester|viscose|wool|silk|linen/i.test(text))) {
              compositionText = text;
              break;
            }
          }
          if (compositionText) break;
        }

        return compositionText;
      }
    });

    // Close tab immediately
    await chrome.tabs.remove(tab.id);
    tab = null;

    if (results && results[0] && results[0].result) {
      const compositionText = results[0].result;
      const materials = parseComposition(compositionText);
      const data = { raw: compositionText, materials };

      // Cache the result
      compositionCache.set(url, data);
      console.log('Scraped and cached:', url, materials);

      resolve(data);
    } else {
      compositionCache.set(url, null); // Cache the miss too
      resolve(null);
    }

  } catch (error) {
    console.error('Scrape error:', error.message);
    if (tab) {
      try { await chrome.tabs.remove(tab.id); } catch (e) { }
    }
    resolve(null);
  }

  isProcessing = false;

  // If queue is empty, close the hidden window after a delay
  if (scrapeQueue.length === 0) {
    setTimeout(async () => {
      if (scrapeQueue.length === 0 && hiddenWindowId) {
        try {
          await chrome.windows.remove(hiddenWindowId);
        } catch (e) { }
        hiddenWindowId = null;
      }
    }, 5000);
  }

  // Wait before processing next (rate limiting)
  setTimeout(() => processQueue(), 2000);
}

// Add to queue
function queueScrape(url) {
  return new Promise((resolve, reject) => {
    scrapeQueue.push({ url, resolve, reject });
    processQueue();
  });
}

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'scrapeComposition') {
    // Use the queue system
    queueScrape(request.url)
      .then(data => {
        sendResponse({ success: true, data: data });
      })
      .catch(error => {
        console.error('Scraping error:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Will respond asynchronously
  }

  if (request.action === 'analyzeMaterial') {
    // Material analysis logic could be moved here if needed
    sendResponse({ success: true });
  }

  if (request.action === 'getSettings') {
    chrome.storage.sync.get(['enabled', 'showNotifications'], (data) => {
      sendResponse(data);
    });
    return true; // Will respond asynchronously
  }

  return false;
});