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

// Backend URL for AI features
const WOOLY_BACKEND = 'http://localhost:3000';

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  
  // Wooly AI Chat - calls backend
  if (request.action === 'askWoolyAI') {
    (async () => {
      try {
        const response = await fetch(`${WOOLY_BACKEND}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question: request.payload.question,
            site: request.payload.site
          })
        });
        const data = await response.json();
        sendResponse({ success: data.success, answer: data.answer, error: data.error });
      } catch (err) {
        sendResponse({ success: false, error: 'Backend not reachable' });
      }
    })();
    return true;
  }

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

  if (request.action === 'findAlternative') {
    // Return a promise to keep channel open
    chrome.storage.sync.get(['openaiApiKey'], async (data) => {
      if (!data.openaiApiKey) {
        sendResponse({ success: false, error: 'API Key missing' });
        return;
      }

      try {
        const { productName, materials } = request.payload;

        const badMaterials = (materials || [])
          .filter(m => ['polyester', 'acrylic', 'nylon', 'spandex', 'elastane'].includes(m.name?.toLowerCase()))
          .map(m => m.name)
          .join(', ');

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${data.openaiApiKey}`
          },
          body: JSON.stringify({
            model: "gpt-3.5-turbo",
            messages: [
              {
                role: "system",
                content: "You are a sustainable fashion search assistant. You generate SHORT search queries (3-6 words) to find sustainable alternatives for synthetic clothing. Return ONLY the search query."
              },
              {
                role: "user",
                content: `Product: "${productName}"${badMaterials ? `\nBad materials to replace: ${badMaterials}` : ''}\n\nTask: Generate search query for sustainable alternative (e.g. organic cotton, wool, linen).`
              }
            ],
            max_tokens: 20
          })
        });

        if (!response.ok) {
          throw new Error(`OpenAI API Error: ${response.status}`);
        }

        const json = await response.json();
        const query = json.choices[0].message.content.trim().replace(/^"|"$/g, '');

        if (!query) {
          throw new Error('No query generated');
        }

        // Generate URL
        const encodedQuery = encodeURIComponent(query);
        const site = request.payload.site;
        let searchUrl;

        switch (site) {
          case 'zara.com':
            searchUrl = `https://www.zara.com/us/en/search?searchTerm=${encodedQuery}`;
            break;
          case 'hm.com':
            searchUrl = `https://www2.hm.com/en_us/search-results.html?q=${encodedQuery}`;
            break;
          case 'uniqlo.com':
            searchUrl = `https://www.uniqlo.com/us/en/search?q=${encodedQuery}`;
            break;
          case 'asos.com':
            searchUrl = `https://www.asos.com/us/search/?q=${encodedQuery}`;
            break;
          case 'amazon.com':
            searchUrl = `https://www.amazon.com/s?k=${encodedQuery}`;
            break;
          default:
            searchUrl = `https://www.google.com/search?tbm=shop&q=${encodedQuery}+sustainable`;
        }

        sendResponse({ success: true, searchUrl, query });

      } catch (error) {
        console.error('OpenAI Error:', error);
        sendResponse({ success: false, error: error.message });
      }
    });
    return true; // Keep channel open for async response
  }

  if (request.action === 'openOptionsPage') {
    chrome.runtime.openOptionsPage();
    return true;
  }

  return false;
});

// Handle extension icon click (Toggle ON/OFF)
chrome.action.onClicked.addListener((tab) => {
  chrome.storage.sync.get(['enabled'], (data) => {
    const newState = !data.enabled; // Toggle

    // Save new state
    chrome.storage.sync.set({ enabled: newState }, () => {
      // Update badge to show state
      updateBadgeState(newState);

      // Reload current tab to apply changes
      if (tab.id) {
        chrome.tabs.reload(tab.id);
      }
    });
  });
});

// Helper to update badge appearance
function updateBadgeState(enabled) {
  if (enabled) {
    chrome.action.setBadgeText({ text: '' }); // Clear "OFF" text
  } else {
    chrome.action.setBadgeText({ text: 'OFF' });
    chrome.action.setBadgeBackgroundColor({ color: '#666666' });
  }
}

// Initialize badge on startup
chrome.runtime.onStartup.addListener(() => {
  chrome.storage.sync.get(['enabled'], (data) => {
    updateBadgeState(data.enabled !== false);
  });
});