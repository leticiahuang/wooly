// Background service worker
console.log('Fabric Rating Extension background worker loaded');

// Cache for scraped compositions
const compositionCache = new Map();

// Queue for scraping requests
let scrapeQueue = [];
let isProcessing = false;

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
  const percentPattern = /(\d+)%?\s*([a-zA-Z\s]+)|([a-zA-Z\s]+)\s*(\d+)%/gi;

  let match;
  while ((match = percentPattern.exec(text)) !== null) {
    const percentage = match[1] || match[4];
    const material = (match[2] || match[3]).trim().toLowerCase();

    if (percentage && material && material.length < 30) {
      materials.push({
        name: material,
        percentage: parseInt(percentage)
      });
    }
  }

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
    // Create hidden tab
    tab = await chrome.tabs.create({
      url: url,
      active: false,
      index: 0 // Put it at the start so it's less noticeable
    });

    console.log('Opened background tab:', tab.id, 'for:', url);

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