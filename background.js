// Background service worker
console.log('Fabric Rating Extension background worker loaded');

// Cache for scraped compositions - with timestamps for expiration
const compositionCache = new Map();
const CACHE_MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes

// Queue for scraping requests
let scrapeQueue = [];
let isProcessing = false;

// Track if offscreen document exists
let offscreenDocumentCreated = false;

// Listen for installation - clear cache on install/update
chrome.runtime.onInstalled.addListener(() => {
  console.log('Fabric Rating Extension installed - clearing cache');
  compositionCache.clear();
  chrome.storage.sync.set({
    enabled: true,
    showNotifications: true
  });
});

// Parse material composition from text (fallback if offscreen fails)
function parseComposition(text) {
  if (!text) return null;

  const materials = [];
  const seen = new Set();

  const knownMaterials = [
    'cotton', 'polyester', 'nylon', 'wool', 'silk', 'linen', 'hemp',
    'viscose', 'rayon', 'modal', 'tencel', 'lyocell', 'spandex', 'elastane',
    'acrylic', 'cashmere', 'leather', 'suede', 'denim', 'fleece', 'velvet',
    'satin', 'chiffon', 'tweed', 'corduroy', 'jersey', 'organza', 'lace',
    'recycled polyester', 'organic cotton', 'recycled cotton', 'bamboo'
  ];

  const cleanText = text.replace(/[\n\r\t]+/g, ' ').replace(/\s+/g, ' ');

  const pattern1 = /(\d+)\s*%\s*([a-zA-Z][a-zA-Z\s]{1,25})/gi;
  let match;
  while ((match = pattern1.exec(cleanText)) !== null) {
    const percentage = parseInt(match[1]);
    const material = match[2].trim().toLowerCase().replace(/[,\.\s]+$/, '');
    const key = material.split(/\s+/)[0];

    if (percentage > 0 && percentage <= 100 && !seen.has(key)) {
      const isKnown = knownMaterials.some(m => material.includes(m) || m.includes(material.split(/\s+/)[0]));
      if (isKnown || material.length <= 15) {
        materials.push({ name: material, percentage });
        seen.add(key);
      }
    }
  }

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

  materials.sort((a, b) => b.percentage - a.percentage);
  return materials.length > 0 ? materials : null;
}

// Ensure offscreen document is created
async function ensureOffscreenDocument() {
  if (offscreenDocumentCreated) return;

  // Check if one already exists
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT']
  });

  if (existingContexts.length > 0) {
    offscreenDocumentCreated = true;
    return;
  }

  // Create the offscreen document
  await chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['DOM_PARSER'],
    justification: 'Parse product pages to extract fabric composition without visible tabs'
  });

  offscreenDocumentCreated = true;
  console.log('Offscreen document created');
}

// Scrape using offscreen document (no visible windows!)
async function scrapeWithOffscreen(url) {
  try {
    await ensureOffscreenDocument();

    // Send message to offscreen document to scrape the URL
    const response = await chrome.runtime.sendMessage({
      action: 'scrapeUrl',
      url: url
    });

    if (response && response.success) {
      return response.data;
    }
    return null;
  } catch (error) {
    console.error('Offscreen scrape error:', error);
    return null;
  }
}

// Process queue using offscreen document
async function processQueue() {
  if (isProcessing || scrapeQueue.length === 0) return;

  isProcessing = true;
  const { url, resolve } = scrapeQueue.shift();

  // Check cache first (with expiration)
  const cached = compositionCache.get(url);
  if (cached && (Date.now() - cached.timestamp < CACHE_MAX_AGE_MS)) {
    console.log('Cache hit for:', url);
    resolve(cached.data);
    isProcessing = false;
    processQueue();
    return;
  }

  try {
    const data = await scrapeWithOffscreen(url);

    // Cache the result with timestamp
    compositionCache.set(url, { data, timestamp: Date.now() });
    console.log('Scraped and cached:', url, data?.materials);

    resolve(data);
  } catch (error) {
    console.error('Scrape error:', error.message);
    resolve(null);
  }

  isProcessing = false;

  // Rate limiting - wait before processing next
  setTimeout(() => processQueue(), 500);
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